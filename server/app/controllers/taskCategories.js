var TaskCategory    = require('../models/taskCategory').TaskCategory;
var audit           = require('../utils/audit-log');
var log             = require('../utils/log');
var mail            = require('../utils/mail');
var crypto          = require('crypto');
var formidable      = require("formidable");

// API
exports.api = {};

var controllers     = {
    configuration: require('./configuration')
};

exports.api.upsert = function(req, res) {
    if(req.actor){
        var form = new formidable.IncomingForm();
        form.parse(req, function(err, fields, files) {
            if(err){
                log.error(err);
                audit.logEvent('[formidable]', 'Categories', 'Upsert', "", "", 'failed', "Formidable attempted to parse taskCategory fields");
                return res.status(500).send(err);
            } else {
                exports.upsert({actor: req.actor}, fields, function(err) {
                    if(err){
                        console.log(err)
                        log.error(err);
                        return res.status(500).send(err);
                    } else {
                        res.sendStatus(200);
                    }
                });
            }
        });
    } else {
        audit.logEvent('[anonymous]', 'Categories', 'Upsert', '', '', 'failed', 'The actor was not authenticated');
        return res.sendStatus(401);
    }
};


exports.api.list = function(req, res) {
    if(req.actor){
        TaskCategory.find({}, function (err, categories) {
            if (err) {
                log.error(err);
                audit.logEvent('[mongodb]', 'Categories', 'List', '', '', 'failed', 'Mongodb attempted to retrieve categories list');
                return res.status(500).send(err);
            } else {
                return res.json(categories);
            }
        });
    } else {
        audit.logEvent('[anonymous]', 'Categories', 'List', '', '', 'failed','The actor was not authenticated');
        return res.send(401);
    }
}

exports.api.read = function(req, res) {
    if(req.actor){
        TaskCategory.findOne({
            _id: req.params.id
        }).exec(function (err, taskCategory) {
            if (err) {
                log.error(err);
                audit.logEvent('[mongodb]', 'Categories', 'Read', "ID", req.params.id, 'failed', "Mongodb attempted to find the taskCategory");
                return res.status(500).send(err);
            } else {
                if (taskCategory === null) {
                    audit.logEvent('[mongodb]', 'Categories', 'Read', 'ID', req.params.id, 'failed',
                                   'Mongodb attempted to find the taskCategory but it revealed not defined');
                    return res.sendStatus(403);
                } else {
                    return res.json(taskCategory);
                }
            }
        });
    } else {
        audit.logEvent('[anonymous]', 'Categories', 'Read', '', '', 'failed','The actor was not authenticated');
        return res.send(401);
    }
}


exports.api.delete = function(req, res) {
    if(req.actor){
        if(req.params.id == undefined){
            audit.logEvent(req.actor.id, 'Categories', 'Delete', '', '', 'failed', 'The actor could not delete an taskCategory because one or more params of the request was not defined');
            return res.sendStatus(400);
        } else {
            TaskCategory.remove({_id : req.params.id}, function(err){
                if (err) {
                    log.error(err);
                    return res.status(500).send(err);
                } else {
                    audit.logEvent(req.actor.id, 'Categories', 'Delete', "ID", req.params.id, 'succeed',
                                   'The actor has successfully deleted an taskCategory');
                    return res.sendStatus(200);
                }
            });
        }
    } else {
        audit.logEvent('[anonymous]', 'Categories', 'Delete', '', '', 'failed', 'The actor was not authenticated');
        return res.send(401);
    }
}

exports.upsert = function(options, fields, callback){
    var name = fields.name || '';
    var color = fields.color || '';
    if (name === '' || color === '') {
        audit.logEvent(options.actor.id, 'Categories', 'Upsert', 'name', name,
                       'The actor could not create a new taskCategory because one or more parameters of the request was not correct');
        return callback(400);
    } else {
        var filter = fields._id ? {_id: fields._id} : {name: fields.name, color: fields.color};
        fields.lastModified = new Date();
        fields.authorID = options.actor.id;
        TaskCategory.findOneAndUpdate(filter, fields, {upsert:true, setDefaultsOnInsert: true}, function (err){
            if (err) {
                log.error(err);
                audit.logEvent('[mongodb]', 'Categories', 'Upsert', "name", name, 'failed', "Mongodb attempted to save the new taskCategory");
                return callback(err);
            } else {
                return callback(null);
            }
        });
    }
}

exports.getOrganization = function(taskCategory, callback){
    TaskCategory.findOne({
        _id: taskCategory.id
    }).exec(function (err, taskCategory) {
        if (err) {
            log.error(err);
            callback(err)
        } else {
            callback(null, taskCategory);
        }
    });
}