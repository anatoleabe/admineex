const Template = require('../../models/bonus/template').BonusTemplate;
const BonusRule = require('../../models/bonus/rule').BonusRule;
const { badRequest, notFound } = require('../../utils/ApiError');
const httpStatus = require('http-status');
const formidable = require('formidable');

// API
exports.api = {};


/**
 * Create bonus template
 */
exports.api.create = async (req, res, next) => {
    // If JSON, handle directly
    if (req.is && req.is('application/json')) {
        try {
            const templateData = req.body || {};
            templateData.createdBy = req.actor?.id;

            console.log("templateData = ", templateData);


            // Basic required fields
            if (!templateData.name) {
                throw badRequest('Missing required field: name');
            }
            if (!templateData.category) {
                throw badRequest('Missing required field: category');
            }
            if (!templateData.periodicity) {
                throw badRequest('Missing required field: periodicity');
            }
            const cfg = templateData.calculationConfig || {};
            switch (templateData.category) {
                case 'with_parts':
                    if (cfg.defaultShareAmount === undefined || cfg.defaultShareAmount === null || isNaN(Number(cfg.defaultShareAmount))) {
                        throw badRequest('Default share amount is required for with-parts category');
                    }
                    break;
                case 'without_parts':
                    if (cfg.rate === undefined || cfg.rate === null || isNaN(Number(cfg.rate))) {
                        throw badRequest('Rate (TX) is required for without-parts category');
                    }
                    break;
                case 'fixed_amount':
                    if (cfg.fixedAmount === undefined || cfg.fixedAmount === null || isNaN(Number(cfg.fixedAmount))) {
                        throw badRequest('Fixed amount is required for fixed amount category');
                    }
                    break;
                case 'calculated':
                    if (!cfg.formulaType) throw badRequest('Formula type is required for calculated category');
                    if (cfg.formulaType === 'custom_formula') {
                        if (!cfg.formula) throw badRequest('Formula is required for custom formula');
                        if (!validateFormula(cfg.formula)) throw badRequest('Invalid formula syntax');
                    } else if (cfg.formulaType === 'percentage') {
                        if (!cfg.baseField) throw badRequest('Base field is required for percentage formula');
                        if (cfg.percentage === undefined || cfg.percentage === null || isNaN(Number(cfg.percentage))) {
                            throw badRequest('Percentage is required for percentage formula');
                        }
                    } else if (cfg.formulaType === 'fixed') {
                        if (cfg.fixedAmount === undefined || cfg.fixedAmount === null || isNaN(Number(cfg.fixedAmount))) {
                            throw badRequest('Fixed amount is required for fixed formula');
                        }
                    }
                    break;
            }
            if (templateData.calculationConfig?.formula) {
                if (!validateFormula(templateData.calculationConfig.formula)) {
                    throw badRequest('Invalid formula syntax');
                }
            }
            const template = await Template.create(templateData);
            return res.status(201).json(template);
        } catch (error) {
            return next(error);
        }
    }

    // Fallback: multipart/form-data
    const form = formidable({ multiples: false });
    form.parse(req, async (err, fields, files) => {
        if (err) {
            return next(badRequest('Form data parsing failed'));
        }
        try {
            const templateData = fields;
            templateData.createdBy = req.actor?.id;

            // Normalize nested object if sent as JSON strings
            if (typeof templateData.calculationConfig === 'string') {
                try { templateData.calculationConfig = JSON.parse(templateData.calculationConfig); } catch(e) {}
            }
            const cfg = templateData.calculationConfig || {};

            // Basic required fields
            if (!templateData.name) throw badRequest('Missing required field: name');
            if (!templateData.category) throw badRequest('Missing required field: category');
            if (!templateData.periodicity) throw badRequest('Missing required field: periodicity');

            // Category-specific validation
            switch (templateData.category) {
                case 'with_parts':
                    if (cfg.defaultShareAmount === undefined || cfg.defaultShareAmount === null || isNaN(Number(cfg.defaultShareAmount))) {
                        throw badRequest('Default share amount is required for with-parts category');
                    }
                    break;
                case 'without_parts':
                    if (cfg.rate === undefined || cfg.rate === null || isNaN(Number(cfg.rate))) {
                        throw badRequest('Rate (TX) is required for without-parts category');
                    }
                    break;
                case 'fixed_amount':
                    if (cfg.fixedAmount === undefined || cfg.fixedAmount === null || isNaN(Number(cfg.fixedAmount))) {
                        throw badRequest('Fixed amount is required for fixed amount category');
                    }
                    break;
                case 'calculated':
                    if (!cfg.formulaType) throw badRequest('Formula type is required for calculated category');
                    if (cfg.formulaType === 'custom_formula') {
                        if (!cfg.formula) throw badRequest('Formula is required for custom formula');
                        if (!validateFormula(cfg.formula)) throw badRequest('Invalid formula syntax');
                    } else if (cfg.formulaType === 'percentage') {
                        if (!cfg.baseField) throw badRequest('Base field is required for percentage formula');
                        if (cfg.percentage === undefined || cfg.percentage === null || isNaN(Number(cfg.percentage))) {
                            throw badRequest('Percentage is required for percentage formula');
                        }
                    } else if (cfg.formulaType === 'fixed') {
                        if (cfg.fixedAmount === undefined || cfg.fixedAmount === null || isNaN(Number(cfg.fixedAmount))) {
                            throw badRequest('Fixed amount is required for fixed formula');
                        }
                    }
                    break;
            }
            if (templateData.calculationConfig?.formula) {
                if (!validateFormula(templateData.calculationConfig.formula)) {
                    throw badRequest('Invalid formula syntax');
                }
            }
            const template = await Template.create(templateData);
            res.status(201).json(template);
        } catch (error) {
            next(error);
        }
    });
};


