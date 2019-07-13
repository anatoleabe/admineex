var Personnel = require('../models/personnel').Personnel;
var audit = require('../utils/audit-log');
var log = require('../utils/log');
var moment = require('moment');
var dictionary = require('../utils/dictionary');
var _ = require('underscore');
var controllers = {
    users: require('./users'),
    projects: require('./projects'),
    personnel: require('./personnel'),
    configuration: require('./configuration')
};

// API
exports.api = {};

exports.api.build = function (req, res) {
    if (req.actor) {
        var name = req.params.name || '';
        if (name !== '') {
            build({
                actor: req.actor,
                name: name,
                from: new Date(req.params.from),
                to: new Date(req.params.to),
                group: req.params.group
            }, function (err, chart) {
                if (err) {
                    res.status(500).send(err);
                } else {
                    return res.json(chart);
                }
            });
        } else {
            audit.logEvent(req.actor.id, 'Charts', 'Build', '', '', 'failed',
                    'The user could not build a chart because one or more params of the request was not defined');
            return res.sendStatus(400);
        }
    } else {
        audit.logEvent('[anonymous]', 'Charts', 'Build', '', '', 'failed', 'The user was not authenticated');
        return res.sendStatus(401);
    }
};

var build = function (config, callback) {
    whichChart(config, function (err, chart) {
        if (err) {
            callback(err);
        } else {
            callback(null, chart);
        }
    });
};

var whichChart = function (config, callback) {
    switch (config.name) {
        case 'chart1':
            chart1(config, function (err, chart) {
                if (err) {
                    callback(err);
                } else {
                    callback(null, chart);
                }
            });
            break;
        case 'chart2':
            chart2(config, function (err, chart) {
                if (err) {
                    callback(err);
                } else {
                    callback(null, chart);
                }
            });
            break;
        case 'global':
            global(config, function (err, chart) {
                if (err) {
                    callback(err);
                } else {
                    callback(null, chart);
                }
            });
            break;
        case 'card2':
            card2(config, function (err, chart) {
                if (err) {
                    callback(err);
                } else {
                    callback(null, chart);
                }
            });
            break;
        case 'card4':
            card4(config, function (err, chart) {
                if (err) {
                    callback(err);
                } else {
                    callback(null, chart);
                }
            });
            break;
        case 'card6':
            card6(config, function (err, chart) {
                if (err) {
                    callback(err);
                } else {
                    callback(null, chart);
                }
            });
            break;
        default:
            callback("not found");
            break;
    }
};

/**
 * Build the following chart: Ratio Man-Woman (general)
 * @param {json} config
 * @param {json} callback
 * optimized : true
 */
var chart1 = function (config, callback) {
    var data = {
        totalWomen: 0,
        totalMen: 0
    };
    controllers.personnel.list({}, function (err, personnels) {
        if (err) {
            log.error(err);
            audit.logEvent('[mongodb]', 'Chart', 'global', '', '', 'failed', 'Mongodb attempted to build global chart');
            callback(err);
        } else {
            data.totalStaff = personnels.length;
            function LoopA(a) {
                if (a < personnels.length && personnels[a]) {
                    if (personnels[a].gender == "F") {
                        data.totalWomen += 1;
                    } else {
                        data.totalMen += 1;
                    }
                    LoopA(a + 1);
                } else {
                    callback(null, data);
                }
            }
            LoopA(0);
        }
    });
};

/**
 * Build the following chart: Corps of Treasury
 * @param {json} config
 * @param {json} callback
 * optimized : true
 */
