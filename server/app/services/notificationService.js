// services/notificationService.js
//const BonusAllocation = require('../models/bonus/bonusAllocation');
//const BonusInstance = require('../models/bonus/bonusInstance');
const User = require('../models/user');
const { badRequest, notFound , ApiError } = require('../utils/ApiError');
const nodemailer = require('nodemailer');
const mongoose = require('mongoose');
const { format } = require('date-fns');
const ejs = require('ejs');
const path = require('path');
const fs = require('fs');
const httpStatus = require('http-status');

// Email transporter configuration
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
    }
});

/**
 * Send notifications for bonus instance status changes
 * @param {Object} options - Notification options
 * @param {String} options.instanceId - BonusInstance ID
 * @param {String} options.templateId - BonusTemplate ID
 * @param {String} options.referencePeriod - Reference period
 * @param {String} options.status - New status
 * @returns {Promise<Object>} - Notification results
 */
exports.sendNotification = async ({ instanceId, templateId, referencePeriod, status }) => {
    try {
        // Get the bonus instance details
        const instance = await BonusInstance.findById(instanceId)
            .populate('templateId', 'name code')
            .populate('createdBy', 'email firstname lastname');

        if (!instance) {
            throw new notFound('Bonus instance not found');
        }

        // Determine notification type based on status
        let notificationType;
        let subject;
        let templateName;

        switch (status) {
            case 'generated':
                notificationType = 'BONUS_GENERATED';
                subject = `Bonus Generated - ${instance.templateId.name} ${referencePeriod}`;
                templateName = 'bonus-generated.ejs';
                break;
            case 'approved':
                notificationType = 'BONUS_APPROVED';
                subject = `Bonus Approved - ${instance.templateId.name} ${referencePeriod}`;
                templateName = 'bonus-approved.ejs';
                break;
            case 'paid':
                notificationType = 'BONUS_PAID';
                subject = `Bonus Paid - ${instance.templateId.name} ${referencePeriod}`;
                templateName = 'bonus-paid.ejs';
                break;
            default:
                throw badRequest('Invalid notification status');
        }

        // Get recipients based on notification type
        const recipients = await this.getRecipients(notificationType, instance);

        // Prepare notification content
        const templatePath = path.join(__dirname, '../templates/emails', templateName);
        const template = fs.readFileSync(templatePath, 'utf-8');

        const notificationResults = [];

        // Send notifications to each recipient
        for (const recipient of recipients) {
            try {
                const html = ejs.render(template, {
                    recipient,
                    instance,
                    referencePeriod,
                    status,
                    date: format(new Date(), 'MMMM d, yyyy')
                });

                const mailOptions = {
                    from: `"HR System" <${process.env.EMAIL_FROM}>`,
                    to: recipient.email,
                    subject,
                    html,
                    attachments: this.getAttachments(notificationType, instance)
                };

                // Send email
                const info = await transporter.sendMail(mailOptions);

                notificationResults.push({
                    recipient: recipient.email,
                    status: 'sent',
                    messageId: info.messageId
                });

                // Create notification record in database if needed
                await this.createNotificationRecord({
                    type: notificationType,
                    instanceId,
                    recipientId: recipient._id,
                    status: 'sent',
                    content: subject
                });

            } catch (error) {
                console.error(`Failed to send notification to ${recipient.email}:`, error);
                notificationResults.push({
                    recipient: recipient.email,
                    status: 'failed',
                    error: error.message
                });

                await this.createNotificationRecord({
                    type: notificationType,
                    instanceId,
                    recipientId: recipient._id,
                    status: 'failed',
                    error: error.message,
                    content: subject
                });
            }
        }

        return {
            success: true,
            notificationType,
            sentCount: notificationResults.filter(r => r.status === 'sent').length,
            failedCount: notificationResults.filter(r => r.status === 'failed').length,
            results: notificationResults
        };

    } catch (error) {
        throw new ApiError(
            error.message || 'Failed to send notifications',
            error.statusCode || httpStatus.INTERNAL_SERVER_ERROR

        );
    }
};

/**
 * Get recipients for a notification type
 * @param {String} notificationType - Type of notification
 * @param {Object} instance - BonusInstance document
 * @returns {Promise<Array>} - Array of recipient objects
 */
exports.getRecipients = async (notificationType, instance) => {
    const recipients = [];

    switch (notificationType) {
        case 'BONUS_GENERATED':
            // Notify admins and managers
            const admins = await User.find({
                role: { $in: ['admin', 'manager'] },
                'preferences.notification.email': true
            });
            recipients.push(...admins);
            break;

        case 'BONUS_APPROVED':
            // Notify finance team and instance creator
            const financeTeam = await User.find({
                department: 'finance',
                'preferences.notification.email': true
            });
            recipients.push(...financeTeam);

            if (instance.createdBy && instance.createdBy.preferences?.notification?.email) {
                recipients.push(instance.createdBy);
            }
            break;

        case 'BONUS_PAID':
            // Notify all personnel who received bonuses
            const allocations = await BonusAllocation.find({
                instanceId: instance._id,
                status: 'paid'
            }).populate({
                path: 'personnelId',
                populate: { path: 'user', select: 'email preferences' }
            });

            for (const allocation of allocations) {
                if (allocation.personnelId.user?.preferences?.notification?.email) {
                    recipients.push({
                        _id: allocation.personnelId.user._id,
                        email: allocation.personnelId.user.email,
                        name: allocation.personnelId.name,
                        amount: allocation.finalAmount
                    });
                }
            }
            break;
    }

    // Remove duplicates
    return recipients.filter(
        (recipient, index, self) =>
            index === self.findIndex(r => r._id.toString() === recipient._id.toString())
    );
};

