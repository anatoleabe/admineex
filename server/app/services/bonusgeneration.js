// services/bonusGenerationService.js
const moment = require('moment');
const { BonusTemplate } = require('../models/bonus/template');
const { BonusInstance } = require('../models/bonus/instance');
const { PersonnelSnapshot } = require('../models/bonus/PersonnelSnapshot');
const { BonusAllocation } = require('../models/bonus/allocation');
const { createPersonnelSnapshot, bulkCreateSnapshots} = require('./snapshotService');
const {Personnel} = require("../models/personnel");
const vm = require('vm');
const _= require("underscore");
const fs = require('fs');
const path  = require('path');

/**
 * Main generation function for periodic bonuses
 */
async function generateBonusesForPeriod(period) {
    const currentDate = moment();
    const templates = await BonusTemplate.find({
        isActive: true,
        ...(period ? { periodicity: period } : {})
    });

    let instancesCreated = 0;
    let allocationsGenerated = 0;

    for (const template of templates) {
        if (await shouldGenerate(template, currentDate)) {
            const referencePeriod = formatPeriod(template.periodicity, currentDate);

            const bonusInstanceItem = {
                templateId: template._id,
                referencePeriod,
                status: 'draft',
                shareAmount: template.calculationConfig.defaultShareAmount,
                generationDate: new Date()
            }
            console.log(bonusInstanceItem)
            // Create new instance
            const instance = await BonusInstance.create(bonusInstanceItem);

            // Generate allocations
            const count = await generateAllocationsForInstance(instance._id);

            instancesCreated++;
            allocationsGenerated += count;
        }
    }

    return { instancesCreated, allocationsGenerated };
}

/**
 * Generate bonuses for specific template
 */
async function generateBonusesForTemplate(templateId, referencePeriod) {
    const template = await BonusTemplate.findById(templateId);
    if (!template) throw new Error('Template not found');

    // Create new instance
    const instance = await BonusInstance.create({
        templateId,
        referencePeriod: referencePeriod || formatPeriod(template.periodicity),
        shareAmount: template.defaultShareAmount,
        status: 'draft'
    });

    // Generate allocations
    const count = await generateAllocationsForInstance(instance._id);

    return {
        instance,
        allocationsGenerated: count
    };
}

/**
 * Core allocation generation logic
 */
async function generateAllocationsForInstance(instanceId) {
    const instance = await BonusInstance.findById(instanceId).populate('templateId');
    if (!instance) throw new Error('Instance not found');

    // 1. Ensure we have fresh snapshots
    await bulkCreateSnapshots(new Date());

    // 2. Find eligible personnel
    const eligiblePersonnel = await findEligiblePersonnel(instance.templateId);

    // 3. Create allocations
    const allocations = await Promise.all(
        eligiblePersonnel.map(async (personnel) => {
            try {
                const snapshot = await PersonnelSnapshot.findOne({ personnelId: personnel._id })
                    .sort({ snapshotDate: -1 });

                if (!snapshot) {
                    console.warn(`No snapshot found for personnel ID: ${personnel._id}`);
                    return null;
                }

                // Calculate parts
                const parts = await calculateParts(instance.templateId, snapshot.data);

                // Calculate inputs and amounts
                const calculatedInputs = await calculateInputs(instance.templateId, snapshot.data, parts);
                const calculatedAmount = await calculateAmount(instance, snapshot.data, parts);

                // Create allocation
                const allocationItem = {
                    instanceId: instance._id,
                    personnelId: personnel._id,
                    personnelSnapshotId: snapshot._id,
                    templateId: instance.templateId._id,
                    calculationInputs: calculatedInputs,
                    calculatedAmount: calculatedAmount || 0,
                    finalAmount: calculatedAmount || 0,
                    status: 'eligible'
                };

                return BonusAllocation.create(allocationItem);
            } catch (error) {
                console.error(`Error creating allocation for personnel ID: ${personnel._id}`, error);
                return null;
            }
        })
    );

    return allocations.filter(Boolean).length;
}

/**
 * Determines if a bonus should be generated based on template periodicity
 * @param {Object} template - BonusTemplate document
 * @param {moment} currentDate - Current date as moment object
 * @returns {Promise<boolean>} - Whether generation is needed
 */
