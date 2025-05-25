const Joi = require('joi');

const createBonusInstance = {
    body: Joi.object().keys({
        templateId: Joi.string().required(),
        referencePeriod: Joi.string().required().pattern(/^\d{4}-[QqSsTt]\d$/),
        notes: Joi.string().allow('')
    })
};

const updateBonusInstance = {
    params: Joi.object().keys({
        id: Joi.string().required()
    }),
    body: Joi.object().keys({
        notes: Joi.string().allow(''),
        customOverrides: Joi.object()
    })
};

const approveBonusInstance = {
    params: Joi.object().keys({
        id: Joi.string().required()
    })
};

const rejectBonusInstance = {
    params: Joi.object().keys({
        id: Joi.string().required()
    }),
    body: Joi.object().keys({
        reason: Joi.string().allow('')
    })
};

const cancelBonusInstance = {
    params: Joi.object().keys({
        id: Joi.string().required()
    }),
    body: Joi.object().keys({
        reason: Joi.string().allow('')
    })
};

const getBonusInstances = {
    query: Joi.object().keys({
        status: Joi.string().valid('draft', 'pending_generation', 'generated', 'under_review', 'approved', 'paid', 'cancelled'),
        templateId: Joi.string(),
        fromDate: Joi.date(),
        toDate: Joi.date(),
        limit: Joi.number().integer().min(1).max(1000).default(50),
        sortBy: Joi.string().default('createdAt:desc')
    })
};

module.exports = {
    createBonusInstance,
    updateBonusInstance,
    approveBonusInstance,
    rejectBonusInstance,
    cancelBonusInstance,
    getBonusInstances
};