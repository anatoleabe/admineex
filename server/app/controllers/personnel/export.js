const audit = require("../../utils/audit-log");
const dictionary = require("../../utils/dictionary");
const fs = require("fs");
const Excel = require("exceljs");
const moment = require("moment");
const keyGenerator = require("generate-key");

// Controllers
const controllersPersonnelsList = require("./list");
const controllersStructures = require("../structures");



exports.exportAPI = function (req, res) {
    if (req.actor) {
        if (req.params.filters === undefined) {
            audit.logEvent(req.actor.id, 'Personnel', 'Export', '', '', 'failed',
                'The actor could not export the personnel list because one or more params of the request was not defined');
            return res.sendStatus(400);
        } else {
            let filtersParam = {}
            if (req.params.filters && req.params.filters != "-" && req.params.filters != "") {
                filtersParam = JSON.parse(req.params.filters);
            }

            let filter = {rank: "2"};
            if (filtersParam.structure != "-1" && filtersParam.structure != "undefined" && filtersParam.structure) {
                filter.code = filtersParam.structure;
                if (filter.code.endsWith("-")) {
                    filter.code = filtersParam.structure.slice(0, -1);
                }
            }
            let option = {
                actor: req.actor, language: req.actor.language, beautify: true, filter: filter
            }
            console.log("==== GET STRUCTURE ")
            controllersStructures.list(option, function (err, structures) {
                if (err) {
                    log.error(err);
                    res.status(500).send(err);
                } else {
                    console.log("==== GET STRUCTURE ", structures.length)
                    let options = {
                        minify: false,
                        req: req,
                        filters: filtersParam,
                        language: req.actor.language,
                        beautifyPosition: false,
                        toExport: true
                    }

                    options.projection = {
                        _id: 1,
                        name: 1,
                        "retirement": 1,
                        matricule: 1,
                        metainfo: 1,
                        gender: 1,
                        grade: 1,
                        rank: 1,
                        category: 1,
                        index: 1,
                        cni: 1,
                        status: 1,
                        identifier: 1,
                        corps: 1,
                        telecom: 1,
                        fname: 1,
                        "affectation._id": 1,
                        "affectation.positionCode": 1,
                        "situations": 1,
                        "affectation.position.fr": 1,
                        "affectation.position.en": 1,
                        "affectation.position.code": 1,
                        "affectation.position.structureId": 1,
                        "affectation.numAct": 1,
                        "affectation.rank": 1,
                        address: 1,
                        birthPlace: 1,
                        birthDate: 1,
                        "history.recruitmentActNumber": 1,
                        "history.signatureDate": 1,
                        "history.minfiEntryRefAct": 1
                    };
                    controllersPersonnelsList.list(options, function (err, personnels) {
                        if (err) {
                            log.error(err);
                            res.status(500).send(err);
                        } else {
                            personnels.sort(function (a, b) {
                                if (a.fname < b.fname) {
                                    return -1;
                                } else
                                if (a.fname > b.fname) {
                                    return 1;
                                } else
                                    return 0;
                            })
                            let groupedPersonnelByStructureChildren = [];
                            if (filtersParam.staffOnly === false || filtersParam.staffOnly === "false") {
                                groupedPersonnelByStructureChildren["undefined"] = personnels;
                            } else {
                                groupedPersonnelByStructureChildren = _.groupBy(personnels, function (item) {
                                    if (item.affectation && item.affectation.structure && item.affectation.structure._id) {

                                        return item.affectation.structure._id;
                                    } else {
                                        return "undefined";
                                    }

                                });

                                for (let s in structures) {
                                    if (structures[s].children) {
                                        for (let c in structures[s].children) {
                                            structures[s].children[c].personnels = groupedPersonnelByStructureChildren[structures[s].children[c]._id]
                                        }
                                    }
                                }
                            }

                            if (groupedPersonnelByStructureChildren["undefined"]) {
                                let undefinedStructure = {
                                    code: "000",
                                    name: "STRUCTURE INCONNUE",
                                    children: [{
                                        code: "000 - 0",
                                        fr: "Inconue",
                                        personnels: groupedPersonnelByStructureChildren["undefined"]
                                    }]
                                }
                                structures.push(undefinedStructure);
                            }

                            let gt = dictionary.translator(req.actor.language);
                            //Build XLSX
                            let options = buildFields(req.actor.language, "fieldNames.json");
                            options.staffOnly = filtersParam.staffOnly;
                            options.data = structures;
                            options.title = gt.gettext("Admineex: Liste du personnel");
                            buildXLSX(options, function (err, filePath) {
                                if (err) {
                                    console.error(err);
                                    log.error(err);
                                } else {
                                    let fileName = 'report.xlsx';
                                    res.set('Content-disposition', 'attachment; filename=' + fileName);
                                    res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
                                    let fileStream = fs.createReadStream(filePath);
                                    let pipeStream = fileStream.pipe(res);
                                    pipeStream.on('finish', function () {
                                        fs.unlinkSync(filePath);
                                    });
                                }
                            });
                        }
                    });
                }
            });


        }
    }
}


