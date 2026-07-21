# AGENTS.md

## Project Context

Admineex is a personnel and administrative management system with financial components (bonuses, primes, payments).

This codebase includes sensitive business logic impacting:

* bonus generation
* tax calculation
* financial outputs (gross, net, allocations)

Any incorrect change may directly affect payments and data integrity.

Current working branch: ADX-8-1-PrimeSansPart

---

## Core Principle

Safety over speed.

Always:

* understand before modifying
* validate with code evidence
* prefer minimal and reversible changes
* protect financial integrity

---

## Critical Business Rules (DO NOT BREAK)

* Prime calculations must remain deterministic and reproducible
* Generation logic must not be silently altered
* Tax logic must remain consistent across generation, import, and recalculation
* Allocation totals (gross, tax, net) must remain coherent
* No partial update should create inconsistent financial states

If unsure about a rule → STOP and ask.

---

## Architecture Awareness

Before any change, identify:

* Controller → entry point (API)
* Service → business logic
* Model → data structure
* Side effects → exports, reports, jobs, imports

Always trace:
INPUT → PROCESS → STORAGE → OUTPUT

---

## MongoDB / Data Integrity Rules

* Never assume fields exist → always check null/undefined
* Be careful with partial updates (update vs overwrite)
* Ensure consistency between:

  * instance
  * allocations
  * templates
* Avoid introducing states that cannot be recalculated

---

## Financial Safety Rules

Any change affecting:

* shareAmount
* taxPercentage
* grossAmount / netAmount
* allocation distribution

MUST verify:

* calculation path
* eligibility conditions
* downstream effects (exports, payments)

---

## Allowed Changes (Default)

* small bug fixes
* validation guards
* error handling improvements
* minimal logic corrections

---

## Forbidden Without Explicit Instruction

* refactoring multiple files
* changing generation logic
* modifying import behavior
* altering data models
* introducing new dependencies

---

## Mandatory Workflow

### Step 1 — Analysis

* identify all impacted files
* understand current behavior
* map dependencies

### Step 2 — Evidence

* show exact code references
* confirm business rules from implementation
* detect alternative paths

### Step 3 — Risk Review

* identify what can break
* list edge cases
* highlight shared logic

### Step 4 — Patch Proposal

* smallest safe patch only
* minimal file changes
* no side effects

### Step 5 — Implementation

* follow existing code style
* no new patterns unless necessary

### Step 6 — Self Review

* check edge cases
* validate conditions
* ensure consistency

### Step 7 — Final Validation

* confirm allowed flows still work
* confirm invalid flows are blocked

---

## Controller Rules

* Validate input before processing
* Add guards BEFORE triggering business logic
* Keep response format consistent (badRequest, notFound, etc.)
* Do not embed complex business logic in controllers

---

## Service Rules

* Maintain deterministic behavior
* Avoid hidden side effects
* Ensure recalculation consistency

---

## Output Format (MANDATORY)

Always return:

1. Findings
2. Impacted files
3. Risks
4. Proposed change
5. Verification steps

---

## Special Instructions for PrimeSansPart

* Treat "with_parts" and "without_parts" as distinct models
* Do not mix calculation logic between them
* IFT subtype must respect tax exemption rules
* Prevent invalid recalculation paths at controller level

---

## Red Flags (STOP CONDITIONS)

* unclear business rule
* multiple conflicting calculation paths
* missing template or inconsistent data
* change impacts more than expected scope

If any of these occur → STOP and ask for clarification

---

## Final Rule

If the change is not clearly safe → do not implement.
