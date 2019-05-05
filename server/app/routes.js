var jwt = require('express-jwt');
var path = require('path');
var jsonwebtoken = require('jsonwebtoken');
var _ = require('underscore');
var tokenManager = require('./managers/token');
var nconf = require('nconf');
nconf.file("config/server.json");
var User = require('./models/user').User;
var aclRoutes = require('../resources/dictionary/app/routes.json');
var audit = require('./utils/audit-log');
var log = require('./utils/log');
var dictionary = require('./utils/dictionary');
var secret = nconf.get('token').secret;
var app = require('../app');
var moment = require('moment');

// Controllers
var controllers = {};
controllers.audit = require('./controllers/auditLogs');
controllers.account = require('./controllers/account');
controllers.users = require('./controllers/users');
controllers.projects = require('./controllers/projects');
controllers.structures = require('./controllers/structures');
controllers.positions = require('./controllers/positions');
controllers.personnel = require('./controllers/personnel');
controllers.organizations = require('./controllers/organizations');
controllers.import_export = require('./controllers/import_export');
controllers.ui = require('./controllers/ui');
controllers.charts = require('./controllers/charts');
controllers.notifications = require('./controllers/notifications');
controllers.configuration = require('./controllers/configuration');
controllers.installation = require('./controllers/installation');
controllers.dictionary = require('./utils/dictionary');
controllers.angular = function (req, res) {
    res.sendFile(path.join(__dirname, '../public', 'index.html'));
};

startBot();

//Routes
var routes = [
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

    // === STRUCTURES ROUTES ==========================================================
    // Get structures
    {
        path: _.findWhere(aclRoutes, {id: 39}).uri,
        httpMethod: _.findWhere(aclRoutes, {id: 39}).method,
        middleware: [jwt({secret: secret}), tokenManager.verifyToken, controllers.structures.api.list],
        access: _.findWhere(aclRoutes, {id: 39}).roles
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
        "/api/installation/admin"
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

function startBot() {
    controllers.structures.initialize(function (err, avoided) {
        if (err) {
            log.error(err);
            console.log(err);
        } else {
            var avoidedmsg = "";
            if (avoided && avoided.length>0){
                avoidedmsg = "Skipped structure: "+avoided;
                log.warn(avoidedmsg);
            }
            audit.logEvent('[anonymous]', 'Routes', 'startBot', "", "", 'Success', "Initialization of structures succesful done. "+avoidedmsg);
        }
    });
}