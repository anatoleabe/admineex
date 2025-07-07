const mongoose = require('mongoose');

// Instance schema
let BonusInstanceSchema = new mongoose.Schema({
    templateId: { type: mongoose.Schema.Types.ObjectId, ref: 'BonusTemplate', required: true },
    referencePeriod: { type: String, required: true }, // e.g., "2023-Q1"
    status: {
        type: String,
        enum: ['draft', 'under_review', 'approved', 'paid', 'cancelled'],
        default: 'draft'
    },
    // Workflow step tracking
    wizardStep: {
        type: String,
        enum: ['adjust', 'confirm', 'export', 'completed'],
        default: 'adjust'
    },
    shareAmount: { type: Number }, //Share amount for the instance. It default value comes from the template.
    // Track shareAmount history
    shareAmountHistory: [{
        date: { type: Date, default: Date.now },
        previousAmount: { type: Number },
        newAmount: { type: Number },
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        userName: { type: String },
        reason: { type: String }
    }],
    // Tax configuration for this instance (copied from template and can be modified)
    taxName: { type: String, default: "Impôt sur le revenu" },
    taxPercentage: { type: Number, default: 5.28 }, // Default to 5.28%
    // Track tax configuration history
    taxConfigHistory: [{
        date: { type: Date, default: Date.now },
        previousName: { type: String },
        previousPercentage: { type: Number },
        newName: { type: String },
        newPercentage: { type: Number },
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        userName: { type: String },
        reason: { type: String }
    }],
    // Track recalculation status
    recalculationStatus: {
        inProgress: { type: Boolean, default: false },
        startedAt: { type: Date },
        completedAt: { type: Date },
        progress: { type: Number, default: 0 }, // Percentage of completion (0-100)
        totalAllocations: { type: Number, default: 0 },
        processedAllocations: { type: Number, default: 0 }
    },
    generationDate: { type: Date },
    approvalDate: { type: Date },
    paymentDate: { type: Date },
    customOverrides: { type: mongoose.Schema.Types.Mixed }, // Allows temporary rule modifications
    notes: { type: String },
    // Export history tracking
    exports: [{
        date: { type: Date, default: Date.now },
        type: { type: String, enum: ['Excel', 'PDF'] },
        user: { type: String },
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        fileSize: { type: String }
    }],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

//Define Models
let Instance = mongoose.model('BonusInstance', BonusInstanceSchema);

// Export Models
exports.BonusInstance = Instance;
