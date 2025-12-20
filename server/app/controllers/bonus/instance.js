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
 * Record an export event in the instance history
 */
exports.api.recordExport = async (req, res, next) => {
    const form = formidable({ multiples: false });
    form.parse(req, async (err, fields, files) => {
        if (err) {
            return next(badRequest('Failed to parse form data'));
        }

        try {
            const instanceId = req.params.id;
            const { type, user, userId, fileSize } = fields;

            // Validate required fields
            if (!type || !['Excel', 'PDF'].includes(type)) {
                return next(badRequest('Invalid export type. Must be "Excel" or "PDF".'));
            }

            // Find the instance
            const instance = await BonusInstance.findById(instanceId);
            if (!instance) {
                return next(notFound('Bonus instance not found'));
            }

            // Add export record to the instance
            if (!instance.exports) {
                instance.exports = [];
            }

            const exportRecord = {
                date: new Date(),
                type,
                user,
                fileSize
            };

            // Add userId if provided
            if (req.actor.id) {
                exportRecord.userId = req.actor.id;
            }

            instance.exports.push(exportRecord);
            instance.updatedAt = new Date();

            // Save the instance with the new export record
            await instance.save();

            // Return the updated instance with exports
            return res.json({
                message: 'Export recorded successfully',
                exports: instance.exports
            });
        } catch (error) {
            console.error('Error recording export:', error);
            return next(error);
        }
    });
};

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
                shareAmount: shareAmount || template.calculationConfig.defaultShareAmount,
                // Copy tax configuration from template
                taxName: template.taxConfig?.taxName || "Impôt sur le revenu",
                taxPercentage: template.taxConfig?.taxPercentage || 5.28,
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
        // 1. Load instance first to scope snapshots to its referencePeriod
        const instance = await BonusInstance.findById(req.params.id);
        // ... rest of your generation logic
        if (instance) {
            await bulkCreateSnapshots(new Date(), instance.referencePeriod);
        } else {
            await bulkCreateSnapshots(new Date());
        }

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

        // Get allocation counts and total amounts/taxes for each instance
        const instances = await Promise.all(items.map(async (instance) => {
            const instanceId = mongoose.Types.ObjectId(instance._id);

            // Calculate allocation stats using aggregation
            const stats = await BonusAllocation.aggregate([
                {
                    $match: {
                        instanceId: instanceId,
                        status: { $ne: 'cancelled' }
                    }
                },
                {
                    $group: {
                        _id: null,
                        count: { $sum: 1 },
                        totalAmount: { $sum: { $ifNull: [ '$finalAmount', 0 ] } },
                        totalTax: { $sum: { $ifNull: [ '$taxAmount', 0 ] } },
                        totalNet: { $sum: { $ifNull: [ '$netAmount', 0 ] } }
                    }
                }
            ]);

            let allocStats;
            if (stats.length > 0) {
                const s = stats[0];
                const totalAmount = s.totalAmount || 0;
                const totalTax = s.totalTax || 0;
                let totalNet = s.totalNet || 0;

                // Fallback: if totalNet missing but we have totalAmount and totalTax, derive it
                if (!totalNet && totalAmount && totalTax) {
                    totalNet = totalAmount - totalTax;
                }

                // Compute an effective tax rate (%), if we have positive totals
                let effectiveTaxRate = null;
                if (totalAmount > 0 && totalTax > 0) {
                    effectiveTaxRate = (totalTax / totalAmount) * 100;
                } else if (typeof instance.taxPercentage === 'number') {
                    effectiveTaxRate = instance.taxPercentage;
                }

                allocStats = {
                    allocationsCount: s.count,
                    totalAmount,
                    totalTax,
                    totalNet,
                    taxRate: effectiveTaxRate
                };
            } else {
                allocStats = {
                    allocationsCount: 0,
                    totalAmount: 0,
                    totalTax: 0,
                    totalNet: 0,
                    taxRate: typeof instance.taxPercentage === 'number' ? instance.taxPercentage : null
                };
            }

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
        const instance = await BonusInstance.findById(req.params.id)
            .populate('templateId')
            .populate('createdBy', 'firstname lastname');

        if (!instance) {
            throw notFound('Bonus instance not found');
        }

        // Get the requested format from the query parameter (default to Excel)
        const format = req.query.format?.toLowerCase() || 'excel';

        if (format === 'pdf') {
            // PDF Export
            const pdfBuffer = await exportService.exportBonusToPdf(instance);

            res.setHeader('Content-Type', 'application/pdf');
            const filename = `bonus-export-${instance.referencePeriod || 'all'}.pdf`;
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

            res.send(pdfBuffer);
        } else {
            // Excel Export (default)
            const workbook = await exportService.exportBonusToExcel(instance);

            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            const filename = `bonus-export-${instance.referencePeriod || 'all'}.xlsx`;
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

            await workbook.xlsx.write(res);
            res.end();
        }
    } catch (error) {
        console.error('Export error:', error);
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
            {
                $match: {
                    instanceId: mongoose.Types.ObjectId(id),
                    status: { $ne: 'excluded' }  // Exclude allocations with status "excluded"
                }
            },
            {
                $group: {
                    _id: null,
                    count: { $sum: 1 },
                    totalAmount: { $sum: "$finalAmount" },
                    totalParts: { $sum: "$calculationInputs.parts" }  // Access parts in calculationInputs
                }
            }
        ]);

        const result = stats.length > 0 ? {
            count: stats[0].count,
            totalAmount: stats[0].totalAmount,
            totalParts: stats[0].totalParts || 0
        } : { count: 0, totalAmount: 0, totalParts: 0 };

        res.status(200).json(result);
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
        // Accept JSON body or multipart (if any middleware populated req.fields)
        const step = (req.body && req.body.step) || (req.fields && req.fields.step);

        if (!step || !['adjust', 'confirm', 'export', 'completed'].includes(step)) {
            return next(badRequest('Invalid step provided'));
        }

        const instance = await BonusInstance.findById(id);
        if (!instance) {
            return next(notFound('Bonus instance not found'));
        }

        if (['approved', 'paid', 'cancelled'].includes(instance.status)) {
            return next(forbidden('Cannot modify an approved, paid or cancelled instance'));
        }

        instance.wizardStep = step;

        if (instance.status === 'draft' || step === 'adjust') {
            switch (step) {
                case 'adjust':
                    instance.status = 'draft';
                    break;
                case 'confirm':
                case 'export':
                    instance.status = 'under_review';
                    break;
                case 'completed':
                    instance.status = 'under_review';
                    break;
            }
        }

        await instance.save();

        // Re-fetch populated version so front-end retains template category
        const populated = await BonusInstance.findById(id)
            .populate('templateId', 'name code category')
            .populate('createdBy', 'firstname lastname');

        res.json(populated);
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

/**
 * Update share amount and recalculate allocations
 */
exports.api.updateShareAmount = async (req, res, next) => {
    const form = formidable({ multiples: false });
    form.parse(req, async (err, fields, files) => {
        if (err) {
            return next(badRequest('Failed to parse form data'));
        }
        try {
            const instanceId = req.params.id;
            const { newShareAmount, reason } = fields;

            const parsedShareAmount = Number(newShareAmount);

            if (!parsedShareAmount || typeof parsedShareAmount !== 'number' || parsedShareAmount <= 0) {
                return next(badRequest('Valid newShareAmount is required'));
            }

            if (!reason) {
                return next(badRequest('Reason for share amount change is required'));
            }

            // Find the instance
            const instance = await BonusInstance.findById(instanceId);
            if (!instance) {
                return next(notFound('Bonus instance not found'));
            }

            // Check if the instance can be modified
            if (['approved', 'paid', 'cancelled'].includes(instance.status)) {
                return next(forbidden('Cannot update share amount for instances with status: ' + instance.status));
            }

            // Store the previous amount for history
            const previousShareAmount = instance.shareAmount;

            // Create history entry
            const historyEntry = {
                date: new Date(),
                previousAmount: previousShareAmount,
                newAmount: parsedShareAmount,
                userId: req.actor.id,
                userName: req.actor.name || 'User ' + req.actor.id,
                reason
            };

            // Update share amount
            instance.shareAmount = parsedShareAmount;

            // Add to history
            if (!instance.shareAmountHistory) {
                instance.shareAmountHistory = [];
            }
            instance.shareAmountHistory.push(historyEntry);

            // Update recalculation status
            instance.recalculationStatus = {
                inProgress: true,
                startedAt: new Date(),
                completedAt: null,
                progress: 0,
                totalAllocations: 0,
                processedAllocations: 0
            };

            // Save the instance first to update the status
            await instance.save();

            // Start the recalculation process asynchronously
            recalculateAllocations(instance, parsedShareAmount, previousShareAmount)
                .catch(err => {
                    console.error('Error during allocation recalculation:', err);
                    // Update instance to reflect the error
                    BonusInstance.findByIdAndUpdate(
                        instanceId,
                        {
                            $set: {
                                'recalculationStatus.inProgress': false,
                                'recalculationStatus.completedAt': new Date()
                            }
                        }
                    ).exec();
                });

            res.status(200).json(instance);
        } catch (err) {
            next(err);
        }
    });
};

/**
 * Helper function to recalculate all allocations for an instance
 * based on the new share amount
 */
async function recalculateAllocations(instance, newShareAmount, oldShareAmount) {
    try {
        // Count total allocations
        const totalAllocations = await BonusAllocation.countDocuments({
            instanceId: instance._id
        });

        // Update the instance with the total count
        await BonusInstance.findByIdAndUpdate(
            instance._id,
            {
                $set: {
                    'recalculationStatus.totalAllocations': totalAllocations
                }
            }
        );

        if (totalAllocations === 0) {
            await BonusInstance.findByIdAndUpdate(
                instance._id,
                {
                    $set: {
                        'recalculationStatus.inProgress': false,
                        'recalculationStatus.completedAt': new Date(),
                        'recalculationStatus.progress': 100,
                        'recalculationStatus.processedAllocations': 0
                    }
                }
            );
            return;
        }

        // Calculate the ratio between new and old share amounts
        const ratio = newShareAmount / oldShareAmount;
        const taxRate = (instance.taxPercentage || 0) / 100;

        // Process allocations in batches (align with tax recalculation logic)
        const batchSize = 100;
        let processedCount = 0;
        let currentBatch = 0;

        while (true) {
            // Get a batch of allocations
            const allocations = await BonusAllocation.find({ instanceId: instance._id })
                .skip(currentBatch * batchSize)
                .limit(batchSize);

            if (allocations.length === 0) break;

            // Process each allocation in the current batch
            for (const allocation of allocations) {
                // Skip excluded allocations
                if (allocation.status === 'excluded') {
                    processedCount++;
                    continue;
                }

                const previousCalculatedAmount = allocation.calculatedAmount || 0;
                const previousFinalAmount = allocation.finalAmount ?? previousCalculatedAmount;

                // Derive previous gross/tax/net if missing, using current instance tax rate
                const previousNetBase = allocation.netAmount ?? previousFinalAmount;
                const previousGrossAmount = allocation.grossAmount ?? (taxRate < 1 ? (previousNetBase / (1 - taxRate)) : previousNetBase);
                const previousTaxAmount = allocation.taxAmount ?? (previousGrossAmount * taxRate);
                const previousNetAmount = allocation.netAmount ?? (previousGrossAmount - previousTaxAmount);

                // New calculated amount scales with ratio
                const newCalculatedAmount = previousCalculatedAmount * ratio;

                // Preserve manual adjustment ratio when status is 'adjusted'
                const wasAdjusted = allocation.status === 'adjusted';
                let newFinalAmount;
                if (wasAdjusted && previousCalculatedAmount > 0) {
                    const adjustmentRatio = previousFinalAmount / previousCalculatedAmount;
                    newFinalAmount = newCalculatedAmount * adjustmentRatio;
                } else {
                    // Otherwise scale final amount directly
                    newFinalAmount = previousFinalAmount * ratio;
                }

                // Scale gross by ratio, then recompute tax and net at current tax rate
                const newGrossAmount = previousGrossAmount * ratio;
                const newTaxAmount = newGrossAmount * taxRate;
                const newNetAmount = newGrossAmount - newTaxAmount;

                // Prepare history entry (align structure with tax recalculation)
                const adjustmentEntry = {
                    timestamp: new Date(),
                    userName: 'System',
                    reason: `Share amount updated: ${oldShareAmount} to ${newShareAmount}`,
                    previousShareAmount: oldShareAmount,
                    newShareAmount: newShareAmount,
                    previousCalculatedAmount,
                    newCalculatedAmount,
                    previousGrossAmount,
                    newGrossAmount,
                    previousTaxAmount,
                    newTaxAmount,
                    previousNetAmount,
                    newNetAmount,
                    previousFinalAmount,
                    newFinalAmount
                };

                // Ensure calculationInputs and history array exist
                if (!allocation.calculationInputs) {
                    allocation.calculationInputs = {};
                }
                if (!allocation.calculationInputs.adjustmentHistory) {
                    allocation.calculationInputs.adjustmentHistory = [];
                }
                allocation.calculationInputs.adjustmentHistory.push(adjustmentEntry);

                // Update the allocation with recalculated fields
                await BonusAllocation.findByIdAndUpdate(
                    allocation._id,
                    {
                        $set: {
                            calculatedAmount: newCalculatedAmount,
                            finalAmount: newFinalAmount,
                            grossAmount: newGrossAmount,
                            taxAmount: newTaxAmount,
                            netAmount: newNetAmount,
                            taxRate: taxRate,
                            'calculationInputs.adjustmentHistory': allocation.calculationInputs.adjustmentHistory,
                            'calculationInputs.comment': allocation.calculationInputs.comment || 'Share amount updated',
                            status: allocation.status === 'eligible' ? 'adjusted' : allocation.status,
                            updatedAt: new Date()
                        }
                    }
                );

                processedCount++;

                // Update progress every 10 allocations or on completion
                if (processedCount % 10 === 0 || processedCount === totalAllocations) {
                    const progress = Math.floor((processedCount / totalAllocations) * 100);
                    await BonusInstance.findByIdAndUpdate(
                        instance._id,
                        {
                            $set: {
                                'recalculationStatus.progress': progress,
                                'recalculationStatus.processedAllocations': processedCount
                            }
                        }
                    );
                }
            }

            currentBatch++;
        }

        // Mark recalculation as complete
        await BonusInstance.findByIdAndUpdate(
            instance._id,
            {
                $set: {
                    'recalculationStatus.inProgress': false,
                    'recalculationStatus.completedAt': new Date(),
                    'recalculationStatus.progress': 100,
                    'recalculationStatus.processedAllocations': processedCount
                }
            }
        );

    } catch (error) {
        console.error('Error in recalculation process:', error);
        // Update instance to reflect the error
        await BonusInstance.findByIdAndUpdate(
            instance._id,
            {
                $set: {
                    'recalculationStatus.inProgress': false,
                    'recalculationStatus.completedAt': new Date()
                }
            }
        );
        throw error;
    }
}

/**
 * Update tax configuration and recalculate allocations
 */
exports.api.updateTaxConfig = async (req, res, next) => {
    const form = formidable({ multiples: false });
    form.parse(req, async (err, fields, files) => {
        if (err) {
            return next(badRequest('Failed to parse form data'));
        }
        try {
            const instanceId = req.params.id;
            const { taxName, taxPercentage, reason } = fields;

            const parsedTaxPercentage = Number(taxPercentage);

            if (typeof taxName !== 'string' || !taxName.trim()) {
                return next(badRequest('Valid taxName is required'));
            }

            if (!parsedTaxPercentage || typeof parsedTaxPercentage !== 'number' || parsedTaxPercentage < 0 || parsedTaxPercentage > 100) {
                return next(badRequest('Valid taxPercentage is required (0-100)'));
            }

            if (!reason) {
                return next(badRequest('Reason for tax configuration change is required'));
            }

            // Find the instance
            const instance = await BonusInstance.findById(instanceId);
            if (!instance) {
                return next(notFound('Bonus instance not found'));
            }

            // Check if the instance can be modified
            if (['approved', 'paid', 'cancelled'].includes(instance.status)) {
                return next(forbidden('Cannot update tax configuration for instances with status: ' + instance.status));
            }

            // Store the previous values for history
            const previousTaxName = instance.taxName;
            const previousTaxPercentage = instance.taxPercentage;

            // Create history entry
            const historyEntry = {
                date: new Date(),
                previousName: previousTaxName,
                previousPercentage: previousTaxPercentage,
                newName: taxName,
                newPercentage: parsedTaxPercentage,
                userId: req.actor.id,
                userName: req.actor.name || 'User ' + req.actor.id,
                reason
            };

            // Update tax configuration
            instance.taxName = taxName;
            instance.taxPercentage = parsedTaxPercentage;

            // Add to history
            if (!instance.taxConfigHistory) {
                instance.taxConfigHistory = [];
            }
            instance.taxConfigHistory.push(historyEntry);

            // Update recalculation status
            instance.recalculationStatus = {
                inProgress: true,
                startedAt: new Date(),
                completedAt: null,
                progress: 0,
                totalAllocations: 0,
                processedAllocations: 0
            };

            // Save the instance first to update the status
            await instance.save();

            // Start the recalculation process asynchronously to apply tax deduction to final amounts
            recalculateAllocationsWithTax(instance, parsedTaxPercentage, previousTaxPercentage)
                .catch(err => {
                    console.error('Error during allocation recalculation:', err);
                    // Update instance to reflect the error
                    BonusInstance.findByIdAndUpdate(
                        instanceId,
                        {
                            $set: {
                                'recalculationStatus.inProgress': false,
                                'recalculationStatus.completedAt': new Date()
                            }
                        }
                    ).exec();
                });

            res.status(200).json(instance);
        } catch (err) {
            next(err);
        }
    });
};

/**
 * Helper function to recalculate all allocations for an instance
 * based on the new tax percentage
 */
async function recalculateAllocationsWithTax(instance, newTaxPercentage, oldTaxPercentage) {
    try {
        // Count total allocations
        const totalAllocations = await BonusAllocation.countDocuments({
            instanceId: instance._id
        });

        // Update the instance with the total count
        await BonusInstance.findByIdAndUpdate(
            instance._id,
            {
                $set: {
                    'recalculationStatus.totalAllocations': totalAllocations
                }
            }
        );

        let processedCount = 0;

        // Process allocations in batches to avoid memory issues
        const batchSize = 100;
        let currentBatch = 0;

        while (true) {
            const allocations = await BonusAllocation.find({ instanceId: instance._id })
                .skip(currentBatch * batchSize)
                .limit(batchSize);

            if (allocations.length === 0) break;

            // Process each allocation in the current batch
            for (const allocation of allocations) {
                // Skip excluded allocations
                if (allocation.status === 'excluded') {
                    processedCount++;
                    continue;
                }

                const calculatedAmount = allocation.calculatedAmount || 0;
                const finalAmount = allocation.finalAmount || calculatedAmount;

                // Calculate gross amount (pre-tax amount)
                const oldTaxRate = oldTaxPercentage / 100;
                const newTaxRate = newTaxPercentage / 100;

                // Calculate gross amount (pre-tax)
                const grossAmount = allocation.grossAmount || finalAmount / (1 - oldTaxRate);

                // Calculate new tax amount
                const taxAmount = grossAmount * newTaxRate;

                // Calculate net amount (after tax deduction)
                const netAmount = grossAmount - taxAmount;

                // Prepare history entry for the adjustment
                const adjustmentEntry = {
                    timestamp: new Date(),
                    userName: 'System',
                    reason: `Tax configuration updated: ${oldTaxPercentage}% to ${newTaxPercentage}%`,
                    previousTaxRate: oldTaxPercentage,
                    newTaxRate: newTaxPercentage,
                    previousGrossAmount: allocation.grossAmount || grossAmount,
                    newGrossAmount: grossAmount,
                    previousTaxAmount: allocation.taxAmount || (grossAmount * oldTaxRate),
                    newTaxAmount: taxAmount,
                    previousNetAmount: allocation.netAmount || finalAmount,
                    newNetAmount: netAmount
                };

                // Ensure we have adjustmentHistory array
                if (!allocation.calculationInputs) {
                    allocation.calculationInputs = {};
                }

                if (!allocation.calculationInputs.adjustmentHistory) {
                    allocation.calculationInputs.adjustmentHistory = [];
                }

                // Add the adjustment history entry
                allocation.calculationInputs.adjustmentHistory.push(adjustmentEntry);

                // Update the allocation with tax fields while keeping finalAmount
                await BonusAllocation.findByIdAndUpdate(allocation._id, {
                    $set: {
                        'grossAmount': grossAmount,
                        'taxAmount': taxAmount,
                        'netAmount': netAmount,
                        'taxRate': newTaxRate,
                        'finalAmount': finalAmount, // Keep the original finalAmount
                        'calculationInputs.adjustmentHistory': allocation.calculationInputs.adjustmentHistory,
                        'calculationInputs.comment': allocation.calculationInputs.comment || 'Tax configuration updated',
                        'status': allocation.status === 'eligible' ? 'adjusted' : allocation.status, // Mark as adjusted if it was eligible
                        updatedAt: new Date()
                    }
                });

                processedCount++;

                // Update progress every 10 allocations or when reaching 100%
                if (processedCount % 10 === 0 || processedCount === totalAllocations) {
                    await BonusInstance.findByIdAndUpdate(
                        instance._id,
                        {
                            $set: {
                                'recalculationStatus.progress': Math.floor((processedCount / totalAllocations) * 100),
                                'recalculationStatus.processedAllocations': processedCount
                            }
                        }
                    );
                }
            }

            // Move to the next batch
            currentBatch++;
        }

        // Mark recalculation as complete
        await BonusInstance.findByIdAndUpdate(
            instance._id,
            {
                $set: {
                    'recalculationStatus.inProgress': false,
                    'recalculationStatus.completedAt': new Date(),
                    'recalculationStatus.progress': 100,
                    'recalculationStatus.processedAllocations': processedCount
                }
            }
        );

        console.log(`Recalculation complete for instance ${instance._id}. Processed ${processedCount} allocations.`);

    } catch (error) {
        console.error('Error during tax recalculation:', error);
        // Update instance to reflect the error
        await BonusInstance.findByIdAndUpdate(
            instance._id,
            {
                $set: {
                    'recalculationStatus.inProgress': false,
                    'recalculationStatus.completedAt': new Date()
                }
            }
        );
        throw error;
    }
}
