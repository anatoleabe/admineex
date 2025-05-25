const audit = require("../../utils/audit-log");
const dictionary = require("../../utils/dictionary");
const fs = require("fs");
const Excel = require("exceljs");
const moment = require("moment");
const keyGenerator = require("generate-key");
const _ = require('lodash');
const log = require('../../utils/log');
const Agenda      = require('agenda');
const {ObjectId}  = require('mongodb');
const nconf         = require('nconf');nconf.file('config/server.json');
const formidable    = require("formidable");
const rimraf      = require('rimraf');
const app         = require("../../../app");
const archiver      = require('archiver');
const CSV_BOM = '\ufeff';
const CSV_DELIMITER = nconf.get('export:csvDelimiter') || ',';

const NB_TESTS_MAX = 9500;
const MSG_EXPORT_FAILED = 0;
const MSG_EXPORT_SUCCEEDED_NO_TEST = 1;
const MSG_EXPORT_SUCCEEDED = 2;
let defaultIo=null;

// Controllers
const controllersPersonnelsList = require("./list");
const controllersStructures = require("../structures");
const {performance} = require("perf_hooks");
const events = require("events");
const os = require("os");
const mongoose = require("mongoose");


exports.exportAPI = function (req, res) {
    if (req.actor) {
        if (req.params.filters === undefined) {
            audit.logEvent(req.actor.id, 'Personnel', 'Export', '', '', 'failed',
                'The actor could not export the personnel list because one or more params of the request was not defined');
            return res.sendStatus(400);
        } else {
            let filtersParam = {}
            if (req.params.filters && req.params.filters != "-" && req.params.filters != "") {
                filtersParam = JSON.parse(req.params.filters);
            }

            let filter = {rank: "2"};
            if (filtersParam.structure != "-1" && filtersParam.structure != "undefined" && filtersParam.structure) {
                filter.code = filtersParam.structure;
                if (filter.code.endsWith("-")) {
                    filter.code = filtersParam.structure.slice(0, -1);
                }
            }
            let option = {
                actor: req.actor, language: req.actor.language, beautify: true, filter: filter
            }
            controllersStructures.list(option, function (err, structures) {
                if (err) {
                    log.error(err);
                    res.status(500).send(err);
                } else {
                    let options = {
                        minify: false,
                        req: req,
                        filters: filtersParam,
                        language: req.actor.language,
                        beautifyPosition: false,
                        toExport: true
                    }

                    options.projection = {
                        _id: 1,
                        name: 1,
                        "retirement": 1,
                        matricule: 1,
                        metainfo: 1,
                        gender: 1,
                        grade: 1,
                        rank: 1,
                        category: 1,
                        index: 1,
                        cni: 1,
                        status: 1,
                        identifier: 1,
                        corps: 1,
                        telecom: 1,
                        fname: 1,
                        "affectation._id": 1,
                        "affectation.positionCode": 1,
                        "situations": 1,
                        "affectation.position.fr": 1,
                        "affectation.position.en": 1,
                        "affectation.position.code": 1,
                        "affectation.position.structureId": 1,
                        "affectation.numAct": 1,
                        "affectation.rank": 1,
                        address: 1,
                        birthPlace: 1,
                        birthDate: 1,
                        "history.recruitmentActNumber": 1,
                        "history.signatureDate": 1,
                        "history.minfiEntryRefAct": 1
                    };
                    controllersPersonnelsList.list(options, function (err, personnels) {
                        if (err) {
                            log.error(err);
                            res.status(500).send(err);
                        } else {
                            personnels.sort(function (a, b) {
                                if (a.fname < b.fname) {
                                    return -1;
                                } else
                                if (a.fname > b.fname) {
                                    return 1;
                                } else
                                    return 0;
                            })
                            let groupedPersonnelByStructureChildren = [];
                            if (filtersParam.staffOnly === false || filtersParam.staffOnly === "false") {
                                groupedPersonnelByStructureChildren["undefined"] = personnels;
                            } else {
                                groupedPersonnelByStructureChildren = _.groupBy(personnels, function (item) {
                                    if (item.affectation && item.affectation.structure && item.affectation.structure._id) {

                                        return item.affectation.structure._id;
                                    } else {
                                        return "undefined";
                                    }

                                });

                                for (let s in structures) {
                                    if (structures[s].children) {
                                        for (let c in structures[s].children) {
                                            structures[s].children[c].personnels = groupedPersonnelByStructureChildren[structures[s].children[c]._id]
                                        }
                                    }
                                }
                            }

                            if (groupedPersonnelByStructureChildren["undefined"]) {
                                let undefinedStructure = {
                                    code: "000",
                                    name: "STRUCTURE INCONNUE",
                                    children: [{
                                        code: "000 - 0",
                                        fr: "Inconue",
                                        personnels: groupedPersonnelByStructureChildren["undefined"]
                                    }]
                                }
                                structures.push(undefinedStructure);
                            }

                            let gt = dictionary.translator(req.actor.language);
                            //Build XLSX
                            let options = buildFields(req.actor.language, "fieldNames.json");
                            options.staffOnly = filtersParam.staffOnly;
                            options.data = structures;
                            options.title = gt.gettext("Admineex: Liste du personnel");
                            buildXLSX(options, function (err, filePath) {
                                if (err) {
                                    console.error(err);
                                    log.error(err);
                                } else {
                                    let fileName = 'report.xlsx';
                                    res.set('Content-disposition', 'attachment; filename=' + fileName);
                                    res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
                                    let fileStream = fs.createReadStream(filePath);
                                    let pipeStream = fileStream.pipe(res);
                                    pipeStream.on('finish', function () {
                                        fs.unlinkSync(filePath);
                                    });
                                }
                            });
                        }
                    });
                }
            });


        }
    }
}

exports.createExportAPI = function (req, res) {
    if (req.actor) {
        try {
            const form = new formidable.IncomingForm();
            form.parse(req, function (err, fields) {
                if (err) {
                    log.error("Formidable error during createPersonnelExportAPI:", err);
                    return res.status(500).send(err);
                } else {
                    // Build query object to pass to the export job queue
                    const query = {
                        actor: req.actor,
                        exportName: fields.name,
                        structure: fields.structure,
                        staffOnly: fields.staffOnly,
                        // optionally other filters can be passed through here
                        filters: fields.filters // assuming this is a JSON string
                    };

                    createExportJob(query);
                    triggerNextExportJob();

                    const auditMessage = `The user initiated personnel data export at ${moment().format('YYYY-MM-DD HH:mm:ss')}`;
                    log.info(auditMessage);
                    audit.logEvent(req.actor.id,"Personnel","createExport","","","succeed",auditMessage);
                    return res.sendStatus(200);
                }
            });
        } catch (error) {
            log.error("Error during personnel export creation:", error);
            audit.logEvent( req.actor.id, "Personnel", "createExport", "", "", "failed", "Operation failed while trying to initiate personnel export job" );
            return res.status(500).send(error);
        }
    } else {
        return res.sendStatus(401);
    }
};


