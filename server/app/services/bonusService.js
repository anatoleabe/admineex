// services/bonusService.js
const mongoose = require('mongoose');
const { BonusAllocation } = require('../models/bonus/allocation');
const { BonusInstance } = require('../models/bonus/instance');
const { badRequest, notFound, forbidden, ApiError} = require('../utils/ApiError');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { format } = require('date-fns');
const httpStatus = require('http-status');

/**
 * Generate payment file for a bonus instance
 * @param {Object} instance - BonusInstance document
 * @returns {Promise<Object>} - Payment file information
 */
exports.generatePaymentFile = async (instance) => {
    try {
        // Verify instance exists and is approved
        const bonusInstance = await BonusInstance.findById(instance._id)
            .populate('templateId');

        if (!bonusInstance) {
            throw notFound('Bonus instance not found');
        }

        if (bonusInstance.status !== 'approved') {
            throw badRequest('Only approved instances can generate payment files');
        }

        // Get all paid allocations for this instance
        const allocations = await BonusAllocation.find({
            instanceId: instance._id,
            status: { $in: ['approved', 'adjusted'] }
        })
            .populate('personnelId', 'identifier name')
            .populate('personnelSnapshotId');

        if (allocations.length === 0) {
            throw badRequest('No eligible allocations found for this instance');
        }

        // Prepare payment data
        const paymentData = allocations.map(allocation => ({
            personnelId: allocation.personnelId.identifier,
            personnelName: allocation.personnelId.name.text,
            amount: allocation.finalAmount,
            reference: `${bonusInstance.templateId.code}-${bonusInstance.referencePeriod}`,
            paymentDate: format(new Date(), 'yyyy-MM-dd'),
            accountNumber: allocation.personnelSnapshotId.data.bankAccount || 'N/A',
            // Add other required payment fields
        }));

        // Generate file content (CREMINCAM format)
        const fileContent = generateCremincamFormat(paymentData, bonusInstance);

        // Create directory if not exists
        const dirPath = path.join(__dirname, '../../payment_files');
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }

        // Generate filename
        const filename = `payment_${bonusInstance.templateId.code}_${bonusInstance.referencePeriod}_${format(new Date(), 'yyyyMMddHHmmss')}.txt`;
        const filePath = path.join(dirPath, filename);

        // Write file
        fs.writeFileSync(filePath, fileContent);

        // Generate file hash for verification
        const fileHash = crypto.createHash('sha256')
            .update(fileContent)
            .digest('hex');

        return {
            filename,
            filePath,
            fileHash,
            recordCount: paymentData.length,
            totalAmount: paymentData.reduce((sum, item) => sum + item.amount, 0),
            generatedAt: new Date()
        };
    } catch (error) {
        throw new ApiError(
            error.message || 'Failed to generate payment file',
            error.statusCode || httpStatus.INTERNAL_SERVER_ERROR
        );
    }
};

/**
 * Generate CREMINCAM payment file format
 * @param {Array} paymentData - Array of payment records
 * @param {Object} instance - BonusInstance document
 * @returns {String} - Formatted file content
 */
function generateCremincamFormat(paymentData, instance) {
    // Header line
    let fileContent = `HEADER|${instance.templateId.code}|${instance.referencePeriod}|${format(new Date(), 'yyyyMMdd')}\n`;

    // Payment lines
    paymentData.forEach((payment, index) => {
        fileContent += `PAYMENT|${index + 1}|${payment.personnelId}|${payment.personnelName}|` +
            `${payment.amount}|${payment.reference}|${payment.accountNumber}\n`;
    });

    // Footer line with totals
    const totalAmount = paymentData.reduce((sum, item) => sum + item.amount, 0);
    fileContent += `FOOTER|${paymentData.length}|${totalAmount}|${fileContent.length}`;

    return fileContent;
}

/**
 * Calculate bonus amounts based on template rules
 * @param {Object} template - BonusTemplate document
 * @param {Object} personnelData - Personnel data including snapshot
 * @returns {Object} - Calculation results
 */
