var Position = require('../models/position').Position;
var Affectation = require('../models/affectation').Affectation;
var nconf = require('nconf');
nconf.file("config/server.json");
var audit = require('../utils/audit-log');
var log = require('../utils/log');
var mail = require('../utils/mail');
var _ = require('lodash');
var crypto = require('crypto');
var dictionary = require('../utils/dictionary');
var formidable = require("formidable");
var ObjectID = require('mongoose').mongo.ObjectID;

// API
exports.api = {};

var controllers = {
    configuration: require('./configuration'),
    structures: require('./structures'),
    personnel: require('./personnel')
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
            Position.findOneAndUpdate(filter, fields, {setDefaultsOnInsert: true, upsert: true, new : true}, function (err, result) {
                if (err) {
                    log.error(err);
                    audit.logEvent('[mongodb]', 'Position', 'Upsert', "", "", 'failed', "Mongodb attempted to upsert a Position");
                    callback(err);
                } else {
                    callback(null, result);
                }
            });
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
        audit.logEvent('[anonymous]', 'Positions', 'Upsert', '', '', 'failed', 'The actor was not authenticated');
        return res.sendStatus(401);
    }
};

exports.api.affectToPosition = function (req, res) {
    if (req.actor) {
        var form = new formidable.IncomingForm();
        form.parse(req, function (err, fields, files) {
            if (err) {
                log.error(err);
                audit.logEvent('[formidable]', 'Positions', 'affectation', "", "", 'failed', "Formidable attempted to parse affectation fields");
                return res.status(500).send(err);
            } else {
                var projection = {
                    _id: 1,
                    code: 1
                };
                Position.findOne({_id: fields.positionId}, projection, function (err, result) {
                    if (err) {
                        log.error(err);
                        return res.status(500).send(err);
                    } else {
                        // Parse received fields
                        var affectationFields = {
                            positionId: fields.positionId,
                            positionCode: result.code,
                            personnelId: fields.occupiedBy,
                            date: fields.startDate
                        };
                        var filter = {
                            positionId: fields.positionId,
                            positionCode: result.code,
                            personnelId: fields.occupiedBy
                        };
                        Affectation.findOneAndUpdate(filter, affectationFields, {setDefaultsOnInsert: true, upsert: true, new : true}, function (err, result) {
                            if (err) {
                                log.error(err);
                                audit.logEvent('[mongodb]', 'Position', 'affectToPosition', "", "", 'failed', "Mongodb attempted to affect to  a Position");
                                return res.status(500).send(err);
                            } else {
                                controllers.personnel.read({_id: affectationFields.personnelId}, function (err, perso) {
                                    if (err) {
                                        log.error(err);
                                        return res.status(500).send(err);
                                    } else {
                                        if (perso) {

                                            var history = {
                                                numAct: fields.numAct,
                                                positionId: new ObjectID(fields.positionId),
                                                isCurrent: fields.isCurrent,
                                                signatureDate: fields.signatureDate,
                                                startDate: fields.startDate,
                                                endDate: (fields.isCurrent && fields.isCurrent == "true") ? null : fields.endDate,
                                                mouvement: fields.mouvement,
                                                nature: fields.nature
                                            };
                                            if (!perso.history) {
                                                perso.history = {positions: []};
                                            }
                                            perso.history.positions.push(history);

                                            controllers.personnel.upsert(perso, function (err, structure) {
                                                if (err) {
                                                    log.error(err);
                                                } else {
                                                    res.sendStatus(200);
                                                }
                                            });
                                        } else {
                                            res.sendStatus(200);

                                        }
                                    }
                                });
                            }
                        });
                    }
                });
            }
        });
    } else {
        audit.logEvent('[anonymous]', 'Positions', 'affectToPosition', '', '', 'failed', 'The actor was not authenticated');
        return res.sendStatus(401);
    }
};

//This read data from json files (matricule and position code , then lint position and personnel in db
exports.affectToPositionFromJson = function (callback) {
    var affectations = dictionary.getToJSONList("../../resources/dictionary/tmp/usersposition.json");
    var avoided = [];
    var projection = {_id: 1};
    function loopA(a) {
        if (a < affectations.length) {
            var identifier = affectations[a].identifier.replace(/\s+/g, '');
            var codep = affectations[a].codeposte.replace(/\s+/g, '');
            Position.findOne({code: codep}, projection, function (err, post) {
                if (err) {
                    log.error(err);
                } else {
                    controllers.personnel.findByMatricule({matricule: identifier}, function (err, pers) {
                        if (err) {
                            log.error(err);
                        } else {
                            if (pers && post) {
                                var affectationFields = {
                                    positionId: post._id,
                                    positionCode: codep,
                                    personnelId: pers._id,
                                    date: new Date()
                                };

                                var filter = {
                                    positionId: post._id,
                                    positionCode: codep,
                                    personnelId: pers._id,
                                };

                                Affectation.findOneAndUpdate(filter, affectationFields, {setDefaultsOnInsert: true, upsert: true, new : true}, function (err, result) {
                                    if (err) {
                                        log.error(err);
                                    } else {
                                        loopA(a + 1);
                                    }
                                });
                            }else{
                                avoided.push(affectations[a]);
                                loopA(a + 1);
                            }
                        }
                    });
                }
            });
        } else {
            callback(null, avoided);
        }
    }
    loopA(0);
};


