var Document = require('../models/document').Document;
var audit = require('../utils/audit-log');
var log = require('../utils/log');
var mail = require('../utils/mail');
var _ = require('lodash');
var crypto = require('crypto');
var dictionary = require('../utils/dictionary');
var formidable = require("formidable");
var path = require('path');
var appDir = path.dirname(require.main.filename);
var fs = require('fs');
var admZip = require("adm-zip");
var moment = require('moment');

var {customAlphabet} = require('nanoid');
var alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const nanoid = customAlphabet(alphabet, 8);

// API
exports.api = {};

var controllers = {
    configuration: require('./configuration'),
    users: require('./users'),
    organizations: require('./organizations')
};

exports.api.upsert = function (req, res) {
    if (req.actor) {
        var form = new formidable.IncomingForm();
        form.parse(req, function (err, fields, files) {
            if (err) {
                log.error(err);
                audit.logEvent('[formidable]', 'Documents', 'Upsert', "", "", 'failed', "Formidable attempted to parse document fields");
                return res.status(500).send(err);
            } else {
                var i = 0;
                if (files) {
                    var uploadedFiles = [];
                    uploadedFiles.push(files['file[file]'])

                    var keyWords = [];

                    if (fields.keyWordsLength && fields.keyWordsLength > 0) {
                        for (i = 0; i < fields.keyWordsLength; i++) {
                            keyWords.push(fields['keyWords[' + i + ']']);
                        }
                    }
                    fields.keyWords = keyWords;

                    var _path = path.join(appDir, 'uploads', fields.owner.toString());
                    if (!fs.existsSync(_path)) {
                        fs.mkdirSync(_path, {recursive: true}, (err) => {
                            if (err) {
                                console.error(err)
                                return res.sendStatus(500);
                            } else {
                                save(req, res, fields, uploadedFiles, _path);
                            }
                        });
                    } else {
                        save(req, res, fields, uploadedFiles, _path);
                    }
                } else {
                    save(req, res, fields);
                }
            }
        });
    } else {
        audit.logEvent('[anonymous]', 'Documents', 'Upsert', '', '', 'failed', 'The actor was not authenticated');
        return res.sendStatus(401);
    }
};

