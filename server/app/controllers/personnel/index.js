const Personnel = require('../../models/personnel').Personnel;
const audit = require('../../utils/audit-log');
const log = require('../../utils/log');
const _ = require('lodash');
const moment = require('moment');

// Controllers
const controllersPersonnelApi = require('./api');
const controllersPersonnelBeautify = require('./beautify');
const controllersPersonnelExport = require('./export');
const controllersPersonnelList = require('./list');
const controllersThresholds = require('../thresholds');

// API exports
exports.api = {
    upsert: controllersPersonnelApi.upsertAPI,
    list: controllersPersonnelApi.listAPI,
    read: controllersPersonnelApi.readAPI,
    delete: controllersPersonnelApi.deleteAPI,
    search: controllersPersonnelApi.searchAPI,
    export: controllersPersonnelExport.exportAPI,
    retired: controllersPersonnelApi.retiredAPI,
    checkExistance: controllersPersonnelApi.checkExistanceAPI,
    eligibleTo: controllersPersonnelApi.eligibleToAPI,
    downloadEligibleTo: controllersPersonnelApi.downloadEligibleToAPI,
    followUpSheet: controllersPersonnelApi.followUpSheetAPI,
};

exports.list = controllersPersonnelList.list;
exports.buildXLSX = controllersPersonnelExport.buildXLSX;
exports.buildXLSX2 = controllersPersonnelExport.buildXLSX2;
exports.eligibleTo = controllersPersonnelApi.eligibleTo;
exports.beautify = controllersPersonnelBeautify.beautify;
exports.upsert = function (fields, callback) {
    // Parse received fields
    let id = fields._id || '';
    let matricule = fields.matricule || '';
    let identifier = fields.identifier || '';
    let mysqlId = fields.mysqlId || '';

    let filter = {$and: []};
    if (id !== '') {
        filter.$and.push({
            "_id": id
        });
    } else if (identifier !== '') {
        filter.$and.push({
            "identifier": identifier
        });
    } else if (matricule !== '') {
        filter.$and.push({
            "identifier": matricule
        });
    } else if (matricule !== '') {
        filter.$and.push({
            "mysqlId": mysqlId
        });
    } else {
        filter = fields;
    }
    fields.lastModified = new Date();
    Personnel.findOneAndUpdate(filter, fields, {setDefaultsOnInsert: true, upsert: true, new : true}, function (err, result) {
        if (err) {
            log.error(err);
            audit.logEvent('[mongodb]', 'Personnel', 'Upsert', "", "", 'failed', "Mongodb attempted to update a personnel");
            callback(err);
        } else {
            callback(null, result);
        }
    });
};

