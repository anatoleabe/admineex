// services/bonusGenerationService.js
const moment = require('moment');
const { BonusTemplate } = require('../models/bonus/template');
const { BonusInstance } = require('../models/bonus/instance');
const { PersonnelSnapshot } = require('../models/bonus/personnelSnapshot');
const { BonusAllocation } = require('../models/bonus/allocation');
const { bulkCreateSnapshots} = require('./snapshotService');
const {Personnel} = require("../models/personnel");
const dictionary = require('../utils/dictionary');
const vm = require('vm');
const fs = require('fs');
const path  = require('path');

// Cache loaders for dictionary JSON files
const _dictCache = {};
function loadJSONDict(relPath) {
    const absPath = path.resolve(__dirname, relPath);
    if (_dictCache[absPath]) return _dictCache[absPath];
    try {
        const data = JSON.parse(fs.readFileSync(absPath, 'utf8'));
        _dictCache[absPath] = data;
        return data;
    } catch (e) {
        console.error('Failed to load dictionary JSON:', absPath, e.message);
        _dictCache[absPath] = null;
        return null;
    }
}

function getSBIFromSnapshot(snapshotData) {
    // status '1' => fonctionnaire, use indices_salaire.json by index
    // status '2' => non fonctionnaire, use echelons_salaire.json by id (category) and echelon (index)
    const status = snapshotData?.status;
    if (!status) return { sbi: 0, reason: 'missing_status' };

    if (String(status) === '1') {
        const indexVal = parseInt(snapshotData?.index, 10);
        if (!Number.isFinite(indexVal)) return { sbi: 0, reason: 'invalid_index' };
        const table = loadJSONDict('../../resources/dictionary/personnel/status/1/indices_salaire.json') || [];
        const row = table.find(r => Number(r.index) === indexVal);
        if (!row) return { sbi: 0, reason: 'index_not_found' };
        return { sbi: Number(row.salary) || 0 };
    }

    if (String(status) === '2') {
        const catId = String(snapshotData?.category || '').trim();
        const echelon = parseInt(snapshotData?.index, 10);
        if (!catId || !Number.isFinite(echelon)) return { sbi: 0, reason: 'invalid_category_or_echelon' };
        const table = loadJSONDict('../../resources/dictionary/personnel/status/2/echelons_salaire.json') || [];
        const row = table.find(r => String(r.id) === catId && Number(r.echelon) === echelon);
        if (!row) return { sbi: 0, reason: 'echelon_not_found' };
        return { sbi: Number(row.salary) || 0 };
    }

    return { sbi: 0, reason: 'unknown_status' };
}

