const { celebrate, Joi, Segments } = require('celebrate');
const { errorTypes } = require('../utils/ApiError');

/**
 * Validation middleware using Celebrate
 * @param {Object} schema - Joi validation schema
 */
const validate = (schema) => {
    return celebrate(schema, {
        abortEarly: false, // Return all errors
        allowUnknown: false, // Disallow unknown keys
        stripUnknown: false // Don't remove unknown keys
    });
};

/**
 * Error handler for validation errors
 */
const validationErrorHandler = (err, req, res, next) => {
    if (err.isJoi) {
        const errors = err.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message.replace(/['"]/g, '')
        }));

        return res.status(400).json({
            success: false,
            error: {
                code: 400,
                message: 'Validation Error',
                details: errors
            }
        });
    }
    next(err);
};

module.exports = {
    validate,
    validationErrorHandler
};