const dictionary = require('../../utils/dictionary');
const { badRequest } = require('../../utils/ApiError');

function t(req, msgid) {
    const language = (req && req.actor && req.actor.language) || (req && req.user && req.user.language) || '';
    return dictionary.translator(language).gettext(msgid);
}

exports.api = {};

/**
 * Get Bonus Module Permissions for the current user
 * 
 * Role Reference:
 * - 1: Administrator - Full system access
 * - 6: Bonus Manager - Approve/reject, generate payments, configure amounts
 * - 7: Bonus Operator - Create instances, adjust allocations (no approval/payments)
 */
exports.api.getPermissions = (req, res, next) => {
    try {
        const role = (req.actor && req.actor.role) ? String(req.actor.role) : '';
        
        const isAdmin = role === '1';
        const isBonusManager = role === '6';
        const isBonusOperator = role === '7';
        const hasBonusAccess = isAdmin || isBonusManager || isBonusOperator;

        // Centralized Permission Logic
        const permissions = {
            // Wizard Access - All bonus roles can use the wizard
            canAccessWizard: hasBonusAccess,

            // Personnel Bonus Modification - Manager and Operator can adjust
            canModifyPersonnelBonus: isAdmin || isBonusManager || isBonusOperator,

            // Approval - Only Admin and Bonus Manager (critical operation)
            canApproveInstance: isAdmin || isBonusManager,

            // Structure/Snapshot Updates - Only Admin and Bonus Manager
            canUpdateShareAmount: isAdmin || isBonusManager,
            canUpdateTaxConfig: isAdmin || isBonusManager,

            // Export - All bonus roles can export
            canExport: hasBonusAccess,

            // Instance Management
            canCreateCycle: isAdmin || isBonusManager || isBonusOperator,
            canManageCycle: hasBonusAccess,
            canGeneratePayments: isAdmin || isBonusManager,  // Critical - Manager only
            canCancelInstance: isAdmin || isBonusManager,    // Critical - Manager only
            canNotify: hasBonusAccess,
            canGenerateForTemplate: isAdmin || isBonusManager || isBonusOperator,
            canBulkActions: isAdmin || isBonusManager
        };

        res.json(permissions);
    } catch (error) {
        next(error);
    }
};
