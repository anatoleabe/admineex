const httpStatus = require('http-status');
const mongoose = require('mongoose');
const { BonusInstance } = require('../../models/bonus/instance');
const { BonusTemplate } = require('../../models/bonus/template');
const { BonusAllocation } = require('../../models/bonus/allocation');
const { badRequest, notFound, forbidden } = require('../../utils/ApiError');
const { generatePaymentFile } = require('../../services/bonusService');
const { sendNotification } = require('../../services/notificationService');
const { exportBonusToExcel } = require('../../services/exportService');
const formidable = require('formidable');
const { bulkCreateSnapshots } = require('../../services/snapshotService');
const exportService = require('../../services/exportService');
const fs = require('fs');

// API methods
exports.api = {};

/**
 * Create a bonus instance
 */
exports.api.create = async (req, res, next) => {
    const form = formidable({ multiples: false });

    form.parse(req, async (err, fields, files) => {
        if (err) {
            return next(badRequest('Failed to parse form data'));
        }

        try {
            console.log(fields);
            const { templateId, referencePeriod, notes, shareAmount } = fields;

            if (!templateId || !referencePeriod) {
                throw badRequest('templateId and referencePeriod are required');
            }

            // Verify template exists and is active
            const template = await BonusTemplate.findById(templateId);
            if (!template) {
                throw notFound('Bonus template not found');
            }
            if (!template.isActive) {
                throw badRequest('Cannot create instance from inactive template');
            }

            // Check for existing instance for this period
            const existingInstance = await BonusInstance.findOne({ templateId, referencePeriod });
            if (existingInstance) {
                throw badRequest('Bonus instance already exists for this period');
            }

            // Create and return the new bonus instance
            const instance = await BonusInstance.create({
                templateId,
                referencePeriod,
                notes,
                shareAmount,
                createdBy: req.user?.id,
                status: 'draft'
            });

            res.status(201).json(instance);
        } catch (error) {
            next(error);
        }
    });
};

exports.api.generate = async (req, res, next) => {
    try {
        // 1. First create snapshots
        await bulkCreateSnapshots(new Date());

        // 2. Then proceed with bonus generation
        const instance = await BonusInstance.findById(req.params.id);
        // ... rest of your generation logic

        res.json({ success: true });
    } catch (error) {
        next(error);
    }
};

/**
 * Search bonus instances
 */
exports.api.search = async (req, res, next) => {
    try {
        const { query, limit = 10, offset = 0 } = req.query;

        const instances = await BonusInstance.find({
            $or: [
                { referencePeriod: { $regex: query, $options: 'i' } },
                { status: { $regex: query, $options: 'i' } }
            ]
        })
            .sort({ createdAt: -1 })
            .skip(Number(offset))
            .limit(Number(limit))
            .populate('templateId', 'name code')
            .populate('createdBy', 'firstname lastname');

        res.json(instances);
    } catch (error) {
        next(error);
    }
};

/**
 * Get all bonus instances
 */
