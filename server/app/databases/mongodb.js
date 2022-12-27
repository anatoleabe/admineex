var log = require('../utils/log');
var mongoose = require('mongoose');
var mongodbOptions = {};

// Controllers
var controllers = {
    configuration: require('../controllers/configuration.js')
};
var mongodbURL = controllers.configuration.getConf().mongo;

mongoose.Promise = global.Promise;
mongoose.connect(mongodbURL, mongodbOptions, function (err, connection) {
    if (err) {
        console.log('Connection to ' + mongodbURL + " refused.  err : ", err);
        log.error('Connection to ' + mongodbURL + " refused.  err : ", err);
    } else {
        log.info('MongoDB is ready on port 27017');
        //console.log(connection)
        connection.createCollection("stataffectation", {
            viewOn: "affectations",
            pipeline: [{
                    $sort: {lastModified: -1}
                }, {
                    $lookup: {
                        from: 'personnels',
                        localField: 'personnelId',
                        foreignField: '_id',
                        as: 'personnel',
                    },
                }, {
                    "$unwind": {
                        path: "$personnel",
                        preserveNullAndEmptyArrays: false
                    }
                },
                {
                    $group: {_id: "$personnelId", personnel: {$first: "$personnel"}}},
                {
                    $group: {_id: "$personnel.gender", number: {$sum: 1}}},
                {
                    $match: {_id: {"$in": ["F", "M"]}}}

            ],
            collation: {
                locale: "en",
                strength: 2
            }
        });
    }
});