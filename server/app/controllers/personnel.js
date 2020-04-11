var Personnel = require('../models/personnel').Personnel;
var Affectation = require('../models/affectation').Affectation;
var audit = require('../utils/audit-log');
var log = require('../utils/log');
var mail = require('../utils/mail');
var _ = require('lodash');
var crypto = require('crypto');
var dictionary = require('../utils/dictionary');
var formidable = require("formidable");
var mysql = require('mysql');
var moment = require('moment');

// API
exports.api = {};

var controllers = {
    configuration: require('./configuration'),
    users: require('./users'),
    positions: require('./positions'),
    structures: require('./structures')
};

exports.upsert = function (fields, callback) {
    // Parse received fields
    var id = fields._id || '';
    var matricule = fields.matricule || '';
    var identifier = fields.identifier || '';
    var mysqlId = fields.mysqlId || '';

    var filter = {$and: []};
    if (id !== '') {
        filter.$and.push({
            "_id": id
        });
    } else if (identifier !== '') {
        filter.$and.push({
            "identifier": identifier
        });
    } else if (matricule !== '') {
        filter.$and.push({
            "identifier": matricule
        });
    } else if (matricule !== '') {
        filter.$and.push({
            "mysqlId": mysqlId
        });
    } else {
        filter = fields;
    }
    fields.lastModified = new Date();
    Personnel.findOneAndUpdate(filter, fields, {setDefaultsOnInsert: true, upsert: true, new : true}, function (err, result) {
        if (err) {
            log.error(err);
            audit.logEvent('[mongodb]', 'Personnel', 'Upsert', "", "", 'failed', "Mongodb attempted to update a personnel");
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
                audit.logEvent('[formidable]', 'Personnel', 'Upsert', "", "", 'failed', "Formidable attempted to parse personnel fields");
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
        audit.logEvent('[anonymous]', 'Personnel', 'Upsert', '', '', 'failed', 'The actor was not authenticated');
        return res.sendStatus(401);
    }
};

exports.DONOTUSETHISMETHODE = function (callback) {
    var con = mysql.createConnection({
        host: "localhost",
        user: "root",
        password: "",
        database: "sygepet"
    });

    con.connect(function (err) {
        if (err)
            throw err;
        con.query("SELECT * FROM personnel", function (err, personnels, fields) {
            if (err) {
                throw err;
            } else {
                var avoidedPersonnel = [];
                var eci = 1;
                function loopA(a) {
                    if (a < personnels.length) {
                        var personne = JSON.parse(JSON.stringify(personnels[a]));
                        var fieldPerso = {
                            "mysqlId": personne.id,
                            "identifier": personne.matricule.replace(/\s+/g, ''),
                            "name": {
                                "family": personne.nom,
                                "given": personne.prenom,
                                "maiden": personne.nomDeJeuneFille
                            },
                            "status": personne.idStatut,
                            "grade": personne.idGrade,
                            "category": personne.idCategorie,
                            "gender": personne.sexe,
                            "birthDate": new Date(personne.dateNaissance || null),
                            "birthPlace": personne.lieuNaissance,
                            "children": personne.nbreEnfant,
                            "maritalStatus": personne.situationFamiliale,
                            "father": "",
                            "mother": "",
                            "partner": "",
                            "telecom": [
                                {
                                    "system": "phone",
                                    "value": personne.telephone,
                                    "use": "home"
                                },
                                {
                                    "system": "email",
                                    "value": personne.email
                                }
                            ],
                            "address": [
                                {
                                    "country": 1,
                                    "region": personne.idRegion,
                                    "department": personne.idDepartement,
                                    "arrondissement": ""
                                }
                            ],
                            "cni": {
                                "identifier": personne.numCNI,
                                "date": new Date(personne.dateDelivCNI || null),
                                "city": personne.lieuDelivCNI,
                                "by": personne.cniDelivrePar
                            },
                            "created": new Date(personne.dateEnregistrement || null),
                            "lastModified": new Date(personne.miseajour || null)
                        };
                        if (personne.matricule == "ECI") {
                            fieldPerso.identifier = "ECI-" + eci;
                            eci = eci + 1;
                        }
                        exports.findByMatricule({matricule: fieldPerso.identifier}, function (err, personnel) {
                            if (err) {
                                log.error(err);
                                callback(err);
                            } else {
                                if (personnel != null) {// If this structure already exist
                                    if (!personnel.grade || personnel.grade == null || personnel.grade == "null" || !personnel.category || personnel.category == null || personnel.category == "null") {
                                        exports.upsert(fieldPerso, function (err, structure) {
                                            if (err) {
                                                log.error(err);
                                            } else {
                                                //console.log(personne.nom + "Inserted")
                                                loopA(a + 1);
                                            }
                                        });
                                    } else {
                                        avoidedPersonnel.push(personnel.identifier);
                                        loopA(a + 1);
                                    }
                                } else {
                                    exports.upsert(fieldPerso, function (err, structure) {
                                        if (err) {
                                            log.error(err);
                                        } else {
                                            //console.log(personne.nom + "Inserted")
                                            loopA(a + 1);
                                        }
                                    });
                                }
                            }
                        });

                    } else {
                        callback(null, avoidedPersonnel);
                    }
                }
                loopA(0);
                //console.log(result);
            }
        });
    })
}

exports.api.list = function (req, res) {

    var minify = false;
    if (req.params.minify && req.params.minify == "true") {
        minify = true;
    }
    var limit = 0;
    var skip = 0;
    if (req.params.limit && req.params.skip) {
        limit = parseInt(req.params.limit, 10);
        skip = parseInt(req.params.skip, 10);
    }

    if (req.actor) {
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
                                userStructureCodes.push(new RegExp("^" + structure.code + "-"));
                                LoopS(s + 1);
                            }
                        });
                    } else {
                        var options = {
                            minify: minify,
                            req: req,
                            limit: limit,
                            skip: skip,
                            search: req.params.search
                        }

                        if (options.req.actor.role == "1" || options.req.actor.role == "3" || options.req.actor.role == "4") {
                            Personnel.count({}).exec(function (err, count) {
                                if (err) {
                                    log.error(err);
                                    callback(err);
                                } else {
                                    exports.list(options, function (err, personnels) {
                                        if (err) {
                                            log.error(err);
                                            res.status(500).send(err);
                                        } else {
                                            personnels.sort(function (a, b) {
                                                if (a.fname < b.fname) {
                                                    return -1;
                                                } else
                                                if (a.fname > b.fname) {
                                                    return 1;
                                                } else
                                                    return 0;
                                            })
                                            return res.json({data: personnels, count: count});
                                        }
                                    });
                                }
                            });
                        } else {
                            var aggregat = [
                                {"$match": {"positionCode": {$in: userStructureCodes}}},
                                {$group: {_id: null, theCount: {$sum: 1}}},
                                {$project: {_id: 0}}
                            ];
                            q = Affectation.aggregate(aggregat);
                            q.exec(function (err, affectations) {
                                if (err) {
                                    log.error(err);
                                    callback(err);
                                } else {

                                    exports.list(options, function (err, personnels) {
                                        if (err) {
                                            log.error(err);
                                            res.status(500).send(err);
                                        } else {
                                            personnels.sort(function (a, b) {
                                                if (a.fname < b.fname) {
                                                    return -1;
                                                } else
                                                if (a.fname > b.fname) {
                                                    return 1;
                                                } else
                                                    return 0;
                                            })
                                            return res.json({data: personnels, count: affectations[0].theCount});
                                        }
                                    });
                                }
                            })
                        }

                    }
                }
                LoopS(0);
            }
        });








    } else {
        audit.logEvent('[anonymous]', 'Personnel', 'List', '', '', 'failed', 'The actor was not authenticated');
        return res.send(401);
    }
}

