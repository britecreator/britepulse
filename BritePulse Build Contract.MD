# BritePulse Build Contract (Implementation Blueprint)
Version: v0.1  
Last updated: 2026-01-15  
This document is the hard contract for building BritePulse. It is intentionally strict.

## 0) Builder Instructions (Must Follow)
1. This contract is authoritative. If the Product Spec conflicts, follow this contract.
2. If anything is ambiguous:
   - choose the safest default that preserves privacy and prevents production harm
   - document the decision in the Assumptions and Decisions Log (Section 14)
3. No code should appear in outputs driven by this contract. Produce architecture, schemas, behavior, and testable requirements.
4. Hard constraints:
   - Never send secrets to the AI model.
   - Never store raw PII by default.
   - Never provide autonomous production deploy in v1.
   - RBAC and audit logging are required for console access and issue access.
5. Evidence-first rule:
   - AI analysis may only claim what can be supported by provided telemetry or retrieved code context.
   - If evidence is missing, output must request more info or route to engineering review.

## 1) Deliverables (Artifacts That Must Exist)
BritePulse must include these components in v1:
1. Client SDK (Widget + capture)
2. Ingestion API
3. Processing Pipeline (dedupe, scoring, AI triage trigger)
4. Storage layer (events, issues, config, audit)
5. Admin Console (web UI)
6. PO Console (web UI)
7. Daily Brief service (email composer + sender)
8. AI Triage service (LLM invocation + retrieval orchestration)
9. Installation Health monitoring (per-app)

Forbidden in v1:
- automatic production deployment
- storing unredacted form values by default
- unrestricted data export from console

## 2) Roles and RBAC (Required)
Roles:
- Admin
- PO
- Engineer
- ReadOnly

Rules:
- Admin can manage apps, keys, policies, recipients, and view all issues in allowed apps.
- PO can view and update issues for apps they own (or are granted access to), adjust severity/status, and trigger integrations.
- Engineer can view issues assigned to them/team and add resolution notes; cannot change app config or keys.
- ReadOnly can view issues but cannot change status or view restricted attachments if configured.

RBAC Matrix (minimum):
- View issue list: Admin/PO/Engineer/ReadOnly (scoped by app access)
- View issue detail: Admin/PO/Engineer/ReadOnly (scoped)
- Change issue status: Admin/PO/Engineer (scoped by policy), not ReadOnly
- Change severity: Admin/PO only
- Manage apps/keys/policies: Admin only
- View attachments: Admin/PO by default; Engineer only if assigned; ReadOnly never (default)

All console actions must create an AuditLog entry.

## 3) Data Minimization, Redaction, and Retention (Required)
### 3.1 Default Data Minimization
Default-capture fields are metadata only. Raw form values and payload bodies are excluded by default.

### 3.2 Redaction Rules (Must)
Before storage and before AI invocation:
- Email-like strings -> [REDACTED_EMAIL]
- Phone-like strings -> [REDACTED_PHONE]
- Street address-like strings -> [REDACTED_ADDRESS]
- Policy/account identifiers (pattern-based) -> [REDACTED_ID]
- Any secrets-like patterns (api keys, tokens) -> [REDACTED_SECRET]
- Free-text fields are allowed but must be scanned and redacted.

Attachments:
- Screenshots require explicit opt-in per submission.
- Attachments are stored separately and access-controlled.

### 3.3 Retention (Defaults, Configurable per App)
- prod:
  - raw events: 30 days
  - issues: 365 days
  - attachments: 14 days
- stage/dev:
  - raw events: 14 days
  - issues: 180 days
  - attachments: 7 days

Retention changes must be logged and applied forward, not retroactively unless explicitly configured.

## 4) Canonical Entities and Schemas (Field Lists Only)
All fields noted as “required” must be present.

### 4.1 App (Config Entity)
Required:
- app_id (string, stable)
- name (string)
- environments (list of environment names)
- base_url_patterns (list of strings)
- owners:
  - po_emails (list of strings)
Optional:
- owners.engineering_owner_group (string or list)
- repo_mapping (list; see below)
- policies (see 4.5)
- schedules (see 4.6)
- install_keys (see 4.4)
- created_at, updated_at

