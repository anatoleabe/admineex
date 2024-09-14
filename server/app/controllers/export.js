var audit = require('../utils/audit-log');
var log = require('../utils/log');
var moment = require('moment');
var _ = require('underscore');
var fs = require("fs");
var pdf = require('dynamic-html-pdf');
var keyGenerator = require("generate-key");
var dictionary = require('../utils/dictionary');
var phantomjs = require('phantomjs');
var formidable = require("formidable");
var Excel = require('exceljs');



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
        orientation: "landscape",
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


exports.api.table = function (req, res) {
    if (req.actor) {
        var form = new formidable.IncomingForm();
        form.parse(req, function (err, fields, files) {
            if (err) {
                log.error(err);
                audit.logEvent('[formidable]', 'Export', 'Card', "", "", 'failed', "Formidable attempted to parse export card fields");
                return res.status(500).send(err);
            } else {
                // Language
                var language = req.actor.language.toLowerCase();
                var gt = dictionary.translator(language);

                //Build XLSX
                var options = {fields: fields.fields, fieldNames: fields.fieldNames};
                options.data = fields.data;
                options.title = "Admineex" + gt.gettext(":") + " " + fields.title;
                buildXLSX(options, function (err, filePath) {
                    if (err) {
                        log.error(err);
                    } else {
                        var fileName = 'report.xlsx';
                        res.set('Content-disposition', 'attachment; filename=' + fileName);
                        res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
                        var fileStream = fs.createReadStream(filePath);
                        var pipeStream = fileStream.pipe(res);
                        pipeStream.on('finish', function (err) {
                            fs.unlinkSync(filePath);
                        });
                    }
                });
            }
        });
    } else {
        audit.logEvent('[anonymous]', 'Export', 'Card', '', '', 'failed', 'The user was not authenticated');
        return res.sendStatus(401);
    }
}

function buildXLSX(options, callback) {
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
    var ws = workbook.addWorksheet('Procrastinate statistiques');

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

            if ((field.includes("Date") || field.includes("date") ) && value != undefined && value != "" && value != null && value != "null") {
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
    
    ws.columns[0].width = 30;

    ///7. Merges cells
    ws.mergeCells('A1:' + columns[options.fieldNames.length - 1] + "1");

    // save workbook to disk
    var tmpFile = "./tmp/" + keyGenerator.generateKey() + ".xlsx";
    if (!fs.existsSync("./tmp")) {
        fs.mkdirSync("./tmp");
    }
    workbook.xlsx.writeFile(tmpFile).then(function () {
        callback(null, tmpFile);
    });
}

