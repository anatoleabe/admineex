var mongoose        = require('mongoose');

var Schema = mongoose.Schema;
var ObjectId = mongoose.Schema.Types.ObjectId;

// Position schema
var PositionSchema = new Schema({
    structureId: { type: ObjectId, required: true },
    code: { type: String, required: true },
    order: { type: String, required: false },//This order is used to sort positions in list
    comesAfter: { type: String, required: false },//This indicate the order of the current position in list *
    en: { type: String, required: true },
    fr: { type: String, required: false },
    requiredProfiles: [],//Code of existing profiles taken from a global lists
    requiredSkills: [],//Code of existing profiles taken from a global lists
    activities: [],
    tasks: [],
    realisationRequired:Number,//Nombre de dossiers à traiter (Trimestriel)
    off: { type: Boolean, default: false},//Hors organigramme
    lastModified: { type: Date, default: Date.now, required: true },
    created: { type: Date, default: Date.now, required: true }
});

//Define Models
var Position = mongoose.model('Position', PositionSchema);

// Export Models
exports.Position = Position;
