var jsonwebtoken    = require('jsonwebtoken');
var User            = require('../models/user').User;
var tokenManager    = require('../managers/token');
var audit           = require('../utils/audit-log');
var log             = require('../utils/log');
var dictionary      = require('../utils/dictionary');
var mail            = require('../utils/mail');
var crypto          = require('crypto');
var formidable      = require("formidable");

var controllers = {
    users: require('./users'),
    notifications: require('./notifications'),
    configuration: require('./configuration')
};

// API
exports.api = {};

exports.api.lostPassword = function(req, res) {
    var server = controllers.configuration.getConf().server;
    var form = new formidable.IncomingForm();
    form.parse(req, function(err, fields, files) {
        var email = fields.email || '';
        if (email === '') {
            audit.logEvent('[anonymous]', 'Account', 'Lost password', '', '', 'failed',
                           'The user tried to send an email to reset password but one or more params of the request was not defined');
            return res.sendStatus(400);
        } else {
            User.findOne({email: email}, function (err, user) {
                if (err) {
                    log.error(err);
                    audit.logEvent('[mongodb]', 'Account', 'Lost password', 'email', email, 'failed', 'Mongodb attempted to find the email');
                    return res.status(500).send(err);
                } else {
                    if (user === null) {
                        audit.logEvent('[anonymous]', 'Account', 'Lost password', 'email', email, 'failed',
                                       'The user tried to send an email to reset password but the email does not exist');
                        return res.json({
                            exists: false
                        });
                    } else {
                        //Create a token
                        crypto.randomBytes(20, function(err, buf) {
                            if (err) {
                                log.error(err);
                                audit.logEvent('[crypto]', 'Account', 'Lost password', 'email', email, 'failed', 'Crypto attempted to create a token');
                                return res.status(500).send(err);
                            } else {
                                var token = buf.toString('hex');
                                user.resetPasswordToken = token;
                                user.resetPasswordExpires = Date.now() + 3600000;
                                user.save(function(err) {
                                    if (err) {
                                        log.error(err);
                                        audit.logEvent('[mongodb]', 'Account', 'Lost password', "userID", user._id, 'failed', 
                                                       "Mongodb attempted to save the modified user");
                                        return res.status(500).send(err);
                                    } else {
                                        //Send an email with a token link
                                        var gt = dictionary.translator(user.language);
                                        var subject = "Core - " + gt.gettext("Password reset");
                                        var holes = [
                                            ['[link]', server.name + "/recovery/reset/" + token],
                                            ['[name]', user.firstname + " " + user.lastname]
                                        ];

                                        mail.sendMail({
                                            to: user.email,
                                            subject: subject,
                                            template: 'reset',
                                            language: user.language,
                                            holes: holes
                                        }, function(err, info){
                                            if (err) {
                                                log.error(err);
                                                audit.logEvent('[crypto]', 'Account', 'Lost password', 'email', email, 'failed', 'Crypto attempted to create a token');
                                                return res.status(500).send(err);
                                            } else {
                                                log.info("Password email sent to: " + user.email);
                                                return res.json({
                                                    exists: true
                                                });
                                            }
                                        });
                                    }
                                });
                            }
                        });
                    }
                }
            });
        }
    });
};

