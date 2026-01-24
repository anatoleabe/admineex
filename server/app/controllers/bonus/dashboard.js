const mongoose = require('mongoose');
const { BonusInstance } = require('../../models/bonus/instance');
const { BonusAllocation } = require('../../models/bonus/allocation');
const { BonusTemplate } = require('../../models/bonus/template');
const audit = require('../../models/auditLog').AuditLog; // Assuming audit log model path
const User = require('../../models/user').User;
const dictionary = require('../../utils/dictionary');
const { notFound, badRequest } = require('../../utils/ApiError');

// Helper for translation
function t(req, msgid) {
    const language = (req && req.actor && req.actor.language) || (req && req.user && req.user.language) || '';
    return dictionary.translator(language).gettext(msgid);
}

exports.api = {};

function normalizeStatus(status) {
    if (!status) return status;
    const s = String(status).trim().toLowerCase();
    if (s === 'validated') return 'approved';
    return s;
}

function getInstanceStatuses(req) {
    const allowed = new Set(['approved', 'paid']);
    const raw = req.query.status
        ? (Array.isArray(req.query.status) ? req.query.status : String(req.query.status).split(','))
        : ['paid', 'approved'];

    const statuses = raw
        .map(normalizeStatus)
        .filter(status => status && allowed.has(status));

    return statuses.length ? statuses : ['paid', 'approved'];
}

function amountExpr() {
    return {
        $ifNull: [
            '$finalAmount',
            {
                $ifNull: [
                    '$netAmount',
                    { $ifNull: ['$grossAmount', { $ifNull: ['$calculatedAmount', 0] }] }
                ]
            }
        ]
    };
}

function effectiveDateExpr() {
    // IMPORTANT: avoid `instance.updatedAt` since editing an old instance would shift it into YTD/12M.
    // For paid instances use paymentDate; for approved instances use approvalDate; otherwise fallback to createdAt.
    return {
        $switch: {
            branches: [
                {
                    case: { $eq: ['$instance.status', 'paid'] },
                    then: { $ifNull: ['$instance.paymentDate', '$instance.createdAt'] }
                },
                {
                    case: { $eq: ['$instance.status', 'approved'] },
                    then: { $ifNull: ['$instance.approvalDate', '$instance.createdAt'] }
                }
            ],
            default: '$instance.createdAt'
        }
    };
}

/**
 * Parse date range from request query parameters
 * @param {Object} req - Express request object
 * @returns {Object} { startDate, endDate }
 */
function getDateRange(req) {
    const now = new Date();
    let startDate, endDate;

    if (req.query.startDate) {
        startDate = new Date(req.query.startDate);
        if (isNaN(startDate.getTime())) {
            startDate = new Date(now.getFullYear(), 0, 1); // Fallback to start of year
        }
    } else {
        startDate = new Date(now.getFullYear(), 0, 1); // Default: start of year
    }

    if (req.query.endDate) {
        endDate = new Date(req.query.endDate);
        if (isNaN(endDate.getTime())) {
            endDate = now;
        }
        // Set to end of day
        endDate.setHours(23, 59, 59, 999);
    } else {
        endDate = now;
    }

    return { startDate, endDate };
}

/**
 * Get Key Performance Indicators (KPIs)
 * - Total Bonus Paid (within date range)
 * - Number of Active Cycles (Under review/Draft)
 * - Total Employees Rewarded (Unique within date range)
 */
exports.api.getStats = async (req, res, next) => {
    try {
        const { startDate, endDate } = getDateRange(req);
        const instanceStatuses = getInstanceStatuses(req);

        const [totalPaidAgg, activeCyclesCount, uniqueBeneficiariesAgg] = await Promise.all([
            BonusAllocation.aggregate([
                { $match: { status: { $nin: ['excluded', 'cancelled'] } } },
                {
                    $lookup: {
                        from: 'bonusinstances',
                        localField: 'instanceId',
                        foreignField: '_id',
                        as: 'instance'
                    }
                },
                { $unwind: '$instance' },
                { $match: { 'instance.status': { $in: instanceStatuses } } },
                {
                    $addFields: {
                        amount: amountExpr(),
                        effectiveDate: effectiveDateExpr()
                    }
                },
                { $match: { effectiveDate: { $gte: startDate, $lte: endDate } } },
                { $group: { _id: null, total: { $sum: '$amount' } } }
            ]),

            BonusInstance.countDocuments({ status: { $in: instanceStatuses } }),

            BonusAllocation.aggregate([
                { $match: { status: { $nin: ['excluded', 'cancelled'] } } },
                {
                    $lookup: {
                        from: 'bonusinstances',
                        localField: 'instanceId',
                        foreignField: '_id',
                        as: 'instance'
                    }
                },
                { $unwind: '$instance' },
                { $match: { 'instance.status': { $in: instanceStatuses } } },
                {
                    $addFields: {
                        amount: amountExpr(),
                        effectiveDate: effectiveDateExpr()
                    }
                },
                { $match: { effectiveDate: { $gte: startDate, $lte: endDate } } },
                { $group: { _id: '$personnelId' } }
            ])
        ]);

        const totalPaid = totalPaidAgg.length ? totalPaidAgg[0].total : 0;
        const uniqueBeneficiaries = uniqueBeneficiariesAgg.length;

        res.json({
            totalPaid,
            activeCyclesCount,
            uniqueBeneficiaries,
            currency: 'XAF',
            dateRange: {
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString()
            }
        });

    } catch (error) {
        next(error);
    }
};

