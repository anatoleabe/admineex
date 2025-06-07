const { Joi } = require('celebrate');
const { ObjectId } = require('mongoose').Types;

const isValidObjectId = (value, helpers) => {
    if (!ObjectId.isValid(value)) {
        return helpers.error('any.invalid');
    }
    return value;
};

const schemas = {
    createBonusInstance: {
        body: Joi.object({
            templateId: Joi.string().custom(isValidObjectId).required(),
            referencePeriod: Joi.string().required(),
            notes: Joi.string().allow('', null),
            shareAmount: Joi.number().positive().allow(null)
        })
    },

    getBonusInstances: {
        query: Joi.object({
            status: Joi.string().valid('draft', 'pending_generation', 'generated', 'under_review', 'approved', 'paid', 'cancelled').allow(''),
            templateId: Joi.string().custom(isValidObjectId).allow(''),
            fromDate: Joi.date().iso().allow(''),
            toDate: Joi.date().iso().min(Joi.ref('fromDate')).allow(''),
            limit: Joi.number().integer().min(1).max(100).default(10),
            offset: Joi.number().integer().min(0).default(0),
            sortBy: Joi.string().pattern(/^[a-zA-Z]+:(asc|desc)$/).default('createdAt:desc')
        })
    },

    getBonusInstanceById: {
        params: Joi.object({
            id: Joi.string().custom(isValidObjectId).required()
        })
    },

    updateBonusInstance: {
        params: Joi.object({
            id: Joi.string().custom(isValidObjectId).required()
        }),
        body: Joi.object({
            notes: Joi.string().allow('', null),
            customOverrides: Joi.object().allow(null)
        })
    },

    approveBonusInstance: {
        params: Joi.object({
            id: Joi.string().custom(isValidObjectId).required()
        })
    },

    rejectBonusInstance: {
        params: Joi.object({
            id: Joi.string().custom(isValidObjectId).required()
        }),
        body: Joi.object({
            reason: Joi.string().required()
        })
    },

    generateBonusPayments: {
        params: Joi.object({
            id: Joi.string().custom(isValidObjectId).required()
        })
    },

    exportBonusInstance: {
        params: Joi.object({
            id: Joi.string().custom(isValidObjectId).required()
        })
    },

    notifyBonusInstance: {
        params: Joi.object({
            id: Joi.string().custom(isValidObjectId).required()
        })
    }
};

module.exports = schemas;