//This function is called each day at 6am and check and set the new retired people
exports.checkRetirement = function (callback) {
//    Personnel.connection.db.createCollection('view_test', {
//        viewOn: 'personnels',
//        pipeline: [{"$match": {"retirement.retirement": true}}]
//    });

    let dateLimit = new Date(new Date().setFullYear(new Date().getFullYear() - 40));

    let query = {
        $and: [
            {
                "retirement.retirement": false
            },
            {
                "birthDate": {
                    $lte: moment(dateLimit).endOf('day')
                }
            }
        ]
    };
    controllersThresholds.read('1', function (err, threshold1) {
        if (err) {
            log.error(err);
            callback(err);
        } else {
            controllersThresholds.read('2', function (err, threshold2) {
                if (err) {
                    log.error(err);
                    callback(err);
                } else {
                    let q = Personnel.find(query);
                    q.exec(function (err, personnels) {
                        if (err) {
                            log.error(err);
                            audit.logEvent('[mongodb]', 'Personnel', 'checkRetirement', '', '', 'failed', 'Mongodb attempted to retrieve personnel list');
                            callback(err);
                        } else {
                            let candidates = [];
                            function LoopA(a) {
                                if (a < personnels.length && personnels[a]) {
                                    let age = exports._calculateAge(new Date(personnels[a].birthDate));
                                    //Decree N°2020/802 of 30 December 2020 of the President of the Republic harmonising the retirement age of civil servants.
                                    if (threshold1 && personnels[a].status == "1") {//Civil servant
                                        if (personnels[a].category && personnels[a].category != null && personnels[a].category != "") {
                                            if ((personnels[a].category == "5" || personnels[a].category == "6") && age >= parseInt(threshold1.values[1])) { //for category 'C' and 'D' staff, retirement at 55
                                                candidates.push(personnels[a]._id);
                                            } else if (age >= parseInt(threshold1.values[0])) {//Harmonised at sixty (60) years for category 'A' and 'B' staff

                                                candidates.push(personnels[a]._id);
                                            }
                                        } else if (age >= parseInt(threshold1.values[0])) {//Harmonised at sixty (60) years in case of other categories

                                            candidates.push(personnels[a]._id);
                                        }
                                    } else {// Contractual
                                        if (threshold2 && personnels[a].category && personnels[a].category != null && personnels[a].category != "") {
                                            if (parseInt(personnels[a].category, 10) >= 1 && parseInt(personnels[a].category, 10) <= 7 && age >= parseInt(threshold2.values[1])) { //Personnel non fonctionnaire CAT 1 à CAT 7 at 55 ans
                                                candidates.push(personnels[a]._id);
                                            } else if (age >= parseInt(threshold2.values[0])) {//Personnel non fonctionnaire CAT 8 à CAT 12 à 60 ans
                                                candidates.push(personnels[a]._id);
                                            }
                                        } else if (threshold2 && age >= parseInt(threshold2.values[0])) {//other in case
                                            candidates.push(personnels[a]._id);
                                        }
                                    }
                                    LoopA(a + 1);
                                } else {
                                    function LoopB(b) {
                                        if (b < candidates.length) {
                                            let situations = candidates[b].situations;
                                            let newSituation = {
                                                situation: "12", //Retirement
                                                numAct: "#", //Auto genereted by the bot
                                                nature: "#"//Auto genereted by the bot
                                            }
                                            if (situations) {
                                                situations.push(newSituation)
                                            } else {
                                                situations = [];
                                                situations.push(newSituation)
                                            }

                                            let fields = {
                                                "_id": candidates[b],
                                                "retirement.retirement": true,
                                                "retirement.retirementDate": new Date(),
                                                "situations": situations
                                            }
                                            exports.upsert(fields, function (err) {
                                                if (err) {
                                                    log.error(err);
                                                    callback(err);
                                                } else {
                                                    LoopB(b + 1);
                                                }
                                            });
                                        } else {
                                            if (candidates.length > 0) {
                                                audit.logEvent('[mongodb]', 'Personnel', 'checkRetirement', '', '', 'failed', "Admineex found " + candidates.length + ' new people of retirement age.');
                                            }
                                            callback(null, candidates.length);
                                        }
                                    }
                                    LoopB(0);
                                }
                            }
                            LoopA(0);
                        }
                    });
                }
            });
        }
    });
}

exports.read = function (options, callback) {
    Personnel.findOne({
        _id: options._id
    }).lean().exec(function (err, result) {
        if (err) {
            log.error(err);
            callback(err);
        } else {
            if (result) {
                callback(null, result);
            } else {
                callback(null);
            }
        }
    });
}



exports.findByMatricule = function (options, callback) {
    Personnel.findOne({
        identifier: options.matricule
    }).lean().exec(function (err, result) {
        if (err) {
            log.error(err);
            callback(err);
        } else {
            if (result) {
                callback(null, result);
            } else {
                callback(null);
            }
        }
    });
}

exports._calculateAge =  async function (birthday) { // birthday is a date
    let ageDifMs = Date.now() - birthday.getTime();
    let ageDate = new Date(ageDifMs); // miliseconds from epoch
    return Math.abs(ageDate.getUTCFullYear() - 1970);
}