//Get all retired staff
exports.api.retired = function (req, res) {
    if (req.actor) {
        var query1 = {$and: []};
        query1.$and.push({"retirement.retirement": true});//Les personnes en age de retraite
        query1.$and.push({"retirement.notified": {$exists: true}});//..et notifiés
        query1.$and.push({$or: []});//..et non pas été prolongés
        query1.$and[2].$or.push({"retirement.extended": {$exists: false}});//non pas été prolongés
        query1.$and[2].$or.push({"retirement.extended": false});//non pas été prolongés

        var options = {
            query: query1,
            req: req,
            retiredOnly: true
        }
        exports.list(options, function (err, personnels) {
            if (err) {
                log.error(err);
                res.status(500).send(err);
            } else {
                return res.json(personnels);
            }
        });
    } else {
        audit.logEvent('[anonymous]', 'Personnel', 'retired', '', '', 'failed', 'The actor was not authenticated');
        return res.send(401);
    }
}

//This function is called each day at 6am and check and set the new retired people
exports.checkRetirement = function (callback) {
    var dateLimit = new Date(new Date().setFullYear(new Date().getFullYear() - 49));

    var query = {
        $and: [
            {
                "retirement.retirement": false
            },
            {
                "birthDate": {
                    $lte: moment(dateLimit).endOf('day')
                }
            }
        ]
    };

    var q = Personnel.find(query);
    q.exec(function (err, personnels) {
        if (err) {
            log.error(err);
            audit.logEvent('[mongodb]', 'Personnel', 'checkRetirement', '', '', 'failed', 'Mongodb attempted to retrieve personnel list');
            callback(err);
        } else {
            var candidates = [];
            function LoopA(a) {
                if (a < personnels.length && personnels[a]) {
                    var age = _calculateAge(new Date(personnels[a].birthDate));
                    if (personnels[a].grade && personnels[a].grade != "" && personnels[a].grade != null) {
                        if (personnels[a].status == "1") {//Civil servant
                            if (personnels[a].corps == "1") {//Case corps Enseignant 55 or 60 years
                                if ((personnels[a].grade == "1" || personnels[a].grade == "2") && age >= 60) {//PLEG or PCEG with age >= 60 -> retirement
                                    candidates.push(personnels[a][a]._id);
                                } else if (personnels[a].grade == "26" && age >= 55) { //If Instituteur and age >= 55 
                                    candidates.push(personnels[a]._id);
                                }
                            } else {
                                //Autre fonctionnaire de Categorie Ax  Bx, C, D dont l'age >=55ans 
                                if (age >= 55) {
                                    candidates.push(personnels[a]._id);
                                }
                            }

                        } else {// Contractual
                            if (personnels[a].category && personnels[a].category != null && personnels[a].category != "") {
                                var perCategory = dictionary.getValueFromJSON('../../resources/dictionary/personnel/status/' + personnels[a].status + '/categories.json', personnels[a].category, "en");
                                if (parseInt(personnels[a].category, 10) >= 7 && parseInt(personnels[a].category, 10) <= 13 && age >= 50) { //Personnel non fonctionnaire CAT 1 à CAT 7
                                    candidates.push(personnels[a]._id);
                                } else if (age >= 55) {
                                    candidates.push(personnels[a]._id); //Personnel non fonctionnaire CAT 8 à CAT 12
                                }
                            } else if (age >= 55) {
                                candidates.push(personnels[a]._id);//other
                            }
                        }
                    } else if (age >= 55) {
                        candidates.push(personnels[a]._id);//other
                    }
                    LoopA(a + 1);
                } else {
                    function LoopB(b) {
                        if (b < candidates.length) {
                            var fields = {
                                "_id": candidates[b],
                                "retirement.retirement": true
                            }
                            exports.upsert(fields, function (err) {
                                if (err) {
                                    log.error(err);
                                    callback(err);
                                } else {
                                    LoopB(b + 1);
                                }
                            });
                        } else {
                            callback(null, candidates.length);
                        }
                    }
                    LoopB(0);
                }
            }
            LoopA(0);
        }
    });
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
                            userStructureCodes.push(new RegExp("^" + structure.code + "-"));
                            LoopS(s + 1);
                        }
                    });
                } else {
                    if (options.req.actor.role == "1" || options.req.actor.role == "3" || options.req.actor.role == "4") {
                        var query = {};
                        if (options.query) {
                            query = options.query;
                        }
                        var concat = ["$name.family", " ", "$name.given"];
                        var concatMeta = ["$name.family", "$name.given", "$identifier"];
                        var sort = {"metainfo": 'asc'};
                        var q;
                        if (options.search && (options.search == "-" || options.search == "")) {
                            options.search = "";
                        }
                        var aggregate = [
                            {"$unwind": "$name"},
                            {"$unwind": "$name.family"},
                            {"$unwind": "$name.given"},
                            {"$addFields": {"fname": {$concat: concat}}},
                            {"$addFields": {"matricule": "$identifier"}},
                            {"$addFields": {"metainfo": {$concat: concatMeta}}}
                        ];
                        
                        if (options.search){
                            aggregate.push({$match: {$or: [{"metainfo": dictionary.makePattern(options.search)}]}})
                        }
                        
                        if ((options.skip + options.limit) > 0){
                            aggregate.push({"$limit": options.skip + options.limit})
                            aggregate.push({"$skip": options.skip})
                        }
                        q = Personnel.aggregate(aggregate);

                        q.exec(function (err, personnels) {
                            if (err) {
                                log.error(err);
                                audit.logEvent('[mongodb]', 'Personnel', 'List', '', '', 'failed', 'Mongodb attempted to retrieve personnel list');
                                callback(err);
                            } else {
                                if (options.minify == true) {
                                    personnels = JSON.parse(JSON.stringify(personnels));
                                    function LoopA(a) {
                                        if (a < personnels.length && personnels[a]) {
                                            controllers.positions.findPositionHelderBystaffId({req: options.req}, personnels[a]._id, function (err, affectation) {
                                                if (err) {
                                                    log.error(err);
                                                    callback(err);
                                                } else {
                                                    personnels[a].affectedTo = affectation;
                                                    LoopA(a + 1);
                                                }
                                            });
                                        } else {
                                            callback(null, personnels);
                                        }
                                    }
                                    LoopA(0);
                                } else {
                                    callback(null, personnels);
                                }
                            }
                        });
                    } else {//This view is restricted for structure manager (Role = 2)
                        var q;
                        var query = {positionCode: {$in: userStructureCodes}};
                        var concat = ["$AffectedPersonnal.name.family", " ", "$AffectedPersonnal.name.given"];
                        var concatMeta = ["$AffectedPersonnal.name.family", "$AffectedPersonnal.name.given", "$AffectedPersonnal.identifier", "$positionCode"];
                        var sort = {"name.family": 'asc'};
                        var aggregat = [
                            {"$match": {"positionCode": {$in: userStructureCodes}}},
                            {
                                "$lookup": {
                                    "from": "personnels",
                                    "localField": "personnelId",
                                    "foreignField": "_id",
                                    "as": "AffectedPersonnal"
                                }
                            },
                            {"$unwind": "$AffectedPersonnal"},
                            {"$unwind": "$AffectedPersonnal.name"},
                            {"$unwind": "$AffectedPersonnal.name.family"},
                            {"$unwind": "$AffectedPersonnal.name.given"},
                            {"$addFields": {"fname": {$concat: concat}}},
                            {"$addFields": {"matricule": "$identifier"}},
                            {"$addFields": {"metainfo": {$concat: concatMeta}}}
                        ]

                        //Filter by key word
                        if (options.search && options.search != "-" && options.search != "") {
                            aggregat.push({$match: {$or: [{"metainfo": dictionary.makePattern(options.search)}]}})
                        }
                        //If retiredOnly
                        if (options.retiredOnly) {
                            aggregat.push({"$addFields": {"retirement": "$AffectedPersonnal.retirement.retirement"}});
                            aggregat.push({"$addFields": {"notified": "$AffectedPersonnal.retirement.notified"}});
                            aggregat.push({"$addFields": {"extended": "$AffectedPersonnal.retirement.extended"}});
                            aggregat.push({"$addFields": {"positionCode": "$positionCode"}});
                            aggregat.push({"$match": {"retirement": true}});
                            aggregat.push({"$match": {"notified": {$exists: true}}});
                            aggregat.push({"$match": {$or: [{"extended": {$exists: false}}, {"extended": false}]}});
                        }
                        //If Limit per page
                        if (options.skip && options.limit) {
                            aggregat.push({"$limit": options.skip + options.limit})
                            aggregat.push({"$skip": options.skip})
                        }
                        //Start
                        q = Affectation.aggregate(aggregat);
                        q.exec(function (err, affectations) {
                            if (err) {
                                log.error(err);
                                callback(err);
                            } else {
                                var personnelsManaged = [];
                                var personne;

                                function LoopAf(a) {
                                    if (affectations && a < affectations.length) {
                                        personne = affectations[a].AffectedPersonnal;
                                        personne.fname = affectations[a].fname;
                                        personne.metainfo = affectations[a].metainfo;
                                        controllers.positions.findPositionByCodeAndBeautify(affectations[a].positionCode, options, function (err, position) {
                                            if (err) {
                                                log.error(err);
                                                callback(err);
                                            } else {
                                                personne.affectedTo = {
                                                    position: position
                                                };
                                                personnelsManaged.push(personne);
                                                LoopAf(a + 1);
                                            }
                                        });
                                    } else {
                                        callback(null, personnelsManaged);
                                    }
                                }
                                LoopAf(0);
                            }
                        });
                    }
                }
            }
            LoopS(0);
        }
    });
}


