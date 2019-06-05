var audit = require('../utils/audit-log');
var log = require('../utils/log');
var moment = require('moment');
var _ = require('underscore');
var fs = require("fs");
var pdf = require('dynamic-html-pdf');
var html = fs.readFileSync('resources/pdf/pdf2.html', 'utf8');
var keyGenerator = require("generate-key");


var controllers = {
    users: require('./users'),
    projects: require('./projects'),
    configuration: require('./configuration')
};

// API
exports.api = {};


exports.api.pdf1 = function (req, res) {
    // Custom handlebar helper
    pdf.registerHelper('ifCond', function (v1, v2, options) {
        if (v1 === v2) {
            return options.fn(this);
        }
        return options.inverse(this);
    })

    var options = {
        format: "A3",
        orientation: "portrait",
        border: "10mm"
    };

    var users = [
        {
            name: 'aaa',
            age: 24,
            dob: '1/1/1991'
        },
        {
            name: 'bbb',
            age: 25,
            dob: '1/1/1995'
        },
        {
            name: 'ccc',
            age: 24,
            dob: '1/1/1994'
        }
    ];

    var tmpFile = "./tmp/" + keyGenerator.generateKey() + ".pdf";
    if (!fs.existsSync("./tmp")) {
        fs.mkdirSync("./tmp");
    }

    var document = {
        type: 'file', // 'file' or 'buffer'
        template: html,
        context: {
            users: users
        },
        path: tmpFile    // it is not required if type is buffer
    };

    pdf.create(document, options, res).then(res1 => {

        var fileName = 'report.pdf';
        res.set('Content-disposition', 'attachment; filename=' + fileName);
        res.set('Content-Type', 'application/pdf');
        res.download(tmpFile, fileName, function (err) {
            if (err) {
                log.error(err);
                return res.status(500).send(err);
            } else {
                fs.unlink(tmpFile, function (err) {
                    if (err) {
                        log.error(err);
                        audit.logEvent('[fs]', 'Reports', 'Download', "Spreadsheet", tmpFile, 'failed', 'FS attempted to delete this temp file');
                    }
                });
            }
        });
    }).catch(error => {
        console.error(error)
    });

};