/**
 * Get all bonus templates with pagination
 */
exports.api.getAll = async (req, res, next) => {
    try {
        const { activeOnly, category, limit = 10, offset = 0 } = req.query;
        const filter = {};

        if (activeOnly === 'true') filter.isActive = true;
        if (category) filter.category = category;

        const templates = await Template.find(filter)
            .populate('createdBy', 'firstname lastname')
            .sort({ createdAt: -1 })
            .skip(Number(offset))
            .limit(Number(limit));

        res.json(templates);
    } catch (error) {
        next(error);
    }
};

/**
 * Get bonus template by ID
 */
exports.api.getById = async (req, res, next) => {
    try {
        const template = await Template.findById(req.params.id)
            .populate('createdBy', 'firstname lastname')
            .populate('approvalWorkflow.steps.role');

        if (!template) {
            throw notFound('Bonus template not found');
        }

        res.json(template);
    } catch (error) {
        next(error);
    }
}

/**
 * Update bonus template
 */
exports.api.update = async (req, res, next) => {
    // If JSON, handle directly
    if (req.is && req.is('application/json')) {
        try {
            const { id } = req.params;
            const updateData = req.body || {};
            updateData.updatedAt = new Date();
            if (updateData.code) delete updateData.code; // prevent code change
            if (updateData.calculationConfig?.formula) {
                if (!validateFormula(updateData.calculationConfig.formula)) {
                    throw badRequest('Invalid formula syntax');
                }
            }
            const template = await Template.findByIdAndUpdate(id, updateData, { new: true, runValidators: true });
            if (!template) throw notFound('Bonus template not found');
            return res.json(template);
        } catch (error) {
            return next(error);
        }
    }

    // Fallback: multipart/form-data
    const form = formidable({ multiples: false });
    form.parse(req, async (err, fields, files) => {
        if (err) {
            return next(badRequest('Form data parsing failed'));
        }
        try {
            const { id } = req.params;
            const updateData = fields;
            updateData.updatedAt = new Date();
            if (updateData.code) delete updateData.code;
            if (updateData.calculationConfig?.formula) {
                if (!validateFormula(updateData.calculationConfig.formula)) {
                    throw badRequest('Invalid formula syntax');
                }
            }
            const template = await Template.findByIdAndUpdate(id, updateData, { new: true, runValidators: true });
            if (!template) throw notFound('Bonus template not found');
            res.json(template);
        } catch (error) {
            next(error);
        }
    });
}

/**
 * Delete bonus template (soft delete)
 */
exports.api.delete = async (req, res, next) => {
    try {
        const template = await Template.findByIdAndUpdate(
            req.params.id,
            { isActive: false, deactivatedAt: new Date(), deactivatedBy: req.user.id },
            { new: true }
        );

        if (!template) {
            throw notFound('Bonus template not found');
        }

        res.status(httpStatus.NO_CONTENT).send();
    } catch (error) {
        next(error);
    }
}

/**
 * Activate bonus template
 */
exports.api.activate = async (req, res, next) => {
    try {
        const template = await Template.findByIdAndUpdate(
            req.params.id,
            { isActive: true, activatedAt: new Date(), activatedBy: req.user.id },
            { new: true }
        );

        if (!template) {
            throw notFound('Bonus template not found');
        }

        res.json(template);
    } catch (error) {
        next(error);
    }
}

/**
 * Clone bonus template
 */
exports.api.clone = async (req, res, next) => {
    try {
        const original = await Template.findById(req.params.id);
        if (!original) {
            throw ApiError.notFound('Bonus template not found');
        }

        const cloneData = original.toObject();
        delete cloneData._id;
        cloneData.code = `${cloneData.code}_COPY_${Date.now()}`;
        cloneData.name = `${cloneData.name} (Copy)`;
        cloneData.isActive = false;
        cloneData.createdBy = req.user.id;
        cloneData.createdAt = new Date();
        cloneData.updatedAt = new Date();

        const newTemplate = await Template.create(cloneData);
        res.status(httpStatus.CREATED).json(newTemplate);
    } catch (error) {
        next(error);
    }
}