var card2 = function (config, callback) {
    var data = {
        ipt: 0,
        it: 0,
        cpt: 0,
        ct: 0,
        cat: 0,
        commis: 0,
        totalCorpsTresor: 0
    };
    controllers.personnel.list({}, function (err, personnels) {
        if (err) {
            log.error(err);
            audit.logEvent('[mongodb]', 'Chart', 'global', '', '', 'failed', 'Mongodb attempted to build global chart');
            callback(err);
        } else {
            function LoopA(a) {
                if (a < personnels.length && personnels[a]) {
                    var grade = (personnels[a].grade) ? personnels[a].grade : "";
                    var status = (personnels[a].status) ? personnels[a].status : "";

                    if (status == "1") {
                        var thisgrade = dictionary.getJSONById('../../resources/dictionary/personnel/status/' + status + '/grades.json', parseInt(grade, 10), "en");
                        if (thisgrade) {
                            corps = ((personnels[a].corps) ? personnels[a].corps : thisgrade.corps);
                        }

                        switch (grade) {
                            case '6':
                                data.ipt += 1;
                                break;
                            case '5':
                                data.it += 1;
                                break;
                            case '9':
                                data.cpt += 1;
                                break;
                            case '10':
                                data.ct += 1;
                                break;
                            case '13':
                                data.cat += 1;
                                break;
                            case '14':
                                data.commis += 1;
                                break;
                            default:
                                break;
                        }
                    }

                    LoopA(a + 1);
                } else {
                    callback(null, data);
                }
            }
            LoopA(0);
        }
    });
};

/**
 * Build the following chart: Ratio Man-Woman (Treasury)
 * @param {json} config
 * @param {json} callback
 * optimized : true
 */
var chart2 = function (config, callback) {
    var data = {
        totalWomen: 0,
        totalMen: 0,
        totalCorpsTresor: 0,
    };
    controllers.personnel.list({}, function (err, personnels) {
        if (err) {
            log.error(err);
            audit.logEvent('[mongodb]', 'Chart', 'global', '', '', 'failed', 'Mongodb attempted to build global chart');
            callback(err);
        } else {
            function LoopA(a) {
                if (a < personnels.length && personnels[a]) {
                    var grade = (personnels[a].grade) ? personnels[a].grade : "";
                    var status = (personnels[a].status) ? personnels[a].status : "";

                    if (status == "1") {
                        var thisgrade = dictionary.getJSONById('../../resources/dictionary/personnel/status/' + status + '/grades.json', parseInt(grade, 10), "en");
                        if (thisgrade) {
                            corps = ((personnels[a].corps) ? personnels[a].corps : thisgrade.corps);
                        }

                        if (corps == "2") {
                            data.totalCorpsTresor += 1;
                            if (personnels[a].gender == "F") {
                                data.totalWomen += 1;
                            } else {
                                data.totalMen += 1;
                            }
                        }
                    }

                    LoopA(a + 1);
                } else {
                    callback(null, data);
                }
            }
            LoopA(0);
        }
    });
};

/**
 * Build the following chart: Personal under the Labor Code
 * @param {json} config
 * @param {json} callback
 * optimized : true
 */
var card4 = function (config, callback) {
    var data = [];
    var data1 = [];
    var options = {
        query: {
            status: "2"
        }
    }
    controllers.personnel.list(options, function (err, personnels) {
        if (err) {
            log.error(err);
            audit.logEvent('[mongodb]', 'Chart', 'global', '', '', 'failed', 'Mongodb attempted to build global chart');
            callback(err);
        } else {
            var categories = dictionary.getJSONList('../../resources/dictionary/personnel/status/' + 2 + '/categories.json', "en");
            for (var c in categories) {
                var line = {
                    category: categories[c].code,
                    totalMen: 0,
                    totalWoman: 0
                };
                data1[categories[c].id] = line;
            }

            function LoopA(a) {
                if (a < personnels.length && personnels[a]) {
                    var grade = (personnels[a].grade) ? personnels[a].grade : "";
                    var category = (personnels[a].category) ? personnels[a].category : "";
                    
                    if (category  != "" && data1[category]){
                        if (personnels[a].gender == "F" ) {
                            data1[category].totalWoman += 1;
                        } else {
                            data1[category].totalMen += 1;
                        }
                    }
                    LoopA(a + 1);
                } else {
                    for (var c in categories) {
                        var line = {
                            category: categories[c].code,
                            totalMen: 0,
                            totalWoman: 0
                        };
                        data.push(data1[categories[c].id]);
                    }
                    callback(null, data);
                }
            }
            LoopA(0);
        }
    });
};

