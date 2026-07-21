# Project Profile: Admineex

## Stack
- Backend: Node.js (Express-style controllers)
- Frontend: AngularJS templates/controllers
- Data: MongoDB

## Critical Business Areas
- Bonus/Prime calculation logic
- Eligibility rules
- Share/tax recalculation paths
- Generation/import/export side effects

## Safety Defaults
- Prefer smallest safe patch.
- Avoid unrelated file changes.
- Do not refactor unless requested.
- Evidence-first analysis before patching.

## Repo-Specific Output Requirement
Always return:
1. Findings
2. Impacted files
3. Risks
4. Proposed change
5. Verification steps

## Sensitive Paths
- `server/app/controllers/bonus/*`
- `server/public/js/controllers/bonus/*`
- `server/public/templates/bonus/*`

## Typical Verification
- Manual flow checks for create/view/list/dashboard
- Recalculation guards and entry points
- I18N consistency (translate / t(...) / catalogs)
- Regression check on other prime models
