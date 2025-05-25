// controllers/bonusGeneration.controller.js
const moment = require('moment');
const { BonusTemplate } = require('../../models/bonus/template');
const { BonusInstance } = require('../../models/bonus/instance');
const { generateBonusesForPeriod, generateBonusesForTemplate } = require('../../services/bonusgeneration');
const formidable = require('formidable');
const { badRequest} = require('../../utils/ApiError');

exports.api = {};

/**
 * Manually trigger periodic bonus generation
 */
exports.api.generatePeriodicBonuses = async (req, res, next) => {
    const form = formidable({ multiples: true });

    form.parse(req, async (err, fields, files) => {
        if (err) return next(badRequest('Form parsing failed'));

        try {
            const { period } = fields;// Optional: 'monthly', 'quarterly', etc.
            
            console.log(fields)

            const result = await generateBonusesForPeriod(period);
            res.json({ success: true, ...result });
        } catch (error) {
            console.error('Periodic bonus generation failed:', error);
            next(error);
        }
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
            throw badRequest('templateId and referencePeriod are required');
        }

        if (!moment(referencePeriod, 'YYYY-MM', true).isValid()) {
            throw badRequest('Invalid referencePeriod format. Expected format: YYYY-MM');
        }

        const template = await BonusTemplate.findById(templateId);
        if (!template) {
            throw notFound('Bonus template not found');
        }

        if (!template.isActive) {
            throw badRequest('Cannot generate bonuses for an inactive template');
        }

        const result = await generateBonusesForTemplate(templateId, referencePeriod);
        res.status(201).json(result);
    } catch (error) {
        console.error('Template bonus generation failed:', error);
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