exports.listAPI = async function (req, res) {
    if (req.actor) {
        try {
            var form = new formidable.IncomingForm();
            form.parse(req, async function (err, fields, files) {
                if(err){
                    log.error("Formidable attempted to parse create export.",err);
                    return res.status(500).send(err);
                } else {
                    const jobIds=fields.jobIds;
                    const jobsToInclude =jobIds.map(jobId => ({_id: new ObjectId(jobId)}));

                    jobsToInclude.push({'data.user': req.actor.id});
                    const agenda = new Agenda({ db: { address: nconf.get('mongo') } }); // Connect to MongoDB
                    await agenda.start();
                    var limit = parseInt(req.params.limit, 10);
                    var skip = parseInt(req.params.skip, 10);
                    var match = req.actor.role === '1' ? {'data.jobType': "ExportPreparation" } : {
                        'data.jobType': "ExportPreparation",
                        $or :jobsToInclude
                    };

                    const jobs = await agenda.jobs(
                        match,
                        { lastRunAt: -1 },
                    );

                    //where: { name: 'sendEmails'},
                    //limit: pageSize,
                    //offset: (pageNumber - 1) * pageSize,
                    // Process and return the paginated job list
                    return res.json(jobs);
                }
            });
        } catch (error) {
            console.log(error)
            log.error('Mongodb attempted to retrieve exports list from DB.',error);
            return res.status(500).send(error);
        }
    } else {
        return res.sendStatus(401);
    }
};

exports.getAJobAPI = async function (req, res) {
    if (req.actor) {
        try {
            const agenda = new Agenda({ db: { address: nconf.get('mongo') } }); // Connect to MongoDB
            await agenda.start();
            const job = await agenda.jobs({ '_id': (new ObjectId(req.params.id))})
            return res.json(job);
        } catch (error) {
            log.error('Mongodb attempted to retrieve an export job.',error);
            return res.status(500).send(error);
        }
    } else {
        return res.sendStatus(401);
    }
};

const alertExportUser = async (options) =>{
    const exportMailAlertAfterMS= nconf.get('export:mailAlertAfterMS') || 120000;
    if ( options.elapsedTimeMs >= exportMailAlertAfterMS  ){
        controllersUsers.getUser({id: options.userId}, "", function(err, user){
            if (err){
                log.error('Error in alertExportUser', err);
            } else {
                if(user != null){
                    const gt = dictionary.translator(user.language);
                    const holes = [['[name]', user.lastname], ['[exportName]', options.exportName]];
                    holes.push(['[url]',options.url])
                    mail.sendMail({
                        to: user.email,
                        subject: gt.gettext('Your export data is ready for download!'),
                        template: 'notification_for_export_completion',
                        language: user.language,
                        holes: holes
                    }, function(err, info){
                        if (err) {
                            log.error(err);
                            audit.logEvent(options.userId,'Export','alertExportUser','','','failed','The user could not retrieve data because one or more params of the request is not defined');
                        } else {
                            log.info("Export alert email sent to: " + user.email);
                            audit.logEvent(options.userId,'Export','alertExportUser','','','success','Export alert email sent to: ' + user.email);
                        }
                    });
                }
            }
        });
    }
}


const getNewJobName = ()=>{
    //getting a pseudo unique name
    const timestamp = Date.now().toString(36).toUpperCase();
    const random1 = Math.random().toString(36).substring(2, 7).toUpperCase();
    const random2 = Math.random().toString(36).substring(2, 7).toUpperCase();
    return `${timestamp}-${random1}-${random2}`;
}

