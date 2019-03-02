var mongoose        = require('mongoose');

var Schema = mongoose.Schema;
var ObjectId = mongoose.Schema.Types.ObjectId;

// Structure schema
var StructureSchema = new Schema({
    identifier: { type: String, required: true },
    name: { type: String, required: true },
    code: { type: String, required: true },
    structureRootID: [{ type: ObjectId, required: true }],
    departement: { type: String, required: false },
    rank: { type: String, required: false },
    type: { type: String, required: false },
    lastModified: { type: Date, default: Date.now, required: true },
    created: { type: Date, default: Date.now, required: true }
});

//Define Models
var Structure = mongoose.model('Structure', StructureSchema);

// Export Models
exports.Structure = Structure;
