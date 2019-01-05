var mongoose = require('mongoose');

var logSchema = new mongoose.Schema({
    severity: {type:String},
    date: {type:Date},
    file: {type:String},
    line: {type:Number},
    message: {type:String}
});

var Log = mongoose.model('Log', logSchema);

exports.Log = Log;