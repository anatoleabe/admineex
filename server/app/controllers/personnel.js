var Personnel = require('../models/personnel').Personnel;
var audit = require('../utils/audit-log');
var log = require('../utils/log');
var mail = require('../utils/mail');
var _ = require('lodash');
var crypto = require('crypto');
var dictionary = require('../utils/dictionary');
var formidable = require("formidable");
var mysql = require('mysql');

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
    console.log(fields);
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


exports.list = function (options, callback) {

    var query = {}
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
                    {"$addFields": {"name": {$concat: concat}, }},
                    {$match: {"name": dictionary.makePattern(name)}}
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



exports.api.read = function (req, res) {
    if (req.actor) {
        if (req.params.id === undefined) {
            audit.logEvent(req.actor.id, 'Position', 'Read', '', '', 'failed',
                    'The actor could not read the position because one or more params of the request was not defined');
            return res.sendStatus(400);
        } else {
            console.log("Read " + req.params.id);
            var filter = {
                _id: req.params.id
            };
            var isBeautify = false;
            if (req.params.beautify){
                isBeautify = true;
            }

            exports.read(filter, function (err, personnel) {
                if (err) {
                    return res.status(500).send(err);
                } else {
                    beautify({actor: req.actor, language: req.actor.language, beautify: isBeautify}, [personnel], function (err, objects) {
                        if (err) {
                            return res.status(500).send(err);
                        } else {
                            console.log(objects);
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
                        var status = personnels[a].status || "";
                        var grade = personnels[a].grade || "";
                        var corps = personnels[a].corps || "";
                        var category = personnels[a].category || "";

                        personnels[a].age = _calculateAge(new Date(personnels[a].birthDate));
                        personnels[a].affectedTo = affectation;
                        personnels[a].status = dictionary.getValueFromJSON('../../resources/dictionary/personnel/status.json', status, language);

                        if (status != "") {
                            personnels[a].grade = dictionary.getValueFromJSON('../../resources/dictionary/personnel/status/' + status + '/grades.json', parseInt(grade, 10), language);
                            personnels[a].category = dictionary.getValueFromJSON('../../resources/dictionary/personnel/status/' + status + '/categories.json', category, language);
                        }

                        if (corps != "") {
                            personnels[a].corps = dictionary.getValueFromJSON('../../resources/dictionary/personnel/status/' + status + '/corps.json', corps, language);
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