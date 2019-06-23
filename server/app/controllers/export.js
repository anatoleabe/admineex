var audit = require('../utils/audit-log');
var log = require('../utils/log');
var moment = require('moment');
var _ = require('underscore');
var fs = require("fs");
var pdf = require('dynamic-html-pdf');
var html = fs.readFileSync('resources/pdf/list.html', 'utf8');
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

    var gt = dictionary.translator(req.actor.language);
    var subject = "DataToCare - " + gt.gettext("Alics notification");

    var options = {
        format: "A4",
        orientation: "landscape",
        border: "10mm",
        "border-bottom": "15mm",
        pagination:true
    };
    var meta = {
        title: gt.gettext("LIST OF WORKSTATIONS"),
        structure: gt.gettext("All structures")
    };

    controllers.structures.list({actor: req.actor, language: req.actor.language, beautify: true, includePositions: true}, function (err, positions) {
        if (err) {
            log.error(err);
            return res.status(500).send(err);
        } else {
            var structures = structures;

            var tmpFile = "./tmp/" + keyGenerator.generateKey() + ".pdf";
            if (!fs.existsSync("./tmp")) {
                fs.mkdirSync("./tmp");
            }

            var document = {
                type: 'file', // 'file' or 'buffer'
                template: html,
                context: {
                    positions: positions,
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

