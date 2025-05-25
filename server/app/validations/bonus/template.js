const Joi = require('joi');

const createBonusTemplate = {
    body: Joi.object().keys({
        code: Joi.string().required().pattern(/^[A-Z0-9_]+$/),
        name: Joi.string().required(),
        description: Joi.string().allow(''),
        category: Joi.string().valid('with_parts', 'without_parts', 'fixed_amount', 'calculated').required(),
        periodicity: Joi.string().valid('daily', 'weekly', 'monthly', 'quarterly', 'semesterly', 'yearly', 'on_demand').required(),
        eligibilityRules: Joi.array().items(
            Joi.object({
                field: Joi.string().required(),
                operator: Joi.string().valid('equals', 'not_equals', 'contains', 'greater_than', 'less_than', 'in', 'not_in').required(),
                value: Joi.any().required()
            })
        ),
        calculationConfig: Joi.object({
            formulaType: Joi.string().valid('fixed', 'percentage', 'custom_formula', 'parts_based').required(),
            baseField: Joi.string().when('formulaType', {
                is: Joi.valid('percentage', 'custom_formula', 'parts_based'),
                then: Joi.string().required()
            }),
            formula: Joi.string().when('formulaType', {
                is: Joi.valid('custom_formula', 'parts_based'),
                then: Joi.string().required()
            }),
            partsConfig: Joi.object({
                defaultParts: Joi.number().integer().min(1),
                partRules: Joi.array().items(
                    Joi.object({
                        condition: Joi.string().required(),
                        parts: Joi.number().integer().min(1).required()
                    })
                )
            }).when('formulaType', {
                is: 'parts_based',
                then: Joi.object({
                    defaultParts: Joi.number().integer().min(1).required(),
                    partRules: Joi.array().items(
                        Joi.object({
                            condition: Joi.string().required(),
                            parts: Joi.number().integer().min(1).required()
                        })
                    )
                })
            })
        }).required(),
        approvalWorkflow: Joi.object({
            steps: Joi.array().items(
                Joi.object({
                    role: Joi.string().required(),
                    approvalType: Joi.string().valid('sequential', 'parallel').default('sequential')
                })
            ).min(1)
        }),
        documentation: Joi.string().allow(''),
        isActive: Joi.boolean().default(true)
    })
};

const getBonusTemplate = {
    params: Joi.object().keys({
        id: Joi.string().required()
    })
};

// Similar validation schemas for other operations...
// updateBonusTemplate, deleteBonusTemplate, activateBonusTemplate, etc.

module.exports = {
    createBonusTemplate,
    getBonusTemplate,
    // Export all other validation schemas...
};