const JobDefinition = async (job, done) => {
    const startTime = performance.now();
    const progress = new events.EventEmitter();
    const exportSummariesArray = [];
    let endJobNow = false;

    const {
        _id: jobId,
        name: jobName,
        data: {
            query: { actor, filters, exportName }
        }
    } = job.attrs;

    const language = actor.language.toLowerCase();

    const emitProgress = (info) => {
        const io = app.io || defaultIo;
        info.availableMemPercentage = 100 - (100 * os.freemem()) / os.totalmem();
        io.sockets.emit('jobProgress', info);
    };

    const emitInitialProgress = () => {
        progress.emit('jobProgress', { reload: true, id: jobId, userId: actor.id });
    };

    const handleError = async (error) => {
        console.log(error)
        log.error('Error in personnel export job definition', error);
        job.attrs.data.success = false;
        job.attrs.data.progress = MSG_EXPORT_FAILED;

        progress.emit('jobProgress', {
            job: jobName,
            id: jobId,
            exportName,
            progress: MSG_EXPORT_FAILED,
            percentage: 100,
            staffsCount: '~',
            elapsedTimeMs: performance.now() - startTime,
            failedAt: new Date(),
            lastFinishedAt: new Date(),
            success: false
        });

        await audit.logEvent(actor.id, 'Personnel', 'Export', '', '', 'failed', `Export job error: ${error.message}`);
        done(error);
    };

    const getStructures = async (filter) => {
        return new Promise((resolve, reject) => {
            controllersStructures.list({ actor, language, beautify: true, filter }, (err, data) => {
                err ? reject(err) : resolve(data);
            });
        });
    };

    const getPersonnelCount = async (options) => {
        return new Promise((resolve, reject) => {
            controllersPersonnelsList.count(options, (err, count) => {
                err ? reject(err) : resolve(count);
            });
        });
    };

    const getPersonnelList = async (options) => {
        return new Promise((resolve, reject) => {
            controllersPersonnelsList.list(options, (err, personnels) => {
                if (err) return reject(err);
                personnels.sort((a, b) => a.fname.localeCompare(b.fname));
                resolve(personnels);
            });
        });
    };

    const checkJobStillExists = async () => {
        const jobInDb = await mongoose.connection.collection('agendaJobs').find({ _id: new ObjectId(jobId) }).toArray();
        return jobInDb.length > 0;
    };

    const createExportPaths = (basePath, name) => {
        const path = `./tmp/${basePath}/`;
        return {
            staffOnly: filters.staffOnly,
            title: dictionary.translator(language).gettext("Admineex: Liste du personnel"),
            excelPath: path,
            zipPath: `${path.slice(0, -1)}.zip`,
            csvPath: `${path}Personnel_Export_${name}.csv`,
            xlsxPath: `${path}Personnel_Export_${name}.xlsx`,
            xlsxPathNoExt: `${path}Personnel_Export_${name}_`
        };
    };

    progress.on('jobProgress', emitProgress);
    emitInitialProgress();

    try {
        log.info(`Personnel data export job started at ${moment().format('YYYY-MM-DD HH:mm:ss')}`);
        await audit.logEvent(actor.id, 'Personnel', 'Export', '', '', 'succeed', 'Export job started');

        if (!filters) {
            await audit.logEvent(actor.id, 'Personnel', 'Export', '', '', 'failed', 'Export failed: filters undefined');
            throw new Error('Filters parameter is required');
        }
        const baseFilter = { rank: '2' };
        if (filters.structure && filters.structure !== '-' && filters.structure !== '-1' && filters.structure !== 'undefined') {
            baseFilter.code = filters.structure.endsWith('-') ? filters.structure.slice(0, -1) : filters.structure;
        }
        //Based on type
        if (filters.type && filters.type !== '-' && filters.type !== '-1' && filters.type !== 'undefined') {
            baseFilter.type = filters.type;
        }

        const structures = await getStructures(baseFilter);

        const personnelOptions = {
            minify: false,
            req: job.attrs.data.query,
            filters,
            language,
            beautifyPosition: false,
            toExport: true,
            projection: {
                _id: 1, name: 1, "retirement": 1, matricule: 1, metainfo: 1, gender: 1,
                grade: 1, rank: 1, category: 1, index: 1, cni: 1, status: 1, identifier: 1,
                corps: 1, telecom: 1, fname: 1, "affectation._id": 1, "affectation.positionCode": 1,
                "situations": 1, "affectation.position.fr": 1, "affectation.position.en": 1,
                "affectation.position.code": 1, "affectation.position.structureId": 1,
                "affectation.numAct": 1, "affectation.rank": 1, address: 1, birthPlace: 1,
                birthDate: 1, "history.recruitmentActNumber": 1, "history.signatureDate": 1,
                "history.minfiEntryRefAct": 1
            }
        };

        const totalCount = await getPersonnelCount(personnelOptions);
        job.attrs.data.staffsCount = totalCount;

        if (totalCount === 0) {
            job.attrs.data = {
                ...job.attrs.data,
                success: true,
                progress: MSG_EXPORT_SUCCEEDED_NO_TEST,
                exportSummaries: { exportedRows: 0, skippedRows: 0 }
            };
            progress.emit('jobProgress', {
                job: jobName,
                id: jobId,
                exportName,
                progress: job.attrs.data.progress,
                percentage: 100,
                staffsCount: 0,
                elapsedTimeMs: performance.now() - startTime,
                lastFinishedAt: new Date(),
                success: true
            });
            return done();
        }

        const chunkSize = nconf.get('export:maxRowsOnFetch') || 100;
        const workPlan = Array.from({ length: Math.ceil(totalCount / chunkSize) }, (_, i) => ({
            start: i * chunkSize,
            end: Math.min((i + 1) * chunkSize, totalCount),
            count: chunkSize,
            progress: Math.floor((i * chunkSize * 100) / totalCount)
        }));

        workPlan[workPlan.length - 1].progress = 99;
        workPlan[workPlan.length - 1].count = workPlan[workPlan.length - 1].end - workPlan[workPlan.length - 1].start;

        const exportOptions = {
            ...createExportPaths(keyGenerator.generateKey(), exportName),
            ...buildFields(language, "fieldNames.json")
        };


        if (!fs.existsSync('./tmp')) fs.mkdirSync('./tmp');
        if (!fs.existsSync(exportOptions.excelPath)) fs.mkdirSync(exportOptions.excelPath);

        for (const step of workPlan) {
            if (!(await checkJobStillExists())) {
                endJobNow = true;
                rimraf.sync(exportOptions.excelPath);
                log.info(`User gracefully ended job ${jobName}`);
                await audit.logEvent(actor.id, "Personnel", "Export", "", "", "End", `User ended job ${exportName}`);
                break;
            }

            personnelOptions.limit = step.count;
            personnelOptions.skip = step.start;

            const personnels = await getPersonnelList(personnelOptions);
            //job.attrs.data.staffsCount = job.attrs.data.staffsCount + personnels.length;
            const grouped = filters.staffOnly === false || filters.staffOnly === "false"
                ? { "undefined": personnels }
                : _.groupBy(personnels, p => p?.affectation?.structure?._id || "undefined");

            for (const s of structures) {
                if (s.children) {
                    for (const c of s.children) {
                        c.personnels = grouped[c._id];
                    }
                }
            }

            if (grouped["undefined"]) {
                structures.push({
                    code: "000",
                    name: "STRUCTURE INCONNUE",
                    children: [{
                        code: "000 - 0",
                        fr: "Inconnue",
                        personnels: grouped["undefined"]
                    }]
                });
            }

            progress.emit('jobProgress', {
                job: jobName,
                id: jobId,
                exportName,
                progress: `${step.end}/${totalCount}`,
                percentage: step.progress,
                staffsCount: totalCount,
                fileSize: fs.existsSync(exportOptions.xlsxPath) ? fs.statSync(exportOptions.xlsxPath).size : 0,
                elapsedTimeMs: performance.now() - startTime
            });

            exportOptions.data = structures;
            const summary = await exports.exportToXLSX(exportOptions);
            exportSummariesArray.push(summary);

        }

        if (!endJobNow) {
            const exportedRows = exportSummariesArray.reduce((sum, s) => sum + s.exportedRows, 0);
            const skippedRows = exportSummariesArray.reduce((sum, s) => sum + s.skippedRows, 0);
            job.attrs.data.exportSummaries = { exportedRows, skippedRows };

            await zipDirectory({
                pwd: nconf.get("export").protectExportFile ? nconf.get('tunnel:key') : '',
                dir: exportOptions.excelPath,
                zip: exportOptions.zipPath
            });
            rimraf.sync(exportOptions.excelPath);

            job.attrs.data = {
                ...job.attrs.data,
                success: true,
                file: exportOptions.zipPath,
                fileSize: fs.existsSync(exportOptions.zipPath) ? fs.statSync(exportOptions.zipPath).size : 0,
                progress: MSG_EXPORT_SUCCEEDED
            };

            progress.emit('jobProgress', {
                job: jobName,
                id: jobId,
                exportName,
                progress: MSG_EXPORT_SUCCEEDED,
                percentage: 100,
                staffsCount: totalCount,
                file: exportOptions.zipPath,
                fileSize: job.attrs.data.fileSize,
                elapsedTimeMs: performance.now() - startTime,
                lastFinishedAt: new Date(),
                exportSummaries: job.attrs.data.exportSummaries,
                success: true
            });

            await alertExportUser({
                userId: actor.id,
                elapsedTimeMs: performance.now() - startTime,
                exportName,
                url: `${nconf.get('server:name')}/staffs/export/download/${jobId}`
            });
        }

        await audit.logEvent(actor.id, 'Personnel', 'Export', '', '', 'success', `Export finalized with ${totalCount} personnels`);
        done();
    } catch (err) {
        await handleError(err);
    }
};


