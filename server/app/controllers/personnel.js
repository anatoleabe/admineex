var Personnel = require('../models/personnel').Personnel;
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
    positions: require('./positions')
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
    if (req.actor) {
        var options = {
            minify: minify,
            req: req
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
            req: req
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

    var query = {};
    if (options.query) {
        query = options.query;
    }
    var sort = {"name.family": 'asc'};
    var q = Personnel.find(query).sort(sort).limit(0).skip(0).lean();
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

            if (name !== '') {
                Personnel.aggregate([
                    {"$unwind": "$name"},
                    {"$unwind": "$name.family"},
                    {"$unwind": "$name.given"},
                    {"$addFields": {"fname": {$concat: concat}}},
                    {$match: {"fname": dictionary.makePattern(name)}}
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
            console.log("Mat = " + mat)
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
                        personnels[a].affectedTo = affectation;
                        personnels[a].skillsCorresponding = 0;
                        personnels[a].profilesCorresponding = 0;

                        if (personnels[a].affectedTo && personnels[a].affectedTo.position) {
                            var requiredProfiles = personnels[a].affectedTo.position.requiredProfiles;
                            var requiredSkills = personnels[a].affectedTo.position.requiredSkills;
                            var userProfiles = personnels[a].profiles;
                            var userSkills = personnels[a].skills;

                            if (requiredProfiles && requiredProfiles.length > 0) {
                                var count = 0;
                                if (userProfiles && userProfiles.length > 0) {
                                    for (var i in userProfiles) {
                                        if (requiredProfiles.includes(userProfiles[i])) {
                                            count = count + 1;
                                        }
                                    }
                                }
                                personnels[a].profilesCorresponding = Number((100 * (count / 3)).toFixed(1));
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
                                personnels[a].skillsCorresponding = Number((100 * (count / 3)).toFixed(1));
                                if (personnels[a].skillsCorresponding > 100) {
                                    personnels[a].skillsCorresponding = 100;
                                }
                            }
                        }

                        personnels[a].corresponding = Number(((personnels[a].skillsCorresponding + personnels[a].profilesCorresponding) / 2).toFixed(1));

                        var status = personnels[a].status || "";
                        var grade = personnels[a].grade || "";
                        var corps = personnels[a].corps || "";
                        var category = personnels[a].category || "";
                        var highestLevelEducation = (personnels[a].qualifications) ? personnels[a].qualifications.highestLevelEducation : "";
                        var natureActe = (personnels[a].history) ? personnels[a].history.nature : "";

                        personnels[a].age = _calculateAge(new Date(personnels[a].birthDate));

                        personnels[a].status = dictionary.getValueFromJSON('../../resources/dictionary/personnel/status.json', status, language);

                        if (status != "") {
                            personnels[a].grade = dictionary.getValueFromJSON('../../resources/dictionary/personnel/status/' + status + '/grades.json', parseInt(grade, 10), language);
                            personnels[a].category = dictionary.getValueFromJSON('../../resources/dictionary/personnel/status/' + status + '/categories.json', category, language);
                        }

                        if (corps != "") {
                            personnels[a].corps = dictionary.getValueFromJSON('../../resources/dictionary/personnel/status/' + status + '/corps.json', corps, language);
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