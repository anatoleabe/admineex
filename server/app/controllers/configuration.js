var nconf = require('nconf');
nconf.file("config/server.json");
var User = require('../models/user').User;
var audit = require('../utils/audit-log');
var log = require('../utils/log');
var dictionary = require('../utils/dictionary');
var fs = require('fs');
var _ = require('underscore');
var formidable = require("formidable");
var app = require('../../app');

// Controllers
var controllers = {
    users: require('./users')
};

// API
exports.api = {};

exports.api.read = function (req, res) {
    if (req.actor) {
        //Config
        nconf.file("config/server.json");
        var config = {
            server: nconf.get('server')
        };

        var language = req.actor.language;
        return res.json({
            server: {
                name: config.server.name,
                httpPort: config.server.httpPort
            }
        });
    } else {
        audit.logEvent('[anonymous]', 'Configuration', 'Read', '', '', 'failed', 'The actor was not authenticated');
        return res.send(401);
    }
};

exports.api.update = function (req, res) {
    if (req.actor) {
        var form = new formidable.IncomingForm();
        form.parse(req, function (err, fields, files) {
            if (err) {
                log.error(err);
                audit.logEvent('[formidable]', 'Configuration', 'Update', "", "", 'failed', "Formidable attempted to parse configuration fields");
                return res.status(500).send(err);
            } else {
                nconf.set("server:name", fields.server.name);
                nconf.save(function (err) {
                    if (err) {
                        log.error(err);
                        audit.logEvent('[nconf]', 'Configuration', 'Update', "", "", 'failed', "nconf attempted to save configuration");
                    } else {
                        // Start texto if it is enable
                        return res.sendStatus(200);
                    }
                });
            }
        });
    } else {
        audit.logEvent('[anonymous]', 'Configuration', 'Update', '', '', 'failed', 'The actor was not authenticated');
        return res.send(401);
    }
};

exports.getConf = function () {
    nconf.file("config/server.json");
    return ({
        log: nconf.get('log'),
        server: nconf.get('server'),
        token: nconf.get('token'),
        mongo: nconf.get('mongo'),
        mailer: nconf.get('mailer')
    });
}


exports.getLanguage = function (options) {
    var language = "EN";
    if (options.req && options.req.actor && options.req.actor.language) {
        language = options.req.actor.language;
    } else if (options.req && options.req.query && options.req.query.language) {
        language = options.req.query.language;
    }
    return language.toLowerCase();
}