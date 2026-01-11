const dictionary = require('../../utils/dictionary');
const { badRequest } = require('../../utils/ApiError');

function t(req, msgid) {
    const language = (req && req.actor && req.actor.language) || (req && req.user && req.user.language) || '';
    return dictionary.translator(language).gettext(msgid);
}

exports.api = {};

/**
 * Get Bonus Module Permissions for the current user
 */
exports.api.getPermissions = (req, res, next) => {
    try {
        const role = (req.actor && req.actor.role) ? String(req.actor.role) : '';

        // Centralized Permission Logic
        const permissions = {
            // Wizard Access
            canAccessWizard: role === '1' || role === '2' ||role === '3' || role === '4',

            // Personnel Bonus Modification
            canModifyPersonnelBonus: role === '1' || role === '3',

            // Approval
            canApproveInstance: role === '1',

            // Structure/Snapshot Updates
            canUpdateShareAmount: role === '1',
            canUpdateTaxConfig: role === '1',

            // Export
            canExport: role === '1' || role === '2' || role === '3' || role === '4',

            // Instance Management
            canCreateCycle: role === '1' || role === '3',
            canManageCycle: role === '2' || role === '1' || role === '3' || role === '4',
            canGeneratePayments: role === '1',
            canCancelInstance: role === '1',
            canNotify: role === '1' || role === '3' || role === '4',
            canGenerateForTemplate: role === '1' || role === '3',
            canBulkActions: role === '1'
        };

        res.json(permissions);
    } catch (error) {
        next(error);
    }
};