async function shouldGenerate(template, currentDate) {
    if (template.periodicity === 'on_demand') return false;

    const lastInstance = await BonusInstance.findOne({
        templateId: template._id
    }).sort({ referencePeriod: -1 });

    if (!lastInstance) return true; // First generation

    const periodFormat = getPeriodFormat(template.periodicity);
    const lastPeriod = moment(lastInstance.referencePeriod, periodFormat);

    // Calculate next expected generation date
    let nextGenerationDate;
    switch (template.periodicity) {
        case 'daily':
            nextGenerationDate = lastPeriod.add(1, 'day');
            break;
        case 'weekly':
            nextGenerationDate = lastPeriod.add(1, 'week');
            break;
        case 'monthly':
            nextGenerationDate = lastPeriod.add(1, 'month').startOf('month');
            break;
        case 'quarterly':
            nextGenerationDate = lastPeriod.add(3, 'months').startOf('quarter');
            break;
        case 'yearly':
            nextGenerationDate = lastPeriod.add(1, 'year').startOf('year');
            break;
        default:
            return false;
    }

    return currentDate.isSameOrAfter(nextGenerationDate);
}




/**
 * Calculates parts for parts-based bonuses
 * @param {Object} template - BonusTemplate document
 * @param {Object} snapshotData - PersonnelSnapshot data
 * @returns {number} - Calculated parts value
 */

const categoriesCache = {};

async function calculateParts(template, snapshotData) {
    if (template.category !== 'with_parts') return 1;

    const { status, category, rank } = snapshotData;

    // Load categories.json dynamically based on status, with caching
    if (!categoriesCache[status]) {
        const categoriesFilePath = path.resolve(
            __dirname,
            '../../resources/dictionary/personnel/status',
            status,
            'categories.json'
        );

        try {
            categoriesCache[status] = JSON.parse(fs.readFileSync(categoriesFilePath, 'utf8'));
        } catch (error) {
            console.error(`Failed to load categories.json for status: ${status}`, error);
            categoriesCache[status] = []; // Default to empty array if categories.json cannot be loaded
        }
    }

    const categories = categoriesCache[status];

    // Build mappings dynamically
    const partsByCategory = {
        fonctionnaire: {
            '1': 2, // Category A1
            '2': 2, // Category A2
            '3': 1, // Category B1
            '4': 1, // Category B2
            '5': 1, // Category C
            '6': 1  // Category D
        },
        nonFonctionnaire: categories.reduce((acc, category) => {
            const { id } = category;

            // Map IDs to parts
            acc[id] = ['16', '17', '18'].includes(id) ? 2 : 1; // 2 parts for categories 16, 17, 18; 1 part for others
            return acc;
        }, {})
    };

    // Define parts by rank
    const partsByRank = {
        'CB': 2,  // Chef de bureau
        'CS': 4,  // Chef de service
        'SD': 5,  // Sous-Directeur
        'DA': 5,  // Directeur Adjoint
        'DIR': 6  // Directeur
    };

    const config = template.calculationConfig.partsConfig;

    // Step 1: Check if rank overrides category
    if (rank && partsByRank[rank]) {
        return partsByRank[rank];
    }

    // Step 2: Determine personnel status (Fonctionnaire or Non-Fonctionnaire)
    const statusPerso = status === '1' ? 'fonctionnaire' : 'nonFonctionnaire';

    // Step 3: Determine parts based on category
    if (statusPerso === 'fonctionnaire') {
        if (partsByCategory.fonctionnaire[category]) {
            return partsByCategory.fonctionnaire[category];
        }
    } else if (statusPerso === 'nonFonctionnaire') {
        if (partsByCategory.nonFonctionnaire[category]) {
            return partsByCategory.nonFonctionnaire[category];
        }
    }
    
    // Step 4: Check if category has specific rules in the template
    // Process override rules
    for (const rule of config.partRules || []) {
        if (!rule.override) continue;

        try {
            if (evaluateCondition(rule.condition, snapshotData)) {
                return rule.parts;
            }
        } catch (e) {
            console.error(`Error evaluating override rule: ${rule.condition}`, e);
        }
    }

    // Process normal rules
    for (const rule of config.partRules || []) {
        if (rule.override) continue;

        try {
            if (evaluateCondition(rule.condition, snapshotData)) {
                return rule.parts;
            }
        } catch (e) {
            console.error(`Error evaluating rule: ${rule.condition}`, e);
        }
    }

    return config.defaultParts || 1;
}

function evaluateCondition(condition, context) {
    // Create a secure sandbox
    const sandbox = {
        ...context,
        // Add basic comparison functions
        __eq: (a, b) => a === b,
        __includes: (arr, val) => Array.isArray(arr) ? arr.includes(val) : false
    };

    // Transform the condition to use our safe functions
    const transformed = condition
        .replace(/(\w+)\s*===\s*([^&\|]+)/g, '__eq($1, $2)');

    try {
        const result = vm.runInNewContext(transformed, sandbox, { timeout: 100 });
        return Boolean(result);
    } catch (error) {
        console.error('Evaluation failed:', {
            condition,
            transformed,
            context,
            error
        });
        throw new Error(`Condition evaluation failed: ${error.message}\nCondition: ${condition}`);
    }
}