exports.upsert = function (options, fields, callback) {
    var fileName = fields.fileName || '';
    var owner = fields.owner || '';
    var category = fields.category || '';

    if (fileName === '' || owner === '' || category === '') {
        audit.logEvent(options.actor.id, 'Documents', 'Upsert', 'documentname', fileName,
                'The actor could not create a new document because one or more parameters of the request was not correct');
        log.error("The actor could not create a new document because one or more parameters of the request was not correct");
        callback(400);
    } else {
        var filter = fields._id ? {_id: fields._id} : {fileName: fields.fileName, owner: fields.proprietary, category: fields.category, reference: fields.reference};
        fields.lastModified = new Date();
        fields.authorID = options.actor.id;

        Document.findOneAndUpdate(filter, fields, {upsert: true, setDefaultsOnInsert: true}, function (err) {
            if (err) {
                log.error(err);
                audit.logEvent('[mongodb]', 'Documents', 'Upsert', "", '', 'failed', "Mongodb attempted to save the new document");
                return callback(err)
            } else {
                return callback(null);
            }
        });


    }
}


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
                        var concat = [{"$ifNull": ["$personnel.name.family", ""]}, " ", {"$ifNull": ["$personnel.name.given", ""]}];
                        var concatMeta = [{"$ifNull": ["$personnel.name.family", ""]}, "-", {"$ifNull": ["$personnel.name.given", ""]}, "-", "$personnel.identifier", "-", "$fileName", "-", "$identifier"];
                        var q;
                        if (options.search && (options.search == "-" || options.search == "")) {
                            options.search = "";
                        }

                        var aggregate = [];
                        aggregate.push({$sort: {lastModified: -1}});

                        aggregate.push(
                                {
                                    $lookup: {
                                        from: 'personnels',
                                        localField: 'owner',
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

                        aggregate.push({"$unwind": "$personnel.name"});
                        aggregate.push({"$unwind": {path: "$personnel.name.family", preserveNullAndEmptyArrays: true}});
                        aggregate.push({"$unwind": {path: "$personnel.name.given", preserveNullAndEmptyArrays: true}});
                        aggregate.push({"$addFields": {"fname": {$concat: concat}}});
                        aggregate.push({"$addFields": {"metainfo": {$concat: concatMeta}}});

                        //------------------Actor
                        aggregate.push(
                                {
                                    $lookup: {
                                        from: 'users',
                                        localField: 'authorID',
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
                            $project: {_id: 1, "personnel.name": 1, matricule: 1, metainfo: 1, "personnel.identifier": 1,
                                lastModified: 1, created: 1, nature: 1, fname: 1, "situations": 1, numAct: 1,
                                identifier: 1, owner: 1, ownerType: 1, authorID: 1, fileName: 1, fullPath: 1, category: 1, reference: 1, index: 1, issueDate: 1,
                                "actor._id": 1, "actor.firstname": 1, "actor.lastname": 1, keyWords: 1, size: 1, downloaded: 1, viewed: 1
                            }
                        };
                        aggregate.push(projection);

                        //Filter by key word
                        if (options.search) {
                            var searchPatern = dictionary.makePattern(options.search);
                            aggregate.push({$match: {$or: [{"metainfo": searchPatern}]}})
//                            aggregate.push({"$match": { "skills": { $elemMatch: { "$in": keyWords } } }})
                        }
                        //Set the filters
                        if (options.filters) {
                            if (options.filters.category && options.filters.category !== "-" && options.filters.category !== "-1") {
                                aggregate.push({$match: {$or: [{"category": options.filters.category}]}})
                            }

                            if (options.filters.ownerType && options.filters.ownerType !== "-" && options.filters.ownerType !== "-1") {
                                aggregate.push({$match: {ownerType: options.filters.ownerType}});
                            }

                            if (options.filters.from && options.filters.to) {
                                aggregate.push(
                                        {$match: {
                                                "issueDate": {
                                                    $gte: moment(options.filters.from).startOf('day').toDate()
                                                }
                                            }
                                        });
                                aggregate.push({$match: {
                                        "issueDate": {
                                            $lte: moment(options.filters.to).endOf('day').toDate()
                                        }
                                    }});
                            }
                        }


                        if ((options.skip + options.limit) > 0) {
                            aggregate.push({"$limit": options.skip + options.limit})
                            aggregate.push({"$skip": options.skip})
                        }

                        q = Document.aggregate(aggregate);

                        q.exec(function (err, documents) {
                            if (err) {
                                log.error(err);
                                audit.logEvent('[mongodb]', 'Affectations', 'List', '', '', 'failed', 'Mongodb attempted to retrieve list of documents');
                                return res.status(500).send(err);
                            } else {
                                for (var a in documents) {
                                    if (documents[a].category) {
                                        documents[a].categoryBeautified = dictionary.getValueFromJSON('../../resources/dictionary/document/categories.json', documents[a].category, language);
                                    }
                                }
                                return res.json(documents);
                            }
                        });
                    }
                }
                LoopS(0);
            }
        });
    } else {
        audit.logEvent('[anonymous]', 'Documents', 'List', '', '', 'failed', 'The actor was not authenticated');
        return res.send(401);
    }
}

exports.api.read = function (req, res) {
    if (req.actor) {
        Document.findOne({
            _id: req.params.id
        }).lean().exec(function (err, document) {
            if (err) {
                log.error(err);
                audit.logEvent('[mongodb]', 'Documents', 'Read', "documentID", req.params.id, 'failed', "Mongodb attempted to find the document");
                return res.status(500).send(err);
            } else {
                if (document === null) {
                    audit.logEvent('[mongodb]', 'Documents', 'Read', 'documentID', req.params.id, 'failed',
                            'Mongodb attempted to find the document but it revealed not defined');
                    return res.sendStatus(403);
                } else {
                    Document.update(
                            {_id: document._id},
                            {$inc: {viewed: 1}},
                            {multi: true}
                    ).lean().exec(function (err, doc) {

                    });
                    if (req.params.beautify !== "undefined" && req.params.beautify === "true") {
                        beautify({actor: req.actor, language: req.actor.language, beautify: true}, [document], function (err, objects) {
                            if (err) {
                                return res.status(500).send(err);
                            } else {
                                return res.json(objects[0]);
                            }
                        });
                    } else {
                        return res.json(document);
                    }
                }
            }
        });
    } else {
        audit.logEvent('[anonymous]', 'Documents', 'Read', '', '', 'failed', 'The actor was not authenticated');
        return res.send(401);
    }
}


