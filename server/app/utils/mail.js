var fs = require('fs');
var log = require('../utils/log');
var nodemailer = require('nodemailer');

// Controllers
var controllers = {
    configuration: require('../controllers/configuration.js')
};

exports.sendMail = function (mail, callback) {
    var mailerConfig = controllers.configuration.getConf().mailer;
    var server = controllers.configuration.getConf().server;
    var template = findTemplate(mail.language, mail.template);
    replaceInFile(template, mail.holes, function (err, result) {
        if (err) {
            log.error(err);
            callback(err);
        } else {
            var smtpTransport = nodemailer.createTransport({
                name: server.name,
                host: mailerConfig.host,
                port: mailerConfig.port,
                secure: true,
                auth: {
                    user: mailerConfig.auth.user,
                    pass: mailerConfig.auth.pass
                },
                debug: false,
                logger: false,
                tls: {
                    // do not fail on invalid certs
                    rejectUnauthorized: false
                }
            });

            var mailOptions = {
                to: mail.to,
                from: mailerConfig.sender.name + ' <' + mailerConfig.sender.address + '>',
                subject: mail.subject,
                html: result
            };
            if (mail.attachments) {
                mailOptions.attachments = mail.attachments;
            }
            smtpTransport.sendMail(mailOptions, function (err) {
                if (err) {
                    log.error(err);
                    callback(err);
                } else {
                    callback(null);
                }
            });
        }
    });
};

exports.sendAllInOneMail = function (mail, callback) {
    var mailerConfig = controllers.configuration.getConf().mailer;
    var server = controllers.configuration.getConf().server;
    var template = findTemplate(mail.language, mail.template);
    var middleTemplate = findTemplate(mail.language, mail.middleTemplate);

    replaceInFile(template, mail.holes, function (err, result) {
        if (err) {
            log.error(err);
            callback(err);
        } else {

            var middleData = "";
            //Loop middleHoles
            function appendLoop(a) {
                if (a < mail.middleHoles.length) {
                    holes = mail.middleHoles[a];
                    fs.readFile(middleTemplate, 'utf8', function (err, data) {
                        if (err) {
                            log.error(err);
                            callback(err);
                        } else {
                            replaceInData(data, holes, function (err, middleResult) {
                                if (err) {
                                    log.error(err);
                                    callback(err);
                                } else {
                                    middleData = middleData + middleResult;
                                    appendLoop(a + 1);
                                }
                            });
                        }
                    });

                } else {
                    replaceInData(result, [['[middle_data]', middleData]], function (err, finalResult) {
                        if (err) {
                            log.error(err);
                            callback(err);
                        } else {
                            var smtpTransport = nodemailer.createTransport({
                                name: server.name,
                                host: mailerConfig.host,
                                port: mailerConfig.port,
                                secure: true,
                                auth: {
                                    user: mailerConfig.auth.user,
                                    pass: mailerConfig.auth.pass
                                },
                                debug: false,
                                logger: false
                            });

                            var mailOptions = {
                                to: mail.to,
                                from: mailerConfig.sender.name + ' <' + mailerConfig.sender.address + '>',
                                subject: mail.subject,
                                html: finalResult
                            };

                            if (mail.attachments) {
                                mailOptions.attachments = mail.attachments;
                            }

                            smtpTransport.sendMail(mailOptions, function (err) {
                                if (err) {
                                    log.error(err);
                                    callback(err);
                                } else {
                                    callback(null);
                                }
                            });
                        }
                    });

                }
            }
            appendLoop(0);

        }
    });
};




function findTemplate(language, file) {
    var template = './resources/emails/en/' + file + ".html";
    if (fs.existsSync('./resources/emails/' + language + '/' + file + ".html")) {
        template = './resources/emails/' + language + '/' + file + ".html";
    }
    return template;
}

function escapeRegExp(string) {
    return string.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1");
}

function replaceAll(string, find, replace) {
    return string.replace(new RegExp(escapeRegExp(find), 'g'), replace);
}

function replaceInFile(file, toReplace, callback) {
    fs.readFile(file, 'utf8', function (err, data) {
        if (err) {
            log.error(err);
            callback(err);
        }
        for (var i = 0; i < toReplace.length; i++) {
            for (var j = 0; j < toReplace[i].length - 1; j++) {
                data = replaceAll(data, toReplace[i][j], toReplace[i][j + 1]);
            }
        }
        callback(null, data);
    });
}
;

function replaceInData(data, toReplace, callback) {
    for (var i = 0; i < toReplace.length; i++) {
        for (var j = 0; j < toReplace[i].length - 1; j++) {
            data = replaceAll(data, toReplace[i][j], toReplace[i][j + 1]);
        }
    }
    callback(null, data);
}
;