exports.api.resetPassword = function(req, res) {
    var form = new formidable.IncomingForm();
    form.parse(req, function(err, fields, files) {
        var token = fields.token || '';
        var password = fields.newPassword || '';
        var passwordConfirmation = fields.newPasswordConfirmation || '';

        if (password === '' || passwordConfirmation === '' || token === '') {
            audit.logEvent('[anonymous]', 'Account', 'Reset password', '', '', 'failed',
                           'The user tried to reset password but one or more params of the request was not defined');
            return res.sendStatus(400);
        } else {
            if (password !== passwordConfirmation) {
                audit.logEvent('[anonymous]', 'Account', 'Reset password', '', '', 'failed',
                               'The user tried to change his password but the password was not equal to its confirmation');
                return res.json({
                    token: false,
                    changed: false
                });
            } else {
                User.findOne({
                    $or:[{
                        resetPasswordToken: token,  activationToken: { $ne: '0' }
                    }, {
                        resetPasswordToken: token, resetPasswordExpires: {$gte: Date.now()}
                    }]}, function(err, user) {
                    if (err) {
                        log.error(err);
                        audit.logEvent('[mongodb]', 'Account', 'Reset password', '', '', 'failed', 'Mongodb attempted to find a user by token');
                        return res.status(500).send(err);
                    } else {
                        if (user === null) {
                            return res.json({
                                token: false
                            });
                        } else {
                            user.password = password;
                            user.resetPasswordToken = undefined;
                            user.activationToken = "0";
                            user.resetPasswordExpires = undefined;
                            user.save(function(err) {
                                if (err) {
                                    log.error(err);
                                    audit.logEvent('[mongodb]', 'Account', 'Reset password', "userID", user._id, 'failed',
                                                   "Mongodb attempted to save the modified user");
                                    return res.status(500).send(err);
                                } else {
                                    audit.logEvent(user._id, 'Account', 'Reset password', "userID", user._id, 'succeed',
                                                   'The user has successfully changed the password of his account');

                                    return res.json({
                                        email : user.email,
                                        token: true,
                                        changed: true
                                    });
                                }
                            });
                        }
                    }
                });
            }
        }
    });
};

exports.api.signin = function(req, res) {
    var tokenSecret = controllers.configuration.getConf().token.secret;
    var form = new formidable.IncomingForm();
    form.parse(req, function(err, fields, files) {
        var email = fields.email || '';
        var password = fields.password || '';
        var expiration = tokenManager.TOKEN_EXPIRATION;
        if(expiration < 60){
            expiration = 900;
        }

        if (email === '' || password === '') {
            audit.logEvent('[anonymous]', 'Account', 'Sign in', '', '', 'failed',
                           'The user tried to sign in but one or more params of the request was not defined');
            return res.sendStatus(400);
        } else {
            if(fields.rememberme){
                expiration = 1000 * 60 * 24 * 7;
            }

            User.findOne({email: email}, function (err, user) {
                if (err) {
                    log.error(err);
                    audit.logEvent('[mongodb]', 'Account', 'Sign in', 'used email', email, 'failed', 'Mongodb attempted to find the email');
                    return res.status(500).send(err);
                } else {
                    if (user) {
                        if(user.activationToken !== '0'){
                            audit.logEvent('[anonymous]', 'Account', 'Sign in', 'used email', email, 'failed',
                                           'The user tried to sign in but the account is not activated');
                            return res.send({
                                activated:false
                            });
                        } else {
                            user.comparePassword(password, function(isMatch) {
                                if (!isMatch) {
                                    audit.logEvent(user._id, 'Account', 'Sign in', 'used email', email, 'failed',
                                                   'The user tried to sign in but the password was incorrect');
                                    return res.sendStatus(401);
                                } else {
                                    var token = jsonwebtoken.sign({id: user._id}, tokenSecret, { expiresIn: expiration });
                                    audit.logEvent(user._id, 'Account', 'Sign in', 'used email', email, 'succeed',
                                                   'The user has successfully signed in to his account');
                                    user.save(function(err) {
                                        if (err) {
                                            log.error(err);
                                            return res.status(500).send(err);
                                        } else {
                                            return res.status(200).json({
                                                activated:true,
                                                token:token,
                                                language: user.language
                                            });
                                        }
                                    });
                                }
                            });
                        }
                    } else {
                        audit.logEvent('[anonymous]', 'Account', 'Sign in', 'used email', email, 'failed',
                                       'The user tried to sign in but the used email does not exist');
                        return res.sendStatus(401);
                    }
                }
            });
        }
    });
};

