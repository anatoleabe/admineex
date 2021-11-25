var mongoose = require('mongoose');

var Schema = mongoose.Schema;
var ObjectId = mongoose.Schema.Types.ObjectId;

// Sanction schema
var SanctionSchema = new Schema({
    positionId: {type: ObjectId, ref: 'Position', required: true},
    positionCode: {type: String, required: false},
    personnelId: {type: Schema.ObjectId, ref: 'Personnel', required: true}, //Personnel id
    actor: {type: Schema.ObjectId, ref: 'User', required: true}, //User ID
    referenceNumber: String,
    dateofSignature: {type: Date, required: true},
    nature: String, //Id from json resources json natures
    type: String, //Id from json resources json sanctions types
    sanction: String, //Id from json resources json sanctions 
    duration: String, //Id from json resources json durations
    period: String, //Id from json resources json periods
    quantity: String, 
    comment: String, 
    creation: {type: Date, default: Date.now, required: true},
    lastModified: {type: Date, default: Date.now, required: true},
});

//Define Models
var Sanction = mongoose.model('Sanction', SanctionSchema);

// Export Models
exports.Sanction = Sanction;

