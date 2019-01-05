var Notification = require('../models/notification').Notification;
var audit = require('../utils/audit-log');
var log = require('../utils/log');
var _ = require('underscore');
var mail = require('../utils/mail');
var dictionary = require('../utils/dictionary');

var controllers = {
    configuration: require('./configuration'),
    users: require('./users')
};

// API
exports.api = {};

// Retrieve notifications
exports.api.list = function (req, res) {
    if (req.actor) {
        Notification.find({
            $and: [{
                created: {
                    $gte: new Date(new Date().setDate(new Date().getDate() - 30))
                }
            }, {
                $or: [{
                    userID: {$exists: false}
                }, {
                    userID: req.actor.id
                }]
            }]
        }).sort({"created": -1}).exec(function (err, notifications) {
            if (err) {
                log.error(err);
                audit.logEvent('[mongodb]', 'Notifications', 'List', '', '', 'failed', 'Mongodb attempted to retrieve notifications');
                return res.status(500).send(err);
            } else {
                return res.json(notifications);
            }
        });
    } else {
        audit.logEvent('[anonymous]', 'Notifications', 'List', '', '', 'failed', 'The user was not authenticated');
        return res.sendStatus(401);
    }
}

// Create a notification
exports.create = function (options) {
    var n = {
        type: options.type,
        author: options.author,
        abstract: options.abstract,
        content: options.content
    };
    if (options.userID) {
        n.userID = options.userID;
    }
    Notification.create(n, function (err, notification) {
        if (err) {
            log.error(err);
            audit.logEvent('[mongodb]', 'Notifications', 'Create', '', '', 'failed', 'Mongodb attempted to create a notification');
        }
    });
}

// Mark a notification as read
exports.api.update = function (req, res) {
    if (req.actor) {
        if (!req.params.id) {
            audit.logEvent("[API]", 'Notifications', 'Update', '', '', 'failed',
                           'The API could not update a notification because one or more fields was empty');
            return callback(null, 400);
        } else {
            Notification.update({_id: req.params.id}, {
                read: new Date()
            }, function (err, nbRow) {
                if (err) {
                    log.error(err);
                    audit.logEvent('[mongodb]', 'Notifications', 'Update', '', '', 'failed', 'Mongodb attempted to update a notification');
                    return res.status(500).send(err);
                } else {
                    return res.sendStatus(200);
                }
            });
        }
    } else {
        audit.logEvent('[anonymous]', 'Notifications', 'List', '', '', 'failed', 'The user was not authenticated');
        return res.sendStatus(401);
    }
};

/**
 * Mark notification as sent by email
 * @param {String} id
 * @param {function} callback
 */
exports.markAsMailed = function (id, callback) {
    var _id = id || '';
    if (_id === '') {
        audit.logEvent("[API]", 'Notifications', 'markAsMailled', '', '', 'failed',
                       'The API could not update a notification because one or more fields was empty');
        return callback(null, 400);
    } else {
        Notification.update({_id: _id}, {
            mailed: new Date()
        }, function (err, nbRow) {
            if (err) {
                log.error(err);
                audit.logEvent('[mongodb]', 'Notifications', 'markAsMailled', '', '', 'failed', 'Mongodb attempted to update a notification');
                callback(err);
            } else {
                callback(null);
            }
        });
    }
};


// Declare the function which will notify the user
exports.notifyUser = function (params, callback) {
    var server = controllers.configuration.getConf().server;
    var user = params.user;
    var language = params.language;
    var notification = params.notification;
    var gt = dictionary.translator(language);
    var loop = true;


    //3. in-app and mail notifications saved in database
    if (params.inAppDirectNotification === true || user.role !== "0") {
        // Send in-app notifications
        exports.create(notification);
        callback(null, loop);
    }

    //exit and stop no loop if exist
    callback(null, !loop);
};

/**
 * send by email, all available notifications to the corresponding user after grouping them 
 * @param {type} callback
 */
exports.mailAvailableNotifications = function (callback) {
    Notification.find({
        $and: [{
            mailed: {$exists: false}
        }]
    }).sort({"created": -1}).exec(function (err, notifications) {
        if (err) {
            log.error(err);
            audit.logEvent('[mongodb]', 'Notifications', 'List', '', '', 'failed', 'Mongodb attempted to retrieve notifications');
            callback(null);
        } else {
            // Group notifications by userID
            var notificationsGroupedByUser = _.groupBy(notifications, function (item) {
                return (item.userID);
            });
            //transforme it in array
            notificationsGroupedByUser = _.toArray(notificationsGroupedByUser);

            //Loop in grouped notifications
            function loopUserNotifications(n) {
                if (n < notificationsGroupedByUser.length) {
                    var userNotifications = notificationsGroupedByUser[n];
                    //Find the concerned user
                    controllers.users.findUser(userNotifications[0].userID, function (err, user) {
                        if (err) {
                            callback(err);
                            log.error(err);
                        } else {
                            //if user can receiveing mail
                            if (user && user.preferences.notification && user.preferences.notification.email === true) {
                                //Here we have the concerned user
                                var server = controllers.configuration.getConf().server;
                                var language = user.language.toLowerCase();
                                var gt = dictionary.translator(language);
                                var subject = "Core - " + gt.gettext("Notification");

                                // For Cepheid
                                if (user.role === "0") {
                                    subject = "Core - Alert";
                                }

                                var holes = [
                                    ['[link]', server.name],
                                    ['[name]', user.firstname + " " + user.lastname]
                                ];


                                var middleHoles = [];
                                for (u = 0; u < userNotifications.length; u++) {
                                    middleHoles[u] = [];
                                    middleHoles[u].push(['[abstract]', userNotifications[u].abstract]);
                                    middleHoles[u].push(['[content]', userNotifications[u].content]);
                                }

                                var template = 'notification';
                                var middleTemplate = 'notification_middle_content';
                                //Send Notifications in one mail
                                mail.sendAllInOneMail({
                                    to: user.email,
                                    subject: subject,
                                    template: template,
                                    language: language,
                                    middleTemplate: middleTemplate,
                                    holes: holes,
                                    middleHoles: middleHoles
                                }, function (err, info) {
                                    if (err) {
                                        callback(err);
                                        log.error(err);
                                    } else {
                                        log.info("Notification sent to: " + user.email);
                                        loopUserNotifications(n+1);
                                        //mark this notifications
                                        for (u = 0; u < userNotifications.length; u++) {
                                            exports.markAsMailed(userNotifications[u]._id, function (err) {
                                                if (err) {
                                                    log.error(err);
                                                }
                                            });
                                        }
                                    }
                                });
                            } else {
                                loopUserNotifications(n+1);
                                //mark this notifications
                                for (u = 0; u < userNotifications.length; u++) {
                                    exports.markAsMailed(userNotifications[u]._id, function (err) {
                                        if (err) {
                                            log.error(err);
                                        }
                                    });
                                }
                            }
                        }
                    });
                }
            }
            loopUserNotifications(0);
        }
    });
};

