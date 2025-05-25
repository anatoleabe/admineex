const httpStatus = require('http-status');
const mongoose = require('mongoose');
const { BonusRule } = require('../../models/bonus/rule');
const { BonusTemplate } = require('../../models/bonus/template');
const { badRequest, notFound } = require('../../utils/ApiError');
const { safeEval } = require('../../utils/safeEval'); // For testing rules safely

// API methods
exports.api = {};

/**
 * Create a bonus rule
 */
exports.api.create = async (req, res, next) => {
    try {
        const { name, description, condition, action, priority, appliesToTemplates } = req.body;

        // Verify templates exist if specified
        if (appliesToTemplates && appliesToTemplates.length > 0) {
            const templatesExist = await BonusTemplate.countDocuments({
                _id: { $in: appliesToTemplates }
            });
            if (templatesExist !== appliesToTemplates.length) {
                throw badRequest('One or more bonus templates not found');
            }
        }

        const rule = await BonusRule.create({
            name,
            description,
            condition,
            action,
            priority,
            appliesToTemplates,
            isActive: true,
            createdBy: req.user.id
        });

        res.status(httpStatus.CREATED).json(rule);
    } catch (error) {
        next(error);
    }
};

/**
 * Get all bonus rules
 */
exports.api.getAll = async (req, res, next) => {
    try {
        const { activeOnly, templateId, limit = 100, sortBy = 'priority:asc' } = req.query;

        const filter = {};
        if (activeOnly === 'true') filter.isActive = true;
        if (templateId) filter.appliesToTemplates = templateId;

        const [sortField, sortOrder] = sortBy.split(':');
        const sort = { [sortField]: sortOrder === 'desc' ? -1 : 1 };

        const rules = await BonusRule.find(filter)
            .sort(sort)
            .limit(Number(limit))
            .populate('appliesToTemplates', 'name code')
            .populate('createdBy', 'firstname lastname');

        res.json(rules);
    } catch (error) {
        next(error);
    }
};

/**
 * Get bonus rule by ID
 */
exports.api.getById = async (req, res, next) => {
    try {
        const rule = await BonusRule.findById(req.params.id)
            .populate('appliesToTemplates', 'name code')
            .populate('createdBy', 'firstname lastname');

        if (!rule) {
            throw notFound('Bonus rule not found');
        }

        res.json(rule);
    } catch (error) {
        next(error);
    }
};

/**
 * Update bonus rule
 */
exports.api.update = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { name, description, condition, action, priority, appliesToTemplates } = req.body;

        // Verify templates exist if specified
        if (appliesToTemplates && appliesToTemplates.length > 0) {
            const templatesExist = await BonusTemplate.countDocuments({
                _id: { $in: appliesToTemplates }
            });
            if (templatesExist !== appliesToTemplates.length) {
                throw badRequest('One or more bonus templates not found');
            }
        }

        const updatedRule = await BonusRule.findByIdAndUpdate(
            id,
            {
                name,
                description,
                condition,
                action,
                priority,
                appliesToTemplates,
                updatedAt: new Date()
            },
            { new: true }
        );

        if (!updatedRule) {
            throw notFound('Bonus rule not found');
        }

        res.json(updatedRule);
    } catch (error) {
        next(error);
    }
};

/**
 * Delete bonus rule (soft delete)
 */
exports.api.delete = async (req, res, next) => {
    try {
        const rule = await BonusRule.findByIdAndUpdate(
            req.params.id,
            { isActive: false, updatedAt: new Date() },
            { new: true }
        );

        if (!rule) {
            throw notFound('Bonus rule not found');
        }

        res.status(httpStatus.NO_CONTENT).send();
    } catch (error) {
        next(error);
    }
};

/**
 * Activate bonus rule
 */
exports.api.activate = async (req, res, next) => {
    try {
        const rule = await BonusRule.findByIdAndUpdate(
            req.params.id,
            { isActive: true, updatedAt: new Date() },
            { new: true }
        );

        if (!rule) {
            throw notFound('Bonus rule not found');
        }

        res.json(rule);
    } catch (error) {
        next(error);
    }
};

/**
 * Validate bonus rule syntax
 */
exports.api.validate = async (req, res, next) => {
    try {
        const { condition, action } = req.body;

        // Test condition syntax
        try {
            safeEval(condition, {});
        } catch (error) {
            throw badRequest(`Condition syntax error: ${error.message}`);
        }

        // Test action syntax
        try {
            safeEval(action, {});
        } catch (error) {
            throw badRequest(`Action syntax error: ${error.message}`);
        }

        res.json({ valid: true });
    } catch (error) {
        next(error);
    }
};

/**
 * Test bonus rule with sample data
 */
exports.api.test = async (req, res, next) => {
    try {
        const { condition, action, testData } = req.body;

        // Validate inputs
        if (!condition || !action || !testData) {
            throw badRequest('Condition, action and testData are required');
        }

        // Create safe context
        const context = {
            ...testData,
            result: null,
            utils: {
                // Add any safe utility functions you want to expose
                calculateSeniority: (date) => {
                    const diff = Date.now() - new Date(date).getTime();
                    return Math.floor(diff / (1000 * 60 * 60 * 24 * 365));
                }
            }
        };

        // Test condition
        let conditionResult;
        try {
            conditionResult = safeEval(condition, context);
        } catch (error) {
            throw badRequest(`Condition evaluation error: ${error.message}`);
        }

        if (typeof conditionResult !== 'boolean') {
            throw badRequest('Condition must evaluate to a boolean value');
        }

        // Test action if condition is true
        let actionResult = null;
        if (conditionResult) {
            try {
                actionResult = safeEval(action, context);
            } catch (error) {
                throw badRequest(`Action evaluation error: ${error.message}`);
            }
        }

        res.json({
            conditionResult,
            actionResult,
            context
        });
    } catch (error) {
        next(error);
    }
};