exports.api.findPositionByCode = function (req, res) {
    if (req.actor) {
        exports.findPositionByCode(req.params.code, function (err, position) {
            if (err) {
                audit.logEvent('[mongodb]', 'Positions', 'findPositionByCode', "code", req.params.code, 'failed', "Mongodb attempted to find the position detail");
                return res.status(500).send(err);
            } else {
                beautify({actor: req.actor, language: req.actor.language, beautify: true}, [position], function (err, objects) {
                    if (err) {
                        return res.status(500).send(err);
                    } else {
                        return res.json(objects[0]);
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
        var restriction = req.params.restric;
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
                var positionsFiltered = [];
                var cp = 10;
                function LoopA(o) {
                    if (o < positions.length) {
                        //TODO compute real effective
                        exports.findPositionHelder(positions[o].code, function (err, affectation) {
                            if (err) {
                                audit.logEvent('[mongodb]', 'Positions', 'findPositionHelder', "code", req.params.code, 'failed', "Mongodb attempted to find the affection detail");
                                return res.status(500).send(err);
                            } else {
                                if (affectation) {
                                    positions[o].actualEffective = 1;//We can also put the real effective in case we are using effective for position
                                } else {
                                    positions[o].actualEffective = 0;
                                }
                                positions[o].vacancies = Number(positions[o].requiredEffective) - positions[o].actualEffective;

                                if (restriction && restriction == "0" && positions[o].vacancies > 0) {
                                    positionsFiltered.push(positions[o]);
                                } else {
                                    positionsFiltered.push(positions[o]);
                                }
                                LoopA(o + 1);
                            }
                        });
                    } else {
                        beautify({actor: req.actor, language: req.actor.language, beautify: true}, positionsFiltered, function (err, objects) {
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
            exports.find(req.params.id, function (err, position) {
                if (err) {
                    audit.logEvent('[mongodb]', 'Positions', 'Read', "id", req.params.id, 'failed', "Mongodb attempted to find the position detail");
                    return res.status(500).send(err);
                } else {
                    var filter = {
                        positionId: position._id,
                        positionCode: position.code
                    };

                    exports.findPositionHelder(filter.positionCode, function (err, result) {
                        if (err) {
                            log.error(err);
                            audit.logEvent('[mongodb]', 'Position', 'read', "", "", 'failed', "Mongodb attempted to fiend position helder");
                            return res.status(500).send(err);
                        } else {
                            position.occupiedBy = result;

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

/**
 * Find the person who held a posisition
 * @param {type} code
 * @param {type} callback
 * @returns json
 */
exports.findPositionHelder = function (code, callback) {
    Affectation.findOne({
        positionCode: code
    }).lean().exec(function (err, affectation) {
        if (err) {
            log.error(err);
            callback(err);
        } else {
            if (affectation) {
                controllers.personnel.read({_id: affectation.personnelId}, function (err, personnel) {
                    if (err) {
                        log.error(err);
                        audit.logEvent('[mongodb]', 'Position', 'findPositionHelder', '', '', 'failed', 'Mongodb attempted to retrieve personnel ');
                        return callback(err);
                    } else {
                        affectation.personnel = personnel;
                        return callback(null, affectation);
                    }
                });
            } else {
                callback(null);
            }
        }
    });
};
/**
 * Find the person who held a posisition
 * @param {type} code
 * @param {type} callback
 * @returns json
 */
exports.findPositionHelderBystaffId = function (options, staffId, callback) {
    Affectation.findOne({
        personnelId: staffId
    }).lean().exec(function (err, affectation) {
        if (err) {
            log.error(err);
            callback(err);
        } else {
            if (affectation) {
                exports.findPositionByCode(affectation.positionCode, function (err, position) {
                    if (err) {
                        log.error(err);
                        callback(err);
                    } else {
                        beautify({actor: options.req.actor, language: options.req.actor.language, beautify: true}, [position], function (err, objects) {
                            if (err) {
                                callback(err);
                            } else {
                                affectation.position = objects[0];
                                callback(null, affectation);
                            }
                        });

                    }
                });
            } else {
                callback(null, affectation);
            }
        }
    });
};

exports.findHelderPositionsByStructureCode = function (code, callback) {
    Affectation.find({
        positionCode: {'$regex': code + "-"}
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

exports.find = function (id, callback) {
    Position.findOne({
        _id: id
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

exports.find2 = function (option, callback) {
    Position.findOne({
        _id: option.id
    }).lean().exec(function (err, positionDetails) {
        if (err) {
            log.error(err);
            callback(err);
        } else {
            if (positionDetails != null) {
                positionDetails.name = ((option.language && option.language !== "" && positionDetails[option.language] != undefined && positionDetails[option.language] != "") ? positionDetails[option.language] : positionDetails['en']);
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
            if (o < objects.length && objects[o]) {
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