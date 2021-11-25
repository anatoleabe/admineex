var Position = require('../models/position').Position;
var Affectation = require('../models/affectation').Affectation;
var Notification = require('../models/notification').Notification;
var nconf = require('nconf');
nconf.file("config/server.json");
var audit = require('../utils/audit-log');
var log = require('../utils/log');
var mail = require('../utils/mail');
var _ = require('lodash');
var fs = require('fs');
var Excel = require('exceljs');
var keyGenerator = require("generate-key");
var crypto = require('crypto');
var dictionary = require('../utils/dictionary');
var formidable = require("formidable");
var ObjectID = require('mongoose').mongo.ObjectID;
var moment = require('moment');
var util = require('util');

// API
exports.api = {};

var controllers = {
    configuration: require('./configuration'),
    structures: require('./structures'),
    personnel: require('./personnel'),
    users: require('./users'),
    thresholds: require('./thresholds')
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
                            oldPositionId: null,
                            positionCode: result.code,
                            personnelId: fields.occupiedBy,
                            date: fields.startDate,
                            lastModified: new Date(),
                            creation: new Date(),
                            actor: req.actor.id,
                            numAct: fields.numAct,
                            signatureDate: fields.signatureDate,
                            startDate: fields.startDate,
                            mouvement: fields.mouvement,
                            nature: fields.nature,
                            endDate: (fields.isCurrent && fields.isCurrent == "true") ? null : fields.endDate,
                        };
                        var filter = {
                            personnelId: fields.occupiedBy,
                            positionId: fields.positionId,
                        };
                        Affectation.findOne({personnelId: fields.occupiedBy}).sort({lastModified: -1}).lean().exec(function (err, lastAffectation) {
                            if (err) {
                                log.error(err);
                                audit.logEvent('[mongodb]', 'Position', 'affectToPosition', "", "", 'failed', "Mongodb attempted to find old affectation.");
                                return res.status(500).send(err);
                            } else {
                                if (lastAffectation) {
                                    filter.oldPositionId = lastAffectation.positionId;
                                    affectationFields.oldPositionId = lastAffectation.positionId;
                                }

                                Affectation.findOneAndUpdate(filter, affectationFields, {setDefaultsOnInsert: true, upsert: true, sort: {'lastModified': -1}, new : true}, function (err, result) {
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

//                                                    var history = {
//                                                        numAct: fields.numAct,
//                                                        positionId: new ObjectID(fields.positionId),
//                                                        isCurrent: fields.isCurrent,
//                                                        signatureDate: fields.signatureDate,
//                                                        startDate: fields.startDate,
//                                                        endDate: (fields.isCurrent && fields.isCurrent == "true") ? null : fields.endDate,
//                                                        mouvement: fields.mouvement,
//                                                        nature: fields.nature
//                                                    };
//                                                    if (!perso.history) {
//                                                        perso.history = {positions: []};
//                                                    } else if (perso.history && !perso.history.positions) {
//                                                        perso.history.positions = [];
//                                                    } else if (perso.history && util.isArray(perso.history.positions) && perso.history.positions.length > 0) {
//                                                        for (var i in perso.history.positions) {
//                                                            perso.history.positions[i].isCurrent = false;
//                                                        }
//                                                    } else {
//                                                        perso.history.positions = [];
//                                                    }
//                                                    perso.history.positions.push(history);
//
//                                                    controllers.personnel.upsert(perso, function (err, structure) {
//                                                        if (err) {
//                                                            log.error(err);
//                                                        } else {
//                                                            res.sendStatus(200);
//                                                            audit.logEvent(req.actor.id, 'Poste', 'Changement de poste', 'Nouveau code poste', affectationFields.positionCode, 'succeed', 'Affectation de '+perso.name.family[0]+' '+perso.name.given[0]+ ' au poste de code: '+affectationFields.positionCode);
//                                                        }
//                                                    });
                                                    res.sendStatus(200);
                                                    audit.logEvent(req.actor.id, 'Poste', 'Changement de poste', 'Nouveau code poste', affectationFields.positionCode, 'succeed', 'Affectation de ' + perso.name.family[0] + ' ' + perso.name.given[0] + ' au poste de code: ' + affectationFields.positionCode);
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
            }
        });
    } else {
        audit.logEvent('[anonymous]', 'Positions', 'affectToPosition', '', '', 'failed', 'The actor was not authenticated');
        return res.sendStatus(401);
    }
};

