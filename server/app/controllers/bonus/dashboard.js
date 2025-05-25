var BonusInstance = require('../../models/bonus/instance').BonusInstance;
var BonusAllocation = require('../../models/bonus/allocation').BonusAllocation;
var BonusTemplate = require('../../models/bonus/template').BonusTemplate;
var Structure = require('../../models/structure').Structure;
var Personnel = require('../../models/personnel').Personnel;
var audit = require('../../../modules/audit-log');
var log = require('../../utils/log');
var moment = require('moment');
var _ = require('lodash');
var PDFDocument = require('pdfkit');
var fs = require('fs');
var path = require('path');

exports.api = {};

/**
 * Get dashboard statistics
 * Filters: startDate, endDate, structureId, templateId
 */
exports.api.getStats = function(req, res) {
    if (req.actor) {
        var query = {};
        
        if (req.query.startDate && req.query.endDate) {
            query.createdAt = {
                $gte: moment(new Date(req.query.startDate)).startOf('day').toDate(),
                $lte: moment(new Date(req.query.endDate)).endOf('day').toDate()
            };
        }
        
        if (req.query.structureId) {
            query['allocations.structure'] = req.query.structureId;
        }
        
        if (req.query.templateId) {
            query.template = req.query.templateId;
        }
        
        BonusInstance.find(query)
            .populate('template')
            .populate('allocations.personnel')
            .populate('allocations.structure')
            .lean()
            .exec(function(err, instances) {
                if (err) {
                    log.error(err);
                    audit.logEvent('[mongodb]', 'Bonus Dashboard', 'GetStats', '', '', 'failed', 'Mongodb attempted to retrieve bonus instances');
                    return res.status(500).send(err);
                }
                
                var stats = processInstanceStats(instances);
                
                audit.logEvent(req.actor.id, 'Bonus Dashboard', 'GetStats', '', '', 'succeed', 'User retrieved dashboard statistics');
                
                return res.json(stats);
            });
    } else {
        audit.logEvent('[anonymous]', 'Bonus Dashboard', 'GetStats', '', '', 'failed', 'The user was not authenticated');
        return res.sendStatus(401);
    }
};

/**
 * Export dashboard statistics as PDF
 */
exports.api.export = function(req, res) {
    if (req.actor) {
        var query = {};
        
        if (req.query.startDate && req.query.endDate) {
            query.createdAt = {
                $gte: moment(new Date(req.query.startDate)).startOf('day').toDate(),
                $lte: moment(new Date(req.query.endDate)).endOf('day').toDate()
            };
        }
        
        if (req.query.structureId) {
            query['allocations.structure'] = req.query.structureId;
        }
        
        if (req.query.templateId) {
            query.template = req.query.templateId;
        }
        
        BonusInstance.find(query)
            .populate('template')
            .populate('allocations.personnel')
            .populate('allocations.structure')
            .lean()
            .exec(function(err, instances) {
                if (err) {
                    log.error(err);
                    audit.logEvent('[mongodb]', 'Bonus Dashboard', 'Export', '', '', 'failed', 'Mongodb attempted to retrieve bonus instances for export');
                    return res.status(500).send(err);
                }
                
                var stats = processInstanceStats(instances);
                
                var tempFilePath = path.join(__dirname, '../../../temp', 'dashboard_' + moment().format('YYYYMMDD_HHmmss') + '.pdf');
                
                generateDashboardPDF(stats, tempFilePath, function(err) {
                    if (err) {
                        log.error(err);
                        audit.logEvent('[pdf]', 'Bonus Dashboard', 'Export', '', '', 'failed', 'Failed to generate PDF report');
                        return res.status(500).send(err);
                    }
                    
                    var fileName = 'tableau_de_bord_primes_' + moment().format('YYYY-MM-DD') + '.pdf';
                    res.setHeader('Content-Type', 'application/pdf');
                    res.setHeader('Content-Disposition', 'attachment; filename=' + fileName);
                    
                    var filestream = fs.createReadStream(tempFilePath);
                    filestream.pipe(res);
                    
                    audit.logEvent(req.actor.id, 'Bonus Dashboard', 'Export', '', '', 'succeed', 'User exported dashboard statistics');
                    
                    filestream.on('end', function() {
                        fs.unlink(tempFilePath, function(err) {
                            if (err) {
                                log.error('Failed to delete temp file: ' + tempFilePath);
                            }
                        });
                    });
                });
            });
    } else {
        audit.logEvent('[anonymous]', 'Bonus Dashboard', 'Export', '', '', 'failed', 'The user was not authenticated');
        return res.sendStatus(401);
    }
};

