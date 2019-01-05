var AuditLog        = require('../models/auditLog').AuditLog;
var audit           = require('../utils/audit-log');
var log             = require('../utils/log');
var moment          = require('moment');

// Controllers
var controllers = {
    users: require('./users')
};


// API
exports.api = {};

// Retrieve audit logs with a specified daterange
exports.api.listByDate = function(req, res) {
    if(req.actor){
        if(req.params.from !== undefined && req.params.to !== undefined){
            AuditLog.find({
                date: {
                    $gte: moment(new Date(req.params.from)).startOf('day'),
                    $lte: moment(new Date(req.params.to)).endOf('day')
                }
            }).sort({"date" : 1}).exec(function(err, logs) {
                if (err){
                    audit.logEvent('[mongodb]', 'Audit', 'List by date', '', '', 'failed', 'Mongodb attempted to retrieve logs');
                    log.error(err);
                    return res.status(500).send(err);
                } else {
                    function loopA(a) {
                        if(a < logs.length) {
                            if(logs[a].actor && logs[a].actor.substr(0,1) !== "["){
                                controllers.users.getUser({id: logs[a].actor}, "1", function(err, user){
                                    if(user != null){
                                       logs[a].actor = user.firstname + " " + user.lastname.toUpperCase();
                                    }
                                    loopA(a+1);
                                });
                            } else {
                                loopA(a+1);
                            }
                        } else {
                            return res.json(logs);
                        }
                    }
                    loopA(0);
                }
            });
        } else {
            audit.logEvent(req.actor.id, 'Audit', 'List by date', '', '', 'failed',
                           'The user could not retrieve audit logs because one or more params of the request is not defined');
            return res.sendStatus(400);
        }
    } else {
        audit.logEvent('[anonymous]', 'Audit', 'List by date', '', '', 'failed','The user was not authenticated');
        return res.sendStatus(401);
    }
}
