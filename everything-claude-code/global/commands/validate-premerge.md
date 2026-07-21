# Command: /validate-premerge <scope>

Goal:
Final strict review before merge.

Checks:
1. Modified files count and scope compliance.
2. Business logic unchanged (unless requested).
3. Consistency of handlers/guards/messages.
4. Translation consistency for changed user-facing text.
5. UI-only claims validated (if applicable).
6. Manual QA checklist completed and documented.

Return:
- Pass/Fail
- Remaining risks
- Merge recommendation
- Rollback scope (exact files)
