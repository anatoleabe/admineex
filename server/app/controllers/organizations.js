var Organization    = require('../models/organization').Organization;
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
                audit.logEvent('[formidable]', 'Organizations', 'Upsert', "", "", 'failed', "Formidable attempted to parse organization fields");
                return res.status(500).send(err);
            } else {
                exports.upsert({actor: req.actor}, fields, function(err) {
                    if(err){
                        log.error(err);
                        return res.status(500).send(err);
                    } else {
                        res.sendStatus(200);
                    }
                });
            }
        });
    } else {
        audit.logEvent('[anonymous]', 'Organizations', 'Upsert', '', '', 'failed', 'The actor was not authenticated');
        return res.sendStatus(401);
    }
};


exports.api.list = function(req, res) {
    if(req.actor){
        Organization.find({}, function (err, organizations) {
            if (err) {
                log.error(err);
                audit.logEvent('[mongodb]', 'Organizations', 'List', '', '', 'failed', 'Mongodb attempted to retrieve organizations list');
                return res.status(500).send(err);
            } else {
                return res.json(organizations);
            }
        });
    } else {
        audit.logEvent('[anonymous]', 'Organizations', 'List', '', '', 'failed','The actor was not authenticated');
        return res.send(401);
    }
}

exports.api.read = function(req, res) {
    if(req.actor){
        Organization.findOne({
            _id: req.params.id
        }).exec(function (err, organization) {
            if (err) {
                log.error(err);
                audit.logEvent('[mongodb]', 'Organizations', 'Read', "ID", req.params.id, 'failed', "Mongodb attempted to find the organization");
                return res.status(500).send(err);
            } else {
                if (organization === null) {
                    audit.logEvent('[mongodb]', 'Organizations', 'Read', 'ID', req.params.id, 'failed',
                                   'Mongodb attempted to find the organization but it revealed not defined');
                    return res.sendStatus(403);
                } else {
                    return res.json(organization);
                }
            }
        });
    } else {
        audit.logEvent('[anonymous]', 'Organizations', 'Read', '', '', 'failed','The actor was not authenticated');
        return res.send(401);
    }
}


exports.api.delete = function(req, res) {
    if(req.actor){
        if(req.params.id == undefined){
            audit.logEvent(req.actor.id, 'Organizations', 'Delete', '', '', 'failed', 'The actor could not delete an organization because one or more params of the request was not defined');
            return res.sendStatus(400);
        } else {
            Organization.remove({_id : req.params.id}, function(err){
                if (err) {
                    log.error(err);
                    return res.status(500).send(err);
                } else {
                    audit.logEvent(req.actor.id, 'Organizations', 'Delete', "ID", req.params.id, 'succeed',
                                   'The actor has successfully deleted an organization');
                    return res.sendStatus(200);
                }
            });
        }
    } else {
        audit.logEvent('[anonymous]', 'Organizations', 'Delete', '', '', 'failed', 'The actor was not authenticated');
        return res.send(401);
    }
}

exports.upsert = function(options, fields, callback){
    var name = fields.name || '';
    var type = fields.type || '';
    if (name === '' || type === '') {
        audit.logEvent(options.actor.id, 'Organizations', 'Upsert', 'name', name,
                       'The actor could not create a new organization because one or more parameters of the request was not correct');
        return callback(400);
    } else {
        var filter = fields._id ? {_id: fields._id} : {name: fields.name, type: fields.type};
        fields.lastModified = new Date();
        fields.authorID = options.actor.id;
        Organization.findOneAndUpdate(filter, fields, {upsert:true, setDefaultsOnInsert: true}, function (err){
            if (err) {
                log.error(err);
                audit.logEvent('[mongodb]', 'Organizations', 'Upsert', "name", name, 'failed', "Mongodb attempted to save the new organization");
                return callback(err);
            } else {
                return callback(null);
            }
        });
    }
}

exports.getOrganization = function(organization, callback){
    Organization.findOne({
        _id: organization.id
    }).exec(function (err, organization) {
        if (err) {
            log.error(err);
            callback(err)
        } else {
            callback(null, organization);
        }
    });
}