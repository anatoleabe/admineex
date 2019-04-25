var Project = require('../models/project').Project;
var audit = require('../utils/audit-log');
var log = require('../utils/log');
var mail = require('../utils/mail');
var _ = require('lodash');
var crypto = require('crypto');
var dictionary = require('../utils/dictionary');
var formidable = require("formidable");

// API
exports.api = {};

var controllers = {
    configuration: require('./configuration'),
    users: require('./users'),
};

exports.api.upsert = function (req, res) {

};


exports.api.list = function (req, res) {
    if (req.actor) {
        var structures = dictionary.getJSONList("../../resources/dictionary/structure/structures.json", req.actor.language);
        beautify({actor: req.actor, language: req.actor.language, beautify: true}, structures, function (err, objects) {
            if (err) {
                return res.status(500).send(err);
            } else {
                return res.json(objects);
            }
        });
    } else {
        audit.logEvent('[anonymous]', 'Projects', 'List', '', '', 'failed', 'The actor was not authenticated');
        return res.send(401);
    }
}

exports.api.read = function (req, res) {
    if (req.actor) {

    } else {
        audit.logEvent('[anonymous]', 'Projects', 'Read', '', '', 'failed', 'The actor was not authenticated');
        return res.send(401);
    }
}


exports.api.delete = function (req, res) {
    if (req.actor) {

    } else {
        audit.logEvent('[anonymous]', 'Projects', 'Delete', '', '', 'failed', 'The actor was not authenticated');
        return res.send(401);
    }
}


function beautify(options, objects, callback) {
    var language = options.language || "";
    language = language.toLowerCase();
    var gt = dictionary.translator(language);
    if (options.beautify && options.beautify === true) {
        function objectsLoop(o) {
            if (o < objects.length) {
                objects[o].typeValue= dictionary.getValueFromJSON('../../resources/dictionary/structure/types.json', objects[o].type, language);
                objects[o].rankValue= dictionary.getValueFromJSON('../../resources/dictionary/structure/ranks.json', objects[o].rank, language);
                objectsLoop(o+1);
            }else{
                callback(null, objects);
            }
        }
        objectsLoop(0);
    } else {
        callback(null, objects);
    }
}