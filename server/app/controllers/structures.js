var Structure = require('../models/structure').Structure;
var nconf = require('nconf');
nconf.file("config/server.json");
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

exports.upsert = function (fields, callback) {
    // Parse received fields
    var id = fields._id || '';
    var identifier = fields.identifier || '';

    var filter = {$and: []};
    if (id !== '') {
        filter.$and.push({
            "_id": id
        });
    } else if (identifier !== '') {
        filter.$and.push({
            "identifier": identifier
        });
    } else {
        filter = fields;
    }

    fields.lastModified = new Date();
    Structure.findOneAndUpdate(filter, fields, {setDefaultsOnInsert: true, upsert: true, new : true}, function (err, result) {
        if (err) {
            log.error(err);
            audit.logEvent('[mongodb]', 'Structure', 'Upsert', "", "", 'failed', "Mongodb attempted to update a structure");
            callback(err);
        } else {
            callback(null, result);
        }
    });
};


exports.api.list = function (req, res) {
    if (req.actor) {
        var structures = dictionary.getJSONList("../../resources/dictionary/structure/structures.json", req.actor.language);

        function loopA(a) {
            if (a < structures.length) {
                var positions = dictionary.getJSONListByCode("../../resources/dictionary/structure/positions.json", req.actor.language.toLowerCase(), structures[a].code);
                structures[a].workstationsNb = positions.length;
                var requiredEffective = 0;
                var actualEffective = 0;

                function LoopB(b) {
                    if (b < positions.length) {
                        //TODO compute real effective
                        requiredEffective += positions[b].requiredEffective;
                        LoopB(b + 1);
                    } else {
                        structures[a].requiredEffective = requiredEffective;
                        structures[a].actualEffective = actualEffective;
                        structures[a].vacancies = requiredEffective - actualEffective;
                        loopA(a + 1);
                    }
                }
                LoopB(0)
            } else {
                beautify({actor: req.actor, language: req.actor.language, beautify: true}, structures, function (err, objects) {
                    if (err) {
                        return res.status(500).send(err);
                    } else {
                        return res.json(objects);
                    }
                });
            }
        }
        loopA(0);
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

exports.initialize = function (callback) {
    var initialize = controllers.configuration.getConf().initialize;
    
    if (initialize.structures == "0") {
        var structures = dictionary.getJSONList("../../resources/dictionary/structure/structures.json", "en");
        var avoidedStructuresCode = [];
        function loopA(a) {
            if (a < structures.length) {
                var fields = {
                    identifier: structures[a].id,
                    code: structures[a].code,
                    en: structures[a].en,
                    fr: structures[a].fr,
                    fatherIdentifier: structures[a].father,
                    rank: structures[a].rank,
                    type: structures[a].type,
                    activities: structures[a].activities | [],
                    tasks: structures[a].tasks | [],
                    lastModified: new Date(),
                    created: new Date()
                }
                exports.findStructureByCode(structures[a].code, function (err, structure) {
                    if (err) {
                        log.error(err);
                        callback(err);
                    } else {
                        if (structure != null) {// If this structure already exist
                            avoidedStructuresCode.push(structures[a].code);
                            loopA(a+1);
                        } else {
                            exports.upsert(fields, function (err, contact) {
                                if (err) {
                                    log.error(err);
                                } else {
                                    loopA(a+1);
                                }
                            });
                        }
                    }
                });

            } else {
                nconf.set("initialize:structures", "1");
                nconf.save(function (err) {
                    if (err) {
                        log.error(err);
                        audit.logEvent('[nconf]', 'Configuration', 'Update', "", "", 'failed', "nconf attempted to save configuration");
                    } else {
                        callback(null, avoidedStructuresCode);
                    }
                });
            }
        }
        loopA(0);
    }
}

exports.findStructureByCode = function (code, callback) {
    Structure.findOne({
        code: code
    }).lean().exec(function (err, structure) {
        if (err) {
            log.error(err);
            callback(err);
        } else {
            if (structure != null) {
                callback(null, structure);
            }else{
                callback(null);
            }
        }
    });
}





function beautify(options, objects, callback) {
    var language = options.language || "";
    language = language.toLowerCase();
    var gt = dictionary.translator(language);
    if (options.beautify && options.beautify === true) {
        function objectsLoop(o) {
            if (o < objects.length) {
                objects[o].typeValue = dictionary.getValueFromJSON('../../resources/dictionary/structure/types.json', objects[o].type, language);
                objects[o].rankValue = dictionary.getValueFromJSON('../../resources/dictionary/structure/ranks.json', objects[o].rank, language);
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