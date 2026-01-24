# Persabe - Personnel & Bonus Management System

## Architecture Overview

Express.js backend + AngularJS SPA frontend for managing government personnel, organizational structures, work positions, and bonus/payment workflows. No testing framework is currently integrated.

### Core Structure
```
server/
├── app.js                 # Entry point: Express config, nconf config loading, socket.io
├── app/
│   ├── routes.js          # All API routes with ACL from resources/dictionary/app/routes.json
│   ├── controllers/       # Request handlers with exports.api pattern
│   ├── services/          # Business logic (bonus*, snapshot*, export*)
│   ├── models/            # Mongoose schemas
│   ├── validations/       # Joi schemas for celebrate middleware
│   ├── middlewares/       # validate.js uses celebrate for request validation
│   ├── initialization.js  # All scheduled jobs (snapshots, retirement, bonus generation)
│   └── jobs/              # Cron job implementations
├── config/server.json     # Runtime config (auto-generated with defaults)
├── resources/dictionary/  # JSON-based configuration & reference data
└── public/js/             # AngularJS frontend code
```

### Key Domain Models
- **Structure**: Organizational units (ministries, directorates) with hierarchy via `fatherIdentifier`/`fatherId`
- **Position**: Work positions within structures with required profiles/skills
- **Personnel**: Core entity with `identifier` (matricule), career history, positions, sanctions
- **Bonus System**: Template → Instance → Allocation flow
  - `BonusTemplate`: Defines rules, eligibility, calculation (with_parts, fixed_amount, etc.)
  - `BonusInstance`: A specific bonus period (e.g., "2025-Q2")
  - `BonusAllocation`: Individual personnel payments within an instance
- **PersonnelSnapshot**: Point-in-time captures for bonus calculations

### Role System
Roles are defined in `resources/dictionary/app/roles.json` and referenced by ID:
- **1**: Administrator - System configuration, user management, audit logs
- **2**: Manager - Structure-scoped access to personnel and operations
- **3**: Supervisor - Personnel management and general operations
- **4**: Editor - Data entry access
- **5**: Task editor - Task management only
- **6**: Bonus Manager - Approve/reject bonuses, generate payment files, configure bonus amounts
- **7**: Bonus Operator - Create bonus instances, adjust allocations (cannot approve or generate payments)

**Critical Bonus Operations (Role 6 only):**
- Approve/reject bonus instances
- Generate payment files
- Update share amounts and tax configuration
- Cancel bonus instances

### Role Assignment Security
Role assignment is restricted based on the actor's role (see `validations/users/index.js`):

| Actor Role | Can Create/Assign |
|------------|-------------------|
| **1 - Administrator** | All roles (1-7) |
| **3 - Supervisor** | 2, 3, 4, 5, 7 (NOT Admin, NOT Bonus Manager) |
| **6 - Bonus Manager** | 7 only (Bonus Operators) |

**Sensitive roles** (1: Admin, 6: Bonus Manager) can only be created by Administrators.
Use `GET /api/users/assignable-roles` to get roles available to the current user.
Use `GET /api/users/assignable-roles` to get roles available to the current user.

## Dictionary System

JSON files in `resources/dictionary/` serve as reference data throughout the app:
```
resources/dictionary/
├── app/           # routes.json, roles.json, charts.json
├── personnel/     # status.json, ranks.json, sanctions.json, skills.json, profile.json
├── structure/     # types.json, ranks.json
├── location/      # countries/, regions hierarchy
└── task/          # statuses.json, priorities.json
```

### Accessing Dictionary Data
**Backend** via [dictionary.js](server/app/utils/dictionary.js):
```javascript
const dictionary = require('../../utils/dictionary');
const value = dictionary.getValueFromJSON('../../resources/dictionary/personnel/ranks.json', 'DIR', 'fr');
const item = dictionary.getJSONById('../../resources/dictionary/personnel/status.json', '1');
```

**Frontend** via Dictionary service:
```javascript
Dictionary.jsonList({dictionary: 'personnel', levels: ['ranks']}).then(response => {
    $scope.ranks = response.data.jsonList;
});
```

Dictionary entries support i18n with `en`/`fr` fields and include domain-specific properties (e.g., `bonusRate`, `hierarchy` for ranks).

## Key Patterns

### Controller Pattern
Controllers use dual export pattern for API handlers vs internal methods:
```javascript
exports.api = {};                        // HTTP request handlers
exports.api.list = function(req, res) {} // Called from routes
exports.list = function(options, cb) {}  // Internal callback-based method
```

### Route Definition with ACL
Routes in [routes.js](server/app/routes.js) reference ACL from `resources/dictionary/app/routes.json`:
```javascript
{
    path: _.findWhere(aclRoutes, { id: 10 }).uri,
    httpMethod: _.findWhere(aclRoutes, { id: 10 }).method,
    middleware: [jwt({ secret }), tokenManager.verifyToken, controllers.users.api.list],
    access: _.findWhere(aclRoutes, { id: 10 }).roles  // [1, 3] = Admin + Supervisor
}
```

### Validation with Celebrate/Joi
Request validation uses [validate.js](server/app/middlewares/validate.js) middleware:
```javascript
// validations/bonus/instance.js
const schemas = {
    createBonusInstance: {
        body: Joi.object({
            templateId: Joi.string().custom(isValidObjectId).required(),
            referencePeriod: Joi.string().required()
        })
    }
};
// In routes: validate(schemas.createBonusInstance)
```

### Error Handling
Use [ApiError](server/app/utils/ApiError.js) factory functions:
```javascript
const { badRequest, notFound, forbidden } = require('../../utils/ApiError');
throw badRequest('Message');  // Creates ApiError with status 400
throw forbidden(t(req, 'Forbidden'));  // i18n-aware errors
```

### Audit Logging
All significant actions should be logged:
```javascript
const audit = require('../../utils/audit-log');
audit.logEvent(actorId, 'bonus/instance', 'create', 'BonusInstance', objectId, 'succeed', 'Description');
```

## Development

### Run Server
```bash
cd server && node app.js
```

### Docker
```bash
docker-compose up  # MongoDB on 27020, app on 4002
```

### Internationalization
Translations use angular-gettext. Run grunt to extract/compile:
```bash
cd server && grunt  # Extracts .pot, compiles .po → public/js/appTranslations.js
```

### Configuration
Config auto-generated in `server/config/server.json` on first run. Key sections:
- `mongo`: MongoDB connection string (default: `mongodb://127.0.0.1:27017/persabe`)
- `token`: JWT secret and expiration
- `system:logPath`: Log file location
- `export`: Export job settings

## Code Conventions

- ObjectIds validated with custom Joi validator `isValidObjectId`
- Personnel identified by `identifier` field (matricule), not `_id`
- Bonus workflow states: draft → pending_generation → generated → under_review → approved → paid
- Structure scoping uses tokens from `getActorStructureTokens()` for role-based access
- Internal methods use callback pattern: `function(err, result)`
- API methods use Express pattern: `function(req, res)`
- Dictionary IDs are strings (e.g., `"1"`, `"DIR"`) stored in models as references
