var Position = require('../models/position').Position;
var Sanction = require('../models/sanction').Sanction;
var audit = require('../utils/audit-log');
var log = require('../utils/log');
var mail = require('../utils/mail');
var _ = require('lodash');
var fs = require('fs');
var Excel = require('exceljs');
var crypto = require('crypto');
var moment = require('moment');
var dictionary = require('../utils/dictionary');
var keyGenerator = require("generate-key");
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

exports.list = function (options, callback) {
    var language = options.req.actor.language.toLowerCase()
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

                    if (options.req.actor.role == "2") {
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
                            callback(err);
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
                            callback(null, sanctions);
                        }
                    });

                }
            }
            LoopS(0);
        }
    });
}



exports.api.list = function (req, res) {
    if (req.actor) {

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
            filters: filtersParam,
            req: req
        }
        exports.list(options, function (err, sanctions) {
            if (err) {
                log.error(err);
                return res.status(500).send(err);
            } else {
                return res.json(sanctions);
            }
        });


    } else {
        audit.logEvent('[anonymous]', 'Sanctions', 'List', '', '', 'failed', 'The actor was not authenticated');
        return res.send(401);
    }
}

exports.api.statistics = function (req, res) {
    if (req.actor) {
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
            filters: filtersParam,
            req: req
        }
        var language = options.req.actor.language.toLowerCase()
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
                        var aggregate = [];
                        //Set the filters
                        if (options.filters) {
                            if (options.filters.structure && options.filters.structure != "-" && options.filters.structure != "" && options.filters.structure != "-1" || options.req.actor.role == "2") {
                                if (options.filters.structure && options.filters.structure != "-" && options.filters.structure != "" && options.filters.structure != "-1") {
                                    userStructureCodes.push(new RegExp("^" + options.filters.structure));
                                }

                                aggregate.push({"$match": {"positionCode": {$in: userStructureCodes}}})
                            }

                            if (options.filters.status && options.filters.status != "-" && options.filters.status != "" && options.filters.status != "-1") {
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
                                aggregate.push({$match: {$or: [{"personnel.status": options.filters.status}]}})
                            }
                            if (options.filters.sanctiontype && options.filters.sanctiontype != "-" && options.filters.sanctiontype != "" && options.filters.sanctiontype != "-1") {
                                aggregate.push({$match: {$or: [{"type": options.filters.sanctiontype}]}})
                            }
                            if (options.filters.sanction && options.filters.sanction != "-" && options.filters.sanction != "" && options.filters.sanction != "-1") {
                                aggregate.push({$match: {$or: [{"sanction": options.filters.sanction}]}})
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

                        aggregate.push({"$group" : {_id:{sanction:"$sanction",type:"$type"}, count:{$sum:1}}})
                        aggregate.push({$sort: {count: -1}})
                        q = Sanction.aggregate(aggregate);

                        q.exec(function (err, sanctions) {
                            if (err) {
                                log.error(err);
                                audit.logEvent('[mongodb]', 'Sanctions', 'List', '', '', 'failed', 'Mongodb attempted to retrieve list of sanction');
                                callback(err);
                            } else {
                                var status = 1;
                                var total = 0;
                                for (var a in sanctions) {
                                    if (sanctions[a]._id ) {
                                        total = total + sanctions[a].count;
                                        sanctions[a].typeBeautified = dictionary.getValueFromJSON('../../resources/dictionary/personnel/sanctions.json', sanctions[a]._id.type, language);
                                        sanctions[a].indisciplineBeautified = dictionary.getValueFromJSON('../../resources/dictionary/personnel/sanctions/' + status + '/' + sanctions[a]._id.type + '.json', sanctions[a]._id.sanction, language);
                                        sanctions[a].sanctionBeautified = dictionary.getJSONById('../../resources/dictionary/personnel/sanctions/' + status + '/' + sanctions[a]._id.type + '.json', sanctions[a]._id.sanction).sanction;
                                    }
                                }
                                return res.json({data: sanctions, totalCount: total });
                            }
                        });

                    }
                }
                LoopS(0);
            }
        });
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


exports.api.export = function (req, res) {
    if (req.actor) {
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
            filters: filtersParam,
            req: req
        }
        exports.list(options, function (err, sanctions) {
            if (err) {
                log.error(err);
                console.log(err)
                return res.status(500).send(err);
            } else {
                var gt = dictionary.translator(req.actor.language);
                //Build XLSX
                var options = buildFields(req.actor.language, "sanctionFieldNames.json");
                options.data = sanctions;
                options.title = gt.gettext("Admineex: Sanction et récompenses (" + moment(filtersParam.from).format("DD/MM/YYYY") + " - " + moment(filtersParam.to).format("DD/MM/YYYY") + ")");
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
    } else {
        audit.logEvent('[anonymous]', 'Sanctions', 'List', '', '', 'failed', 'The actor was not authenticated');
        return res.send(401);
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
    var ws = workbook.addWorksheet('Admineex report');

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
    ws.columns[0].width = 15;
    ws.columns[1].width = 52;
    ws.columns[2].width = 20;
    ws.columns[3].width = 60;
    ws.columns[4].width = 60;
    ws.columns[5].width = 20;
    ws.columns[6].width = 30;
    ws.columns[8].width = 50;
    ws.columns[9].width = 50;

    // save workbook to disk
    var tmpFile = "./tmp/" + keyGenerator.generateKey() + ".xlsx";
    if (!fs.existsSync("./tmp")) {
        fs.mkdirSync("./tmp");
    }
    workbook.xlsx.writeFile(tmpFile).then(function () {
        callback(null, tmpFile);
    });
}