/**
 * Process instances to get statistics
 */
function processInstanceStats(instances) {
    var stats = {
        summary: {
            totalAmount: 0,
            instanceCount: instances.length,
            beneficiaryCount: 0,
            averageAmount: 0
        },
        byStructure: [],
        byTemplate: [],
        byPeriod: [],
        byStatus: [],
        topBeneficiaries: []
    };
    
    var structureMap = {};
    var templateMap = {};
    var periodMap = {};
    var statusMap = {
        draft: { status: 'draft', count: 0, totalAmount: 0 },
        pending: { status: 'pending', count: 0, totalAmount: 0 },
        approved: { status: 'approved', count: 0, totalAmount: 0 },
        rejected: { status: 'rejected', count: 0, totalAmount: 0 }
    };
    var beneficiaryMap = {};
    
    instances.forEach(function(instance) {
        var instanceAmount = 0;
        var instanceBeneficiaries = 0;
        
        if (instance.allocations && instance.allocations.length > 0) {
            instance.allocations.forEach(function(allocation) {
                if (allocation.amount) {
                    instanceAmount += allocation.amount;
                    instanceBeneficiaries++;
                    
                    if (allocation.structure) {
                        var structureId = allocation.structure._id || allocation.structure;
                        if (!structureMap[structureId]) {
                            structureMap[structureId] = {
                                structure: allocation.structure,
                                count: 0,
                                totalAmount: 0
                            };
                        }
                        structureMap[structureId].count++;
                        structureMap[structureId].totalAmount += allocation.amount;
                    }
                    
                    if (allocation.personnel) {
                        var personnelId = allocation.personnel._id || allocation.personnel;
                        if (!beneficiaryMap[personnelId]) {
                            beneficiaryMap[personnelId] = {
                                personnel: allocation.personnel,
                                totalAmount: 0,
                                count: 0
                            };
                        }
                        beneficiaryMap[personnelId].totalAmount += allocation.amount;
                        beneficiaryMap[personnelId].count++;
                    }
                }
            });
        }
        
        if (instance.template) {
            var templateId = instance.template._id || instance.template;
            if (!templateMap[templateId]) {
                templateMap[templateId] = {
                    template: instance.template,
                    count: 0,
                    totalAmount: 0
                };
            }
            templateMap[templateId].count++;
            templateMap[templateId].totalAmount += instanceAmount;
        }
        
        var period = moment(instance.createdAt).format('YYYY-MM');
        if (!periodMap[period]) {
            periodMap[period] = {
                period: new Date(moment(period, 'YYYY-MM').toDate()),
                count: 0,
                totalAmount: 0
            };
        }
        periodMap[period].count++;
        periodMap[period].totalAmount += instanceAmount;
        
        var status = instance.status || 'draft';
        statusMap[status].count++;
        statusMap[status].totalAmount += instanceAmount;
        
        stats.summary.totalAmount += instanceAmount;
        stats.summary.beneficiaryCount += instanceBeneficiaries;
    });
    
    if (stats.summary.beneficiaryCount > 0) {
        stats.summary.averageAmount = stats.summary.totalAmount / stats.summary.beneficiaryCount;
    }
    
    stats.byStructure = Object.values(structureMap);
    stats.byTemplate = Object.values(templateMap);
    stats.byPeriod = Object.values(periodMap);
    stats.byStatus = Object.values(statusMap);
    
    stats.topBeneficiaries = Object.values(beneficiaryMap)
        .sort(function(a, b) {
            return b.totalAmount - a.totalAmount;
        })
        .slice(0, 10);
    
    return stats;
}