exports.api.getAll = async (req, res, next) => {
    try {
        const {
            status,
            templateId,
            fromDate,
            toDate,
            limit = 10,
            offset = 0,
            sortBy = 'createdAt:desc'
        } = req.query;

        const filter = {};
        if (status) filter.status = status;
        if (templateId) filter.templateId = mongoose.Types.ObjectId(templateId);

        if (fromDate || toDate) {
            filter.createdAt = {};
            if (fromDate) filter.createdAt.$gte = new Date(fromDate);
            if (toDate) filter.createdAt.$lte = new Date(toDate);
        }

        const [sortField, sortOrder] = sortBy.split(':');
        const sort = { [sortField]: sortOrder === 'desc' ? -1 : 1 };

        // Get total count for pagination
        const total = await BonusInstance.countDocuments(filter);

        // Get paginated results with populated data
        const items = await BonusInstance.find(filter)
            .sort(sort)
            .skip(Number(offset))
            .limit(Number(limit))
            .populate('templateId', 'name code')
            .populate('createdBy', 'firstname lastname')
            .lean()
            .exec();

        // Get allocation counts and total amounts for each instance
        const instances = await Promise.all(items.map(async (instance) => {
            // Calculate allocation stats using aggregation
            const stats = await BonusAllocation.aggregate([
                {
                    $match: {
                        instanceId: mongoose.Types.ObjectId(instance._id),
                        status: { $ne: 'cancelled' }
                    }
                },
                {
                    $group: {
                        _id: null,
                        count: { $sum: 1 },
                        totalAmount: { $sum: "$finalAmount" }
                    }
                }
            ]);

            const allocStats = stats.length > 0 ? {
                allocationsCount: stats[0].count,
                totalAmount: stats[0].totalAmount || 0
            } : {
                allocationsCount: 0,
                totalAmount: 0
            };

            return { ...instance, ...allocStats };
        }));

        res.json({
            items: instances,
            total,
            limit: Number(limit),
            offset: Number(offset)
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get bonus instance by ID
 */
exports.api.getById = async (req, res, next) => {
    try {
        const instance = await BonusInstance.findById(req.params.id)
            .populate('templateId')
            .populate('createdBy', 'firstname lastname');

        if (!instance) {
            throw notFound('Bonus instance not found');
        }

        res.json(instance);
    } catch (error) {
        next(error);
    }
};

/**
 * Update bonus instance
 */
exports.api.update = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { notes, customOverrides } = req.body;

        const instance = await BonusInstance.findById(id);
        if (!instance) {
            throw notFound('Bonus instance not found');
        }

        // Prevent updates to approved/paid instances
        if (['approved', 'paid'].includes(instance.status)) {
            throw forbidden('Cannot modify an approved or paid instance');
        }

        const updatedInstance = await BonusInstance.findByIdAndUpdate(
            id,
            {
                notes,
                customOverrides,
                updatedAt: new Date()
            },
            { new: true }
        );

        res.json(updatedInstance);
    } catch (error) {
        next(error);
    }
};

/**
 * Approve bonus instance
 */
exports.api.approve = async (req, res, next) => {
    try {
        const instance = await BonusInstance.findByIdAndUpdate(
            req.params.id,
            {
                status: 'approved',
                approvalDate: new Date(),
                updatedAt: new Date()
            },
            { new: true }
        );

        if (!instance) {
            throw notFound('Bonus instance not found');
        }

        res.json(instance);
    } catch (error) {
        next(error);
    }
};

/**
 * Reject bonus instance
 */
exports.api.reject = async (req, res, next) => {
    try {
        const { reason } = req.body;

        const instance = await BonusInstance.findByIdAndUpdate(
            req.params.id,
            {
                status: 'draft',
                notes: reason ? `Rejected: ${reason}` : 'Rejected',
                updatedAt: new Date()
            },
            { new: true }
        );

        if (!instance) {
            throw notFound('Bonus instance not found');
        }

        res.json(instance);
    } catch (error) {
        next(error);
    }
};

/**
 * Cancel bonus instance
 */
exports.api.cancel = async (req, res, next) => {
    try {
        const { reason } = req.body;

        const instance = await BonusInstance.findByIdAndUpdate(
            req.params.id,
            {
                status: 'cancelled',
                notes: reason ? `Cancelled: ${reason}` : 'Cancelled',
                updatedAt: new Date()
            },
            { new: true }
        );

        if (!instance) {
            throw notFound('Bonus instance not found');
        }

        res.json(instance);
    } catch (error) {
        next(error);
    }
};

/**
 * Generate payment files
 */
exports.api.generatePayments = async (req, res, next) => {
    try {
        const instance = await BonusInstance.findById(req.params.id)
            .populate('templateId');

        if (!instance) {
            throw notFound('Bonus instance not found');
        }
        if (instance.status !== 'approved') {
            throw badRequest('Only approved instances can generate payment files');
        }

        const paymentFile = await generatePaymentFile(instance);

        const updatedInstance = await BonusInstance.findByIdAndUpdate(
            req.params.id,
            {
                paymentDate: new Date(),
                status: 'paid',
                updatedAt: new Date()
            },
            { new: true }
        );

        res.json({
            instance: updatedInstance,
            paymentFile
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Export bonus instance data
 */
exports.api.export = async (req, res, next) => {
    try {
        const instance = await BonusInstance.findById(req.params.id);
        if (!instance) {
            throw new Error('Bonus instance not found');
        }

        const workbook = await exportBonusToExcel(instance);

        res.setHeader('Content-Type',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

        const filename = `bonus-export-${instance.referencePeriod || 'all'}.xlsx`;
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        next(error);
    }
};

/**
 * Notify users about bonus instance
 */
exports.api.notify = async (req, res, next) => {
    try {
        const instance = await BonusInstance.findById(req.params.id)
            .populate('templateId');

        if (!instance) {
            throw notFound('Bonus instance not found');
        }

        const notificationResults = await sendNotification({
            instanceId: instance._id,
            templateId: instance.templateId._id,
            referencePeriod: instance.referencePeriod,
            status: instance.status
        });

        res.json({
            success: true,
            instance,
            notificationResults
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get allocation statistics for a specific instance
 * Returns the count of allocations and the total amount
 */
exports.api.getAllocationStats = async (req, res, next) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            throw badRequest('Invalid instance ID');
        }

        // Get the instance
        const instance = await BonusInstance.findById(id);
        if (!instance) {
            throw notFound('Bonus instance not found');
        }

        // Calculate allocation stats
        const stats = await BonusAllocation.aggregate([
            { $match: { instanceId: mongoose.Types.ObjectId(id) } },
            {
                $group: {
                    _id: null,
                    count: { $sum: 1 },
                    totalAmount: { $sum: "$finalAmount" }
                }
            }
        ]);

        const result = stats.length > 0 ? {
            count: stats[0].count,
            totalAmount: stats[0].totalAmount
        } : { count: 0, totalAmount: 0 };

        res.status(httpStatus.OK).json(result);
    } catch (error) {
        next(error);
    }
};

/**
 * Update wizard step (multi-step workflow)
 */
exports.api.updateWizardStep = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { step } = req.body;

        if (!['adjust', 'confirm', 'export', 'completed'].includes(step)) {
            throw badRequest('Invalid wizard step');
        }

        const instance = await BonusInstance.findById(id);
        if (!instance) {
            throw notFound('Bonus instance not found');
        }

        // Prevent step updates to approved/paid instances
        if (['approved', 'paid'].includes(instance.status)) {
            throw forbidden('Cannot modify an approved or paid instance');
        }

        const updatedInstance = await BonusInstance.findByIdAndUpdate(
            id,
            {
                wizardStep: step,
                updatedAt: new Date()
            },
            { new: true }
        );

        res.json(updatedInstance);
    } catch (error) {
        next(error);
    }
};

/**
 * Get historical snapshot data for a bonus instance
 */
exports.api.getHistoricalData = async (req, res, next) => {
    try {
        const { id } = req.params;

        const instance = await BonusInstance.findById(id);
        if (!instance) {
            throw notFound('Bonus instance not found');
        }

        // Find all allocations for this instance with their snapshot data
        const allocations = await BonusAllocation.find({ instanceId: id })
            .populate({
                path: 'personnelId',
                select: 'identifier name'
            })
            .populate({
                path: 'personnelSnapshotId',
                select: 'snapshotDate data'
            })
            .lean();

        // Group by personnel with historical data
        const personnelHistoricalData = allocations.reduce((acc, allocation) => {
            if (!allocation.personnelId || !allocation.personnelSnapshotId) return acc;

            const personnelId = allocation.personnelId._id.toString();

            acc[personnelId] = {
                personnelId: allocation.personnelId._id,
                name: allocation.personnelId.name,
                identifier: allocation.personnelId.identifier,
                snapshotDate: allocation.personnelSnapshotId.snapshotDate,
                historicalData: allocation.personnelSnapshotId.data,
                allocationId: allocation._id,
                allocationStatus: allocation.status,
                calculatedAmount: allocation.calculatedAmount,
                finalAmount: allocation.finalAmount,
                calculationInputs: allocation.calculationInputs
            };

            return acc;
        }, {});

        res.json({
            instance,
            personnelData: Object.values(personnelHistoricalData)
        });
    } catch (error) {
        next(error);
    }
};

/**
 * View all personnel snapshots used in instance calculations
 */
exports.api.getInstanceSnapshots = async (req, res, next) => {
    try {
        const { id } = req.params;

        const instance = await BonusInstance.findById(id);
        if (!instance) {
            throw notFound('Bonus instance not found');
        }

        // Find all allocations for this instance to get the snapshot IDs
        const allocations = await BonusAllocation.find({
            instanceId: id
        }).select('personnelSnapshotId personnelId').lean();

        // Extract unique snapshot IDs and personnel IDs
        const snapshotIds = [...new Set(allocations.map(a => a.personnelSnapshotId))];

        // Find the actual snapshots
        const snapshots = await PersonnelSnapshot.find({
            _id: { $in: snapshotIds }
        }).populate({
            path: 'personnelId',
            select: 'identifier name'
        }).lean();

        res.json({
            instance,
            snapshotsCount: snapshots.length,
            snapshots
        });
    } catch (error) {
        next(error);
    }
};