async function calculateInputs(template, snapshotData, parts) {

    return {
        baseSalary: snapshotData.salary,
        category: snapshotData.category,
        status: snapshotData.status,
        grade: snapshotData.grade,
        rank: snapshotData.rank,
        parts: parts
    };
}



// Helper functions for calculateAmount
function getBaseFieldValue(field, snapshotData) {
    // Handle nested fields (e.g., "position.rank")
    return field.split('.').reduce((obj, key) => obj?.[key], snapshotData) || 0;
}

function evaluateCustomFormula(template, snapshotData) {
    try {
        const formula = template.calculationConfig.formula
            .replace(/\b(base|salary)\b/, 'snapshotData.salary')
            .replace(/\b(grade|category)\b/, match => `snapshotData.${match}`);

        return safeEval(formula, { snapshotData });
    } catch (e) {
        console.error(`Formula calculation failed: ${e.message}`);
        return 0;
    }
}

function getPeriodFormat(periodicity) {
    const formats = {
        daily: 'YYYY-MM-DD',
        weekly: 'YYYY-[W]WW',
        monthly: 'YYYY-MM',
        quarterly: 'YYYY-[Q]Q',
        yearly: 'YYYY'
    };
    return formats[periodicity] || 'YYYY-MM-DD';
}

/**
 * Converts eligibility rules to MongoDB query conditions
 * @param {Object} rule - { field, operator, value }
 * @returns {Object} - MongoDB query condition
 */
function buildOperatorCondition(rule) {
    const { operator, value } = rule;

    switch (operator) {
        case 'equals':
            return value;
        case 'not_equals':
            return { $ne: value };
        case 'contains':
            return { $regex: value, $options: 'i' };
        case 'greater_than':
            return { $gt: parseFloat(value) };
        case 'less_than':
            return { $lt: parseFloat(value) };
        case 'in':
            return { $in: Array.isArray(value) ? value : [value] };
        case 'not_in':
            return { $nin: Array.isArray(value) ? value : [value] };
        default:
            return value;
    }
}

// Helper functions
function formatPeriod(periodicity, date = moment()) {
    switch (periodicity) {
        case 'monthly': return date.format('YYYY-MM');
        case 'quarterly': return `${date.year()}-Q${Math.ceil((date.month() + 1)/3)}`;
        case 'yearly': return date.format('YYYY');
        default: return date.format('YYYY-MM-DD');
    }
}

async function findEligiblePersonnel(template) {
    // Implement your eligibility logic based on template rules
    // This is a simplified version - expand with your actual rules
    return Personnel.find({
        ...buildEligibilityQuery(template.eligibilityRules)
    });
}

function buildEligibilityQuery(rules) {
    // Convert template eligibilityRules to MongoDB query
    // Example implementation:
    return rules.reduce((query, rule) => {
        query[`${rule.field}`] = buildOperatorCondition(rule);
        return query;
    }, {});
}

/**
 * Calculates bonus amount based on template rules
 * @param {Object} instance - BonusInstance document
 * @param {Object} snapshotData - PersonnelSnapshot data
 * @param {Object} parts - Agent part
 * @returns {number} - Calculated amount
 */
async function calculateAmount(instance, snapshotData, parts) {
    const template = instance.templateId;
    const config = template.calculationConfig;

    switch (template.category) {
        case 'fixed_amount':
            return config.fixedAmount || 0;

        case 'percentage':
            const base = getBaseFieldValue(config.baseField, snapshotData);
            return base * (config.percentage / 100);

        case 'with_parts':
            const shareAmount = instance.shareAmount || 0;
            return shareAmount * parts;

        case 'sans_parts': // Example for "Remise sur salaire"
            const salary = snapshotData.salary || 0;
            const rate = config.rate || 0;
            return salary * 3 * rate;

        case 'calculated':
            return evaluateCustomFormula(template, snapshotData);

        default:
            return 0;
    }
}

const calculateBonusWithParts = (category, rank, partValue) => {
    let parts = 0;

    // Determine parts based on category
    if (['A'].includes(category)) parts = 2;
    else if (['B', 'C', 'D'].includes(category)) parts = 1;

    // Determine parts based on rank (overrides category)
    if (rank === 'Chef de bureau') parts = 2;
    else if (rank === 'Chef de service') parts = 4;
    else if (rank === 'Sous-Directeur' || rank === 'Directeur Adjoint') parts = 5;
    else if (rank === 'Directeur') parts = 6;

    // Calculate bonus
    return parts * partValue;
};

const calculateBonusWithoutParts = (salary, rate) => {
    return salary * 3 * rate; // Example formula for "Remise sur salaire"
};

module.exports = {
    generateBonusesForPeriod,
    generateBonusesForTemplate,
    generateAllocationsForInstance,
    calculateBonusWithParts,
    calculateBonusWithoutParts
};