exports.api.search = function (req, res) {
    if (req.actor) {
        if (req.params.text == undefined) {
            audit.logEvent(req.actor.id, 'Personnel', 'Search', '', '', 'failed',
                    'The actor could not read the personnel timeline because one or more params of the request was not defined');
            return res.sendStatus(400);
        } else {

            var name = req.params.text || '';
            var concat;

            concat = ["$name.family", " ", "$name.given"];
            var concatMeta = ["$name.family", "$name.given", "$identifier"];

            if (name !== '') {
                Personnel.aggregate([
                    {"$unwind": "$name"},
                    {"$unwind": "$name.family"},
                    {"$unwind": "$name.given"},
                    {"$addFields": {"fname": {$concat: concat}}},
                    {"$addFields": {"matricule": "$identifier"}},
                    {"$addFields": {"metainfo": {$concat: concatMeta}}},
                    {$match: {$or: [{"metainfo": dictionary.makePattern(name)}]}}
                ]).exec(function (err, personnels) {
                    if (err) {
                        log.error(err);
                        audit.logEvent('[mongodb]', 'Personnel', 'Search', '', '', 'failed', 'Mongodb attempted to retrieve a personnel');
                        return res.sendStatus(500);
                    } else {
                        personnels = JSON.parse(JSON.stringify(personnels));
                        beautify({req: req, language: req.actor.language, beautify: true}, personnels, function (err, objects) {
                            if (err) {
                                return res.status(500).send(err);
                            } else {
                                return res.json(objects);
                            }
                        });
                    }
                });

            } else {
                return res.json();
            }
        }
    } else {
        audit.logEvent('[anonymous]', 'Personnel', 'Search', '', '', 'failed', 'The actor was not authenticated');
        return res.send(401);
    }
}

