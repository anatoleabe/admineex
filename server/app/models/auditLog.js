var mongoose = require('mongoose');

var AuditLogSchema = new mongoose.Schema({
    actor: {type:String},
    date: {type:Date},
    origin: {type:String},
    action: {type:String},
    label: {type:String},
    object: {type:String},
    status: {type:String},
    description: {type:String}
});

var AuditLog = mongoose.model('AuditLog', AuditLogSchema);

exports.AuditLog = AuditLog;