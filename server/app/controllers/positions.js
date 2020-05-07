var Position = require('../models/position').Position;
var Affectation = require('../models/affectation').Affectation;
var Notification = require('../models/notification').Notification;
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
var moment = require('moment');
var util = require('util');

// API
exports.api = {};

var controllers = {
    configuration: require('./configuration'),
    structures: require('./structures'),
    personnel: require('./personnel'),
    users: require('./users')
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
                            date: fields.startDate,
                            lastModified: new Date()
                        };
                        var filter = {
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
                                            } else if (perso.history && !perso.history.positions) {
                                                perso.history.positions = [];
                                            } else if (perso.history && util.isArray(perso.history.positions) && perso.history.positions.length > 0) {
                                                for (var i in perso.history.positions) {
                                                    perso.history.positions[i].isCurrent = false;
                                                }
                                            } else {
                                                perso.history.positions = [];
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
        var restriction = req.params.restric;
        var limit = 0;
        var skip = 0;
        if (req.params.limit && req.params.skip) {
            limit = parseInt(req.params.limit, 10);
            skip = parseInt(req.params.skip, 10);
        }


        var filter = {};
        if (req.params.id && req.params.id != "-1") {
            filter = {$and: []};
            filter.$and.push({
                "code": new RegExp("^" + req.params.id.toUpperCase())
            });
        }

        Position.count(filter).exec(function (err, count) {
            if (err) {
                log.error(err);
                callback(err);
            } else {
                Position.find(filter).limit(limit).skip(skip).lean().exec(function (err, result) {
                    if (err) {
                        log.error(err);
                        audit.logEvent('[mongodb]', 'Positions', 'List', '', '', 'failed', 'Mongodb attempted to retrieve positions list');
                        return res.status(500).send(err);
                    } else {
                        var positions = JSON.parse(JSON.stringify(result));
                        var positionsFiltered = [];
                        function LoopA(o) {
                            if (o < positions.length) {

                                exports.findPositionHelder(positions[o]._id, function (err, affectation) {
                                    if (err) {
                                        audit.logEvent('[mongodb]', 'Positions', 'findPositionHelder', "code", req.params.code, 'failed', "Mongodb attempted to find the affection detail");
                                        return res.status(500).send(err);
                                    } else {
                                        if (affectation) {
                                            positions[o].actualEffective = 1;//We can also put the real effective in case we are using effective for position
                                        } else {
                                            positions[o].actualEffective = 0;
                                        }
                                        positions[o].vacancies = 1 - positions[o].actualEffective;

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
                                        return res.json({data: objects, count: count});
                                    }
                                });
                            }
                        }
                        LoopA(0);
                    }
                });
            }
        });

    } else {
        audit.logEvent('[anonymous]', 'Projects', 'List', '', '', 'failed', 'The actor was not authenticated');
        return res.send(401);
    }
}

exports.list = function (options, callback) {
    filter = {};
    Position.find(filter, function (err, result) {
        if (err) {
            log.error(err);
            callback(err);
        } else {
            var positions = JSON.parse(JSON.stringify(result));
            beautify(options, positions, function (err, objects) {
                if (err) {
                    callback(err);
                } else {
                    callback(null, objects);
                }
            });
        }
    });
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


exports.INITPOSITIONDATAFROMJSON = function (path, callback) {
    var initialize = controllers.configuration.getConf().initialize;

    String.prototype.isNumber = function () {
        return /^\d+$/.test(this);
    }
    String.prototype.capitalize = function () {
        return this.charAt(0).toUpperCase() + this.slice(1);
    }

    if (initialize.positions) {
        var positions = dictionary.getJSONList("../../resources/dictionary/tmpData/" + path + "/fulldata.json", "en");
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
 * Alert after 05 years spent at one position
 * @param {type} code
 * @param {type} callback
 * @returns json
 */
exports.patrol0 = function (callback) {
    var query = {$and: []};
    var d = new Date();
    var pastYear = d.getFullYear() - 5;
    d.setFullYear(pastYear);

    query.$and.push({
        'date': {
            $lte: moment(d).startOf('day')
        }
    });

    Affectation.find(query).lean().exec(function (err, affectations) {
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
        positionCode: code
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
        audit.logEvent('[anonymous]', 'Projects', 'Delete', '', '', 'failed', 'The actor was not authenticated');
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