//This read data from json files (matricule and position code , then link position and personnel in db
//DO NOT USE THIS
exports.affectToPositionFromJson = function (path, callback) {
    var affectations = dictionary.getToJSONList("../../resources/dictionary/tmpData/" + path + "/fulldata.json");
    var avoided = [];

    String.prototype.isNumber = function () {
        return /^\d+$/.test(this);
    }
    String.prototype.capitalize = function () {
        return this.charAt(0).toUpperCase() + this.slice(1);
    }
    var projection = {_id: 1};
    function loopA(a) {
        if (a < affectations.length) {
            var identifier = affectations[a].identifier.replace(/\s+/g, '');
            var codep = affectations[a].codept.replace(/\s+/g, '');

            var skills = affectations[a].creel.split(";");
            var profiles = affectations[a].preel.split(";");

            for (var s in skills) {
                if (skills[s] != "") {
                    var thisSkill = dictionary.getJSONById('../../resources/dictionary/personnel/tmp_skills.json', skills[s].trim());
                    console.log(skills[s], thisSkill)
                    skills[s] = thisSkill.realId;//FIXE LE PB DES LISTES DES COMPETENCES POSSIBLES(Service Deconcentre uniquement)
                }
            }

            for (var s in profiles) {
                if (profiles[s] != "") {
                    var thisProfile = dictionary.getJSONById('../../resources/dictionary/personnel/tmp_profile.json', profiles[s].trim());
                    console.log(profiles[s], thisProfile)
                    profiles[s] = thisProfile.realId;//FIXE LE PB DES LISTES DES PROFILES POSSIBLES(Service Deconcentre uniquement)
                }
            }


            var affectationDate = (affectations[a].date && affectations[a].date != "") ? affectations[a].date.split("/") : undefined;
            if (affectationDate) {
                affectationDate = new Date(+affectationDate[2], affectationDate[1] - 1, +affectationDate[0]);
            }

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
                                    date: affectationDate
                                };

                                var filter = {
                                    positionId: post._id,
                                    positionCode: codep,
                                    personnelId: pers._id
                                };

                                Affectation.findOneAndUpdate(filter, affectationFields, {setDefaultsOnInsert: true, upsert: true, new : true}, function (err, result) {
                                    if (err) {
                                        log.error(err);
                                    } else {
                                        var history = {
                                            numAct: undefined,
                                            positionId: post._id,
                                            isCurrent: true,
                                            signatureDate: affectationDate,
                                            startDate: affectationDate,
                                            endDate: null,
                                            mouvement: "1",
                                            nature: "1"
                                        };
                                        if (!pers.history) {
                                            pers.history = {positions: []};
                                        }
                                        if (pers.history && !pers.history.positions) {
                                            pers.history.positions = [];
                                        }
                                        pers.history.positions = history;
                                        //pers.history.positions.push(history);
                                        pers.profiles = profiles;
                                        pers.skills = skills;

                                        controllers.personnel.upsert(pers, function (err, result) {
                                            if (err) {
                                                log.error(err);
                                            } else {
                                                loopA(a + 1);
                                            }
                                        });
                                    }
                                });
                            } else {
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
        var limit = 0;
        var skip = 0;
        if (req.params.limit && req.params.skip) {
            limit = parseInt(req.params.limit, 10);
            skip = parseInt(req.params.skip, 10);
        }

        var filtersParam = {}
        if (req.params.filters && req.params.filters != "-" && req.params.filters != "" && req.params.filters != "undefined") {
            filtersParam = JSON.parse(req.params.filters);
        }

        var options = {
            search: req.params.search,
            filtersParam: filtersParam,
            limit: limit,
            skip: skip,
            actor: req.actor,
            language: req.actor.language,
            beautify: true,
            req: req
        }

        exports.list(options, function (err, data) {
            if (err) {
                return res.status(500).send(err);
            } else {
                return res.json(data);
            }
        });

    } else {
        audit.logEvent('[anonymous]', 'Positions', 'List', '', '', 'failed', 'The actor was not authenticated');
        return res.send(401);
    }
}

