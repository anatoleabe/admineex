var mongoose        = require('mongoose');

var Schema = mongoose.Schema;
var ObjectId = mongoose.Schema.Types.ObjectId;

// Position schema
var PositionSchema = new Schema({
    code: { type: String, required: true },
    en: { type: String, required: true },
    fr: { type: String, required: false },
    requiredEffective: { type: String, required: false },
    requiredProfiles: [],//Code of existing profiles taken from a global lists
    requiredSkills: [],
    activities: [],//Code of existing profiles taken from a global lists
    tasks: [],
    lastModified: { type: Date, default: Date.now, required: true },
    created: { type: Date, default: Date.now, required: true }
});

//Define Models
var Position = mongoose.model('Position', PositionSchema);

// Export Models
exports.Position = Position;