/**
 * Build the following chart: Ratio Man-Woman (Person under labor code)
 * @param {json} config
 * @param {json} callback
 * optimized : true
 */
var card6 = function (config, callback) {
    var data = {
        totalWomen: 0,
        totalMen: 0,
    };
    controllers.personnel.list({}, function (err, personnels) {
        if (err) {
            log.error(err);
            audit.logEvent('[mongodb]', 'Chart', 'global', '', '', 'failed', 'Mongodb attempted to build global chart');
            callback(err);
        } else {
            function LoopA(a) {
                if (a < personnels.length && personnels[a]) {
                    var grade = (personnels[a].grade) ? personnels[a].grade : "";
                    var status = (personnels[a].status) ? personnels[a].status : "";

                    if (status == "2") {
                        if (personnels[a].gender == "F") {
                            data.totalWomen += 1;
                        } else {
                            data.totalMen += 1;
                        }
                    }

                    LoopA(a + 1);
                } else {
                    callback(null, data);
                }
            }
            LoopA(0);
        }
    });
};

var global = function (config, callback) {
    var data = {
        totalStaff: 0,
        totalCorpsTresor: 0,
        totalNonFonctionnaire: 0,
        totalPostesVacants: 0,
        totalWomen: 0,
        totalMen: 0
    };

    controllers.personnel.list({}, function (err, personnels) {
        if (err) {
            log.error(err);
            audit.logEvent('[mongodb]', 'Chart', 'global', '', '', 'failed', 'Mongodb attempted to build global chart');
            callback(err);
        } else {
            data.totalStaff = personnels.length;
            function LoopA(a) {
                if (a < personnels.length && personnels[a]) {
                    var grade = (personnels[a].grade) ? personnels[a].grade : "";
                    var status = (personnels[a].status) ? personnels[a].status : "";
                    if (status == "2") {
                        data.totalNonFonctionnaire += 1;
                    }

                    if (status != "") {
                        var thisgrade = dictionary.getJSONById('../../resources/dictionary/personnel/status/' + status + '/grades.json', parseInt(grade, 10), "en");
                        if (thisgrade) {
                            corps = ((personnels[a].corps) ? personnels[a].corps : thisgrade.corps);
                        }

                        if (corps == "2") {
                            data.totalCorpsTresor += 1;
                        }
                    }

                    if (personnels[a].gender == "F") {
                        data.totalWomen += 1;
                    } else {
                        data.totalMen += 1;
                    }
                    LoopA(a + 1);
                } else {
                    callback(null, data);
                }
            }
            LoopA(0);
        }
    });
}


/* startDate=> moment.js date object */
function getMonths(startDate, endDate) {
    var endDateNormalized = endDate.clone().startOf("month");
    endDateNormalized.add(1, "M");
    var startDateNormalized = startDate.clone().startOf("month").add(1, "M");
    var months = [];

    while (startDateNormalized.isBefore(endDateNormalized)) {
        months.push({
            label: startDateNormalized.format("MMMM"),
            number: startDateNormalized.format("M"),
            from: startDateNormalized.startOf('month').toDate(),
            to: startDateNormalized.endOf('month').toDate()
        });
        startDateNormalized.add(1, "M");
    }
    return months;
}

/* startDate=> moment.js date object */
function getYears(startDate, endDate) {
    var endDateNormalized = endDate.clone().startOf("year");
    endDateNormalized.add(1, "Y");
    var startDateNormalized = startDate.clone().startOf("year").add(1, "Y");
    var years = [];

    while (startDateNormalized.isBefore(endDateNormalized)) {
        years.push({
            label: startDateNormalized.format("YY"),
            number: startDateNormalized.format("Y"),
            from: startDateNormalized.startOf('year').toDate(),
            to: startDateNormalized.endOf('year').toDate()
        });
        startDateNormalized.add(1, "Y");
    }
    return years;
}

function kFormatter(num) {
    return (num / 1000000).toFixed(6);
}