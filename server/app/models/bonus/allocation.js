const mongoose = require('mongoose');

// Bonus Allocation schema
const BonusAllocationSchema = new mongoose.Schema({
    instanceId: { type: mongoose.Schema.Types.ObjectId, ref: 'BonusInstance', required: true },
    personnelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Personnel', required: true },
    personnelSnapshotId: { type: mongoose.Schema.Types.ObjectId, ref: 'PersonnelSnapshot', required: true },
    templateId: { type: mongoose.Schema.Types.ObjectId, ref: 'BonusTemplate', required: true },

    // Calculation inputs (preserved)
    calculationInputs: {
        baseSalary: { type: Number },
        category: { type: String },
        grade: { type: String },
        status: { type: String },
        rank: { type: String },
        parts: { type: Number },
        adjustmentFactors: { type: mongoose.Schema.Types.Mixed }
    },

    // Calculation results
    calculatedAmount: { type: Number },
    finalAmount: { type: Number },

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

