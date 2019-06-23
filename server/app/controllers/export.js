var audit = require('../utils/audit-log');
var log = require('../utils/log');
var moment = require('moment');
var _ = require('underscore');
var fs = require("fs");
var pdf = require('dynamic-html-pdf');
var keyGenerator = require("generate-key");
var dictionary = require('../utils/dictionary');



var controllers = {
    users: require('./users'),
    projects: require('./projects'),
    configuration: require('./configuration'),
    positions: require('./positions'),
    structures: require('./structures')
};

// API
exports.api = {};


exports.api.positions = function (req, res) {
    // Custom handlebar helper
    pdf.registerHelper('ifCond', function (v1, v2, options) {
        if (v1 === v2) {
            return options.fn(this);
        }
        return options.inverse(this);
    })
    
    var structureCode = req.params.structure || "-1";

    var gt = dictionary.translator(req.actor.language);

    var options = {
        format: "A4",
        orientation: "landscape",
        border: "10mm",
        "border-bottom": "15mm",
        pagination:true
    };
    
    var meta = {
        title: gt.gettext("LIST OF WORKSTATIONS BY STRUCTURE")
    };
    
    var filter = {};
    if (structureCode != "-1"){
        filter.code = structureCode;
    }

    controllers.structures.list({actor: req.actor, language: req.actor.language, beautify: true, includePositions: true, filter: filter}, function (err, structures) {
        if (err) {
            log.error(err);
            return res.status(500).send(err);
        } else {
            if (structureCode != "-1"){
                meta.structure = structures[0].name;
            }
            var tmpFile = "./tmp/" + keyGenerator.generateKey() + ".pdf";
            if (!fs.existsSync("./tmp")) {
                fs.mkdirSync("./tmp");
            }

            var document = {
                type: 'file', // 'file' or 'buffer'
                template: fs.readFileSync('resources/pdf/positions.html', 'utf8'),
                context: {
                    positions: structures,
                    meta: meta,
                    header: {
                        code:gt.gettext("Code"),
                        positionName:gt.gettext("Position name"),
                        occupiedBy: gt.gettext("Occupied by")
                    }
                },
                path: tmpFile    // it is not required if type is buffer
            };

            pdf.create(document, options, res).then(res1 => {

                var fileName = 'report.pdf';
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
};

exports.api.structures = function (req, res) {
    var gt = dictionary.translator(req.actor.language);

    var options = {
        format: "A4",
        orientation: "landscape",
        border: "10mm",
        "border-bottom": "15mm",
        pagination:true
    };
    
    var meta = {
        title: gt.gettext("LIST OF DGTCFM'S STRUCTURES")
    };

    controllers.structures.list({actor: req.actor, language: req.actor.language, beautify: true}, function (err, structures) {
        if (err) {
            log.error(err);
            return res.status(500).send(err);
        } else {
            var tmpFile = "./tmp/" + keyGenerator.generateKey() + ".pdf";
            if (!fs.existsSync("./tmp")) {
                fs.mkdirSync("./tmp");
            }

            var document = {
                type: 'file', // 'file' or 'buffer'
                template: fs.readFileSync('resources/pdf/structures.html', 'utf8'),
                context: {
                    structures: structures,
                    meta: meta,
                    header: {
                        code:gt.gettext("Code"),
                        name:gt.gettext("Name"),
                        rank: gt.gettext("Hierarchical rank"),
                        type: gt.gettext("Type")
                    }
                },
                path: tmpFile    // it is not required if type is buffer
            };

            pdf.create(document, options, res).then(res1 => {

                var fileName = 'report.pdf';
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
                                audit.logEvent('[fs]', 'Export', 'Download', "Spreadsheet", tmpFile, 'failed', 'FS attempted to delete this temp file');
                            }
                        });
                    }
                });
            }).catch(error => {
                console.error(error)
            });
        }
    });
};

