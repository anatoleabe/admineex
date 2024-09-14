var log = require('../utils/log');
var mongoose = require('mongoose');
var mongodbOptions = {};

// Controllers
var controllers = {
    configuration: require('../controllers/configuration.js')
};
var mongodbURL = controllers.configuration.getConf().mongo;

mongoose.Promise = global.Promise;
mongoose.connect(mongodbURL, mongodbOptions, function (err, res) {
    if (err) {
        console.error('Connection to ' + mongodbURL + " refused.  err : ", err);
        log.error('Connection to ' + mongodbURL + " refused.  err : ", err);
    } else {
        var admin = new mongoose.mongo.Admin(mongoose.connection.db);
        admin.buildInfo(function (err, info) {
            if (err) {
                console.error('Error while connecting to Admin collection of ' + mongodbURL + ".  err : ", err);
                log.error('Error while connecting to Admin collection of' + mongodbURL + ".  err : ", err);
            } else {
                log.info('MongoDB ' + info.version + ' via Mongoose '+ mongoose.version +' is ready on ' + mongodbURL);
            }
        });
    }
});