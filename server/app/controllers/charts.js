var Personnel = require('../models/personnel').Personnel;
var audit = require('../utils/audit-log');
var log = require('../utils/log');
var moment = require('moment');
var dictionary = require('../utils/dictionary');
var _ = require('underscore');
var ObjectID = require('mongoose').mongo.ObjectID;
var controllers = {
    users: require('./users'),
    projects: require('./projects'),
    personnel: require('./personnel'),
    positions: require('./positions'),
    structures: require('./structures'),
    tasks: require('./tasks'),
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
                selecteduser: req.params.selecteduser
            }, function (err, chart) {
                if (err) {
                    res.sendStatus(500);
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
        case 'procras0':
            procras0(config, function (err, chart) {
                if (err) {
                    callback(err);
                } else {
                    callback(null, chart);
                }
            });
            break;
        case 'procras6_7':
            procras6_7(config, function (err, chart) {
                if (err) {
                    callback(err);
                } else {
                    callback(null, chart);
                }
            });
            break;
        case 'procras8_synthesis':
            procras8_synthesis(config, function (err, chart) {
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
    var options = {
        req: {
            actor: config.actor
        }
    }
    controllers.personnel.list(options, function (err, personnels) {
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
    var options = {
        req: {
            actor: config.actor
        }
    }
    controllers.personnel.list(options, function (err, personnels) {
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
    var options = {
        req: {
            actor: config.actor
        }
    }
    controllers.personnel.list(options, function (err, personnels) {
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
                        var corps = undefined;
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
        },
        req: {
            actor: config.actor
        },
        aggregation: {"$match": {"status": "2"}}
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

                    if (category != "" && data1[category]) {
                        if (personnels[a].gender == "F") {
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
    var options = {
        req: {
            actor: config.actor
        }
    }
    controllers.personnel.list(options, function (err, personnels) {
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
/**
 * Build the number of tasks completed, in progress, overdue, blocked per month
 * @param {json} config
 * @param {json} callback
 * optimized : true
 */
var procras6_7 = function (config, callback) {
    var months = getDates(moment(new Date(new Date().setDate(new Date().getDate() - 365))), moment(new Date));
    var data = [];
    var labels = [];
    var values = [];
    var query = {$and: [{}, {}]};

    function myLoopH(i) {
        if (i < months.length) {
            query.$and[0] = {
                "created": {
                    $gte: moment(months[i].from).startOf('day').toDate()
                }
            };
            query.$and[1] = {
                "created": {
                    $lte: moment(months[i].to).endOf('day').toDate()
                }
            };

            var pipe = [];
            pipe.push({$match: query});
            pipe.push({$project: {_id: 1, authorID: 1, created: 1, lastModified: 1, usersID: 1, status: 1}});
            pipe.push(
                    {
                        $unwind: {
                            path: '$usersID'
                        }
                    }
            );

            var queryU = {$and: [{}]};
            if (config.selecteduser != "undefined") {
                queryU.$and.push({
                    "usersID": new ObjectID(config.selecteduser)
                });
                pipe.push({$match: queryU});
            }
            pipe.push({"$group": {_id: "$status", count: {$sum: 1}}});

            controllers.tasks.statistics({pipe: pipe}, function (err, tasks) {
                if (err) {
                    log.error(err);
                    audit.logEvent('[mongodb]', 'Chart', 'procras0', '', '', 'failed', 'Mongodb attempted to build procras0 chart');
                    callback(err);
                } else {
                    var notstarted = (tasks && tasks != undefined && tasks.filter(t => (t._id !== undefined && t._id == '1'))[0]) ? tasks.filter(t => (t._id !== undefined && t._id == '1'))[0].count : 0;
                    var inprogress = (tasks && tasks != undefined && tasks.filter(t => (t._id !== undefined && t._id == '2'))[0]) ? tasks.filter(t => (t._id !== undefined && t._id == '2'))[0].count : 0;
                    var completed = (tasks && tasks != undefined && tasks.filter(t => (t._id !== undefined && t._id == '3'))[0]) ? tasks.filter(t => (t._id !== undefined && t._id == '3'))[0].count : 0;
                    var blocked = (tasks && tasks != undefined && tasks.filter(t => (t._id !== undefined && t._id == '4'))[0]) ? tasks.filter(t => (t._id !== undefined && t._id == '4'))[0].count : 0;

                    values.push([notstarted, inprogress, completed])

                    myLoopH(i + 1);
                }
            });
        } else {
            for (k = 0; k < months.length; k++) {
                labels.push(months[k].label);
            }
            for (m = 0; m < 3; m++) {
                data[m] = [];
                for (n = 0; n < values.length; n++) {
                    data[m][n] = values[n][m];
                }
            }
            callback(null, {data: data, labels: labels});
        }
    }
    myLoopH(0);
};

/**
 * Build the number of tasks completed, in progress, overdue, blocked
 * @param {json} config
 * @param {json} callback
 * optimized : true
 */
var procras0 = function (config, callback) {
    var data = {
        notstarted: 0,
        completed: 0,
        inprogress: 0,
        overdue: 0,
        blocked: 0
    };
    var currentDateRange = {
        from: config.from,
        to: config.to
    };
    var mainQuery = {$and: [{}]};

    mainQuery.$and.push({
        "created": {
            $gte: moment(currentDateRange.from).startOf('day').toDate()
        }
    });
    mainQuery.$and.push({
        "created": {
            $lte: moment(currentDateRange.to).endOf('day').toDate()
        }
    });



    var pipe = [];
    pipe.push({$match: mainQuery});
    pipe.push({$project: {_id: 1, authorID: 1, created: 1, lastModified: 1, usersID: 1, status: 1}});
    pipe.push(
            {
                $unwind: {
                    path: '$usersID'
                }
            }
    );
    pipe.push({$sort: {created: -1}});

    var query1 = {$and: [{}]};
    if (config.selecteduser != "undefined") {
        query1.$and.push({
            "usersID": new ObjectID(config.selecteduser)
        });
        pipe.push({$match: query1});
    }
    pipe.push({"$group": {_id: "$status", count: {$sum: 1}}});

    controllers.tasks.statistics({pipe: pipe}, function (err, tasks) {
        if (err) {
            log.error(err);
            audit.logEvent('[mongodb]', 'Chart', 'procras0', '', '', 'failed', 'Mongodb attempted to build procras0 chart');
            callback(err);
        } else {
            data.notstarted = (tasks && tasks != undefined && tasks.filter(t => (t._id !== undefined && t._id == '1'))[0]) ? tasks.filter(t => (t._id !== undefined && t._id == '1'))[0].count : 0;
            data.inprogress = (tasks && tasks != undefined && tasks.filter(t => (t._id !== undefined && t._id == '2'))[0]) ? tasks.filter(t => (t._id !== undefined && t._id == '2'))[0].count : 0;
            data.completed = (tasks && tasks != undefined && tasks.filter(t => (t._id !== undefined && t._id == '3'))[0]) ? tasks.filter(t => (t._id !== undefined && t._id == '3'))[0].count : 0;
            data.blocked = (tasks && tasks != undefined && tasks.filter(t => (t._id !== undefined && t._id == '4'))[0]) ? tasks.filter(t => (t._id !== undefined && t._id == '4'))[0].count : 0;
            callback(null, data);
        }
    });
};

/**
 * Build the synthesis
 * @param {json} config
 * @param {json} callback
 * optimized : true
 */
var procras8_synthesis = function (config, callback) {
    var data = [];
    var currentDateRange = {
        from: config.from,
        to: config.to
    };
    var mainQuery = {$and: [{}]};

    mainQuery.$and.push({
        "created": {
            $gte: moment(currentDateRange.from).startOf('day').toDate()
        }
    });
    mainQuery.$and.push({
        "created": {
            $lte: moment(currentDateRange.to).endOf('day').toDate()
        }
    });

    //Get all tests list projected
    var pipe = [];
    pipe.push({$match: mainQuery});
    pipe.push({$project: {_id: 1, authorID: 1, created: 1, usersID: 1, status: 1}});
    pipe.push(
            {
                $unwind: {
                    path: '$usersID'
                }
            }
    );

    var query1 = {};
    if (config.selecteduser != "undefined") {
        query1 = {$and: [{}]};
        query1.$and.push({
            "_id": new ObjectID(config.selecteduser)
        });
    }
    
    var data = {
        counter: {},
        synthesis: []
    };
    var totalOfnotstarted = 0;
    var totalOfcompleted = 0;
    var totalOfinprogress = 0;
    var totalOfoverdue = 0;
    var totalOfblocked = 0;


    controllers.tasks.statistics({pipe: pipe}, function (err, tasks) {
        if (err) {
            log.error(err);
            audit.logEvent('[mongodb]', 'Chart', 'procras0', '', '', 'failed', 'Mongodb attempted to build procras0 chart');
            callback(err);
        } else {
            var usersGroups = _.groupBy(tasks, 'usersID');
            controllers.users.list(query1, {_id: 1, firstname: 1, lastname: 1}, function (err, users) {
                if (err) {
                    log.error(err);
                    audit.logEvent('[mongodb]', 'Chart', 'procras0', '', '', 'failed', 'Mongodb attempted to build procras0 chart');
                    callback(err);
                } else {

                    for (i = 0; i < users.length; i++) {
                        var tmp = {
                            userName : users[i].name,
                            _id : users[i]._id,
                            notstarted : (usersGroups[users[i]._id]) ? usersGroups[users[i]._id].filter(t => t.status == "1").length : 0,
                            inprogress : (usersGroups[users[i]._id]) ? usersGroups[users[i]._id].filter(t => t.status == "2").length : 0,
                            completed : (usersGroups[users[i]._id]) ? usersGroups[users[i]._id].filter(t => t.status == "3").length : 0,
                            blocked : (usersGroups[users[i]._id]) ? usersGroups[users[i]._id].filter(t => t.status == "4").length : 0,
                            overdue: 0,
                        };
                        totalOfnotstarted += tmp.notstarted;
                        totalOfcompleted += tmp.completed;
                        totalOfinprogress += tmp.inprogress;
                        totalOfoverdue += tmp.overdue;
                        totalOfblocked += tmp.blocked;
                        data.synthesis.push(tmp);
                        
                    }
                    data.counter.totalOfnotstarted = totalOfnotstarted;
                    data.counter.totalOfcompleted = totalOfcompleted;
                    data.counter.totalOfinprogress = totalOfinprogress;
                    data.counter.totalOfblocked = totalOfblocked;
                    data.counter.totalOfoverdue = totalOfoverdue;

                    callback(null, data);
                }
            });
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
        totalMen: 0,
        structures: 0,
        positions: 0
    };

    var options = {
        req: {
            actor: config.actor
        }
    }
    controllers.personnel.list(options, function (err, personnels) {
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
                        var corps = undefined;
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
                    controllers.structures.count({}, function (err, count) {
                        if (err) {
                            log.error(err);
                            callback(err);
                        } else {
                            data.structures = count;
                            controllers.positions.count({}, function (err, count) {
                                if (err) {
                                    log.error(err);
                                    callback(err);
                                } else {
                                    data.positions = count;
                                    callback(null, data);
                                }
                            });
                        }
                    });
                }
            }
            LoopA(0);
        }
    });
}


/* startDate=> moment.js date object */
function getDates(startDate, endDate) {
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