exports.api.delete = function (req, res) {
    if (req.actor) {
        if (req.params.id == undefined) {
            audit.logEvent(req.actor.id, 'Documents', 'Delete', '', '', 'failed', 'The actor could not delete a document because one or more params of the request was not defined');
            return res.sendStatus(400);
        } else {
            Document.findOne({
                _id: req.params.id
            }).lean().exec(function (err, document) {
                Document.remove({_id: req.params.id}, function (err) {
                    if (err) {
                        log.error(err);
                        return res.status(500).send(err);
                    } else {
                        if (document && document.fullPath) {
                            fs.unlink(document.fullPath, function (err) {
                                if (err) {
                                    log.error(err);
                                    audit.logEvent(req.actor.id, 'Documents', 'Delete', "documentID", req.params.id, 'not found',
                                            "Can't delete file: No such file or directory: " + document.fullPath);
                                }
                            });
                        }
                        audit.logEvent(req.actor.id, 'Documents', 'Delete', "documentID", req.params.id, 'succeed',
                                'The actor has successfully deleted a document: ' + document.fileName);
                        return res.sendStatus(200);
                    }
                });
            });


        }
    } else {
        audit.logEvent('[anonymous]', 'Documents', 'Delete', '', '', 'failed', 'The actor was not authenticated');
        return res.send(401);
    }
}



exports.getDocumentsByFilter = function (options, callback) {
    if (!options.sort) {
        options.sort = {"paymentDate": 'desc'};
    }
    var q = Document.find(options.query).sort(options.sort).limit(options.limit).lean();
    q.exec(function (err, documents) {
        if (err) {
            log.error(err);
            audit.logEvent('[mongodb]', 'Tests', 'getDocumentsByFilter', '', '', 'failed', 'Mongodb attempted to retrieve documents');
            callback(err);
        } else {
            beautify(options, documents, function (err, objects) {
                if (err) {
                    callback(err);
                } else {
                    callback(null, objects);
                }
            });
        }
    });
}




exports.api.download = function (req, res) {
    if (req.actor) {
        if (req.params.id == undefined) {
            audit.logEvent(req.actor.id, 'Documents', 'Download', '', '', 'failed',
                    'The actor could not download the document  because one or more params of the request was not defined');
            return res.sendStatus(400);
        } else {
            Document.findOne({
                _id: req.params.id
            }).lean().exec(function (err, document) {
                if (document && document.fullPath) {
                    Document.update(
                            {_id: document._id},
                            {$inc: {downloaded: 1}},
                            {multi: true}
                    ).lean().exec(function (err) {

                    });
                    res.download(document.fullPath, document.fileName);
                } else {
                    return res.status(500).send({error: "NOFILE"});
                }
            });
        }
    }
}

exports.api.zip = function (req, res) {
    if (req.actor) {
        if (req.params.id == undefined) {
            audit.logEvent(req.actor.id, 'Documents', 'ZIP', '', '', 'failed',
                    'The actor could not ZIP the document  because one or more params of the request was not defined');
            return res.sendStatus(400);
        } else {
            // creating archives
            var zip = new admZip();
            Document.find({
                owner: req.params.id
            }).lean().exec(function (err, documents) {
                if (documents && documents.length > 0) {
                    //console.log(documents)
                    var docIds = [];
                    for (var d = 0; d < documents.length; d++) {
                        zip.addLocalFile(documents[d].fullPath);
                        docIds.push(documents[d]._id);
                    }
                    var tmpFile = "./tmp/" + req.params.id + ".zip";
                    if (!fs.existsSync("./tmp")) {
                        fs.mkdirSync("./tmp");
                    }
                    zip.writeZip("./tmp/" + req.params.id + ".zip");

                    console.log("done: ")
                    Document.update(
                            {_id: {$in: docIds}},
                            {$inc: {downloaded: 1}},
                            {multi: true}
                    ).lean().exec(function (err) {

                    });
                    res.download("./tmp/" + req.params.id + ".zip", req.params.id + ".zip");
                } else {
                    return res.status(500).send({error: "NOFILE"});
                }
            });
        }
    }
}

/**
 * Deep diff between two object, using lodash
 * @param  {Object} object Object compared
 * @param  {Object} base   Object to compare with
 * @return {Object}        Return a new object who represent the diff
 */
function difference(object, base) {
    function changes(object, base) {
        return _.transform(object, function (result, value, key) {
            if (!_.isEqual(value, base[key])) {
                result[key] = (_.isObject(value) && _.isObject(base[key])) ? changes(value, base[key]) : value;
            }
        });
    }
    return changes(object, base);
}

