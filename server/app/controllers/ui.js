var User            = require('../models/user').User;
var Project         = require('../models/project').Project;
var log             = require('../utils/log');
var audit           = require('../utils/audit-log');
var _               = require('underscore');
var formidable      = require('formidable');
var chartsList      = require('../../resources/dictionary/app/charts.json');
var nconf           = require('nconf');

// API
exports.api = {};

var controllers = {
    configuration: require('./configuration'),
    users: require('./users'),
    projects: require('./projects')
};

// Build navbar
exports.api.nav = function(req,res){
    if(req.actor){
        User.findOne({_id: req.actor.id}, function (err, user) {
            if(err){
                log.error(err);
                return res.status(500).send(err);
            } else {
                if (user !== null) {
                    buildNav(user, function(navBuilt){
                        return res.json({
                            nav: navBuilt,
                            serverName: controllers.configuration.getConf().server.name,
                            httpPort: controllers.configuration.getConf().server.httpPort
                        });
                    });
                } else {
                    return res.sendStatus(401);
                }
            }
        });
    } else {
        return res.sendStatus(401);
    }
};

// Build widgets (charts)
exports.api.charts = function(req,res){
    if(req.actor){
        User.findOne({_id: req.actor.id}, function (err, user) {
            if (!err && user != null) {
                buildCharts(user, function(err, chartsBuilt){
                    if(err) {
                        return res.status(500).send(err);
                    } else {
                        return res.json({
                            charts: chartsBuilt
                        });
                    }
                });
            } else {
                return res.sendStatus(401);
            }
        });
    } else {
        return res.sendStatus(401);
    }
};

function buildNav(user, callback){
    var server = controllers.configuration.getConf().server;

    // Const.
    var nav = {
        left: [{
            header: '',
            items: []
        },{
            header: 'Server',
            items: []
        },{
            header: 'Account',
            items: []
        }]
    }
    var dashboard = {
        href: 'home.dashboard.main',
        icon: 'dashboard',
        label: 'Dashboard',
        name: 'Dashboard'
    };
    var personnalData = {
        href: 'home.projects.main',
        icon: 'class',
        label: 'Personnal data',
        name: 'Personnal data'
    };
    var administration = {
        href: 'home.organizations.main',
        icon: 'account_balance',
        label: 'Administration',
        name: 'Administration'
    };
    var statistics = {
        href: 'home.statistics.main',
        icon: 'chart',
        label: 'Statistics',
        name: 'Statistics'
    };
    var reports = {
        href: 'home.reports.main',
        icon: 'save_alt',
        label: 'Reports',
        name: 'Reports'
    };
    var import_export = {
        href: 'home.import_export',
        icon: 'import_export',
        label: 'Import-Export',
        name: 'Import-Export'
    };
    var users = {
        href: 'home.users.main',
        icon: 'supervisor_account',
        label: 'Users',
        name: 'Users'
    };

    // Preferences
    var configuration = {
        href: 'home.configuration',
        icon: 'settings',
        label: 'Configuration',
        name: 'Configuration'
    };
    var audit = {
        href: 'home.audit',
        icon: 'history',
        label: 'Audit',
        name: 'Audit'
    };
    // Account
    var profile = {
        href: 'home.profile.main',
        icon: 'account_circle',
        label: 'Profile',
        name: 'Profile'
    };
    var settings = {
        href: 'home.settings.main',
        icon: 'tune',
        label: 'Settings',
        name: 'Settings'
    };
    var signout = {
        href: '#',
        icon: 'exit_to_app',
        label: 'Sign out',
        name: 'Sign out'
    };

    //END DIAMA MENU
    // Build the nav
    nav.left[0].items.push(dashboard);
    nav.left[0].items.push(personnalData);
    nav.left[0].items.push(statistics);
    nav.left[0].items.push(reports);
    nav.left[0].items.push(administration);
    nav.left[0].items.push(users);
    nav.left[0].items.push(import_export);
    switch(user.role){
        case '1':
            // PREFERNCES
            nav.left[1].items.push(configuration);
            nav.left[1].items.push(audit);
            break;
    }
    // LEFT MENU
    nav.left[2].items.push(profile);
    nav.left[2].items.push(settings);
    nav.left[2].items.push(signout);

    // Nav Built
    callback(nav);
};

function buildCharts(user, callback){
    var role =  parseInt(user.role);
    var charts = JSON.parse(JSON.stringify(chartsList));
    charts = _.filter(charts, function (kChart){
        return kChart.roles.indexOf(role) > -1;
    });
    charts = _.sortBy(charts, 'priority');
    callback(null, charts);
};