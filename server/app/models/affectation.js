var mongoose = require('mongoose');

var Schema = mongoose.Schema;
var ObjectId = mongoose.Schema.Types.ObjectId;

// Affectation schema
var AffectationSchema = new Schema({
    positionId: {type: ObjectId, required: true},
    oldPositionId: {type: ObjectId, ref: 'Position', required: false},
    positionCode: {type: String, required: false},
    personnelId: {type: Schema.ObjectId, ref: 'Personnel', required: true}, //Personnel id
    actor: {type: Schema.ObjectId, ref: 'User', required: true}, //User ID
    interim: {type: Boolean, required: false, default: false},
    date: Date, //Start date
    numAct: String,
    signatureDate: Date,
    startDate: Date,
    endDate: Date,
    mouvement: String, //Id from json resources json mouvement
    nature: String, //Id from json resources json act nature
    creation: {type: Date, default: Date.now, required: true},
    lastModified: {type: Date, default: Date.now, required: true},
});

//Define Models
var Affectation = mongoose.model('Affectation', AffectationSchema);

// Export Models
exports.Affectation = Affectation;

