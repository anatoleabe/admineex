const mongoose = require('mongoose');

// Bonus Allocation schema
const BonusAllocationSchema = new mongoose.Schema({
    instanceId: { type: mongoose.Schema.Types.ObjectId, ref: 'BonusInstance', required: true },
    personnelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Personnel', required: true },
    personnelSnapshotId: { type: mongoose.Schema.Types.ObjectId, ref: 'PersonnelSnapshot', required: true },
    templateId: { type: mongoose.Schema.Types.ObjectId, ref: 'BonusTemplate', required: true },

    // Added for frontend display
    beautifiedGrade: { type: String },

    // Calculation inputs (preserved)
    calculationInputs: {
        baseSalary: { type: Number },
        category: { type: String },
        grade: { type: String },
        status: { type: String },
        rank: { type: String },
        situationText: { type: String },
        sanctionText: { type: String },
        parts: { type: Number },
        situation: {},
        sanctions: [{}],
        comment: { type: String },
        adjustmentFactors: { type: mongoose.Schema.Types.Mixed },
        adjustmentHistory: [{
            timestamp: { type: Date, default: Date.now },
            user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
            userName: { type: String },
            reason: { type: String },
            previousAmount: { type: Number },
            newAmount: { type: Number },
            previousParts: { type: Number },
            newParts: { type: Number }
        }],
        // Extras for sans-part templates
        sbi: { type: Number },
        txPercent: { type: Number },
        index: { type: String },
        indiceCatDisplay: { type: String }
    },

    // Calculation results
    calculatedAmount: { type: Number },
    finalAmount: { type: Number },

    // Tax calculation fields
    grossAmount: { type: Number }, // Pre-tax amount
    taxAmount: { type: Number },   // Amount deducted for tax
    netAmount: { type: Number },   // Amount after tax deduction
    taxRate: { type: Number },     // Tax rate applied (stored as decimal, e.g., 0.0528)

    // Status and tracking
    status: {
        type: String,
        enum: ['eligible', 'excluded', 'adjusted', 'paid', 'cancelled'],
        default: 'eligible'
    },

    // Historical tracking
    version: { type: Number, default: 1 },
    previousVersion: { type: mongoose.Schema.Types.ObjectId, ref: 'BonusAllocation' },

    // Timestamps
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

//Define Models
const Allocation = mongoose.model('BonusAllocation', BonusAllocationSchema);

// Export Models
exports.BonusAllocation = Allocation;