const createExportJob = async function(query, runImmediatly) {
    try{
        const agenda = new Agenda({defaultLockLifetime: (nconf.get('export:defaultLockLifetime') || 172800000), db: { address: nconf.get('mongo') } }); // Connect to MongoDB
        const jobName=getNewJobName();

        const jobData={};
        jobData.user = query.actor.id;
        jobData.query = query;
        jobData.createdAt = new Date();
        jobData.jobType = 'ExportPreparation';
        jobData.pending = true;

        await agenda.define(jobName,JobDefinition);
        await agenda.on("start", (job) => {
            log.info(`Job ${job.attrs.name} starting`);
        });
        //Notifier front of global fails, don't want to be there
        await agenda.on("fail", async (err, job) => {
            await triggerNextExportJob();
        });
        await agenda.on("success", async (job) => {
            await triggerNextExportJob();
        });

        const oneYearFromNow = new Date(Date.now() + (365 * 24 * 60 * 60 * 1000));
        await agenda.start();
        if (runImmediatly){
            await agenda.now(jobName, jobData);
        } else {
            await agenda.schedule(oneYearFromNow, jobName, jobData);
        }
    } catch (err) {
        log.error('Error in createExportJob:', err);
        audit.logEvent(query.actor.id, "Export", "createExportJob", "", "", "failed", "An error occured while running export task");
    }
}

exports.downloadExportAPI = async function(req, res) {
    if (req.actor) {
        try{
            const agenda = new Agenda({ db: { address: nconf.get('mongo') } }); // Connect to MongoDB
            await agenda.start();
            const JobArray = await agenda.jobs({ '_id': (new ObjectId(req.params.id))})
            if (JobArray && JobArray.length>0){
                const currentJob = JobArray[0];
                var filePath = currentJob.attrs.data.file;
                res.set("Content-disposition", "attachment; filename=" + filePath);
                res.set("Content-Type", " application/zip");
                var fileStream = fs.createReadStream(filePath);
                var pipeStream = fileStream.pipe(res);
                pipeStream.on("finish", function() {
                    audit.logEvent(req.actor.id, "Export", "downloadExport", "", "", "success", "Export zip file downladed with success");
                });
            } else {
                audit.logEvent(req.actor.id, "Export", "downloadExport", "", "", "failed", "Export job not found");
                return res.sendStatus(404);
            }
        } catch (err) {
            log.error('Error in zipDirectory:', err);
            audit.logEvent(req.actor.id, "Export", "downloadExport", "", "", "failed", "An error occured while downloading the export zip file");
        }
    } else {
        return res.sendStatus(401);
    }
};

exports.deleteExportAPI = async function(req, res) {
    if (req.actor) {
        try{
            var form = new formidable.IncomingForm();
            form.parse(req, async function (err, fields, files) {
                if(err){
                    log.error("Formidable attempted to parse deleteExport fields",err);
                    return res.status(500).send(err);
                } else {
                    const agenda = new Agenda({ db: { address: nconf.get('mongo') } }); // Connect to MongoDB
                    await agenda.start();
                    const ids=fields.ids;
                    if (ids && ids.length>0){
                        for (let i = 0; i < ids.length; i++) {
                            const JobArray = await agenda.jobs({ '_id': (new ObjectId(ids[i]))})
                            if (JobArray && JobArray.length>0){
                                const currentJob = JobArray[0];
                                await deleteJob(currentJob);
                                audit.logEvent(req.actor.id, "Export", "deleteExport", "", "", "succeed", 'Export job deleted with success');
                                return res.sendStatus(200);
                            } else {
                                audit.logEvent(req.actor.id, "Export", "deleteExport", "", "", "failed", "Export job not found");
                                return res.sendStatus(404);
                            }
                        }
                    } else {
                        audit.logEvent(req.actor.id, "Export", "deleteExport", "", "", "failed", "No export id provided");
                        res.status(400).send({code: "invalid_request_param", message: "Missing job id in request parameters"});
                    }
                }
            })
        } catch (err) {
            log.error('Error in deleteExport:', err);
            audit.logEvent(req.actor.id, "Export", "deleteExport", "", "", "failed", "An error occured while deleting an export job");
            return res.status(500).send(err);
        }
    } else {
        return res.sendStatus(401);
    }
};

const deleteJob = async (job) => {
    try{
        if(job.attrs.data.file){
            if (fs.existsSync(job.attrs.data.file)){
                fs.unlinkSync(job.attrs.data.file);
            }
        }
        job.remove();
    } catch (error) {
        log.error(`Failed to delete jobs ${job.name}`,error);
    }
}

exports.replanIncompletedJobs = async function (io) {
    try {
        defaultIo = io;
        // establised a connection to our mongoDB database.
        const agenda = new Agenda({
            db: {
                address: nconf.get('mongo'),
                options: { useUnifiedTopology: true },
            }
        });
        await agenda.start();
        const fakeRunningjobs = await agenda.jobs({
            lockedAt: { $exists: true },
            lastFinishedAt: { $exists: false }
        });
        for (let i = 0; i < fakeRunningjobs.length; i++) {
            const job = fakeRunningjobs[i];
            await createExportJob(job.attrs.data.query);
            await deleteJob(job);
        }
        triggerNextExportJob()
    } catch (error) {
        log.error('Failed to incompleted running jobs',error);
    }
};

const triggerNextExportJob =  async () =>{
    try{
        const maxJobAllowed =nconf.get('export:maxRunningJobs') || 1;
        // establised a connection to our mongoDB database.
        const agenda = new Agenda({
            db: {
                address: nconf.get('mongo'),
                options: { useUnifiedTopology: true },
            }
        });
        await agenda.start();
        //const runningJobs = await agenda.jobs({ lockedAt: { $exists: true }, lastRunAt: { $exists: true }, lastFinishedAt: { $exists: false } });
        const runningJobs = await agenda.jobs({
            lockedAt: { $exists: true },
            lastFinishedAt: { $exists: false }
        });
        const pendingJobs = await agenda.jobs({
            nextRunAt: { $exists: true },
            lastRunAt: { $exists: false }
        });

        const jobsNeeded = (maxJobAllowed - runningJobs.length);
        if (pendingJobs.length > 0 && jobsNeeded >0 && runningJobs.length < maxJobAllowed){
            for (let i = 0; i < jobsNeeded; i++) {
                const currentJob = pendingJobs[i];
                await deleteJob(currentJob);
                const data =currentJob.attrs.data.query
                data.pending=false;
                createExportJob(data, true);
                log.info(`Triggered  job ${currentJob.attrs.name}`);
            }
        }

        var io = app.io || defaultIo;
        io.sockets.emit('jobProgress', {
            reload: true,
        });
    } catch (err) {
        log.error(`Error in triggerNextExportJob:`, err);
    }
};


