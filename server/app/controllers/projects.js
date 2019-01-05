var Project = require('../models/project').Project;
var audit = require('../utils/audit-log');
var log = require('../utils/log');
var mail = require('../utils/mail');
var _ = require('lodash');
var crypto = require('crypto');
var dictionary = require('../utils/dictionary');
var formidable = require("formidable");

// API
exports.api = {};

var controllers = {
    configuration: require('./configuration'),
    users: require('./users'),
    organizations: require('./organizations')
};

exports.api.upsert = function (req, res) {
    if (req.actor) {
        var form = new formidable.IncomingForm();
        form.parse(req, function (err, fields, files) {
            if (err) {
                log.error(err);
                audit.logEvent('[formidable]', 'Projects', 'Upsert', "", "", 'failed', "Formidable attempted to parse project fields");
                return res.status(500).send(err);
            } else {
                exports.upsert({actor: req.actor}, fields, function (err) {
                    if (err) {
                        log.error(err);
                        return res.status(500).send(err);
                    } else {
                        res.sendStatus(200);
                    }
                });
            }
        });
    } else {
        audit.logEvent('[anonymous]', 'Projects', 'Upsert', '', '', 'failed', 'The actor was not authenticated');
        return res.sendStatus(401);
    }
};


exports.api.list = function (req, res) {
    if (req.actor) {
        Project.find({}, function (err, projects) {
            if (err) {
                log.error(err);
                audit.logEvent('[mongodb]', 'Projects', 'List', '', '', 'failed', 'Mongodb attempted to retrieve projects list');
                return res.status(500).send(err);
            } else {
                return res.json(projects);
            }
        });
    } else {
        audit.logEvent('[anonymous]', 'Projects', 'List', '', '', 'failed', 'The actor was not authenticated');
        return res.send(401);
    }
}

exports.api.read = function (req, res) {
    if (req.actor) {
        Project.findOne({
            _id: req.params.id
        }).lean().exec(function (err, project) {
            if (err) {
                log.error(err);
                audit.logEvent('[mongodb]', 'Projects', 'Read', "projectID", req.params.id, 'failed', "Mongodb attempted to find the project");
                return res.status(500).send(err);
            } else {
                if (project === null) {
                    audit.logEvent('[mongodb]', 'Projects', 'Read', 'projectID', req.params.id, 'failed',
                            'Mongodb attempted to find the project but it revealed not defined');
                    return res.sendStatus(403);
                } else {
                    if (req.params.beautify !== "undefined" && req.params.beautify === "true") {
                        beautify({actor: req.actor, language: req.actor.language, beautify: true}, [project], function (err, objects) {
                            if (err) {
                                return res.status(500).send(err);
                            } else {
                                return res.json(objects[0]);
                            }
                        });
                    } else {
                        return res.json(project);
                    }
                }
            }
        });
    } else {
        audit.logEvent('[anonymous]', 'Projects', 'Read', '', '', 'failed', 'The actor was not authenticated');
        return res.send(401);
    }
}


exports.api.delete = function (req, res) {
    if (req.actor) {
        if (req.params.id == undefined) {
            audit.logEvent(req.actor.id, 'Projects', 'Delete', '', '', 'failed', 'The actor could not delete a project because one or more params of the request was not defined');
            return res.sendStatus(400);
        } else {
            Project.remove({_id: req.params.id}, function (err) {
                if (err) {
                    log.error(err);
                    return res.status(500).send(err);
                } else {
                    audit.logEvent(req.actor.id, 'Projects', 'Delete', "projectID", req.params.id, 'succeed',
                            'The actor has successfully deleted a project.');
                    return res.sendStatus(200);
                }
            });
        }
    } else {
        audit.logEvent('[anonymous]', 'Projects', 'Delete', '', '', 'failed', 'The actor was not authenticated');
        return res.send(401);
    }
}

exports.upsert = function (options, fields, callback) {
    var name = fields.name || '';
    var enablersID = fields.enablersID || '';
    var value = fields.value || '';
    var successProbability = (fields.successProbability === undefined || fields.successProbability === "") ? "" : fields.successProbability;
    console.log(successProbability);
    if (name === '' || enablersID === '' || value === '' || successProbability === '') {
        audit.logEvent(options.actor.id, 'Projects', 'Upsert', 'projectname', name,
                'The actor could not create a new project because one or more parameters of the request was not correct');
        callback(400);
    } else {
        var filter = fields._id ? {_id: fields._id} : {name: fields.name, value: fields.value, successProbability: fields.successProbability, paymentDate: fields.paymentDate};
        fields.lastModified = new Date();
        fields.authorID = options.actor.id;

        Project.findOne({
            _id: fields._id
        }).lean().exec(function (err, oldProject) {
            if (err) {
                log.error(err);
                audit.logEvent('[mongodb]', 'Projects', 'Upsert', "projectID", fields._id, 'failed', "Mongodb attempted to find the project");

            }

            if (oldProject === null) {
                audit.logEvent('[mongodb]', 'Projects', 'Read', 'projectID', fields._id, 'failed',
                        'Mongodb attempted to find the project but it revealed not defined');
            }

            var differ = difference(fields, oldProject);
            
            console.log(differ);
            console.log();

            Project.findOneAndUpdate(filter, fields, {upsert: true, setDefaultsOnInsert: true}, function (err) {
                if (err) {
                    log.error(err);
                    audit.logEvent('[mongodb]', 'Projects', 'Upsert', "name", name, 'failed', "Mongodb attempted to save the new project");
                    return callback(err)
                } else {
                    return callback(null);
                }
            });

        });

    }
}