exports.list = function (options, callback) {

    controllers.users.findUser(options.req.actor.id, function (err, user) {
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
                    var filter = {};
                    if (options.search && options.search != "-1" && options.search != "" && options.search != "undefined") {
                        filter = {$and: []};
                        filter.$and.push({
                            "code": new RegExp("^" + options.search)
                        });
                        filter.$and.push({
                            "fr": new RegExp("^" + options.search)
                        });
                        filter.$and.push({
                            "en": new RegExp("^" + options.search)
                        });
                    }
                    if (options.filtersParam.structure && options.filtersParam.structure != "-1" && options.filtersParam.structure != "-") {
                        if (!filter.$and) {
                            filter = {$and: []};
                        }
                        filter.$and.push({
                            "code": new RegExp("^" + options.filtersParam.structure.toUpperCase())
                        });
                    }

                    restriction = options.filtersParam.status;

                    var concatMeta = ["$fr", "$en", "$code"];
                    var aggregate = [];
                    aggregate.push({"$addFields": {"metainfo": {$concat: concatMeta}}});


                    if (options.search && options.search != "-1" && options.search != "" && options.search != "undefined") {
                        aggregate.push({$match: {$or: [{"metainfo": dictionary.makePattern(options.search)}]}})
                    }
                    if (options.filtersParam.structure && options.filtersParam.structure != "-1" && options.filtersParam.structure != "-") {
                        aggregate.push({$match: {$or: [{"code": new RegExp("^" + options.filtersParam.structure)}]}})
                    }

                    if (options.req.actor.role == "2") {
                        aggregate.push(
                            {"$match": {"code": {$in: userStructureCodes}}},
                        );
                    }

                    if (restriction !== "-") {
                        aggregate.push(
                                {
                                    $lookup: {
                                        from: 'affectations',
                                        localField: '_id',
                                        foreignField: 'positionId',
                                        as: 'affectation'
                                    }
                                }
                        );
                        if (restriction == "1") {
                            aggregate.push({$match: {"affectation": {$ne: []}}});
                        }
                        if (restriction == "0") {
                            aggregate.push({$match: {"affectation": {$eq: []}}});
                        }
                    }

                    aggregate.push({$count: "total"});
                    q = Position.aggregate(aggregate);
                    q.exec(function (err, count) {
                        if (err) {
                            log.error(err);
                            callback(err);
                        } else {
                            aggregate.pop();//Remove the count(Last element added)
                            if (count && count[0]) {
                                count = count[0].total;
                            }
                            aggregate.push(
                                    {
                                        $lookup: {
                                            from: 'affectations',
                                            localField: '_id',
                                            foreignField: 'positionId',
                                            as: 'affectation'
                                        }
                                    }
                            );
                            if ((options.skip + options.limit) > 0) {
                                aggregate.push({"$limit": options.skip + options.limit})
                                aggregate.push({"$skip": options.skip})
                            }
                            var projection = {
                                $project: {_id: 1, affectation: 1, structureId: 1, en: 1, fr: 1, metainfo: 1, code: 1, order: 1, comesAfter: 1}
                            };
                            aggregate.push(projection);

                            q = Position.aggregate(aggregate);
                            q.exec(function (err, result) {
                                if (err) {
                                    log.error(err);
                                    audit.logEvent('[mongodb]', 'Positions', 'List', '', '', 'failed', 'Mongodb attempted to retrieve positions list');
                                    callback(err);
                                } else {
                                    var positions = JSON.parse(JSON.stringify(result));

                                    function LoopA(o) {
                                        if (o < positions.length) {
                                            positions[o]
                                            if (positions[o].affectation && positions[o].affectation.length > 0) {
                                                positions[o].actualEffective = 1;//We can also put the real effective in case we are using effective for position
                                                positions[o].status = "Pourvue";
                                            } else {
                                                positions[o].actualEffective = 0;
                                                positions[o].status = "Non pourvue";
                                            }
                                            positions[o].vacancies = 1 - positions[o].actualEffective;
                                            LoopA(o + 1);
                                        } else {

                                            beautify({actor: options.actor, language: options.language, beautify: options.beautify, deepBeautify: options.deepBeautify}, positions, function (err, objects) {
                                                if (err) {
                                                    callback(err);
                                                } else {
                                                    return callback(null, {data: objects, count: count});
                                                }
                                            });
                                        }
                                    }
                                    LoopA(0);
                                }
                            });
                        }
                    });
                }
            }
            LoopS(0);
        }
    });
}

exports.api.download = function (req, res) {
    if (req.actor) {
        if (req.params.filters == undefined) {
            audit.logEvent(req.actor.id, 'Positions', 'Download', '', '', 'failed',
                    'The actor could not download the positions list because one or more params of the request was not defined');
            return res.sendStatus(400);
        } else {
            var filtersParam = {}
            if (req.params.filters && req.params.filters != "-" && req.params.filters != "") {
                filtersParam = JSON.parse(req.params.filters);
            }

            var filter = {rank: "2"};
            if (filtersParam.structure != "-1" && filtersParam.structure != "undefined" && filtersParam.structure) {
                filter.code = filtersParam.structure;
            }
            if (filtersParam.type && filtersParam.type != "-1" && filtersParam.type != "-") {
                filter.type = filtersParam.type;
            }
            var subFilter = {};
            if (filtersParam.subStructure != "-1" && filtersParam.subStructure != "undefined" && filtersParam.subStructure) {
                subFilter.code = filtersParam.subStructure;
            }

            var option = {
                actor: req.actor, language: req.actor.language, beautify: true, filter: filter, subFilter: subFilter
            }
            controllers.structures.list(option, function (err, structures) {
                if (err) {
                    log.error(err);
                    res.status(500).send(err);
                } else {
                    var options = {
                        search: req.params.search,
                        filtersParam: filtersParam,
                        actor: req.actor,
                        language: req.actor.language,
                        beautify: true,
                        deepBeautify: true
                    }

                    exports.list(options, function (err, positions) {
                        if (err) {
                            log.error(err);
                            res.status(500).send(err);
                        } else {
                            positions = positions.data;
                            var groupedPositionByStructureChildren = _.groupBy(positions, 'structureId');

                            for (var s in structures) {
                                if (structures[s].children) {
                                    for (var c in structures[s].children) {
                                        structures[s].children[c].positions = groupedPositionByStructureChildren[structures[s].children[c]._id]
                                    }
                                }
                            }

                            var gt = dictionary.translator(req.actor.language);
                            //Build XLSX
                            var options = buildFields(req.actor.language);
                            options.data = structures;
                            options.title = gt.gettext("Admineex: Liste des postes de travail");
                            buildXLSX(options, function (err, filePath) {
                                if (err) {
                                    log.error(err);
                                } else {
                                    var fileName = 'report.xlsx';
                                    res.set('Content-disposition', 'attachment; filename=' + fileName);
                                    res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
                                    var fileStream = fs.createReadStream(filePath);
                                    var pipeStream = fileStream.pipe(res);
                                    pipeStream.on('finish', function () {
                                        fs.unlinkSync(filePath);
                                    });
                                }
                            });
                        }
                    });
                }
            });


        }
    }
}