async function zipDirectory(options) {
    try{
        try{
            archiver.registerFormat('zip-encrypted', require("archiver-zip-encrypted"));
        } catch (er) {
        }
        const archive = options.pwd && options.pwd.length>0 ? archiver.create('zip-encrypted', {zlib: {level: 8}, encryptionMethod: 'aes256', password: options.pwd}) :
            archiver.create('zip', { zlib: { level: 8}}) ;
        const stream = fs.createWriteStream(options.zip);
        return new Promise((resolve, reject) => {
            archive
                .directory(options.dir, false)
                .on('error', err => reject(err))
                .pipe(stream)
            ;
            stream.on('close', () => resolve());
            archive.finalize();
        });
    } catch (err) {
        console.error(err);
        log.error('Error in zipDirectory:', err);
    }
}

function buildFields(language, file) {
    let fields = require("../../../resources/dictionary/export/" + file);
    let options = {fields: [], fieldNames: [], sections: {}};
    
    for (i = 0; i < fields.length; i++) {
        const section = fields[i].section || 'other';
        if (!options.sections[section]) {
            options.sections[section] = {
                fields: [],
                fieldNames: [],
                startIndex: options.fields.length
            };
        }
        
        const fieldName = ((language != "" && fields[i][language] != undefined && fields[i][language] != "") ? fields[i][language] : fields[i]['en']);
        options.fieldNames.push(fieldName);
        options.fields.push(fields[i].id);
        
        options.sections[section].fields.push(fields[i].id);
        options.sections[section].fieldNames.push(fieldName);
    }
    
    return options;
}

exports.exportToXLSX = async (options) => {
    return new Promise(async (resolve, reject) => {
        let skippedRows = 0;
        let exportedRows = 0;

        let workbook = new Excel.Workbook();
        let ws = workbook.addWorksheet('Admineex export');

        const alpha = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split('');
        const columns = options.fields.map((_, n) => {
            let letter = '';
            while (n >= 0) {
                letter = alpha[n % 26] + letter;
                n = Math.floor(n / 26) - 1;
            }
            return letter;
        });

        // Title
        ws.getCell('A1').value = options.title;
        ws.getCell('A1').font = { color: { argb: 'FFFFFF' }, size: 16, bold: true };
        ws.getCell('A1').alignment = { vertical: 'middle', horizontal: 'center' };
        ws.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE06B21' } };
        ws.getCell('A1').border = {
            top: { style: 'thick', color: { argb: 'FF964714' } },
            left: { style: 'thick', color: { argb: 'FF964714' } },
            bottom: { style: 'thick', color: { argb: 'FF964714' } }
        };

        ws.mergeCells(`A1:${columns[options.fieldNames.length - 1]}1`);

        // Header row
        options.fieldNames.forEach((name, i) => {
            const cell = ws.getCell(`${columns[i]}2`);
            cell.value = name;
            cell.font = { bold: true };
            cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE06B21' } };
            cell.border = {
                top: { style: 'thin', color: { argb: 'FF000000' } },
                bottom: { style: 'medium', color: { argb: 'FF000000' } },
                left: { style: 'thin', color: { argb: 'FF000000' } },
                right: { style: 'thin', color: { argb: 'FF000000' } }
            };
        });

        // Data rows
        let rowIndex = 3;
        for (let structure of options.data) {
            try {
                if (options.staffOnly !== false && options.staffOnly !== "false") {
                    ws.mergeCells(`A${rowIndex}:${columns[options.fieldNames.length - 1]}${rowIndex}`);
                    const cell = ws.getCell(`A${rowIndex}`);
                    cell.value = `${structure.name} - ${structure.code}`;
                    cell.font = { color: { argb: 'FFFFFF' }, size: 16, bold: true };
                    cell.alignment = { vertical: 'middle', horizontal: 'center' };
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE06B21' } };
                    cell.border = {
                        top: { style: 'thick', color: { argb: 'FF964714' } },
                        left: { style: 'thick', color: { argb: 'FF964714' } },
                        bottom: { style: 'thick', color: { argb: 'FF964714' } }
                    };
                    rowIndex++;
                }

                for (let child of structure.children || []) {
                    if (options.staffOnly !== false && options.staffOnly !== "false") {
                        ws.mergeCells(`A${rowIndex}:${columns[options.fieldNames.length - 1]}${rowIndex}`);
                        const cell = ws.getCell(`A${rowIndex}`);
                        cell.value = `${child.fr} - ${child.code}`;
                        cell.font = { color: { argb: 'FFFFFF' }, size: 16, bold: true };
                        cell.alignment = { vertical: 'middle', horizontal: 'center' };
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'A1a8a1a1' } };
                        cell.border = {
                            top: { style: 'thick', color: { argb: '96969696' } },
                            left: { style: 'thick', color: { argb: '96969696' } },
                            bottom: { style: 'thick', color: { argb: '96969696' } }
                        };
                        rowIndex++;
                    }

                    for (let person of child.personnels || []) {
                        try {
                            options.fields.forEach((fieldPath, colIndex) => {
                                let value = fieldPath.split('.').reduce((obj, key) => (obj && obj[key] !== undefined) ? obj[key] : '', person);
                                if (["testDate", "requestDate", "birthDate", "signatureDate", "positiveResultDate", "startdate", "cartridgeExpiryDate"].includes(fieldPath.split('.').pop())) {
                                    if (value) value = moment(value).format("DD/MM/YYYY");
                                }

                                const cell = ws.getCell(`${columns[colIndex]}${rowIndex}`);
                                cell.value = (value != null && value !== 'null') ? value : '';
                                cell.border = {
                                    left: { style: 'thin', color: { argb: 'FF000000' } },
                                    right: { style: 'thin', color: { argb: 'FF000000' } },
                                    bottom: { style: 'thin', color: { argb: 'FF000000' } }
                                };
                            });
                            exportedRows++;
                            rowIndex++;
                        } catch (err) {
                            skippedRows++;
                        }
                    }

                    rowIndex++;
                }
            } catch (err) {
                skippedRows++;
            }
        }

        // Column widths
        ws.columns.forEach((col, i) => {
            col.width = 30;
        });
        if (ws.columns[0]) ws.columns[0].width = 50;

        const tmpFile = `${options.xlsxPathNoExt}${keyGenerator.generateKey()}.xlsx`;
        if (!fs.existsSync('./tmp')) {
            fs.mkdirSync('./tmp');
        }

        await workbook.xlsx.writeFile(tmpFile);
        resolve({ exportedRows, skippedRows });
    });
};



