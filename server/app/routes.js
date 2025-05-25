const jwt = require('express-jwt');
const path = require('path');
const jsonwebtoken = require('jsonwebtoken');
const _ = require('underscore');
const tokenManager = require('./managers/token');
const nconf = require('nconf');
nconf.file("config/server.json");
const User = require('./models/user').User;
const aclRoutes = require('../resources/dictionary/app/routes.json');
const audit = require('./utils/audit-log');
const log = require('./utils/log');
const dictionary = require('./utils/dictionary');
const secret = nconf.get('token').secret;
const app = require('../app');
const moment = require('moment');

const initializationManager = require('./initialization');

// Controllers
const controllers = {};
controllers.audit = require('./controllers/auditLogs');
controllers.account = require('./controllers/account');
controllers.users = require('./controllers/users');
controllers.projects = require('./controllers/projects');
controllers.structures = require('./controllers/structures');
controllers.positions = require('./controllers/positions');
controllers.affectations = require('./controllers/affectations');
controllers.personnel = require('./controllers/personnel');
controllers.personnelSnapshot = require('./controllers/personnel/snapshot');
controllers.bonus = {
    instance: require('./controllers/bonus/instance'),
    template: require('./controllers/bonus/template'),
    allocation: require('./controllers/bonus/allocation'),
    rule: require('./controllers/bonus/rule'),
    generation: require('./controllers/bonus/generation'),
}
controllers.sanctions = require('./controllers/sanctions');
controllers.organizations = require('./controllers/organizations');
controllers.tasks = require('./controllers/tasks');
controllers.taskCategories = require('./controllers/taskCategories');
controllers.import_export = require('./controllers/import_export');
controllers.ui = require('./controllers/ui');
controllers.charts = require('./controllers/charts');
controllers.documents = require('./controllers/documents');
controllers.notifications = require('./controllers/notifications');
controllers.configuration = require('./controllers/configuration');
controllers.installation = require('./controllers/installation');
controllers.dictionary = require('./utils/dictionary');
controllers.pdfs = require('./controllers/pdfs');
controllers.monitor = require('./controllers/monitor');
controllers.export = require('./controllers/export');
controllers.thresholds = require('./controllers/thresholds');
controllers.angular = function (req, res) {
    res.sendFile(path.join(__dirname, '../public', 'index.html'));
};

const { validate } = require('./middlewares/validate');


const {
    createPersonnelSnapshot,
    getPersonnelSnapshots,
    getSnapshotAtDate,
    compareSnapshots,
    getSnapshotById
} = require('./validations/personnel/snapshot');

const bonusInstanceValidations = require('./validations/bonus/instance');
const bonusAllocationValidations = require('./validations/bonus/allocation');
const bonusRuleValidations = require('./validations/bonus/rule');
const bonusGenerationValidation = require('./validations/bonus/generation');