exports.calculateBonusAmount = async (template, personnelData) => {
    try {
        let amount = 0;
        let parts = 1;
        const calculationLog = [];

        // Apply base calculation
        switch (template.calculationConfig.formulaType) {
            case 'fixed':
                amount = template.calculationConfig.fixedAmount;
                calculationLog.push(`Applied fixed amount: ${amount}`);
                break;

            case 'percentage':
                const baseValue = personnelData[template.calculationConfig.baseField] || 0;
                amount = baseValue * (template.calculationConfig.percentage / 100);
                calculationLog.push(`Calculated ${template.calculationConfig.percentage}% of ${baseValue} = ${amount}`);
                break;

            case 'parts_based':
                // Determine parts
                parts = template.calculationConfig.partsConfig.defaultParts;

                // Apply part rules
                for (const rule of template.calculationConfig.partRules) {
                    try {
                        // Safely evaluate the condition
                        const conditionMet = safeEval(rule.condition, {
                            ...personnelData,
                            personnel: personnelData // alias
                        });

                        if (conditionMet) {
                            parts = rule.parts;
                            calculationLog.push(`Applied parts rule: ${rule.condition} → ${parts} parts`);
                            break;
                        }
                    } catch (e) {
                        calculationLog.push(`Error evaluating parts rule: ${rule.condition} - ${e.message}`);
                    }
                }

                // Calculate amount
                const base = personnelData[template.calculationConfig.baseField] || 0;
                amount = safeEval(template.calculationConfig.formula, {
                    base,
                    parts,
                    personnel: personnelData
                });

                calculationLog.push(`Calculated with formula: ${template.calculationConfig.formula} = ${amount}`);
                break;

            case 'custom_formula':
                amount = safeEval(template.calculationConfig.formula, {
                    ...personnelData,
                    personnel: personnelData // alias
                });
                calculationLog.push(`Calculated with custom formula: ${amount}`);
                break;
        }

        return {
            amount,
            parts,
            calculationLog
        };
    } catch (error) {
        throw new ApiError(
            `Bonus calculation failed: ${error.message}`,
            httpStatus.INTERNAL_SERVER_ERROR,
        );
    }
};

/**
 * Process all allocations for a bonus instance
 * @param {String} instanceId - BonusInstance ID
 */
exports.processInstanceAllocations = async (instanceId) => {
    const instance = await BonusInstance.findById(instanceId)
        .populate('templateId');

    if (!instance) {
        throw new ApiError('Bonus instance not found', httpStatus.NOT_FOUND);
    }

    // Get all eligible personnel for this instance
    // This would depend on your business logic
    const eligiblePersonnel = await getEligiblePersonnel(instance);

    // Process each personnel
    for (const personnel of eligiblePersonnel) {
        try {
            const { amount, parts, calculationLog } = await this.calculateBonusAmount(
                instance.templateId,
                personnel
            );

            // Create or update allocation
            await BonusAllocation.findOneAndUpdate(
                { instanceId, personnelId: personnel._id },
                {
                    personnelSnapshotId: personnel.snapshotId,
                    templateId: instance.templateId._id,
                    calculationInputs: {
                        baseSalary: personnel.salary,
                        category: personnel.category,
                        grade: personnel.grade,
                        rank: personnel.rank,
                        parts,
                        adjustmentFactors: {}
                    },
                    calculatedAmount: amount,
                    finalAmount: amount,
                    status: 'eligible',
                    $inc: { version: 1 }
                },
                { upsert: true, new: true }
            );

        } catch (error) {
            console.error(`Failed to process allocation for personnel ${personnel._id}:`, error);
            // Continue with next personnel
        }
    }

    // Update instance status
    instance.status = 'generated';
    instance.generationDate = new Date();
    await instance.save();

    return {
        success: true,
        processedCount: eligiblePersonnel.length
    };
};

// Helper function to safely evaluate expressions
function safeEval(expression, context) {
    // Implement safe evaluation - could use vm2 or a similar sandboxed approach
    // This is a simplified version - in production you should use a proper sandbox
    try {
        return Function('"use strict"; return (' + expression + ')').call(context);
    } catch (e) {
        throw new Error(`Failed to evaluate expression: ${expression}. Error: ${e.message}`);
    }
}

// Helper function to get eligible personnel (implementation depends on your business logic)
async function getEligiblePersonnel(instance) {
    // This would typically query your personnel collection with the appropriate filters
    // based on the bonus template's eligibility rules

    // Example implementation:
    const personnel = await mongoose.model('Personnel').aggregate([
        { $match: { status: 'active' } }, // Base eligibility
        { $lookup: { // Get current position
                from: 'affectations',
                let: { personnelId: '$_id' },
                pipeline: [
                    { $match: {
                            $expr: { $eq: ['$personnelId', '$$personnelId'] },
                            endDate: { $exists: false } // Current position only
                        }},
                    { $limit: 1 }
                ],
                as: 'position'
            }},
        { $unwind: { path: '$position', preserveNullAndEmptyArrays: true }},
        { $lookup: { // Get latest snapshot
                from: 'personnelsnapshots',
                let: { personnelId: '$_id' },
                pipeline: [
                    { $match: { $expr: { $eq: ['$personnelId', '$$personnelId'] } }},
                    { $sort: { snapshotDate: -1 } },
                    { $limit: 1 }
                ],
                as: 'snapshot'
            }},
        { $unwind: { path: '$snapshot', preserveNullAndEmptyArrays: true }},
        { $project: {
                _id: 1,
                identifier: 1,
                name: 1,
                grade: 1,
                category: 1,
                rank: 1,
                salary: '$snapshot.data.salary',
                position: '$position.positionId',
                snapshotId: '$snapshot._id',
                snapshotData: '$snapshot.data'
            }}
    ]);

    return personnel;
}