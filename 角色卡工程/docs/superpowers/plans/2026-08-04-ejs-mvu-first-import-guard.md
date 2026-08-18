# EJS/MVU First-Import Guard Implementation Plan

> **For agentic workers:** Execute inline and track every checkbox. Do not change MVU schema, initvar values, scene prose, or the authoritative v0.4.6 package aliases during diagnosis.

**Goal:** Prevent first-import EJS errors when worldbook `@@if` conditions are evaluated before the MVU-backed shared variables have been defined.

**Architecture:** Keep the shared EJS preprocessor for normal runtime use, but make every state-level `@@if` expression fail closed when `mode` is not yet defined. Add a read-only verifier that evaluates all guarded conditions both without runtime variables and with representative initialized values, then pack and read back a separate candidate card.

**Tech Stack:** SillyTavern worldbook state JSON, EJS conditions, MVU, Node.js built-ins, tavern-cards forge.

---

### Task 1: Record the runtime contract

**Files:**
- Modify: `创作规划.yaml`
- Create: `docs/superpowers/plans/2026-08-04-ejs-mvu-first-import-guard.md`

- [x] Document that state-level conditions must not assume the shared `define()` block has already run.
- [x] Preserve existing MVU schema and initial values.

### Task 2: Guard every state-level condition

**Files:**
- Modify: `tavern-cards-state.json`
- Create: `build_tools/verify_ejs_condition_guards.mjs`

- [x] Prefix every `@@if` condition with a `typeof mode !== "undefined"` short-circuit around the original expression.
- [x] Verify the complete condition inventory fails closed without throwing before MVU initialization.
- [x] Verify representative initialized values still activate every intended condition.

### Task 3: Validate and package a candidate

**Files:**
- Create: `Counterfeit v0.4.6-first-import-fix.png`

- [x] Run the condition verifier and MVU validation.
- [x] Pack a non-overwriting candidate card.
- [x] Unpack the candidate in raw mode and confirm all 161 guarded conditions survive readback.
- [x] Leave `Counterfeit.png` and `Counterfeit v0.4.6.png` unchanged until the candidate is accepted.
