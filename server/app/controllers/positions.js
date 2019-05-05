var PositionDetail = require('../models/positionDetail').PositionDetail;
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
};

exports.api.upsert = function (req, res) {
    if (req.actor) {
        var form = new formidable.IncomingForm();
        form.parse(req, function (err, fields, files) {
            if (err) {
                log.error(err);
                audit.logEvent('[formidable]', 'Positions', 'Upsert', "", "", 'failed', "Formidable attempted to parse Position fields");
                return res.status(500).send(err);
            } else {
                var id = fields._id || '';
                var positionId = fields.positionId || '';

                var filter = {$and: []};
                if (id !== '') {
                    filter.$and.push({
                        "_id": id
                    });
                } else {
                    filter.$and.push({
                        "positionId": positionId
                    });
                }

                PositionDetail.findOne(filter, function (err, position) {
                    if (err) {
                        log.error(err);
                        audit.logEvent('[mongodb]', 'Positions', 'Upsert', "", "", 'failed', "Mongodb attempted to find a position");
                        callback(err);
                    } else {
                        if (position == null) {
                            fields.created = new Date();
                        }
                        fields.lastModified = new Date();
                        PositionDetail.findOneAndUpdate(filter, fields, {upsert: true, new : true}, function (err, result) {
                            if (err) {
                                log.error(err);
                                audit.logEvent('[mongodb]', 'Position', 'Upsert', "", "", 'failed', "Mongodb attempted to upsert a Position");
                                return res.status(500).send(err);
                            } else {
                                return res.status(200).send(result);
                            }
                        });

                    }
                });
            }
        });
    } else {
        audit.logEvent('[anonymous]', 'Positions', 'Upsert', '', '', 'failed', 'The actor was not authenticated');
        return res.sendStatus(401);
    }


};


exports.api.list = function (req, res) {
    if (req.actor) {
        var positions = dictionary.getJSONListByCode("../../resources/dictionary/structure/positions.json", req.actor.language.toLowerCase(), req.params.id);

        function LoopA(o) {
            if (o < positions.length) {
                //TODO compute real effective
                positions[o].actualEffective = 0;
                positions[o].vacancies = positions[o].requiredEffective - positions[o].actualEffective;
                LoopA(o + 1)
            } else {
                beautify({actor: req.actor, language: req.actor.language, beautify: true}, positions, function (err, objects) {
                    if (err) {
                        return res.status(500).send(err);
                    } else {
                        return res.json(objects);
                    }
                });
            }
        }
        LoopA(0);
    } else {
        audit.logEvent('[anonymous]', 'Projects', 'List', '', '', 'failed', 'The actor was not authenticated');
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
            var position = dictionary.getPositionFromIdJSON("../../resources/dictionary/structure/positions.json", req.params.id, req.actor.language.toLowerCase());
            exports.find(position.id, function (err, positiondetail) {
                if (err) {
                    audit.logEvent('[mongodb]', 'Positions', 'Read', "id", req.params.id, 'failed', "Mongodb attempted to find the position detail");
                    return res.status(500).send(err);
                } else {
                    if (positiondetail) {
                        position.details = positiondetail;
                    } else {
                        position.details = {
                            positionId: position.id,
                            requiredProfiles: [],
                            requiredSkills: [],
                            activities: [],
                            tasks: []
                        }
                    }
                    beautify({actor: req.actor, language: req.actor.language, beautify: true}, [position], function (err, objects) {
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

exports.find = function (positionId, callback) {
    PositionDetail.findOne({
        positionId: positionId
    }).lean().exec(function (err, positionDetails) {
        if (err) {
            log.error(err);
            callback(err);
        } else {
            if (positionDetails != null) {
                callback(null, positionDetails);
            } else {
                callback(null, positionDetails);
            }
        }
    });
};


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