function getTXFromRank(snapshotData) {
    const rank = String(snapshotData?.rank || '').trim();
    if (!rank) return { tx: 0, reason: 'missing_rank' };
    const ranks = loadJSONDict('../../resources/dictionary/personnel/ranks.json') || [];
    const row = ranks.find(r => String(r.id) === rank);
    if (!row) return { tx: 0, reason: 'rank_not_found' };
    const rate = Number(row.bonusRate);
    return { tx: Number.isFinite(rate) ? rate : 0 };
}

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
                shareAmount: template.calculationConfig?.defaultShareAmount,
                generationDate: new Date(),
                taxName: template.taxConfig?.taxName,
                taxPercentage: template.taxConfig?.taxPercentage
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
        shareAmount: template.calculationConfig?.defaultShareAmount,
        status: 'draft',
        taxName: template.taxConfig?.taxName,
        taxPercentage: template.taxConfig?.taxPercentage
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
    try {
        const instance = await BonusInstance.findById(instanceId).populate('templateId');
        if (!instance) throw new Error('Instance not found');

        // 1. Ensure we have fresh snapshots
        await bulkCreateSnapshots(new Date());

        // 2. Find eligible personnel
        const eligiblePersonnel = await findEligiblePersonnel(instance.templateId);

        // 3. Create allocations
        const templateSubType = instance.templateId?.calculationConfig?.subType || null;
        const isSansPartIFT = instance.templateId?.category === 'without_parts' && templateSubType === 'ift';
        const effectiveTaxRate = isSansPartIFT ? 0 : (instance.taxPercentage ? instance.taxPercentage / 100 : 0);

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

                    // Calculate amount based on inputs
                    const calculatedAmount = calculatedInputs.parts > 0 ?
                        await calculateAmount(instance, snapshot.data, calculatedInputs.parts) : 0;

                    // Calculate tax information with rounding rules (FCFA integer)
                    const taxRate = effectiveTaxRate;
                    // For sans part, brut should be rounded; for consistency, apply rounding to all categories
                    const grossAmountRaw = calculatedAmount || 0;
                    const grossAmount = Math.round(grossAmountRaw);
                    const taxAmount = Math.round(grossAmount * taxRate);
                    const netAmount = grossAmount - taxAmount;

                    // Create allocation
                    const allocationItem = {
                        instanceId: instance._id,
                        personnelId: personnel._id,
                        personnelSnapshotId: snapshot._id,
                        templateId: instance.templateId._id,
                        calculationInputs: calculatedInputs,
                        calculatedAmount: grossAmountRaw || 0,
                        finalAmount: grossAmount || 0,
                        // Tax-related fields
                        grossAmount: grossAmount || 0,
                        taxAmount: taxAmount || 0,
                        netAmount: netAmount || 0,
                        taxRate: taxRate || 0,
                        status: calculatedInputs.parts > 0 ? 'eligible' : 'excluded',
                        comment: calculatedInputs.comment || '',
                        situationText: calculatedInputs.situationText || {},
                        situation: calculatedInputs.situation || {},
                        sanctionText: calculatedInputs.sanctionText || {},
                        sanctions: calculatedInputs.sanctions || [],
                    };

                    return BonusAllocation.create(allocationItem);
                } catch (error) {
                    console.error(`Error creating allocation for personnel ID: ${personnel._id}`, error);
                    return null;
                }
            })
        );

        return allocations.filter(Boolean).length;
    } catch (error) {
        console.error('Error generating allocations for instance:', error);
        throw new Error(`Failed to generate allocations: ${error.message}`);
    }
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

    // Calculate next expected generation date
    let nextGenerationDate;
    switch (template.periodicity) {
        case 'daily':
            nextGenerationDate = moment(lastInstance.referencePeriod, getPeriodFormat('daily')).add(1, 'day');
            break;
        case 'weekly':
            nextGenerationDate = moment(lastInstance.referencePeriod, getPeriodFormat('weekly')).add(1, 'week');
            break;
        case 'monthly':
            nextGenerationDate = moment(lastInstance.referencePeriod, getPeriodFormat('monthly')).add(1, 'month').startOf('month');
            break;
        case 'quarterly': {
            // Parse like YYYY-Qn to a date at quarter start
            const match = /^(\d{4})-Q([1-4])$/.exec(lastInstance.referencePeriod);
            const year = match ? parseInt(match[1], 10) : currentDate.year();
            const q = match ? parseInt(match[2], 10) : Math.ceil((currentDate.month() + 1) / 3);
            const startMonth = (q - 1) * 3; // 0,3,6,9
            nextGenerationDate = moment({ year, month: startMonth, day: 1 }).add(3, 'months').startOf('quarter');
            break;
        }
        case 'semesterly': {
            // Parse YYYY-Sn to a date at semester start
            const match = /^(\d{4})-S([1-2])$/.exec(lastInstance.referencePeriod);
            const year = match ? parseInt(match[1], 10) : currentDate.year();
            const s = match ? parseInt(match[2], 10) : (currentDate.month() < 6 ? 1 : 2);
            const startMonth = s === 1 ? 0 : 6;
            nextGenerationDate = moment({ year, month: startMonth, day: 1 }).add(6, 'months');
            break;
        }
        case 'yearly':
            nextGenerationDate = moment(lastInstance.referencePeriod, getPeriodFormat('yearly')).add(1, 'year').startOf('year');
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
    try {
        // Extract situation and sanctions data
        const situationId = snapshotData.situation ? snapshotData.situation.situation : null;
        const sanctions = snapshotData.sanctions || [];

        // Beautify situation value using dictionary
        let situationValue = '';
        if (situationId) {
            situationValue = dictionary.getValueFromJSON(
                '../../resources/dictionary/personnel/situations.json',
                situationId,
                'fr'
            ) || situationId;
        }

        // Beautify the last sanction value if available
        let lastSanctionValue = '';
        if (sanctions.length > 0) {
            // Sort sanctions by date (descending) and get the latest one
            const sortedSanctions = [...sanctions].sort((a, b) => {
                if (a.startDate && b.startDate) {
                    return new Date(b.startDate) - new Date(a.startDate);
                }
                return 0;
            });

            const lastSanctionId = sortedSanctions[0]?.sanction;
            if (lastSanctionId) {
                lastSanctionValue = dictionary.getValueFromJSON(
                    '../../resources/dictionary/personnel/sanctions.json',
                    lastSanctionId,
                    'fr'
                ) || lastSanctionId;
            }
        }

        // Check if personnel has any disqualifying sanctions
        const hasSevereActiveSanctions = sanctions.some(sanction => {
            const sanctionId = sanction.sanction;
            return ['26', '27', '28', '29', '20', '22'].includes(sanctionId);
        });

        // Check if personnel has a disqualifying situation
        const hasDisqualifyingSituation = ['3', '5', '6', '8', '10'].includes(situationId);

        // Apply logic for parts adjustment
        let adjustedParts = parts;
        let comment = '';

        // Use concise comments based on the actual situation or sanction
        if (hasDisqualifyingSituation) {
            adjustedParts = 0;
            comment = situationValue; // Just use the situation text
        } else if (hasSevereActiveSanctions) {
            adjustedParts = 0;
            comment = lastSanctionValue; // Use the actual sanction text
        }

        // Pre-compute Index/Cat display
        const statusStr = String(snapshotData.status || '');
        const indexStr = (snapshotData.index !== undefined && snapshotData.index !== null) ? String(snapshotData.index) : '';
        let indiceCatDisplay = '';
        if (statusStr === '1') {
            indiceCatDisplay = indexStr || '';
        } else if (statusStr === '2') {
            const catRaw = snapshotData.category;
            // Try dictionary lookup; fallback to raw value
            let catCode = '';
            const catId = catRaw;
            catCode = dictionary.getValueFromJSON(
                    '../../resources/dictionary/personnel/status/2/categories.json',
                    catId,
                    'code'
                ) || String(catRaw);
            
            indiceCatDisplay = (catCode ? catCode : '') + (indexStr ? (' / ' + indexStr) : '');
        }

        // Additional inputs specific to without_parts (remise sur salaire)
        let sbi = undefined;
        let txPercent = undefined;
        let sansPartSubType = null;
        if (template.category === 'without_parts') {
            sansPartSubType = template.calculationConfig?.subType || 'remise';
            const { sbi: sbiVal } = getSBIFromSnapshot(snapshotData);
            const { tx } = getTXFromRank(snapshotData);
            sbi = sbiVal || 0;
            txPercent = Number.isFinite(tx) ? Math.round(tx * 10000) / 100 : 0; // keep 2 decimals if needed
            // For reporting missing SBI, annotate comment if zero and not disqualified
            if (!hasDisqualifyingSituation && !hasSevereActiveSanctions && sbi === 0) {
                comment = (comment ? comment + ' | ' : '') + 'SBI introuvable';
            }
        }

        return {
            baseSalary: snapshotData.salary,
            category: snapshotData.category,
            status: snapshotData.status,
            grade: snapshotData.grade,
            rank: snapshotData.rank,
            parts: adjustedParts,
            situation: situationId,
            situationText: situationValue,
            sanctions: sanctions.map(s => s.sanction).join(','),
            sanctionText: lastSanctionValue,
            comment: comment,
            // extras for sans part
            sbi: sbi,
            txPercent: txPercent,
            subType: sansPartSubType,
            // added: index and display for Indice/Cat
            index: indexStr,
            indiceCatDisplay: indiceCatDisplay
        };
    } catch (error) {
        console.error('Error calculating inputs:', error);
        throw new Error(`Failed to calculate inputs: ${error.message}`);
    }
}



