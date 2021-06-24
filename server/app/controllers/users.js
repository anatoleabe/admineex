var User = require('../models/user').User;
var audit = require('../utils/audit-log');
var log             = require('../utils/log');
var mail            = require('../utils/mail');
var crypto          = require('crypto');
var formidable      = require("formidable");

// API
exports.api = {};

var controllers     = {
    configuration: require('./configuration')
};

exports.api.create = function(req, res) {
    var server = controllers.configuration.getConf().server;
    if(req.actor){
        var form = new formidable.IncomingForm();
        form.parse(req, function(err, fields, files) {
            if(err){
                log.error(err);
                audit.logEvent('[formidable]', 'Users', 'Create', "", "", 'failed', "Formidable attempted to parse user fields");
                return res.status(500).send(err);
            } else {
                var address = fields.address;
                var email = fields.email || '';
                var firstname = fields.firstname || '';
                var lastname = fields.lastname || '';
                var password = fields.password || '';
                var passwordConfirmation = fields.passwordConfirmation || '';
                var language = fields.language || '';
                var role = fields.role || '';
                var regions = fields.regions || '';
                var structures = fields.structures || '';
                

                if (email === '' || firstname === '' || lastname === '' || role === '' || password !== passwordConfirmation) {
                    audit.logEvent(req.actor.id, 'Users', 'Create', '', '', 'failed',
                                   'The actor could not create a user account because one or more params of the request was not correct');
                    return res.sendStatus(400);
                } else {
                    var user = new User();
                    user.email = email;
                    user.firstname = firstname;
                    user.lastname = lastname;
                    user.password = password;
                    user.role = role;

                    if(regions !== ''){
                        user.regions = regions;
                    }

                    if(structures !== ''){
                        user.structures = structures;
                    }

                    if(language !== ''){
                        user.language = language;
                    }

                    if (address !== undefined && address !== ''){
                        user.address=address;
                    };

                    // TODO: If the actor wants to send a password link to the new user
                    if(user.sendPassword){
                        crypto.randomBytes(20, function(err, bufPassword) {
                            if (err) {
                                log.error(err);
                                return res.status(500).send(err);
                            } else {
                                var tmpPassword = bufPassword.toString('hex');
                                user.password = tmpPassword;

                                //Create a token
                                crypto.randomBytes(20, function(err, buf) {
                                    if (err) {
                                        log.error(err);
                                        return res.status(500).send(err);
                                    } else {
                                        var myToken = buf.toString('hex');
                                        user.resetPasswordToken = myToken;
                                        user.activationToken = "1";
                                        user.save(function(err) {
                                            if (err) {
                                                log.error(err);
                                                audit.logEvent('[mongodb]', 'Users', 'Create', "email", email, 'failed',
                                                               "Mongodb attempted to save the new user");
                                                return res.status(500).send(err);
                                            } else {
                                                var rep = [
                                                    ['[name]', user.firstname + " " + user.lastname],
                                                    ['[link]', server.name + "/signup/" + myToken]
                                                ];

                                                mail.sendMail({
                                                    to: user.email,
                                                    subject: 'Activation',
                                                    template: 'activation',
                                                    language: user.language,
                                                    holes: rep
                                                }, function(err){
                                                    if (err) {
                                                        log.error(err);
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
                    } else {
                        user.activationToken = "0";
                        user.save(function(err) {
                            if (err) {
                                log.error(err);
                                audit.logEvent('[mongodb]', 'Users', 'Create', "email", email, 'failed', "Mongodb attempted to save the new user");
                                return res.status(500).send(err);
                            } else {
                                return res.sendStatus(200);
                            }
                        });
                    }
                }
            }
        });
    } else {
        audit.logEvent('[anonymous]', 'Users', 'search', '', '', 'failed', 'The actor was not authenticated');
        return res.sendStatus(401);
    }
};


exports.api.list = function(req, res) {
    if(req.actor){
        User.find({
            role: {$ne:0}
        }, {password: 0}, function (err, users) {
            if (err) {
                log.error(err);
                audit.logEvent('[mongodb]', 'Users', 'List', '', '', 'failed', 'Mongodb attempted to retrieve users list');
                return res.status(500).send(err);
            } else {
                return res.json(users);
            }
        });
    } else {
        audit.logEvent('[anonymous]', 'Users', 'List', '', '', 'failed','The actor was not authenticated');
        return res.send(401);
    }
}

exports.api.contacts = function(req, res) {
    if(req.actor){
        exports.contacts(function (err, users) {
            if (err) {
                audit.logEvent('[mongodb]', 'Users', 'Contacts', '', '', 'failed', 'Mongodb attempted to retrieve users list');
                return res.status(500).send(err);
            } else {
                return res.json(users);
            }
        });
    } else {
        audit.logEvent('[anonymous]', 'Users', 'List', '', '', 'failed','The actor was not authenticated');
        return res.send(401);
    }
}

exports.contacts = function(callback) {
    User.find({}, {firstname:1, lastname:1, avatar:1, email:1}).lean().exec(function (err, users) {
        if (err) {
            log.error(err);
            callback(err);
        } else {
            function myLoopA(i) {
                if (i < users.length) {
                    users[i].name = users[i].firstname + " " + users[i].lastname;
                    users[i]._lowername = users[i].name.toLowerCase();
                    myLoopA(i+1);
                } else {
                    callback(null, users);
                }
            }
            myLoopA(0);
        }
    });
}

exports.list = function(query, pipe,callback) {
    User.find(query, pipe).lean().exec(function (err, users) {
        if (err) {
            log.error(err);
            callback(err);
        } else {
            function myLoopA(i) {
                if (i < users.length) {
                    users[i].name = users[i].firstname + " " + users[i].lastname;
                    users[i]._lowername = users[i].name.toLowerCase();
                    myLoopA(i+1);
                } else {
                    callback(null, users);
                }
            }
            myLoopA(0);
        }
    });
}

exports.all = function(callback) {
    User.find({}).lean().exec(function (err, users) {
        if (err) {
            log.error(err);
            callback(err);
        } else {
            callback(null, users);
        }
    });
}

exports.findUser = function(id, callback) {
    User.findOne({_id:id}).lean().exec(function (err, user) {
        if (err) {
            log.error(err);
            callback(err);
        } else {
            callback(null, user);
        }
    });
};


exports.api.update = function(req, res) {
    var server = controllers.configuration.getConf().server;
    if(req.actor){
        if(req.params.id == undefined ){
            audit.logEvent(req.actor.id, 'Users', 'Update', '', '', 'failed',
                           'The actor could not update the account of the user because one or more params of the request was not defined');
            return res.sendStatus(400);
        } else {
            User.findOne({
                _id: req.params.id
            }).exec(function (err, user) {
                if (err) {
                    log.error(err);
                    audit.logEvent('[mongodb]', 'Users', 'Update', "userID", req.params.id, 'failed', "Mongodb attempted to find a user");
                    return res.status(500).send(err);
                } else {
                    if (user === null) {
                        return res.sendStatus(401);
                    } else {
                        var form = new formidable.IncomingForm();
                        form.parse(req, function(err, fields, files) {
                            if(err){
                                log.error(err);
                                audit.logEvent('[formidable]', 'Users', 'Update', "", "", 'failed', "Formidable attempted to parse user fields");
                                return res.status(500).send(err);
                            } else {
                                var phone = fields.phone;
                                var activationToken = fields.activationToken;
                                var address = fields.address;
                                var email = fields.email;
                                var firstname = fields.firstname;
                                var lastname = fields.lastname;
                                var language = fields.language;
                                var password = fields.password;
                                var passwordConfirmation = fields.passwordConfirmation;
                                var role = fields.role;
                                var regions = fields.regions;
                                var structures = fields.structures;

                                if(password != passwordConfirmation){
                                    audit.logEvent(req.actor.id, 'Users', 'Update', '', '', 'failed',
                                                   'The actor could not update the account of the user because one or more params of the request was not correct');
                                    return res.sendStatus(400);
                                } else {
                                    var alertHim = false;
                                    var toUpdate = {};
                                    var toRemove = {};

                                    // -- Required if exist --
                                    if (firstname !== undefined && firstname != ''){
                                        toUpdate['firstname'] = firstname;
                                    }
                                    if (lastname !== undefined && lastname != ''){
                                        toUpdate['lastname'] = lastname;
                                    }
                                    if (email !== undefined && email != ''){
                                        toUpdate['email'] = email;
                                    }
                                    if (language !== undefined && language != ''){
                                        toUpdate['language'] = language;
                                    };
                                    if (role !== undefined && role != ''){
                                        toUpdate['role'] = role;
                                    };
                                    if (activationToken !== undefined && activationToken != ''){
                                        alertHim = true;
                                        toUpdate['activationToken'] = activationToken;
                                    }

                                    // -- Not Required --
                                    if (phone !== undefined && phone !== ''){
                                        toUpdate['phone'] = phone;
                                    } else if (phone === ''){
                                        toRemove['phone'] = 1;
                                    };
                                    if (address !== undefined && address !== ''){
                                        toUpdate['address'] = address;
                                    } else if (address === ''){
                                        toRemove['address'] = 1;
                                    };
                                    if (regions !== undefined && regions !== ''){
                                        toUpdate['regions'] = regions;
                                    } else if (regions === ''){
                                        toRemove['regions'] = 1;
                                    };
                                    if (structures !== undefined && structures !== ''){
                                        toUpdate['structures'] = structures;
                                    } else if (structures === ''){
                                        toRemove['structures'] = 1;
                                    };

                                    // TODO
                                    var ok = {
                                        remove: false,
                                        update: false
                                    };

                                    function notification(){
                                        if(alertHim){
                                            var subject = "Core - Activation";
                                            var holes = [
                                                ['[link]', server.name],
                                                ['[name]', firstname + " " + lastname]
                                            ];

                                            mail.sendMail({
                                                to: email,
                                                subject: subject,
                                                template: 'activation',
                                                language: language,
                                                holes: holes
                                            }, function(err, info){
                                                if (err) {
                                                    log.error(err);
                                                } else {
                                                    log.info("Email sent to: " + email);
                                                    return res.sendStatus(200);
                                                }
                                            });
                                        } else {
                                            return res.sendStatus(200);
                                        }
                                    }

                                    User.update({_id:user._id}, toUpdate, function(err, nbRow) {
                                        if (err) {
                                            log.error(err);
                                            return res.status(500).send(err);
                                        } else {
                                            if (password !== undefined && password != ''){
                                                user.password = password;
                                            }
                                            user.save(function(err) {
                                                if (err) {
                                                    log.error(err);
                                                    audit.logEvent('[mongodb]', 'Users', 'Update', "userID", user._id, 'failed', "Mongodb attempted to save the new user");
                                                    return res.status(500).send(err);
                                                } else {
                                                    // If there is somthing to remove
                                                    if(Object.keys(toRemove).length > 0){
                                                        User.update({_id:user._id}, { $unset: toRemove }, function(err, nbRow) {
                                                            if (err) {
                                                                log.error(err);
                                                                return res.status(500).send(err);
                                                            } else {
                                                                user.save(function(err) {
                                                                    if (err) {
                                                                        log.error(err);
                                                                        audit.logEvent('[mongodb]', 'Users', 'Update', "userID", user._id, 'failed', "Mongodb attempted to save the new user");
                                                                        return res.status(500).send(err);
                                                                    } else {
                                                                        notification();
                                                                    }
                                                                });
                                                            }
                                                        });
                                                    } else {
                                                        notification();
                                                    }
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
        }
    } else {
        return res.send(401);
    }
};


exports.api.read = function(req, res){
    if(req.actor){
        if(req.params.id == undefined){
            audit.logEvent(req.actor.id, 'Users', 'Read', '', '', 'failed',
                           'The actor could not read the user because one or more params of the request was not defined');
            return res.sendStatus(400);
        } else {
            var role;
            var query = {
                _id:1,
                role: 1,
                "preferences.avatar": 1,
                created: 1
            };
            query.email = 1;
            query.firstname = 1;
            query.lastname = 1;
            query.language = 1;
            query.regions = 1;
            query.structures = 1;
            query.address = 1;

            User.findOne({
                _id: req.params.id
            }, query).lean().exec(function (err, user) {
                if (err) {
                    log.error(err);
                    audit.logEvent('[mongodb]', 'Users', 'Read', "userID", req.params.id, 'failed', "Mongodb attempted to find the user");
                    return res.status(500).send(err);
                } else {
                    if (user === null) {
                        audit.logEvent('[mongodb]', 'Users', 'Read', 'userID', req.params.id, 'failed',
                                       'Mongodb attempted to find the user but it revealed not defined');
                        return res.sendStatus(403);
                    } else {
                        if (user.preferences !== undefined && user.preferences.avatar !== undefined) {
                            user.avatar = user.preferences.avatar;
                            delete user.preferences;
                        }

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
        }
    } else {
        audit.logEvent('[anonymous]', 'Users', 'Read', '', '', 'failed', 'The actor was not authenticated');
        return res.send(401);
    }
};


exports.api.delete = function(req, res) {
    if(req.actor){
        if(req.params.id == undefined){
            audit.logEvent(req.actor.id, 'Users', 'Delete', '', '', 'failed', 'The actor could not delete a user because one or more params of the request was not defined');
            return res.sendStatus(400);
        } else {
            User.remove({_id : req.params.id}, function(err){
                if (err) {
                    log.error(err);
                    return res.status(500).send(err);
                } else {
                    audit.logEvent(req.actor.id, 'Users', 'Delete', "userID", req.params.id, 'succeed',
                                   'The actor has successfully deleted a user.');
                    return res.sendStatus(200);
                }
            });
        }
    } else {
        audit.logEvent('[anonymous]', 'Users', 'Delete', '', '', 'failed', 'The user was not authenticated');
        return res.send(401);
    }
}


exports.api.sendPassword = function(req, res) {
    var server = controllers.configuration.getConf().server;
    var form = new formidable.IncomingForm();
    form.parse(req, function(err, fields, files) {
        var userID = fields.userID || '';
        if (userID === '') {
            audit.logEvent('[anonymous]', 'Users', 'Send password', '', '', 'failed',
                           'The actor tried to send an email to the user to reset password in but one or more params of the request was not defined');
            return res.sendStatus(400);
        } else {
            User.findOne({_id: userID}, function (err, user) {
                if (err) {
                    log.error(err);
                    audit.logEvent('[mongodb]', 'Users', 'Send password', 'userID', userID, 'failed', 'Mongodb attempted to find the userID');
                    return res.status(500).send(err);
                } else {
                    if (user === null) {
                        audit.logEvent('[anonymous]', 'Users', 'Send password', 'used email', email, 'failed',
                                       'The actor tried to send an email to reset password but the userID does not exist');
                        return res.sendStatus(403);
                    } else {
                        //Create a token
                        crypto.randomBytes(20, function(err, buf) {
                            if (err) {
                                log.error(err);
                                return res.status(500).send(err);
                            } else {
                                var token = buf.toString('hex');
                                user.resetPasswordToken = token;
                                user.resetPasswordExpires = Date.now() + 3600000;
                                user.save(function(err) {
                                    if (err) {
                                        log.error(err);
                                        audit.logEvent('[mongodb]', 'Users', 'Send password', "userID", user._id, 'failed',
                                                       "Mongodb attempted to save the modified user");
                                        return res.status(500).send(err);
                                    } else {
                                        var subject = 'New password';
                                        if(user.language === 'FR'){
                                            subject = "Nouveau mot de passe";
                                        }

                                        var rep = [['[name]', user.firstname + " " + user.lastname], ['[link]', server.name + "/recovery/reset/" + token]];

                                        //Send an email with a link containing the key
                                        mail.sendMail({
                                            to: user.email,
                                            subject: subject,
                                            template: 'reset',
                                            language: user.language,
                                            holes: rep
                                        }, function(err){
                                            if (err) {
                                                log.error(err);
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
                }
            });
        }
    });
};



exports.getUser = function(user, actorRole, callback){
    var id = user.id || '';
    var query = {};
    var projection = {
        _id:1,
        firstname: 1,
        lastname: 1,
        role: 1,
        "preferences.avatar": 1,
        "email": 1
    };
    if (id === '') {
        callback("Wrong parameters", null);
    } else {
        query._id = id;
        if(actorRole == 1){
            projection.created = 1;
            projection.language = 1;
            projection.phone = 1;
            projection.address = 1;
        }

        User.findOne(query, projection, function(err, found) {
            if (err){
                callback(err, null);
            } else {
                callback(null, found);
            }   
        });
    }
};


exports.getRole = function(user, callback){
    var id = user.id || '';
    var query = {};
    if (id === '') {
        callback("Wrong parameters", null);
    } else {
        query._id = id;
        User.findOne(query, {role: 1}, function(err, found) {
            if (err){
                callback(err, null);
            } else {
                callback(null, found.role);
            }   
        });
    }
};

exports.getUsersByRole = function(r, callback){
    var role = r || '';
    var query = {};
    if (role === '') {
        callback("Wrong parameters", null);
    } else {
        query.role = role;
        User.find(query, function(err, users) {
            if (err){
                callback(err, null);
            } else {
                callback(null, users);
            }   
        });
    }
};


