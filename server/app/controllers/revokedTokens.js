var RevokedToken    = require('../models/revokedToken').RevokedToken;
var log             = require('../utils/log');

exports.set = function (token, ttl) {
    var token = token || '';
    var ttl = ttl || '';
    var filter = {$and: [{"token": token}]};
    if(ttl !== ''){
        filter.$and.push({
            "ttl": ttl
        });
    }
    var query = {token:token};
    if(ttl !== ''){
        query.ttl = ttl;
    }
    RevokedToken.findOneAndUpdate(filter, query, {upsert:true, new: true}, function (err, result){
        if (err) {
            log.error(err);
        } else {
            // Remove old revokedTokens here
            exports.clean();
        }
    });
};


exports.clean = function () {
    RevokedToken.remove({"ttl": {
        $lte: new Date()
    }}, function (err) {
        if (err) {
            log.error(err);
        }
    });
};

exports.get = function (token, callback) {
    var reply = null;
    RevokedToken.findOne({
        token: token
    }).exec(function (err, revokedToken) {
        if (err) {
            log.error(err);
            callback(err);
        } else {
            if(revokedToken !== null){
                reply = revokedToken.ttl;
            }
            callback(null, reply);
        }
    });
};