exports.api.checkExistance = function (req, res) {
    if (req.actor) {
        if (req.params.mat == undefined) {
            audit.logEvent(req.actor.id, 'Personnel', 'checkExistance', '', '', 'failed',
                    'The actor could not read the personnel timeline because one or more params of the request was not defined');
            return res.sendStatus(400);
        } else {

            var mat = req.params.mat || '';
            var concat;

            concat = ["$name.family", " ", "$name.given"];

            if (mat !== '') {
                Personnel.count({"identifier": mat}).exec(function (err, count) {
                    if (err) {
                        log.error(err);
                        audit.logEvent('[mongodb]', 'Personnel', 'checkExistance', '', '', 'failed', 'Mongodb attempted to checkExistance of identifier');
                        return res.sendStatus(500);
                    } else {
                        return res.json(count);
                    }
                });
            } else {
                return res.json(0);
            }
        }
    } else {
        audit.logEvent('[anonymous]', 'Personnel', 'Search', '', '', 'failed', 'The actor was not authenticated');
        return res.send(401);
    }
}

/**
 * This function output the list of staff corresponds to geven position
 * @param {type} req
 * @param {type} res
 * @returns {unresolved}
 */
exports.api.eligibleTo = function (req, res) {
    if (req.actor) {
        if (req.params.id == undefined) {
            audit.logEvent(req.actor.id, 'Personnel', 'EligibleTo', '', '', 'failed',
                    'The actor could not read the personnel eligible because one or more params of the request was not defined');
            return res.sendStatus(400);
        } else {

            controllers.positions.find({_id: req.params.id}, function (err, position) {
                if (err) {
                    log.error(err);
                    return res.sendStatus(400);
                } else {
                    var requiredProfiles = position.requiredProfiles;
                    var requiredSkills = position.requiredSkills;

                    if ((requiredProfiles && requiredProfiles.length > 0) || (requiredSkills && requiredSkills.length > 0)) {
                        var concat;

                        concat = ["$name.family", " ", "$name.given"];

                        var query = {$or: []};
                        var sort = {"name.family": 'asc'};
                        query.$or.push({"profiles": {"$in": requiredProfiles}});
                        query.$or.push({"skills": {"$in": requiredSkills}});

                        var q = Personnel.find(query).sort(sort).limit(0).skip(0).lean();
                        q.exec(function (err, personnels) {
                            if (err) {
                                log.error(err);
                                audit.logEvent('[mongodb]', 'Personnel', 'EligibleTo', '', '', 'failed', 'Mongodb attempted to retrieve a personnel');
                                return res.sendStatus(500);
                            } else {
                                personnels = JSON.parse(JSON.stringify(personnels));
                                beautify({req: req, language: req.actor.language, beautify: true, eligibleTo: position._id, position: position}, personnels, function (err, objects) {
                                    if (err) {
                                        return res.status(500).send(err);
                                    } else {
                                        return res.json(objects);
                                    }
                                });
                            }
                        });
                    } else {
                        return res.json();
                    }
                }
            });
        }
    } else {
        audit.logEvent('[anonymous]', 'Personnel', 'Search', '', '', 'failed', 'The actor was not authenticated');
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
            var filter = {
                _id: req.params.id
            };
            var isBeautify = false;
            if (req.params.beautify && req.params.beautify == "true") {
                isBeautify = true;
            }

            exports.read(filter, function (err, personnel) {
                if (err) {
                    return res.status(500).send(err);
                } else {
                    beautify({req: req, language: req.actor.language, beautify: isBeautify}, [personnel], function (err, objects) {
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

exports.read = function (options, callback) {
    Personnel.findOne({
        _id: options._id
    }).lean().exec(function (err, result) {
        if (err) {
            log.error(err);
            callback(err);
        } else {
            if (result) {
                callback(null, result);
            } else {
                callback(null);
            }
        }
    });
}

exports.findByMatricule = function (options, callback) {
    Personnel.findOne({
        identifier: options.matricule
    }).lean().exec(function (err, result) {
        if (err) {
            log.error(err);
            callback(err);
        } else {
            if (result) {
                callback(null, result);
            } else {
                callback(null);
            }
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

function _calculateAge(birthday) { // birthday is a date
    var ageDifMs = Date.now() - birthday.getTime();
    var ageDate = new Date(ageDifMs); // miliseconds from epoch
    return Math.abs(ageDate.getUTCFullYear() - 1970);
}

function beautify(options, personnels, callback) {
    var language = options.language || "";
    language = language.toLowerCase();
    var gt = dictionary.translator(language);
    if (options.beautify && options.beautify === true) {
        //Address
        personnels = controllers.configuration.beautifyAddress({language: language}, personnels);
        function LoopA(a) {
            if (a < personnels.length && personnels[a]) {
                controllers.positions.findPositionHelderBystaffId({req: options.req}, personnels[a]._id, function (err, affectation) {
                    if (err) {
                        log.error(err);
                        callback(err);
                    } else {

                        var status = (personnels[a].status) ? personnels[a].status : "";
                        var grade = (personnels[a].grade) ? personnels[a].grade : "";
                        var category = (personnels[a].category) ? personnels[a].category : "";

                        var highestLevelEducation = (personnels[a].qualifications) ? personnels[a].qualifications.highestLevelEducation : "";
                        var natureActe = (personnels[a].history) ? personnels[a].history.nature : "";
                        var corps = personnels[a].corps;

                        personnels[a].age = _calculateAge(new Date(personnels[a].birthDate));

                        personnels[a].status = dictionary.getValueFromJSON('../../resources/dictionary/personnel/status.json', status, language);

                        if (status != "") {
                            personnels[a].grade = dictionary.getValueFromJSON('../../resources/dictionary/personnel/status/' + status + '/grades.json', parseInt(grade, 10), language);
                            personnels[a].category = dictionary.getValueFromJSON('../../resources/dictionary/personnel/status/' + status + '/categories.json', category, language);

                            var thisgrade = dictionary.getJSONById('../../resources/dictionary/personnel/status/' + status + '/grades.json', parseInt(grade, 10), language);
                            if (thisgrade) {
                                corps = ((personnels[a].corps) ? personnels[a].corps : thisgrade.corps);
                            }

                            if (corps && corps != "") {
                                personnels[a].corps = dictionary.getValueFromJSON('../../resources/dictionary/personnel/status/' + status + '/corps.json', corps + "", language);
                            }
                        }

                        if (highestLevelEducation != "") {
                            personnels[a].qualifications.highestLevelEducation = dictionary.getValueFromJSON('../../resources/dictionary/personnel/educationLevels.json', parseInt(highestLevelEducation, 10), language);
                        }

                        if (natureActe != "") {
                            personnels[a].history.nature = dictionary.getValueFromJSON('../../resources/dictionary/acts/natures.json', natureActe, language);
                        }


                        var situations = personnels[a].situations;
                        if (situations && situations.length > 0) {
                            situations.sort(function (a, b) {
                                return new Date(b.date) - new Date(a.date);
                            });
                            for (var i in situations) {
                                situations[i].value = dictionary.getValueFromJSON('../../resources/dictionary/personnel/situations.json', situations[i].situation, language);
                            }
                            personnels[a].situations = situations;
                        }

                        var sanctions = personnels[a].sanctions;
                        if (sanctions && sanctions.length > 0) {
                            sanctions.sort(function (a, b) {
                                if (a && b && a != null && b != null && a != "null" && b != "null") {
                                    return new Date(b.date) - new Date(a.date);
                                } else {
                                    return 1;
                                }

                            });
                            for (var i in sanctions) {
                                if (sanctions[i]) {
                                    sanctions[i].value = dictionary.getValueFromJSON('../../resources/dictionary/personnel/sanctions.json', sanctions[i].sanction, language);
                                }
                            }
                            personnels[a].sanctions = sanctions;
                        }

                        personnels[a].affectedTo = affectation;
                        personnels[a].skillsCorresponding = 0;
                        personnels[a].profilesCorresponding = 0;

                        //ASKED BY DGTCFM ONLY FOR TRESOR STAFF
                        //TODO: Ajouter le corps du mestier dans chaque poste. Example : Tresor
                        //Ainsi, il nous suffira de comparer le corps réel du personnel et le corps du metier (lié au poste)
                        if (corps == "2") {//Corps des Régies Financières Trésor
                            personnels[a].skillsCorresponding = 40;
                            personnels[a].profilesCorresponding = 40;
                        }

                        var userProfiles = personnels[a].profiles;
                        var userSkills = personnels[a].skills;

                        var requiredProfiles = [];
                        var requiredSkills = [];

                        if (options.eligibleTo && options.position) {//Case we compute the eligibility, take it from the concerned position
                            requiredProfiles = options.position.requiredProfiles;
                            requiredSkills = options.position.requiredSkills;
                        } else {
                            if (personnels[a].affectedTo && personnels[a].affectedTo.position) {//Normal case. We just compute corresponding percentages
                                requiredProfiles = personnels[a].affectedTo.position.requiredProfiles;
                                requiredSkills = personnels[a].affectedTo.position.requiredSkills;
                            }
                        }

                        if (requiredProfiles && requiredProfiles.length > 0) {
                            var count = 0;
                            if (userProfiles && userProfiles.length > 0) {
                                for (var i in userProfiles) {
                                    if (requiredProfiles.includes(userProfiles[i])) {
                                        count = count + 1;
                                    }
                                }
                            }
                            personnels[a].profilesCorresponding += Number((100 * (count / requiredProfiles.length)).toFixed(1));
                            if (personnels[a].profilesCorresponding > 100) {
                                personnels[a].profilesCorresponding = 100;
                            }
                        }

                        if (requiredSkills && requiredSkills.length > 0) {
                            var count = 0;
                            if (userSkills && userSkills.length > 0) {
                                for (var i in userSkills) {
                                    if (requiredSkills.includes(userSkills[i])) {
                                        count = count + 1;
                                    }
                                }
                            }
                            personnels[a].skillsCorresponding += Number((100 * (count / requiredProfiles.length)).toFixed(1));
                            if (personnels[a].skillsCorresponding > 100) {
                                personnels[a].skillsCorresponding = 100;
                            }
                        }

                        personnels[a].corresponding = Number(((personnels[a].skillsCorresponding + personnels[a].profilesCorresponding) / 2).toFixed(1));



                        LoopA(a + 1);
                    }
                });
            } else {
                callback(null, personnels);
            }
        }

        LoopA(0);
    } else {
        callback(null, personnels);
    }
}