function buildFields(language) {
    var fields = require("../../resources/dictionary/export/positionsfields.json");
    var options = {fields: [], fieldNames: []};
    for (i = 0; i < fields.length; i++) {
        options.fieldNames.push(((language != "" && fields[i][language] != undefined && fields[i][language] != "") ? fields[i][language] : fields[i]['en']));
        options.fields.push(fields[i].id);
    }
    return options;
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

                    exports.findPositionHelder(filter.positionId, function (err, result) {
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
        audit.logEvent('[anonymous]', 'Positions', 'Read', '', '', 'failed', 'The actor was not authenticated');
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


exports.INITPOSITIONDATAFROMJSON = function (path, callback) {
    var initialize = controllers.configuration.getConf().initialize;

    String.prototype.isNumber = function () {
        return /^\d+$/.test(this);
    }
    String.prototype.capitalize = function () {
        return this.charAt(0).toUpperCase() + this.slice(1);
    }

    if (initialize.positions) {
//        var positions = dictionary.getJSONList("../../resources/dictionary/tmpData/" + path + "/fulldata.json", "en");
        var positions = dictionary.getJSONList("../../resources/dictionary/tmpData/" + path + "/positions.json", "en");
        var avoidedPositionsCode = [];
        function loopA(a) {
            if (a < positions.length) {
                var skillRequired = positions[a].crequired.split(";");
                var profilelRequired = positions[a].prequired.split(";");
                var activities = positions[a].activity.split(";");
                var tasks = positions[a].task.split(";");
                var taskValues = [];
                var activitiesValues = [];

                for (var s in skillRequired) {
                    if (skillRequired[s] != "") {
                        var thisSkill = dictionary.getJSONById('../../resources/dictionary/personnel/tmp_skills.json', skillRequired[s].trim());
                        console.log(skillRequired[s], thisSkill)
                        skillRequired[s] = thisSkill.realId;//FIXE LE PB DES LISTES DES COMPETENCES POSSIBLES(Service Deconcentre uniquement)
                    }
                }

                for (var s in profilelRequired) {
                    if (profilelRequired[s] != "") {
                        var thisProfile = dictionary.getJSONById('../../resources/dictionary/personnel/tmp_profile.json', profilelRequired[s].trim());
                        console.log(profilelRequired[s], thisProfile)
                        profilelRequired[s] = thisProfile.realId;//FIXE LE PB DES LISTES DES PROFILES POSSIBLES(Service Deconcentre uniquement)
                    }
                }

                for (var s in activities) {
                    if (activities[s] && activities[s] != "") {
                        var activity = dictionary.getJSONById("../../resources/dictionary/tmpData/" + path + "/activities.json", activities[s].trim());
                        console.log(activities[s].trim())
                        activitiesValues.push(activity.activity.capitalize());
                    }
                }

                for (var s in tasks) {
                    if (tasks[s] && tasks[s] != "") {
                        console.log(tasks, tasks[s]);
                        var task = dictionary.getJSONById("../../resources/dictionary/tmpData/" + path + "/tasks.json", tasks[s].trim());
                        taskValues.push(task.task.capitalize());
                    }
                }


                var fieldsUpdate = {
                    code: positions[a].codept,
                    realisationRequired: positions[a].nbtotraite,
                    activities: activitiesValues,
                    tasks: taskValues,
                    requiredProfiles: profilelRequired,
                    requiredSkills: skillRequired,
                }

                var fieldsCreate = {
                    code: positions[a].codept,
                    en: positions[a].pt,
                    fr: positions[a].pt,
                    realisationRequired: positions[a].nbtotraite,
                    activities: activitiesValues,
                    tasks: taskValues,
                    requiredProfiles: profilelRequired,
                    requiredSkills: skillRequired,
                }

                exports.findPositionByCode(positions[a].codept, function (err, position) {
                    if (err) {
                        log.error(err);
                        callback(err);
                    } else {
                        console.log(positions[a].codept, positions[a].codept.substring(0, positions[a].codept.indexOf('P')))
                        controllers.structures.findStructureByCode(positions[a].codept.substring(0, positions[a].codept.indexOf('P')), "en", function (err, structure) {
                            if (err) {
                                log.error(err);
                                callback(err);
                            } else {
                                var fields = fieldsCreate;

                                if (position) {// If this position already exist
                                    fields = fieldsUpdate;
                                    fields._id = position._id;
                                }
                                fields.structureId = structure._id;
                                exports.upsert(fields, function (err) {
                                    if (err) {
                                        log.error(err);
                                    } else {
                                        loopA(a + 1);
                                    }
                                });
                            }
                        });
                    }
                });

            } else {
                callback(null, avoidedPositionsCode);
            }
        }
        loopA(0);
    }
}

exports.SETPOSITIONORDERFROMJSON = function (callback) {
    var initialize = controllers.configuration.getConf().initialize;

    if (initialize.positions) {
        var positions = dictionary.getJSONList("../../resources/dictionary/tmpData/orderingDCP.json", "en");
        function loopA(a) {
            if (a < positions.length) {

                exports.findPositionByCode(positions[a].codept, function (err, position) {
                    if (err) {
                        log.error(err);
                        callback(err);
                    } else {
                        console.log(position);
                        if (position) {// If this position already exist
                            position.order = positions[a].order;

                            exports.upsert(position, function (err) {
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
                callback(null);
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
exports.findPositionHelder = function (id, callback) {
    Affectation.findOne({
        positionId: id
    }).sort({lastModified: -1}).lean().exec(function (err, affectation) {
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
 * Alert after 05 years spent at one position
 * @param {type} code
 * @param {type} callback
 * @returns json
 */
exports.patrol0 = function (callback) {

    controllers.thresholds.read('0', function (err, threshold) {
        if (err) {
            log.error(err);
            callback(err);
        } else {
            var nbYearsSpent = 5;

            if (threshold) {
                nbYearsSpent = parseInt(threshold.values[0]);
            }
            var query = {$and: []};
            var d = new Date();
            var pastYear = d.getFullYear() - nbYearsSpent;
            d.setFullYear(pastYear);

            query.$and.push({
                'date': {
                    $lte: moment(d).startOf('day')
                }
            });

            Affectation.find(query).sort({lastModified: -1}).lean().exec(function (err, affectations) {
                if (err) {
                    log.error(err);
                    callback(err);
                } else {
                    if (affectations && affectations.length > 0) {
                        controllers.users.all(function (err, users) {
                            if (err) {
                                callback(err);
                                log.error(err);
                            } else {

                                function LoopA(m) {
                                    if (m < users.length) {
                                        var language = users[m].language.toLowerCase();
                                        var gt = dictionary.translator(language);
                                        var notification = {
                                            type: 'admin',
                                            author: 'App',

                                        };
                                        notification.userID = users[m]._id;
                                        notification.abstract = gt.gettext("There are people who have spent more than 5 years at a position.");
                                        notification.content = gt.gettext("[1] people have spent more than 5 years at the same position.") + "<br><br>' <table>";

                                        notification.details = [];
                                        for (i = 0; i < affectations.length; i++) {
                                            notification.content = notification.content + "<tr>" +
                                                    "<td>" + i + 1 + "</td>" +
                                                    "<td>" + "XXXXXX" + "</td>" +
                                                    "<td> " + affectations[i].positionCode +
                                                    "<td> since: " + affectations[i].date + "</td>" + "</tr></table>";
                                            notification.details.push(affectations[i]);
                                        }

                                        notification.content = notification.content.replace("[1]", affectations.length);

                                        var filter = {
                                            type: 'admin',
                                            author: 'App',
                                            userID: users[m]._id,
                                            content: notification.content
                                        };

                                        Notification.findOneAndUpdate(filter, notification, {setDefaultsOnInsert: true, upsert: true, new : true}, function (err, result) {
                                            if (err) {
                                                log.error(err);
                                                audit.logEvent('[mongodb]', 'Position', 'patrol0', "", "", 'failed', "Mongodb attempted to alert after 05 years spent at one position");
                                                callback(err);
                                            } else {
                                                LoopA(m + 1);
                                            }
                                        });
                                    } else {

                                    }
                                }
                                LoopA(0);
                            }
                        });
                    } else {
                        callback(null);
                    }
                }
            });
        }
    })

};

/***
 * Find the person who held a posisition info
 * @param {type} code
 * @param {type} callback
 * @returns json
 */
exports.findPositionHolder = function (options, affectation, callback) {
    if (affectation) {
        exports.findPositionByCode(affectation.positionCode, function (err, position) {
            if (err) {
                log.error(err);
                callback(err);
            } else {
                if (options.beautify && options.beautify == false) {
                    affectation.position = position;
                    callback(null, affectation);
                } else {
                    beautify({actor: options.req.actor, language: options.req.actor.language, beautify: true, toExport: options.toExport}, [position], function (err, objects) {
                        if (err) {
                            callback(err);
                        } else {
                            affectation.position = objects[0];
                            callback(null, affectation);
                        }
                    });
                }
            }
        });
    } else {
        callback(null, affectation);
    }
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
    }).sort({lastModified: -1}).lean().exec(function (err, affectation) {
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
        positionCode: code
    }).sort({lastModified: -1}).lean().exec(function (err, positions) {
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

exports.findPositionByCodeAndBeautify = function (code, options, callback) {
    exports.findPositionByCode(code, function (err, position) {
        if (err) {
            log.error(err);
            callback(err);
        } else {
            beautify({actor: options.req.actor, language: options.req.actor.language, beautify: true}, [position], function (err, objects) {
                if (err) {
                    callback(err);
                } else {
                    callback(null, objects[0]);
                }
            });

        }
    });
}

exports.findPositionsByStructureCode = function (options, callback) {
    Position.find({
        code: {'$regex': new RegExp("^" + options.code)}
    }).lean().exec(function (err, positions) {
        if (err) {
            log.error(err);
            callback(err);
        } else {
            if (positions != null) {
                if (options.beautify) {
                    beautify(options, positions, function (err, objects) {
                        if (err) {
                            callback(err);
                        } else {
                            callback(null, objects);
                        }
                    });
                } else {
                    callback(null, positions);
                }

            } else {
                callback(null);
            }
        }
    });
}

exports.findPositionsByStructureId = function (options, callback) {
    Position.find({
        structureId: options._id
    }).lean().exec(function (err, positions) {
        if (err) {
            log.error(err);
            callback(err);
        } else {
            if (positions != null) {
                if (options.beautify) {
                    beautify(options, positions, function (err, objects) {
                        if (err) {
                            callback(err);
                        } else {
                            callback(null, objects);
                        }
                    });
                } else {
                    callback(null, positions);
                }

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
                callback(null);
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

exports.count = function (options, callback) {
    var filter = {};
    if (options.filter) {
        filter = options.filter;
    }
    Position.count(filter).exec(function (err, count) {
        if (err) {
            log.error(err);
            callback(err);
        } else {
            callback(null, count);
        }
    });
}


exports.api.delete = function (req, res) {
    if (req.actor) {

    } else {
        audit.logEvent('[anonymous]', 'Positions', 'Delete', '', '', 'failed', 'The actor was not authenticated');
        return res.send(401);
    }
}


function beautify(options, objects, callback) {
    var language = options.language || "en";
    language = language.toLowerCase();
    var gt = dictionary.translator(language);
    if (options.beautify && options.beautify === true) {
        var vacancies = [];
        function objectsLoop(o) {
            if (o < objects.length && objects[o]) {
                objects[o].name = ((language && language !== "" && objects[o][language] != undefined && objects[o][language] != "") ? objects[o][language] : objects[o]['en']);

                if (options.deepBeautify == true) {
                    var requiredSkills = objects[o].requiredSkills;
                    var value = "";
                    var requiredProfiles = objects[o].requiredProfiles;
                    for (var s in requiredSkills) {
                        if (requiredSkills[s] != "") {
                            value = value + "\r\n - " + dictionary.getValueFromJSON('../../resources/dictionary/personnel/skills.json', requiredSkills[s].trim(), language);
                        }
                    }
                    objects[o].requiredSkills = value;
                    value = "";
                    for (var s in requiredProfiles) {
                        if (requiredProfiles[s] != "") {
                            value = value + "\r\n - " + dictionary.getValueFromJSON('../../resources/dictionary/personnel/profile.json', requiredProfiles[s].trim(), language);
                        }
                    }

                    objects[o].requiredProfiles = value;
                }

                if (options.nomenclature && options.nomenclature == true) {//This mean that, wil don't need positions's occupants
                    objectsLoop(o + 1);
                } else if (options.structures && options.structures == false) {
                    exports.findPositionHelder(objects[o]._id, function (err, affectation) {
                        if (err) {
                            console.log(err);
                        } else {
                            var name = "";
                            if (affectation && affectation.personnel) {
                                name = affectation.personnel.name.family[0] + " " + affectation.personnel.name.given[0];
                            } else {
                                vacancies.push(objects[o]);
                            }
                            objects[o].helderName = name;

                            objectsLoop(o + 1);
                        }
                    });
                } else {
                    controllers.structures.findStructureByCode(objects[o].code.substring(0, objects[o].code.indexOf('P')), language, function (err, structure) {
                        if (err) {
                            log.error(err);
                            callback(err);
                        } else {
                            objects[o].structure = structure;
                            if (options.toExport == true) {
                                objectsLoop(o + 1);
                            } else {
                                exports.findPositionHelder(objects[o]._id, function (err, affectation) {
                                    if (err) {
                                        console.log(err);
                                    } else {
                                        var name = "";
                                        var matricule = "";
                                        if (affectation && affectation.personnel) {
                                            name = affectation.personnel.name.family[0] + " " + affectation.personnel.name.given[0];
                                            matricule = affectation.personnel.identifier;
                                            //Fill real profile and skills

                                            if (options.deepBeautify == true) {
                                                objects[o].profiles = affectation.personnel.profiles;
                                                objects[o].skills = affectation.personnel.skills;
                                                var realSkills = affectation.personnel.skills;
                                                var value = "";
                                                var realProfiles = affectation.personnel.profiles;
                                                if (realSkills) {
                                                    for (var s in realSkills) {
                                                        if (realSkills[s] != "") {
                                                            value = value + "\r\n - " + dictionary.getValueFromJSON('../../resources/dictionary/personnel/skills.json', realSkills[s].trim(), language);
                                                        }
                                                    }
                                                    objects[o].realSkills = value;
                                                }
                                                value = "";
                                                if (realProfiles) {
                                                    for (var s in realProfiles) {
                                                        if (realProfiles[s] != "") {
                                                            value = value + "\r\n - " + dictionary.getValueFromJSON('../../resources/dictionary/personnel/profile.json', realProfiles[s].trim(), language);
                                                        }
                                                    }
                                                    objects[o].realProfiles = value;
                                                }
                                            }
                                        } else {
                                            vacancies.push(objects[o]);
                                        }
                                        objects[o].helderName = name;
                                        objects[o].helderMatricule = matricule;


                                        objectsLoop(o + 1);
                                    }
                                });
                            }
                        }
                    });
                }
            } else {
                if (options.vacancies == true) {
                    callback(null, vacancies);
                } else {
                    callback(null, objects);
                }
            }
        }
        objectsLoop(0);
    } else {
        callback(null, objects);
    }
}

function buildXLSX(options, callback) {

    var add = 0;
    var defaultCellStyle = {font: {name: "Calibri", sz: 11}, fill: {fgColor: {rgb: "FFFFAA00"}}};
    var alpha = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z"];
    var columns = [];
    var a = 0;
    // Generate fields

    for (n = 0; n < options.fields.length; n++) {
        if (n <= alpha.length * 1 - 1) {
            columns.push(alpha[a]);
        } else if (n <= alpha.length * 2 - 1) {
            columns.push(alpha[0] + alpha[a]);
        } else if (n <= alpha.length * 3 - 1) {
            columns.push(alpha[1] + alpha[a]);
        } else if (n <= alpha.length * 4 - 1) {
            columns.push(alpha[2] + alpha[a]);
        } else if (n <= alpha.length * 5 - 1) {
            columns.push(alpha[3] + alpha[a]);
        } else {
            columns.push(alpha[4] + alpha[a]);
        }
        a++;
        if (a > 25) {
            a = 0;
        }
    }

    // create workbook & add worksheet
    var workbook = new Excel.Workbook();
    //2. Start holding the work sheet
    var ws = workbook.addWorksheet('Admineex - Postions list');

    //3. set style around A1
    ws.getCell('A1').value = options.title;
    ws.getCell('A1').border = {
        top: {style: 'thick', color: {argb: 'cccccc'}},
        left: {style: 'thick', color: {argb: 'cccccc'}},
        bottom: {style: 'thick', color: {argb: 'cccccc'}}
    };
    ws.getCell('A1').fill = {type: 'pattern', pattern: 'solid', fgColor: {argb: 'cccccc'}};
    ws.getCell('A1').font = {
        color: {argb: 'FFFFFF'},
        size: 16,
        bold: true
    };
    ws.getCell('A1').alignment = {vertical: 'middle', horizontal: 'center'};


    //4. Row 1
    for (i = 1; i < options.fieldNames.length; i++) {
        // For the last column, add right border
        if (i == options.fieldNames.length - 1) {
            ws.getCell(columns[i] + "1").border = {
                top: {style: 'thick', color: {argb: 'cccccc'}},
                right: {style: 'medium', color: {argb: 'cccccc'}},
                bottom: {style: 'thick', color: {argb: 'cccccc'}}
            };
        } else {//Set this border for the middle cells
            ws.getCell(columns[i] + "1").border = {
                top: {style: 'thick', color: {argb: 'cccccc'}},
                bottom: {style: 'thick', color: {argb: 'cccccc'}}
            };
        }
        ws.getCell(columns[i] + "1").fill = {type: 'pattern', pattern: 'solid', fgColor: {argb: 'cccccc'}};
        ws.getCell(columns[i] + "1").alignment = {vertical: 'middle', horizontal: 'center', "wrapText": true};
    }

    //5 Row 2
    for (i = 0; i < options.fieldNames.length; i++) {
        ws.getCell(columns[i] + "2").value = options.fieldNames[i];
        ws.getCell(columns[i] + "2").alignment = {vertical: 'middle', horizontal: 'left', "wrapText": true};
        ws.getCell(columns[i] + "2").border = {
            top: {style: 'thin', color: {argb: '00000000'}},
            bottom: {style: 'medium', color: {argb: '00000000'}},
            left: {style: 'thin', color: {argb: '00000000'}},
            right: {style: 'thin', color: {argb: '00000000'}}
        };
    }

    //6. Fill data rows    
    var nextRow = 3;
    for (i = 0; i < options.data.length; i++) {

        //6.1 Row 3 set the style
        ws.getCell('A' + nextRow).value = options.data[i].name + " - " + options.data[i].code;
        ws.getCell('A' + nextRow).border = {
            top: {style: 'thick', color: {argb: 'cccccc'}},
            left: {style: 'thick', color: {argb: 'cccccc'}},
            bottom: {style: 'thick', color: {argb: 'cccccc'}}
        };
        ws.getCell('A' + nextRow).fill = {type: 'pattern', pattern: 'solid', fgColor: {argb: 'cccccc'}};
        ws.getCell('A' + nextRow).font = {
            color: {argb: '000000'},
            size: 16,
            bold: true
        };
        ws.getCell('A' + nextRow).alignment = {vertical: 'middle', horizontal: 'center'};
        //6.2 Row 3 set the length
        for (r = 1; r < options.fieldNames.length; r++) {
            // For the last column, add right border
            if (r == options.fieldNames.length - 1) {
                ws.getCell(columns[r] + nextRow).border = {
                    top: {style: 'thick', color: {argb: 'cccccc'}},
                    right: {style: 'medium', color: {argb: 'cccccc'}},
                    bottom: {style: 'thick', color: {argb: 'cccccc'}}
                };
            } else {//Set this border for the middle cells
                ws.getCell(columns[r] + nextRow).border = {
                    top: {style: 'thick', color: {argb: 'cccccc'}},
                    bottom: {style: 'thick', color: {argb: 'cccccc'}}
                };
            }
            ws.getCell(columns[r] + nextRow).fill = {type: 'pattern', pattern: 'solid', fgColor: {argb: 'cccccc'}};
            ws.getCell(columns[r] + nextRow).alignment = {vertical: 'middle', horizontal: 'center', "wrapText": true};
        }
        /// 6.3 Merges Structure name cells
        ws.mergeCells('A' + nextRow + ":" + columns[options.fieldNames.length - 1] + nextRow);


        if (options.data[i].children) {
            nextRow = nextRow + 1;
            /// 6.4 fill data
            for (c = 0; c < options.data[i].children.length; c++) {
                //6.4.1 Row 3 set the style
                ws.getCell('A' + nextRow).value = options.data[i].children[c].code + " : " + options.data[i].children[c].fr;
                ws.getCell('A' + nextRow).border = {
                    top: {style: 'thick', color: {argb: 'cccccc'}},
                    left: {style: 'thick', color: {argb: 'cccccc'}},
                    bottom: {style: 'thick', color: {argb: 'cccccc'}}
                };
                ws.getCell('A' + nextRow).fill = {type: 'pattern', pattern: 'solid', fgColor: {argb: 'cccccc'}};
                ws.getCell('A' + nextRow).font = {
                    color: {argb: '000000'},
                    size: 16,
                    bold: true
                };
                ws.getCell('A' + nextRow).alignment = {vertical: 'middle', horizontal: 'center'};
                //6.4.2 Row 3 set the length
                for (r = 1; r < options.fieldNames.length; r++) {
                    // For the last column, add right border
                    if (r == options.fieldNames.length - 1) {
                        ws.getCell(columns[r] + nextRow).border = {
                            top: {style: 'thick', color: {argb: 'cccccc'}},
                            right: {style: 'medium', color: {argb: 'cccccc'}},
                            bottom: {style: 'thick', color: {argb: 'cccccc'}}
                        };
                    } else {//Set this border for the middle cells
                        ws.getCell(columns[r] + nextRow).border = {
                            top: {style: 'thick', color: {argb: 'cccccc'}},
                            bottom: {style: 'thick', color: {argb: 'cccccc'}}
                        };
                    }
                    ws.getCell(columns[r] + nextRow).fill = {type: 'pattern', pattern: 'solid', fgColor: {argb: 'A1a8a1a1'}};
                    ws.getCell(columns[r] + nextRow).alignment = {vertical: 'middle', horizontal: 'left', "wrapText": true};
                }
                /// 6.4.3 Merges Structure name cells
                ws.mergeCells('A' + nextRow + ":" + columns[options.fieldNames.length - 1] + nextRow);


                if (options.data[i].children[c].positions) {

                    for (k = 0; k < options.data[i].children[c].positions.length; k++) {

                        for (j = 0; j < options.fields.length; j++) {
                            var query = options.fields[j].split(".");
                            var value, field;

                            if (query.length == 1) {
                                value = options.data[i].children[c].positions[k][query[0]] || "";
                                field = query[0];
                            } else if (query.length == 2) {
                                if (options.data[i].children[c].positions[k][query[0]]) {
                                    value = options.data[i].children[c].positions[k][query[0]][query[1]] || "";
                                } else {
                                    value = "";
                                }
                                field = query[1];
                            } else if (query.length == 3) {
                                if (options.data[i].children[c].positions[k][query[0]] && options.data[i].children[c].positions[k][query[0]][query[1]]) {
                                    value = options.data[i].children[c].positions[k][query[0]][query[1]][query[2]] || "";
                                } else {
                                    value = "";
                                }
                                field = query[2];
                            }

                            if ((field == "testDate" || field == "requestDate" || field == "birthDate" || field == "positiveResultDate" || field == "startdate" || field == "cartridgeExpiryDate") && value != undefined && value != "" && value != null && value != "null") {
                                value = moment(value).format("DD/MM/YYYY");
                            }

                            ws.getCell(columns[j] + (nextRow + 1 + add)).value = (value != undefined && value != null && value != "null") ? value : "";
                            ws.getCell(columns[j] + (nextRow + 1 + add)).border = {
                                left: {style: 'thin', color: {argb: '00000000'}},
                                right: {style: 'thin', color: {argb: '00000000'}}
                            };

                            // Last row: Add border
                            if (i == options.data.length - 1) {
                                ws.getCell(columns[j] + (nextRow + 1 + add)).border.bottom = {style: 'thin', color: {argb: '00000000'}};
                            }
                        }
                        nextRow += 1;
                    }
                }
                nextRow += 1;
            }
            nextRow += 1;
        }
    }

    ///7. Set the columns width to 12
    for (k = 0; k < ws.columns.length; k++) {
        ws.columns[k].width = 30;
    }
    ws.columns[0].width = 20;
    ws.columns[1].width = 20;
//    ws.columns[2].width = 50;
//    ws.columns[3].width = 20;
//    ws.columns[4].width = 50;
//    ws.columns[5].width = 50;
//    ws.columns[6].width = 50;
//    ws.columns[7].width = 50;
//    ws.columns[8].width = 50;

    ///7. Merges cells
    ws.mergeCells('A1:' + columns[options.fieldNames.length - 1] + "1");


    // save workbook to disk
    var tmpFile = "./tmp/" + keyGenerator.generateKey() + ".xlsx";
    if (!fs.existsSync("./tmp")) {
        fs.mkdirSync("./tmp");
    }
    workbook.xlsx.writeFile(tmpFile).then(function () {
        callback(null, tmpFile);
    });
}