const httpStatus = require('http-status');
const mongoose = require('mongoose');
const { BonusAllocation } = require('../../models/bonus/allocation');
const { BonusInstance } = require('../../models/bonus/instance');
const { Personnel } = require('../../models/personnel');
//const { PersonnelSnapshot } = require('../../models/bonus/PersonnelSnapshot');
const { badRequest, notFound, forbidden } = require('../../utils/ApiError');
const dictionary = require('../../utils/dictionary');

// API methods
exports.api = {};

/**
 * Get all bonus allocations
 */
exports.api.getAll = async (req, res, next) => {
    try {
        const { instanceId, personnelId, status, fromDate, toDate, limit = 100, sortBy = 'createdAt:desc', offset = 0, envelope = 'false', search = '' } = req.query;

        // Build a typed filter usable by both Mongoose queries and raw aggregations
        const filter = {};
        if (instanceId) {
            filter.instanceId = mongoose.Types.ObjectId.isValid(instanceId)
                ? new mongoose.Types.ObjectId(instanceId)
                : instanceId;
        }
        if (personnelId) {
            filter.personnelId = mongoose.Types.ObjectId.isValid(personnelId)
                ? new mongoose.Types.ObjectId(personnelId)
                : personnelId;
        }
        if (status && status !== 'all') filter.status = status;

        // Add date range filtering
        if (fromDate || toDate) {
            filter.createdAt = {};
            if (fromDate) filter.createdAt.$gte = new Date(fromDate);
            if (toDate) filter.createdAt.$lte = new Date(toDate);
        }

        // Server-side search by personnel identifier or name
        let matchedPersonnelIds = null;
        const trimmedSearch = typeof search === 'string' ? search.trim() : '';
        if (trimmedSearch) {
            const regex = new RegExp(trimmedSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
            const people = await Personnel.find({
                $or: [
                    { identifier: regex },
                    { 'name.text': regex },
                    { 'name.use': regex },
                    { 'name.family': regex },
                    { 'name.given': regex }
                ]
            }).select('_id').lean();
            matchedPersonnelIds = people.map(p => p._id);

            // If an explicit personnelId filter exists, intersect it with search results
            if (filter.personnelId) {
                const explicitIds = Array.isArray(filter.personnelId?.$in)
                    ? filter.personnelId.$in
                    : [filter.personnelId];
                const explicitSet = new Set(explicitIds.map(id => id.toString()));
                matchedPersonnelIds = matchedPersonnelIds.filter(id => explicitSet.has(id.toString()));
            }

            if (matchedPersonnelIds.length === 0) {
                // No matches; return empty response quickly if envelope requested
                const wantsEnvelopeQuick = String(envelope).toLowerCase() === 'true' || envelope === '1';
                if (wantsEnvelopeQuick) {
                    return res.json({ items: [], total: 0, limit: Number(limit), offset: Number(offset), stats: { eligible: 0, excluded: 0, adjusted: 0, totalParts: 0, totalAmount: 0, total: 0 } });
                } else {
                    return res.json([]);
                }
            }

            filter.personnelId = { $in: matchedPersonnelIds };
        }

        const [sortField, sortOrder] = sortBy.split(':');
        const sort = { [sortField]: sortOrder === 'desc' ? -1 : 1 };

        // Always get paginated items
        const items = await BonusAllocation.find(filter)
            .sort(sort)
            .skip(Number(offset))
            .limit(Number(limit))
            .populate('instanceId', 'referencePeriod status shareAmount')
            .populate('personnelId', 'identifier name')
            .populate('templateId', 'name code')
            .populate('personnelSnapshotId');

        // Beautify grades for page items
        for (const allocation of items) {
            if (allocation.personnelSnapshotId?.data) {
                const statusVal = allocation.personnelSnapshotId.data.status || '';
                const grade = allocation.personnelSnapshotId.data.grade || '';
                if (statusVal && grade) {
                    const beautifiedGrade = dictionary.getValueFromJSON(
                        '../../resources/dictionary/personnel/status/' + statusVal + '/grades.json',
                        parseInt(grade, 10),
                        'code'
                    ) || grade;
                    allocation.personnelSnapshotId.data.beautifiedGrade = beautifiedGrade;
                    allocation.beautifiedGrade = beautifiedGrade;
                    if (allocation.personnelSnapshotId.data.position && allocation.personnelSnapshotId.data.position.name) {
                        allocation.personnelSnapshotId.data.beautifiedGrade += ' / ' + allocation.personnelSnapshotId.data.position.name;
                        allocation.beautifiedGrade += ' / ' + allocation.personnelSnapshotId.data.position.name;
                    }
                }
            }
        }

        // Fast path: default behavior returns array for backward compatibility
        const wantsEnvelope = String(envelope).toLowerCase() === 'true' || envelope === '1';
        if (!wantsEnvelope) {
            return res.json(items);
        }

        // Compute total count and stats across the full filtered set
        const [total, statAgg] = await Promise.all([
            BonusAllocation.countDocuments(filter),
            BonusAllocation.aggregate([
                { $match: filter },
                {
                    $group: {
                        _id: null,
                        total: { $sum: 1 },
                        eligible: { $sum: { $cond: [{ $eq: ['$status', 'eligible'] }, 1, 0] } },
                        excluded: { $sum: { $cond: [{ $eq: ['$status', 'excluded'] }, 1, 0] } },
                        adjusted: { $sum: { $cond: [{ $eq: ['$status', 'adjusted'] }, 1, 0] } },
                        totalParts: { $sum: { $cond: [
                            { $ne: ['$status', 'excluded'] },
                            { $ifNull: ['$calculationInputs.parts', 0] },
                            0
                        ] } },
                        totalAmount: { $sum: { $cond: [
                            { $ne: ['$status', 'excluded'] },
                            { $ifNull: ['$finalAmount', 0] },
                            0
                        ] } }
                    }
                }
            ])
        ]);

        const stats = statAgg && statAgg.length ? {
            eligible: statAgg[0].eligible || 0,
            excluded: statAgg[0].excluded || 0,
            adjusted: statAgg[0].adjusted || 0,
            totalParts: statAgg[0].totalParts || 0,
            totalAmount: statAgg[0].totalAmount || 0,
            total: statAgg[0].total || total
        } : { eligible: 0, excluded: 0, adjusted: 0, totalParts: 0, totalAmount: 0, total };

        return res.json({
            items,
            total,
            limit: Number(limit),
            offset: Number(offset),
            stats
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get bonus allocation by ID
 */
exports.api.getById = async (req, res, next) => {
    try {
        const allocation = await BonusAllocation.findById(req.params.id)
            .populate('instanceId')
            .populate('personnelId')
            .populate('templateId')
            .populate('personnelSnapshotId')
            .populate('previousVersion');

        if (!allocation) {
            throw notFound('Bonus allocation not found');
        }

        res.json(allocation);
    } catch (error) {
        next(error);
    }
};

/**
 * Adjust bonus allocation
 */
const formidable = require('formidable');

exports.api.adjust = async (req, res, next) => {
    try {
        const form = formidable({ multiples: false });
        form.parse(req, async (err, fields) => {
            if (err) {
                return next(badRequest('Invalid form data'));
            }

            const { id } = req.params;
            const { amount, parts, reason } = fields;

            // Require a reason for the adjustment for better history tracking
            if (!reason) {
                throw badRequest('Adjustment reason is required');
            }

            const allocation = await BonusAllocation.findById(id)
                .populate('instanceId');

            if (!allocation) {
                throw notFound('Bonus allocation not found');
            }

            // Check if instance allows modifications
            if (['approved', 'paid'].includes(allocation.instanceId.status)) {
                throw forbidden('Cannot modify allocations for approved or paid instances');
            }

            // Push current state into history
            if (!allocation.calculationInputs.adjustmentHistory) {
                allocation.calculationInputs.adjustmentHistory = [];
            }

            allocation.calculationInputs.adjustmentHistory.push({
                timestamp: new Date(),
                user: req.user.id, // Assuming req.user contains authenticated user info
                userName: req.user.name, // Assuming req.user contains authenticated user info
                reason,
                previousAmount: allocation.finalAmount,
                previousParts: allocation.calculationInputs.parts,
                previousComment: allocation.calculationInputs.comment,
                newAmount: amount,
                newParts: parts
            });

            // Update the main object with the latest adjustment
            allocation.finalAmount = amount;
            allocation.calculationInputs.parts = parts;
            allocation.calculationInputs.comment = reason; // Update with the latest comment
            allocation.status = 'adjusted';
            allocation.updatedAt = new Date();

            await allocation.save();

            res.json(allocation);
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Exclude bonus allocation
 */
exports.api.exclude = async (req, res, next) => {
    try {
        const form = formidable({ multiples: false });
        form.parse(req, async (err, fields) => {
            if (err) {
                return next(badRequest('Invalid form data'));
            }

            const { id } = req.params;
            let { reason } = fields;
            reason = (reason || '').trim();

            if (!reason || reason.length < 3) {
                return next(badRequest('Exclusion reason (min 3 chars) is required'));
            }

            const allocation = await BonusAllocation.findById(id)
                .populate('instanceId');

            if (!allocation) {
                throw notFound('Bonus allocation not found');
            }

            if (['approved', 'paid'].includes(allocation.instanceId.status)) {
                throw forbidden('Cannot modify allocations for approved or paid instances');
            }

            // Prepare history entry
            const historyEntry = {
                timestamp: new Date(),
                user: req.user && req.user.id ? req.user.id : null,
                userName: req.user && req.user.name ? req.user.name : null,
                reason: reason,
                previousAmount: allocation.finalAmount,
                previousParts: allocation.calculationInputs.parts,
                previousComment: allocation.calculationInputs.comment,
                action: 'exclude'
            };

            const newCalculationInputs = {
                ...allocation.calculationInputs,
                comment: reason, // mirror reason into comment for display/export
                adjustmentFactors: {
                    ...(allocation.calculationInputs.adjustmentFactors || {}),
                    exclusionReason: reason
                },
                adjustmentHistory: [
                    ...(allocation.calculationInputs.adjustmentHistory || []),
                    historyEntry
                ]
            };

            const updatedAllocation = await BonusAllocation.findByIdAndUpdate(
                id,
                {
                    status: 'excluded',
                    calculationInputs: newCalculationInputs,
                    updatedAt: new Date()
                },
                { new: true }
            );

            res.json(updatedAllocation);
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Include bonus allocation
 */
exports.api.include = async (req, res, next) => {
    try {
        const form = formidable({ multiples: false });
        form.parse(req, async (err, fields) => {
            if (err) {
                return next(badRequest('Invalid form data'));
            }

            const { id } = req.params;
            console.log('Including allocation with ID:', id);

            const allocation = await BonusAllocation.findById(id)
                .populate('instanceId');

            if (!allocation) {
                throw notFound('Bonus allocation not found');
            }

            if (['approved', 'paid'].includes(allocation.instanceId.status)) {
                throw forbidden('Cannot modify allocations for approved or paid instances');
            }

            const updatedAllocation = await BonusAllocation.findByIdAndUpdate(
                id,
                {
                    status: 'eligible',
                    calculationInputs: {
                        ...allocation.calculationInputs,
                        adjustmentFactors: {}
                    },
                    updatedAt: new Date()
                },
                { new: true }
            );

            res.json(updatedAllocation);
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get allocation history
 */
exports.api.getHistory = async (req, res, next) => {
    try {
        const { id } = req.params;

        const currentAllocation = await BonusAllocation.findById(id)
            .populate({
                path: 'calculationInputs.adjustmentHistory.user',
                select: 'firstname lastname'
            })
            .populate('personnelId');

        if (!currentAllocation) {
            throw notFound('Bonus allocation not found');
        }

        // Process history to include full user names
        const history = currentAllocation.calculationInputs.adjustmentHistory.map(entry => ({
            timestamp: entry.timestamp,
            user: entry.user ? `${entry.user.firstname} ${entry.user.lastname}` : 'System', // Handle null user
            reason: entry.reason,
            previousAmount: entry.previousAmount,
            newAmount: entry.newAmount,
            previousParts: entry.previousParts,
            newParts: entry.newParts,
            previousComment: entry.previousComment
        }));

        res.json({ current: currentAllocation, history });
    } catch (error) {
        next(error);
    }
};