//Routes
let routes = [
    // API ROUTES ===============================================================
    // === AUDIT ROUTES ========================================================
    // Retrieve audit logs by date
    {
        path: _.findWhere(aclRoutes, {id: 1}).uri,
        httpMethod: _.findWhere(aclRoutes, {id: 1}).method,
        middleware: [jwt({secret: secret}), tokenManager.verifyToken, controllers.audit.api.listByDate],
        access: _.findWhere(aclRoutes, {id: 1}).roles
    },

    // === INSTALLATION ROUTES ==========================================================
    // Read configuration without token
    {
        path: _.findWhere(aclRoutes, {id: 23}).uri,
        httpMethod: _.findWhere(aclRoutes, {id: 23}).method,
        middleware: [controllers.installation.api.read]
    },
    {
        path: _.findWhere(aclRoutes, {id: 27}).uri,
        httpMethod: _.findWhere(aclRoutes, {id: 27}).method,
        middleware: [controllers.installation.api.update]
    },

    // URL: /api/installation/admin
    {
        path: _.findWhere(aclRoutes, {id: 19}).uri,
        httpMethod: _.findWhere(aclRoutes, {id: 19}).method,
        middleware: [controllers.installation.api.admin]
    },

    // URL: /api/installation/status
    {
        path: _.findWhere(aclRoutes, {id: 18}).uri,
        httpMethod: _.findWhere(aclRoutes, {id: 18}).method,
        middleware: [controllers.installation.api.status]
    },

    // === ACCOUNT ROUTES ========================================================
    // Sign in
    {
        path: _.findWhere(aclRoutes, {id: 2}).uri,
        httpMethod: _.findWhere(aclRoutes, {id: 2}).method,
        middleware: [controllers.account.api.signin]
    },

    // Sign out
    {
        path: _.findWhere(aclRoutes, {id: 3}).uri,
        httpMethod: _.findWhere(aclRoutes, {id: 3}).method,
        middleware: [jwt({secret: secret}), tokenManager.verifyToken, controllers.account.api.signout]
    },

    // Update user infos
    {
        path: _.findWhere(aclRoutes, {id: 4}).uri,
        httpMethod: _.findWhere(aclRoutes, {id: 4}).method,
        middleware: [jwt({secret: secret}), tokenManager.verifyToken, controllers.account.api.update]
    },

    // Change user's password
    {
        path: _.findWhere(aclRoutes, {id: 5}).uri,
        httpMethod: _.findWhere(aclRoutes, {id: 5}).method,
        middleware: [jwt({secret: secret}), tokenManager.verifyToken, controllers.account.api.changePassword]
    },

    // Send a link to reset user's passowrd
    {
        path: _.findWhere(aclRoutes, {id: 6}).uri,
        httpMethod: _.findWhere(aclRoutes, {id: 6}).method,
        middleware: [controllers.account.api.lostPassword]
    },

    // Reset a password
    {
        path: _.findWhere(aclRoutes, {id: 7}).uri,
        httpMethod: _.findWhere(aclRoutes, {id: 7}).method,
        middleware: [controllers.account.api.resetPassword]
    },

    // Get user's self-profile
    {
        path: _.findWhere(aclRoutes, {id: 9}).uri,
        httpMethod: _.findWhere(aclRoutes, {id: 9}).method,
        middleware: [jwt({secret: secret}), tokenManager.verifyToken, controllers.account.api.profile],
        access: _.findWhere(aclRoutes, {id: 9}).roles
    },

    // === USERS ROUTES ==========================================================
    // Users list
    {
        path: _.findWhere(aclRoutes, {id: 10}).uri,
        httpMethod: _.findWhere(aclRoutes, {id: 10}).method,
        middleware: [jwt({secret: secret}), tokenManager.verifyToken, controllers.users.api.list],
        access: _.findWhere(aclRoutes, {id: 10}).roles
    },

    // Create a user
    {
        path: _.findWhere(aclRoutes, {id: 11}).uri,
        httpMethod: _.findWhere(aclRoutes, {id: 11}).method,
        middleware: [jwt({secret: secret}), tokenManager.verifyToken, controllers.users.api.create],
        access: _.findWhere(aclRoutes, {id: 11}).roles
    },

    // Send password email to the user
    {
        path: _.findWhere(aclRoutes, {id: 12}).uri,
        httpMethod: _.findWhere(aclRoutes, {id: 12}).method,
        middleware: [jwt({secret: secret}), tokenManager.verifyToken, controllers.users.api.sendPassword],
        access: _.findWhere(aclRoutes, {id: 12}).roles
    },

    // Update a user
    {
        path: _.findWhere(aclRoutes, {id: 13}).uri,
        httpMethod: _.findWhere(aclRoutes, {id: 13}).method,
        middleware: [jwt({secret: secret}), tokenManager.verifyToken, controllers.users.api.update],
        access: _.findWhere(aclRoutes, {id: 13}).roles
    },

    // Delete a user
    {
        path: _.findWhere(aclRoutes, {id: 14}).uri,
        httpMethod: _.findWhere(aclRoutes, {id: 14}).method,
        middleware: [jwt({secret: secret}), tokenManager.verifyToken, controllers.users.api.delete],
        access: _.findWhere(aclRoutes, {id: 14}).roles
    },

    // Read a user
    {
        path: _.findWhere(aclRoutes, {id: 15}).uri,
        httpMethod: _.findWhere(aclRoutes, {id: 15}).method,
        middleware: [jwt({secret: secret}), tokenManager.verifyToken, controllers.users.api.read],
        access: _.findWhere(aclRoutes, {id: 15}).roles
    },

    // === UI ROUTES ==========================================================
    // Build user's nav
    {
        path: _.findWhere(aclRoutes, {id: 16}).uri,
        httpMethod: _.findWhere(aclRoutes, {id: 16}).method,
        middleware: [jwt({secret: secret}), tokenManager.verifyToken, controllers.ui.api.nav],
        access: _.findWhere(aclRoutes, {id: 16}).roles
    },

    // Build user's home
    {
        path: _.findWhere(aclRoutes, {id: 17}).uri,
        httpMethod: _.findWhere(aclRoutes, {id: 17}).method,
        middleware: [jwt({secret: secret}), tokenManager.verifyToken, controllers.ui.api.charts],
        access: _.findWhere(aclRoutes, {id: 17}).roles
    },

    // === CHARTS ROUTES ==========================================================
    // Build chart
    {
        path: _.findWhere(aclRoutes, {id: 29}).uri,
        httpMethod: _.findWhere(aclRoutes, {id: 29}).method,
        middleware: [jwt({secret: secret}), tokenManager.verifyToken, controllers.charts.api.build],
        access: _.findWhere(aclRoutes, {id: 29}).roles
    },

    // === NOTIFICATION ROUTES ==========================================================
    // Retrieve notifications
    {
        path: _.findWhere(aclRoutes, {id: 31}).uri,
        httpMethod: _.findWhere(aclRoutes, {id: 31}).method,
        middleware: [jwt({secret: secret}), tokenManager.verifyToken, controllers.notifications.api.list],
        access: _.findWhere(aclRoutes, {id: 31}).roles
    },

    // Update a notification
    {
        path: _.findWhere(aclRoutes, {id: 32}).uri,
        httpMethod: _.findWhere(aclRoutes, {id: 32}).method,
        middleware: [jwt({secret: secret}), tokenManager.verifyToken, controllers.notifications.api.update],
        access: _.findWhere(aclRoutes, {id: 32}).roles
    },

    // === CONFIGURATION ROUTES ==========================================================
    // Read config
    {
        path: _.findWhere(aclRoutes, {id: 26}).uri,
        httpMethod: _.findWhere(aclRoutes, {id: 26}).method,
        middleware: [jwt({secret: secret}), tokenManager.verifyToken, controllers.configuration.api.read],
        access: _.findWhere(aclRoutes, {id: 26}).roles
    },

    // Update config
    {
        path: _.findWhere(aclRoutes, {id: 25}).uri,
        httpMethod: _.findWhere(aclRoutes, {id: 25}).method,
        middleware: [jwt({secret: secret}), tokenManager.verifyToken, controllers.configuration.api.update],
        access: _.findWhere(aclRoutes, {id: 25}).roles
    },

    // === PROJECT ROUTES ==========================================================
    // Create a project
    {
        path: _.findWhere(aclRoutes, {id: 20}).uri,
        httpMethod: _.findWhere(aclRoutes, {id: 20}).method,
        middleware: [jwt({secret: secret}), tokenManager.verifyToken, controllers.projects.api.upsert],
        access: _.findWhere(aclRoutes, {id: 20}).roles
    },
    // Get projects
    {
        path: _.findWhere(aclRoutes, {id: 21}).uri,
        httpMethod: _.findWhere(aclRoutes, {id: 21}).method,
        middleware: [jwt({secret: secret}), tokenManager.verifyToken, controllers.projects.api.list],
        access: _.findWhere(aclRoutes, {id: 21}).roles
    },
    // Read a project
    {
        path: _.findWhere(aclRoutes, {id: 22}).uri,
        httpMethod: _.findWhere(aclRoutes, {id: 22}).method,
        middleware: [jwt({secret: secret}), tokenManager.verifyToken, controllers.projects.api.read],
        access: _.findWhere(aclRoutes, {id: 22}).roles
    },
    // Delete a project 
    {
        path: _.findWhere(aclRoutes, {id: 24}).uri,
        httpMethod: _.findWhere(aclRoutes, {id: 24}).method,
        middleware: [jwt({secret: secret}), tokenManager.verifyToken, controllers.projects.api.delete],
        access: _.findWhere(aclRoutes, {id: 24}).roles
    },

    // === THRESHOLDS ROUTES ==========================================================
    // Retrieve thresholds
    {
        path: _.findWhere(aclRoutes, { id: 76 }).uri,
        httpMethod: _.findWhere(aclRoutes, { id: 76 }).method,
        middleware: [jwt({ secret: secret }), tokenManager.verifyToken, controllers.thresholds.api.list],
        access: _.findWhere(aclRoutes, { id: 76 }).roles
    },

    // Save thresholds
    {
        path: _.findWhere(aclRoutes, { id: 77 }).uri,
        httpMethod: _.findWhere(aclRoutes, { id: 77 }).method,
        middleware: [jwt({ secret: secret }), tokenManager.verifyToken, controllers.thresholds.api.save],
        access: _.findWhere(aclRoutes, { id: 77 }).roles
    },

    // === STRUCTURES ROUTES ==========================================================
    // Get structures
    {
        path: _.findWhere(aclRoutes, {id: 39}).uri,
        httpMethod: _.findWhere(aclRoutes, {id: 39}).method,
        middleware: [jwt({secret: secret}), tokenManager.verifyToken, controllers.structures.api.list],
        access: _.findWhere(aclRoutes, {id: 39}).roles
    },
    // Get structures minimal
    {
        path: _.findWhere(aclRoutes, {id: 58}).uri,
        httpMethod: _.findWhere(aclRoutes, {id: 58}).method,
        middleware: [jwt({secret: secret}), tokenManager.verifyToken, controllers.structures.api.minimalList],
        access: _.findWhere(aclRoutes, {id: 58}).roles
    },
    // Read struture
    {
        path: _.findWhere(aclRoutes, {id: 46}).uri,
        httpMethod: _.findWhere(aclRoutes, {id: 46}).method,
        middleware: [jwt({secret: secret}), tokenManager.verifyToken, controllers.structures.api.read],
        access: _.findWhere(aclRoutes, {id: 46}).roles
    },
    // Upsert a structure
    {
        path: _.findWhere(aclRoutes, {id: 47}).uri,
        httpMethod: _.findWhere(aclRoutes, {id: 47}).method,
        middleware: [jwt({secret: secret}), tokenManager.verifyToken, controllers.structures.api.upsert],
        access: _.findWhere(aclRoutes, {id: 4}).roles
    },

    // === POSITIONS ROUTES ==========================================================
    // Get positions
    {
        path: _.findWhere(aclRoutes, {id: 40}).uri,
        httpMethod: _.findWhere(aclRoutes, {id: 40}).method,
        middleware: [jwt({secret: secret}), tokenManager.verifyToken, controllers.positions.api.list],
        access: _.findWhere(aclRoutes, {id: 40}).roles
    },
    // Read position
    {
        path: _.findWhere(aclRoutes, {id: 41}).uri,
        httpMethod: _.findWhere(aclRoutes, {id: 41}).method,
        middleware: [jwt({secret: secret}), tokenManager.verifyToken, controllers.positions.api.read],
        access: _.findWhere(aclRoutes, {id: 41}).roles
    },
    // Upsert position
    {
        path: _.findWhere(aclRoutes, {id: 42}).uri,
        httpMethod: _.findWhere(aclRoutes, {id: 42}).method,
        middleware: [jwt({secret: secret}), tokenManager.verifyToken, controllers.positions.api.upsert],
        access: _.findWhere(aclRoutes, {id: 42}).roles
    },
    // find position
    {
        path: _.findWhere(aclRoutes, {id: 48}).uri,
        httpMethod: _.findWhere(aclRoutes, {id: 48}).method,
        middleware: [jwt({secret: secret}), tokenManager.verifyToken, controllers.positions.api.findPositionByCode],
        access: _.findWhere(aclRoutes, {id: 48}).roles
    },
    // affect position
    {
        path: _.findWhere(aclRoutes, {id: 49}).uri,
        httpMethod: _.findWhere(aclRoutes, {id: 49}).method,
        middleware: [jwt({secret: secret}), tokenManager.verifyToken, controllers.positions.api.affectToPosition],
        access: _.findWhere(aclRoutes, {id: 49}).roles
    },
    // list affectation
    {
        path: _.findWhere(aclRoutes, {id: 78}).uri,
        httpMethod: _.findWhere(aclRoutes, {id: 78}).method,
        middleware: [jwt({secret: secret}), tokenManager.verifyToken, controllers.affectations.api.list],
        access: _.findWhere(aclRoutes, {id: 78}).roles
    },
    // Caancel affectation
    {
        path: _.findWhere(aclRoutes, {id: 79}).uri,
        httpMethod: _.findWhere(aclRoutes, {id: 79}).method,
        middleware: [jwt({secret: secret}), tokenManager.verifyToken, controllers.affectations.api.remove],
        access: _.findWhere(aclRoutes, {id: 79}).roles
    },
    // Download
    {
        path: _.findWhere(aclRoutes, {id: 60}).uri,
        httpMethod: _.findWhere(aclRoutes, {id: 60}).method,
        middleware: [jwt({secret: secret}), tokenManager.verifyToken, controllers.positions.api.download],
        access: _.findWhere(aclRoutes, {id: 60}).roles
    },

    // === STAFF MANAGEMENT ROUTES ==========================================================
    // Get staff
    {
        path: _.findWhere(aclRoutes, {id: 45}).uri,
        httpMethod: _.findWhere(aclRoutes, {id: 45}).method,
        middleware: [jwt({secret: secret}), tokenManager.verifyToken, controllers.personnel.api.list],
        access: _.findWhere(aclRoutes, {id: 45}).roles
    },
    // Read staff
    {
        path: _.findWhere(aclRoutes, {id: 44}).uri,
        httpMethod: _.findWhere(aclRoutes, {id: 44}).method,
        middleware: [jwt({secret: secret}), tokenManager.verifyToken, controllers.personnel.api.read],
        access: _.findWhere(aclRoutes, {id: 44}).roles
    },
    // Upsert staff
    {
        path: _.findWhere(aclRoutes, {id: 43}).uri,
        httpMethod: _.findWhere(aclRoutes, {id: 43}).method,
        middleware: [jwt({secret: secret}), tokenManager.verifyToken, controllers.personnel.api.upsert],
        access: _.findWhere(aclRoutes, {id: 43}).roles
    },
    // Search staff
    {
        path: _.findWhere(aclRoutes, {id: 50}).uri,
        httpMethod: _.findWhere(aclRoutes, {id: 50}).method,
        middleware: [jwt({secret: secret}), tokenManager.verifyToken, controllers.personnel.api.search],
        access: _.findWhere(aclRoutes, {id: 50}).roles
    },
    // Eligible staff
    {
        path: _.findWhere(aclRoutes, {id: 51}).uri,
        httpMethod: _.findWhere(aclRoutes, {id: 51}).method,
        middleware: [jwt({secret: secret}), tokenManager.verifyToken, controllers.personnel.api.eligibleTo],
        access: _.findWhere(aclRoutes, {id: 51}).roles
    },
    // Eligible staff download
    {
        path: _.findWhere(aclRoutes, {id: 61}).uri,
        httpMethod: _.findWhere(aclRoutes, {id: 61}).method,
        middleware: [jwt({secret: secret}), tokenManager.verifyToken, controllers.personnel.api.downloadEligibleTo],
        access: _.findWhere(aclRoutes, {id: 61}).roles
    },
    // pdf1
    {
        path: _.findWhere(aclRoutes, {id: 52}).uri,
        httpMethod: _.findWhere(aclRoutes, {id: 52}).method,
        middleware: [jwt({secret: secret}), tokenManager.verifyToken, controllers.pdfs.api.pdf1],
        access: _.findWhere(aclRoutes, {id: 52}).roles
    },
    // checkExistance
    {
        path: _.findWhere(aclRoutes, {id: 53}).uri,
        httpMethod: _.findWhere(aclRoutes, {id: 53}).method,
        middleware: [jwt({secret: secret}), tokenManager.verifyToken, controllers.personnel.api.checkExistance],
        access: _.findWhere(aclRoutes, {id: 53}).roles
    },
    // Get retired staff
    {
        path: _.findWhere(aclRoutes, {id: 54}).uri,
        httpMethod: _.findWhere(aclRoutes, {id: 54}).method,
        middleware: [jwt({secret: secret}), tokenManager.verifyToken, controllers.personnel.api.retired],
        access: _.findWhere(aclRoutes, {id: 54}).roles
    },
    
    // Download .xls file of a card
    {
        path: _.findWhere(aclRoutes, { id: 73 }).uri,
        httpMethod: _.findWhere(aclRoutes, { id: 73 }).method,
        middleware: [jwt({ secret: secret }), tokenManager.verifyToken, controllers.export.api.table],
        access: _.findWhere(aclRoutes, { id: 73 }).roles
    },
    
    {
        path: _.findWhere(aclRoutes, { id: 80 }).uri,
        httpMethod: _.findWhere(aclRoutes, { id: 80 }).method,
        middleware: [jwt({ secret: secret }), tokenManager.verifyToken, controllers.personnel.api.delete],
        access: _.findWhere(aclRoutes, { id: 80 }).roles
    },
    
    {
        path: _.findWhere(aclRoutes, { id: 81 }).uri,
        httpMethod: _.findWhere(aclRoutes, { id: 81 }).method,
        middleware: [jwt({ secret: secret }), tokenManager.verifyToken, controllers.sanctions.api.upsert],
        access: _.findWhere(aclRoutes, { id: 81 }).roles
    },
    
    {
        path: _.findWhere(aclRoutes, { id: 82 }).uri,
        httpMethod: _.findWhere(aclRoutes, { id: 82 }).method,
        middleware: [jwt({ secret: secret }), tokenManager.verifyToken, controllers.sanctions.api.list],
        access: _.findWhere(aclRoutes, { id: 82 }).roles
    },
    // remove sanction
    {
        path: _.findWhere(aclRoutes, {id: 83}).uri,
        httpMethod: _.findWhere(aclRoutes, {id: 83}).method,
        middleware: [jwt({secret: secret}), tokenManager.verifyToken, controllers.sanctions.api.remove],
        access: _.findWhere(aclRoutes, {id: 83}).roles
    },
    // export sanctions
    {
        path: _.findWhere(aclRoutes, {id: 84}).uri,
        httpMethod: _.findWhere(aclRoutes, {id: 84}).method,
        middleware: [jwt({secret: secret}), tokenManager.verifyToken, controllers.sanctions.api.export],
        access: _.findWhere(aclRoutes, {id: 84}).roles
    },
    // Statistics sanctions
    {
        path: _.findWhere(aclRoutes, {id: 85}).uri,
        httpMethod: _.findWhere(aclRoutes, {id: 85}).method,
        middleware: [jwt({secret: secret}), tokenManager.verifyToken, controllers.sanctions.api.statistics],
        access: _.findWhere(aclRoutes, {id: 85}).roles
    },

    // === EXPORT PDF ROUTES ==========================================================

    {
        path: _.findWhere(aclRoutes, {id: 56}).uri,
        httpMethod: _.findWhere(aclRoutes, {id: 56}).method,
        middleware: [jwt({secret: secret}), tokenManager.verifyToken, controllers.export.api.positions],
        access: _.findWhere(aclRoutes, {id: 56}).roles
    },

    {
        path: _.findWhere(aclRoutes, {id: 57}).uri,
        httpMethod: _.findWhere(aclRoutes, {id: 57}).method,
        middleware: [jwt({secret: secret}), tokenManager.verifyToken, controllers.export.api.structures],
        access: _.findWhere(aclRoutes, {id: 57}).roles
    },

    {
        path: _.findWhere(aclRoutes, {id: 86}).uri,
        httpMethod: _.findWhere(aclRoutes, {id: 86}).method,
        middleware: [jwt({secret: secret}), tokenManager.verifyToken, controllers.personnel.api.followUpSheet],
        access: _.findWhere(aclRoutes, {id: 86}).roles
    },

    // === MONITOR ROUTES ==========================================================

    {
        path: _.findWhere(aclRoutes, {id: 55}).uri,
        httpMethod: _.findWhere(aclRoutes, {id: 55}).method,
        middleware: [jwt({secret: secret}), tokenManager.verifyToken, controllers.monitor.api.list],
        access: _.findWhere(aclRoutes, {id: 55}).roles
    },

    // === ORGANIZATION ROUTES ==========================================================
    // Create an org
    {
        path: _.findWhere(aclRoutes, {id: 33}).uri,
        httpMethod: _.findWhere(aclRoutes, {id: 33}).method,
        middleware: [jwt({secret: secret}), tokenManager.verifyToken, controllers.organizations.api.upsert],
        access: _.findWhere(aclRoutes, {id: 33}).roles
    },
    // Get orgs
    {
        path: _.findWhere(aclRoutes, {id: 34}).uri,
        httpMethod: _.findWhere(aclRoutes, {id: 34}).method,
        middleware: [jwt({secret: secret}), tokenManager.verifyToken, controllers.organizations.api.list],
        access: _.findWhere(aclRoutes, {id: 34}).roles
    },
    // Read an org
    {
        path: _.findWhere(aclRoutes, {id: 35}).uri,
        httpMethod: _.findWhere(aclRoutes, {id: 35}).method,
        middleware: [jwt({secret: secret}), tokenManager.verifyToken, controllers.organizations.api.read],
        access: _.findWhere(aclRoutes, {id: 35}).roles
    },
    // Delete an org 
    {
        path: _.findWhere(aclRoutes, {id: 36}).uri,
        httpMethod: _.findWhere(aclRoutes, {id: 36}).method,
        middleware: [jwt({secret: secret}), tokenManager.verifyToken, controllers.organizations.api.delete],
        access: _.findWhere(aclRoutes, {id: 36}).roles
    },
    // list affectation
    {
        path: _.findWhere(aclRoutes, {id: 88}).uri,
        httpMethod: _.findWhere(aclRoutes, {id: 88}).method,
        middleware: [jwt({secret: secret}), tokenManager.verifyToken, controllers.documents.api.list],
        access: _.findWhere(aclRoutes, {id: 88}).roles
    },
    
    // Delete an org 
    {
        path: _.findWhere(aclRoutes, {id: 89}).uri,
        httpMethod: _.findWhere(aclRoutes, {id: 89}).method,
        middleware: [jwt({secret: secret}), tokenManager.verifyToken, controllers.documents.api.delete],
        access: _.findWhere(aclRoutes, {id: 89}).roles
    },
    
    // Download
    {
        path: _.findWhere(aclRoutes, {id: 90}).uri,
        httpMethod: _.findWhere(aclRoutes, {id: 90}).method,
        middleware: [jwt({secret: secret}), tokenManager.verifyToken, controllers.documents.api.download],
        access: _.findWhere(aclRoutes, {id: 90}).roles
    },
    
    // zip files
    {
        path: _.findWhere(aclRoutes, {id: 91}).uri,
        httpMethod: _.findWhere(aclRoutes, {id: 91}).method,
        middleware: [jwt({secret: secret}), tokenManager.verifyToken, controllers.documents.api.zip],
        access: _.findWhere(aclRoutes, {id: 91}).roles
    },
    
    // Read document
    {
        path: _.findWhere(aclRoutes, {id: 92}).uri,
        httpMethod: _.findWhere(aclRoutes, {id: 92}).method,
        middleware: [jwt({secret: secret}), tokenManager.verifyToken, controllers.documents.api.read],
        access: _.findWhere(aclRoutes, {id: 92}).roles
    },

    // === TASKS ROUTES ==========================================================
    // Create a task
    {
        path: _.findWhere(aclRoutes, {id: 62}).uri,
        httpMethod: _.findWhere(aclRoutes, {id: 62}).method,
        middleware: [jwt({secret: secret}), tokenManager.verifyToken, controllers.tasks.api.upsert],
        access: _.findWhere(aclRoutes, {id: 62}).roles
    },
    // Update an org
    {
        path: _.findWhere(aclRoutes, {id: 71}).uri,
        httpMethod: _.findWhere(aclRoutes, {id: 71}).method,
        middleware: [jwt({secret: secret}), tokenManager.verifyToken, controllers.tasks.api.update],
        access: _.findWhere(aclRoutes, {id: 71}).roles
    },
    // History of task
    {
        path: _.findWhere(aclRoutes, {id: 72}).uri,
        httpMethod: _.findWhere(aclRoutes, {id: 72}).method,
        middleware: [jwt({secret: secret}), tokenManager.verifyToken, controllers.tasks.api.getHistory],
        access: _.findWhere(aclRoutes, {id: 72}).roles
    },
    // Tasks comments
    {
        path: _.findWhere(aclRoutes, {id: 74}).uri,
        httpMethod: _.findWhere(aclRoutes, {id: 74}).method,
        middleware: [jwt({secret: secret}), tokenManager.verifyToken, controllers.tasks.api.getComments],
        access: _.findWhere(aclRoutes, {id: 74}).roles
    },
    // Tasks comments
    {
        path: _.findWhere(aclRoutes, {id: 75}).uri,
        httpMethod: _.findWhere(aclRoutes, {id: 75}).method,
        middleware: [jwt({secret: secret}), tokenManager.verifyToken, controllers.tasks.api.deleteComment],
        access: _.findWhere(aclRoutes, {id: 75}).roles
    },
    // Get orgs
    {
        path: _.findWhere(aclRoutes, {id: 63}).uri,
        httpMethod: _.findWhere(aclRoutes, {id: 63}).method,
        middleware: [jwt({secret: secret}), tokenManager.verifyToken, controllers.tasks.api.list],
        access: _.findWhere(aclRoutes, {id: 63}).roles
    },
    // Read task
    {
        path: _.findWhere(aclRoutes, {id: 64}).uri,
        httpMethod: _.findWhere(aclRoutes, {id: 64}).method,
        middleware: [jwt({secret: secret}), tokenManager.verifyToken, controllers.tasks.api.read],
        access: _.findWhere(aclRoutes, {id: 64}).roles
    },
    // Read for edit task
    {
        path: _.findWhere(aclRoutes, {id: 70}).uri,
        httpMethod: _.findWhere(aclRoutes, {id: 70}).method,
        middleware: [jwt({secret: secret}), tokenManager.verifyToken, controllers.tasks.api.readForEdit],
        access: _.findWhere(aclRoutes, {id: 70}).roles
    },
    // Delete task 
    {
        path: _.findWhere(aclRoutes, {id: 65}).uri,
        httpMethod: _.findWhere(aclRoutes, {id: 65}).method,
        middleware: [jwt({secret: secret}), tokenManager.verifyToken, controllers.tasks.api.delete],
        access: _.findWhere(aclRoutes, {id: 65}).roles
    },

    // === Categries ROUTES ==========================================================
    // Create a cat
    {
        path: _.findWhere(aclRoutes, {id: 66}).uri,
        httpMethod: _.findWhere(aclRoutes, {id: 66}).method,
        middleware: [jwt({secret: secret}), tokenManager.verifyToken, controllers.taskCategories.api.upsert],
        access: _.findWhere(aclRoutes, {id: 66}).roles
    },
    // Get cats
    {
        path: _.findWhere(aclRoutes, {id: 67}).uri,
        httpMethod: _.findWhere(aclRoutes, {id: 67}).method,
        middleware: [jwt({secret: secret}), tokenManager.verifyToken, controllers.taskCategories.api.list],
        access: _.findWhere(aclRoutes, {id: 67}).roles
    },
    // Read an cat
    {
        path: _.findWhere(aclRoutes, {id: 68}).uri,
        httpMethod: _.findWhere(aclRoutes, {id: 68}).method,
        middleware: [jwt({secret: secret}), tokenManager.verifyToken, controllers.taskCategories.api.read],
        access: _.findWhere(aclRoutes, {id: 68}).roles
    },
    // Delete an cat 
    {
        path: _.findWhere(aclRoutes, {id: 69}).uri,
        httpMethod: _.findWhere(aclRoutes, {id: 69}).method,
        middleware: [jwt({secret: secret}), tokenManager.verifyToken, controllers.taskCategories.api.delete],
        access: _.findWhere(aclRoutes, {id: 69}).roles
    },

    // === IMPORT_EXPORT ROUTES ==========================================================
    // Import
    {
        path: _.findWhere(aclRoutes, {id: 37}).uri,
        httpMethod: _.findWhere(aclRoutes, {id: 37}).method,
        middleware: [jwt({secret: secret}), tokenManager.verifyToken, controllers.import_export.api.import],
        access: _.findWhere(aclRoutes, {id: 37}).roles
    },

    {
        path: _.findWhere(aclRoutes, {id: 38}).uri,
        httpMethod: _.findWhere(aclRoutes, {id: 38}).method,
        middleware: [jwt({secret: secret}), tokenManager.verifyToken, controllers.import_export.api.export],
        access: _.findWhere(aclRoutes, {id: 38}).roles
    },

    // ==================================EXPORT STAFF API ROUTES========================================

    // post an export job
    {
        path: _.findWhere(aclRoutes, { id: 93 }).uri,
        httpMethod: _.findWhere(aclRoutes, { id: 93 }).method,
        middleware: [jwt({ secret: secret }), tokenManager.verifyToken, controllers.personnel.api.export.create],
        access: _.findWhere(aclRoutes, { id: 93 }).roles
    },
    //get list of export jobs
    {
        path: _.findWhere(aclRoutes, { id: 94 }).uri,
        httpMethod: _.findWhere(aclRoutes, { id: 94 }).method,
        middleware: [jwt({ secret: secret }), tokenManager.verifyToken, controllers.personnel.api.export.list],
        access: _.findWhere(aclRoutes, { id: 94 }).roles
    },
    //download export file by id
    {
        path: _.findWhere(aclRoutes, { id: 95 }).uri,
        httpMethod: _.findWhere(aclRoutes, { id: 95 }).method,
        middleware: [jwt({ secret: secret }), tokenManager.verifyToken, controllers.personnel.api.export.download],
        access: _.findWhere(aclRoutes, { id: 95 }).roles
    },
    //delete export by array of ids
    {
        path: _.findWhere(aclRoutes, { id: 96 }).uri,
        httpMethod: _.findWhere(aclRoutes, { id: 96 }).method,
        middleware: [jwt({ secret: secret }), tokenManager.verifyToken, controllers.personnel.api.export.delete],
        access: _.findWhere(aclRoutes, { id: 96 }).roles
    },
    //read export by ids
    {
        path: _.findWhere(aclRoutes, { id: 97 }).uri,
        httpMethod: _.findWhere(aclRoutes, { id: 97 }).method,
        middleware: [jwt({ secret: secret }), tokenManager.verifyToken, controllers.personnel.api.export.getAJob],
        access: _.findWhere(aclRoutes, { id: 97 }).roles
    },

    // ================================== BONUS TEMPLATES API ROUTES =================================
    {
        path: _.findWhere(aclRoutes, { id: 200 }).uri,
        httpMethod: _.findWhere(aclRoutes, { id: 200 }).method,
        middleware: [jwt({ secret: secret }), tokenManager.verifyToken, controllers.bonus.template.api.create],
        access: _.findWhere(aclRoutes, { id: 200 }).roles
    },
    {
        path: _.findWhere(aclRoutes, { id: 201 }).uri,
        httpMethod: _.findWhere(aclRoutes, { id: 201 }).method,
        middleware: [jwt({ secret: secret }), tokenManager.verifyToken, controllers.bonus.template.api.getAll],
        access: _.findWhere(aclRoutes, { id: 201 }).roles
    },
    {
        path: _.findWhere(aclRoutes, { id: 202 }).uri,
        httpMethod: _.findWhere(aclRoutes, { id: 202 }).method,
        middleware: [jwt({ secret: secret }), tokenManager.verifyToken, controllers.bonus.template.api.getById],
        access: _.findWhere(aclRoutes, { id: 202 }).roles
    },
    {
        path: _.findWhere(aclRoutes, { id: 203 }).uri,
        httpMethod: _.findWhere(aclRoutes, { id: 203 }).method,
        middleware: [jwt({ secret: secret }), tokenManager.verifyToken, controllers.bonus.template.api.update],
        access: _.findWhere(aclRoutes, { id: 203 }).roles
    },
    {
        path: _.findWhere(aclRoutes, { id: 204 }).uri,
        httpMethod: _.findWhere(aclRoutes, { id: 204 }).method,
        middleware: [jwt({ secret: secret }), tokenManager.verifyToken, controllers.bonus.template.api.delete],
        access: _.findWhere(aclRoutes, { id: 204 }).roles
    },
    {
        path: _.findWhere(aclRoutes, { id: 205 }).uri,
        httpMethod: _.findWhere(aclRoutes, { id: 205 }).method,
        middleware: [jwt({ secret: secret }), tokenManager.verifyToken, controllers.bonus.template.api.activate],
        access: _.findWhere(aclRoutes, { id: 205 }).roles
    },
    {
        path: _.findWhere(aclRoutes, { id: 206 }).uri,
        httpMethod: _.findWhere(aclRoutes, { id: 206 }).method,
        middleware: [jwt({ secret: secret }), tokenManager.verifyToken, controllers.bonus.template.api.clone],
        access: _.findWhere(aclRoutes, { id: 206 }).roles
    },
    {
        path: _.findWhere(aclRoutes, { id: 207 }).uri,
        httpMethod: _.findWhere(aclRoutes, { id: 207 }).method,
        middleware: [jwt({ secret: secret }), tokenManager.verifyToken, controllers.bonus.template.api.validate],
        access: _.findWhere(aclRoutes, { id: 207 }).roles
    },
    {
        path: _.findWhere(aclRoutes, { id: 208 }).uri,
        httpMethod: _.findWhere(aclRoutes, { id: 208 }).method,
        middleware: [jwt({ secret: secret }), tokenManager.verifyToken, controllers.bonus.template.api.testCalculation],
        access: _.findWhere(aclRoutes, { id: 208 }).roles
    },
    {
        path: _.findWhere(aclRoutes, { id: 209 }).uri,
        httpMethod: _.findWhere(aclRoutes, { id: 209 }).method,
        middleware: [jwt({ secret: secret }), tokenManager.verifyToken, controllers.bonus.template.api.getUsageStats],
        access: _.findWhere(aclRoutes, { id: 209 }).roles
    },

// ================================== BONUS RULES API ROUTES =================================
    {
        path: _.findWhere(aclRoutes, { id: 210 }).uri,
        httpMethod: _.findWhere(aclRoutes, { id: 210 }).method,
        middleware: [jwt({ secret: secret }), tokenManager.verifyToken, validate(bonusRuleValidations.createBonusRule), controllers.bonus.rule.api.create],
        access: _.findWhere(aclRoutes, { id: 210 }).roles
    },
    {
        path: _.findWhere(aclRoutes, { id: 211 }).uri,
        httpMethod: _.findWhere(aclRoutes, { id: 211 }).method,
        middleware: [jwt({ secret: secret }), tokenManager.verifyToken, validate(bonusRuleValidations.getBonusRules), controllers.bonus.rule.api.getAll],
        access: _.findWhere(aclRoutes, { id: 211 }).roles
    },
    {
        path: _.findWhere(aclRoutes, { id: 212 }).uri,
        httpMethod: _.findWhere(aclRoutes, { id: 212 }).method,
        middleware: [jwt({ secret: secret }), tokenManager.verifyToken, controllers.bonus.rule.api.getById],
        access: _.findWhere(aclRoutes, { id: 212 }).roles
    },
    {
        path: _.findWhere(aclRoutes, { id: 213 }).uri,
        httpMethod: _.findWhere(aclRoutes, { id: 213 }).method,
        middleware: [jwt({ secret: secret }), tokenManager.verifyToken, validate(bonusRuleValidations.updateBonusRule), controllers.bonus.rule.api.update],
        access: _.findWhere(aclRoutes, { id: 213 }).roles
    },
    {
        path: _.findWhere(aclRoutes, { id: 214 }).uri,
        httpMethod: _.findWhere(aclRoutes, { id: 214 }).method,
        middleware: [jwt({ secret: secret }), tokenManager.verifyToken, controllers.bonus.rule.api.delete],
        access: _.findWhere(aclRoutes, { id: 214 }).roles
    },
    {
        path: _.findWhere(aclRoutes, { id: 215 }).uri,
        httpMethod: _.findWhere(aclRoutes, { id: 215 }).method,
        middleware: [jwt({ secret: secret }), tokenManager.verifyToken, controllers.bonus.rule.api.activate],
        access: _.findWhere(aclRoutes, { id: 215 }).roles
    },
    {
        path: _.findWhere(aclRoutes, { id: 216 }).uri,
        httpMethod: _.findWhere(aclRoutes, { id: 216 }).method,
        middleware: [jwt({ secret: secret }), tokenManager.verifyToken, validate(bonusRuleValidations.validateBonusRule), controllers.bonus.rule.api.validate],
        access: _.findWhere(aclRoutes, { id: 216 }).roles
    },
    {
        path: _.findWhere(aclRoutes, { id: 217 }).uri,
        httpMethod: _.findWhere(aclRoutes, { id: 217 }).method,
        middleware: [jwt({ secret: secret }), tokenManager.verifyToken, validate(bonusRuleValidations.testBonusRule), controllers.bonus.rule.api.test],
        access: _.findWhere(aclRoutes, { id: 217 }).roles
    },

// ================================== BONUS INSTANCES API ROUTES =================================
    {
        path: _.findWhere(aclRoutes, { id: 220 }).uri,
        httpMethod: _.findWhere(aclRoutes, { id: 220 }).method,
        middleware: [jwt({ secret: secret }), tokenManager.verifyToken, validate(bonusInstanceValidations.createBonusInstance), controllers.bonus.instance.api.create],
        access: _.findWhere(aclRoutes, { id: 220 }).roles
    },
    {
        path: _.findWhere(aclRoutes, { id: 221 }).uri,
        httpMethod: _.findWhere(aclRoutes, { id: 221 }).method,
        middleware: [jwt({ secret: secret }), tokenManager.verifyToken, validate(bonusInstanceValidations.getBonusInstances), controllers.bonus.instance.api.getAll],
        access: _.findWhere(aclRoutes, { id: 221 }).roles
    },
    {
        path: _.findWhere(aclRoutes, { id: 222 }).uri,
        httpMethod: _.findWhere(aclRoutes, { id: 222 }).method,
        middleware: [jwt({ secret: secret }), tokenManager.verifyToken, controllers.bonus.instance.api.getById],
        access: _.findWhere(aclRoutes, { id: 222 }).roles
    },
    {
        path: _.findWhere(aclRoutes, { id: 223 }).uri,
        httpMethod: _.findWhere(aclRoutes, { id: 223 }).method,
        middleware: [jwt({ secret: secret }), tokenManager.verifyToken, validate(bonusInstanceValidations.updateBonusInstance), controllers.bonus.instance.api.update],
        access: _.findWhere(aclRoutes, { id: 223 }).roles
    },
    {
        path: _.findWhere(aclRoutes, { id: 224 }).uri,
        httpMethod: _.findWhere(aclRoutes, { id: 224 }).method,
        middleware: [jwt({ secret: secret }), tokenManager.verifyToken, validate(bonusInstanceValidations.approveBonusInstance), controllers.bonus.instance.api.approve],
        access: _.findWhere(aclRoutes, { id: 224 }).roles
    },
    {
        path: _.findWhere(aclRoutes, { id: 225 }).uri,
        httpMethod: _.findWhere(aclRoutes, { id: 225 }).method,
        middleware: [jwt({ secret: secret }), tokenManager.verifyToken, validate(bonusInstanceValidations.rejectBonusInstance), controllers.bonus.instance.api.reject],
        access: _.findWhere(aclRoutes, { id: 225 }).roles
    },
    {
        path: _.findWhere(aclRoutes, { id: 226 }).uri,
        httpMethod: _.findWhere(aclRoutes, { id: 226 }).method,
        middleware: [jwt({ secret: secret }), tokenManager.verifyToken, validate(bonusInstanceValidations.cancelBonusInstance), controllers.bonus.instance.api.cancel],
        access: _.findWhere(aclRoutes, { id: 226 }).roles
    },
    {
        path: _.findWhere(aclRoutes, { id: 227 }).uri,
        httpMethod: _.findWhere(aclRoutes, { id: 227 }).method,
        middleware: [jwt({ secret: secret }), tokenManager.verifyToken, controllers.bonus.instance.api.generatePayments],
        access: _.findWhere(aclRoutes, { id: 227 }).roles
    },
    {
        path: _.findWhere(aclRoutes, { id: 228 }).uri,
        httpMethod: _.findWhere(aclRoutes, { id: 228 }).method,
        middleware: [jwt({ secret: secret }), tokenManager.verifyToken, controllers.bonus.instance.api.export],
        access: _.findWhere(aclRoutes, { id: 228 }).roles
    },
    {
        path: _.findWhere(aclRoutes, { id: 229 }).uri,
        httpMethod: _.findWhere(aclRoutes, { id: 229 }).method,
        middleware: [jwt({ secret: secret }), tokenManager.verifyToken, controllers.bonus.instance.api.notify],
        access: _.findWhere(aclRoutes, { id: 229 }).roles
    },

// ================================== BONUS ALLOCATIONS API ROUTES =================================
    {
        path: _.findWhere(aclRoutes, { id: 230 }).uri,
        httpMethod: _.findWhere(aclRoutes, { id: 230 }).method,
        middleware: [jwt({ secret: secret }), tokenManager.verifyToken, validate(bonusAllocationValidations.getAllBonusAllocations), controllers.bonus.allocation.api.getAll],
        access: _.findWhere(aclRoutes, { id: 230 }).roles
    },
    {
        path: _.findWhere(aclRoutes, { id: 231 }).uri,
        httpMethod: _.findWhere(aclRoutes, { id: 231 }).method,
        middleware: [jwt({ secret: secret }), tokenManager.verifyToken, controllers.bonus.allocation.api.getById],
        access: _.findWhere(aclRoutes, { id: 231 }).roles
    },
    {
        path: _.findWhere(aclRoutes, { id: 232 }).uri,
        httpMethod: _.findWhere(aclRoutes, { id: 232 }).method,
        middleware: [jwt({ secret: secret }), tokenManager.verifyToken, validate(bonusAllocationValidations.getAllBonusAllocations), controllers.bonus.allocation.api.adjust],
        access: _.findWhere(aclRoutes, { id: 232 }).roles
    },
    {
        path: _.findWhere(aclRoutes, { id: 233 }).uri,
        httpMethod: _.findWhere(aclRoutes, { id: 233 }).method,
        middleware: [jwt({ secret: secret }), tokenManager.verifyToken, validate(bonusAllocationValidations.excludeBonusAllocation), controllers.bonus.allocation.api.exclude],
        access: _.findWhere(aclRoutes, { id: 233 }).roles
    },
    {
        path: _.findWhere(aclRoutes, { id: 234 }).uri,
        httpMethod: _.findWhere(aclRoutes, { id: 234 }).method,
        middleware: [jwt({ secret: secret }), tokenManager.verifyToken, validate(bonusAllocationValidations.includeBonusAllocation), controllers.bonus.allocation.api.include],
        access: _.findWhere(aclRoutes, { id: 234 }).roles
    },
    {
        path: _.findWhere(aclRoutes, { id: 235 }).uri,
        httpMethod: _.findWhere(aclRoutes, { id: 235 }).method,
        middleware: [jwt({ secret: secret }), tokenManager.verifyToken, controllers.bonus.allocation.api.getHistory],
        access: _.findWhere(aclRoutes, { id: 235 }).roles
    },




// ================================== PERSONNEL SNAPSHOTS API ROUTES =================================
    {
        path: _.findWhere(aclRoutes, { id: 236 }).uri,
        httpMethod: _.findWhere(aclRoutes, { id: 236 }).method,
        middleware: [ jwt({ secret: secret }), tokenManager.verifyToken, validate(createPersonnelSnapshot), controllers.personnelSnapshot.api.create],
        access: _.findWhere(aclRoutes, { id: 236 }).roles
    },
    {
        path: _.findWhere(aclRoutes, { id: 237 }).uri,
        httpMethod: _.findWhere(aclRoutes, { id: 237 }).method,
        middleware: [ jwt({ secret: secret }), tokenManager.verifyToken, validate(getPersonnelSnapshots), controllers.personnelSnapshot.api.getAll ],
        access: _.findWhere(aclRoutes, { id: 237 }).roles
    },
    {
        path: _.findWhere(aclRoutes, { id: 238 }).uri,
        httpMethod: _.findWhere(aclRoutes, { id: 238 }).method,
        middleware: [ jwt({ secret: secret }), tokenManager.verifyToken, validate(getSnapshotAtDate), controllers.personnelSnapshot.api.getAtDate ],
        access: _.findWhere(aclRoutes, { id: 238 }).roles
    },
    {
        path: _.findWhere(aclRoutes, { id: 239 }).uri,
        httpMethod: _.findWhere(aclRoutes, { id: 239 }).method,
        middleware: [ jwt({ secret: secret }), tokenManager.verifyToken, validate(compareSnapshots), controllers.personnelSnapshot.api.compare ],
        access: _.findWhere(aclRoutes, { id: 239 }).roles
    },
    {
        path: _.findWhere(aclRoutes, { id: 240 }).uri,
        httpMethod: _.findWhere(aclRoutes, { id: 240 }).method,
        middleware: [ jwt({ secret: secret }), tokenManager.verifyToken, validate(getSnapshotById), controllers.personnelSnapshot.api.getById ],
        access: _.findWhere(aclRoutes, { id: 240 }).roles
    },

    // ================================== BONUS GENERATION API ROUTES =================================
    {
        path: _.findWhere(aclRoutes, { id: 241 }).uri,
        httpMethod: _.findWhere(aclRoutes, { id: 241 }).method,
        middleware: [ jwt({ secret: secret }), tokenManager.verifyToken, validate(bonusGenerationValidation.generatePeriodic), controllers.bonus.generation.api.generatePeriodicBonuses ],
        access: _.findWhere(aclRoutes, { id: 241 }).roles
    },
    {
        path: _.findWhere(aclRoutes, { id: 242 }).uri,
        httpMethod: _.findWhere(aclRoutes, { id: 242 }).method,
        middleware: [ jwt({ secret: secret }), tokenManager.verifyToken, validate(bonusGenerationValidation.generateTemplate), controllers.bonus.generation.api.generateTemplateBonuses ],
        access: _.findWhere(aclRoutes, { id: 242 }).roles
    },

    // === OTHER ROUTES ==========================================================
    // Search In Dictionary
    {
        path: _.findWhere(aclRoutes, {id: 30}).uri,
        httpMethod: _.findWhere(aclRoutes, {id: 30}).method,
        middleware: [dictionary.api.searchInDictionary]
    },

    //Search List from json
    {
        path: _.findWhere(aclRoutes, {id: 28}).uri,
        httpMethod: _.findWhere(aclRoutes, {id: 28}).method,
        middleware: [controllers.dictionary.api.jsonList],
    },

    // FRONTEND ROUTES ========================================================
    // Route to handle all angular requests
    {
        path: _.findWhere(aclRoutes, {id: 0}).uri,
        httpMethod: _.findWhere(aclRoutes, {id: 0}).method,
        middleware: [controllers.angular]
    },

    // DOCUMENTS ROUTES ========================================================
    
    // Create a document
    {
        path: _.findWhere(aclRoutes, {id: 87}).uri,
        httpMethod: _.findWhere(aclRoutes, {id: 87}).method,
        middleware: [jwt({secret: secret}), tokenManager.verifyToken, controllers.documents.api.upsert],
        access: _.findWhere(aclRoutes, {id: 87}).roles
    }
   
];


