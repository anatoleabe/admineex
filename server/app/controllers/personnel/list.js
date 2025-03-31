const dictionary = require("../../utils/dictionary");
const {Personnel} = require("../../models/personnel");
const audit = require("../../utils/audit-log");
const {Affectation} = require("../../models/affectation");
const log = require('../../utils/log');
const mongoose = require("mongoose");
const ObjectID = mongoose.Schema.Types.ObjectId;

// Controllers
const controllersUsers = require("../users");
const controllersStructures = require("../structures");
const controllersPositions = require("../positions");
const controllersPersonnelIndex = require("./index");



exports.list = function (options, callback) {
    controllersUsers.findUser(options.req.actor.id, function (err, user) {
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
                    if (options.req.actor.role === "1" || options.req.actor.role === "3" || options.req.actor.role === "4" || options.req.actor.role === "2") {
                        let query = {};
                        if (options.query) {
                            query = options.query;
                        }
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


                        let q;
                        if (options.search && (options.search === "-" || options.search === "")) {
                            options.search = "";
                        }

                        let aggregate = [];
                        //Set the filters
                        if (options.filters) {
                            if (options.filters.gender && options.filters.gender !== "-" && options.filters.gender !== "") {
                                aggregate.push({$match: {gender: options.filters.gender}});
                            }

                            if (options.filters.status && options.filters.status !== "-" && options.filters.status !== "") {
                                aggregate.push({$match: {status: options.filters.status}});
                            }

                            if (options.filters.grade && options.filters.grade !== "-" && options.filters.grade !== "") {
                                aggregate.push({$match: {grade: options.filters.grade}});
                            }

                            if (options.filters.rank && options.filters.rank !== "-" && options.filters.rank !== "") {
                                aggregate.push({$match: {rank: options.filters.rank}});
                            }

                            if (options.filters.category && options.filters.category !== "-" && options.filters.category !== "") {
                                aggregate.push({$match: {category: options.filters.category}});
                            }

                            if (options.filters.situation && options.filters.situation !== "-" && options.filters.situation !== "") {
                                aggregate.push({$addFields: {lastSituation: {$arrayElemAt: ["$situations", -1]}}});

                                if (options.filters.situation === "12") {
                                    aggregate.push({"$match": {"retirement.retirement": true}});
                                    aggregate.push({"$match": {"retirement.notified": {$exists: false}}});
                                    aggregate.push({"$match": {$or: [{"retirement.extended": {$exists: false}}, {"retirement.extended": false}]}});
                                } else if (options.filters.situation === "0") {//Active people
                                    //Staff not (Deceased, Retired, Abandoned, Revoked)
                                    aggregate.push({$match: {$and: [{"lastSituation.situation": {$ne: "3"}}, {"lastSituation.situation": {$ne: "5"}}, {"lastSituation.situation": {$ne: "8"}}, {"lastSituation.situation": {$ne: "10"}}]}});
                                } else {
                                    aggregate.push({$match: {"lastSituation.situation": options.filters.situation}});
                                }
                            }
                        }

                        if (!options.statistics) {
                            aggregate.push({"$unwind": "$name"});
                            aggregate.push({"$unwind": {path: "$name.family", preserveNullAndEmptyArrays: true}});
                            aggregate.push({"$unwind": {path: "$name.given", preserveNullAndEmptyArrays: true}});
                            aggregate.push({"$unwind": {path: "$retirement", preserveNullAndEmptyArrays: true}});

                            aggregate.push({"$addFields": {"fname": {$concat: concat}}});
                            aggregate.push({"$addFields": {"matricule": "$identifier"}});
                            aggregate.push({"$addFields": {"metainfo": {$concat: concatMeta}}});
                            if (options.minify === false) {
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
                                    {"$addFields": {
                                            "affectation": {"$slice": ["$affectation", -1]}
                                        }
                                    }
                                );

                                aggregate.push(
                                    {
                                        "$unwind": {
                                            path: "$affectation",
                                            preserveNullAndEmptyArrays: true
                                        }
                                    }
                                );

                                if (options.req.actor.role === "2") {
                                    aggregate.push(
                                        {"$match": {"affectation.positionCode": {$in: userStructureCodes}}},
                                    );
                                }

                                aggregate.push(
                                    {
                                        $lookup: {
                                            from: 'positions',
                                            localField: 'affectation.positionCode',
                                            foreignField: 'code',
                                            as: 'affectation.position',
                                        }
                                    }
                                );

                                if (options.filters) {
                                    if (options.filters.structure && options.filters.structure !== "-" && options.filters.structure !== "") {
                                        aggregate.push({$match: {$or: [{"affectation.positionCode": new RegExp("^" + options.filters.structure)}]}})
                                    }
                                }

                                aggregate.push(
                                    {
                                        "$unwind": {
                                            path: "$affectation.position",
                                            preserveNullAndEmptyArrays: true
                                        }
                                    }
                                );
                            }

                        }
                        if (options.projection) {

                            options.projection.lastSituation = 1;
                            projection = {
                                $project: options.projection
                            };
                            aggregate.push(projection);
                        }
                        //Filter by key word
                        if (options.search) {
                            aggregate.push({$match: {$or: [{"metainfo": dictionary.makePattern(options.search)}]}});
                        }

                        //Filter by key word
                        if (options._id) {
                            aggregate.push({$match: {_id: new ObjectID(options._id)}});
                        }

                        //If retiredOnly
                        if (options.retiredOnly) {
                            aggregate.push({"$match": options.query});
                        } else {
                            aggregate.push({"$match": {"retirement.notified": {$exists: false}}});
                        }

                        if ((options.skip + options.limit) > 0) {
                            aggregate.push({"$limit": options.skip + options.limit})
                            aggregate.push({"$skip": options.skip})
                        }

                        q = Personnel.aggregate(aggregate);
                        q.exec( async function (err, personnels) {
                            if (err) {
                                log.error(err);
                                audit.logEvent('[mongodb]', 'Personnel', 'List', '', '', 'failed', 'Mongodb attempted to retrieve personnel list');
                                callback(err);
                            } else {
                                personnels = JSON.parse(JSON.stringify(personnels));
                                let retirementLimit;
                                async function processPersonnel(personnels, options, callback) {
                                    let index = 0;
                                    let total = personnels.length;

                                    async function processNext() {
                                        if (index >= total) {
                                            return callback(null, personnels);
                                        }

                                        let person = personnels[index];

                                        if (!person) {
                                            index++;
                                            return processNext();
                                        }

                                        // Calculate age
                                        person.age = await controllersPersonnelIndex._calculateAge(new Date(person.birthDate));

                                        // Determine retirement limit
                                        let retirementLimit = 60; // Default

                                        if (person.status === "1") { // Civil Servant
                                            if (person.category && ["5", "6"].includes(person.category)) {
                                                retirementLimit = 55;
                                            }
                                        } else { // Contractual
                                            let category = parseInt(person.category, 10);
                                            if (category >= 1 && category <= 7) {
                                                retirementLimit = 55;
                                            }
                                        }

                                        person.retirementDate = new Date(new Date(person.birthDate).setFullYear(new Date(person.birthDate).getFullYear() + retirementLimit));

                                        if ((options.minify || person.affectation) && !options.retiredOnly) {
                                            let options2 = {
                                                req: options.req,
                                                beautifyPosition: options.beautifyPosition !== false,
                                                toExport: options.toExport === true
                                            };

                                            if (options2.toExport) {
                                                person.address = controllersConfiguration.beautifyAddress({ language: options.language }, [{ address: person.address }])[0].address;
                                            }

                                            let status = person.status || "";
                                            let grade = person.grade || "";
                                            let rank = person.rank;
                                            let language = (options.language || "").toLowerCase();

                                            let situation = person.lastSituation?.situation
                                                ? dictionary.getValueFromJSON('../../resources/dictionary/personnel/situations.json', person.lastSituation.situation, language)
                                                : undefined;

                                            let actif = person.retirement?.retirement === false ? "Actif" : "En âge de retraite";

                                            person.active = situation || actif;
                                            person.status = dictionary.getValueFromJSON('../../resources/dictionary/personnel/status.json', status, language);

                                            if (status) {
                                                let statusKey = status === "Fonctionnaire" ? "1" : (status.includes("Personnel non fonctionnaire") ? "2" : status);
                                                person.grade = dictionary.getValueFromJSON(`../../resources/dictionary/personnel/status/${statusKey}/grades.json`, parseInt(grade, 10), language);
                                                person.category = dictionary.getValueFromJSON(`../../resources/dictionary/personnel/status/${statusKey}/categories.json`, person.category, "code").toUpperCase();
                                            }

                                            if (rank) {
                                                person.rank = dictionary.getValueFromJSON('../../resources/dictionary/personnel/ranks.json', rank, language);
                                            }

                                            if (person.affectation?.position) {
                                                let personalRank = person.affectation.rank || "";
                                                if (personalRank) {
                                                    person.affectation.rank = dictionary.getValueFromJSON('../../resources/dictionary/personnel/ranks.json', personalRank, language);
                                                }

                                                person.affectation.position.name = person.affectation.position[language] || person.affectation.position['en'];

                                                let structureCode = person.affectation.position.code.split('P')[0];
                                                controllersStructures.findStructureByCode(structureCode, language, (err, structure) => {
                                                    if (err) {
                                                        log.error(err);
                                                        return callback(err);
                                                    }
                                                    person.affectation.structure = structure;
                                                    index++;
                                                    processNext();
                                                });

                                                return; // Wait for async operation
                                            }
                                        } else if (options.retiredOnly) {
                                            let status = person.status || "";
                                            let grade = person.grade || "";
                                            let rank = person.rank;
                                            let language = (options.language || "").toLowerCase();

                                            person.grade = dictionary.getValueFromJSON(`../../resources/dictionary/personnel/status/${status}/grades.json`, parseInt(grade, 10), language);
                                            person.rank = dictionary.getValueFromJSON('../../resources/dictionary/personnel/ranks.json', rank, language);
                                            person.age = controllersPersonnelIndex._calculateAge(new Date(person.birthDate));
                                        }

                                        index++;
                                        await processNext();
                                    }

                                    await processNext();
                                }

                                // Call function with the initial index 0
                                await processPersonnel(personnels, options, callback);

                            }
                        });
                    } else {//This view is restricted for structure manager (Role = 2)
                        let q;
                        let query = {positionCode: {$in: userStructureCodes}};
                        let concat = [{"$ifNull": ["$AffectedPersonnal.name.family", ""]}, " ", {"$ifNull": ["$AffectedPersonnal.name.given", ""]}];
                        let concatMeta = [
                            {"$ifNull": ["$AffectedPersonnal.name.family", ""]},
                            {"$ifNull": ["$AffectedPersonnal.name.given", ""]},
                            {"$ifNull": ["$AffectedPersonnal.identifier", ""]},
                            {"$ifNull": ["$positionCode", ""]}
                        ];
                        let sort = {"name.family": 'asc'};
                        let aggregat = [
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
                            {"$unwind": {path: "$AffectedPersonnal.name.family", preserveNullAndEmptyArrays: true}},
                            {"$unwind": {path: "$AffectedPersonnal.name.given", preserveNullAndEmptyArrays: true}},
                            {"$addFields": {"fname": {$concat: concat}}},
                            {"$addFields": {"matricule": "$identifier"}},
                            {"$addFields": {"metainfo": {$concat: concatMeta}}}
                        ]

                        //Filter by key word
                        if (options.search && options.search !== "-" && options.search !== "") {
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
                                let personnelsManaged = [];
                                let personne;

                                function LoopAf(a) {
                                    if (affectations && a < affectations.length) {
                                        personne = affectations[a].AffectedPersonnal;
                                        personne.fname = affectations[a].fname;
                                        personne.metainfo = affectations[a].metainfo;
                                        controllersPositions.findPositionByCodeAndBeautify(affectations[a].positionCode, options, function (err, position) {
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