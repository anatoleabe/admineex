// controllers/bonusGeneration.controller.js
const moment = require('moment');
const { BonusTemplate } = require('../../models/bonus/template');
const { BonusInstance } = require('../../models/bonus/instance');
const { generateBonusesForPeriod, generateBonusesForTemplate } = require('../../services/bonusgeneration');
const formidable = require('formidable');
const audit = require('../../utils/audit-log');
const dictionary = require('../../utils/dictionary');
const { badRequest, notFound } = require('../../utils/ApiError');

exports.api = {};

function t(req, msgid) {
    const language = (req && req.actor && req.actor.language) || (req && req.user && req.user.language) || '';
    return dictionary.translator(language).gettext(msgid);
}

function getActorId(req) {
    if (req && req.actor && req.actor.id) return req.actor.id;
    if (req && req.user && req.user.id) return req.user.id;
    if (req && req.user && req.user._id) return req.user._id;
    return '[anonymous]';
}

function auditEvent(req, action, label, object, status, description) {
    audit.logEvent(getActorId(req), 'bonus/generation', action, label, object, status, description);
}

/**
 * Manually trigger periodic bonus generation
 */
exports.api.generatePeriodicBonuses = async (req, res, next) => {
    const handleFields = async (fields) => {
        try {
            const { period } = fields;// Optional: 'monthly', 'quarterly', etc.

            console.log(fields)

            const result = await generateBonusesForPeriod(period);
            auditEvent(req, 'generate_periodic', 'Bonus', '', 'succeed', `Triggered periodic bonus generation. period=${period || ''}`);
            res.json({ success: true, ...result });
        } catch (error) {
            console.error('Periodic bonus generation failed:', error);
            auditEvent(req, 'generate_periodic', 'Bonus', '', 'failed', error && error.message ? error.message : String(error));
            next(error);
        }
    };

    if (req.body && Object.keys(req.body).length > 0) {
        return handleFields(req.body);
    }

    const form = formidable({ multiples: true });
    form.parse(req, async (err, fields, files) => {
        if (err) return next(badRequest(t(req, 'Form parsing failed')));
        return handleFields(fields);
    });
};

/**
 * Generate bonuses for a specific template
 */
exports.api.generateTemplateBonuses = async (req, res, next) => {
    try {
        const { templateId, referencePeriod } = req.body;

        // Validate templateId and referencePeriod
        if (!templateId || !referencePeriod) {
            throw badRequest(t(req, 'templateId and referencePeriod are required'));
        }

        if (!moment(referencePeriod, 'YYYY-MM', true).isValid()) {
            throw badRequest(t(req, 'Invalid referencePeriod format. Expected format: YYYY-MM'));
        }

        const template = await BonusTemplate.findById(templateId);
        if (!template) {
            throw notFound(t(req, 'Bonus template not found'));
        }

        if (!template.isActive) {
            throw badRequest(t(req, 'Cannot generate bonuses for an inactive template'));
        }

        const result = await generateBonusesForTemplate(templateId, referencePeriod);
        auditEvent(req, 'generate_template', 'BonusTemplate', templateId, 'succeed', `Generated bonuses for template. referencePeriod=${referencePeriod}`);
        res.status(201).json(result);
    } catch (error) {
        console.error('Template bonus generation failed:', error);
        auditEvent(req, 'generate_template', 'BonusTemplate', (req.body && req.body.templateId) || '', 'failed', error && error.message ? error.message : String(error));
        next(error);
    }
};

/**
 * Calculate current reference period based on template periodicity
 */
function getCurrentReferencePeriod(periodicity) {
    const now = moment();
    switch (periodicity) {
        case 'daily':
            return now.format('YYYY-MM-DD');
        case 'weekly':
            return now.format('YYYY-[W]WW');
        case 'monthly':
            return now.format('YYYY-MM');
        case 'quarterly':
            const quarter = Math.ceil((now.month() + 1) / 3);
            return `${now.year()}-Q${quarter}`;
        case 'semesterly':
            const semester = now.month() < 6 ? 1 : 2;
            return `${now.year()}-S${semester}`;
        case 'yearly':
            return now.format('YYYY');
        default:
            return now.format('YYYY-MM');
    }
}

/**
 * Anticipate/early generate bonuses for a template (before scheduled trigger)
 * Can only be done once per period
 */
exports.api.anticipateTemplateBonuses = async (req, res, next) => {
    try {
        console.log('anticipateTemplateBonuses called with body:', req.body);
        const { templateId } = req.body;

        if (!templateId) {
            throw badRequest(t(req, 'templateId is required'));
        }

        const template = await BonusTemplate.findById(templateId);
        if (!template) {
            throw notFound(t(req, 'Bonus template not found'));
        }

        if (!template.isActive) {
            throw badRequest(t(req, 'Cannot generate bonuses for an inactive template'));
        }

        if (template.periodicity === 'on_demand') {
            throw badRequest(t(req, 'On-demand templates cannot be anticipated. Use manual generation instead.'));
        }

        // Calculate current reference period based on template periodicity
        const currentPeriod = getCurrentReferencePeriod(template.periodicity);

        // Check if instance already exists for current period
        const existingInstance = await BonusInstance.findOne({
            templateId: template._id,
            referencePeriod: currentPeriod
        });

        if (existingInstance) {
            throw badRequest(t(req, 'A bonus instance already exists for the current period') + `: ${currentPeriod}`);
        }

        // Generate with isAnticipated flag
        const result = await generateBonusesForTemplate(templateId, currentPeriod, { isAnticipated: true });

        auditEvent(req, 'anticipate_template', 'BonusTemplate', templateId, 'succeed', `Anticipated generation for template. period=${currentPeriod}`);
        res.status(201).json({
            ...result,
            referencePeriod: currentPeriod,
            message: t(req, 'Bonus instance generated successfully for current period')
        });
    } catch (error) {
        console.error('Anticipated template bonus generation failed:', error);
        auditEvent(req, 'anticipate_template', 'BonusTemplate', (req.body && req.body.templateId) || '', 'failed', error && error.message ? error.message : String(error));
        next(error);
    }
};

// Helper function to determine if generation is needed
async function shouldGenerate(template, currentDate) {
    const lastInstance = await BonusInstance.findOne({ templateId: template._id })
        .sort({ referencePeriod: -1 });

    if (!lastInstance) return true; // Never generated before

    const lastDate = moment(lastInstance.referencePeriod, template.periodicityFormat);
    const nextDate = lastDate.add(1, template.periodicity);

    return currentDate.isSameOrAfter(nextDate, template.periodicity);
}

// Start cron job for automatic generation
function startGenerationCronJobs() {
    // Daily check for periodic bonuses
    cron.schedule('0 2 * * *', async () => { // 2 AM daily
        try {
            await generateAllocations.generateBonusesForPeriod();
        } catch (error) {
            console.error('Automatic bonus generation failed:', error);
        }
    });
}

module.exports = exports;