/**
 * Get Monthly Payout Trends (within date range)
 */
exports.api.getTrends = async (req, res, next) => {
    try {
        const { startDate, endDate } = getDateRange(req);
        // Ensure startDate is at the beginning of its month for proper grouping
        const rangeStart = new Date(startDate.getFullYear(), startDate.getMonth(), 1);

        const instanceStatuses = getInstanceStatuses(req);

        const trends = await BonusAllocation.aggregate([
            { $match: { status: { $nin: ['excluded', 'cancelled'] } } },
            {
                $lookup: {
                    from: 'bonusinstances',
                    localField: 'instanceId',
                    foreignField: '_id',
                    as: 'instance'
                }
            },
            { $unwind: '$instance' },
            { $match: { 'instance.status': { $in: instanceStatuses } } },
            {
                $addFields: {
                    amount: amountExpr(),
                    effectiveDate: effectiveDateExpr()
                }
            },
            { $match: { effectiveDate: { $gte: rangeStart, $lte: endDate } } },
            {
                $group: {
                    _id: {
                        year: { $year: '$effectiveDate' },
                        month: { $month: '$effectiveDate' }
                    },
                    totalAmount: { $sum: '$amount' }
                }
            },
            { $sort: { '_id.year': 1, '_id.month': 1 } }
        ]);

        // Format for Chart.js
        const labels = [];
        const data = [];

        let currentDate = new Date(rangeStart);

        while (currentDate <= endDate) {
            const year = currentDate.getFullYear();
            const month = currentDate.getMonth() + 1;
            const monthName = currentDate.toLocaleString('default', { month: 'short' });

            const match = trends.find(t => t._id.year === year && t._id.month === month);

            labels.push(`${monthName} ${year}`);
            data.push(match ? match.totalAmount : 0);

            currentDate.setMonth(currentDate.getMonth() + 1);
        }

        res.json({ labels, data });

    } catch (error) {
        next(error);
    }
};

/**
 * Get Distribution by Bonus Template Category (within date range)
 */
exports.api.getDistribution = async (req, res, next) => {
    try {
        const { startDate, endDate } = getDateRange(req);
        const instanceStatuses = getInstanceStatuses(req);

        const distribution = await BonusAllocation.aggregate([
            { $match: { status: { $nin: ['excluded', 'cancelled'] } } },
            {
                $lookup: {
                    from: 'bonusinstances',
                    localField: 'instanceId',
                    foreignField: '_id',
                    as: 'instance'
                }
            },
            { $unwind: '$instance' },
            { $match: { 'instance.status': { $in: instanceStatuses } } },
            {
                $addFields: {
                    amount: amountExpr(),
                    effectiveDate: effectiveDateExpr()
                }
            },
            { $match: { effectiveDate: { $gte: startDate, $lte: endDate } } },
            {
                $lookup: {
                    from: 'bonustemplates',
                    localField: 'templateId',
                    foreignField: '_id',
                    as: 'template'
                }
            },
            { $unwind: '$template' },
            {
                $group: {
                    _id: '$template.category',
                    totalAmount: { $sum: '$amount' },
                    count: { $sum: 1 }
                }
            }
        ]);

        const labels = distribution.map(d => d._id || 'Uncategorized');
        const data = distribution.map(d => d.totalAmount);

        res.json({ labels, data });

    } catch (error) {
        next(error);
    }
};

/**
 * Get Recent Activity (from Audit Log or Instance changes)
 */
exports.api.getActivity = async (req, res, next) => {
    try {
        // Fetch the latest 10 Audit Logs related to Bonus (instances, allocations, templates, generation, ...)
        const logs = await audit.find({
            origin: { $regex: /^bonus\// }
        })
            .sort({ date: -1, _id: -1 })
            .limit(10);

        // Manually populate users since 'actor' is a string ID in AuditLog
        const actorIds = [...new Set(logs.map(log => log.actor).filter(id => id && id !== '[anonymous]'))];
        const validActorObjectIds = actorIds
            .filter(id => mongoose.Types.ObjectId.isValid(id))
            .map(id => new mongoose.Types.ObjectId(id));

        const users = validActorObjectIds.length
            ? await User.find({ _id: { $in: validActorObjectIds } }).select('firstname lastname')
            : [];
        const userMap = {};
        const userList = Array.isArray(users) ? users : (users ? [users] : []);
        userList.forEach(u => userMap[u._id.toString()] = `${u.firstname} ${u.lastname}`);

        const activities = logs.map(log => ({
            id: log._id,
            user: userMap[log.actor] || log.actor || 'System',
            action: log.action || log.label || log.origin,
            target: log.object, // instance ID or template ID
            description: log.description || '',
            date: log.date || log._id.getTimestamp(),
            status: log.status
        }));

        res.json(activities);

    } catch (error) {
        next(error);
    }
};
