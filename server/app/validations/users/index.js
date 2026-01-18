/**
 * User Management - Role Assignment Validation
 * 
 * This module enforces role assignment rules to prevent privilege escalation.
 */

/**
 * Role Assignment Rules:
 * - Administrator (1): Can assign any role (1-7)
 * - Supervisor (3): Can assign roles 2, 3, 4, 5, 7 (NOT 1-Admin, NOT 6-Bonus Manager)
 * - Bonus Manager (6): Can only assign role 7 (Bonus Operator)
 * 
 * This prevents privilege escalation and ensures financial roles (6) 
 * are only created by system administrators.
 */
const ROLE_ASSIGNMENT_RULES = {
    '1': ['1', '2', '3', '4', '5', '6', '7'],  // Admin can assign all
    '3': ['2', '3', '4', '5', '7'],            // Supervisor: no Admin(1), no Bonus Manager(6)
    '6': ['7']                                  // Bonus Manager can only create Bonus Operators
};

/**
 * Sensitive roles that require Administrator to create
 */
const SENSITIVE_ROLES = ['1', '6'];

/**
 * Check if an actor can assign a specific role to a user
 * @param {string} actorRole - The role of the user performing the action
 * @param {string} targetRole - The role being assigned
 * @returns {boolean}
 */
function canAssignRole(actorRole, targetRole) {
    const allowedRoles = ROLE_ASSIGNMENT_RULES[actorRole];
    if (!allowedRoles) {
        return false;
    }
    return allowedRoles.includes(String(targetRole));
}

/**
 * Get the list of roles an actor can assign
 * @param {string} actorRole - The role of the user performing the action
 * @returns {string[]}
 */
function getAssignableRoles(actorRole) {
    return ROLE_ASSIGNMENT_RULES[String(actorRole)] || [];
}

module.exports = {
    canAssignRole,
    getAssignableRoles,
    ROLE_ASSIGNMENT_RULES,
    SENSITIVE_ROLES
};