function buildXLSX(options, callback) {
    let add = 0;
    let defaultCellStyle = {font: {name: "Calibri", sz: 11}, fill: {fgColor: {rgb: "FFFFAA00"}}};
    let alpha = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z"];
    let columns = [];
    let a = 0;
    // Generate fields

    for (n = 0; n < options.fields.length; n++) {
        if (n <= alpha.length * 1 - 1) {
            columns.push(alpha[a]);
        } else if (n <= alpha.length * 2 - 1) {
            columns.push(alpha[0] + alpha[a]);
        } else if (n <= alpha.length * 3 - 1) {
            columns.push(alpha[1] + alpha[a]);
        } else if (n <= alpha.length * 4 - 1) {
            columns.push(alpha[2] + alpha[a]);
        } else if (n <= alpha.length * 5 - 1) {
            columns.push(alpha[3] + alpha[a]);
        } else {
            columns.push(alpha[4] + alpha[a]);
        }
        a++;
        if (a > 25) {
            a = 0;
        }
    }

    // create workbook & add worksheet
    let workbook = new Excel.Workbook();
    //2. Start holding the work sheet
    let ws = workbook.addWorksheet('Admineex export');
    
    let metaWs = workbook.addWorksheet('Export Information');
    metaWs.getCell('A1').value = 'Export Information';
    metaWs.getCell('A1').font = { size: 14, bold: true };
    metaWs.getCell('A3').value = 'Export Date:';
    metaWs.getCell('B3').value = moment().format('DD/MM/YYYY HH:mm:ss');
    metaWs.getCell('A4').value = 'Total Records:';
    
    let totalPersonnel = 0;
    for (let i = 0; i < options.data.length; i++) {
        if (options.data[i].children) {
            for (let c = 0; c < options.data[i].children.length; c++) {
                if (options.data[i].children[c].personnels) {
                    totalPersonnel += options.data[i].children[c].personnels.length;
                }
            }
        }
    }
    metaWs.getCell('B4').value = totalPersonnel;
    
    metaWs.getColumn('A').width = 20;
    metaWs.getColumn('B').width = 40;

    //3. set style around A1
    ws.getCell('A1').value = options.title;
    ws.getCell('A1').border = {
        top: {style: 'thick', color: {argb: 'FF964714'}},
        left: {style: 'thick', color: {argb: 'FF964714'}},
        bottom: {style: 'thick', color: {argb: 'FF964714'}}
    };
    ws.getCell('A1').fill = {type: 'pattern', pattern: 'solid', fgColor: {argb: 'FFE06B21'}};
    ws.getCell('A1').font = {
        color: {argb: 'FFFFFF'},
        size: 16,
        bold: true
    };
    ws.getCell('A1').alignment = {vertical: 'middle', horizontal: 'center'};

    let currentCol = 0;
    const sectionColors = {
        'personal': 'FF4F81BD',    // Blue
        'address': 'FF9BBB59',     // Green
        'professional': 'FFC0504D', // Red
        'affectation': 'FF8064A2',  // Purple
        'administrative': 'FF4BACC6', // Teal
        'other': 'FFFF9900'        // Orange
    };
    
    const sectionNames = {
        'personal': 'Personal Information',
        'address': 'Address Information',
        'professional': 'Professional Information',
        'affectation': 'Affectation Information',
        'administrative': 'Administrative Information',
        'other': 'Other Information'
    };
    
    if (options.sections) {
        let row = 2;
        for (const section in options.sections) {
            if (options.sections[section].fields.length > 0) {
                const startCol = options.sections[section].startIndex;
                const endCol = startCol + options.sections[section].fields.length - 1;
                
                if (startCol < endCol) {
                    ws.mergeCells(`${columns[startCol]}${row}:${columns[endCol]}${row}`);
                }
                
                ws.getCell(`${columns[startCol]}${row}`).value = sectionNames[section] || section;
                ws.getCell(`${columns[startCol]}${row}`).fill = {
                    type: 'pattern', 
                    pattern: 'solid', 
                    fgColor: {argb: sectionColors[section] || 'FFFF9900'}
                };
                ws.getCell(`${columns[startCol]}${row}`).font = {
                    color: {argb: 'FFFFFF'},
                    bold: true
                };
                ws.getCell(`${columns[startCol]}${row}`).alignment = {
                    vertical: 'middle', 
                    horizontal: 'center'
                };
                
                for (let i = startCol; i <= endCol; i++) {
                    ws.getCell(`${columns[i]}${row}`).border = {
                        top: {style: 'thin', color: {argb: 'FF000000'}},
                        bottom: {style: 'thin', color: {argb: 'FF000000'}},
                        left: i === startCol ? {style: 'thin', color: {argb: 'FF000000'}} : undefined,
                        right: i === endCol ? {style: 'thin', color: {argb: 'FF000000'}} : undefined
                    };
                }
            }
        }
        row++;
        
        for (i = 0; i < options.fieldNames.length; i++) {
            ws.getCell(columns[i] + row).value = options.fieldNames[i];
            ws.getCell(columns[i] + row).alignment = {vertical: 'middle', horizontal: 'left', "wrapText": true};
            ws.getCell(columns[i] + row).border = {
                top: {style: 'thin', color: {argb: 'FF000000'}},
                bottom: {style: 'medium', color: {argb: 'FF000000'}},
                left: {style: 'thin', color: {argb: 'FF000000'}},
                right: {style: 'thin', color: {argb: 'FF000000'}}
            };
            
            for (const section in options.sections) {
                const startCol = options.sections[section].startIndex;
                const endCol = startCol + options.sections[section].fields.length - 1;
                if (i >= startCol && i <= endCol) {
                    ws.getCell(columns[i] + row).fill = {
                        type: 'pattern', 
                        pattern: 'solid', 
                        fgColor: {argb: sectionColors[section] + '33'} // Add transparency
                    };
                    break;
                }
            }
        }
    } else {
        for (i = 0; i < options.fieldNames.length; i++) {
            ws.getCell(columns[i] + "2").value = options.fieldNames[i];
            ws.getCell(columns[i] + "2").alignment = {vertical: 'middle', horizontal: 'left', "wrapText": true};
            ws.getCell(columns[i] + "2").border = {
                top: {style: 'thin', color: {argb: 'FF000000'}},
                bottom: {style: 'medium', color: {argb: 'FF000000'}},
                left: {style: 'thin', color: {argb: 'FF000000'}},
                right: {style: 'thin', color: {argb: 'FF000000'}}
            };
        }
    }

    //6. Fill data rows
    let nextRow = options.sections ? 4 : 3;
    
    for (i = 0; i < options.data.length; i++) {
        if ((options.staffOnly != false && options.staffOnly != "false")) {
            //6.1 Row set the style for structure header
            ws.getCell('A' + nextRow).value = options.data[i].name + " - " + options.data[i].code;
            ws.getCell('A' + nextRow).border = {
                top: {style: 'thick', color: {argb: 'FF964714'}},
                left: {style: 'thick', color: {argb: 'FF964714'}},
                bottom: {style: 'thick', color: {argb: 'FF964714'}}
            };
            ws.getCell('A' + nextRow).fill = {type: 'pattern', pattern: 'solid', fgColor: {argb: 'FFE06B21'}};
            ws.getCell('A' + nextRow).font = {
                color: {argb: 'FFFFFF'},
                size: 16,
                bold: true
            };
            ws.getCell('A' + nextRow).alignment = {vertical: 'middle', horizontal: 'center'};
            for (r = 1; r < options.fieldNames.length; r++) {
                // For the last column, add right border
                if (r == options.fieldNames.length - 1) {
                    ws.getCell(columns[r] + nextRow).border = {
                        top: {style: 'thick', color: {argb: 'FF964714'}},
                        right: {style: 'medium', color: {argb: 'FF964714'}},
                        bottom: {style: 'thick', color: {argb: 'FF964714'}}
                    };
                } else {//Set this border for the middle cells
                    ws.getCell(columns[r] + nextRow).border = {
                        top: {style: 'thick', color: {argb: 'FF964714'}},
                        bottom: {style: 'thick', color: {argb: 'FF964714'}}
                    };
                }
                ws.getCell(columns[r] + nextRow).fill = {type: 'pattern', pattern: 'solid', fgColor: {argb: 'FFE06B21'}};
                ws.getCell(columns[r] + nextRow).alignment = {vertical: 'middle', horizontal: 'center', "wrapText": true};
            }
            /// 6.3 Merges Structure name cells
            ws.mergeCells('A' + nextRow + ":" + columns[options.fieldNames.length - 1] + nextRow);
        } else {
            if (options.sections) {
                nextRow = 4; // Start after section headers and field names
            } else {
                nextRow = 3; // Start after field names only
            }
            nextRow = nextRow - 1;
        }

        if (options.data[i].children) {
            if ((options.staffOnly != false && options.staffOnly != "false")) {
                nextRow = nextRow + 1;
            }

            /// 6.4 fill data
            for (c = 0; c < options.data[i].children.length; c++) {

                if ((options.staffOnly !== false && options.staffOnly !== "false")) {
                    //6.4.1 Row 3 set the style
                    ws.getCell('A' + nextRow).value = options.data[i].children[c].fr + " - " + options.data[i].children[c].code;
                    ws.getCell('A' + nextRow).border = {
                        top: {style: 'thick', color: {argb: '96969696'}},
                        left: {style: 'thick', color: {argb: '96969696'}},
                        bottom: {style: 'thick', color: {argb: '96969696'}}
                    };
                    ws.getCell('A' + nextRow).fill = {type: 'pattern', pattern: 'solid', fgColor: {argb: 'A1a8a1a1'}};
                    ws.getCell('A' + nextRow).font = {
                        color: {argb: 'FFFFFF'},
                        size: 16,
                        bold: true
                    };
                    ws.getCell('A' + nextRow).alignment = {vertical: 'middle', horizontal: 'center'};
                    //6.4.2 Row 3 set the length
                    for (r = 1; r < options.fieldNames.length; r++) {
                        // For the last column, add right border
                        if (r == options.fieldNames.length - 1) {
                            ws.getCell(columns[r] + nextRow).border = {
                                top: {style: 'thick', color: {argb: '96969696'}},
                                right: {style: 'medium', color: {argb: '96969696'}},
                                bottom: {style: 'thick', color: {argb: '96969696'}}
                            };
                        } else {//Set this border for the middle cells
                            ws.getCell(columns[r] + nextRow).border = {
                                top: {style: 'thick', color: {argb: '96969696'}},
                                bottom: {style: 'thick', color: {argb: '96969696'}}
                            };
                        }
                        ws.getCell(columns[r] + nextRow).fill = {type: 'pattern', pattern: 'solid', fgColor: {argb: 'A1a8a1a1'}};
                        ws.getCell(columns[r] + nextRow).alignment = {vertical: 'middle', horizontal: 'left', "wrapText": true};
                    }
                    /// 6.4.3 Merges Structure name cells
                    ws.mergeCells('A' + nextRow + ":" + columns[options.fieldNames.length - 1] + nextRow);
                } else {
                    nextRow = nextRow - 1;
                }

                if (options.data[i].children[c].personnels) {


                    for (k = 0; k < options.data[i].children[c].personnels.length; k++) {

                        for (j = 0; j < options.fields.length; j++) {
                            let query = options.fields[j].split(".");
                            let value, field;

                            if (query.length == 1) {
                                value = options.data[i].children[c].personnels[k][query[0]] || "";
                                field = query[0];
                            } else if (query.length == 2) {
                                if (options.data[i].children[c].personnels[k][query[0]]) {
                                    value = options.data[i].children[c].personnels[k][query[0]][query[1]] || "";
                                } else {
                                    value = "";
                                }
                                field = query[1];
                            } else if (query.length == 3) {
                                if (options.data[i].children[c].personnels[k][query[0]] && options.data[i].children[c].personnels[k][query[0]][query[1]]) {
                                    value = options.data[i].children[c].personnels[k][query[0]][query[1]][query[2]] || "";
                                } else {
                                    value = "";
                                }
                                field = query[2];
                            } else if (query.length == 4) {
                                if (options.data[i].children[c].personnels[k][query[0]] && options.data[i].children[c].personnels[k][query[0]][query[1]] && options.data[i].children[c].personnels[k][query[0]][query[1]][query[2]]) {
                                    value = options.data[i].children[c].personnels[k][query[0]][query[1]][query[2]][query[3]] || "";
                                } else {
                                    value = "";
                                }
                                field = query[2];
                            }

                            if ((field == "testDate" || field == "requestDate" || field == "birthDate" || field == "signatureDate" || field == "positiveResultDate" || field == "startdate" || field == "cartridgeExpiryDate") && value != undefined && value != "" && value != null && value != "null") {
                                value = moment(value).format("DD/MM/YYYY");
                            }

                            ws.getCell(columns[j] + (nextRow + 1 + add)).value = (value != undefined && value != null && value != "null") ? value : "";
                            ws.getCell(columns[j] + (nextRow + 1 + add)).border = {
                                left: {style: 'thin', color: {argb: 'FF000000'}},
                                right: {style: 'thin', color: {argb: 'FF000000'}}
                            };

                            // Last row: Add border
                            if (i == options.data.length - 1) {
                                ws.getCell(columns[j] + (nextRow + 1 + add)).border.bottom = {style: 'thin', color: {argb: 'FF000000'}};
                            }
                        }
                        nextRow += 1;
                    }
                }
                nextRow += 1;
            }
            nextRow += 1;
        }
    }

    ///7. Set the columns width to 12
    for (k = 0; k < ws.columns.length; k++) {
        ws.columns[k].width = 30;
    }
    ws.columns[0].width = 50;
    ws.columns[1].width = 12;
    ws.columns[2].width = 12;
    ws.columns[3].width = 12;
    ws.columns[4].width = 30;
    ws.columns[5].width = 30;
    ws.columns[6].width = 30;
    ws.columns[14].width = 50;
    ws.columns[15].width = 30;
    ws.columns[15].width = 30;
    ws.columns[16].width = 50;
    ws.columns[19].width = 15;

    ///7. Merges cells
    ws.mergeCells('A1:' + columns[options.fieldNames.length - 1] + "1");


    // save workbook to disk
    let tmpFile = "./tmp/" + keyGenerator.generateKey() + ".xlsx";
    if (!fs.existsSync("./tmp")) {
        fs.mkdirSync("./tmp");
    }
    workbook.xlsx.writeFile(tmpFile).then(function () {
        callback(null, tmpFile);
    });
}

