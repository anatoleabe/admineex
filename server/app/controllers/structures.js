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
    positions: require('./positions')
};


exports.api.upsert = function (req, res) {
    if (req.actor) {
        var form = new formidable.IncomingForm();
        form.parse(req, function (err, fields, files) {
            if (err) {
                log.error(err);
                audit.logEvent('[formidable]', 'Structures', 'Upsert', "", "", 'failed', "Formidable attempted to parse structure fields");
                return res.status(500).send(err);
            } else {
                exports.upsert(fields, function (err) {
                    if (err) {
                        log.error(err);
                        return res.status(500).send(err);
                    } else {
                        res.sendStatus(200);
                    }
                });
            }
        });
    } else {
        audit.logEvent('[anonymous]', 'Structures', 'Upsert', '', '', 'failed', 'The actor was not authenticated');
        return res.sendStatus(401);
    }
};

exports.upsert = function (fields, callback) {
    // Parse received fields
    var id = fields._id || '';
    var code = fields.code || '';

    var filter = {$and: []};
    if (id !== '') {
        filter.$and.push({
            "_id": id
        });
    } else if (code !== '') {
        filter.$and.push({
            "code": code
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
        var language = req.actor.language.toLowerCase();
        filter = {$and: []};
        if (req.params.code) {
            filter.$and.push({
                "code": req.params.code
            });
        }

        Structure.find({}, function (err, result) {
            if (err) {
                log.error(err);
                audit.logEvent('[mongodb]', 'Structures', 'List', '', '', 'failed', 'Mongodb attempted to retrieve structures list');
                return res.status(500).send(err);
            } else {
                var structures = JSON.parse(JSON.stringify(result));
                function loopA(a) {
                    if (a < structures.length) {
                        structures[a].name = ((language && language !== "" && structures[a][language] != undefined && structures[a][language] != "") ? structures[a][language] : structures[a]['en']);
                        controllers.positions.findPositionsByStructureCode(structures[a].code, function (err, positions) {
                            if (err) {
                                return res.status(500).send(err);
                            } else {
                                if (positions) {
                                    structures[a].workstationsNb = positions.length;
                                } else {
                                    structures[a].workstationsNb = 0;
                                }

                                var requiredEffective = 0;

                                function LoopB(b) {
                                    if (b < positions.length) {

                                        //TODO compute real effective
                                        requiredEffective += Number(positions[b].requiredEffective);

                                        LoopB(b + 1);
                                    } else {
                                        controllers.positions.findHelderPositionsByStructureCode(structures[a].code, function (err, affectations) {
                                            if (err) {
                                                audit.logEvent('[mongodb]', 'Positions', 'findHelderPositionsByStructureCode', "code", req.params.code, 'failed', "Mongodb attempted to find the affection detail");
                                                return res.status(500).send(err);
                                            } else {
                                                console.log(affectations);
                                                if (affectations && affectations.length > 0) {
                                                    structures[a].actualEffective = affectations.length;
                                                } else {
                                                    structures[a].actualEffective = 0;
                                                }
                                                structures[a].requiredEffective = requiredEffective;
                                                structures[a].vacancies = requiredEffective - structures[a].actualEffective;
                                                loopA(a + 1);
                                            }
                                        });
                                    }
                                }
                                LoopB(0);
                            }
                        });

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
            }
        });
    } else {
        audit.logEvent('[anonymous]', 'Structures', 'List', '', '', 'failed', 'The actor was not authenticated');
        return res.sendStatus(401);
    }
}

exports.api.read = function (req, res) {
    if (req.actor) {
        if (req.params.id === undefined) {
            audit.logEvent(req.actor.id, 'Structure', 'Read', '', '', 'failed',
                    'The actor could not read the structure because one or more params of the request was not defined');
            return res.sendStatus(400);
        } else {
            filter = {_id: req.params.id};
            exports.read({actor: req.actor, language: req.actor.language, beautify: true}, req.params.id, function (err, structure) {
                if (err) {
                    audit.logEvent('[mongodb]', 'Structure', 'Read', "id", req.params.id, 'failed', "Mongodb attempted to find the structure");
                    return res.status(500).send(err);
                } else {
                    return res.json(structure);
                }
            });
        }
    } else {
        audit.logEvent('[anonymous]', 'Structure', 'Read', '', '', 'failed', 'The actor was not authenticated');
        return res.sendStatus(401);
    }
}

exports.read = function (options, id, callback) {
    Structure.findOne({
        _id: id
    }).lean().exec(function (err, structure) {
        if (err) {
            log.error(err);
            callback(err);
        } else {
            if (structure != null) {
                if (options && options.beautify) {
                    beautify(options, [structure], function (err, objects) {
                        if (err) {
                            callback(err);
                        } else {
                            callback(null, objects[0]);
                        }
                    });
                } else {
                    callback(null, structure);
                }
            } else {
                callback(null);
            }
        }
    });
};


exports.api.delete = function (req, res) {
    if (req.actor) {

    } else {
        audit.logEvent('[anonymous]', 'Structures', 'Delete', '', '', 'failed', 'The actor was not authenticated');
        return res.sendStatus(401);
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
                exports.findStructureByCode(structures[a].code, "en", function (err, structure) {
                    if (err) {
                        log.error(err);
                        callback(err);
                    } else {
                        if (structure != null) {// If this structure already exist
                            avoidedStructuresCode.push(structures[a].code);
                            loopA(a + 1);
                        } else {
                            exports.upsert(fields, function (err, structure) {
                                if (err) {
                                    log.error(err);
                                } else {
                                    loopA(a + 1);
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

exports.findStructureByCode = function (code, language, callback) {
    Structure.findOne({
        code: code
    }).lean().exec(function (err, result) {
        if (err) {
            log.error(err);
            callback(err);
        } else {
            var structure = JSON.parse(JSON.stringify(result));

            if (structure != null) {
                structure.name = ((language && language !== "" && structure[language] != undefined && structure[language] != "") ? structure[language] : structure['en']);
                callback(null, structure);
            } else {
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