/**
 * Validate bonus template configuration
 */
exports.api.validate = async (req, res, next) => {
    try {
        const templateData = req.body;
        const errors = [];

        // Validate formula syntax
        if (templateData.calculationConfig?.formula) {
            if (!validateFormula(templateData.calculationConfig.formula)) {
                errors.push('Invalid formula syntax');
            }
        }

        // Validate eligibility rules
        if (templateData.eligibilityRules) {
            const ruleErrors = validateEligibilityRules(templateData.eligibilityRules);
            errors.push(...ruleErrors);
        }

        // Validate parts configuration
        if (templateData.calculationConfig?.partsConfig) {
            const partsErrors = validatePartsConfig(templateData.calculationConfig.partsConfig);
            errors.push(...partsErrors);
        }

        if (errors.length > 0) {
            res.status(httpStatus.BAD_REQUEST).json({ valid: false, errors });
        } else {
            res.json({ valid: true });
        }
    } catch (error) {
        next(error);
    }
}

/**
 * Test bonus template calculation
 */
exports.api.testCalculation = async (req, res, next) => {
    try {
        const { templateId } = req.params;
        const { personnelData } = req.body;

        const template = await Template.findById(templateId);
        if (!template) {
            throw notFound('Bonus template not found');
        }

        const result = calculateTestBonus(template, personnelData);
        res.json(result);
    } catch (error) {
        next(error);
    }
}

/**
 * Get bonus template usage statistics
 */
exports.api.getUsageStats = async (req, res, next) => {
    try {
        const { id } = req.params;

        const stats = await BonusInstance.aggregate([
            { $match: { templateId: mongoose.Types.ObjectId(id) } },
            {
                $group: {
                    _id: null,
                    totalInstances: { $sum: 1 },
                    lastUsed: { $max: "$createdAt" },
                    totalAmount: { $sum: "$totalAmount" },
                    statuses: {
                        $push: "$status"
                    }
                }
            },
            {
                $project: {
                    _id: 0,
                    totalInstances: 1,
                    lastUsed: 1,
                    totalAmount: 1,
                    statusDistribution: {
                        $arrayToObject: {
                            $reduce: {
                                input: "$statuses",
                                initialValue: [],
                                in: {
                                    $concatArrays: [
                                        "$$value",
                                        [
                                            {
                                                k: "$$this",
                                                v: {
                                                    $sum: [
                                                        {
                                                            $cond: [
                                                                { $eq: ["$$value.v", "$$this"] },
                                                                1,
                                                                0
                                                            ]
                                                        },
                                                        1
                                                    ]
                                                }
                                            }
                                        ]
                                    ]
                                }
                            }
                        }
                    }
                }
            }
        ]);

        res.json(stats[0] || {});
    } catch (error) {
        next(error);
    }
}

/**
 * Search bonus templates
 */
exports.api.search = async (req, res, next) => {
    try {
        const { query, limit = 10, offset = 0 } = req.query;

        const templates = await Template.find({
            $or: [
                { name: { $regex: query, $options: 'i' } },
                { code: { $regex: query, $options: 'i' } }
            ]
        })
            .sort({ createdAt: -1 })
            .skip(Number(offset))
            .limit(Number(limit));

        res.json(templates);
    } catch (error) {
        next(error);
    }
};

/**
 * Bulk activate bonus templates
 */
exports.api.bulkActivate = async (req, res, next) => {
    try {
        const { ids } = req.body;

        const result = await Template.updateMany(
            { _id: { $in: ids } },
            { isActive: true, activatedAt: new Date(), activatedBy: req.user.id }
        );

        res.json({ updatedCount: result.nModified });
    } catch (error) {
        next(error);
    }
};

/**
 * Export bonus templates
 */
exports.api.export = async (req, res, next) => {
    try {
        const templates = await Template.find().lean();

        // Convert to CSV or JSON
        const csv = templates.map(template => ({
            name: template.name,
            code: template.code,
            amount: template.amount,
            currency: template.currency,
            isActive: template.isActive
        }));

        res.attachment('bonus_templates.csv').send(csv);
    } catch (error) {
        next(error);
    }
};


// Helper functions
function validateFormula(formula) {
    // Implement actual formula validation logic
    try {
        // Simple check - in production use a proper parser/sandbox
        if (typeof formula !== 'string') return false;
        if (formula.includes(';')) return false; // Prevent code injection
        return true;
    } catch (e) {
        return false;
    }
}

function validateEligibilityRules(rules) {
    const errors = [];
    // Implement rule validation logic
    return errors;
}

function validatePartsConfig(partsConfig) {
    const errors = [];
    // Implement parts config validation
    return errors;
}

function calculateTestBonus(template, personnelData) {
    // Implement test calculation logic
    return {
        personnelData,
        templateId: template._id,
        calculatedAmount: 0,
        calculationSteps: []
    };
}
