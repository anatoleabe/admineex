const mongoose = require('mongoose');

// Rule schema
const BonusRuleSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: { type: String },
    condition: { type: String, required: true }, // JavaScript-like condition string
    action: { type: String, required: true }, // JavaScript-like action string
    priority: { type: Number, default: 1 },
    isActive: { type: Boolean, default: true },
    appliesToTemplates: [{ type: mongoose.Schema.Types.ObjectId, ref: 'BonusTemplate' }],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

//Define Models
const Rule = mongoose.model('BonusRule', BonusRuleSchema);

// Export Models
exports.BonusRule = Rule;

