// utils/ApiError.js

/**
 * @extends Error
 */
class ApiError extends Error {
    /**
     * Creates an API error
     * @param {string} message - Error message
     * @param {number} status - HTTP status code
     * @param {boolean} isOperational - Is this a known operational error (vs programmer error)
     * @param {string} stack - Error stack trace
     */
    constructor(message, status, isOperational = true, stack = '') {
        super(message);
        this.name = this.constructor.name;
        this.message = message;
        this.status = status;
        this.isOperational = isOperational;

        if (stack) {
            this.stack = stack;
        } else {
            Error.captureStackTrace(this, this.constructor);
        }
    }
}

/**
 * Standard API error types with predefined status codes
 */
const errorTypes = {
    badRequest: (message = 'Bad Request') =>
        new ApiError(message, 400),
    unauthorized: (message = 'Unauthorized') =>
        new ApiError(message, 401),
    paymentRequired: (message = 'Payment Required') =>
        new ApiError(message, 402),
    forbidden: (message = 'Forbidden') =>
        new ApiError(message, 403),
    notFound: (message = 'Not Found') =>
        new ApiError(message, 404),
    methodNotAllowed: (message = 'Method Not Allowed') =>
        new ApiError(message, 405),
    notAcceptable: (message = 'Not Acceptable') =>
        new ApiError(message, 406),
    conflict: (message = 'Conflict') =>
        new ApiError(message, 409),
    gone: (message = 'Gone') =>
        new ApiError(message, 410),
    payloadTooLarge: (message = 'Payload Too Large') =>
        new ApiError(message, 413),
    unsupportedMediaType: (message = 'Unsupported Media Type') =>
        new ApiError(message, 415),
    unprocessableEntity: (message = 'Unprocessable Entity') =>
        new ApiError(message, 422),
    tooManyRequests: (message = 'Too Many Requests') =>
        new ApiError(message, 429),
    internalServerError: (message = 'Internal Server Error') =>
        new ApiError(message, 500),
    notImplemented: (message = 'Not Implemented') =>
        new ApiError(message, 501),
    badGateway: (message = 'Bad Gateway') =>
        new ApiError(message, 502),
    serviceUnavailable: (message = 'Service Unavailable') =>
        new ApiError(message, 503),
    gatewayTimeout: (message = 'Gateway Timeout') =>
        new ApiError(message, 504)
};

/**
 * Error handler middleware for Express
 * @param {Error} err - Error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const errorHandler = (err, req, res, next) => {
    let error = err;

    // If the error is not an ApiError, convert it
    if (!(error instanceof ApiError)) {
        const status = error.statusCode || 500;
        const message = error.message || 'Internal Server Error';
        error = new ApiError(message, status, false, err.stack);
    }

    // Log operational errors (don't log programmer errors in production)
    if (error.isOperational) {
        console.error('Operational Error:', error.message, error.stack);
    } else {
        console.error('Programmer Error:', error.message, error.stack);
    }

    // Send error response
    res.status(error.status).json({
        success: false,
        error: {
            code: error.status,
            message: error.message,
            ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
        }
    });
};

/**
 * Catch 404 and forward to error handler
 */
const notFoundHandler = (req, res, next) => {
    next(errorTypes.notFound(`Not Found - ${req.method} ${req.originalUrl}`));
};

module.exports = {
    ApiError,
    ...errorTypes,
    errorHandler,
    notFoundHandler
};