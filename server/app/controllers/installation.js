var nconf = require('nconf');
nconf.file("config/server.json");
var formidable = require("formidable");
var audit = require('../utils/audit-log');
var User = require('../models/user').User;
var log = require('../utils/log');
var fs = require('fs');

var controllers = {
    configuration: require('../controllers/configuration.js')
};

// API
exports.api = {};

exports.api.read = function (req, res) {
    if (!status()) {
        var config = {
            server: nconf.get('server'),
            token: nconf.get('token'),
        };

        return res.json({
            server: {
                name: config.server.name
            },
            token: {
                secret: config.token.secret,
                expiration: config.token.expiration
            }
        });
    } else {
        res.sendStatus(404);
    }
};

exports.api.status = function (req, res) {
    return res.json(status());
};

function status() {
    if (fs.existsSync("config/WIZARD")) {
        return false;
    } else {
        return true;
    }
}
;

exports.api.update = function (req, res) {
    var form = new formidable.IncomingForm();
    form.parse(req, function (err, fields, files) {
        if (err) {
            log.error(err);
            audit.logEvent('[formidable]', 'Installation', 'Update', "", "", 'failed', "Formidable attempted to parse installation fields");
            return res.status(500).send(err);
        } else {
            nconf.set("server:name", fields.server.name);
            nconf.set("token:secret", fields.token.secret);
            nconf.set("token:expiration", fields.token.expiration);
            nconf.save(function (err) {
                if (err) {
                    log.error(err);
                    audit.logEvent('[nconf]', 'Installation', 'Update', "", "", 'failed', "nconf attempted to save installation");
                } else {
                    // Delete WIZARD file
                    if (fields.step == 2) {
                        fs.unlink("config/WIZARD", (err) => {
                            if (err) {
                                log.error(err);
                                audit.logEvent('[FS]', 'Installation', 'installation', "", "", 'failed', "Failed to delete WIZARD file");
                            } else {
                                log.info('Successfully deleted WIZARD file');
                            }
                        });
                    }
                    return res.sendStatus(200);
                }
            });
        }
    });
};

exports.api.admin = function (req, res) {
    var form = new formidable.IncomingForm();
    form.parse(req, function (err, fields) {
        var role = '1';
        User.findOne({
            role: role
        }).exec(function (err, theUser) {
            if (err) {
                log.error(err);
                audit.logEvent('[mongodb]', 'Installation', 'Admin', "", "", 'failed', "Mongodb attempted to find the admin");
            } else {
                if (theUser === null) {
                    var email = fields.email;
                    var firstname = fields.firstname;
                    var lastname = fields.lastname;
                    var password = fields.password;
                    var activationToken = "0";
                    var language = fields.language;

                    var user = new User();
                    user.email = email;
                    user.firstname = firstname;
                    user.lastname = lastname;
                    user.password = password;
                    user.role = role;
                    user.language = language;
                    user.activationToken = activationToken;
                    user.save(function (err) {
                        if (err) {
                            log.error(err);
                            audit.logEvent('[mongodb]', 'Installation', 'Admin', "", "", 'failed', "Mongodb attempted to save the admin");
                            return res.status(500).send(err);
                        } else {
                            return res.sendStatus(200);
                        }
                    });
                } else {
                    return res.sendStatus(500);
                }
            }
        });
    });
};