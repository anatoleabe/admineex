# Command: /i18n-check <scope>

Goal:
Ensure all user-facing text in <scope> follows the existing translation system.

Checks:
1. Detect translation pattern used by files:
   - `translate` attributes
   - `| translate` filters
   - `t(...)` / `gettextCatalog.getString(...)` in controllers
2. Find hardcoded user-facing strings.
3. Reuse existing keys where possible.
4. Add new keys only when necessary.
5. Keep key naming consistent with current conventions.
6. Update translation catalogs conservatively.

Safety:
- No business logic change.
- No API/payload/storage change.
- No new i18n framework.

Output:
- Modified files
- New keys
- Reused keys
- Inconsistencies found
- Manual verification checklist
- Rollback scope
