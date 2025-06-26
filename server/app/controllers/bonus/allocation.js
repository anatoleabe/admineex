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
        const { instanceId, personnelId, status, limit = 100, sortBy = 'createdAt:desc' } = req.query;

        const filter = {};
        if (instanceId) filter.instanceId = instanceId;
        if (personnelId) filter.personnelId = personnelId;
        if (status) filter.status = status;

        const [sortField, sortOrder] = sortBy.split(':');
        const sort = { [sortField]: sortOrder === 'desc' ? -1 : 1 };

        const allocations = await BonusAllocation.find(filter)
            .sort(sort)
            .limit(Number(limit))
            .populate('instanceId', 'referencePeriod status')
            .populate('personnelId', 'identifier name')
            .populate('templateId', 'name code')
            .populate('personnelSnapshotId'); // Include all snapshot data including position information

        // Process and beautify grades for all allocations
        for (const allocation of allocations) {
            if (allocation.personnelSnapshotId?.data) {
                const status = allocation.personnelSnapshotId.data.status || '';
                const grade = allocation.personnelSnapshotId.data.grade || '';

                if (status && grade) {
                    // Default language to French if not available
                    const language = 'fr';
                    const beautifiedGrade = dictionary.getValueFromJSON(
                        '../../resources/dictionary/personnel/status/' + status + '/grades.json',
                        parseInt(grade, 10),
                        "code"
                    ) || grade;

                    // Add beautifiedGrade to the allocation object
                    allocation.personnelSnapshotId.data.beautifiedGrade = beautifiedGrade;

                    // Also add beautifiedGrade directly to the allocation for frontend access
                    allocation.beautifiedGrade = beautifiedGrade;

                    // Add position name if available
                    if (allocation.personnelSnapshotId.data.position && allocation.personnelSnapshotId.data.position.name) {
                        allocation.personnelSnapshotId.data.beautifiedGrade += " / " + allocation.personnelSnapshotId.data.position.name;
                        allocation.beautifiedGrade += " / " + allocation.personnelSnapshotId.data.position.name;
                    }
                }
            }
        }
        res.json(allocations);
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
exports.api.adjust = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { amount, parts, reason } = req.body;

        const allocation = await BonusAllocation.findById(id)
            .populate('instanceId');

        if (!allocation) {
            throw notFound('Bonus allocation not found');
        }

        // Check if instance allows modifications
        if (['approved', 'paid'].includes(allocation.instanceId.status)) {
            throw forbidden('Cannot modify allocations for approved or paid instances');
        }

        // Create new version
        const newAllocation = await BonusAllocation.create({
            ...allocation.toObject(),
            _id: undefined,
            version: allocation.version + 1,
            previousVersion: allocation._id,
            calculationInputs: {
                ...allocation.calculationInputs,
                parts: parts !== undefined ? parts : allocation.calculationInputs.parts
            },
            finalAmount: amount !== undefined ? amount : allocation.finalAmount,
            status: 'adjusted',
            updatedAt: new Date()
        });

        res.json(newAllocation);
    } catch (error) {
        next(error);
    }
};

/**
 * Exclude bonus allocation
 */
exports.api.exclude = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;

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
                status: 'excluded',
                calculationInputs: {
                    ...allocation.calculationInputs,
                    adjustmentFactors: {
                        ...(allocation.calculationInputs.adjustmentFactors || {}),
                        exclusionReason: reason
                    }
                },
                updatedAt: new Date()
            },
            { new: true }
        );

        res.json(updatedAllocation);
    } catch (error) {
        next(error);
    }
};

/**
 * Include bonus allocation
 */
exports.api.include = async (req, res, next) => {
    try {
        const { id } = req.params;

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

        const currentAllocation = await BonusAllocation.findById(id);
        if (!currentAllocation) {
            throw notFound('Bonus allocation not found');
        }

        // Find all versions of this allocation
        const history = await BonusAllocation.find({
            $or: [
                { _id: id },
                { previousVersion: id },
                { _id: currentAllocation.previousVersion }
            ]
        })
            .sort({ version: 1 })
            .populate('personnelId', 'identifier name')
            .populate('instanceId', 'referencePeriod');

        res.json(history);
    } catch (error) {
        next(error);
    }
};