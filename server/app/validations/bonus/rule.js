const Joi = require('joi');

const createBonusRule = {
    body: Joi.object().keys({
        name: Joi.string().required().max(100),
        description: Joi.string().allow('').max(500),
        condition: Joi.string().required(),
        action: Joi.string().required(),
        priority: Joi.number().integer().min(1).max(100).default(1),
        appliesToTemplates: Joi.array().items(Joi.string())
    })
};

const updateBonusRule = {
    params: Joi.object().keys({
        id: Joi.string().required()
    }),
    body: Joi.object().keys({
        name: Joi.string().max(100),
        description: Joi.string().allow('').max(500),
        condition: Joi.string(),
        action: Joi.string(),
        priority: Joi.number().integer().min(1).max(100),
        appliesToTemplates: Joi.array().items(Joi.string())
    })
};

const validateBonusRule = {
    body: Joi.object().keys({
        condition: Joi.string().required(),
        action: Joi.string().required()
    })
};

const testBonusRule = {
    body: Joi.object().keys({
        condition: Joi.string().required(),
        action: Joi.string().required(),
        testData: Joi.object().required()
    })
};

const getBonusRules = {
    query: Joi.object().keys({
        activeOnly: Joi.string().valid('true', 'false'),
        templateId: Joi.string(),
        limit: Joi.number().integer().min(1).max(1000).default(100),
        sortBy: Joi.string().default('priority:asc')
    })
};

module.exports = {
    createBonusRule,
    updateBonusRule,
    validateBonusRule,
    testBonusRule,
    getBonusRules
};