exports.getProjectsByFilter = function (options, callback) {
    if (!options.sort) {
        options.sort = {"paymentDate": 'desc'};
    }
    var q = Project.find(options.query).sort(options.sort).limit(options.limit).lean();
    q.exec(function (err, projects) {
        if (err) {
            log.error(err);
            audit.logEvent('[mongodb]', 'Tests', 'getProjectsByFilter', '', '', 'failed', 'Mongodb attempted to retrieve projects');
            callback(err);
        } else {
            beautify(options, projects, function (err, objects) {
                if (err) {
                    callback(err);
                } else {
                    callback(null, objects);
                }
            });
        }
    });
}


/**
 * Deep diff between two object, using lodash
 * @param  {Object} object Object compared
 * @param  {Object} base   Object to compare with
 * @return {Object}        Return a new object who represent the diff
 */
function difference(object, base) {
	function changes(object, base) {
		return _.transform(object, function(result, value, key) {
			if (!_.isEqual(value, base[key])) {
				result[key] = (_.isObject(value) && _.isObject(base[key])) ? changes(value, base[key]) : value;
			}
		});
	}
	return changes(object, base);
}


function beautify(options, objects, callback) {
    var language = options.language || "";
    language = language.toLowerCase();
    var gt = dictionary.translator(language);
    if (options.beautify && options.beautify === true) {
        function objectsLoop(o) {
            if (o < objects.length) {
                var enablersID = objects[o].enablersID || [];
                var status = objects[o].status || "";
                var fundersID = objects[o].finance && objects[o].finance.fundersID || [];
                var providersID = objects[o].finance && objects[o].finance.providersID || [];
                var revenueType = objects[o].finance && objects[o].finance.revenueType || "";
                var countries = objects[o].context && objects[o].context.countries || [];
                var sicknesses = objects[o].context && objects[o].context.sicknesses || [];
                var product = objects[o].context && objects[o].context.product || "";

                // Enablers
                objects[o].enablers = [];
                function enablersLoop(e) {
                    if (e < enablersID.length) {
                        controllers.users.getUser({id: enablersID[e]}, options.actor.role, function (err, user) {
                            if (err) {
                                log.error(err);
                                callback(err);
                            } else {
                                if (user != null) {
                                    objects[o].enablers.push(user.firstname + " " + user.lastname);
                                }
                                enablersLoop(e + 1);
                            }
                        });
                    } else {
                        // Status
                        if (status !== "") {
                            objects[o].status = dictionary.getValueFromJSON('../../resources/dictionary/project/statuses.json', status, language);
                        }

                        objects[o].finance = {
                            funders: [],
                            providers: [],
                            revenueType: ""
                        }
                        // Funders
                        function fundersLoop(f) {
                            if (f < fundersID.length) {
                                controllers.organizations.getOrganization({id: fundersID[f]}, function (err, organization) {
                                    if (err) {
                                        log.error(err);
                                        callback(err);
                                    } else {
                                        if (organization != null) {
                                            objects[o].finance.funders.push(organization.name);
                                        }
                                        fundersLoop(f + 1);
                                    }
                                });
                            } else {
                                // Providers
                                function providersLoop(p) {
                                    if (p < providersID.length) {
                                        controllers.organizations.getOrganization({id: providersID[p]}, function (err, organization) {
                                            if (err) {
                                                log.error(err);
                                                callback(err);
                                            } else {
                                                if (organization != null) {
                                                    objects[o].finance.providers.push(organization.name);
                                                }
                                                providersLoop(p + 1);
                                            }
                                        });
                                    } else {
                                        // Revenue type
                                        if (revenueType !== "") {
                                            objects[o].finance.revenueType = dictionary.getValueFromJSON('../../resources/dictionary/project/revenueTypes.json', revenueType, language);
                                        }

                                        objects[o].context = {
                                            countries: [],
                                            sicknesses: [],
                                            product: "",
                                        }

                                        // Countries
                                        if (countries.length > 0) {
                                            for (var i = 0; i < countries.length; i++) {
                                                objects[o].context.countries.push(dictionary.getValueFromJSON('../../resources/dictionary/project/countries.json', countries[i], language));
                                            }
                                        }

                                        // Sicknesses
                                        if (sicknesses.length > 0) {
                                            for (var i = 0; i < sicknesses.length; i++) {
                                                objects[o].context.sicknesses.push(dictionary.getValueFromJSON('../../resources/dictionary/project/sicknesses.json', sicknesses[i], language));
                                            }
                                        }

                                        // Product
                                        if (product !== "") {
                                            objects[o].context.product = dictionary.getValueFromJSON('../../resources/dictionary/project/products.json', product, language);
                                        }
                                        objectsLoop(o + 1);
                                    }
                                }
                                providersLoop(0);
                            }
                        }
                        fundersLoop(0);
                    }
                }
                enablersLoop(0);
            } else {
                callback(null, objects);
            }
        }
        objectsLoop(0);
    } else {
        callback(null, objects);
    }
}