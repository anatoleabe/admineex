var AuditLog = require('../../models/auditLog').AuditLog;
var audit = require('../../../modules/audit-log');
var log = require('../../utils/log');
var moment = require('moment');
var _ = require('lodash');
var excel = require('excel4node');
var fs = require('fs');
var path = require('path');

var controllers = {
    users: require('../users')
};

exports.api = {};

/**
 * List bonus audit logs with filtering
 * Filters: startDate, endDate, entityType, action, userId, page, limit
 */
exports.api.list = function(req, res) {
    if (req.actor) {
        var page = parseInt(req.query.page) || 1;
        var limit = parseInt(req.query.limit) || 20;
        var skip = (page - 1) * limit;
        
        var query = {
            origin: { $in: ['bonus.template', 'bonus.instance', 'bonus.allocation'] }
        };
        
        if (req.query.startDate && req.query.endDate) {
            query.date = {
                $gte: moment(new Date(req.query.startDate)).startOf('day').toDate(),
                $lte: moment(new Date(req.query.endDate)).endOf('day').toDate()
            };
        }
        
        if (req.query.entityType) {
            switch (req.query.entityType) {
                case 'template':
                    query.origin = 'bonus.template';
                    break;
                case 'instance':
                    query.origin = 'bonus.instance';
                    break;
                case 'allocation':
                    query.origin = 'bonus.allocation';
                    break;
            }
        }
        
        if (req.query.action) {
            query.action = req.query.action;
        }
        
        if (req.query.userId) {
            query.actor = req.query.userId;
        }
        
        AuditLog.countDocuments(query, function(err, count) {
            if (err) {
                log.error(err);
                audit.logEvent('[mongodb]', 'Bonus Audit', 'List', '', '', 'failed', 'Mongodb attempted to count audit logs');
                return res.status(500).send(err);
            }
            
            AuditLog.find(query)
                .sort({ date: -1 })
                .skip(skip)
                .limit(limit)
                .lean()
                .exec(function(err, logs) {
                    if (err) {
                        log.error(err);
                        audit.logEvent('[mongodb]', 'Bonus Audit', 'List', '', '', 'failed', 'Mongodb attempted to retrieve audit logs');
                        return res.status(500).send(err);
                    }
                    
                    processLogs(logs, function(processedLogs) {
                        return res.json({
                            logs: processedLogs,
                            total: count,
                            page: page,
                            pages: Math.ceil(count / limit)
                        });
                    });
                });
        });
    } else {
        audit.logEvent('[anonymous]', 'Bonus Audit', 'List', '', '', 'failed', 'The user was not authenticated');
        return res.sendStatus(401);
    }
};

/**
 * Export bonus audit logs to Excel
 */
