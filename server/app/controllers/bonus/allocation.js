const httpStatus = require('http-status');
const mongoose = require('mongoose');
const { BonusAllocation } = require('../../models/bonus/allocation');
const { BonusInstance } = require('../../models/bonus/instance');
const { Personnel } = require('../../models/personnel');
//const { PersonnelSnapshot } = require('../../models/bonus/PersonnelSnapshot');
const { badRequest, notFound, forbidden } = require('../../utils/ApiError');

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
            .populate('personnelSnapshotId', 'snapshotDate');

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