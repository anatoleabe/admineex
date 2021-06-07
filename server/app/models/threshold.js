var mongoose = require('mongoose');

var Schema = mongoose.Schema;
var ObjectId = mongoose.Schema.Types.ObjectId;

/*
    Identifiers list :
    0: XXXXX
*/

var ThresholdSchema = new Schema({
    identifier : { type: String, required: true },
    values: [],
    state : {type: String},
    lastExecution: { type: Date },
    lastModified : { type: Date, default: Date.now }
}, {
    versionKey: false
});

var Threshold = mongoose.model('Threshold', ThresholdSchema);

exports.Threshold = Threshold;