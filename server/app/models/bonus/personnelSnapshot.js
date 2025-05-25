const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const PersonnelSnapshotSchema = new Schema({
    personnelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Personnel', required: true },
    snapshotDate: { type: Date, required: true },
    data: {
        grade: { type: String },
        category: { type: String },
        rank: { type: String },
        index: { type: String },
        status: { type: String },
        salary: { type: Number },
        position: {
            id: { type: mongoose.Schema.Types.ObjectId },
            code: { type: String },
            rank: { type: String }
        },
        sanctions: [{
            type: { type: String },
            startDate: { type: Date },
            endDate: { type: Date }
        }]
    },
    createdAt: { type: Date, default: Date.now }
});

// Index for quick retrieval
PersonnelSnapshotSchema.index({ personnelId: 1, snapshotDate: 1 });

// Fix: check if model already exists
const PersonnelSnapshot = mongoose.models.PersonnelSnapshot || mongoose.model('PersonnelSnapshot', PersonnelSnapshotSchema);

// Export
exports.PersonnelSnapshot = PersonnelSnapshot;
