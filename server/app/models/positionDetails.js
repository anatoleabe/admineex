var mongoose        = require('mongoose');

var Schema = mongoose.Schema;
var ObjectId = mongoose.Schema.Types.ObjectId;

// Position schema
var PositionSchema = new Schema({
    positionId: { type: String, required: true },//From json resource
    requiredProfiles: [{}],//Code of existing profiles taken from a global lists
    requiredSkills: [{}],
    lastModified: { type: Date, default: Date.now, required: true },
    created: { type: Date, default: Date.now, required: true }
});

//Define Models
var Position = mongoose.model('Position', PositionSchema);

// Export Models
exports.Position = Position;
