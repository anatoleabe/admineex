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
 * Get Key Performance Indicators (KPIs)
 * - Total Bonus Paid (YTD)
 * - Number of Active Cycles (Under review/Draft)
 * - Total Employees Rewarded (Unique over last 12 months)
 * - Average Bonus Amount (Last 12 months)
 */
exports.api.getStats = async (req, res, next) => {
    try {
        const now = new Date();
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        const twelveMonthsAgo = new Date(now);
        twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

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
                { $match: { effectiveDate: { $gte: startOfYear, $lte: now } } },
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
                { $match: { effectiveDate: { $gte: twelveMonthsAgo, $lte: now } } },
                { $group: { _id: '$personnelId' } }
            ])
        ]);

        console.log(totalPaidAgg)

        const totalPaid = totalPaidAgg.length ? totalPaidAgg[0].total : 0;
        const uniqueBeneficiaries = uniqueBeneficiariesAgg.length;

        res.json({
            totalPaid,
            activeCyclesCount,
            uniqueBeneficiaries,
            currency: 'XAF' // Or dynamic if multi-currency
        });

    } catch (error) {
        next(error);
    }
};

/**
 * Get Monthly Payout Trends (Last 12 Months)
 */
exports.api.getTrends = async (req, res, next) => {
    try {
        const now = new Date();
        const twelveMonthsAgo = new Date(now);
        twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
        twelveMonthsAgo.setDate(1); // Start of the month

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
            { $match: { effectiveDate: { $gte: twelveMonthsAgo, $lte: now } } },
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

        let currentDate = new Date(twelveMonthsAgo);

        while (currentDate <= now) {
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
 * Get Distribution by Bonus Template Category
 */
exports.api.getDistribution = async (req, res, next) => {
    try {
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
            { $addFields: { amount: amountExpr() } },
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

        const labels = distribution.map(d => d._id);
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
