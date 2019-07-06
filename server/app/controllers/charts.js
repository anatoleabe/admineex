var audit = require('../utils/audit-log');
var log = require('../utils/log');
var moment = require('moment');
var _ = require('underscore');
var controllers = {
    users: require('./users'),
    projects: require('./projects'),
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
        case 'global':
            global(config, function (err, chart) {
                if (err) {
                    callback(err);
                } else {
                    callback(null, chart);
                }
            });
            break;
        case 'tresor':
            tresor(config, function (err, chart) {
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
 * Build the following chart: Forecast Income by probability (next 12 months)
 * @param {json} config
 * @param {json} callback
 * optimized : true
 */
var chart1 = function (config, callback) {
    var months = getMonths(moment(new Date(new Date().setDate(new Date().getDate() - 30))), moment(new Date(new Date().setDate(new Date().getDate() + 365-30))));
    var data = [];
    var labels = [];
    var values = [];
    function myLoopH(i) {
        if (i < months.length) {
            var query = {
                $and: [{
                    "paymentDate": {
                        $gte: moment(months[i].from).startOf('day')
                    }
                },{
                    "paymentDate": {
                        $lte: moment(months[i].to).endOf('day')
                    }
                },{
                    status: { $ne: '6' }
                }]
            };
            controllers.projects.getProjectsByFilter({actor:config.actor,query:query}, function (err, projects) {
                if (err) {
                    audit.logEvent('[mongodb]', 'Charts', 'chart1', '', '', 'failed', 'Mongodb attempted to count tests');
                    callback(err);
                } else {
                    var less = 0;
                    var more = 0;
                    for(j=0;j<projects.length;j++){
                        if(projects[j].successProbability < 50){
                            less += projects[j].value * projects[j].successProbability / 100; 
                        } else {
                            more += projects[j].value * projects[j].successProbability / 100; 
                        }
                    }
                    values.push([kFormatter(less), kFormatter(more)]);
                    myLoopH(i + 1);
                }
            });
        } else {
            for (k = 0; k < months.length; k++) {
                labels.push(months[k].label);
            }
            for (m = 0; m < 2; m++) {
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

var global = function (config, callback) {
    var data = {
        totalStaff:1,
        totalCorpsTresor: 1,
        totalNonFonctionnaire: 1,
        totalPostesVacants: 1,
        totalWomen: 1,
        totalMen: 1
    };
    callback(null, data);
}

var tresor = function (config, callback) {
    var data = {
        ipt:0,
        ip: 0,
        cpt: 0,
        ct: 0,
        cat: 0,
        commis: 0,
        totalWomen: 1,
        totalMen: 1,
        
    };
    callback(null, data);
}

var nonFonctionnaire = function (config, callback) {
    
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
    return (num/1000000).toFixed(6);
}