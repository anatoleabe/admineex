var Structure = require('../models/structure').Structure;
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
    users: require('./users'),
    positions: require('./positions'),
    structures: require('./structures')
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
        filter = {};

        if (req.params.id && req.params.id != "-1") {
            filter = {$and: []};
            filter.$and.push({$or: []});
            filter.$and[0].$or.push({
                "code": new RegExp("^" + req.params.id.toUpperCase())
            });
            filter.$and[0].$or.push({
                "fr": new RegExp(req.params.id.toUpperCase())
            });
            filter.$and[0].$or.push({
                "en": new RegExp(req.params.id.toUpperCase())
            });
        }

        var limit = 0;
        var skip = 0;
        if (req.params.limit && req.params.skip) {
            limit = parseInt(req.params.limit, 10);
            skip = parseInt(req.params.skip, 10);
        }

        controllers.users.findUser(req.actor.id, function (err, user) {
            if (err) {
                log.error(err);
                callback(err);
            } else {
                var userStructure = [];
                var userStructureCodes = [];
                function LoopS(s) {
                    if (user.structures && s < user.structures.length && user.structures[s]) {
                        controllers.structures.find(user.structures[s], "en", function (err, structure) {
                            if (err) {
                                log.error(err);
                                callback(err);
                            } else {
                                userStructure.push({id: structure._id, code: structure.code});
                                userStructureCodes.push(new RegExp("^" + structure.code));
                                LoopS(s + 1);
                            }
                        });
                    } else {
                        var query = filter
                        if (req.actor.role == "2") {
                            query = {
                                "code": {$in: userStructureCodes}
                            }
                        }
                        Structure.count(query).exec(function (err, count) {
                            if (err) {
                                log.error(err);
                                callback(err);
                            } else {
                                Structure.find(query).sort({"rank": 'asc'}).limit(limit).skip(skip).lean().exec(function (err, result) {
                                    if (err) {
                                        log.error(err);
                                        audit.logEvent('[mongodb]', 'Structures', 'List', '', '', 'failed', 'Mongodb attempted to retrieve structures list');
                                        return res.status(500).send(err);
                                    } else {
                                        var structures = JSON.parse(JSON.stringify(result));
                                        function loopA(a) {
                                            if (a < structures.length) {
                                                var filterCode = structures[a].code + "P";
                                                if (structures[a].rank == "2") {//For Direction
                                                    if (structures[a].type == "2") {//For deconcentred Service
                                                        filterCode = structures[a].code + "-";
                                                    } else {
                                                        filterCode = structures[a].code;
                                                    }
                                                }
                                                structures[a].name = ((language && language !== "" && structures[a][language] != undefined && structures[a][language] != "") ? structures[a][language] : structures[a]['en']);
                                                controllers.positions.findPositionsByStructureCode({code: filterCode}, function (err, positions) {
                                                    if (err) {
                                                        return res.status(500).send(err);
                                                    } else {
                                                        if (positions) {
                                                            structures[a].workstationsNb = positions.length;
                                                        } else {
                                                            structures[a].workstationsNb = 0;
                                                        }

                                                        var requiredEffective = positions.length;

                                                        var filterCode = {'$regex': new RegExp("^" + structures[a].code + "P")};
                                                        if (structures[a].rank == "2") {
                                                            filterCode = {'$regex': structures[a].code};
                                                            if (structures[a].type == "2") {//For deconcentred Service
                                                                filterCode = {'$regex': new RegExp("^" + structures[a].code + "-")};
                                                            } else {
                                                                filterCode = {'$regex': new RegExp("^" + structures[a].code)};
                                                            }
                                                        }
                                                        controllers.positions.findHelderPositionsByStructureCode(filterCode, function (err, affectations) {
                                                            if (err) {
                                                                audit.logEvent('[mongodb]', 'Positions', 'findHelderPositionsByStructureCode', "code", req.params.code, 'failed', "Mongodb attempted to find the affection detail");
                                                                return res.status(500).send(err);
                                                            } else {
                                                                var affectationLength = 0;
                                                                function loopD(d) {
                                                                    if (affectations && d < affectations.length) {
                                                                        Position.find({
                                                                            _id: affectations[d].positionId
                                                                        }, {"_id": 1}).lean().exec(function (err, positions) {
                                                                            if (positions && positions.length > 0) {
                                                                                affectationLength = affectationLength + 1;
                                                                            }
                                                                            loopD(d + 1);
                                                                        });
                                                                    } else {
                                                                        structures[a].actualEffective = affectationLength;
                                                                        structures[a].requiredEffective = requiredEffective;
                                                                        structures[a].vacancies = requiredEffective - structures[a].actualEffective;
                                                                        loopA(a + 1);
                                                                    }
                                                                }
                                                                loopD(0);
                                                            }
                                                        });

                                                    }
                                                });

                                            } else {
                                                beautify({actor: req.actor, language: req.actor.language, beautify: true}, structures, function (err, objects) {
                                                    if (err) {
                                                        return res.status(500).send(err);
                                                    } else {
                                                        return res.json({data: objects, count: count});
                                                    }
                                                });
                                            }
                                        }
                                        loopA(0);
                                    }
                                });
                            }
                        });
                    }
                }
                LoopS(0);
            }
        });
    } else {
        audit.logEvent('[anonymous]', 'Structures', 'List', '', '', 'failed', 'The actor was not authenticated');
        return res.sendStatus(401);
    }
}

