const mongoose = require('mongoose');

// Instance schema
let BonusInstanceSchema = new mongoose.Schema({
    templateId: { type: mongoose.Schema.Types.ObjectId, ref: 'BonusTemplate', required: true },
    referencePeriod: { type: String, required: true }, // e.g., "2023-Q1"
    status: {
        type: String,
        enum: ['draft', 'pending_generation', 'generated', 'under_review', 'approved', 'paid', 'cancelled'],
        default: 'draft'
    },
    shareAmount: { type: Number }, //Share amount for the instance. It default value comes from the template.
    generationDate: { type: Date },
    approvalDate: { type: Date },
    paymentDate: { type: Date },
    customOverrides: { type: mongoose.Schema.Types.Mixed }, // Allows temporary rule modifications
    notes: { type: String },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

//Define Models
let Instance = mongoose.model('BonusInstance', BonusInstanceSchema);

// Export Models
exports.BonusInstance = Instance;

