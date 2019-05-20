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
    var mysqlId = fields.mysqlId || '';

    var filter = {$and: []};
    if (id !== '') {
        filter.$and.push({
            "_id": id
        });
    } else if (matricule !== '') {
        filter.$and.push({
            "isentifier": matricule
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
        var query = {}
        var sort = {"name.family": 'asc'};
        var q = Personnel.find(query).sort(sort).limit(0).skip(0).lean();
        q.exec(function (err, personnels) {
            if (err) {
                log.error(err);
                audit.logEvent('[mongodb]', 'Personnel', 'List', '', '', 'failed', 'Mongodb attempted to retrieve personnel list');
                return res.status(500).send(err);
            } else {
                if (minify == true) {
                    personnels = JSON.parse(JSON.stringify(personnels));
                    function LoopA(a) {
                        if (a < personnels.length && personnels[a]) {
                            controllers.positions.findPositionHelderBystaffId({req: req}, personnels[a]._id, function (err, affectation) {
                                if (err) {
                                    log.error(err);
                                    res.status(500).send(err);
                                } else {
                                    personnels[a].affectedTo = affectation;
                                    LoopA(a + 1);
                                }
                            });
                        } else {
                            return res.json(personnels);
                        }
                    }
                    LoopA(0);
                } else {
                    return res.json(personnels);
                }
            }
        });
    } else {
        audit.logEvent('[anonymous]', 'Personnel', 'List', '', '', 'failed', 'The actor was not authenticated');
        return res.send(401);
    }
}

exports.api.read = function (req, res) {
    console.log('Read method call for personnel');
    if (req.actor) {
        if (req.params.id === undefined) {
            audit.logEvent(req.actor.id, 'Position', 'Read', '', '', 'failed',
                    'The actor could not read the position because one or more params of the request was not defined');
            return res.sendStatus(400);
        } else {
            console.log("Read " + req.params.id);
            var position = dictionary.getPositionFromIdJSON("../../resources/dictionary/structure/positions.json", req.params.id, req.actor.language.toLowerCase());
            beautify({actor: req.actor, language: req.actor.language, beautify: true}, [position], function (err, objects) {
                if (err) {
                    return res.status(500).send(err);
                } else {
                    console.log(objects);
                    return res.json(objects[0]);
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

function beautify(options, objects, callback) {
    var language = options.language || "";
    language = language.toLowerCase();
    var gt = dictionary.translator(language);
    if (options.beautify && options.beautify === true) {
        function objectsLoop(o) {
            if (o < objects.length) {
                objects[o].structure = dictionary.getStructureFromJSONByCode('../../resources/dictionary/structure/structures.json', objects[o].code.substring(0, objects[o].code.indexOf('-')), language.toLowerCase());
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