exports.api.signup = function(req, res) {
    var server = controllers.configuration.getConf().server;
    var form = new formidable.IncomingForm();
    form.parse(req, function(err, fields, files) {
        if(err){
            log.error(err);
            audit.logEvent('[formidable]', 'Account', 'Sign up', "", "", 'failed', "Formidable attempted to parse report fields");
            return res.status(500).send(err);
        } else {
            var firstname = fields.firstname || '';
            var lastname = fields.lastname || '';
            var email = fields.email || '';
            var role = fields.role || '';
            var regions = fields.regions || '';
            var laboratories = fields.laboratories || '';
            var language = fields.language || '';
            var password = fields.password || '';
            var passwordConfirmation = fields.passwordConfirmation || '';

            if (firstname === '' || lastname === '' || email === '' || role === '' || language === '' 
                || password === '' || passwordConfirmation !== password) {
                audit.logEvent('[anonymous]', 'Account', 'Sign up', '', '', 'failed',
                               'The user could not register because one or more params of the request was not defined');
                return res.sendStatus(400);
            } else {
                if (password !== passwordConfirmation) {
                    audit.logEvent(userID, 'Account', 'Sign up', '', '', 'failed',
                                   'The user could not register cause the password was not equal to its confirmation');
                    return res.sendStatus(401); 
                } else {
                    var user = new User;
                    user.firstname = firstname;
                    user.lastname = lastname;
                    user.email = email;
                    user.role = role;
                    user.laboratories = laboratories;
                    user.regions = regions;
                    user.password = password;
                    user.language = language;
                    user.activationToken = server.autoValidate ?"0": "1";
                    user.save(function(err) {
                        if (err) {
                            log.error(err);
                            audit.logEvent('[mongodb]', 'Users', 'Sign up', "email", user.email, 'failed', 
                                           "Mongodb attempted to save the new user");
                            return res.status(500).send(err);
                        } else {
                            audit.logEvent(user.email, 'Users', 'Sign up', 'email', user.email, 'succeed', 
                                           'The user has successfully created an account');

                            var notification = {
                                type: 'admin',
                                author: 'Alics'
                            };

                            // Send emails
                            controllers.users.getUsersByRole('1', function(err, users){
                                if (err) {
                                    log.error(err);
                                } else {
                                    function myLoopA(m) {
                                        if(m < users.length){
                                            var usrLang = users[m].language;
                                            var gt = dictionary.translator(usrLang);
                                            notification.userID = users[m]._id;
                                            notification.abstract = gt.gettext("A new account has been created.");
                                            notification.content = firstname + " " + lastname + " " + gt.gettext("created an account with the email") 
                                                + gt.gettext(":")+ " " + email + ".<br>" 
                                                + gt.gettext("Please go to « <i>Users</i> » page to review his/her request.");

                                            // Send in-app notification
                                            controllers.notifications.create(notification);

                                            if(users[m].preferences.notification && users[m].preferences.notification.email){
                                                var subject = "Core - " + gt.gettext("Alics notification");
                                                var holes = [
                                                    ['[link]', server.name],
                                                    ['[abstract]', notification.abstract],
                                                    ['[content]', notification.content],
                                                    ['[name]', users[m].firstname + " " + users[m].lastname]
                                                ];

                                                mail.sendMail({
                                                    to: users[m].email,
                                                    subject: subject,
                                                    template: 'notification',
                                                    language: usrLang,
                                                    holes: holes
                                                }, function(err, info){
                                                    if (err) {
                                                        log.error(err);
                                                        return res.status(500).send(err);
                                                    } else {
                                                        log.info("Notification sent to: " + users[m].email);
                                                        myLoopA(m+1);
                                                    }
                                                });
                                            } else {
                                                myLoopA(m+1);
                                            }
                                        } else {
                                            if(server.autoValidate){
                                                var subject = "Core - Activation";
                                                var holes = [
                                                    ['[link]', server.name],
                                                    ['[name]', user.firstname + " " + user.lastname]
                                                ];

                                                mail.sendMail({
                                                    to: user.email,
                                                    subject: subject,
                                                    template: 'activation',
                                                    language: user.language,
                                                    holes: holes
                                                }, function(err, info){
                                                    if (err) {
                                                        log.error(err);
                                                        return res.status(500).send(err);
                                                    } else {
                                                        log.info("Email sent to: " + user.email);
                                                        return res.sendStatus(200);
                                                    }
                                                });
                                            } else {
                                                return res.sendStatus(200);
                                            }
                                        }
                                    }
                                    myLoopA(0);
                                }
                            });
                        }
                    });
                }
            }
        }
    });
};

exports.api.signout = function(req, res) {
    var token = tokenManager.getToken(req.headers);
    if(token !== null){
        tokenManager.expireToken(token, true);
        audit.logEvent(jsonwebtoken.decode(token).id, 'Account', 'Sign out', '', '', 'succeed', 'A user has successfully logged out');
        delete req.user;
        return res.sendStatus(200);
    } else {
        audit.logEvent('[anonymous]', 'Account', 'Sign out', '', '', 'failed', 'The user was not authenticated');
        return res.send(401);
    }
};

