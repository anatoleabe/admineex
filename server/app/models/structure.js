var mongoose = require('mongoose');

var Schema = mongoose.Schema;
var ObjectId = mongoose.Schema.Types.ObjectId;

// Structure schema
var StructureSchema = new Schema({
    identifier: {type: String, required: true},//Unique Id from json
    code: {type: String, required: true},
    en: {type: String, required: true},
    fr: {type: String, required: false},
    fatherIdentifier: {type: String, required: false},
    rank: {type: String, required: false},
    type: {type: String, required: false},
    activities: [],
    tasks: [],
    lastModified: {type: Date, default: Date.now, required: true},
    created: {type: Date, default: Date.now, required: true}
});

//Define Models
var Structure = mongoose.model('Structure', StructureSchema);

// Export Models
exports.Structure = Structure;