function buildXLSX2(options, callback) {
    let add = 0;
    let defaultCellStyle = {font: {name: "Calibri", sz: 11}, fill: {fgColor: {rgb: "FFFFAA00"}}};
    let alpha = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z"];
    let columns = [];
    let a = 0;
    // Generate fields

    for (n = 0; n < options.fields.length; n++) {
        if (n <= alpha.length * 1 - 1) {
            columns.push(alpha[a]);
        } else if (n <= alpha.length * 2 - 1) {
            columns.push(alpha[0] + alpha[a]);
        } else if (n <= alpha.length * 3 - 1) {
            columns.push(alpha[1] + alpha[a]);
        } else if (n <= alpha.length * 4 - 1) {
            columns.push(alpha[2] + alpha[a]);
        } else if (n <= alpha.length * 5 - 1) {
            columns.push(alpha[3] + alpha[a]);
        } else {
            columns.push(alpha[4] + alpha[a]);
        }
        a++;
        if (a > 25) {
            a = 0;
        }
    }

    // create workbook & add worksheet
    let workbook = new Excel.Workbook();
    //2. Start holding the work sheet
    let ws = workbook.addWorksheet('Admineex report');

    //3. set style around A1
    ws.getCell('A1').value = options.title;
    ws.getCell('A1').border = {
        top: {style: 'thick', color: {argb: 'FF964714'}},
        left: {style: 'thick', color: {argb: 'FF964714'}},
        bottom: {style: 'thick', color: {argb: 'FF964714'}}
    };
    ws.getCell('A1').fill = {type: 'pattern', pattern: 'solid', fgColor: {argb: 'FFE06B21'}};
    ws.getCell('A1').font = {
        color: {argb: 'FFFFFF'},
        size: 16,
        bold: true
    };
    ws.getCell('A1').alignment = {vertical: 'middle', horizontal: 'center'};


    //4. Row 1
    for (i = 1; i < options.fieldNames.length; i++) {
        // For the last column, add right border
        if (i == options.fieldNames.length - 1) {
            ws.getCell(columns[i] + "1").border = {
                top: {style: 'thick', color: {argb: 'FF964714'}},
                right: {style: 'medium', color: {argb: 'FF964714'}},
                bottom: {style: 'thick', color: {argb: 'FF964714'}}
            };
        } else {//Set this border for the middle cells
            ws.getCell(columns[i] + "1").border = {
                top: {style: 'thick', color: {argb: 'FF964714'}},
                bottom: {style: 'thick', color: {argb: 'FF964714'}}
            };
        }
        ws.getCell(columns[i] + "1").fill = {type: 'pattern', pattern: 'solid', fgColor: {argb: 'FFE06B21'}};
        ws.getCell(columns[i] + "1").alignment = {vertical: 'middle', horizontal: 'center', "wrapText": true};
    }

    //5 Row 2
    for (i = 0; i < options.fieldNames.length; i++) {
        ws.getCell(columns[i] + "2").value = options.fieldNames[i];
        ws.getCell(columns[i] + "2").alignment = {vertical: 'middle', horizontal: 'left', "wrapText": true};
        ws.getCell(columns[i] + "2").border = {
            top: {style: 'thin', color: {argb: 'FF000000'}},
            bottom: {style: 'medium', color: {argb: 'FF000000'}},
            left: {style: 'thin', color: {argb: 'FF000000'}},
            right: {style: 'thin', color: {argb: 'FF000000'}}
        };
    }

    //6. Fill data rows
    for (i = 0; i < options.data.length; i++) {
        for (j = 0; j < options.fields.length; j++) {
            let query = options.fields[j].split(".");
            let value, field;
            if (query.length == 1) {
                value = options.data[i][query[0]] == undefined ? "" : options.data[i][query[0]];
                field = query[0];
            } else if (query.length == 2) {
                if (options.data[i][query[0]]) {
                    value = options.data[i][query[0]][query[1]] == undefined ? "" : options.data[i][query[0]][query[1]];
                } else {
                    value = "";
                }
                field = query[1];
            } else if (query.length == 3) {
                if (options.data[i][query[0]] && options.data[i][query[0]][query[1]]) {
                    value = options.data[i][query[0]][query[1]][query[2]] == undefined ? "" : options.data[i][query[0]][query[1]][query[2]];
                } else {
                    value = "";
                }
                field = query[2];
            }

            if ((field == "testDate" || field == "requestDate" || field == "birthDate" || field == "positiveResultDate" || field == "startdate" || field == "cartridgeExpiryDate" || field == "dateBeginningSymptom") && value != undefined && value != "" && value != null && value != "null") {
                value = moment(value).format("DD/MM/YYYY");
            }

            ws.getCell(columns[j] + (i + 3 + add)).value = (value != undefined && value != null && value != "null") ? value : "";
            ws.getCell(columns[j] + (i + 3 + add)).border = {
                left: {style: 'thin', color: {argb: 'FF000000'}},
                right: {style: 'thin', color: {argb: 'FF000000'}}
            };

            // Last row: Add border
            if (i == options.data.length - 1) {
                ws.getCell(columns[j] + (i + 3 + add)).border.bottom = {style: 'thin', color: {argb: 'FF000000'}};
            }
        }
    }

    ///7. Set the columns width to 12
    for (k = 0; k < ws.columns.length; k++) {
        ws.columns[k].width = 12;
    }

    ///7. Merges cells
    ws.mergeCells('A1:' + columns[options.fieldNames.length - 1] + "1");
    ws.columns[0].width = 50;
    ws.columns[1].width = 52;
    ws.columns[2].width = 12;
    ws.columns[3].width = 50;

    // save workbook to disk
    let tmpFile = "./tmp/" + keyGenerator.generateKey() + ".xlsx";
    if (!fs.existsSync("./tmp")) {
        fs.mkdirSync("./tmp");
    }
    workbook.xlsx.writeFile(tmpFile).then(function () {
        callback(null, tmpFile);
    });
}

exports.buildXLSX = buildXLSX;
exports.buildXLSX2 = buildXLSX2;