### 4.2 Environment (Config Sub-Entity)
Required:
- env_name (string; e.g., prod/stage/dev)
- enabled (bool)
Optional:
- daily_brief_enabled (bool, default true)
- ai_enabled (bool, default true)

### 4.3 Repo Mapping (Optional in v1, but schema required)
- repo_id (string)
- services (list of service names)
- ownership_reviewers (list of identifiers/emails)
- path_scopes (optional list of repo paths allowed for retrieval)

### 4.4 Install Keys
Per app per environment:
- public_key (used by client SDK; not secret but should be unguessable)
- server_key (secret, used for server/log ingestion)
- key_rotated_at

### 4.5 Policy
Required:
- redaction_profile (enum: strict, standard, relaxed) default standard
- attachment_policy:
  - allowed (bool) default true
  - restricted_roles (list) default ["ReadOnly"]
- ai_policy:
  - eligible_severity_min (P0–P3) default P1
  - eligible_recurrence_min (int) default 5 occurrences/day
  - model_allowed_inputs (list) default ["sanitized_feedback","sanitized_stack","retrieved_code_excerpts","metrics_summary"]
- telemetry_policy:
  - frontend_enabled (bool) default true
  - backend_enabled (bool) default true
  - sampling_rules (list) default empty

### 4.6 Schedule
Required:
- daily_brief_time_local (HH:MM)
- daily_brief_timezone (IANA string; default America/Chicago)
- daily_brief_max_items (int; default 10)
- daily_brief_min_items (int; default 5)
- daily_brief_recipients (list; default owners.po_emails)

### 4.7 Event (Captured Input)
Required:
- event_id
- app_id
- environment
- event_type (enum: feedback, frontend_error, backend_error)
- timestamp
- session_id (string; required for frontend events, optional for backend)
- trace_id (string; optional but recommended)
- route_or_url (string)
- version (string; can be "unknown" but must exist)
- user (object, sanitized):
  - user_id (string or "unknown")
  - role (string or "unknown")
- payload (object, sanitized; varies by type)
Optional:
- fingerprint (required for error types)
- attachment_refs (list)
- request_metadata (object): request_id, service_name, revision, http_status

### 4.8 Issue (Grouped Unit)
Required:
- issue_id
- app_id
- environment
- status (enum; see Section 6)
- severity (P0–P3)
- title
- description (sanitized)
- issue_type (enum: bug, feature, feedback, question)
- primary_fingerprint (string or null)
- event_refs (list of event_id)
- counts:
  - occurrences_total (int)
  - occurrences_24h (int)
  - unique_users_24h_est (int)
- timestamps:
  - created_at
  - last_seen_at
Optional:
- routing:
  - assigned_to (email/team identifier)
- ai_analysis (see 4.9)
- tags (list of strings)
- related_issue_ids (list)

### 4.9 AIAnalysis (Structured)
Required:
- analysis_id
- model_name
- generated_at
- classification (bug/feature/feedback/question)
- severity (P0–P3)
- impact_summary (string)
- evidence_refs (list of evidence items; required if claims made)
- root_cause_hypothesis (string)
- fix_plan (list of 1–3 options)
- test_plan (list)
- rollout_plan (string)
- rollback_plan (string)
- confidence (0.0–1.0)
- assumptions (list of strings)
- next_action (enum: investigate, request_info, route_engineering, create_ticket, monitor_only)
Forbidden:
- any secrets
- any unredacted PII

### 4.10 AuditLog
Required:
- audit_id
- actor_id
- actor_role
- action (string)
- target_type (app/issue/event/attachment)
- target_id
- timestamp
- metadata (object; sanitized)

## 5) API Contract (Endpoints + Behavior)
All endpoints must support request validation, auth, and safe error responses.

### 5.1 Authentication
- Client (public_key): used for widget + frontend events.
- Server/log ingestion (deterministic secret auth): uses server_key.
- Console (user auth): organization identity provider or equivalent, with RBAC enforcement.

### 5.2 Required Endpoints (Names and Intent)
Ingestion:
- POST /events
  - Auth: public_key or server_key depending on event source
  - Behavior: validate schema, apply redaction, store Event, enqueue pipeline
  - Idempotency: if same event_id repeats, ignore duplicates

