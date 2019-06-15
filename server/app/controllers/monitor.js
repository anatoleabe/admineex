var Structure = require('../models/structure').Structure;
var Personnel = require('../models/personnel').Personnel;
var nconf = require('nconf');
nconf.file("config/server.json");
var audit = require('../utils/audit-log');
var log = require('../utils/log');
var mail = require('../utils/mail');
var _ = require('lodash');
var crypto = require('crypto');
var dictionary = require('../utils/dictionary');
var formidable = require("formidable");
var mongo = require('mongodb');

// API
exports.api = {};

var controllers = {
    configuration: require('./configuration'),
    users: require('./users'),
    personnel: require('./personnel'),
    positions: require('./positions'),
    structures: require('./structures')
};

exports.api.list = function (req, res) {
    if (req.actor) {
        if (!req.params.quarter || !req.params.year) {
            audit.logEvent(req.actor.id, 'Monitor', 'List', '', '', 'failed',
                    'The actor could not list the monitor because one or more params of the request was not defined');
            return res.sendStatus(400);
        } else {
            var quarter = req.params.quarter;
            var year = req.params.year;
            var structure = req.params.structure;

            var aggregation = [];
            aggregation.push({"$unwind": "$notations"})
            aggregation.push({$match: {"notations.year": year}})
            if (quarter && quarter != "-1") {
                aggregation.push({$match: {"notations.quarter": quarter}})
            }
            if (structure && structure != "-1") {
                aggregation.push({$match: {"notations.structure": new mongo.ObjectID(structure)}})
            }

            Personnel.aggregate(aggregation).exec(function (err, personnels) {
                if (err) {
                    log.error(err);
                    res.status(500).send(err);
                } else {
                    beautify({req: req, language: req.actor.language, beautify: true}, personnels, function (err, objects) {
                        if (err) {
                            return res.status(500).send(err);
                        } else {
                            return res.json(objects);
                        }
                    });
                }
            });

        }

    } else {
        audit.logEvent('[anonymous]', 'Monitor', 'List', '', '', 'failed', 'The actor was not authenticated');
        return res.sendStatus(401);
    }
}



function beautify(options, objects, callback) {
    var language = options.language || "";
    language = language.toLowerCase();
    var gt = dictionary.translator(language);

    if (options.beautify && options.beautify === true) {
        var personnels = JSON.parse(JSON.stringify(objects));
        function LoopA(a) {
            if (a < personnels.length && personnels[a]) {

                var notation = personnels[a].notations;

                controllers.positions.find2({id: notation.position, language: language}, function (err, position) {
                    if (err) {
                        log.error(err);
                        callback(err);
                    } else {
                        personnels[a].notations.affectedTo = {};
                        personnels[a].notations.affectedTo.position = position;

                        controllers.structures.find(notation.structure, language, function (err, structure) {
                            if (err) {
                                log.error(err);
                                callback(err);
                            } else {
                                personnels[a].notations.affectedTo.structure = structure;
                                personnels[a].notations.appreciationvalue = dictionary.getValueFromJSON('../../resources/dictionary/monitor/appreciations.json', personnels[a].notations.appreciation, language);
                                personnels[a].notations.quartervalue = dictionary.getValueFromJSON('../../resources/dictionary/time/quarters.json', personnels[a].notations.quarter, language);
                                LoopA(a + 1);
                            }
                        });
                    }
                });

            } else {
                callback(null, personnels);
            }
        }
        LoopA(0);
    } else {
        callback(null, objects);
    }
}