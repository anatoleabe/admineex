var audit               = require('../utils/audit-log');
var log                 = require('../utils/log');
var formidable          = require('formidable');
var dictionary          = require('../utils/dictionary');
var XLSX                = require('xlsx-style');
var moment              = require('moment');
var fs                  = require('fs');
var LineByLineReader    = require('line-by-line');
var keyGenerator        = require("generate-key");

// API
exports.api = {};

var controllers     = {
    projects: require('./projects'),
    organizations: require('./organizations')
};

exports.api.import = function (req, res) {
    if (req.actor) {
        var form = new formidable.IncomingForm();
        form.parse(req, function (err, fields, files) {
            if (err) {
                log.error(err);
                audit.logEvent('[formidable]', 'Import_Export', 'Upload', "", "", 'failed', "Formidable attempted to parse imported file");
                return res.status(500).send(err);
            } else {
                readIncomingFile({actor: req.actor}, files.file, function (err) {
                    if (err) {
                        return res.status(500).send(err);
                    } else {
                        return res.sendStatus(200);
                    }
                });
            }
        });
    }
};

exports.api.export = function (req, res) {
    if (req.actor) {
        if (req.params.from !== undefined && req.params.to !== undefined) {
            var query = {
                'paymentDate': {
                    $gte: moment(new Date(req.params.from)).startOf('day'),
                    $lte: moment(new Date(req.params.to)).endOf('day')
                }
            };
            controllers.projects.getProjectsByFilter({query: query, actor: req.actor, language: req.actor.language, beautify: true}, function (err, projects) {
                if (err) {
                    log.error(err);
                    return res.status(500).send(err);
                } else {
                    function projectsLoop(p) {
                        if (p < projects.length) {
                            projectsLoop(p + 1);
                        } else {
                            // Language
                            var language = req.actor.language.toLowerCase();
                            var gt = dictionary.translator(language);

                            //Build XLSX
                            var options = buildFields(language);
                            options.data = projects;
                            options.title = gt.gettext("Core: Export projects");
                            var filePath = buildXLSX(options);
                            var fileName = 'export.xlsx';
                            res.set('Content-disposition', 'attachment; filename=' + fileName);
                            res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
                            var fileStream = fs.createReadStream(filePath);
                            var pipeStream = fileStream.pipe(res);
                            pipeStream.on('finish', function () {
                                fs.unlinkSync(filePath);
                            });
                        }
                    }
                    projectsLoop(0);
                }
            });
        } else {
            audit.logEvent(req.actor.id, 'Import_Export', 'Export', '', '', 'failed',
                           'The user could not retrieve projects because one or more params of the request is not defined');
            return res.sendStatus(400);
        }
    } else {
        audit.logEvent('[anonymous]', 'Import_Export', 'Export', '', '', 'failed', 'The user was not authenticated');
        return res.sendStatus(401);
    }
}


function readIncomingFile(options, file, callback) {
    var name = file.name;
    var fileExtension = name.substr(name.lastIndexOf("."), name.length - 1);
    if (fileExtension === ".csv") {
        var tmpFile = file.path;
        var lines = new LineByLineReader(tmpFile);
        lines.on('error', function (err) {
            log.error(err);
            audit.logEvent('[Upload]', 'Import_Export', 'readIncomingFile', "", "", 'failed', "Error when read file");
            callback(err);
        });
        lines.on('line', function (line) {
            lines.pause();
            var csv = line.split(";");
            if(csv.length>2 && (csv[0] === "1" || csv[0] === "2")){
                if(csv[0] === "1"){//Project
                    var fields = {
                        name: csv[1],
                        enablersID: csv[2].split("+"),
                        value: csv[3],
                        paymentDate: new Date(parseInt(csv[4].slice(-4)), parseInt(csv[4].slice(2,4))-1, parseInt(csv[4].slice(0,2))),
                        successProbability: csv[5],
                        status: csv[6],
                        finance: {
                            fundersID: csv[7].split("+"),
                            providersID: csv[8].split("+"),
                            revenueType: csv[9]
                        },
                        context: {
                            countries: csv[10].split("+"),
                            sicknesses: csv[11].split("+"),
                            product: csv[12]
                        }
                    }
                    controllers.projects.upsert({actor: options.actor}, fields, function(err){
                        if(err){
                            callback(err);
                        } else {
                            lines.resume();
                        }
                    })
                } else {//Organization
                    var fields = {
                        name: csv[1],
                        type: csv[2]
                    }
                    controllers.organizations.upsert({actor: options.actor}, fields, function(err){
                        if(err){
                            callback(err);
                        } else {
                            lines.resume();
                        }
                    })
                }
            } else {
                lines.resume();
            }
        });

        lines.on('end', function () {
            // All lines are read, file is closed now.
            callback(null);
        });
    } else {
        audit.logEvent('[Upload]', 'Import_Export', 'readIncomingFile', "", "", 'failed', "Unrecognized file format");
        callback(null);
    }
}

function buildFields(language) {
    var fields = require("../../resources/dictionary/export/fieldNames.json");
    var options = {fields: [], fieldNames: []};
    for (i = 0; i < fields.length; i++) {
        options.fieldNames.push(((language != "" && fields[i][language] != undefined && fields[i][language] != "") ? fields[i][language] : fields[i]['en']));
        options.fields.push(fields[i].id);
    }
    return options;
}

