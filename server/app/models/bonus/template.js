const mongoose = require('mongoose');

// Bonus Template schema
const BonusTemplateSchema = new mongoose.Schema({
    code: { 
        type: String, 
        required: true, 
        unique: true, 
        match: /^[A-Z0-9_-]+$/ // Enforce alphanumeric codes with optional dashes/underscores
    },
    name: { type: String, required: true },
    description: { type: String },
    category: {
        type: String,
        enum: ['with_parts', 'without_parts', 'fixed_amount', 'calculated'],
        required: true
    },
    periodicity: {
        type: String,
        enum: ['daily', 'weekly', 'monthly', 'quarterly', 'semesterly', 'yearly', 'on_demand'],
        required: true
    },
    eligibilityRules: [{
        field: { type: String, required: true }, // personnel field to check
        operator: {
            type: String,
            enum: ['equals', 'not_equals', 'contains', 'greater_than', 'less_than', 'in', 'not_in'],
            required: true
        },
        value: { type: mongoose.Schema.Types.Mixed, required: true },
        description: { type: String } // Optional description for the rule
    }],
    calculationConfig: {
        formulaType: {
            type: String,
            enum: ['fixed', 'percentage', 'custom_formula', 'parts_based'],
            required: true
        },
        baseField: { type: String }, // e.g., "salary", "grade_points"
        formula: { type: String }, // e.g., "base * 0.03 * parts"
        defaultShareAmount: { type: Number },
        partsConfig: {
            defaultParts: { type: Number, default: 1 },
            partRules: [{
                condition: { type: String }, // e.g., "grade === 'A'"
                parts: { type: Number }
            }]
        }
    },
    approvalWorkflow: {
        steps: [{
            role: { type: String, required: true },
            approvalType: { type: String, enum: ['sequential', 'parallel'], default: 'sequential' },
            description: { type: String } // Optional description for the step
        }]
    },
    documentation: { type: String }, // Markdown formatted instructions
    isActive: { type: Boolean, default: true },
    deactivatedAt: { type: Date }, // Track when the template was deactivated
    deactivatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Track who deactivated the template
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    lastUpdatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' } // Track who last updated the template
});

// Define Models
const Template = mongoose.model('BonusTemplate', BonusTemplateSchema);

// Export Models
exports.BonusTemplate = Template;