var Position = require('../models/position').Position;
var Affectation = require('../models/affectation').Affectation;
var audit = require('../utils/audit-log');
var log = require('../utils/log');
var mail = require('../utils/mail');
var _ = require('lodash');
var crypto = require('crypto');
var dictionary = require('../utils/dictionary');
var formidable = require("formidable");

// API
exports.api = {};

var controllers = {
    configuration: require('./configuration'),
    users: require('./users'),
    organizations: require('./organizations')
};


exports.api.list = function (req, res) {
    if (req.actor) {
        console.log("aaaaa")
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

        var options = {
            limit: limit,
            skip: skip,
            search: req.params.search,
            filters: filtersParam
        }


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
        aggregate.push(
                {
                    $lookup: {
                        from: 'positions',
                        localField: 'oldPositionId',
                        foreignField: '_id',
                        as: 'oldPosition',
                    }
                }
        );
        aggregate.push(
                {
                    "$unwind": {
                        path: "$oldPosition",
                        preserveNullAndEmptyArrays: true
                    }
                }
        );

        aggregate.push({"$addFields": {"matricule": "$personnel.identifier"}});
        aggregate.push({"$addFields": {"structureId": "$newPosition.structureId"}});
        aggregate.push({"$addFields": {"oldStructureId": "$oldPosition.structureId"}});
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

        //------------------Old structure
        aggregate.push(
                {
                    $lookup: {
                        from: 'structures',
                        localField: 'oldStructureId',
                        foreignField: '_id',
                        as: 'oldStructureAffectation',
                    }
                }
        );
        aggregate.push(
                {
                    "$unwind": {
                        path: "$oldStructureAffectation",
                        preserveNullAndEmptyArrays: true
                    }
                }
        );

        aggregate.push(
                {
                    $lookup: {
                        from: 'structures',
                        localField: 'oldStructureAffectation.fatherId',
                        foreignField: '_id',
                        as: 'oldStructureAffectationFather',
                    }
                }
        );
        aggregate.push(
                {
                    "$unwind": {
                        path: "$oldStructureAffectationFather",
                        preserveNullAndEmptyArrays: true
                    }
                }
        );
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
            $project: {_id: 1, "personnel.name": 1, matricule: 1, metainfo: 1, mouvement: 1, positionId: 1, oldPositionId: 1, personnelId: 1, interim: 1,
                lastModified: 1, date: 1, startDate: 1, "personnel.identifier": 1, nature: 1, fname: 1, "situations": 1, numAct: 1,
                "oldPosition._id": 1, "oldPosition.fr": 1, "newPosition._id": 1, "newPosition.fr": 1,
                "structureAffectation._id": 1, "structureAffectation.fr": 1, "structureAffectationFather._id": 1, "structureAffectationFather.fr": 1,
                "oldStructureAffectation._id": 1, "oldStructureAffectation.fr": 1, "oldStructureAffectationFather._id": 1, "oldStructureAffectationFather.fr": 1,
                "actor._id":1, "actor.firstname":1, "actor.lastname":1, 
            }
        };
        aggregate.push(projection);

        //Filter by key word
        if (options.search) {
            aggregate.push({$match: {$or: [{"metainfo": dictionary.makePattern(options.search)}]}})
        }
        //Set the filters
        if (options.filters) {
            if (options.filters.structure && options.filters.structure != "-" && options.filters.structure != "") {
                aggregate.push({$match: {$or: [{"affectation.0.positionCode": new RegExp("^" + options.filters.structure)}]}})
            }

            if (options.filters.mouvement && options.filters.mouvement != "-" && options.filters.mouvement != "") {
                aggregate.push({$match: {mouvement: options.filters.mouvement}});
            }

            if (options.filters.nature && options.filters.nature != "-" && options.filters.nature != "") {
                aggregate.push({$match: {nature: options.filters.nature}});
            }
        }


        if ((options.skip + options.limit) > 0) {
            aggregate.push({"$limit": options.skip + options.limit})
            aggregate.push({"$skip": options.skip})
        }



        q = Affectation.aggregate(aggregate);

        q.exec(function (err, affectations) {
            if (err) {
                log.error(err);
                audit.logEvent('[mongodb]', 'Affectations', 'List', '', '', 'failed', 'Mongodb attempted to retrieve list of affectation');
                return res.status(500).send(err);
            } else {
                for (var a in affectations) {
                    if (affectations[a].mouvement) {
                        affectations[a].mouvementBeautified = dictionary.getValueFromJSON('../../resources/dictionary/personnel/mouvements.json', affectations[a].mouvement, language);
                        affectations[a].natureBeautified = dictionary.getValueFromJSON('../../resources/dictionary/acts/natures.json', affectations[a].nature, language);
                    }
                }
                return res.json(affectations);
            }
        });



    } else {
        audit.logEvent('[anonymous]', 'Affectations', 'List', '', '', 'failed', 'The actor was not authenticated');
        return res.send(401);
    }
}