function save(req, res, fields, filesToSave, _path) {
    var _id = fields._id || '';
    if (_id === '') {//Creation
        fields.downloaded = 0;
        fields.viewed = 0;
        fields.authorID = req.actor.id;
        fields.identifier = new Date().getFullYear() + "" + nanoid(); //Generate New Random ID :=> "2020-B2G03JV2". ~1 year needed, in order to have a 1% probability of at least one collision.
    } else {
        if (filesToSave && filesToSave[0] && fields.fullPath) {
            fs.unlinkSync(fields.fullPath);//Delete old document first
        }
    }

    if (filesToSave && filesToSave.length > 0 && filesToSave[0] != undefined) {
        for (i = 0; i < filesToSave.length; i++) {
            var file = filesToSave[i];
            var newfileName = fields.identifier + "_" + fields.category + "_" + file.name;
            fs.renameSync(file.path, path.join(_path, newfileName));
            file.path = path.join(_path, newfileName);
            fields.fileName = newfileName;
            fields.fullPath = file.path;
            fields.size = file.size;
            fields.contentType = file.type;
        }
    }
    exports.upsert({actor: req.actor}, fields, function (err) {
        if (err) {
            console.error(err);
            log.error(err);
            return res.sendStatus(500);
        } else {
            res.sendStatus(200);
        }
    });
}


function beautify(options, objects, callback) {
    var language = options.language || "";
    language = language.toLowerCase();
    var gt = dictionary.translator(language);
    if (options.beautify && options.beautify === true) {
        function objectsLoop(o) {
            if (o < objects.length) {
                var enablersID = objects[o].enablersID || [];
                var status = objects[o].status || "";
                var fundersID = objects[o].finance && objects[o].finance.fundersID || [];
                var providersID = objects[o].finance && objects[o].finance.providersID || [];
                var revenueType = objects[o].finance && objects[o].finance.revenueType || "";
                var countries = objects[o].context && objects[o].context.countries || [];
                var sicknesses = objects[o].context && objects[o].context.sicknesses || [];
                var product = objects[o].context && objects[o].context.product || "";

                // Enablers
                objects[o].enablers = [];
                function enablersLoop(e) {
                    if (e < enablersID.length) {
                        controllers.users.getUser({id: enablersID[e]}, options.actor.role, function (err, user) {
                            if (err) {
                                log.error(err);
                                callback(err);
                            } else {
                                if (user != null) {
                                    objects[o].enablers.push(user.firstname + " " + user.lastname);
                                }
                                enablersLoop(e + 1);
                            }
                        });
                    } else {
                        // Status
                        if (status !== "") {
                            objects[o].status = dictionary.getValueFromJSON('../../resources/dictionary/document/statuses.json', status, language);
                        }

                        objects[o].finance = {
                            funders: [],
                            providers: [],
                            revenueType: ""
                        }
                        // Funders
                        function fundersLoop(f) {
                            if (f < fundersID.length) {
                                controllers.organizations.getOrganization({id: fundersID[f]}, function (err, organization) {
                                    if (err) {
                                        log.error(err);
                                        callback(err);
                                    } else {
                                        if (organization != null) {
                                            objects[o].finance.funders.push(organization.name);
                                        }
                                        fundersLoop(f + 1);
                                    }
                                });
                            } else {
                                // Providers
                                function providersLoop(p) {
                                    if (p < providersID.length) {
                                        controllers.organizations.getOrganization({id: providersID[p]}, function (err, organization) {
                                            if (err) {
                                                log.error(err);
                                                callback(err);
                                            } else {
                                                if (organization != null) {
                                                    objects[o].finance.providers.push(organization.name);
                                                }
                                                providersLoop(p + 1);
                                            }
                                        });
                                    } else {
                                        // Revenue type
                                        if (revenueType !== "") {
                                            objects[o].finance.revenueType = dictionary.getValueFromJSON('../../resources/dictionary/document/revenueTypes.json', revenueType, language);
                                        }

                                        objects[o].context = {
                                            countries: [],
                                            sicknesses: [],
                                            product: "",
                                        }

                                        // Countries
                                        if (countries.length > 0) {
                                            for (var i = 0; i < countries.length; i++) {
                                                objects[o].context.countries.push(dictionary.getValueFromJSON('../../resources/dictionary/document/countries.json', countries[i], language));
                                            }
                                        }

                                        // Sicknesses
                                        if (sicknesses.length > 0) {
                                            for (var i = 0; i < sicknesses.length; i++) {
                                                objects[o].context.sicknesses.push(dictionary.getValueFromJSON('../../resources/dictionary/document/sicknesses.json', sicknesses[i], language));
                                            }
                                        }

                                        // Product
                                        if (product !== "") {
                                            objects[o].context.product = dictionary.getValueFromJSON('../../resources/dictionary/document/products.json', product, language);
                                        }
                                        objectsLoop(o + 1);
                                    }
                                }
                                providersLoop(0);
                            }
                        }
                        fundersLoop(0);
                    }
                }
                enablersLoop(0);
            } else {
                callback(null, objects);
            }
        }
        objectsLoop(0);
    } else {
        callback(null, objects);
    }
}