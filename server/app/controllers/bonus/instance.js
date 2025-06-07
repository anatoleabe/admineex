const httpStatus = require('http-status');
const mongoose = require('mongoose');
const { BonusInstance } = require('../../models/bonus/instance');
const { BonusTemplate } = require('../../models/bonus/template');
const { BonusAllocation } = require('../../models/bonus/allocation');
const { badRequest, notFound, forbidden } = require('../../utils/ApiError');
const { generatePaymentFile } = require('../../services/bonusService');
const { sendNotification } = require('../../services/notificationService');
const { exportToExcel } = require('../../services/exportService');
const formidable = require('formidable');
const { bulkCreateSnapshots } = require('../../services/snapshotService');

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

        // Get allocation counts for each instance
        const instances = await Promise.all(items.map(async (instance) => {
            const allocationsCount = await BonusAllocation.countDocuments({
                instanceId: instance._id,
                status: { $ne: 'cancelled' }
            });
            return { ...instance, allocationsCount };
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
        const instance = await BonusInstance.findById(req.params.id)
            .populate('templateId');

        if (!instance) {
            throw notFound('Bonus instance not found');
        }

        const exportData = await exportToExcel(instance);

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=bonus-instance-${instance.referencePeriod}.xlsx`);

        exportData.xlsx.write(res).then(() => {
            res.end();
        });
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