/**
 * Create notification record in database
 * @param {Object} options
 * @returns {Promise<void>}
 */
exports.createNotificationRecord = async ({ type, instanceId, recipientId, status, content, error }) => {
    await mongoose.model('Notification').create({
        type,
        bonusInstance: instanceId,
        recipient: recipientId,
        status,
        content,
        error,
        sentAt: new Date()
    });
};

/**
 * Get email attachments based on notification type
 * @param {String} notificationType
 * @param {Object} instance
 * @returns {Array} - Array of attachment objects
 */
exports.getAttachments = (notificationType, instance) => {
    const attachments = [];

    if (notificationType === 'BONUS_PAID' && instance.paymentFile) {
        attachments.push({
            filename: `payment_details_${instance.referencePeriod}.pdf`,
            path: instance.paymentFile.path,
            contentType: 'application/pdf'
        });
    }

    return attachments;
};

/**
 * Send bonus allocation adjustment notification
 * @param {String} allocationId - BonusAllocation ID
 * @param {String} adjustmentType - Type of adjustment (increase/decrease)
 * @param {Number} amount - Adjustment amount
 * @param {String} reason - Adjustment reason
 * @returns {Promise<Object>}
 */
exports.sendAdjustmentNotification = async (allocationId, adjustmentType, amount, reason) => {
    try {
        const allocation = await BonusAllocation.findById(allocationId)
            .populate('personnelId', 'name user')
            .populate('instanceId', 'templateId referencePeriod')
            .populate('instanceId.templateId', 'name');

        if (!allocation) {
            throw new notFound('Allocation not found');
        }

        const user = await User.findById(allocation.personnelId.user);
        if (!user || !user.preferences?.notification?.email) {
            return { success: false, message: 'User notifications disabled' };
        }

        const templatePath = path.join(__dirname, '../templates/emails/bonus-adjustment.ejs');
        const template = fs.readFileSync(templatePath, 'utf-8');

        const html = ejs.render(template, {
            recipient: user,
            allocation,
            adjustmentType,
            amount,
            reason,
            date: format(new Date(), 'MMMM d, yyyy')
        });

        const mailOptions = {
            from: `"HR System" <${process.env.EMAIL_FROM}>`,
            to: user.email,
            subject: `Bonus Adjustment - ${allocation.instanceId.templateId.name} ${allocation.instanceId.referencePeriod}`,
            html
        };

        const info = await transporter.sendMail(mailOptions);

        // Create notification record
        await this.createNotificationRecord({
            type: 'BONUS_ADJUSTMENT',
            instanceId: allocation.instanceId._id,
            recipientId: user._id,
            status: 'sent',
            content: mailOptions.subject
        });

        return {
            success: true,
            messageId: info.messageId
        };

    } catch (error) {
        throw new ApiError(
            error.message || 'Failed to send adjustment notification',
            error.statusCode || httpStatus.INTERNAL_SERVER_ERROR
        );
    }
};

/**
 * Send bonus calculation error notification
 * @param {String} instanceId - BonusInstance ID
 * @param {String} errorMessage - Error message
 * @returns {Promise<Object>}
 */
exports.sendCalculationErrorNotification = async (instanceId, errorMessage) => {
    try {
        const instance = await BonusInstance.findById(instanceId)
            .populate('templateId', 'name')
            .populate('createdBy', 'email');

        if (!instance) {
            throw new notFound('Instance not found');
        }

        // Notify admins and instance creator
        const admins = await User.find({
            $or: [
                { role: 'admin' },
                { _id: instance.createdBy._id }
            ],
            'preferences.notification.email': true
        });

        const templatePath = path.join(__dirname, '../templates/emails/bonus-error.ejs');
        const template = fs.readFileSync(templatePath, 'utf-8');

        const results = [];

        for (const admin of admins) {
            try {
                const html = ejs.render(template, {
                    recipient: admin,
                    instance,
                    errorMessage,
                    date: format(new Date(), 'MMMM d, yyyy')
                });

                const mailOptions = {
                    from: `"HR System" <${process.env.EMAIL_FROM}>`,
                    to: admin.email,
                    subject: `Bonus Calculation Error - ${instance.templateId.name} ${instance.referencePeriod}`,
                    html
                };

                const info = await transporter.sendMail(mailOptions);

                results.push({
                    recipient: admin.email,
                    status: 'sent',
                    messageId: info.messageId
                });

                await this.createNotificationRecord({
                    type: 'BONUS_ERROR',
                    instanceId,
                    recipientId: admin._id,
                    status: 'sent',
                    content: mailOptions.subject
                });

            } catch (error) {
                console.error(`Failed to send error notification to ${admin.email}:`, error);
                results.push({
                    recipient: admin.email,
                    status: 'failed',
                    error: error.message
                });
            }
        }

        return {
            success: results.some(r => r.status === 'sent'),
            results
        };

    } catch (error) {
        throw new ApiError(
            error.message || 'Failed to send error notifications',
            error.statusCode || httpStatus.INTERNAL_SERVER_ERROR

        );
    }
};