var log             = require('../utils/log');
var mongoose        = require('mongoose');
var mongodbOptions  = {};

// Controllers
var controllers = {
    configuration: require('../controllers/configuration.js')
};
var mongodbURL             = controllers.configuration.getConf().mongo;

mongoose.Promise = global.Promise;
mongoose.connect(mongodbURL, mongodbOptions, function (err, res) {
    if (err) { 
        console.log('Connection to ' + mongodbURL + " refused.  err : ", err);
        log.error('Connection to ' + mongodbURL + " refused.  err : ", err);
    } else {
        log.info('MongoDB is ready on port 27017');
    }
});