var User = require('../models/user').User;
var Project = require('../models/project').Project;
var log = require('../utils/log');
var audit = require('../utils/audit-log');
var _ = require('underscore');
var formidable = require('formidable');
var chartsList = require('../../resources/dictionary/app/charts.json');
var nconf = require('nconf');
var dictionary = require('../utils/dictionary');

// API
exports.api = {};

var controllers = {
    configuration: require('./configuration'),
    users: require('./users'),
    projects: require('./projects')
};

// Build navbar
exports.api.nav = function (req, res) {
    if (req.actor) {
        User.findOne({_id: req.actor.id}, function (err, user) {
            if (err) {
                log.error(err);
                return res.status(500).send(err);
            } else {
                if (user !== null) {
                    buildNav(user, function (navBuilt) {
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
exports.api.charts = function (req, res) {
    if (req.actor) {
        User.findOne({_id: req.actor.id}, function (err, user) {
            if (!err && user != null) {
                buildCharts(user, function (err, chartsBuilt) {
                    if (err) {
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

function buildNav(user, callback) {
    var server = controllers.configuration.getConf().server;
    var gt = dictionary.translator(user.language);
    // Const.
    var nav = {
        left: [{
                header: '',
                items: []
            }, {
                header: 'Server',
                items: []
            }, {
                header: 'Account',
                items: []
            }]
    }
    var dashboard = {
        href: 'home.dashboard.main',
        icon: 'dashboard',
        label: gt.gettext('Dashboard'),
        name: gt.gettext('Dashboard')
    };
    var staffManagement = {
        href: 'home.staffs.main',
        icon: 'class',
        label: 'Staff management',
        name: 'Staff management',
        items: []
    };

    // Staff Management tabs
    var staffManagementTab1 = {
        href: 'home.staffs.personnalrecords',
        label: 'Personnal records',
        name: 'Personnal records'
    };
    var staffManagementTab2 = {
        href: 'home.staffs.main',
        label: 'Staff management',
        name: 'Staff management'
    };
//    var staffManagementTab3 = {
//        href: 'home.staffs.status.main',
//        label: 'Status',
//        name: 'Status'
//    };
//    var staffManagementTab4 = {
//        href: 'home.staffs.discipline.main',
//        label: 'Discipline',
//        name: 'Discipline'
//    };

    var administration = {
        href: 'home.administration.positions',
        icon: 'folder',
        label: 'Administration',
        name: 'Administration',
        items: []
    };

    // Administration tabs
    var administrationTab1 = {
        href: 'home.administration.positions',
        label: "Positions",
        name: 'Positions'
    };
    var administrationTab2 = {
        href: 'home.administration.structures',
        label: 'Structures',
        name: 'Structures'
    };
//    var administrationTab3 = {
//        href: 'home.administration.export',
//        label: 'Export',
//        name: 'Export'
//    };
//    var administrationTab4 = {
//        href: 'home.administration.duplicates',
//        label: 'Duplicates',
//        name: 'Duplicates'
//    };

    var monitoring = {
        href: 'home.monitor.main',
        icon: 'verified_user',
        label: 'Monitoring & Evaluation',
        name: 'Monitoring & Evaluation',
        items: []
    };

    var monitoringTab1 = {
        href: 'home.monitor.monitor',
        label: 'Monitoring & Evaluation',
        name: 'Monitoring & Evaluation'
    };
//    
//    var statistics = {
//        href: 'home.statistics.main',
//        icon: 'equalizer',
//        label: 'Statistics',
//        name: 'Statistics'
//    };
    var reports = {
        href: 'home.reports.main',
        icon: 'save_alt',
        label: 'Reports',
        name: 'Reports'
    };
    var thresholds = {
        href: 'home.thresholds',
        icon: 'lightbulb_outline',
        label: 'Thresholds',
        name: 'Thresholds'
    };
    var users = {
        href: 'home.users.main',
        icon: 'supervisor_account',
        label: gt.gettext('Users'),
        name: gt.gettext('Users')
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
        label: gt.gettext('Profile'),
        name: gt.gettext('Profile')
    };
    var settings = {
        href: 'home.settings.main',
        icon: 'tune',
        label: gt.gettext('Settings'),
        name: gt.gettext('Settings')
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

    //nav.left[0].items.push(import_export);
    switch (user.role) {
        case '1'://Administrator
            // LEFT MENU STAFF MANAGEMENT
            nav.left[0].items.push(staffManagement);
            // LEFT MENU TABS FOR STAFF MANAGEMENT
            nav.left[0].items[nav.left[0].items.length - 1].items.push(staffManagementTab1);
            nav.left[0].items[nav.left[0].items.length - 1].items.push(staffManagementTab2);
            // LEFT MENU MONITOR
            nav.left[0].items.push(monitoring);
            nav.left[0].items[nav.left[0].items.length - 1].items.push(monitoringTab1);
            // LEFT MENU STATISTICS
            // LEFT MENU ADMINISTRATION
            nav.left[0].items.push(administration);
            // LEFT MENU TABS FOR ADMINISTRATION
            nav.left[0].items[nav.left[0].items.length - 1].items.push(administrationTab1);
            nav.left[0].items[nav.left[0].items.length - 1].items.push(administrationTab2);
            nav.left[0].items.push(thresholds);
//            //LEFT MENU REPORTS
            // PREFERNCES
            nav.left[1].items.push(users);
            nav.left[1].items.push(configuration);
            nav.left[1].items.push(audit);
            break;
        case '2'://Manager
            // LEFT MENU STAFF MANAGEMENT
            nav.left[0].items.push(staffManagement);
            // LEFT MENU TABS FOR STAFF MANAGEMENT
            nav.left[0].items[nav.left[0].items.length - 1].items.push(staffManagementTab1);
            nav.left[0].items[nav.left[0].items.length - 1].items.push(staffManagementTab2);
            // LEFT MENU MONITOR
            nav.left[0].items.push(monitoring);
            nav.left[0].items[nav.left[0].items.length - 1].items.push(monitoringTab1);
            // LEFT MENU ADMINISTRATION
            nav.left[0].items.push(administration);
            nav.left[0].items.push(thresholds);
            // LEFT MENU TABS FOR ADMINISTRATION
            nav.left[0].items[nav.left[0].items.length - 1].items.push(administrationTab1);
            nav.left[0].items[nav.left[0].items.length - 1].items.push(administrationTab2);
            break;
        case '3'://Supervisor
            // LEFT MENU STAFF MANAGEMENT
            nav.left[0].items.push(staffManagement);
            // LEFT MENU TABS FOR STAFF MANAGEMENT
            nav.left[0].items[nav.left[0].items.length - 1].items.push(staffManagementTab1);
            nav.left[0].items[nav.left[0].items.length - 1].items.push(staffManagementTab2);
            // LEFT MENU ADMINISTRATION
            nav.left[0].items.push(administration);
            // LEFT MENU TABS FOR ADMINISTRATION
            nav.left[0].items[nav.left[0].items.length - 1].items.push(administrationTab1);
            nav.left[0].items[nav.left[0].items.length - 1].items.push(administrationTab2);
            nav.left[1].items.push(users);
            break;
        case '4'://Editor
            // LEFT MENU STAFF MANAGEMENT
            nav.left[0].items.push(staffManagement);
            // LEFT MENU TABS FOR STAFF MANAGEMENT
            nav.left[0].items[nav.left[0].items.length - 1].items.push(staffManagementTab1);
            nav.left[0].items[nav.left[0].items.length - 1].items.push(staffManagementTab2);
            // LEFT MENU ADMINISTRATION
            nav.left[0].items.push(administration);
            // LEFT MENU TABS FOR ADMINISTRATION
            nav.left[0].items[nav.left[0].items.length - 1].items.push(administrationTab1);
            nav.left[0].items[nav.left[0].items.length - 1].items.push(administrationTab2);
            break;
    }
    // LEFT MENU
    nav.left[2].items.push(profile);
    nav.left[2].items.push(settings);
    nav.left[2].items.push(signout);

    // Nav Built
    callback(nav);
}
;

function buildCharts(user, callback) {
    var role = parseInt(user.role);
    var charts = JSON.parse(JSON.stringify(chartsList));
    charts = _.filter(charts, function (kChart) {
        return kChart.roles.indexOf(role) > -1;
    });
    charts = _.sortBy(charts, 'priority');
    callback(null, charts);
}
;