function buildXLSX(options) {
    var add = 0;
    var defaultCellStyle = {font: {name: "Calibri", sz: 11}, fill: {fgColor: {rgb: "FFFFAA00"}}};
    var alpha = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z"];
    var fields = [];
    var a = 0;
    // Generate fields

    for (n = 0; n < options.fields.length; n++) {
        if (n <= alpha.length * 1 - 1) {
            fields.push(alpha[a]);
        } else if (n <= alpha.length * 2 - 1) {
            fields.push(alpha[0] + alpha[a]);
        } else if (n <= alpha.length * 3 - 1) {
            fields.push(alpha[1] + alpha[a]);
        } else if (n <= alpha.length * 4 - 1) {
            fields.push(alpha[2] + alpha[a]);
        } else if (n <= alpha.length * 5 - 1) {
            fields.push(alpha[3] + alpha[a]);
        } else {
            fields.push(alpha[4] + alpha[a]);
        }
        a++;
        if (a > 25) {
            a = 0;
        }
    }

    // BA
    var workbook = {
        "SheetNames": [
            "Projects"
        ],
        "Sheets": {
            "Projects": {
                "!merges": [
                    {
                        "s": {
                            "c": 0,
                            "r": 0
                        },
                        "e": {
                            "c": 0,
                            "r": 0
                        }
                    }
                ],
                "A1": {
                    "v": options.title,
                    "s": {
                        "border": {
                            "left": {
                                "style": "thick",
                                "color": {
                                    "rgb": "FF964714"
                                }
                            },
                            "top": {
                                "style": "thick",
                                "color": {
                                    "rgb": "FF964714"
                                }
                            },
                            "bottom": {
                                "style": "thick",
                                "color": {
                                    "rgb": "FF964714"
                                }
                            }
                        },
                        "fill": {
                            "fgColor": {
                                "rgb": "FFE06B21"
                            }
                        },
                        "font": {
                            "color": {
                                "rgb": "FFFFFFFF"
                            }
                        },
                        "alignment": {
                            "horizontal": "center"
                        }
                    },
                    "t": "s"
                }
            }
        }
    };

    // Row 1
    for (i = 1; i < options.fieldNames.length; i++) {
        workbook["Sheets"]["Projects"][fields[i] + "1"] = {
            "s": {
                "border": {
                    "top": {
                        "style": "thick",
                        "color": {
                            "rgb": "FF964714"
                        }
                    },
                    "bottom": {
                        "style": "thick",
                        "color": {
                            "rgb": "FF964714"
                        }
                    }
                },
                "alignment": {
                    "horizontal": "left",
                    "vertical": "center",
                    "wrapText": true
                }
            },
            "t": "s"
        };

        // Last col: Add border
        if (i == options.fieldNames.length - 1) {
            workbook["Sheets"]["Projects"][fields[i] + "1"]["s"]["border"]["right"] = {
                "style": "medium",
                "color": {
                    "rgb": "FF964714"
                }
            }
        }
    }

    // Row 2
    for (i = 0; i < options.fieldNames.length; i++) {
        workbook["Sheets"]["Projects"][fields[i] + "2"] = {
            "v": options.fieldNames[i],
            "s": {
                "border": {
                    "top": {
                        "style": "thin",
                        "color": {
                            "rgb": "FF000000"
                        }
                    },
                    "bottom": {
                        "style": "medium",
                        "color": {
                            "rgb": "FF000000"
                        }
                    },
                    "left": {
                        "style": "thin",
                        "color": {
                            "rgb": "FF000000"
                        }
                    },
                    "right": {
                        "style": "thin",
                        "color": {
                            "rgb": "FF000000"
                        }
                    }
                },
                "alignment": {
                    "horizontal": "left",
                    "vertical": "center",
                    "wrapText": true
                }
            },
            "t": "s"
        };
    }


    // Data rows
    for (i = 0; i < options.data.length; i++) {
        for (j = 0; j < options.fields.length; j++) {
            var query = options.fields[j].split(".");
            var value, field;

            if (query.length == 1) {
                value = options.data[i][query[0]] || "";
                field = query[0];
            } else if (query.length == 2) {
                if (options.data[i][query[0]]) {
                    value = options.data[i][query[0]][query[1]] || "";
                } else {
                    value = "";
                }
                field = query[1];
            } else if (query.length == 3) {
                if (options.data[i][query[0]] && options.data[i][query[0]][query[1]]) {
                    value = options.data[i][query[0]][query[1]][query[2]] || "";
                } else {
                    value = "";
                }
                field = query[2];
            }

            if ((field == "paymentDate") && value != undefined && value != "" && value != null && value != "null") {
                value = moment(value).format("DD/MM/YYYY");
            }

            workbook["Sheets"]["Projects"][fields[j] + (i + 3 + add)] = {
                "v": (value != undefined && value != null && value != "null") ? value : "",
                "s": {
                    "border": {
                        "left": {
                            "style": "thin",
                            "color": {
                                "rgb": "FF000000"
                            }
                        },
                        "right": {
                            "style": "thin",
                            "color": {
                                "rgb": "FF000000"
                            }
                        }
                    }
                },
                "t": "s"
            };

            // Last row: Add border
            if (i == options.data.length - 1) {
                var style = "thin";
                workbook["Sheets"]["Projects"][fields[j] + (i + 3 + add)]["s"]["border"]["bottom"] = {
                    "style": style,
                    "color": {
                        "rgb": "FF000000"
                    }
                }
            }
        }
    }

    // Merges
    workbook["Sheets"]["Projects"]["!merges"][0]["e"]["c"] = options.fieldNames.length - 1;
    workbook["Sheets"]["Projects"]["!ref"] = "A1:" + fields[options.fieldNames.length - 1] + (options.data.length + 2 + add);

    var tmpFile = "./tmp/" + keyGenerator.generateKey() + ".xlsx";
    if (!fs.existsSync("./tmp")) {
        fs.mkdirSync("./tmp");
    }

    try {
        XLSX.writeFile(workbook, tmpFile, {defaultCellStyle: defaultCellStyle});
    } catch (err) {
        log.error(err);
    }
    return tmpFile;
};