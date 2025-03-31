const formidable = require("formidable");
const audit = require("../../utils/audit-log");
const log = require('../../utils/log');
const {Affectation} = require("../../models/affectation");
const {Personnel} = require("../../models/personnel");
const dictionary = require("../../utils/dictionary");
const phantomjs = require("phantomjs");
const keyGenerator = require("generate-key");
const fs = require("fs");
const moment = require("moment");
const pdf = require("dynamic-html-pdf");

// Controllers
const controllersPersonnelExport = require('./export');
const controllersPersonnelIndex = require('./index');
const controllersPersonnelBeautify = require('./beautify');
const controllersPersonnelList = require('./list');
const controllersUsers = require('../users');
const controllersStructures = require('../structures');
const controllersPositions = require('../positions');
const controllersConfiguration = require('../configuration');
const controllersAffectations = require('../affectations');


exports.upsertAPI = function (req, res) {
    if (req.actor) {
        let form = new formidable.IncomingForm();
        form.parse(req, function (err, fields, files) {
            if (err) {
                log.error(err);
                audit.logEvent('[formidable]', 'Personnel', 'Upsert', "", "", 'failed', "Formidable attempted to parse personnel fields");
                return res.status(500).send(err);
            } else {
                controllersPersonnelIndex.upsert(fields, function (err, result) {
                    if (err) {
                        log.error(err);
                        audit.logEvent(req.actor.id, 'Personnel', 'Upsert', "", "", 'failed', "Failed to upsert personnel");
                        return res.status(500).send(err);
                    } else {
                        let action = fields._id ? 'Update' : 'Create';
                        let description = `The user has ${action.toLowerCase()}d the profile of ${fields.name.family} ${result.name.given}. Mat: ${fields.identifier}`;
                        audit.logEvent(req.actor.id, 'Personnel', action, "Profile", result._id, 'succeed', description);
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

exports.listAPI = function (req, res) {

    let minify = false;
    if (req.params.minify && req.params.minify === "true") {
        minify = true;
    }
    let limit = 0;
    let skip = 0;
    if (req.params.limit && req.params.skip) {
        limit = parseInt(req.params.limit, 10);
        skip = parseInt(req.params.skip, 10);
    }
    let filtersParam = {}
    if (req.params.filters && req.params.filters !== "-" && req.params.filters !== "") {
        filtersParam = JSON.parse(req.params.filters);
    }

    if (req.actor) {
        controllersUsers.findUser(req.actor.id, function (err, user) {
            if (err) {
                log.error(err);
                callback(err);
            } else {
                let userStructure = [];
                let userStructureCodes = [];
                function LoopS(s) {
                    if (user.structures && s < user.structures.length && user.structures[s]) {
                        controllersStructures.find(user.structures[s], "en", function (err, structure) {
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
                        let options = {
                            minify: minify,
                            req: req,
                            limit: limit,
                            skip: skip,
                            search: req.params.search,
                            filters: filtersParam
                        }

                        if (options.req.actor.role === "1" || options.req.actor.role === "3" || options.req.actor.role === "4" || options.req.actor.role === "2") {
                            let projection = {_id: 1, name: 1, "retirement": 1, matricule: 1, metainfo: 1, gender: 1, grade: 1, rank: 1, category: 1, index: 1, cni: 1, status: 1,
                                identifier: 1, corps: 1, telecom: 1, fname: 1, "affectation._id": 1, "affectation.positionCode": 1, "situations": 1,
                                "affectation.position.fr": 1,
                                "affectation.rank": 1,
                                "affectation.position.en": 1,
                                "affectation.position.code": 1,
                                "affectation.position.structureId": 1,
                            };
                            options.projection = projection;

                            if (options.minify === true) {
                                projection = {_id: 1, name: 1, matricule: 1, metainfo: 1, gender: 1, grade: 1, rank: 1, category: 1, cni: 1, status: 1,
                                    identifier: 1, corps: 1, telecom: 1, fname: 1
                                };
                            }
                            controllersPersonnelList.list(options, function (err, personnels) {
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
                            let aggregat = [
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

                                    controllersPersonnelList.list(options, function (err, personnels) {
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
exports.retiredAPI = function (req, res) {
    if (req.actor) {
        let limit = 0;
        let skip = 0;
        if (req.params.limit && req.params.skip) {
            limit = parseInt(req.params.limit, 10);
            skip = parseInt(req.params.skip, 10);
        }
        let filtersParam = {}
        if (req.params.filters && req.params.filters !== "-" && req.params.filters !== "") {
            filtersParam = JSON.parse(req.params.filters);
        }

        let from = filtersParam.from;
        let to = filtersParam.to;

        let query1 = {$and: []};
        if (filtersParam.retirementState === 4) {//Les personnes qui irrons probablement en retraite dans une date future
            query1.$and.push({$or: []});
            query1.$and[0].$or.push({"retirement.retirement": {$exists: false}});//pas en age de retraite
            query1.$and[0].$or.push({"retirement.retirement": false});//pas en age de retraite
        } else if (filtersParam.retirementState === 1) {//Retired and not notified staff (personne en age de retraite, mais pas notifiée)
            query1.$and.push({"retirement.retirement": true});//Les personnes en age de retraite
            query1.$and.push({"retirement.notified": {$exists: false}});//..et notifiés
            query1.$and.push({$or: []});//..et non pas été prolongés
            query1.$and[2].$or.push({"retirement.extended": {$exists: false}});//non pas été prolongés
            query1.$and[2].$or.push({"retirement.extended": false});//non pas été prolongés
        } else if (filtersParam.retirementState === 2) {//Retired and notified staff (personne retraitées, notifiées et pas prolongé)
            query1.$and.push({"retirement.retirement": true});//Les personnes en age de retraite
            query1.$and.push({"retirement.notified": {$exists: true}});//..et notifiés
            query1.$and.push({$or: []});//..et non pas été prolongés
            query1.$and[2].$or.push({"retirement.extended": {$exists: false}});//non pas été prolongés
            query1.$and[2].$or.push({"retirement.extended": false});//non pas été prolongés
        } else if (filtersParam.retirementState === 3) {//retired, but extended (prolongé)
            let query1 = {$and: []};
            query1.$and.push({"retirement.retirement": true});//Les personnes en age de retraite
            query1.$and.push({"retirement.extended": true});//retired, but extended
        }

        let options = {
            query: query1,
            req: req,
            retiredOnly: true,
            retirementState: filtersParam.retirementState,
            from: from,
            to: to
        }
        controllersPersonnelList.list(options, function (err, personnels) {
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

/**
 * This function download the list of staff corresponds to geven position
 * @param {type} req
 * @param {type} res
 * @returns {unresolved}
 */
exports.downloadEligibleToAPI = function (req, res) {
    if (req.actor) {
        if (req.params.id === undefined) {
            audit.logEvent(req.actor.id, 'Personnel', 'EligibleTo', '', '', 'failed',
                'The actor could not read the personnel eligible because one or more params of the request was not defined');
            return res.sendStatus(400);
        } else {
            let options = {
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
                    let gt = dictionary.translator(req.actor.language);
                    //Build XLSX
                    let options = buildFields(req.actor.language, "fieldNamesEligible.json");
                    options.data = objects;
                    options.title = gt.gettext("Admineex: Liste des personnes éligibles au poste de: ");
                    controllersPersonnelExport.buildXLSX2(options, function (err, filePath) {
                        if (err) {
                            log.error(err);
                        } else {
                            let fileName = 'report.xlsx';
                            res.set('Content-disposition', 'attachment; filename=' + fileName);
                            res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
                            let fileStream = fs.createReadStream(filePath);
                            let pipeStream = fileStream.pipe(res);
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
    controllersPositions.find({_id: options.position.id}, function (err, position) {
        if (err) {
            log.error(err);
            callback(err);
        } else {
            let requiredProfiles = position.requiredProfiles;
            let requiredSkills = position.requiredSkills;

            if ((requiredProfiles && requiredProfiles.length > 0) || (requiredSkills && requiredSkills.length > 0)) {
                let concat;

                concat = ["$name.family", " ", "$name.given"];

                let query = {$or: []};
                let sort = {"name.family": 'asc'};
                query.$or.push({"profiles": {"$in": requiredProfiles}});
                query.$or.push({"skills": {"$in": requiredSkills}});
                let projection = {
                    _id: 1,
                    name: 1,
                    profiles: 1,
                    skills: 1,
                    identifier: 1,
                    grade: 1,
                    rank: 1,
                    corps: 1,
                    status: 1
                };
                let q = Personnel.find(query, projection).sort(sort).limit(0).skip(0).lean();
                q.exec(function (err, personnels) {
                    if (err) {
                        log.error(err);
                        audit.logEvent('[mongodb]', 'Personnel', 'EligibleTo', '', '', 'failed', 'Mongodb attempted to retrieve a personnel');
                        callback(err);
                    } else {
                        personnels = JSON.parse(JSON.stringify(personnels));
                        controllersPersonnelBeautify.beautify({req: options.req, language: options.req.actor.language, beautify: true, eligibleTo: position._id, position: position, eligible: true}, personnels, function (err, objects) {
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


exports.searchAPI = function (req, res) {
    if (req.actor) {
        if (req.params.text === undefined) {
            audit.logEvent(req.actor.id, 'Personnel', 'Search', '', '', 'failed',
                'The actor could not read the personnel timeline because one or more params of the request was not defined');
            return res.sendStatus(400);
        } else {
            controllersUsers.findUser(req.actor.id, function (err, user) {
                if (err) {
                    log.error(err);
                    callback(err);
                } else {
                    let userStructure = [];
                    let userStructureCodes = [];
                    function LoopS(s) {
                        if (user.structures && s < user.structures.length && user.structures[s]) {
                            controllersStructures.find(user.structures[s], "en", function (err, structure) {
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

                            let name = req.params.text || '';

                            let concat = [
                                {"$ifNull": ["$name.family", ""]},
                                " ",
                                {"$ifNull": ["$name.given", ""]}
                            ];
                            let concatMeta = [
                                {"$ifNull": ["$name.family", ""]},
                                {"$ifNull": ["$name.given", ""]},
                                {"$ifNull": ["$identifier", ""]}
                            ];

                            if (name !== '') {
                                let aggregate = [
                                    {"$unwind": "$name"},
                                    {"$unwind": {path: "$name.family", preserveNullAndEmptyArrays: true}},
                                    {"$unwind": {path: "$name.given", preserveNullAndEmptyArrays: true}},
                                    {"$addFields": {"fname": {$concat: concat}}},
                                    {"$addFields": {"matricule": "$identifier"}},
                                    {"$addFields": {"metainfo": {$concat: concatMeta}}},
                                    {$addFields: {lastSituation: {$arrayElemAt: ["$situations", -1]}}},
                                    {$match: {$or: [{"metainfo": dictionary.makePattern(name)}]}}
                                ];

                                if (req.actor.role === "2") {
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
                                    aggregate.push(
                                        {
                                            "$unwind": {
                                                path: "$affectation",
                                                preserveNullAndEmptyArrays: false
                                            }
                                        }
                                    );


                                    aggregate.push(
                                        {"$match": {"affectation.positionCode": {$in: userStructureCodes}}},
                                    );
                                }


                                Personnel.aggregate(aggregate).exec(function (err, personnels) {
                                    if (err) {
                                        log.error(err);
                                        audit.logEvent('[mongodb]', 'Personnel', 'Search', '', '', 'failed', 'Mongodb attempted to retrieve a personnel');
                                        return res.sendStatus(500);
                                    } else {
                                        personnels = JSON.parse(JSON.stringify(personnels));
                                        controllersPersonnelBeautify.beautify({req: req, language: req.actor.language, beautify: true}, personnels, function (err, objects) {
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
                    }
                    LoopS(0)
                }
            });
        }
    } else {
        audit.logEvent('[anonymous]', 'Personnel', 'Search', '', '', 'failed', 'The actor was not authenticated');
        return res.send(401);
    }
}

exports.checkExistanceAPI = function (req, res) {
    if (req.actor) {
        if (req.params.mat == undefined) {
            audit.logEvent(req.actor.id, 'Personnel', 'checkExistance', '', '', 'failed',
                'The actor could not read the personnel timeline because one or more params of the request was not defined');
            return res.sendStatus(400);
        } else {

            let mat = req.params.mat || '';
            let concat;

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
 * This function output the list of staff corresponds to given position
 * @param {type} req
 * @param {type} res
 * @returns {unresolved}
 */
exports.eligibleToAPI = function (req, res) {
    if (req.actor) {
        if (req.params.id === undefined) {
            audit.logEvent(req.actor.id, 'Personnel', 'EligibleTo', '', '', 'failed',
                'The actor could not read the personnel eligible because one or more params of the request was not defined');
            return res.sendStatus(400);
        } else {
            let options = {
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


exports.readAPI = function (req, res) {
    if (req.actor) {
        if (req.params.id === undefined) {
            audit.logEvent(req.actor.id, 'Position', 'Read', '', '', 'failed',
                'The actor could not read the position because one or more params of the request was not defined');
            return res.sendStatus(400);
        } else {
            let filter = {
                _id: req.params.id
            };
            let isBeautify = false;
            if (req.params.beautify && req.params.beautify === "true") {
                isBeautify = true;
            }

            controllersPersonnelIndex.read(filter, function (err, personnel) {
                if (err) {
                    return res.status(500).send(err);
                } else {
                    controllersPersonnelBeautify.beautify({req: req, language: req.actor.language, beautify: isBeautify}, [personnel], function (err, objects) {
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

exports.deleteAPI = function (req, res) {
    if (req.actor) {
        if (req.params.id === undefined) {
            audit.logEvent(req.actor.id, 'Personnel', 'Remove', '', '', 'failed', 'The actor could not remove a personnel because one or more params of the request was not defined');
            return res.sendStatus(400);
        } else {
            Personnel.findOne({_id: req.params.id}, function (err, personnel) {
                if (err || !personnel) {
                    log.error(err || 'Personnel not found');
                    return res.status(500).send(err || 'Personnel not found');
                } else {
                    Personnel.remove({_id: req.params.id}, function (err) {
                        if (err) {
                            log.error(err);
                            return res.status(500).send(err);
                        } else {
                            Affectation.remove({personnelId: req.params.id}, function (err) {
                                if (err) {
                                    log.error(err);
                                    return res.status(500).send(err);
                                } else {
                                    audit.logEvent(req.actor.id, 'Personnel', 'Staff member deletion', "PersonnelID", req.params.id, 'succeed',
                                        `The actor has successfully deleted the staff member: ${personnel.name.family} ${personnel.name.given}`);
                                    return res.sendStatus(200);
                                }
                            });
                        }
                    });
                }
            });
        }
    } else {
        audit.logEvent('[anonymous]', 'Personnel', 'Staff member deletion', '', '', 'failed', 'The actor was not authenticated');
        return res.send(401);
    }
}

exports.followUpSheetAPI = function (req, res) {
    if (req.actor) {
        if (req.params.id === undefined) {
            audit.logEvent(req.actor.id, 'Personnel', 'Read', '', '', 'failed',
                'The actor could not read the data information because one or more params of the request was not defined');
            return res.sendStatus(400);
        } else {
            let filter = {
                _id: req.params.id
            };
            let gt = dictionary.translator(req.actor.language);
            let foot = 'Admineex<br/>Imprimé le ' + dictionary.dateformater(new Date(), "dd/MM/yyyy HH:mm:s");

            let options = {
                phantomPath: phantomjs.path,
                format: "A4",
                orientation: "portrait",
                border: "5mm",
                "border-bottom": "5mm",
                pagination: true,
                paginationOffset: 1, // Override the initial pagination number
                "footer": {
                    "height": "10mm",
                    "contents": {
                        default: '<div style="width:100%"><div style="float:left;width:80%;font-size: 8px">' + foot + '</div><div style="float:left;width:20%;text-align:right;font-size: 8px">{{page}}/{{pages}}</div></div>', // fallback value
                    }
                }
            };

            let meta = {
                title: gt.gettext("Fiche de suivi du personnel")
            };

            let tmpFile = "./tmp/" + keyGenerator.generateKey() + ".pdf";
            if (!fs.existsSync("./tmp")) {
                fs.mkdirSync("./tmp");
            }

            filter.projection = {
                _id: 1,
                name: 1,
                "retirement": 1,
                matricule: 1,
                metainfo: 1,
                gender: 1,
                grade: 1,
                rank: 1,
                category: 1,
                index: 1,
                cni: 1,
                status: 1,
                identifier: 1,
                corps: 1,
                telecom: 1,
                fname: 1,
                "affectation._id": 1,
                "affectation.positionCode": 1,
                "situations": 1,
                "affectation.position.fr": 1,
                "affectation.position.en": 1,
                "affectation.position.code": 1,
                "affectation.position.structureId": 1,
                "affectation.numAct": 1,
                "affectation.endDate": 1,
                address: 1,
                birthPlace: 1,
                birthDate: 1,
                "history.recruitmentActNumber": 1,
                "history.signatureDate": 1,
                "history.minfiEntryRefAct": 1
            };
            let options1 = {
                minify: false,
                req: req,
                _id: req.params.id,
                language: req.actor.language,
                beautify: true,
            }

            controllersPersonnelList.list(options1, function (err, personnels) {
                if (err) {
                    return res.status(500).send(err);
                } else {
                    personnels = controllersConfiguration.beautifyAddress({language: req.language}, personnels);

                    personnels[0].address = personnels[0].address[0];
                    personnels[0].phone = personnels[0].telecom[0];
                    personnels[0].higherDiploma = personnels[0].qualifications.schools[0] ? personnels[0].qualifications.schools[0] : "";
                    personnels[0].recrutementDiploma = personnels[0].qualifications.schools[1] ? personnels[0].qualifications.schools[1] : "";
                    personnels[0].birthDate = personnels[0].birthDate ? moment(personnels[0].birthDate).format("DD/MM/YYYY") : "Non connue";
                    personnels[0].higherDiploma.date = personnels[0].higherDiploma ? moment(personnels[0].higherDiploma.date).format("DD/MM/YYYY") : "Non connue";
                    personnels[0].recrutementDiploma.date = personnels[0].recrutementDiploma ? moment(personnels[0].recrutementDiploma.date).format("DD/MM/YYYY") : "Non connue";
                    if (personnels[0].history) {
                        personnels[0].history.signatureDate = personnels[0].history ? moment(personnels[0].history.signatureDate).format("DD/MM/YYYY") : "Non connue";
                        personnels[0].history.minfiEntryDate = personnels[0].history ? moment(personnels[0].history.minfiEntryDate).format("DD/MM/YYYY") : "Non connue";
                    }
                    let options2 = {
                        req: req,
                        search: personnels[0].matricule,
                    }
                    controllersAffectations.list(options2, function (err, affectations) {
                        if (err) {
                            return res.status(500).send(err);
                        } else {
                            let document = {
                                type: 'file', // 'file' or 'buffer'
                                template: fs.readFileSync('resources/pdf/fiche_de_suivi.html', 'utf8'),
                                context: {
                                    personnel: personnels[0],
                                    meta: meta,
                                    affectations: affectations
                                },
                                path: tmpFile    // it is not required if type is buffer
                            };


                            pdf.create(document, options, res).then(res1 => {

                                let fileName = 'report.pdf';
                                res.set('Content-disposition', 'attachment; filename=' + fileName);
                                res.set('Content-Type', 'application/pdf');
                                res.download(tmpFile, fileName, function (err) {
                                    if (err) {
                                        log.error(err);
                                        return res.status(500).send(err);
                                    } else {
                                        fs.unlink(tmpFile, function (err) {
                                            if (err) {
                                                log.error(err);
                                                audit.logEvent('[fs]', 'Reports', 'Download', "Spreadsheet", tmpFile, 'failed', 'FS attempted to delete this temp file');
                                            }
                                        });
                                    }
                                });
                            }).catch(error => {
                                console.error(error)
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




