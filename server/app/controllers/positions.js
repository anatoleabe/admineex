var Position = require('../models/position').Position;
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
    structures: require('./structures')
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
    Position.findOneAndUpdate(filter, fields, {setDefaultsOnInsert: true, upsert: true, new : true}, function (err, result) {
        if (err) {
            log.error(err);
            audit.logEvent('[mongodb]', 'Position', 'Upsert', "", "", 'failed', "Mongodb attempted to update position");
            callback(err);
        } else {
            callback(null, result);
        }
    });
};

exports.api.upsert = function (req, res) {
    if (req.actor) {
        var form = new formidable.IncomingForm();
        form.parse(req, function (err, fields, files) {
            if (err) {
                log.error(err);
                audit.logEvent('[formidable]', 'Positions', 'Upsert', "", "", 'failed', "Formidable attempted to parse Position fields");
                return res.status(500).send(err);
            } else {
                var id = fields._id || '';
                var positionId = fields.positionId || '';

                var filter = {$and: []};
                if (id !== '') {
                    filter.$and.push({
                        "_id": id
                    });
                } else {
                    filter.$and.push({
                        "positionId": positionId
                    });
                }

                Position.findOne(filter, function (err, position) {
                    if (err) {
                        log.error(err);
                        audit.logEvent('[mongodb]', 'Positions', 'Upsert', "", "", 'failed', "Mongodb attempted to find a position");
                        callback(err);
                    } else {
                        if (position == null) {
                            fields.created = new Date();
                        }
                        fields.lastModified = new Date();
                        Position.findOneAndUpdate(filter, fields, {upsert: true, new : true}, function (err, result) {
                            if (err) {
                                log.error(err);
                                audit.logEvent('[mongodb]', 'Position', 'Upsert', "", "", 'failed', "Mongodb attempted to upsert a Position");
                                return res.status(500).send(err);
                            } else {
                                return res.status(200).send(result);
                            }
                        });

                    }
                });
            }
        });
    } else {
        audit.logEvent('[anonymous]', 'Positions', 'Upsert', '', '', 'failed', 'The actor was not authenticated');
        return res.sendStatus(401);
    }


};


exports.api.list = function (req, res) {
    if (req.actor) {
        var positions = dictionary.getJSONListByCode("../../resources/dictionary/structure/positions.json", req.actor.language.toLowerCase(), req.params.id);

        filter = {};
        if (req.params.id && req.params.id != "-1") {
            filter = {$and: []};
            filter.$and.push({
                "code": {'$regex': req.params.id + "-"}
            });
        }


        Position.find(filter, function (err, result) {
            if (err) {
                log.error(err);
                audit.logEvent('[mongodb]', 'Positions', 'List', '', '', 'failed', 'Mongodb attempted to retrieve positions list');
                return res.status(500).send(err);
            } else {
                var positions = JSON.parse(JSON.stringify(result));
                function LoopA(o) {
                    if (o < positions.length) {
                        //TODO compute real effective
                        positions[o].actualEffective = 0;
                        positions[o].vacancies = Number(positions[o].requiredEffective) - positions[o].actualEffective;
                        LoopA(o + 1);
                    } else {
                        beautify({actor: req.actor, language: req.actor.language, beautify: true}, positions, function (err, objects) {
                            if (err) {
                                return res.status(500).send(err);
                            } else {
                                return res.json(objects);
                            }
                        });
                    }
                }
                LoopA(0);
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
            var position = dictionary.getPositionFromIdJSON("../../resources/dictionary/structure/positions.json", req.params.id, req.actor.language.toLowerCase());
            exports.find(position.id, function (err, positiondetail) {
                if (err) {
                    audit.logEvent('[mongodb]', 'Positions', 'Read', "id", req.params.id, 'failed', "Mongodb attempted to find the position detail");
                    return res.status(500).send(err);
                } else {
                    if (positiondetail) {
                        position.details = positiondetail;
                    } else {
                        position.details = {
                            positionId: position.id,
                            requiredProfiles: [],
                            requiredSkills: [],
                            activities: [],
                            tasks: []
                        }
                    }
                    beautify({actor: req.actor, language: req.actor.language, beautify: true}, [position], function (err, objects) {
                        if (err) {
                            return res.status(500).send(err);
                        } else {
                            return res.json(objects[0]);
                        }
                    });
                }
            });
        }

    } else {
        audit.logEvent('[anonymous]', 'Projects', 'Read', '', '', 'failed', 'The actor was not authenticated');
        return res.send(401);
    }
}

exports.initialize = function (callback) {
    var initialize = controllers.configuration.getConf().initialize;

    if (initialize.positions == "0") {
        var positions = dictionary.getJSONList("../../resources/dictionary/structure/positions.json", "en");
        var avoidedPositionsCode = [];
        function loopA(a) {
            if (a < positions.length) {
                var fields = {
                    identifier: positions[a].id,
                    code: positions[a].code,
                    en: positions[a].en,
                    fr: positions[a].fr,
                    rank: positions[a].rank,
                    requiredEffective: positions[a].requiredEffective,
                    type: positions[a].type,
                    activities: positions[a].activities | [],
                    tasks: positions[a].tasks | [],
                    lastModified: new Date(),
                    created: new Date()
                }
                exports.findPositionByCode(positions[a].code, function (err, position) {
                    if (err) {
                        log.error(err);
                        callback(err);
                    } else {
                        if (position != null) {// If this position already exist
                            avoidedPositionsCode.push(positions[a].code);
                            loopA(a + 1);
                        } else {
                            exports.upsert(fields, function (err) {
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
                nconf.set("initialize:positions", "1");
                nconf.save(function (err) {
                    if (err) {
                        log.error(err);
                        audit.logEvent('[nconf]', 'Position', 'Update', "", "", 'failed', "nconf attempted to save configuration");
                    } else {
                        callback(null, avoidedPositionsCode);
                    }
                });
            }
        }
        loopA(0);
    }
}

exports.findPositionByCode = function (code, callback) {
    Position.findOne({
        code: code
    }).lean().exec(function (err, position) {
        if (err) {
            log.error(err);
            callback(err);
        } else {
            if (position != null) {
                callback(null, position);
            } else {
                callback(null);
            }
        }
    });
}

exports.findPositionsByStructureCode = function (code, callback) {
    Position.find({
        code: {'$regex': code + "-"}
    }).lean().exec(function (err, positions) {
        if (err) {
            log.error(err);
            callback(err);
        } else {
            if (positions != null) {
                callback(null, positions);
            } else {
                callback(null);
            }
        }
    });
}

exports.find = function (positionId, callback) {
    Position.findOne({
        positionId: positionId
    }).lean().exec(function (err, positionDetails) {
        if (err) {
            log.error(err);
            callback(err);
        } else {
            if (positionDetails != null) {
                callback(null, positionDetails);
            } else {
                callback(null, positionDetails);
            }
        }
    });
};


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
                objects[o].name = ((language && language !== "" && objects[o][language] != undefined && objects[o][language] != "") ? objects[o][language] : objects[o]['en']);
                controllers.structures.findStructureByCode(objects[o].code.substring(0, objects[o].code.indexOf('-')), language, function (err, structure) {
                    if (err) {
                        log.error(err);
                        callback(err);
                    } else {
                        objects[o].structure = structure;
                        objectsLoop(o + 1);
                    }
                });
            } else {
                callback(null, objects);
            }
        }
        objectsLoop(0);
    } else {
        callback(null, objects);
    }
}