exports.api.changePassword = function(req, res) {
    if(req.actor){
        var form = new formidable.IncomingForm();
        form.parse(req, function(err, fields, files) {
            var oldPassword = fields.oldPassword || '';
            var newPassword = fields.newPassword || '';
            var newPasswordConfirmation = fields.newPasswordConfirmation || '';

            if (oldPassword === '' || newPassword === '' || newPasswordConfirmation === '') {
                audit.logEvent(req.actor.id, 'Account', 'Change password', '', '', 'failed',
                               'The user tried to change his password but one or more params of the request was not defined');
                return res.sendStatus(400);
            } else {
                if (newPassword !== newPasswordConfirmation) {
                    audit.logEvent(req.actor.id, 'Account', 'Change password', '', '', 'failed',
                                   'The user tried to change his password but the password was not equal to its confirmation');
                    return res.json({
                        new: false
                    });
                } else {
                    User.findOne({_id: req.actor.id}, function (err, user) {
                        if (err) {
                            log.error(err);
                            audit.logEvent('[mongodb]', 'Account', 'Change password', "user id", req.actor.id, 'failed', "Mongodb attempted to find the user");
                            return res.status(500).send(err);
                        } else {
                            if (user == undefined) {
                                audit.logEvent('[mongodb]', 'Account', 'Change password', '', '', 'failed',
                                               'Mongodb attempted to find the user but it revealed not defined');
                                return res.sendStatus(401);
                            } else {
                                user.comparePassword(oldPassword, function(isMatch) {
                                    if (!isMatch) {
                                        audit.logEvent(user._id, 'Account', 'Change password', '', '', 'failed',
                                                       'The user tried to change the password but the old one was incorrect');
                                        return res.json({
                                            old: false,
                                            new: true
                                        });
                                    }
                                    else{
                                        user.password = newPassword;
                                        user.save(function(err) {
                                            if (err) {
                                                log.error(err);
                                                audit.logEvent('[mongodb]', 'Account', 'Change password', "userID", user._id, 'failed',
                                                               "Mongodb attempted to save the modified user");
                                                return res.status(500).send(err);
                                            } else {
                                                audit.logEvent(user._id, 'Account', 'Change password', '', '', 'succeed',
                                                               'The user has successfully changed the password of his account');
                                                return res.json({
                                                    old: true,
                                                    new: true
                                                });
                                            }
                                        });
                                    }
                                });
                            }
                        }
                    });
                }
            }
        });
    } else {
        audit.logEvent('[anonymous]', 'Account', '', '', '', 'failed', 'The user was not authenticated');
        return res.send(401);
    }
};

exports.api.profile = function(req, res){
    if(req.actor){
        User.findOne({
            _id: req.actor.id
        }, {
            _id: 0
        }, function (err, user) {
            if (err) {
                log.error(err);
                audit.logEvent('[mongodb]', 'Account', 'Profile', "user id", req.actor.id, 'failed', "Mongodb attempted to find the user");
                return res.status(500).send(err);
            } else {
                if (user === null) {
                    audit.logEvent('[mongodb]', 'Account', 'Read profile', '', '', 'failed', 'Mongodb attempted to find the user but it revealed not defined');
                    return res.sendStatus(401);
                } else {
                                        
                    if (user.address){
                        var userToSend= JSON.parse(JSON.stringify(user));
                        userToSend = controllers.configuration.beautifyAddress({language: req.actor.language}, [userToSend])[0];
                        userToSend.addressBeautify= (userToSend.address[0]) ? userToSend.address : [userToSend.address];
                        userToSend.address=  (user.address[0]) ? user.address[0] :  user.address;
                        user=JSON.parse(JSON.stringify(userToSend));
                    }
                    return res.json(user);
                }
            }
        });
    } else {
        audit.logEvent('[anonymous]', 'Account', 'Read profile', '', '', 'failed','The user was not authenticated');
        return res.sendStatus(401);
    }
};