exports.api.minimalList = function (req, res) {
    if (req.actor) {
        var language = req.actor.language.toLowerCase();
        var types = undefined;
        let structureFatherId = undefined;
        if (req.params.structure && req.params.structure.indexOf('t=') != -1) {
            types = req.params.structure.split("=");
        }else if (req.params.structure && req.params.structure != "-1"){
            structureFatherId = req.params.structure;
        }
        controllers.users.findUser(req.actor.id, function (err, user) {
            if (err) {
                log.error(err);
                callback(err);
            } else {
                var userStructure = [];
                var userStructureCodes = [];
                function LoopS(s) {
                    if (user.structures && s < user.structures.length && user.structures[s]) {
                        controllers.structures.find(user.structures[s], "en", function (err, structure) {
                            if (err) {
                                log.error(err);
                                callback(err);
                            } else {
                                userStructure.push({id: structure._id, code: structure.code});
                                userStructureCodes.push(new RegExp("^" + structure.code));
                                LoopS(s + 1);
                            }
                        });
                    } else {
                        var query = {};
                        if (types) {
                            query = {"type": types[1]};
                        }
                        if (types && types[3]) {
                            query.rank = types[3];
                        }
                        if (req.actor.role == "2") {
                            query = {
                                "code": {$in: userStructureCodes}
                            }
                        }
                        if (structureFatherId && structureFatherId !== "undefined") {
                            query = {
                                "fatherId": structureFatherId
                            }
                        }

                        Structure.find(query).sort({"rank": 'asc'}).lean().exec(function (err, result) {
                            if (err) {
                                log.error(err);
                                audit.logEvent('[mongodb]', 'Structures', 'List', '', '', 'failed', 'Mongodb attempted to retrieve structures list');
                                return res.status(500).send(err);
                            } else {
                                var structures = JSON.parse(JSON.stringify(result));
                                function loopA(a) {
                                    if (a < structures.length) {
                                        structures[a].name = ((language && language !== "" && structures[a][language] != undefined && structures[a][language] != "") ? structures[a][language] : structures[a]['en']);
                                        loopA(a + 1);
                                    } else {
                                        beautify({actor: req.actor, language: req.actor.language, beautify: false}, structures, function (err, objects) {
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
                    }
                }
                LoopS(0);
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


exports.listOld = function (options, callback) {
    var filter = {rank: "2"};
    if (options.filter) {
        filter = options.filter;
    }
    Structure.find(filter).sort({"rank": 'asc'}).lean().exec(function (err, result) {
        if (err) {
            log.error(err);
            callback(err);
        } else {
            var structures = JSON.parse(JSON.stringify(result));
            function LoopA(a) {
                if (a < structures.length) {
                    filter = {fatherId: structures[a]._id};
                    if (options.subFilter && options.subFilter.code) {
                        filter = options.subFilter;
                    }
                    Structure.find(filter).sort({"rank": 'asc'}).lean().exec(function (err, subStructures) {
                        if (err) {
                            log.error(err);
                            callback(err);
                        } else {
                            structures[a].children = subStructures;
                            LoopA(a + 1);
                        }
                    });
                } else {
                    beautify(options, structures, function (err, objects) {
                        if (err) {
                            callback(err);
                        } else {
                            callback(null, objects);
                        }
                    });
                }
            }
            LoopA(0);
        }
    });
}

exports.list = function (options, callback) {
    var filter = { rank: "2" };
    if (options.filter) {
        filter = options.filter;
    }

    Structure.aggregate([
        { $match: filter },
        { $sort: { rank: 1 } },
        {
            $lookup: {
                from: 'structures',
                localField: '_id',
                foreignField: 'fatherId',
                as: 'children'
            }
        },
        {
            $lookup: {
                from: 'structures',
                localField: 'fatherId',
                foreignField: '_id',
                as: 'father'
            }
        },
        {
            $unwind: {
                path: '$father',
                "preserveNullAndEmptyArrays": true
            }
        },
        { $sort: { 'children.rank': 1 } }
    ]).exec(function (err, result) {
        if (err) {
            log.error(err);
            callback(err);
        } else {
            var structures = JSON.parse(JSON.stringify(result));
            // Remaining code logic...
            beautify(options, structures, function (err, objects) {
                if (err) {
                    callback(err);
                } else {
                    callback(null, objects);
                }
            });
        }
    });
}

exports.api.delete = function (req, res) {
    if (req.actor) {

    } else {
        audit.logEvent('[anonymous]', 'Structures', 'Delete', '', '', 'failed', 'The actor was not authenticated');
        return res.sendStatus(401);
    }
}

exports.initialize = function (path, callback) {
    var initialize = controllers.configuration.getConf().initialize;

    if (true) {
        var structures = dictionary.getJSONList("../../resources/dictionary/tmpData/" + path + "/structures.json", "en");
        var avoidedStructuresCode = [];
        function loopA(a) {
            if (a < structures.length) {
                var fields = {
                    code: structures[a].code,
                    en: structures[a].en,
                    fr: structures[a].fr,
//                    fatherIdentifier: "10",//FOR CENTRE
                    //fatherId: structures[a].father,
                    rank: structures[a].rank,
                    type: structures[a].type,
                    activities: [],
                    tasks: [],
                    address: [
                        {
                            country: "CAF", //From json
                            region: structures[a].region,
                            department: structures[a].department,
                            arrondissement: ""
                        }
                    ],
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
//                            exports.upsert(fields, function (err, structure) {
//                                if (err) {
//                                    log.error(err);
//                                } else {
//                                    loopA(a + 1);
//                                }
//                            });
                            loopA(a + 1);
                        } else {
                            //Set the father id
                            exports.findStructureByCode(structures[a].father, "en", function (err, structure) {
                                if (err) {
                                    log.error(err);
                                    callback(err);
                                } else {
                                    fields.fatherId = structure._id;
                                    exports.upsert(fields, function (err, structure) {
                                        if (err) {
                                            log.error(err);
                                        } else {
                                            loopA(a + 1);
                                        }
                                    });

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
                beautify({language: language, beautify: true}, [structure], function (err, objects) {
                    if (err) {
                        callback(err);
                    } else {
                        callback(null, objects[0]);
                    }
                });
            } else {
                callback(null);
            }
        }
    });
}

exports.findStructureByCode2 = function (code, language) {
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
                beautify({language: language, beautify: true}, [structure], function (err, objects) {
                    return objects[0];
                });
            } else {
                return null;
            }
        }
    });
}

exports.findStructureByCodeNoBeautify = function (code, language, callback) {
    Structure.findOne({
        code: code
    }).lean().exec(function (err, result) {
        if (err) {
            log.error(err);
            callback(err);
        } else {
            var structure = JSON.parse(JSON.stringify(result));
            callback(null, result);
        }
    });
}

exports.findOld = function (id, language, callback) {
    Structure.findOne({
        _id: id
    }).lean().exec(function (err, result) {
        if (err) {
            log.error(err);
            callback(err);
        } else {
            var structure = JSON.parse(JSON.stringify(result));

            if (structure != null) {
                structure.name = ((language && language !== "" && structure[language] != undefined && structure[language] != "") ? structure[language] : structure['en']);
                beautify({language: language, beautify: true}, [structure], function (err, objects) {
                    if (err) {
                        callback(err);
            } else {
                        callback(null, objects[0]);
                    }
                });
            } else {
                callback(null);
            }
        }
    });
}

exports.find = function (options, language, callback) {
    let id;
    let doBeautify ;
    if (options.id || (options.isFather)) {
        id = options.id;
    }else {
        id = options;
    }
    if (options.beautify) {
        doBeautify = options.beautify;
    }else {
        doBeautify = true;
    }
    
    let isFather = options.isFather;
    Structure.findOne({
        _id: id
    }).lean().exec(function (err, result) {
        if (err) {
            log.error(err);
            callback(err);
        } else {
            var structure = JSON.parse(JSON.stringify(result));

            if (structure != null) {
                structure.name = ((language && language !== "" && structure[language] != undefined && structure[language] != "") ? structure[language] : structure['en']);
                if (doBeautify === true){
                    beautify({language: language, beautify: true, isFather: isFather}, [structure], function (err, objects) {
                        if (err) {
                            callback(err);
                        } else {
                            callback(null, objects[0]);
                        }
                    });
                }else{
                    callback(null, structure);
                }
            } else {
                callback(null);
            }
        }
    });
}

exports.count = function (options, callback) {
    var filter = {};
    if (options.filter) {
        filter = options.filter;
    }
    Structure.count(filter).exec(function (err, count) {
        if (err) {
            log.error(err);
            callback(err);
        } else {
            callback(null, count);
        }
    });
}






function beautify(options, objects, callback) {
    var language = options.language || "";
    language = language.toLowerCase();
    var gt = dictionary.translator(language);
    if (options.beautify && options.beautify === true) {
        //Address
        //objects = controllers.configuration.beautifyAddress({language: language}, objects);
        function Loop(o) {
            if (o < objects.length) {
                objects[o].typeValue = dictionary.getValueFromJSON('../../resources/dictionary/structure/types.json', objects[o].type, language);
                objects[o].rankValue = dictionary.getValueFromJSON('../../resources/dictionary/structure/ranks.json', objects[o].rank, language);
                objects[o].name = ((language && language !== "" && objects[o][language] != undefined && objects[o][language] != "") ? objects[o][language] : objects[o]['en']);
                if (objects[o].fatherId && options.isFather !== true){
                    exports.find({id: objects[o].fatherId, isFather: true}, language, function (err, structure) {
                        if (err) {
                            callback(err);
                        } else {
                            objects[o].father = structure;
                            if (options.includePositions && objects[o].children) {
                                function LoopB(b) {
                                    if (b < objects[o].children.length) {
                                        objects[o].children[b].typeValue = dictionary.getValueFromJSON('../../resources/dictionary/structure/types.json', objects[o].type, language);
                                        objects[o].children[b].rankValue = dictionary.getValueFromJSON('../../resources/dictionary/structure/ranks.json', objects[o].rank, language);
                                        objects[o].children[b].name = ((language && language !== "" && objects[o].children[b][language] != undefined && objects[o].children[b][language] != "") ? objects[o].children[b][language] : objects[o].children[b]['en']);
                                        controllers.positions.findPositionsByStructureId({_id: objects[o].children[b]._id, beautify: true, structures: false, vacancies: options.vacancies, nomenclature: options.nomenclature}, function (err, positions) {
                                            if (err) {
                                                callback(err);
                                            } else {
                                                objects[o].children[b].positions = positions;
                                                LoopB(b + 1);
                                            }
                                        });
                                    } else {
                                        Loop(o + 1);
                                    }
                                }
                                LoopB(0)
                            } else {
                                Loop(o + 1);
                            }
                        }
                    });
                }else{
                    Loop(o + 1);
                }
            } else {
                callback(null, objects);
            }
        }
        Loop(0);
    } else {
        callback(null, objects);
    }
}
