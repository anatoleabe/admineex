// validation/bonusGeneration.js
const Joi = require('joi');

module.exports = {
    generatePeriodic: {
        body: Joi.object({
            period: Joi.string().valid('daily', 'weekly', 'monthly', 'quarterly', 'yearly').optional()
        })
    },
    generateTemplate: {
        body: Joi.object({
            templateId: Joi.string().hex().length(24).required(),
            referencePeriod: Joi.string().pattern(/^\d{4}(-[Qq][1-4]|-\d{2})?$/).optional()
                .description('Format: YYYY, YYYY-Q1, or YYYY-MM')
        })
    }
};