// TODO: simplify this function -> see user.js -> update
exports.api.update = function(req, res) {
    if(req.actor){
        var form = new formidable.IncomingForm();
        form.parse(req, function(err, fields, files) {
            var avatar = fields.avatar;
            var firstname = fields.firstname;
            var lastname = fields.lastname;
            var address = fields.address;
            var phone = fields.phone;
            var email = fields.email;
            var language = fields.language;
            var notification = fields.notification;

            var toUpdate = {};
            var toRemove = {};

            // -- Required if exist --
            //firstname
            if (firstname !== undefined && firstname != ''){
                toUpdate['firstname'] = firstname;
            }

            //lastname
            if (lastname !== undefined && lastname != ''){
                toUpdate['lastname'] = lastname;
            }

            //email
            if (email !== undefined && email != ''){
                toUpdate['email'] = email;
            }

            //language
            if (language !== undefined && language != ''){
                toUpdate['language'] = language;
            };

            //notification
            if (notification !== undefined && notification != ''){
                toUpdate['preferences.notification'] = notification;
            };

            // -- Not Required --
            //avatar
            if (avatar !== undefined && avatar != '') {
                toUpdate['preferences.avatar'] = avatar;
            } else if (avatar === '') {
                toRemove['preferences.avatar'] = 1;
            };

            //address
            if (address !== undefined && address !== ''){
                toUpdate['address'] = address;
            } else if (address === '') {
                toRemove['address'] = 1;
            };

            //phone
            if (phone !== undefined && phone !== ''){
                toUpdate['phone'] = phone;
            } else if (phone === ''){
                toRemove['phone'] = 1;
            };

            User.findOne({_id: req.actor.id}, function (err, user) {
                if (err) {
                    log.error(err);
                    return res.status(500).send(err);
                } else {
                    if (user === null) {
                        return res.sendStatus(401);
                    } else {
                        if(Object.keys(toRemove).length > 0 && Object.keys(toUpdate).length > 0){
                            //remove AND update
                            User.update({_id:req.actor.id}, { $unset: toRemove }, function(err, nbRow) {
                                if (err) {
                                    log.error(err);
                                    return res.status(500).send(err);
                                } else {
                                    user.save(function(err) {
                                        if (err) {
                                            log.error(err);
                                            audit.logEvent('[mongodb]', 'Account', 'Update', "userID", user._id, 'failed',
                                                           "Mongodb attempted to save the new user");
                                            return res.status(500).send(err);
                                        } else {
                                            User.update({_id:req.actor.id}, toUpdate, function(err, nbRow) {
                                                if (err) {
                                                    log.error(err);
                                                    return res.status(500).send(err);
                                                } else {
                                                    user.save(function(err) {
                                                        if (err) {
                                                            log.error(err);
                                                            audit.logEvent('[mongodb]', 'Account', 'Update', "userID", user._id, 'failed',
                                                                           "Mongodb attempted to save the new user");
                                                            return res.status(500).send(err);
                                                        } else {
                                                            return res.sendStatus(200);
                                                        }
                                                    });
                                                }
                                            });
                                        }
                                    });
                                }
                            });
                        } else if(Object.keys(toRemove).length == 0 && Object.keys(toUpdate).length > 0){
                            //just update
                            User.update({_id:req.actor.id}, toUpdate, function(err, nbRow) {
                                if (err) {
                                    log.error(err);
                                    return res.status(500).send(err);
                                } else {
                                    user.save(function(err) {
                                        if (err) {
                                            log.error(err);
                                            audit.logEvent('[mongodb]', 'Account', 'Update', "userID", user._id, 'failed',
                                                           "Mongodb attempted to save the new user");
                                            return res.status(500).send(err);
                                        } else {
                                            return res.sendStatus(200);
                                        }
                                    });
                                }
                            });
                        } else if(Object.keys(toRemove).length > 0 && Object.keys(toUpdate).length == 0){
                            //just remove
                            User.update({_id:req.actor.id}, { $unset: toRemove }, function(err, nbRow) {
                                if (err) {
                                    log.error(err);
                                    return res.status(500).send(err);
                                } else {
                                    user.save(function(err) {
                                        if (err) {
                                            log.error(err);
                                            audit.logEvent('[mongodb]', 'Account', 'Update', "userID", user._id, 'failed',
                                                           "Mongodb attempted to save the new user");
                                            return res.status(500).send(err);
                                        } else {
                                            return res.sendStatus(200);
                                        }
                                    });
                                }
                            })
                        }
                    }
                }
            });
        });
    } else {
        return res.send(401);
    }
};