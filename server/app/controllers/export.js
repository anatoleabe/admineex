var audit = require('../utils/audit-log');
var log = require('../utils/log');
var moment = require('moment');
var _ = require('underscore');
var fs = require("fs");
var pdf = require('dynamic-html-pdf');
var keyGenerator = require("generate-key");
var dictionary = require('../utils/dictionary');
var phantomjs = require('phantomjs');



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
    var vacancies = req.params.vacancies;
    var nomenclature = req.params.nomenclature;
    var template = fs.readFileSync('resources/pdf/positions.html', 'utf8')

    var gt = dictionary.translator(req.actor.language);
    var foot = 'SYGEPE-DGTCFM<br/>Imprimé le ' + dictionary.dateformater(new Date(), "dd/MM/yyyy HH:mm:s");

    var options = {
        phantomPath: phantomjs.path,
        format: "A4",
        orientation: "portrait",
        border: "10mm",
        "border-bottom": "10mm",
        pagination: true,
        paginationOffset: 1, // Override the initial pagination number
        "footer": {
            "height": "10mm",
            "contents": {
                default: '<div style="width:100%"><div style="float:left;width:80%;font-size: 8px">'+foot+'</div><div style="float:left;width:20%;text-align:right;font-size: 8px">{{page}}/{{pages}}</div></div>', // fallback value
            }
        },
//        "base": "file:///home/www/your-asset-path"
    };

    var meta = {
        title: gt.gettext("LIST OF WORKSTATIONS BY STRUCTURE")
    };

    var filter = {rank: "2"};
    if (structureCode != "-1" && structureCode != "undefined") {
        filter.code = structureCode;
    }
    var option = {
        actor: req.actor, language: req.actor.language, beautify: true, includePositions: true, filter: filter,
    }

    if (vacancies && (vacancies == "true" || vacancies == true)) {
        option.vacancies = true;
        meta.title = gt.gettext("LIST OF VACANCIES");
    } else if (nomenclature && (nomenclature == "true" || nomenclature == true)) {
        option.nomenclature = true;
        meta.title = gt.gettext("DGTCFM POSITIONS'S NOMENCLATURE");
        template = fs.readFileSync('resources/pdf/positions_nomenclature.html', 'utf8');
    }

    controllers.structures.list(option, function (err, structures) {
        if (err) {
            log.error(err);
            return res.status(500).send(err);
        } else {
            if (structureCode != "-1") {
                meta.structure = structures[0].name;
            }
            var tmpFile = "./tmp/" + keyGenerator.generateKey() + ".pdf";
            if (!fs.existsSync("./tmp")) {
                fs.mkdirSync("./tmp");
            }

            var document = {
                type: 'file', // 'file' or 'buffer'
                template: template,
                context: {
                    structures: structures,
                    meta: meta,
                    header: {
                        code: gt.gettext("Code"),
                        positionName: gt.gettext("Position name"),
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
    var foot = 'SYGEPE-DGTCFM<br/>Imprimé le ' + dictionary.dateformater(new Date(), "dd/MM/yyyy HH:mm:s");
    
    var options = {
        phantomPath: phantomjs.path,
        format: "A4",
        orientation: "portrait",
        border: "10mm",
        "border-bottom": "10mm",
        pagination: true,
        paginationOffset: 1, // Override the initial pagination number
        "footer": {
            "height": "10mm",
            "contents": {
                default: '<div style="width:100%"><div style="float:left;width:80%;font-size: 8px">'+foot+'</div><div style="float:left;width:20%;text-align:right;font-size: 8px">{{page}}/{{pages}}</div></div>', // fallback value
            }
        }
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
                        code: gt.gettext("Code"),
                        name: gt.gettext("Name"),
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