exports.api.export = function(req, res) {
    if (req.actor) {
        var query = {
            origin: { $in: ['bonus.template', 'bonus.instance', 'bonus.allocation'] }
        };
        
        if (req.query.startDate && req.query.endDate) {
            query.date = {
                $gte: moment(new Date(req.query.startDate)).startOf('day').toDate(),
                $lte: moment(new Date(req.query.endDate)).endOf('day').toDate()
            };
        }
        
        if (req.query.entityType) {
            switch (req.query.entityType) {
                case 'template':
                    query.origin = 'bonus.template';
                    break;
                case 'instance':
                    query.origin = 'bonus.instance';
                    break;
                case 'allocation':
                    query.origin = 'bonus.allocation';
                    break;
            }
        }
        
        if (req.query.action) {
            query.action = req.query.action;
        }
        
        if (req.query.userId) {
            query.actor = req.query.userId;
        }
        
        AuditLog.find(query)
            .sort({ date: -1 })
            .lean()
            .exec(function(err, logs) {
                if (err) {
                    log.error(err);
                    audit.logEvent('[mongodb]', 'Bonus Audit', 'Export', '', '', 'failed', 'Mongodb attempted to retrieve audit logs for export');
                    return res.status(500).send(err);
                }
                
                processLogs(logs, function(processedLogs) {
                    var wb = new excel.Workbook();
                    var ws = wb.addWorksheet('Audit Logs');
                    
                    var headerStyle = wb.createStyle({
                        font: {
                            bold: true,
                            color: '#FFFFFF'
                        },
                        fill: {
                            type: 'pattern',
                            patternType: 'solid',
                            fgColor: '#4472C4'
                        }
                    });
                    
                    ws.cell(1, 1).string('Date').style(headerStyle);
                    ws.cell(1, 2).string('Utilisateur').style(headerStyle);
                    ws.cell(1, 3).string('Type d\'entité').style(headerStyle);
                    ws.cell(1, 4).string('Action').style(headerStyle);
                    ws.cell(1, 5).string('Entité').style(headerStyle);
                    ws.cell(1, 6).string('Statut').style(headerStyle);
                    ws.cell(1, 7).string('Description').style(headerStyle);
                    
                    processedLogs.forEach(function(log, index) {
                        var row = index + 2;
                        
                        ws.cell(row, 1).date(new Date(log.date));
                        ws.cell(row, 2).string(log.actorName || log.actor || 'Système');
                        
                        var entityType = '';
                        if (log.origin === 'bonus.template') {
                            entityType = 'Modèle de prime';
                        } else if (log.origin === 'bonus.instance') {
                            entityType = 'Instance de prime';
                        } else if (log.origin === 'bonus.allocation') {
                            entityType = 'Allocation de prime';
                        }
                        ws.cell(row, 3).string(entityType);
                        
                        ws.cell(row, 4).string(log.action || '');
                        ws.cell(row, 5).string(log.label || '');
                        ws.cell(row, 6).string(log.status || '');
                        ws.cell(row, 7).string(log.description || '');
                    });
                    
                    for (var i = 1; i <= 7; i++) {
                        ws.column(i).setWidth(20);
                    }
                    
                    var tempFilePath = path.join(__dirname, '../../../temp', 'audit_logs_' + moment().format('YYYYMMDD_HHmmss') + '.xlsx');
                    
                    wb.write(tempFilePath, function(err, stats) {
                        if (err) {
                            log.error(err);
                            audit.logEvent('[excel]', 'Bonus Audit', 'Export', '', '', 'failed', 'Failed to generate Excel file');
                            return res.status(500).send(err);
                        }
                        
                        var fileName = 'audit_logs_' + moment().format('YYYY-MM-DD') + '.xlsx';
                        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
                        res.setHeader('Content-Disposition', 'attachment; filename=' + fileName);
                        
                        var filestream = fs.createReadStream(tempFilePath);
                        filestream.pipe(res);
                        
                        audit.logEvent(req.actor.id, 'Bonus Audit', 'Export', '', '', 'succeed', 'User exported audit logs');
                        
                        filestream.on('end', function() {
                            fs.unlink(tempFilePath, function(err) {
                                if (err) {
                                    log.error('Failed to delete temp file: ' + tempFilePath);
                                }
                            });
                        });
                    });
                });
            });
    } else {
        audit.logEvent('[anonymous]', 'Bonus Audit', 'Export', '', '', 'failed', 'The user was not authenticated');
        return res.sendStatus(401);
    }
};

/**
 * Process logs to add user information
 */
function processLogs(logs, callback) {
    var processedLogs = [];
    var userCache = {};
    
    function processLog(index) {
        if (index >= logs.length) {
            callback(processedLogs);
            return;
        }
        
        var log = logs[index];
        processedLogs.push(log);
        
        if (log.actor && log.actor.substr(0, 1) !== '[') {
            if (userCache[log.actor]) {
                log.actorName = userCache[log.actor];
                processLog(index + 1);
            } else {
                controllers.users.getUser({ id: log.actor }, '1', function(err, user) {
                    if (user) {
                        log.actorName = user.firstname + ' ' + user.lastname.toUpperCase();
                        userCache[log.actor] = log.actorName;
                    }
                    processLog(index + 1);
                });
            }
        } else {
            processLog(index + 1);
        }
    }
    
    processLog(0);
}

/**
 * Log bonus template events
 */
exports.logTemplateEvent = function(actor, action, templateId, templateName, status, description, changes) {
    var eventData = {
        actor: actor,
        origin: 'bonus.template',
        action: action,
        label: templateName || templateId,
        object: templateId,
        status: status || 'succeed',
        description: description
    };
    
    if (changes) {
        eventData.changes = changes;
    }
    
    audit.log(eventData);
};

/**
 * Log bonus instance events
 */
exports.logInstanceEvent = function(actor, action, instanceId, instanceName, status, description, changes) {
    var eventData = {
        actor: actor,
        origin: 'bonus.instance',
        action: action,
        label: instanceName || instanceId,
        object: instanceId,
        status: status || 'succeed',
        description: description
    };
    
    if (changes) {
        eventData.changes = changes;
    }
    
    audit.log(eventData);
};

/**
 * Log bonus allocation events
 */
exports.logAllocationEvent = function(actor, action, allocationId, personnelName, status, description, changes) {
    var eventData = {
        actor: actor,
        origin: 'bonus.allocation',
        action: action,
        label: personnelName || allocationId,
        object: allocationId,
        status: status || 'succeed',
        description: description
    };
    
    if (changes) {
        eventData.changes = changes;
    }
    
    audit.log(eventData);
};