// Helper functions for calculateAmount
function getBaseFieldValue(field, snapshotData) {
    // Handle nested fields (e.g., "position.rank")
    return field.split('.').reduce((obj, key) => obj?.[key], snapshotData) || 0;
}

function evaluateCustomFormula(template, snapshotData) {
    try {
        let formula = String(template.calculationConfig.formula || '0');
        // Map common tokens to snapshotData
        formula = formula
            .replace(/\bbase\b/g, 'snapshotData.salary')
            .replace(/\bsalary\b/g, 'snapshotData.salary')
            .replace(/\bgrade\b/g, 'snapshotData.grade')
            .replace(/\bcategory\b/g, 'snapshotData.category')
            .replace(/\bparts\b/g, '1');

        const context = vm.createContext({ snapshotData, Math });
        const script = new vm.Script(`Number(${formula})`);
        const result = script.runInContext(context, { timeout: 100 });
        return Number.isFinite(result) ? result : 0;
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
        semesterly: 'YYYY-[S]S',
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
        case 'semesterly': {
            const semester = date.month() < 6 ? 1 : 2;
            return `${date.year()}-S${semester}`;
        }
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
        case 'with_parts': {
            const shareAmount = instance.shareAmount || 0;
            return shareAmount * parts;
        }
        case 'without_parts': { // Remise sur salaire
            const { sbi } = getSBIFromSnapshot(snapshotData);
            const { tx } = getTXFromRank(snapshotData);
            const salaryBase = Number(sbi) || 0;
            const rate = Number(tx) || 0; // e.g., 0.45 for 45%
            const subType = template.calculationConfig?.subType || 'remise';
            if (subType === 'ift') {
                return salaryBase * rate;
            }
            // R = SBI × 3 × TX
            return salaryBase * 3 * rate;
        }
        case 'fixed_amount':
            return config.fixedAmount || 0;
        case 'calculated': {
            // Decide by formulaType
            switch (config.formulaType) {
                case 'percentage': {
                    const base = getBaseFieldValue(config.baseField || 'salary', snapshotData);
                    return base * ((config.percentage || 0) / 100);
                }
                case 'fixed':
                    return config.fixedAmount || 0;
                case 'custom_formula':
                    return evaluateCustomFormula(template, snapshotData);
                default:
                    return 0;
            }
        }
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
