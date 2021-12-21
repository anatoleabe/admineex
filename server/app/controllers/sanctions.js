var Position = require('../models/position').Position;
var Sanction = require('../models/sanction').Sanction;
var audit = require('../utils/audit-log');
var log = require('../utils/log');
var mail = require('../utils/mail');
var _ = require('lodash');
var crypto = require('crypto');
var moment = require('moment');
var dictionary = require('../utils/dictionary');
var formidable = require("formidable");
var ObjectID = require('mongoose').mongo.ObjectID;

// API
exports.api = {};

var controllers = {
    configuration: require('./configuration'),
    users: require('./users'),
    structures: require('./structures'),
    organizations: require('./organizations')
};


exports.upsert = function (fields, callback) {
    // Parse received fields
    var id = fields._id || '';
    var positionId = fields.positionId || '';
    var personnelId = fields.personnelId || '';
    var dateofSignature = fields.dateofSignature || '';

    var filter = {$and: []};
    if (id !== '') {
        filter.$and.push({
            "_id": id
        });
    } else if (positionId !== '' && personnelId !== '' && dateofSignature !== '') {
        filter.$and.push({
            "positionId": positionId
        });
        filter.$and.push({
            "personnelId": personnelId
        });
        filter.$and.push({
            "type": fields.type
        });
        filter.$and.push({
            "sanction": fields.sanction
        });
        filter.$and.push({
            "dateofSignature": dateofSignature
        });
    }

    var sanctionFields = {
        positionId: fields.positionId,
        personnelId: fields.personnelId,
        positionCode: fields.positionCode,
        dateofSignature: fields.dateofSignature,
        startDate: fields.startDate,
        endDate: fields.endDate,
        referenceNumber: fields.referenceNumber,
        actor: fields.actor.id,
        nature: fields.nature,
        type: fields.type,
        sanction: fields.sanction,
        duration: fields.duration,
        period: fields.period,
        quantity: fields.quantity,
        Comment: fields.Comment,
        lastModified: new Date()
    };

    if (id && id !== '') {
        sanctionFields.creation = new Date();
    }

    fields.lastModified = new Date();
    Sanction.findOneAndUpdate(filter, sanctionFields, {setDefaultsOnInsert: true, upsert: true, new : true}, function (err, result) {
        if (err) {
            log.error(err);
            audit.logEvent('[mongodb]', 'Sanction', 'Upsert', "", "", 'failed', "Mongodb attempted to update a sanction");
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
                audit.logEvent('[formidable]', 'Sanction', 'Upsert', "", "", 'failed', "Formidable attempted to parse sanction fields");
                return res.status(500).send(err);
            } else {
                fields.actor = req.actor;
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
        audit.logEvent('[anonymous]', 'Sanction', 'Upsert', '', '', 'failed', 'The actor was not authenticated');
        return res.sendStatus(401);
    }
};



exports.api.list = function (req, res) {
    if (req.actor) {
        var language = req.actor.language.toLowerCase()
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

        console.log(filtersParam)
        var options = {
            limit: limit,
            skip: skip,
            search: req.params.search,
            filters: filtersParam
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
                                userStructureCodes.push(new RegExp("^" + structure.code + "-"));
                                LoopS(s + 1);
                            }
                        });
                    } else {
                        var concat = ["$personnel.name.family", " ", "$personnel.name.given"];
                        var concatMeta = ["$personnel.name.family", "$personnel.name.given", "$personnel.identifier"];
                        var q;
                        if (options.search && (options.search == "-" || options.search == "")) {
                            options.search = "";
                        }

                        var aggregate = [];
                        aggregate.push({$sort: {lastModified: -1}})

                        aggregate.push(
                                {
                                    $lookup: {
                                        from: 'personnels',
                                        localField: 'personnelId',
                                        foreignField: '_id',
                                        as: 'personnel',
                                    }
                                }
                        );
                        aggregate.push(
                                {
                                    "$unwind": {
                                        path: "$personnel",
                                        preserveNullAndEmptyArrays: false
                                    }
                                }
                        );
                        aggregate.push(
                                {
                                    $lookup: {
                                        from: 'positions',
                                        localField: 'positionId',
                                        foreignField: '_id',
                                        as: 'newPosition',
                                    }
                                }
                        );
                        aggregate.push(
                                {
                                    "$unwind": {
                                        path: "$newPosition",
                                        preserveNullAndEmptyArrays: false
                                    }
                                }
                        );

                        aggregate.push({"$addFields": {"matricule": "$personnel.identifier"}});
                        aggregate.push({"$addFields": {"structureId": "$newPosition.structureId"}});
                        aggregate.push({"$unwind": "$personnel.name"});
                        aggregate.push({"$unwind": {path: "$personnel.name.family", preserveNullAndEmptyArrays: true}});
                        aggregate.push({"$unwind": {path: "$personnel.name.given", preserveNullAndEmptyArrays: true}});
                        aggregate.push({"$addFields": {"fname": {$concat: concat}}});
                        aggregate.push({"$addFields": {"metainfo": {$concat: concatMeta}}});
//  
                        aggregate.push(
                                {
                                    $lookup: {
                                        from: 'structures',
                                        localField: 'structureId',
                                        foreignField: '_id',
                                        as: 'structureAffectation',
                                    }
                                }
                        );
                        aggregate.push(
                                {
                                    "$unwind": {
                                        path: "$structureAffectation",
                                        preserveNullAndEmptyArrays: true
                                    }
                                }
                        );

                        aggregate.push(
                                {
                                    $lookup: {
                                        from: 'structures',
                                        localField: 'structureAffectation.fatherId',
                                        foreignField: '_id',
                                        as: 'structureAffectationFather',
                                    }
                                }
                        );
                        aggregate.push(
                                {
                                    "$unwind": {
                                        path: "$structureAffectationFather",
                                        preserveNullAndEmptyArrays: true
                                    }
                                }
                        );

                        if (req.actor.role == "2") {
                            aggregate.push(
                                    {"$match": {"newPosition.code": {$in: userStructureCodes}}},
                                    );
                        }

                        //------------------Actor
                        aggregate.push(
                                {
                                    $lookup: {
                                        from: 'users',
                                        localField: 'actor',
                                        foreignField: '_id',
                                        as: 'actor',
                                    }
                                }
                        );
                        aggregate.push(
                                {
                                    "$unwind": {
                                        path: "$actor",
                                        preserveNullAndEmptyArrays: true
                                    }
                                }
                        );

                        projection = {
                            $project: {_id: 1, "personnel.name": 1, "personnel.status": 1, matricule: 1, metainfo: 1, comment: 1, positionId: 1, personnelId: 1, referenceNumber: 1,
                                lastModified: 1, dateofSignature: 1, "personnel.identifier": 1, duration: 1, fname: 1, "period": 1, quantity: 1, type: 1, sanction: 1, nature: 1,
                                "newPosition._id": 1, "newPosition.fr": 1, "newPosition.code": 1, positionCode: 1,
                                "structureAffectation._id": 1, "structureAffectation.fr": 1, "structureAffectationFather._id": 1, "structureAffectationFather.fr": 1, "structureAffectationFather.code": 1,
                                "actor._id": 1, "actor.firstname": 1, "actor.lastname": 1, startDate: 1, endDate: 1
                            }
                        };
                        aggregate.push(projection);

                        //Filter by key word
                        if (options.search) {
                            aggregate.push({$match: {$or: [{"metainfo": dictionary.makePattern(options.search)}]}})
                        }
                        //Set the filters
                        if (options.filters) {
                            if (options.filters.structure && options.filters.structure != "-" && options.filters.structure != "" && options.filters.structure != "-1") {
                                aggregate.push({$match: {$or: [{"positionCode": new RegExp("^" + options.filters.structure)}]}})
                            }
                            if (options.filters.status && options.filters.status != "-" && options.filters.status != "" && options.filters.status != "-1") {
                                aggregate.push({$match: {$or: [{"personnel.status": options.filters.status}]}})
                            }
                            if (options.filters.sanctiontype && options.filters.sanctiontype != "-" && options.filters.sanctiontype != "" && options.filters.sanctiontype != "-1") {
                                aggregate.push({$match: {$or: [{"type": options.filters.sanctiontype}]}})
                            }
                            if (options.filters.sanction && options.filters.sanction != "-" && options.filters.sanction != "" && options.filters.sanction != "-1") {
                                aggregate.push({$match: {$or: [{"sanction": options.filters.sanction}]}})
                            }
                            if (options.filters.personnelId && options.filters.personnelId != "-" && options.filters.personnelId != "" && options.filters.personnelId != "-1") {
                                aggregate.push({$match: {$or: [{"personnelId": new ObjectID(options.filters.personnelId)}]}})
                            }
                            if (options.filters.from && options.filters.to) {
                                aggregate.push(
                                        {$match: {
                                                "dateofSignature": {
                                                    $gte: moment(options.filters.from).startOf('day').toDate()
                                                }
                                            }
                                        });
                                aggregate.push({$match: {
                                        "dateofSignature": {
                                            $lte: moment(options.filters.to).endOf('day').toDate()
                                        }
                                    }});
                            }
                        }

                        if ((options.skip + options.limit) > 0) {
                            aggregate.push({"$limit": options.skip + options.limit})
                            aggregate.push({"$skip": options.skip})
                        }



                        q = Sanction.aggregate(aggregate);

                        q.exec(function (err, sanctions) {
                            if (err) {
                                log.error(err);
                                audit.logEvent('[mongodb]', 'Sanctions', 'List', '', '', 'failed', 'Mongodb attempted to retrieve list of sanction');
                                return res.status(500).send(err);
                            } else {
                                for (var a in sanctions) {
                                    if (sanctions[a].type && sanctions[a].personnel.status) {
                                        sanctions[a].typeBeautified = dictionary.getValueFromJSON('../../resources/dictionary/personnel/sanctions.json', sanctions[a].type, language);
                                        sanctions[a].indisciplineBeautified = dictionary.getValueFromJSON('../../resources/dictionary/personnel/sanctions/' + sanctions[a].personnel.status + '/' + sanctions[a].type + '.json', sanctions[a].sanction, language);
                                        sanctions[a].periodBeautified = dictionary.getValueFromJSON('../../resources/dictionary/time/periods.json', sanctions[a].period, language);
                                        sanctions[a].natureBeautified = dictionary.getValueFromJSON('../../resources/dictionary/acts/natures.json', sanctions[a].nature, language);
                                        sanctions[a].sanctionBeautified = dictionary.getJSONById('../../resources/dictionary/personnel/sanctions/' + sanctions[a].personnel.status + '/' + sanctions[a].type + '.json', sanctions[a].sanction).sanction;

                                    }
                                }
                                return res.json(sanctions);
                            }
                        });

                    }
                }
                LoopS(0);
            }
        });

    } else {
        audit.logEvent('[anonymous]', 'Sanctions', 'List', '', '', 'failed', 'The actor was not authenticated');
        return res.send(401);
    }
}

exports.api.remove = function (req, res) {
    if (req.actor) {
        if (req.params.id == undefined) {
            audit.logEvent(req.actor.id, 'Sanction', 'Delete', '', '', 'failed', 'The actor could not delete an sanction because one or more params of the request was not defined');
            return res.sendStatus(400);
        } else {
            Sanction.remove({_id: req.params.id}, function (err) {
                if (err) {
                    log.error(err);
                    return res.status(500).send(err);
                } else {
                    audit.logEvent(req.actor.id, 'Sanction', 'Delete an sanction', "SanctionID", req.params.id, 'succeed',
                            'The actor has successfully deleted the sanction.');
                    return res.sendStatus(200);
                }
            });
        }
    } else {
        audit.logEvent('[anonymous]', 'Sanction', 'Delete a sanction', '', '', 'failed', 'The actor was not authenticated');
        return res.send(401);
    }
}

