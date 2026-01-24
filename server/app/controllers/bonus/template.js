const Template = require('../../models/bonus/template').BonusTemplate;
const BonusRule = require('../../models/bonus/rule').BonusRule;
const { BonusInstance } = require('../../models/bonus/instance');
const { badRequest, notFound } = require('../../utils/ApiError');
const audit = require('../../utils/audit-log');
const dictionary = require('../../utils/dictionary');
const httpStatus = require('http-status');
const formidable = require('formidable');

// API
exports.api = {};

function t(req, msgid) {
    const language = (req && req.actor && req.actor.language) || (req && req.user && req.user.language) || '';
    return dictionary.translator(language).gettext(msgid);
}

function getActorId(req) {
    if (req && req.actor && req.actor.id) return req.actor.id;
    if (req && req.user && req.user.id) return req.user.id;
    if (req && req.user && req.user._id) return req.user._id;
    return '[anonymous]';
}

function auditEvent(req, action, label, object, status, description) {
    audit.logEvent(getActorId(req), 'bonus/template', action, label, object, status, description);
}


/**
 * Create bonus template
 */
exports.api.create = async (req, res, next) => {
    // If JSON, handle directly
    if ((req.is && req.is('application/json')) || (req.body && Object.keys(req.body).length > 0)) {
        try {
            const templateData = req.body || {};
            templateData.createdBy = req.actor?.id;
            normalizeIftConfigPayload(templateData.iftConfig);

            console.log("templateData = ", templateData);


            // Basic required fields
            if (!templateData.name) {
                throw badRequest(t(req, 'Missing required field: name'));
            }
            if (!templateData.category) {
                throw badRequest(t(req, 'Missing required field: category'));
            }
            if (!templateData.periodicity) {
                throw badRequest(t(req, 'Missing required field: periodicity'));
            }
            const cfg = templateData.calculationConfig || {};
            switch (templateData.category) {
                case 'with_parts':
                    if (cfg.defaultShareAmount === undefined || cfg.defaultShareAmount === null || isNaN(Number(cfg.defaultShareAmount))) {
                        throw badRequest(t(req, 'Default share amount is required for with-parts category'));
                    }
                    break;
                case 'without_parts': {
                    const subType = cfg.subType || 'remise';
                    if (subType === 'ift') {
                        if (!templateData.iftConfig || !Array.isArray(templateData.iftConfig.amountRules) || templateData.iftConfig.amountRules.length === 0) {
                            templateData.iftConfig = templateData.iftConfig || {};
                            templateData.iftConfig.amountRules = [
                                { match: { rankCode: 'NON_NOMME' }, amount: 60000 },
                                { match: { rankCode: 'CA' }, amount: 60000 },
                                { match: { rankCode: 'AG' }, amount: 60000 },
                                { match: { rankCode: 'CB' }, amount: 225000 },
                                { match: { rankCode: 'CS' }, amount: 270000 },
                                { match: { rankCode: 'SD' }, amount: 300000 },
                                { match: { rankCode: 'DIR' }, amount: 300000 }
                            ];
                        }
                        // For IFT forfaitaire, rely on amountRules; no rate required
                    } else {
                        if (cfg.rate === undefined || cfg.rate === null || isNaN(Number(cfg.rate))) {
                            throw badRequest(t(req, 'Rate (TX) is required for without-parts category'));
                        }
                    }
                    break;
                }
                case 'fixed_amount':
                    if (cfg.fixedAmount === undefined || cfg.fixedAmount === null || isNaN(Number(cfg.fixedAmount))) {
                        throw badRequest(t(req, 'Fixed amount is required for fixed amount category'));
                    }
                    break;
                case 'calculated':
                    if (!cfg.formulaType) throw badRequest(t(req, 'Formula type is required for calculated category'));
                    if (cfg.formulaType === 'custom_formula') {
                        if (!cfg.formula) throw badRequest(t(req, 'Formula is required for custom formula'));
                        if (!validateFormula(cfg.formula)) throw badRequest(t(req, 'Invalid formula syntax'));
                    } else if (cfg.formulaType === 'percentage') {
                        if (!cfg.baseField) throw badRequest(t(req, 'Base field is required for percentage formula'));
                        if (cfg.percentage === undefined || cfg.percentage === null || isNaN(Number(cfg.percentage))) {
                            throw badRequest(t(req, 'Percentage is required for percentage formula'));
                        }
                    } else if (cfg.formulaType === 'fixed') {
                        if (cfg.fixedAmount === undefined || cfg.fixedAmount === null || isNaN(Number(cfg.fixedAmount))) {
                            throw badRequest(t(req, 'Fixed amount is required for fixed formula'));
                        }
                    }
                    break;
            }
            if (templateData.calculationConfig?.formula) {
                if (!validateFormula(templateData.calculationConfig.formula)) {
                    throw badRequest(t(req, 'Invalid formula syntax'));
                }
            }
            const template = await Template.create(templateData);
            auditEvent(req, 'create', 'BonusTemplate', template._id, 'succeed', `Created bonus template. name=${templateData.name || ''}; code=${templateData.code || ''}`);
            return res.status(201).json(template);
        } catch (error) {
            auditEvent(req, 'create', 'BonusTemplate', '', 'failed', error && error.message ? error.message : String(error));
            return next(error);
        }
    }

    // Fallback: multipart/form-data
    const form = formidable({ multiples: false });
    form.parse(req, async (err, fields, files) => {
        if (err) {
            return next(badRequest(t(req, 'Form data parsing failed')));
        }
        try {
            const templateData = fields;
            templateData.createdBy = req.actor?.id;
            normalizeIftConfigPayload(templateData.iftConfig);

            // Normalize nested object if sent as JSON strings
            if (typeof templateData.calculationConfig === 'string') {
                try { templateData.calculationConfig = JSON.parse(templateData.calculationConfig); } catch (e) { }
            }
            const cfg = templateData.calculationConfig || {};

            // Basic required fields
            if (!templateData.name) throw badRequest(t(req, 'Missing required field: name'));
            if (!templateData.category) throw badRequest(t(req, 'Missing required field: category'));
            if (!templateData.periodicity) throw badRequest(t(req, 'Missing required field: periodicity'));

            // Category-specific validation
            switch (templateData.category) {
                case 'with_parts':
                    if (cfg.defaultShareAmount === undefined || cfg.defaultShareAmount === null || isNaN(Number(cfg.defaultShareAmount))) {
                        throw badRequest(t(req, 'Default share amount is required for with-parts category'));
                    }
                    break;
                case 'without_parts': {
                    const subType = cfg.subType || 'remise';
                    if (subType === 'ift') {
                        // For IFT forfaitaire, rely on amountRules; no rate required
                    } else {
                        if (cfg.rate === undefined || cfg.rate === null || isNaN(Number(cfg.rate))) {
                            throw badRequest(t(req, 'Rate (TX) is required for without-parts category'));
                        }
                    }
                    break;
                }
                case 'fixed_amount':
                    if (cfg.fixedAmount === undefined || cfg.fixedAmount === null || isNaN(Number(cfg.fixedAmount))) {
                        throw badRequest(t(req, 'Fixed amount is required for fixed amount category'));
                    }
                    break;
                case 'calculated':
                    if (!cfg.formulaType) throw badRequest(t(req, 'Formula type is required for calculated category'));
                    if (cfg.formulaType === 'custom_formula') {
                        if (!cfg.formula) throw badRequest(t(req, 'Formula is required for custom formula'));
                        if (!validateFormula(cfg.formula)) throw badRequest(t(req, 'Invalid formula syntax'));
                    } else if (cfg.formulaType === 'percentage') {
                        if (!cfg.baseField) throw badRequest(t(req, 'Base field is required for percentage formula'));
                        if (cfg.percentage === undefined || cfg.percentage === null || isNaN(Number(cfg.percentage))) {
                            throw badRequest(t(req, 'Percentage is required for percentage formula'));
                        }
                    } else if (cfg.formulaType === 'fixed') {
                        if (cfg.fixedAmount === undefined || cfg.fixedAmount === null || isNaN(Number(cfg.fixedAmount))) {
                            throw badRequest(t(req, 'Fixed amount is required for fixed formula'));
                        }
                    }
                    break;
            }
            if (templateData.calculationConfig?.formula) {
                if (!validateFormula(templateData.calculationConfig.formula)) {
                    throw badRequest(t(req, 'Invalid formula syntax'));
                }
            }
            const template = await Template.create(templateData);
            auditEvent(req, 'create', 'BonusTemplate', template._id, 'succeed', `Created bonus template (multipart). name=${templateData.name || ''}; code=${templateData.code || ''}`);
            res.status(201).json(template);
        } catch (error) {
            auditEvent(req, 'create', 'BonusTemplate', '', 'failed', error && error.message ? error.message : String(error));
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

        // By default, exclude deleted templates
        filter.isDeleted = { $ne: true };

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
            throw notFound(t(req, 'Bonus template not found'));
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
    if ((req.is && req.is('application/json')) || (req.body && Object.keys(req.body).length > 0)) {
        try {
            const { id } = req.params;

            // Check if template is historical (imported from Excel) - cannot be edited
            const existingTemplate = await Template.findById(id);
            if (!existingTemplate) throw notFound(t(req, 'Bonus template not found'));
            if (existingTemplate.isHistoricalTemplate) {
                throw badRequest(t(req, 'Historical templates imported from Excel cannot be edited'));
            }

            const updateData = req.body || {};
            updateData.updatedAt = new Date();
            normalizeIftConfigPayload(updateData.iftConfig);
            if (updateData.code) delete updateData.code; // prevent code change
            if (updateData.calculationConfig?.formula) {
                if (!validateFormula(updateData.calculationConfig.formula)) {
                    throw badRequest(t(req, 'Invalid formula syntax'));
                }
            }
            const template = await Template.findByIdAndUpdate(id, updateData, { new: true, runValidators: true });
            if (!template) throw notFound(t(req, 'Bonus template not found'));
            auditEvent(req, 'update', 'BonusTemplate', id, 'succeed', `Updated bonus template. code=${template.code || ''}`);
            return res.json(template);
        } catch (error) {
            auditEvent(req, 'update', 'BonusTemplate', req.params.id, 'failed', error && error.message ? error.message : String(error));
            return next(error);
        }
    }

    // Fallback: multipart/form-data
    const form = formidable({ multiples: false });
    form.parse(req, async (err, fields, files) => {
        if (err) {
            return next(badRequest(t(req, 'Form data parsing failed')));
        }
        try {
            const { id } = req.params;

            // Check if template is historical (imported from Excel) - cannot be edited
            const existingTemplate = await Template.findById(id);
            if (!existingTemplate) throw notFound(t(req, 'Bonus template not found'));
            if (existingTemplate.isHistoricalTemplate) {
                throw badRequest(t(req, 'Historical templates imported from Excel cannot be edited'));
            }

            const updateData = fields;
            updateData.updatedAt = new Date();
            normalizeIftConfigPayload(updateData.iftConfig);
            if (updateData.code) delete updateData.code;
            if (updateData.calculationConfig?.formula) {
                if (!validateFormula(updateData.calculationConfig.formula)) {
                    throw badRequest(t(req, 'Invalid formula syntax'));
                }
            }
            const template = await Template.findByIdAndUpdate(id, updateData, { new: true, runValidators: true });
            if (!template) throw notFound(t(req, 'Bonus template not found'));
            auditEvent(req, 'update', 'BonusTemplate', id, 'succeed', `Updated bonus template (multipart). code=${template.code || ''}`);
            res.json(template);
        } catch (error) {
            auditEvent(req, 'update', 'BonusTemplate', req.params.id, 'failed', error && error.message ? error.message : String(error));
            next(error);
        }
    });
}

/**
 * Delete bonus template
 * Hard delete if no instances exist, soft delete otherwise
 */
exports.api.delete = async (req, res, next) => {
    try {
        // Check if template exists
        const existingTemplate = await Template.findById(req.params.id);
        if (!existingTemplate) {
            throw notFound(t(req, 'Bonus template not found'));
        }
        if (existingTemplate.isHistoricalTemplate) {
            throw badRequest(t(req, 'Historical templates imported from Excel cannot be deleted'));
        }
        if (existingTemplate.isDeleted) {
            throw badRequest(t(req, 'Template is already deleted'));
        }

        // Check if template has any instances (payment cycles)
        const instanceCount = await BonusInstance.countDocuments({ templateId: req.params.id });

        if (instanceCount === 0) {
            // No instances - hard delete (permanently remove)
            await Template.findByIdAndDelete(req.params.id);
            auditEvent(req, 'delete', 'BonusTemplate', req.params.id, 'succeed', 'Permanently deleted bonus template (no instances)');
            res.status(200).json({ success: true, message: 'Template permanently deleted', permanent: true });
        } else {
            // Has instances - soft delete
            const template = await Template.findByIdAndUpdate(
                req.params.id,
                {
                    isDeleted: true,
                    deletedAt: new Date(),
                    deletedBy: req.user?.id || req.actor?.id,
                    isActive: false
                },
                { new: true }
            );

            auditEvent(req, 'delete', 'BonusTemplate', req.params.id, 'succeed', `Soft deleted bonus template (${instanceCount} instances exist)`);
            res.status(200).json({ success: true, message: 'Template deleted (archived)', permanent: false, instanceCount });
        }
    } catch (error) {
        auditEvent(req, 'delete', 'BonusTemplate', req.params.id, 'failed', error && error.message ? error.message : String(error));
        next(error);
    }
}

/**
 * Activate bonus template
 */
exports.api.activate = async (req, res, next) => {
    try {
        // Check if template is historical (imported from Excel) - cannot toggle status
        const existingTemplate = await Template.findById(req.params.id);
        if (!existingTemplate) {
            throw notFound(t(req, 'Bonus template not found'));
        }
        if (existingTemplate.isHistoricalTemplate) {
            throw badRequest(t(req, 'Historical templates imported from Excel cannot have their status changed'));
        }

        const template = await Template.findByIdAndUpdate(
            req.params.id,
            { isActive: true, activatedAt: new Date(), activatedBy: req.user.id },
            { new: true }
        );

        if (!template) {
            throw notFound(t(req, 'Bonus template not found'));
        }

        auditEvent(req, 'activate', 'BonusTemplate', req.params.id, 'succeed', 'Activated bonus template');
        res.json(template);
    } catch (error) {
        auditEvent(req, 'activate', 'BonusTemplate', req.params.id, 'failed', error && error.message ? error.message : String(error));
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
            throw notFound(t(req, 'Bonus template not found'));
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
        auditEvent(req, 'clone', 'BonusTemplate', newTemplate._id, 'succeed', `Cloned bonus template from ${req.params.id}`);
        res.status(httpStatus.CREATED).json(newTemplate);
    } catch (error) {
        auditEvent(req, 'clone', 'BonusTemplate', req.params.id, 'failed', error && error.message ? error.message : String(error));
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
            throw notFound(t(req, 'Bonus template not found'));
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

        auditEvent(req, 'bulk_activate', 'BonusTemplate', ids && ids.length ? ids.join(',') : '', 'succeed', `Bulk activated templates. count=${ids ? ids.length : 0}`);
        res.json({ updatedCount: result.nModified });
    } catch (error) {
        auditEvent(req, 'bulk_activate', 'BonusTemplate', '', 'failed', error && error.message ? error.message : String(error));
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

        auditEvent(req, 'export', 'BonusTemplate', '', 'succeed', `Exported bonus templates. count=${templates.length}`);
        res.attachment('bonus_templates.csv').send(csv);
    } catch (error) {
        auditEvent(req, 'export', 'BonusTemplate', '', 'failed', error && error.message ? error.message : String(error));
        next(error);
    }
};


// Helper functions
function normalizeIftConfigPayload(iftConfig) {
    if (!iftConfig || typeof iftConfig !== 'object') return;
    if (Array.isArray(iftConfig.includedStructureIds)) {
        iftConfig.includedStructureIds = Array.from(new Set(iftConfig.includedStructureIds.filter(Boolean)));
    }
    if (Array.isArray(iftConfig.includePersonnelIds)) {
        iftConfig.includePersonnelIds = Array.from(new Set(iftConfig.includePersonnelIds.filter(Boolean)));
    }
    if (Array.isArray(iftConfig.excludePersonnelIds)) {
        iftConfig.excludePersonnelIds = Array.from(new Set(iftConfig.excludePersonnelIds.filter(Boolean)));
    }
}

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