/**
 * Generate dashboard PDF report
 */
function generateDashboardPDF(stats, filePath, callback) {
    try {
        var doc = new PDFDocument({ size: 'A4', margin: 50 });
        var stream = fs.createWriteStream(filePath);
        
        doc.pipe(stream);
        
        doc.fontSize(20).text('Tableau de Bord des Primes', { align: 'center' });
        doc.moveDown();
        doc.fontSize(12).text('Généré le ' + moment().format('DD/MM/YYYY à HH:mm'), { align: 'center' });
        doc.moveDown(2);
        
        doc.fontSize(16).text('Résumé', { underline: true });
        doc.moveDown();
        
        doc.fontSize(12).text('Montant total des primes: ' + formatCurrency(stats.summary.totalAmount));
        doc.text('Nombre d\'instances: ' + stats.summary.instanceCount);
        doc.text('Nombre de bénéficiaires: ' + stats.summary.beneficiaryCount);
        doc.text('Montant moyen par bénéficiaire: ' + formatCurrency(stats.summary.averageAmount));
        doc.moveDown(2);
        
        doc.fontSize(16).text('Répartition par statut', { underline: true });
        doc.moveDown();
        
        doc.fontSize(12);
        stats.byStatus.forEach(function(item) {
            var statusLabel = '';
            switch(item.status) {
                case 'draft': statusLabel = 'Brouillon'; break;
                case 'pending': statusLabel = 'En attente'; break;
                case 'approved': statusLabel = 'Approuvé'; break;
                case 'rejected': statusLabel = 'Rejeté'; break;
                default: statusLabel = item.status;
            }
            doc.text(statusLabel + ': ' + item.count + ' instances, ' + formatCurrency(item.totalAmount));
        });
        doc.moveDown(2);
        
        doc.fontSize(16).text('Répartition par modèle de prime', { underline: true });
        doc.moveDown();
        
        doc.fontSize(12);
        stats.byTemplate.forEach(function(item) {
            var templateName = item.template.name || 'N/A';
            doc.text(templateName + ': ' + item.count + ' instances, ' + formatCurrency(item.totalAmount));
        });
        doc.moveDown(2);
        
        doc.fontSize(16).text('Répartition par structure', { underline: true });
        doc.moveDown();
        
        doc.fontSize(12);
        stats.byStructure.forEach(function(item) {
            var structureName = item.structure.name || 'N/A';
            doc.text(structureName + ': ' + item.count + ' allocations, ' + formatCurrency(item.totalAmount));
        });
        doc.moveDown(2);
        
        doc.fontSize(16).text('Évolution par période', { underline: true });
        doc.moveDown();
        
        doc.fontSize(12);
        stats.byPeriod.sort(function(a, b) {
            return new Date(a.period) - new Date(b.period);
        }).forEach(function(item) {
            var periodLabel = moment(item.period).format('MMMM YYYY');
            doc.text(periodLabel + ': ' + item.count + ' instances, ' + formatCurrency(item.totalAmount));
        });
        doc.moveDown(2);
        
        doc.fontSize(16).text('Top 10 des bénéficiaires', { underline: true });
        doc.moveDown();
        
        doc.fontSize(12);
        stats.topBeneficiaries.forEach(function(item, index) {
            var personnelName = 'N/A';
            if (item.personnel) {
                if (item.personnel.firstname && item.personnel.lastname) {
                    personnelName = item.personnel.firstname + ' ' + item.personnel.lastname.toUpperCase();
                } else if (item.personnel.matricule) {
                    personnelName = 'Matricule: ' + item.personnel.matricule;
                }
            }
            doc.text((index + 1) + '. ' + personnelName + ': ' + formatCurrency(item.totalAmount) + ' (' + item.count + ' primes)');
        });
        
        doc.end();
        
        stream.on('finish', function() {
            callback(null);
        });
        
        stream.on('error', function(err) {
            callback(err);
        });
    } catch (err) {
        callback(err);
    }
}

/**
 * Format currency
 */
function formatCurrency(amount) {
    return amount.toLocaleString('fr-FR') + ' FCFA';
}
