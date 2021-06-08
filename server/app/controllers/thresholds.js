var Threshold = require('../models/threshold').Threshold;
var audit = require('../../modules/audit-log');
var log = require('../utils/log');
var formidable = require('formidable');
var dictionary = require('../utils/dictionary');
var _ = require('underscore');
var mail = require('../utils/mail');
var moment = require('moment');

var controllers = {
    users: require('./users'),
    notifications: require('./notifications'),
    configuration: require('./configuration')
};

// API
exports.api = {};

exports.api.list = function (req, res) {
    if (req.actor) {
        Threshold.find({}, function (err, thresholds) {
            if (err) {
                log.error(err);
                audit.logEvent('[mongodb]', 'Thresholds', 'List', '', '', 'failed', 'Mongodb attempted to retrieve thresholds list');
                return res.status(500).send(err);
            } else {
                var server = controllers.configuration.getConf().server;
                return res.json({thresholds: thresholds, access: (server.notification != 0 && req.actor.role === "1")});
            }
        });
    } else {
        audit.logEvent('[anonymous]', 'Thresholds', 'List', '', '', 'failed', 'The actor was not authenticated');
        return res.sendStatus(401);
    }
};

exports.api.save = function (req, res) {
    if (req.actor) {
        var form = new formidable.IncomingForm();
        form.parse(req, function (err, fields, files) {
            if (err) {
                log.error(err);
                audit.logEvent('[formidable]', 'Thresholds', 'Save', "", "", 'failed', "Formidable attempted to parse fields");
                return res.status(500).send(err);
            } else {
                if (!fields.thresholds) {
                    audit.logEvent("[API]", 'Thresholds', 'Save', '', '', 'failed',
                            'The API could not save thresholds because one or more fields was empty');
                    return callback(null, 400);
                } else {
                    Threshold.remove({}, function (err) {
                        if (err) {
                            log.error(err);
                            audit.logEvent('[mongodb]', 'Thresholds', 'Save', "", "", 'failed', "Mongodb attempted to create thresholds");
                        } else {
                            Threshold.create(fields.thresholds, function (err) {
                                if (err) {
                                    log.error(err);
                                    audit.logEvent('[mongodb]', 'Thresholds', 'Save', "", "", 'failed', "Mongodb attempted to create thresholds");
                                } else {
                                    return res.sendStatus(200);
                                }
                            });
                        }
                    });
                }
            }
        });
    } else {
        audit.logEvent('[anonymous]', 'Thresholds', 'Save', '', '', 'failed', 'The actor was not authenticated');
        return res.sendStatus(401);
    }
};

//Get all retired staff
exports.read = function (id, callback) {
    if (id) {
       Threshold.findOne({identifier: id},{identifier:1, values:1}, function (err, threshold) {
            if (err) {
                log.error(err);
                audit.logEvent('[mongodb]', 'Thresholds', 'Read', '', '', 'failed', 'Mongodb attempted to retrieve one threshold');
                callback(err);
            } else {
                callback(null, threshold);
            }
        }); 
    } else {
        callback(null, null);
    }
}


function sum(numbers) {
    return _.reduce(numbers, function (result, qty) {
        return result + parseFloat(qty);
    }, 0);
}

function round(value, precision) {
    var multiplier = Math.pow(10, precision || 0);
    return Math.round(value * multiplier) / multiplier;
}

function calculateAge(birthDate) {
    var age = -1;
    if (birthDate) {
        var now = new Date().getYear();
        age = now - birthDate.getYear();
    }
    return age;
}
