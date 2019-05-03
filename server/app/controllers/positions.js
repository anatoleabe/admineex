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
        var positions = dictionary.getJSONListByCode("../../resources/dictionary/structure/positions.json", req.actor.language.toLowerCase(), req.params.id);
        beautify({actor: req.actor, language: req.actor.language, beautify: true}, positions, function (err, objects) {
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
        if (req.params.id === undefined) {
            audit.logEvent(req.actor.id, 'Position', 'Read', '', '', 'failed',
                    'The actor could not read the position because one or more params of the request was not defined');
            return res.sendStatus(400);
        } else {
            console.log("Read " + req.params.id);
            var position = dictionary.getPositionFromIdJSON("../../resources/dictionary/structure/positions.json", req.params.id, req.actor.language.toLowerCase());
            beautify({actor: req.actor, language: req.actor.language, beautify: true}, [position], function (err, objects) {
                if (err) {
                    return res.status(500).send(err);
                } else {
                    console.log(objects);
                    return res.json(objects[0]);
                }
            });
        }

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
                objects[o].structure = dictionary.getStructureFromJSONByCode('../../resources/dictionary/structure/structures.json', objects[o].code.substring(0, objects[o].code.indexOf('-')), language.toLowerCase());
                objectsLoop(o + 1);
            } else {
                callback(null, objects);
            }
        }
        objectsLoop(0);
    } else {
        callback(null, objects);
    }
}