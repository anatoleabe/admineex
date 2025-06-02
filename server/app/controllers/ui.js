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
                header: 'Main',
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
        sref: 'home.dashboard.main',
        icon: 'dashboard',
        icomoon: 'icon-home4',
        label: gt.gettext('Dashboard'),
        name: gt.gettext('Dashboard')
    };
    var staffManagement = {
        href: 'home.staffs.main',
        sref: '.staffs',
        icon: 'class',
        icomoon: 'icon-users4',
        label: gt.gettext('Staff management'),
        name: gt.gettext('Staff management'),
        items: []
    };

    // Staff Management tabs
    var staffManagementTab1 = {
        href: 'home.staffs.personnalrecords',
        sref: '.staffs',
        label: gt.gettext('Personnal records'),
        name: gt.gettext('Personnal records')
    };
    var staffManagementTab2 = {
        href: 'home.staffs.main',
        sref: '.staffs',
        label: gt.gettext('Staff management'),
        name: gt.gettext('Staff management')
    };
    var staffManagementTab3 = {
        href: 'home.staffs.retired',
        sref: '.staffs',
        label: gt.gettext('Retirement'),
        name: gt.gettext('Retirement')
    };
    
    var staffManagementTab4 = {
        href: 'home.staffs.assignments',
        sref: '.staffs',
        label: gt.gettext('Assignments management'),
        name: gt.gettext('Assignments management')
    };
    
    var staffManagementTab5 = {
        href: 'home.staffs.sanctions',
        sref: '.staffs',
        label: gt.gettext('Sanctions management'),
        name: gt.gettext('Sanctions management')
    };
    
    var staffManagementTab6 = {
        href: 'home.staffs.physicalrecords',
        sref: '.staffs',
        label: gt.gettext('Dossiers physique'),
        name: gt.gettext('Physical records')
    };

    var staffManagementTab7 = {
        href: 'home.staffs.export',
        sref: '.staffs',
        label: gt.gettext('Export'),
        name: gt.gettext('Export')
    };

    var task = {
        href: 'home.tasks.main',
        sref: '.tasks',
        icon: 'list',
        icomoon: 'icon-task',
        label: 'Procrastinate',
        name: 'Procrastinate',
        items: []
    };
    var taskTab1 = {
        href: 'home.tasks.main',
        sref: '.tasks',
        label: gt.gettext('Tasks management'),
        name: gt.gettext('Tasks management')
    };
    var taskTab3 = {
        href: 'home.tasks.synthesis',
        sref: '.tasks',
        label: gt.gettext('Synthesis'),
        name: gt.gettext('Synthesis')
    };
    var taskCategoryTab4 = {
        href: 'home.tasks.categories',
        sref: '.tasks',
        label: gt.gettext('Categories'),
        name: gt.gettext('Categories')
    };

    var administration = {
        href: 'home.administration.positions',
        sref: '.administration',
        icon: 'folder',
        icomoon: 'icon-folder4',
        label: 'Administration',
        name: 'Administration',
        items: []
    };

    // Administration tabs
    var administrationTab1 = {
        href: 'home.administration.positions',
        sref: '.administration',
        label: gt.gettext("Positions management"),
        name: gt.gettext('Positions management')
    };
    var administrationTab1_menu1 = {
        href: 'home.administration.new',
        sref: '.administration',
        label: gt.gettext("Add new position"),
        name: gt.gettext('Add new position')
    };
    
    var administrationTab2 = {
        href: 'home.administration.structures',
        sref: '.administration',
        label: gt.gettext('Structures management'),
        name: gt.gettext('Structures management')
    };
    var administrationTab2_menu1 = {
        href: 'home.administration.structures.new',
        sref: '.administration.structures',
        label: gt.gettext('Add new structure'),
        name: gt.gettext('Add new structure')
    };

    var monitoring = {
        href: 'home.monitor.main',
        sref: '.monitor',
        icon: 'verified_user',
        icomoon: 'icon-hat',
        label: gt.gettext('Monitoring & Evaluation'),
        name: gt.gettext('Monitoring & Evaluation'),
        items: []
    };

    var monitoringTab1 = {
        href: 'home.monitor.monitor',
        sref: '.monitor',
        label: gt.gettext('Monitoring & Evaluation'),
        name: gt.gettext('Monitoring & Evaluation')
    };

    var reports = {
        href: 'home.reports.main',
        icon: 'save_alt',
        label: gt.gettext('Reports'),
        name: gt.gettext('Reports')
    };
    var thresholds = {
        href: 'home.thresholds',
        sref: '.thresholds',
        icon: 'lightbulb_outline',
        icomoon: 'icon-traffic-lights',
        label: gt.gettext('Thresholds'),
        name: gt.gettext('Thresholds')
    };
    var users = {
        href: 'home.users.main',
        sref: 'home.users.main',
        icon: 'supervisor_account',
        icomoon: 'icon-users2',
        label: gt.gettext('Users'),
        name: gt.gettext('Users')
    };

    // Preferences
    var configuration = {
        href: 'home.configuration',
        sref: 'home.configuration',
        icon: 'settings',
        icomoon: 'icon-equalizer',
        label: 'Configuration',
        name: 'Configuration'
    };
    var audit = {
        href: 'home.audit',
        sref: 'home.audit',
        icon: 'history',
        icomoon: 'icon-history',
        label: 'Audit',
        name: 'Audit'
    };

    // Bonus Management Menu
    var bonusManagement = {
        href: 'home.bonus.instances',
        sref: 'home.bonus.instances',
        icon: 'card_giftcard',
        icomoon: 'icon-gift',
        label: gt.gettext('Bonus Management'),
        name: gt.gettext('Bonus Management'),
        items: [
            {
                href: 'home.bonus.rules',
                sref: 'home.bonus.rules',
                label: gt.gettext('Rules'),
                name: gt.gettext('Rules')
            },
            {
                href: 'home.bonus.templates',
                sref: 'home.bonus.templates',
                label: gt.gettext('Templates'),
                name: gt.gettext('Templates')
            },
            {
                href: 'home.bonus.instances',
                sref: 'home.bonus.instances',
                label: gt.gettext('Instances'),
                name: gt.gettext('Instances')
            },
            {
                href: 'home.bonus.allocations',
                sref: 'home.bonus.allocations',
                label: gt.gettext('Allocations'),
                name: gt.gettext('Allocations')
            },
            {
                href: 'home.bonus.reports',
                sref: 'home.bonus.reports',
                label: gt.gettext('Reports'),
                name: gt.gettext('Reports')
            }
        ]
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
            nav.left[0].items[nav.left[0].items.length - 1].items.push(staffManagementTab4);
            nav.left[0].items[nav.left[0].items.length - 1].items.push(staffManagementTab5);
            nav.left[0].items[nav.left[0].items.length - 1].items.push(staffManagementTab6);
            nav.left[0].items[nav.left[0].items.length - 1].items.push(staffManagementTab3);
            nav.left[0].items[nav.left[0].items.length - 1].items.push(staffManagementTab7);
            // LEFT MENU MONITOR
//            nav.left[0].items.push(monitoring);
//            nav.left[0].items[nav.left[0].items.length - 1].items.push(monitoringTab1);
            // LEFT MENU TASK
            nav.left[0].items.push(task);
            nav.left[0].items[nav.left[0].items.length - 1].items.push(taskTab1);
            nav.left[0].items[nav.left[0].items.length - 1].items.push(taskCategoryTab4);
            // LEFT MENU ADMINISTRATION
            nav.left[0].items.push(administration);
            // LEFT MENU TABS FOR ADMINISTRATION
            nav.left[0].items[nav.left[0].items.length - 1].items.push(administrationTab1_menu1);
            nav.left[0].items[nav.left[0].items.length - 1].items.push(administrationTab1);
            nav.left[0].items[nav.left[0].items.length - 1].items.push(administrationTab2_menu1);
            nav.left[0].items[nav.left[0].items.length - 1].items.push(administrationTab2);
            nav.left[0].items.push(thresholds);
//            //LEFT MENU REPORTS
            // PREFERNCES
            nav.left[1].items.push(users);
            nav.left[1].items.push(configuration);
            nav.left[1].items.push(audit);
            nav.left[0].items.push(bonusManagement);
            break;
        case '2'://Manager
            // LEFT MENU STAFF MANAGEMENT
            nav.left[0].items.push(staffManagement);
            // LEFT MENU TABS FOR STAFF MANAGEMENT
            nav.left[0].items[nav.left[0].items.length - 1].items.push(staffManagementTab1);
            nav.left[0].items[nav.left[0].items.length - 1].items.push(staffManagementTab2);
            nav.left[0].items[nav.left[0].items.length - 1].items.push(staffManagementTab4);
            nav.left[0].items[nav.left[0].items.length - 1].items.push(staffManagementTab5);
            nav.left[0].items[nav.left[0].items.length - 1].items.push(staffManagementTab6);
            nav.left[0].items[nav.left[0].items.length - 1].items.push(staffManagementTab3);
            nav.left[0].items[nav.left[0].items.length - 1].items.push(staffManagementTab7);
            // LEFT MENU MONITOR
//            nav.left[0].items.push(monitoring);
//            nav.left[0].items[nav.left[0].items.length - 1].items.push(monitoringTab1);
            // LEFT MENU ADMINISTRATION
            nav.left[0].items.push(administration);
            // LEFT MENU TABS FOR ADMINISTRATION
            nav.left[0].items[nav.left[0].items.length - 1].items.push(administrationTab1);
            nav.left[0].items[nav.left[0].items.length - 1].items.push(administrationTab2);
            
            nav.left[0].items.push(thresholds);
            nav.left[0].items.push(bonusManagement);
            break;
        case '3'://Supervisor
            // LEFT MENU STAFF MANAGEMENT
            nav.left[0].items.push(staffManagement);
            // LEFT MENU TABS FOR STAFF MANAGEMENT
            nav.left[0].items[nav.left[0].items.length - 1].items.push(staffManagementTab1);
            nav.left[0].items[nav.left[0].items.length - 1].items.push(staffManagementTab2);
            nav.left[0].items[nav.left[0].items.length - 1].items.push(staffManagementTab4);
            nav.left[0].items[nav.left[0].items.length - 1].items.push(staffManagementTab5);
            nav.left[0].items[nav.left[0].items.length - 1].items.push(staffManagementTab6);
            nav.left[0].items[nav.left[0].items.length - 1].items.push(staffManagementTab3);
            nav.left[0].items[nav.left[0].items.length - 1].items.push(staffManagementTab7);
            // LEFT MENU ADMINISTRATION
            nav.left[0].items.push(administration);
            // LEFT MENU TABS FOR ADMINISTRATION
            nav.left[0].items[nav.left[0].items.length - 1].items.push(administrationTab1);
            nav.left[0].items[nav.left[0].items.length - 1].items.push(administrationTab2);
            nav.left[1].items.push(users);
            nav.left[0].items.push(bonusManagement);
            break;
        case '4'://Editor
            // LEFT MENU STAFF MANAGEMENT
            nav.left[0].items.push(staffManagement);
            // LEFT MENU TABS FOR STAFF MANAGEMENT
            nav.left[0].items[nav.left[0].items.length - 1].items.push(staffManagementTab1);
            nav.left[0].items[nav.left[0].items.length - 1].items.push(staffManagementTab2);
            nav.left[0].items[nav.left[0].items.length - 1].items.push(staffManagementTab4);
            nav.left[0].items[nav.left[0].items.length - 1].items.push(staffManagementTab5);
            nav.left[0].items[nav.left[0].items.length - 1].items.push(staffManagementTab6);
            nav.left[0].items[nav.left[0].items.length - 1].items.push(staffManagementTab3);
            nav.left[0].items[nav.left[0].items.length - 1].items.push(staffManagementTab7);
            // LEFT MENU ADMINISTRATION
            nav.left[0].items.push(administration);
            // LEFT MENU TABS FOR ADMINISTRATION
            nav.left[0].items[nav.left[0].items.length - 1].items.push(administrationTab1_menu1);
            nav.left[0].items[nav.left[0].items.length - 1].items.push(administrationTab1);
            nav.left[0].items[nav.left[0].items.length - 1].items.push(administrationTab2_menu1);
            nav.left[0].items[nav.left[0].items.length - 1].items.push(administrationTab2);
            nav.left[0].items.push(bonusManagement);
            break;
        case '5'://Task user
            // LEFT MENU TASK
            nav.left[0].items.push(task);
            nav.left[0].items[nav.left[0].items.length - 1].items.push(taskTab1);
            nav.left[0].items[nav.left[0].items.length - 1].items.push(taskTab3);
            nav.left[0].items[nav.left[0].items.length - 1].items.push(taskCategoryTab4);

            break;
    }

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