module.exports = function (app) {
    _.each(routes, function (route) {
        route.middleware.unshift(ensureAuthorized);
        var args = _.flatten([route.path, route.middleware]);
        switch (route.httpMethod.toUpperCase()) {
            case 'GET':
                app.get.apply(app, args);
                break;
            case 'POST':
                app.post.apply(app, args);
                break;
            case 'PUT':
                app.put.apply(app, args);
                break;
            case 'DELETE':
                app.delete.apply(app, args);
                break;
            default:
                throw new Error('Invalid HTTP method specified for route ' + route.path);
                break;
        }
    });
};

function ensureAuthorized(req, res, next) {
    var token, completeDecodedToken;
    token = tokenManager.getToken(req.headers);
    if (token == null && _.contains([
        "*",
        "/api/account/signin",
        "/api/account/password/reset",
        "/api/account/password/lost",
        "/api/account/activation",
        "/api/tunnel",
        "/api/dictionary/:dictionary/list",
        "/api/dictionary/search/:dictionary/:query",
        "/api/installation",
        "/api/installation/status",
        "/api/installation/admin",
        "public/templates/staffs/img/"
    ], req.route.path)) {
        return next();
    } else {
        if (token)
            completeDecodedToken = jsonwebtoken.decode(token, {complete: true});
        if (completeDecodedToken && typeof completeDecodedToken.payload.id !== 'undefined') {
            if (completeDecodedToken.header.alg === 'HS256') {
                var decodedToken = completeDecodedToken.payload;
                var userID = decodedToken.id;
                User.findOne({_id: userID}, function (err, user) {
                    if (err) {
                        audit.logEvent('[mongodb]', 'Routes', 'Ensure authorized', 'userID', userID, 'failed', 'Mongodb attempted to retrieve a user');
                        log.error(err);
                        return res.sendStatus(500);
                    } else {
                        if (user !== null) {
                            req.actor = {
                                id: user._id,
                                role: user.role,
                                language: user.language
                            };
                            if (user.role == "3") {
                                req.actor.regions = user.regions;
                            }
                            if (user.role == "4") {
                                req.actor.laboratories = user.laboratories;
                            }

                            var userRole = parseInt(user.role);
                            var route = _.findWhere(routes, {
                                path: req.route.path,
                                httpMethod: req.method
                            });
                            var allowedRoles = route.access;
                            if (typeof (allowedRoles) !== "undefined") {
                                var accessGranted = false;
                                for (i = 0; i < allowedRoles.length; i++) {
                                    if (userRole === allowedRoles[i])
                                        accessGranted = true;
                                }

                                if (accessGranted) {
                                    return next();
                                } else {
                                    console.log('Forbidden for his role');
                                    audit.logEvent(user._id, 'Routes', 'Ensure authorized', 'route', req.route.path, 'failed',
                                            'The user tried to access a route which is forbidden for his role');
                                    return res.sendStatus(403);
                                }
                            } else {// typeof allowedRoles is undefined
                                return next();
                            }
                        } else {
                            console.log('User not found (' + userID + ')');
                            audit.logEvent('[anonymous]', 'Routes', 'Ensure authorized', 'userID', userID, 'failed', 'User not found');
                            return res.sendStatus(401);
                        }
                    }
                });
            } else {
                console.log('ensureAuthorized received a suspicious token with customized algorithm (' + completeDecodedToken.header.alg + ')');
                audit.logEvent('[anonymous]', 'Routes', 'Ensure authorized', 'token', completeDecodedToken.header.alg, 'failed', 'Received a suspicious token with customized algorithm');
                return res.sendStatus(401);
            }
        } else {
            console.log('ensureAuthorized did not receive a valid token ("', token, '")');
            audit.logEvent('[anonymous]', 'Routes', 'Ensure authorized', 'token', token, 'failed', 'Did not receive a valid token');
            return res.sendStatus(401);
        }
    }
}

//Run the initialization manager
initializationManager.run();
