const { celebrate, Joi, Segments } = require('celebrate');
const { errorTypes } = require('../utils/ApiError');

/**
 * Validation middleware using Celebrate
 * @param {Object} schema - Joi validation schema
 */
const validate = (schema) => (req, res, next) => {
    if (!schema) return next();

    const validations = {};

    // Add schema validations for each request part
    if (schema.query) {
        validations[Segments.QUERY] = schema.query;
    }
    if (schema.params) {
        validations[Segments.PARAMS] = schema.params;
    }
    if (schema.body) {
        validations[Segments.BODY] = schema.body;
    }
    if (schema.headers) {
        validations[Segments.HEADERS] = schema.headers;
    }

    // If no validations, skip middleware
    if (Object.keys(validations).length === 0) return next();

    // Use celebrate with our schema
    return celebrate(validations, {
        abortEarly: false,
        allowUnknown: true,
        stripUnknown: true
    })(req, res, next);
};

/**
 * Error handler for validation errors
 */
const validationErrorHandler = (err, req, res, next) => {
    if (err.isJoi) {
        const errors = err.details.map(detail => ({
            path: detail.path.join('.'),
            message: detail.message,
            type: detail.type
        }));

        return res.status(400).json({
            type: errorTypes.VALIDATION_ERROR,
            message: 'Validation failed',
            errors
        });
    }

    next(err);
};

module.exports = validate;
module.exports.validationErrorHandler = validationErrorHandler;