Admin:
- GET /admin/apps
- POST /admin/apps
- GET /admin/apps/{app_id}
- PATCH /admin/apps/{app_id}
- POST /admin/apps/{app_id}/rotate-keys
- PATCH /admin/apps/{app_id}/owners
- PATCH /admin/apps/{app_id}/policies
- PATCH /admin/apps/{app_id}/schedules

PO/Issue operations:
- GET /issues (filters: app_id, env, severity, status, tag, version, time range)
- GET /issues/{issue_id}
- POST /issues/{issue_id}/actions/set-status
- POST /issues/{issue_id}/actions/set-severity
- POST /issues/{issue_id}/actions/assign
- POST /issues/{issue_id}/actions/request-info
- POST /issues/{issue_id}/actions/create-ticket (can be stubbed in v1 but must record action)
- POST /issues/{issue_id}/actions/resolve

Daily brief:
- POST /briefs/run (internal/admin only)
- GET /briefs/preview?app_id=...&env=...

Install health:
- GET /apps/{app_id}/health (Admin only)

### 5.3 Error Handling
- 400: schema validation failed
- 401: auth failure
- 403: not permitted
- 404: not found
- 429: rate limited
- 500: internal error (no sensitive details)

## 6) Issue Status State Machine (Required)
Statuses:
- new
- triaged
- in_progress
- blocked
- snoozed
- resolved

Allowed transitions:
- new -> triaged
- new -> in_progress
- triaged -> in_progress
- triaged -> blocked
- triaged -> snoozed
- in_progress -> blocked
- in_progress -> resolved
- blocked -> in_progress
- snoozed -> triaged
- snoozed -> resolved
- resolved -> triaged (reopen) only if new evidence or recurrence and role is Admin/PO

Every transition must:
- write AuditLog
- record actor + reason (required field in action payload)

## 7) Deterministic Dedupe and Grouping (Required)
### 7.1 Error fingerprinting
Fingerprint must be deterministic and stable across occurrences:
- Inputs:
  - error_type
  - normalized message (trim variable IDs)
  - top stack frames (top N = 5 default)
  - route group (optional but recommended)
- Output:
  - fingerprint string

### 7.2 Grouping rules
- Error events with the same fingerprint map to the same Issue (within the same app_id + environment).
- Manual feedback may map to:
  - an existing Issue if similarity threshold passes AND app_id/env match
  - otherwise create a new Issue

### 7.3 Recurrence windows
Track:
- occurrences_total
- occurrences_24h (rolling)
- unique_users_24h_est (rolling)

### 7.4 Similarity for manual feedback (v1 approach)
- Use LLM-based or embedding-based similarity, but must be conservative:
  - false merges are worse than duplicates
- If uncertain, create new Issue and add “potential duplicate” links.

## 8) Priority Scoring and Daily Brief Selection (Required)
### 8.1 Severity weights
- P0: 100
- P1: 60
- P2: 30
- P3: 10

### 8.2 Environment weights
- prod: 1.0
- stage: 0.6
- dev: 0.3

### 8.3 Impact components
- occurrences_24h normalized (cap at 100)
- unique_users_24h_est normalized (cap at 100)
- trend velocity (increase vs previous day, cap at 50)

### 8.4 Priority score (deterministic formula)
priority_score =
  severity_weight * environment_weight
  + occurrences_component
  + unique_users_component
  + trend_component

### 8.5 Daily brief rules
- One email per app per day.
- Include between min_items and max_items.
- Include at least:
  - any P0 new or unresolved
  - top recurring issue in last 24h if not resolved
- Diversity rule:
  - no more than 3 items from the same primary_fingerprint cluster (unless all are P0/P1)

## 9) Installation Contract (How an App Installs BritePulse)
### 9.1 Required installation outcomes
An app is “BritePulse-compliant” if:
1. Widget renders on all pages (or defined routes) in the environment.
2. Client sends events with:
   - app_id
   - environment
   - route_or_url
   - version (can be "unknown" but must exist)
   - session_id for frontend
