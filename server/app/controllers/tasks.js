var Task = require('../models/task').Task;
var audit = require('../utils/audit-log');
var log = require('../utils/log');
var mail = require('../utils/mail');
var crypto = require('crypto');
var formidable = require("formidable");
var path = require('path');
var appDir = path.dirname(require.main.filename);
var fs = require('fs');
var dictionary = require('../utils/dictionary');
var moment = require('moment');
var ObjectID = require('mongoose').mongo.ObjectID;

var {customAlphabet} = require('nanoid');
var alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const nanoid = customAlphabet(alphabet, 8);


// API
exports.api = {};

var controllers = {
    configuration: require('./configuration')
};

exports.api.upsert = function (req, res) {
    if (req.actor) {
        var form = new formidable.IncomingForm();
        form.parse(req, function (err, fields, files) {
            if (err) {
                log.error(err);
                audit.logEvent('[formidable]', 'Tasks', 'Upsert', "", "", 'failed', "Formidable attempted to parse task fields");
                return res.status(500).send(err);
            } else {

                var i = 0;
                if (files) {
                    var uploadedFiles = [];
                    if (Object.keys(files).length > 0) {
                        for (i = 0; i < Object.keys(files).length; i++) {
                            uploadedFiles.push(files['file[file][' + i + ']'])
                        }
                    } else {
                        uploadedFiles.push(files['file[file]'])
                    }
                    var _path = path.join(appDir, 'uploads', req.actor.id.toString());
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
        audit.logEvent('[anonymous]', 'Tasks', 'Upsert', '', '', 'failed', 'The actor was not authenticated');
        return res.sendStatus(401);
    }
};

function save(req, res, fields, filesToSave, _path) {
    var _id = fields._id || '';
    if (filesToSave && filesToSave.length > 0 && filesToSave[0] != undefined) {
        if (!fields.attachedFiles) {
            fields.attachedFiles = [];
        }
        for (i = 0; i < filesToSave.length; i++) {
            var file = filesToSave[i];
            fs.renameSync(file.path, path.join(_path, file.name));
            file.path = path.join(_path, file.name);
            fields.attachedFiles.push({name: file.name, path: file.path});
        }
    }

    if (fields.usersID) {
        fields.usersID = JSON.parse(fields.usersID);
    }

    if (_id === '') {//Creation
        fields.authorID = req.actor.id;
        fields.identifier = new Date().getFullYear() + "" + nanoid(); //Generate New Random ID :=> "2020-B2G03JV2". ~1 year needed, in order to have a 1% probability of at least one collision.
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

exports.api.update = function (req, res) {
    if (req.actor) {
        var form = new formidable.IncomingForm();
        form.parse(req, function (err, fields, files) {
            if (err) {
                log.error(err);
                audit.logEvent('[formidable]', 'Tasks', 'Upsert', "", "", 'failed', "Formidable attempted to parse task fields");
                return res.status(500).send(err);
            } else {
                Task.findOne({
                    _id: new ObjectID(fields._id)
                }).exec(function (err, task) {
                    if (err) {
                        log.error(err);
                        audit.logEvent('[mongodb]', 'Tasks', 'Update', "ID", fields._id, 'failed', "Mongodb attempted to find the task");
                        return res.status(500).send(err);
                    } else {
                        if (task === null) {
                            audit.logEvent('[mongodb]', 'Tasks', 'Read', 'ID', fields._id, 'failed',
                                    'Mongodb attempted to find the task but it revealed not defined');
                            return res.sendStatus(403);
                        } else {
                            if (fields.status) {
                                task.status = fields.status;
                            }

                            if (fields.taskhistory) {
                                var myTask = {};
                                myTask.history = {
                                    field: fields.taskhistory.field,
                                    date: moment(fields.taskhistory.date).toDate()
                                }
                                myTask.history.authorID = new ObjectID(fields.taskhistory.authorID);

                                if (fields.taskhistory.field == "Assignee") {
                                    myTask.history.oldval = new ObjectID(fields.taskhistory.oldval);
                                    myTask.history.newval = new ObjectID(fields.taskhistory.newval);
                                    task.usersID = JSON.parse(fields.usersID);
                                }
                                if (fields.taskhistory.field == "status") {
                                    myTask.history.oldval = fields.taskhistory.oldval;
                                    myTask.history.newval = fields.taskhistory.newval;
                                    task.status = fields.status;
                                }
                                task.history.push(myTask.history);
                            }

                            if (fields.comment) {
                                var myComment = {
                                    authorID: new ObjectID(fields.comment.authorID),
                                    comment: fields.comment.comment,
                                    creation: moment(fields.comment.date).toDate()
                                };
                                task.comments.push(myComment)
                            }

                            exports.upsert({actor: req.actor}, task, function (err) {
                                if (err) {
                                    console.error(err);
                                    log.error(err);
                                    return res.sendStatus(500);
                                } else {
                                    res.sendStatus(200);
                                }
                            });
                        }
                    }
                });
            }
        });
    } else {
        audit.logEvent('[anonymous]', 'Tasks', 'Upsert', '', '', 'failed', 'The actor was not authenticated');
        return res.sendStatus(401);
    }
};

exports.api.getHistory = function (req, res) {
    if (req.actor) {
        var id = req.params.id || '';
        var mainQuery = {$and: [{}]};
        mainQuery.$and.push({
            "_id": new ObjectID(req.params.id)
        });

        var pipe = [];
        pipe.push({$match: mainQuery});
        pipe.push({$project: {_id: 1, history: 1, usersID: 1}});
        pipe.push(
                {$unwind: "$history"},
                {
                    $lookup: {
                        from: 'users',
                        localField: 'history.authorID',
                        foreignField: '_id',
                        as: 'author',
                    }
                },
                {$unwind: "$author"},
                {
                    $lookup: {
                        from: 'users',
                        localField: 'history.oldval',
                        foreignField: '_id',
                        as: 'oldAssignee',
                    }
                },
                {
                    $unwind: {
                        path: '$oldAssignee',
                        "preserveNullAndEmptyArrays": true
                    }
                },
                {
                    $lookup: {
                        from: 'users',
                        localField: 'history.newval',
                        foreignField: '_id',
                        as: 'newAssignee',
                    }
                },
                {
                    $unwind: {
                        path: '$newAssignee',
                        "preserveNullAndEmptyArrays": true
                    }
                }
        );
        pipe.push({$sort: {'history.date': -1}}, );
        //Execute
        var q = Task.aggregate(pipe);
        q.options = {allowDiskUse: true};
        //Run it
        q.exec(function (err, task) {
            if (err) {
                log.error(err);
                audit.logEvent('[mongodb]', 'Tasks', 'Read', "ID", req.params.id, 'failed', "Mongodb attempted to find the task");
                return res.status(500).send(err);
            } else {
                return res.json(task);
            }
        });
    } else {
        audit.logEvent('[anonymous]', 'Tasks', 'Read', '', '', 'failed', 'The actor was not authenticated');
        return res.send(401);
    }
};

exports.api.getComments = function (req, res) {
    if (req.actor) {
        var id = req.params.id || '';
        var mainQuery = {$and: [{}]};
        mainQuery.$and.push({
            "_id": new ObjectID(req.params.id)
        });

        var pipe = [];
        pipe.push({$match: mainQuery});
        pipe.push({$project: {_id: 1, comments: 1, usersID: 1}});
        pipe.push(
                {
                    $unwind: {
                        path: "$comments",
                        includeArrayIndex: "arrayIndex"
                    }
                },
                {
                    $lookup: {
                        from: 'users',
                        localField: 'comments.authorID',
                        foreignField: '_id',
                        as: 'author',
                    }
                },
                {$unwind: "$author"},
                );
        pipe.push({$sort: {'comments.creation': -1}}, );
        pipe.push({$project: {_id: 1, "author.firstname": 1, "author.lastname": 1,"arrayIndex": 1, creation: "$comments.creation", comment: "$comments.comment"}});
        //Execute
        var q = Task.aggregate(pipe);
        q.options = {allowDiskUse: true};
        //Run it
        q.exec(function (err, task) {
            if (err) {
                log.error(err);
                audit.logEvent('[mongodb]', 'Tasks', 'Read', "ID", req.params.id, 'failed', "Mongodb attempted to find the task");
                return res.status(500).send(err);
            } else {
                return res.json(task);
            }
        });
    } else {
        audit.logEvent('[anonymous]', 'Tasks', 'Read', '', '', 'failed', 'The actor was not authenticated');
        return res.send(401);
    }
};

exports.api.deleteComment = function (req, res) {
    if (req.actor) {
        var id = req.params.id || '';
        var commentIndex = req.params.commentIndex || '';
        var mainQuery = {$and: [{}]};
        mainQuery.$and.push({
            "_id": new ObjectID(req.params.id)
        });
        var inde = "comments." + commentIndex;
        var unset = {$unset: {[inde]: 1}}
        var pull = {$pull: {"comments": null}}
        Task.findOneAndUpdate(mainQuery, unset).then(() => {
            Task.findOneAndUpdate(mainQuery, pull).then(() => {
                return res.json();
            })
        });
    } else {
        audit.logEvent('[anonymous]', 'Tasks', 'Read', '', '', 'failed', 'The actor was not authenticated');
        return res.send(401);
    }
};

exports.upsert = function (options, fields, callback) {
    var _id = fields._id || '';
    var title = fields.title || '';
    var description = fields.description || '';
    var categoryId = fields.categoryId || '';
    if (_id === '' && (title === '' || description === '' || categoryId)) {
        audit.logEvent(options.actor.id, 'Tasks', 'Upsert', 'title', title,
                'The actor could not create a new task because one or more parameters of the request was not correct');
        return callback(400);
    } else {
        var filter = fields._id ? {_id: fields._id} : fields;
        fields.lastModified = new Date();
        Task.findOneAndUpdate(filter, fields, {upsert: true, setDefaultsOnInsert: true}, function (err) {
            if (err) {
                log.error(err);
                audit.logEvent('[mongodb]', 'Tasks', 'Upsert', "", '', 'failed', "Mongodb attempted to save the new task");
                return callback(err);
            } else {
                return callback(null);
            }
        });
    }
}

exports.api.list = function (req, res) {
    if (req.actor) {
        var mainQuery = {$and: [{}]};

        if (req.params.status && req.params.status != "-1") {

            mainQuery.$and.push({
                "status": req.params.status
            });
        }
        if (req.params.priority && req.params.priority != "-1") {
            mainQuery.$and.push({
                "priority": req.params.priority
            });
        }
        if (req.params.category && req.params.category != "-1") {
            mainQuery.$and.push({
                "categoryID": new ObjectID(req.params.category)
            });
        }

        mainQuery.$and.push({
            "created": {
                $gte: moment(new Date(req.params.from)).startOf('day').toDate()
            }
        });
        mainQuery.$and.push({
            "created": {
                $lte: moment(new Date(req.params.to)).endOf('day').toDate()
            }
        });
        var concatMeta = ["$title", "$identifier"];

        var pipe = [];
        pipe.push({"$addFields": {"metainfo": {$concat: concatMeta}}});
        //First projections on interested fields
        pipe.push({$project: {_id: 1, identifier: 1, title: 1, metainfo: 1, description: 1, authorID: 1, categoryID: 1, deadline: 1, created: 1, lastModified: 1, priority: 1, usersID: 1, status: 1, deadline: 1}});

        pipe.push({$match: mainQuery});

        //Filter by key word
        if (req.params.search != undefined && req.params.search != "undefined" && req.params.search != "") {
            pipe.push({$match: {$and: [{"metainfo": dictionary.makePattern(req.params.search)}]}})
        } else {
            mainQuery.$and.push({
                "status": {$ne: "5"},
            });
        }
        // Sort per testDate selected row
        pipe.push({$sort: {created: -1}});

        var queryU = {$and: [{}]};
        if (req.params.selecteduser != "undefined") {
            queryU.$and.push({
                "usersID": new ObjectID(req.params.selecteduser)
            });
            pipe.push({$match: queryU});
        }

        pipe.push(
                {
                    $lookup: {
                        from: 'taskcategories',
                        localField: 'categoryID',
                        foreignField: '_id',
                        as: 'category',
                    }
                },
                {
                    $unwind: {
                        path: '$category'
                    }
                },
                {
                    $lookup: {
                        from: 'users',
                        localField: 'usersID',
                        foreignField: '_id',
                        as: 'user',
                    }
                },
                {
                    $unwind: {
                        path: '$user',
                        "preserveNullAndEmptyArrays": true
                    }
                }
        );

        pipe.push({$project: {_id: 1, identifier: 1, title: 1, description: 1, authorID: 1, categoryID: 1, deadline: 1, created: 1, lastModified: 1, priority: 1, usersID: 1, status: 1, "category.name": 1, "category._id": 1, "category.color": 1, "user.firstname": 1, "user.lastname": 1, deadline: 1}});

        //Execute
        var q = Task.aggregate(pipe);
        q.options = {allowDiskUse: true};
        //Run it
        q.exec(function (err, tasks) {
            if (err) {
                log.error(err);
                audit.logEvent('[mongodb]', 'Tasks', 'List', '', '', 'failed', 'Mongodb attempted to retrieve tasks list');
                return res.status(500).send(err);
            } else {
                beautify({language: req.actor.language, beautify: true}, tasks, function (err, t) {
                    if (err) {
                        audit.logEvent('[beautify]', 'Tasks', 'exports.api.list', 'message', '', 'failed', 'Attempted to beautify the tasks');
                        callback(err);
                    } else {
                        return res.json(tasks);
                    }
                })
            }
        });
    } else {
        audit.logEvent('[anonymous]', 'Tasks', 'List', '', '', 'failed', 'The actor was not authenticated');
        return res.send(401);
    }
}

exports.api.read = function (req, res) {
    if (req.actor) {
        var mainQuery = {$and: [{}]};
        mainQuery.$and.push({
            "_id": new ObjectID(req.params.id)
        });
        var pipe = [];
        pipe.push({$match: mainQuery});
        pipe.push(
                {
                    $lookup: {
                        from: 'taskcategories',
                        localField: 'categoryID',
                        foreignField: '_id',
                        as: 'category',
                    }
                },
                {
                    $unwind: {
                        path: '$category'
                    }
                },
                {
                    $lookup: {
                        from: 'users',
                        localField: 'usersID',
                        foreignField: '_id',
                        as: 'user',
                    }
                },
                {
                    $unwind: {
                        path: '$user',
                        "preserveNullAndEmptyArrays": true
                    }
                },
                {
                    $lookup: {
                        from: 'users',
                        localField: 'authorID',
                        foreignField: '_id',
                        as: 'author',
                    }
                },
                {
                    $unwind: {
                        path: '$author',
                        "preserveNullAndEmptyArrays": true
                    }
                }
        );

        //Execute
        var q = Task.aggregate(pipe);
        q.options = {allowDiskUse: true};
        //Run it
        q.exec(function (err, tasks) {
            if (err) {
                log.error(err);
                audit.logEvent('[mongodb]', 'Tasks', 'Read', "ID", req.params.id, 'failed', "Mongodb attempted to find the task");
                return res.status(500).send(err);
            } else {
                beautify({language: req.actor.language, beautify: true}, tasks, function (err, t) {
                    if (err) {
                        audit.logEvent('[mongodb]', 'Tasks', 'Read', 'ID', req.params.id, 'failed',
                                'Mongodb attempted to find the task but it revealed not defined');
                        callback(err);
                    } else {
                        return res.json(tasks[0]);
                    }
                })
            }
        });
    } else {
        audit.logEvent('[anonymous]', 'Tasks', 'Read', '', '', 'failed', 'The actor was not authenticated');
        return res.send(401);
    }
}

exports.api.readForEdit = function (req, res) {
    if (req.actor) {
        Task.findOne({
            _id: req.params.id
        }).exec(function (err, task) {
            if (err) {
                log.error(err);
                audit.logEvent('[mongodb]', 'Tasks', 'Read', "ID", req.params.id, 'failed', "Mongodb attempted to find the task");
                return res.status(500).send(err);
            } else {
                if (task === null) {
                    audit.logEvent('[mongodb]', 'Tasks', 'Read', 'ID', req.params.id, 'failed',
                            'Mongodb attempted to find the task but it revealed not defined');
                    return res.sendStatus(403);
                } else {
                    return res.json(task);
                }
            }
        });
    } else {
        audit.logEvent('[anonymous]', 'Tasks', 'Read', '', '', 'failed', 'The actor was not authenticated');
        return res.send(401);
    }
}


exports.api.delete = function (req, res) {
    if (req.actor) {
        if (req.params.id == undefined) {
            audit.logEvent(req.actor.id, 'Tasks', 'Delete', '', '', 'failed', 'The actor could not delete an task because one or more params of the request was not defined');
            return res.sendStatus(400);
        } else {
            Task.remove({_id: req.params.id}, function (err) {
                if (err) {
                    log.error(err);
                    return res.status(500).send(err);
                } else {
                    audit.logEvent(req.actor.id, 'Tasks', 'Delete', "ID", req.params.id, 'succeed',
                            'The actor has successfully deleted an task');
                    return res.sendStatus(200);
                }
            });
        }
    } else {
        audit.logEvent('[anonymous]', 'Tasks', 'Delete', '', '', 'failed', 'The actor was not authenticated');
        return res.send(401);
    }
}



exports.getTask = function (task, callback) {
    Task.findOne({
        _id: task.id
    }).exec(function (err, task) {
        if (err) {
            log.error(err);
            callback(err)
        } else {
            callback(null, task);
        }
    });
}

exports.statistics = function (options, callback) {
    //Execute
    var q = Task.aggregate(options.pipe);
    q.options = {allowDiskUse: true};
    //Run it
    q.exec(function (err, tasks) {
        if (err) {
            log.error(err);
            audit.logEvent('[mongodb]', 'Tasks', 'statistics', '', '', 'failed', 'Mongodb attempted to retrieve tasks statistics');
            callback(err)
        } else {
            callback(null, tasks);
        }
    });
}

function beautify(options, objects, callback) {
    var language = options.language || "";
    language = language.toLowerCase();
    var gt = dictionary.translator(language);
    if (options.beautify && options.beautify === true) {
        for (i = 0; i < objects.length; i++) {
            var status = objects[i].status || "";
            var priority = objects[i].priority || "";
            if (status !== "") {
                objects[i].statusbeautified = dictionary.getValueFromJSON('../../resources/dictionary/task/statuses.json', status, language);
            }
            if (priority !== "") {
                objects[i].prioritybeautified = dictionary.getValueFromJSON('../../resources/dictionary/task/priorities.json', priority, language);
            }
        }
        callback(null, objects);
    } else {
        callback(null, objects);
    }
}