
// Description: This file contains the initialization functions for the application.
const snapshotJob = require('./jobs/snapshotJob');
const {exec} = require("child_process");
const {bulkCreateSnapshots} = require("./services/snapshotService");
const log = require('./utils/log');
const CronJob = require('cron').CronJob;

const controllers = {};
controllers.positions = require('./controllers/positions');
controllers.personnel = require('./controllers/personnel');


// Init All
exports.run = async () => {
    // Initialize all necessary components

    //Run the snapshot job here
    startBot();

}

function startBot() {
    controllers.positions.patrol0(function (err, avoided) {
        if (err) {
            log.error(err);
            console.log(err);
        }
    });

    // Schedule the snapshot job
    scheduleSnapshotJob();

    // Schedule the retirement check job
    scheduleRetirementCheckJob();

    // Initial retirement check
    controllers.personnel.checkRetirement(function (err, count) {
        if (err) {
            log.error(err);
            console.log(err);
        } else {
            console.log("Check of new retirement done. New retirement = ", count);
        }
    });
}

function scheduleSnapshotJob() {
    // Schedule a snapshot job to run every 5 minutes
    new CronJob('59 23 1 * *', function () {
        console.log('Running monthly personnel snapshot...');
        bulkCreateSnapshots()
            .then(() => console.log('Snapshot completed'))
            .catch(console.error);
    }, null, true);
}

function scheduleRetirementCheckJob() {
    // Schedule a job to check retirements every weekday at 06:00 AM
    new CronJob('00 11 06 * * *', function () {
        /*
         * Runs every weekday (Monday through Friday)
         * at 06:00:00 AM. It does not run on Saturday or Sunday.
         */
        controllers.personnel.checkRetirement(function (err, count) {
            if (err) {
                log.error(err);
                console.log(err);
            } else {
                console.log("Check of new retirement done. New retirement = ", count);
            }
        });
    }, null, true);
}