3. Client captures:
   - manual feedback events
   - frontend error events

### 9.2 Recommended outcomes (Full value)
1. Client generates trace_id and attaches it to API requests via a header.
2. Server propagates trace_id into logs and error events.
3. Backend error ingestion is enabled and includes:
   - service_name
   - revision
   - version (commit SHA/build id)
4. App provides stable route naming (optional but improves clustering).

### 9.3 Degraded-mode behavior
If an app cannot do trace propagation:
- BritePulse still works (widget + frontend errors).
- Correlation views show “trace unavailable” and must not imply backend evidence.

If version is unknown:
- Issues still group, but “code retrieval” must be limited to stack-based retrieval and app mapping.
- Daily brief includes “version unknown” note for those issues.

## 10) AI Triage Contract (Strict)
### 10.1 Allowed AI inputs
Only these may be provided to the model:
- sanitized user feedback text
- sanitized stack traces / error metadata
- aggregated counts and trends
- retrieved code excerpts from allowed repo scopes
- runbook snippets (if present) that contain no secrets

### 10.2 Forbidden AI inputs
- secrets (keys, tokens, credentials)
- unredacted PII
- full database exports
- raw request/response bodies that contain user/customer data

### 10.3 Required output format
AIAnalysis must include all required fields in 4.9.

### 10.4 Evidence requirement
- Every root-cause claim must reference at least one evidence_ref.
- If evidence is insufficient, AI must:
  - set confidence <= 0.5
  - set next_action to request_info or route_engineering
  - list what additional info is needed

### 10.5 “Execute” behavior in v1
“Execute” is not deployment.
In v1, the strongest permissible “execute” action is:
- generate a “PR plan” (steps, files likely touched, test plan)
- optionally create a ticket
- optionally assign engineering reviewers

No merges, no deploys.

## 11) Console UI Inventory (Required Pages)
Admin Console:
1. Apps List
   - shows apps, environments, PO emails, install health summary
2. App Detail
   - owners (PO emails)
   - policies
   - schedules
   - key management (rotate keys)
   - install health metrics

PO Console:
1. Issues List
   - filters (app/env/severity/status/version/time)
   - sort by priority_score
2. Issue Detail
   - header: title, severity, status, app/env
   - timeline of events
   - correlation panel (session/trace, if available)
   - AI analysis panel (structured sections)
   - actions panel (status/severity/assign/request-info/ticket/resolve)
3. Access Denied / Not Found states

UI must include empty states and safe error messaging.

## 12) Observability and Health (Required)
BritePulse must self-monitor:
- ingestion throughput
- validation failure rate
- rate-limited events count
- pipeline queue depth
- AI triage latency and failure rate
- daily brief send success rate
- per-app install health:
  - last event received timestamp
  - missing version rate
  - missing trace rate
  - event volume baseline anomalies

## 13) Acceptance Tests (Behavioral, Must Pass)
### Functional
1. Submitting widget feedback creates an Event and an Issue (or links to an existing Issue) within a short time window.
2. Repeated identical frontend errors dedupe into one Issue and increment occurrence counts.
3. Daily brief sends one email per app to configured PO emails at configured time.
4. PO can change issue status and severity, and actions are audited.

### Privacy/Security
5. If feedback text contains an email address, stored content shows [REDACTED_EMAIL].
6. Attachments are not stored unless user explicitly opted in.
7. ReadOnly users cannot access attachments by default.
8. AuditLog records every issue view and state change in the console.
9. AI invocation payload never includes secrets or unredacted PII.

### Resilience
10. Ingestion API handles bursts with rate limiting; returns 429 when exceeded.
11. Duplicate event submissions with the same event_id do not create duplicates.

### Degraded mode
12. If trace_id is absent, issue detail explicitly shows correlation unavailable and does not fabricate backend linkage.
13. If version is "unknown", AI analysis must not claim specific commit-level fixes unless supported by retrieved code evidence.

## 14) Assumptions and Decisions Log (Must Maintain)
This section must be appended/updated during implementation whenever:
- requirements are ambiguous
- a tradeoff is made
- defaults are chosen

Each entry must include:
- date
- decision
- reason
- implications
- follow-up (if any)
