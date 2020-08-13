var Personnel = require('../models/personnel').Personnel;
var Affectation = require('../models/affectation').Affectation;
var audit = require('../utils/audit-log');
var log = require('../utils/log');
var mail = require('../utils/mail');
var fs = require('fs');
var Excel = require('exceljs');
var keyGenerator = require("generate-key");
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

exports.DONOTUSETHISMETHODE = function (callback) {//Insert a user from mysql database
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
    var filtersParam = {}
    if (req.params.filters && req.params.filters != "-" && req.params.filters != "") {
        filtersParam = JSON.parse(req.params.filters);
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
                            search: req.params.search,
                            filters: filtersParam
                        }

                        if (options.req.actor.role == "1" || options.req.actor.role == "3" || options.req.actor.role == "4") {
                            var projection = {_id: 1, name: 1, "retirement": 1, matricule: 1, metainfo: 1, gender: 1, grade: 1, category: 1, cni: 1, status: 1, identifier: 1, corps: 1, telecom: 1, fname: 1, "affectation._id": 1, "affectation.positionCode": 1, "situations": 1, };
                            options.projection = projection;
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
                                    return res.json({data: personnels, count: 0});
                                }
                            });

                        } else {
                            var aggregat = [
                                {"$match": {
                                        "positionCode": {$in: userStructureCodes},
                                        "retirement.notified": {$exists: false}
                                    }
                                },
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
                            var situations = candidates[b].situations;
                            var newSituation = {
                                situation: "12",
                                numAct: "#", //Auto genereted by the bot
                                nature: "#"//Auto genereted by the bot
                            }
                            if (situations) {
                                situations.push(newSituation)
                            } else {
                                situations = [];
                                situations.push(newSituation)
                            }

                            var fields = {
                                "_id": candidates[b],
                                "retirement.retirement": true,
                                "situations": situations
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
                            if (candidates.length > 0) {
                                audit.logEvent('[mongodb]', 'Personnel', 'checkRetirement', '', '', 'failed', "Admineex found " + candidates.length + ' new people of retirement age.');
                            }
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

                        var aggregate = [];
                        aggregate.push({"$unwind": "$name"});
                        aggregate.push({"$unwind": {path: "$name.family", preserveNullAndEmptyArrays: true}});
                        aggregate.push({"$unwind": {path: "$name.given", preserveNullAndEmptyArrays: true}});
                        aggregate.push({"$unwind": {path: "$retirement", preserveNullAndEmptyArrays: true}});

                        aggregate.push({"$addFields": {"fname": {$concat: concat}}});
                        aggregate.push({"$addFields": {"matricule": "$identifier"}});
                        aggregate.push({"$addFields": {"metainfo": {$concat: concatMeta}}});
                        aggregate.push(
                                {
                                    $lookup: {
                                        from: 'affectations',
                                        localField: '_id',
                                        foreignField: 'personnelId',
                                        as: 'affectation',
                                    }
                                }
                        );


                        if (options.projection) {
                            projection = {
                                $project: options.projection
                            };
                            aggregate.push(projection);
                        }

                        console.log()

                        //Filter by key word
                        if (options.search) {
                            aggregate.push({$match: {$or: [{"metainfo": dictionary.makePattern(options.search)}]}})
                        }
                        //Set the filters
                        if (options.filters) {
                            if (options.filters.structure && options.filters.structure != "-" && options.filters.structure != "") {
                                aggregate.push({$match: {$or: [{"affectation.0.positionCode": new RegExp("^" + options.filters.structure)}]}})
                            }

                            if (options.filters.gender && options.filters.gender != "-" && options.filters.gender != "") {
                                aggregate.push({$match: {gender: options.filters.gender}});
                            }

                            if (options.filters.status && options.filters.status != "-" && options.filters.status != "") {
                                aggregate.push({$match: {status: options.filters.status}});
                            }

                            if (options.filters.grade && options.filters.grade != "-" && options.filters.grade != "") {
                                aggregate.push({$match: {grade: options.filters.grade}});
                            }

                            if (options.filters.category && options.filters.category != "-" && options.filters.category != "") {
                                aggregate.push({$match: {category: options.filters.category}});
                            }

                            if (options.filters.situation && options.filters.situation != "-" && options.filters.situation != "") {
                                if (options.filters.situation == "12") {
                                    aggregate.push({"$match": {"retirement.retirement": true}});
                                    aggregate.push({"$match": {"retirement.notified": {$exists: false}}});
                                    aggregate.push({"$match": {$or: [{"retirement.extended": {$exists: false}}, {"retirement.extended": false}]}});
                                } else if (options.filters.situation == "0") {//Active people
                                    //Check if correspond
                                } else {
                                    aggregate.push({$sort: {"situations.lastModified": -1}});
                                    aggregate.push({$match: {"situations.0.situation": options.filters.situation}});
                                }
                            }
                        }

                        //If retiredOnly
                        if (options.retiredOnly) {
                            aggregate.push({"$match": {"retirement.retirement": true}});
                            aggregate.push({"$match": {"retirement.notified": {$exists: false}}});
                            aggregate.push({"$match": {$or: [{"retirement.extended": {$exists: false}}, {"retirement.extended": false}]}});
                        } else {
                            aggregate.push({"$match": {"retirement.notified": {$exists: false}}});
                        }

                        if ((options.skip + options.limit) > 0) {
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

                                if (options.minify == true || options.retiredOnly) {
                                    personnels = JSON.parse(JSON.stringify(personnels));
                                    function LoopA(a) {
                                        if (a < personnels.length && personnels[a]) {
                                            if (options.minify === true) {
                                                var options2 = {
                                                    req: options.req
                                                };
                                                options2.beautifyPosition = true;
                                                if (options.beautifyPosition == false) {
                                                    options2.beautifyPosition = false;
                                                }
                                                //console.log("Perso", options.toExport)
                                                if (options.toExport == true) {
                                                    options2.toExport = true;
                                                }
                                                controllers.positions.findPositionHolder(options2, personnels[a].affectation[0], function (err, affectation) {
                                                    if (err) {
                                                        log.error(err);
                                                        callback(err);
                                                    } else {
                                                        personnels[a].affectedTo = affectation;

                                                        var status = (personnels[a].status) ? personnels[a].status : "";
                                                        var grade = (personnels[a].grade) ? personnels[a].grade : "";
                                                        var actif = (personnels[a].retirement.retirement == false) ? "Actif" : "En age de retraite";
                                                        var language = options.language || "";
                                                        language = language.toLowerCase();
                                                        var status = (personnels[a].status) ? personnels[a].status : "";
                                                        var grade = (personnels[a].grade) ? personnels[a].grade : "";
                                                        var category = (personnels[a].category) ? personnels[a].category : "";
                                                        personnels[a].active = actif;
                                                        personnels[a].status = dictionary.getValueFromJSON('../../resources/dictionary/personnel/status.json', status, language);
                                                        if (status != "") {
                                                            personnels[a].grade = dictionary.getValueFromJSON('../../resources/dictionary/personnel/status/' + status + '/grades.json', parseInt(grade, 10), language);
                                                            personnels[a].category = dictionary.getValueFromJSON('../../resources/dictionary/personnel/status/' + status + '/categories.json', category, language);
                                                        }
                                                        personnels[a].age = _calculateAge(new Date(personnels[a].birthDate));
                                                        LoopA(a + 1);
                                                    }
                                                });
                                            } else {
                                                var status = (personnels[a].status) ? personnels[a].status : "";
                                                var grade = (personnels[a].grade) ? personnels[a].grade : "";
                                                var language = options.language || "";
                                                language = language.toLowerCase();
                                                personnels[a].grade = dictionary.getValueFromJSON('../../resources/dictionary/personnel/status/' + status + '/grades.json', parseInt(grade, 10), language);
                                                personnels[a].age = _calculateAge(new Date(personnels[a].birthDate));
                                                LoopA(a + 1);
                                            }

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




exports.api.export = function (req, res) {
    if (req.actor) {
        if (req.params.filters == undefined) {
            audit.logEvent(req.actor.id, 'Personnel', 'Export', '', '', 'failed',
                    'The actor could not export the personnel list because one or more params of the request was not defined');
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
            var option = {
                actor: req.actor, language: req.actor.language, beautify: true, filter: filter
            }
            controllers.structures.list(option, function (err, structures) {
                if (err) {
                    log.error(err);
                    res.status(500).send(err);
                } else {
                    //console.log(structures)
                    var options = {
                        minify: true,
                        req: req,
                        filters: filtersParam,
                        language: req.actor.language,
                        beautifyPosition: false,
                        toExport: true
                    }
                    var projection = {_id: 1, name: 1, "retirement": 1, matricule: 1, metainfo: 1, gender: 1, grade: 1, category: 1, cni: 1, status: 1, identifier: 1, corps: 1, telecom: 1, fname: 1, "affectation._id": 1, "affectation.positionCode": 1, "affectation.date": 1, "situations": 1, };
                    options.projection = projection;

                    exports.list(options, function (err, personnels) {
                        if (err) {
                            log.error(err);
                            res.status(500).send(err);
                        } else {
                            //console.log(personnels[6].affectedTo.position.structure);
                            personnels.sort(function (a, b) {
                                if (a.fname < b.fname) {
                                    return -1;
                                } else
                                if (a.fname > b.fname) {
                                    return 1;
                                } else
                                    return 0;
                            })

                            var groupedPersonnelByStructureChildren = _.groupBy(personnels, function (item) {
                                if (item.affectedTo && item.affectedTo.position && item.affectedTo.position.structureId) {
                                    return item.affectedTo.position.structureId;
                                } else {
                                    return "undefined";
                                }

                            });
                            //console.log(groupedPersonnelByStructureChildren["undefined"])
                            //console.log(z)

                            for (var s in structures) {
                                if (structures[s].children) {
                                    for (var c in structures[s].children) {
                                        structures[s].children[c].personnels = groupedPersonnelByStructureChildren[structures[s].children[c]._id]

                                    }
                                }
                            }
                            if (groupedPersonnelByStructureChildren["undefined"]) {
                                var undefinedStructure = {
                                    code: "000",
                                    name: "STRUCTURE INCONNUE",
                                    children: [{
                                            code: "000 - 0",
                                            fr: "Inconue",
                                            personnels: groupedPersonnelByStructureChildren["undefined"]
                                        }]
                                }
                                structures.push(undefinedStructure);
                            }

                            //console.log(z);
                            var gt = dictionary.translator(req.actor.language);
                            //Build XLSX
                            var options = buildFields(req.actor.language, "fieldNames.json");
                            options.data = structures;
                            options.title = gt.gettext("Admineex: Liste du personnel");
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

function buildFields(language, file) {
    var fields = require("../../resources/dictionary/export/" + file);
    var options = {fields: [], fieldNames: []};
    for (i = 0; i < fields.length; i++) {
        options.fieldNames.push(((language != "" && fields[i][language] != undefined && fields[i][language] != "") ? fields[i][language] : fields[i]['en']));
        options.fields.push(fields[i].id);
    }
    return options;
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
            var options = {
                position: {
                    id: req.params.id
                },
                req: req
            }

            exports.eligibleTo(options, function (err, objects) {
                if (err) {
                    log.error(err);
                    return res.sendStatus(400);
                } else {
                    return res.json(objects);
                }
            });
        }
    } else {
        audit.logEvent('[anonymous]', 'Personnel', 'Search', '', '', 'failed', 'The actor was not authenticated');
        return res.send(401);
    }
}

/**
 * This function download the list of staff corresponds to geven position
 * @param {type} req
 * @param {type} res
 * @returns {unresolved}
 */
exports.api.downloadEligibleTo = function (req, res) {
    if (req.actor) {
        if (req.params.id == undefined) {
            audit.logEvent(req.actor.id, 'Personnel', 'EligibleTo', '', '', 'failed',
                    'The actor could not read the personnel eligible because one or more params of the request was not defined');
            return res.sendStatus(400);
        } else {
            var options = {
                position: {
                    id: req.params.id
                },
                req: req
            }

            exports.eligibleTo(options, function (err, objects) {
                if (err) {
                    log.error(err);
                    return res.sendStatus(400);
                } else {
                    //console.log(z);
                    var gt = dictionary.translator(req.actor.language);
                    //Build XLSX
                    var options = buildFields(req.actor.language, "fieldNamesEligible.json");
                    options.data = objects;
                    options.title = gt.gettext("Admineex: Liste des personnes éligibles au poste de: ");
                    buildXLSX2(options, function (err, filePath) {
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
    } else {
        audit.logEvent('[anonymous]', 'Personnel', 'Search', '', '', 'failed', 'The actor was not authenticated');
        return res.send(401);
    }
}


exports.eligibleTo = function (options, callback) {
    controllers.positions.find({_id: options.position.id}, function (err, position) {
        if (err) {
            log.error(err);
            callback(err);
        } else {
            console.log(position)
            var requiredProfiles = position.requiredProfiles;
            var requiredSkills = position.requiredSkills;

            if ((requiredProfiles && requiredProfiles.length > 0) || (requiredSkills && requiredSkills.length > 0)) {
                var concat;

                concat = ["$name.family", " ", "$name.given"];

                var query = {$or: []};
                var sort = {"name.family": 'asc'};
                query.$or.push({"profiles": {"$in": requiredProfiles}});
                query.$or.push({"skills": {"$in": requiredSkills}});
                var projection = {
                    _id: 1,
                    name: 1,
                    profiles: 1,
                    skills: 1,
                    identifier: 1,
                    grade: 1,
                    corps: 1,
                    status: 1
                };
                var q = Personnel.find(query, projection).sort(sort).limit(0).skip(0).lean();
                q.exec(function (err, personnels) {
                    if (err) {
                        log.error(err);
                        audit.logEvent('[mongodb]', 'Personnel', 'EligibleTo', '', '', 'failed', 'Mongodb attempted to retrieve a personnel');
                        callback(err);
                    } else {
                        console.log(personnels)
                        personnels = JSON.parse(JSON.stringify(personnels));
                        beautify({req: options.req, language: options.req.actor.language, beautify: true, eligibleTo: position._id, position: position, eligible: true}, personnels, function (err, objects) {
                            if (err) {
                                callback(err);
                            } else {
                                callback(null, objects);
                            }
                        });
                    }
                });
            } else {
                callback(null, []);
            }
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
    var ws = workbook.addWorksheet('Admineex export');

    //3. set style around A1
    ws.getCell('A1').value = options.title;
    ws.getCell('A1').border = {
        top: {style: 'thick', color: {argb: 'FF964714'}},
        left: {style: 'thick', color: {argb: 'FF964714'}},
        bottom: {style: 'thick', color: {argb: 'FF964714'}}
    };
    ws.getCell('A1').fill = {type: 'pattern', pattern: 'solid', fgColor: {argb: 'FFE06B21'}};
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
                top: {style: 'thick', color: {argb: 'FF964714'}},
                right: {style: 'medium', color: {argb: 'FF964714'}},
                bottom: {style: 'thick', color: {argb: 'FF964714'}}
            };
        } else {//Set this border for the middle cells
            ws.getCell(columns[i] + "1").border = {
                top: {style: 'thick', color: {argb: 'FF964714'}},
                bottom: {style: 'thick', color: {argb: 'FF964714'}}
            };
        }
        ws.getCell(columns[i] + "1").fill = {type: 'pattern', pattern: 'solid', fgColor: {argb: 'FFE06B21'}};
        ws.getCell(columns[i] + "1").alignment = {vertical: 'middle', horizontal: 'center', "wrapText": true};
    }

    //5 Row 2
    for (i = 0; i < options.fieldNames.length; i++) {
        ws.getCell(columns[i] + "2").value = options.fieldNames[i];
        ws.getCell(columns[i] + "2").alignment = {vertical: 'middle', horizontal: 'left', "wrapText": true};
        ws.getCell(columns[i] + "2").border = {
            top: {style: 'thin', color: {argb: 'FF000000'}},
            bottom: {style: 'medium', color: {argb: 'FF000000'}},
            left: {style: 'thin', color: {argb: 'FF000000'}},
            right: {style: 'thin', color: {argb: 'FF000000'}}
        };
    }

    //6. Fill data rows    
    var nextRow = 3;
    for (i = 0; i < options.data.length; i++) {

        //6.1 Row 3 set the style
        ws.getCell('A' + nextRow).value = options.data[i].name + " - " + options.data[i].code;
        ws.getCell('A' + nextRow).border = {
            top: {style: 'thick', color: {argb: 'FF964714'}},
            left: {style: 'thick', color: {argb: 'FF964714'}},
            bottom: {style: 'thick', color: {argb: 'FF964714'}}
        };
        ws.getCell('A' + nextRow).fill = {type: 'pattern', pattern: 'solid', fgColor: {argb: 'FFE06B21'}};
        ws.getCell('A' + nextRow).font = {
            color: {argb: 'FFFFFF'},
            size: 16,
            bold: true
        };
        ws.getCell('A' + nextRow).alignment = {vertical: 'middle', horizontal: 'center'};
        //6.2 Row 3 set the length
        for (r = 1; r < options.fieldNames.length; r++) {
            // For the last column, add right border
            if (r == options.fieldNames.length - 1) {
                ws.getCell(columns[r] + nextRow).border = {
                    top: {style: 'thick', color: {argb: 'FF964714'}},
                    right: {style: 'medium', color: {argb: 'FF964714'}},
                    bottom: {style: 'thick', color: {argb: 'FF964714'}}
                };
            } else {//Set this border for the middle cells
                ws.getCell(columns[r] + nextRow).border = {
                    top: {style: 'thick', color: {argb: 'FF964714'}},
                    bottom: {style: 'thick', color: {argb: 'FF964714'}}
                };
            }
            ws.getCell(columns[r] + nextRow).fill = {type: 'pattern', pattern: 'solid', fgColor: {argb: 'FFE06B21'}};
            ws.getCell(columns[r] + nextRow).alignment = {vertical: 'middle', horizontal: 'center', "wrapText": true};
        }
        /// 6.3 Merges Structure name cells
        ws.mergeCells('A' + nextRow + ":" + columns[options.fieldNames.length - 1] + nextRow);


        if (options.data[i].children) {
            nextRow = nextRow + 1;
            /// 6.4 fill data
            for (c = 0; c < options.data[i].children.length; c++) {
                //6.4.1 Row 3 set the style
                ws.getCell('A' + nextRow).value = options.data[i].children[c].fr + " - " + options.data[i].children[c].code;
                ws.getCell('A' + nextRow).border = {
                    top: {style: 'thick', color: {argb: '96969696'}},
                    left: {style: 'thick', color: {argb: '96969696'}},
                    bottom: {style: 'thick', color: {argb: '96969696'}}
                };
                ws.getCell('A' + nextRow).fill = {type: 'pattern', pattern: 'solid', fgColor: {argb: 'A1a8a1a1'}};
                ws.getCell('A' + nextRow).font = {
                    color: {argb: 'FFFFFF'},
                    size: 16,
                    bold: true
                };
                ws.getCell('A' + nextRow).alignment = {vertical: 'middle', horizontal: 'center'};
                //6.4.2 Row 3 set the length
                for (r = 1; r < options.fieldNames.length; r++) {
                    // For the last column, add right border
                    if (r == options.fieldNames.length - 1) {
                        ws.getCell(columns[r] + nextRow).border = {
                            top: {style: 'thick', color: {argb: '96969696'}},
                            right: {style: 'medium', color: {argb: '96969696'}},
                            bottom: {style: 'thick', color: {argb: '96969696'}}
                        };
                    } else {//Set this border for the middle cells
                        ws.getCell(columns[r] + nextRow).border = {
                            top: {style: 'thick', color: {argb: '96969696'}},
                            bottom: {style: 'thick', color: {argb: '96969696'}}
                        };
                    }
                    ws.getCell(columns[r] + nextRow).fill = {type: 'pattern', pattern: 'solid', fgColor: {argb: 'A1a8a1a1'}};
                    ws.getCell(columns[r] + nextRow).alignment = {vertical: 'middle', horizontal: 'left', "wrapText": true};
                }
                /// 6.4.3 Merges Structure name cells
                ws.mergeCells('A' + nextRow + ":" + columns[options.fieldNames.length - 1] + nextRow);


                if (options.data[i].children[c].personnels) {

                    for (k = 0; k < options.data[i].children[c].personnels.length; k++) {

                        for (j = 0; j < options.fields.length; j++) {
                            var query = options.fields[j].split(".");
                            var value, field;

                            if (query.length == 1) {
                                value = options.data[i].children[c].personnels[k][query[0]] || "";
                                field = query[0];
                            } else if (query.length == 2) {
                                if (options.data[i].children[c].personnels[k][query[0]]) {
                                    value = options.data[i].children[c].personnels[k][query[0]][query[1]] || "";
                                } else {
                                    value = "";
                                }
                                field = query[1];
                            } else if (query.length == 3) {
                                if (options.data[i].children[c].personnels[k][query[0]] && options.data[i].children[c].personnels[k][query[0]][query[1]]) {
                                    value = options.data[i].children[c].personnels[k][query[0]][query[1]][query[2]] || "";
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
                                left: {style: 'thin', color: {argb: 'FF000000'}},
                                right: {style: 'thin', color: {argb: 'FF000000'}}
                            };

                            // Last row: Add border
                            if (i == options.data.length - 1) {
                                ws.getCell(columns[j] + (nextRow + 1 + add)).border.bottom = {style: 'thin', color: {argb: 'FF000000'}};
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
    ws.columns[0].width = 50;
    ws.columns[1].width = 12;
    ws.columns[2].width = 12;
    ws.columns[6].width = 50;
    ws.columns[7].width = 15;

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

function buildXLSX2(options, callback) {
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
    var ws = workbook.addWorksheet('Datatocare report');

    //3. set style around A1
    ws.getCell('A1').value = options.title;
    ws.getCell('A1').border = {
        top: {style: 'thick', color: {argb: 'FF964714'}},
        left: {style: 'thick', color: {argb: 'FF964714'}},
        bottom: {style: 'thick', color: {argb: 'FF964714'}}
    };
    ws.getCell('A1').fill = {type: 'pattern', pattern: 'solid', fgColor: {argb: 'FFE06B21'}};
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
                top: {style: 'thick', color: {argb: 'FF964714'}},
                right: {style: 'medium', color: {argb: 'FF964714'}},
                bottom: {style: 'thick', color: {argb: 'FF964714'}}
            };
        } else {//Set this border for the middle cells
            ws.getCell(columns[i] + "1").border = {
                top: {style: 'thick', color: {argb: 'FF964714'}},
                bottom: {style: 'thick', color: {argb: 'FF964714'}}
            };
        }
        ws.getCell(columns[i] + "1").fill = {type: 'pattern', pattern: 'solid', fgColor: {argb: 'FFE06B21'}};
        ws.getCell(columns[i] + "1").alignment = {vertical: 'middle', horizontal: 'center', "wrapText": true};
    }

    //5 Row 2
    for (i = 0; i < options.fieldNames.length; i++) {
        ws.getCell(columns[i] + "2").value = options.fieldNames[i];
        ws.getCell(columns[i] + "2").alignment = {vertical: 'middle', horizontal: 'left', "wrapText": true};
        ws.getCell(columns[i] + "2").border = {
            top: {style: 'thin', color: {argb: 'FF000000'}},
            bottom: {style: 'medium', color: {argb: 'FF000000'}},
            left: {style: 'thin', color: {argb: 'FF000000'}},
            right: {style: 'thin', color: {argb: 'FF000000'}}
        };
    }

    //6. Fill data rows    
    for (i = 0; i < options.data.length; i++) {
        for (j = 0; j < options.fields.length; j++) {
            var query = options.fields[j].split(".");
            var value, field;
            if (query.length == 1) {
                value = options.data[i][query[0]] == undefined ? "" : options.data[i][query[0]];
                field = query[0];
            } else if (query.length == 2) {
                if (options.data[i][query[0]]) {
                    value = options.data[i][query[0]][query[1]] == undefined ? "" : options.data[i][query[0]][query[1]];
                } else {
                    value = "";
                }
                field = query[1];
            } else if (query.length == 3) {
                if (options.data[i][query[0]] && options.data[i][query[0]][query[1]]) {
                    value = options.data[i][query[0]][query[1]][query[2]] == undefined ? "" : options.data[i][query[0]][query[1]][query[2]];
                } else {
                    value = "";
                }
                field = query[2];
            }

            if ((field == "testDate" || field == "requestDate" || field == "birthDate" || field == "positiveResultDate" || field == "startdate" || field == "cartridgeExpiryDate" || field == "dateBeginningSymptom") && value != undefined && value != "" && value != null && value != "null") {
                value = moment(value).format("DD/MM/YYYY");
            }

            ws.getCell(columns[j] + (i + 3 + add)).value = (value != undefined && value != null && value != "null") ? value : "";
            ws.getCell(columns[j] + (i + 3 + add)).border = {
                left: {style: 'thin', color: {argb: 'FF000000'}},
                right: {style: 'thin', color: {argb: 'FF000000'}}
            };

            // Last row: Add border
            if (i == options.data.length - 1) {
                ws.getCell(columns[j] + (i + 3 + add)).border.bottom = {style: 'thin', color: {argb: 'FF000000'}};
            }
        }
    }

    ///7. Set the columns width to 12
    for (k = 0; k < ws.columns.length; k++) {
        ws.columns[k].width = 12;
    }

    ///7. Merges cells
    ws.mergeCells('A1:' + columns[options.fieldNames.length - 1] + "1");
    ws.columns[0].width = 50;
    ws.columns[1].width = 52;
    ws.columns[2].width = 12;
    ws.columns[3].width = 50;

    // save workbook to disk
    var tmpFile = "./tmp/" + keyGenerator.generateKey() + ".xlsx";
    if (!fs.existsSync("./tmp")) {
        fs.mkdirSync("./tmp");
    }
    workbook.xlsx.writeFile(tmpFile).then(function () {
        callback(null, tmpFile);
    });
}