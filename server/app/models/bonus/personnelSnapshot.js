const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const PersonnelSnapshotSchema = new Schema({
    personnelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Personnel', required: true },
    snapshotDate: { type: Date, required: true },
    referencePeriod: { type: String },
    data: {
        grade: { type: String },
        category: { type: String },
        rank: { type: String },
        index: { type: String },
        status: { type: String },
        salary: { type: Number },
        situation: {
            situation: { type: String },
            date: { type: Date }
        },
        structure: {
            id: { type: mongoose.Schema.Types.ObjectId, ref: 'Structure' },
            identifier: { type: String },
            code: { type: String },
            name: { type: String }
        },
        subStructure: {
            id: { type: mongoose.Schema.Types.ObjectId, ref: 'Structure' },
            identifier: { type: String },
            code: { type: String },
            name: { type: String },
            parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Structure' },
            parentIdentifier: { type: String },
            parentCode: { type: String }
        },
        position: {
            id: { type: mongoose.Schema.Types.ObjectId, ref: 'Position' },
            code: { type: String },
            name: { type: String },
            structure: {
                id: { type: mongoose.Schema.Types.ObjectId, ref: 'Structure' },
                name: { type: String },
                code: { type: String },
            },
        },
        sanctions: [{
            type: { type: String },
            sanction: { type: String },
            startDate: { type: Date },
            endDate: { type: Date }
        }]
    },
    createdAt: { type: Date, default: Date.now }
});

// Index for quick retrieval
PersonnelSnapshotSchema.index({ personnelId: 1, snapshotDate: 1 });
PersonnelSnapshotSchema.index({ personnelId: 1, referencePeriod: 1 }, { unique: true, sparse: true });

// Fix: check if model already exists
const PersonnelSnapshot = mongoose.models.PersonnelSnapshot || mongoose.model('PersonnelSnapshot', PersonnelSnapshotSchema);

// Export
exports.PersonnelSnapshot = PersonnelSnapshot;
