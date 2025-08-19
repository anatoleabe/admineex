const Joi = require('joi');

const getAllBonusAllocations = {
    query: Joi.object().keys({
        instanceId: Joi.string(),
        personnelId: Joi.string(),
        status: Joi.string().valid('eligible', 'excluded', 'adjusted', 'paid', 'cancelled', 'approved', 'all'),
        fromDate: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/),
        toDate: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/),
        limit: Joi.number().integer().min(1).max(5000).default(100),
        sortBy: Joi.string().default('createdAt:desc')
    })
};

const adjustBonusAllocation = {
    params: Joi.object().keys({
        id: Joi.string().required()
    }),
    body: Joi.object().keys({
        amount: Joi.number().min(0),
        parts: Joi.number().integer().min(1),
        reason: Joi.string().required()
    })
};

const excludeBonusAllocation = {
    params: Joi.object().keys({
        id: Joi.string().required()
    }),
    body: Joi.object().keys({
        reason: Joi.string().required()
    })
};

const includeBonusAllocation = {
    params: Joi.object().keys({
        id: Joi.string().required()
    })
};

module.exports = {
    getAllBonusAllocations,
    adjustBonusAllocation,
    excludeBonusAllocation,
    includeBonusAllocation
};