function buildFields(language, file) {
    let fields = require("../../resources/dictionary/export/" + file);
    let options = {fields: [], fieldNames: []};
    for (i = 0; i < fields.length; i++) {
        options.fieldNames.push(((language != "" && fields[i][language] != undefined && fields[i][language] != "") ? fields[i][language] : fields[i]['en']));
        options.fields.push(fields[i].id);
    }
    return options;
}


function buildXLSX(options, callback) {
    let add = 0;
    let defaultCellStyle = {font: {name: "Calibri", sz: 11}, fill: {fgColor: {rgb: "FFFFAA00"}}};
    let alpha = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z"];
    let columns = [];
    let a = 0;
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
    let workbook = new Excel.Workbook();
    //2. Start holding the work sheet
    let ws = workbook.addWorksheet('Admineex export');

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
    let nextRow = 3;
    for (i = 0; i < options.data.length; i++) {
        if ((options.staffOnly != false && options.staffOnly != "false")) {
            //6.1 Row 3 set the style
            ws.getCell('A' + nextRow).value = options.data[i].name + " - " + options.data[i].code;
            ws.getCell('A' + nextRow).border = {
                top: {style: 'thick', color: {argb: 'FF964714'}},
                left: {style: 'thick', color: {argb: 'FF964714'}},
                bottom: {style: 'thick', color: {argb: 'FF964714'}}
            };
            ws.getCell('A' + nextRow).fill = {type: 'pattern', pattern: 'solid', fgColor: {argb: 'FFE06B21'}};
            ws.getCell('A' + nextRow).font = {
                color: {argb: 'FFFFFF'},
                size: 16,
                bold: true
            };
            ws.getCell('A' + nextRow).alignment = {vertical: 'middle', horizontal: 'center'};
            //6.2 Row 3 set the length
            for (r = 1; r < options.fieldNames.length; r++) {
                // For the last column, add right border
                if (r == options.fieldNames.length - 1) {
                    ws.getCell(columns[r] + nextRow).border = {
                        top: {style: 'thick', color: {argb: 'FF964714'}},
                        right: {style: 'medium', color: {argb: 'FF964714'}},
                        bottom: {style: 'thick', color: {argb: 'FF964714'}}
                    };
                } else {//Set this border for the middle cells
                    ws.getCell(columns[r] + nextRow).border = {
                        top: {style: 'thick', color: {argb: 'FF964714'}},
                        bottom: {style: 'thick', color: {argb: 'FF964714'}}
                    };
                }
                ws.getCell(columns[r] + nextRow).fill = {type: 'pattern', pattern: 'solid', fgColor: {argb: 'FFE06B21'}};
                ws.getCell(columns[r] + nextRow).alignment = {vertical: 'middle', horizontal: 'center', "wrapText": true};
            }
            /// 6.3 Merges Structure name cells
            ws.mergeCells('A' + nextRow + ":" + columns[options.fieldNames.length - 1] + nextRow);
        } else {
            nextRow = 4;
            nextRow = nextRow - 1;
        }

        if (options.data[i].children) {
            if ((options.staffOnly != false && options.staffOnly != "false")) {
                nextRow = nextRow + 1;
            }

            /// 6.4 fill data
            for (c = 0; c < options.data[i].children.length; c++) {

                if ((options.staffOnly !== false && options.staffOnly !== "false")) {
                    //6.4.1 Row 3 set the style
                    ws.getCell('A' + nextRow).value = options.data[i].children[c].fr + " - " + options.data[i].children[c].code;
                    ws.getCell('A' + nextRow).border = {
                        top: {style: 'thick', color: {argb: '96969696'}},
                        left: {style: 'thick', color: {argb: '96969696'}},
                        bottom: {style: 'thick', color: {argb: '96969696'}}
                    };
                    ws.getCell('A' + nextRow).fill = {type: 'pattern', pattern: 'solid', fgColor: {argb: 'A1a8a1a1'}};
                    ws.getCell('A' + nextRow).font = {
                        color: {argb: 'FFFFFF'},
                        size: 16,
                        bold: true
                    };
                    ws.getCell('A' + nextRow).alignment = {vertical: 'middle', horizontal: 'center'};
                    //6.4.2 Row 3 set the length
                    for (r = 1; r < options.fieldNames.length; r++) {
                        // For the last column, add right border
                        if (r == options.fieldNames.length - 1) {
                            ws.getCell(columns[r] + nextRow).border = {
                                top: {style: 'thick', color: {argb: '96969696'}},
                                right: {style: 'medium', color: {argb: '96969696'}},
                                bottom: {style: 'thick', color: {argb: '96969696'}}
                            };
                        } else {//Set this border for the middle cells
                            ws.getCell(columns[r] + nextRow).border = {
                                top: {style: 'thick', color: {argb: '96969696'}},
                                bottom: {style: 'thick', color: {argb: '96969696'}}
                            };
                        }
                        ws.getCell(columns[r] + nextRow).fill = {type: 'pattern', pattern: 'solid', fgColor: {argb: 'A1a8a1a1'}};
                        ws.getCell(columns[r] + nextRow).alignment = {vertical: 'middle', horizontal: 'left', "wrapText": true};
                    }
                    /// 6.4.3 Merges Structure name cells
                    ws.mergeCells('A' + nextRow + ":" + columns[options.fieldNames.length - 1] + nextRow);
                } else {
                    nextRow = nextRow - 1;
                }

                if (options.data[i].children[c].personnels) {


                    for (k = 0; k < options.data[i].children[c].personnels.length; k++) {

                        for (j = 0; j < options.fields.length; j++) {
                            let query = options.fields[j].split(".");
                            let value, field;

                            if (query.length == 1) {
                                value = options.data[i].children[c].personnels[k][query[0]] || "";
                                field = query[0];
                            } else if (query.length == 2) {
                                if (options.data[i].children[c].personnels[k][query[0]]) {
                                    value = options.data[i].children[c].personnels[k][query[0]][query[1]] || "";
                                } else {
                                    value = "";
                                }
                                field = query[1];
                            } else if (query.length == 3) {
                                if (options.data[i].children[c].personnels[k][query[0]] && options.data[i].children[c].personnels[k][query[0]][query[1]]) {
                                    value = options.data[i].children[c].personnels[k][query[0]][query[1]][query[2]] || "";
                                } else {
                                    value = "";
                                }
                                field = query[2];
                            } else if (query.length == 4) {
                                if (options.data[i].children[c].personnels[k][query[0]] && options.data[i].children[c].personnels[k][query[0]][query[1]] && options.data[i].children[c].personnels[k][query[0]][query[1]][query[2]]) {
                                    value = options.data[i].children[c].personnels[k][query[0]][query[1]][query[2]][query[3]] || "";
                                } else {
                                    value = "";
                                }
                                field = query[2];
                            }

                            if ((field == "testDate" || field == "requestDate" || field == "birthDate" || field == "signatureDate" || field == "positiveResultDate" || field == "startdate" || field == "cartridgeExpiryDate") && value != undefined && value != "" && value != null && value != "null") {
                                value = moment(value).format("DD/MM/YYYY");
                            }

                            ws.getCell(columns[j] + (nextRow + 1 + add)).value = (value != undefined && value != null && value != "null") ? value : "";
                            ws.getCell(columns[j] + (nextRow + 1 + add)).border = {
                                left: {style: 'thin', color: {argb: 'FF000000'}},
                                right: {style: 'thin', color: {argb: 'FF000000'}}
                            };

                            // Last row: Add border
                            if (i == options.data.length - 1) {
                                ws.getCell(columns[j] + (nextRow + 1 + add)).border.bottom = {style: 'thin', color: {argb: 'FF000000'}};
                            }
                        }
                        nextRow += 1;
                    }
                }
                nextRow += 1;
            }
            nextRow += 1;
        }
    }

    ///7. Set the columns width to 12
    for (k = 0; k < ws.columns.length; k++) {
        ws.columns[k].width = 30;
    }
    ws.columns[0].width = 50;
    ws.columns[1].width = 12;
    ws.columns[2].width = 12;
    ws.columns[3].width = 12;
    ws.columns[4].width = 30;
    ws.columns[5].width = 30;
    ws.columns[6].width = 30;
    ws.columns[14].width = 50;
    ws.columns[15].width = 30;
    ws.columns[15].width = 30;
    ws.columns[16].width = 50;
    ws.columns[19].width = 15;

    ///7. Merges cells
    ws.mergeCells('A1:' + columns[options.fieldNames.length - 1] + "1");


    // save workbook to disk
    let tmpFile = "./tmp/" + keyGenerator.generateKey() + ".xlsx";
    if (!fs.existsSync("./tmp")) {
        fs.mkdirSync("./tmp");
    }
    workbook.xlsx.writeFile(tmpFile).then(function () {
        callback(null, tmpFile);
    });
}

function buildXLSX2(options, callback) {
    let add = 0;
    let defaultCellStyle = {font: {name: "Calibri", sz: 11}, fill: {fgColor: {rgb: "FFFFAA00"}}};
    let alpha = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z"];
    let columns = [];
    let a = 0;
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
    let workbook = new Excel.Workbook();
    //2. Start holding the work sheet
    let ws = workbook.addWorksheet('Datatocare report');

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
            let query = options.fields[j].split(".");
            let value, field;
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
    ws.columns[0].width = 50;
    ws.columns[1].width = 52;
    ws.columns[2].width = 12;
    ws.columns[3].width = 50;

    // save workbook to disk
    let tmpFile = "./tmp/" + keyGenerator.generateKey() + ".xlsx";
    if (!fs.existsSync("./tmp")) {
        fs.mkdirSync("./tmp");
    }
    workbook.xlsx.writeFile(tmpFile).then(function () {
        callback(null, tmpFile);
    });
}

exports.buildXLSX = buildXLSX;
exports.buildXLSX2 = buildXLSX2;