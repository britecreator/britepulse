# BritePulse Product Spec (Blueprint)
Version: v0.1  
Last updated: 2026-01-15  
Owner: BriteCo

## 1) Summary
BritePulse is an intelligent feedback and monitoring system installed across BriteCo internal web applications. It captures user feedback and technical errors, correlates user experience with technical telemetry, analyzes items using an AI triage engine, and delivers a curated daily intelligence brief for Product Owners (POs), plus a console workflow to manage and resolve issues.

BritePulse’s core value is noise reduction and speed: fewer scattered messages and tickets, faster root-cause discovery, and clearer next steps grounded in evidence from telemetry and relevant code context.

## 2) Goals
1. Provide a universal in-app widget for:
   - Bug reports
   - Feature requests
   - General feedback
2. Provide automated monitoring for:
   - Front-end errors (browser)
   - Back-end errors (services on Google Cloud Run)
3. Correlate user feedback and telemetry via session and trace identifiers.
4. Provide AI triage outputs that are:
   - Structured
   - Evidence-based
   - Actionable (fix plan + test plan + rollout plan)
5. Provide one daily email brief per app to the assigned PO(s).
6. Provide an Admin Console to:
   - Register apps
   - Assign PO ownership and notification emails
   - Configure policies (redaction, retention, thresholds)
   - Monitor installation health
7. Provide a PO Console to:
   - Review issues
   - Track status
   - Take actions (route, request info, create ticket, accept fix plan)

## 3) Non-Goals (v1)
1. Autonomous production deployment without human approval.
2. Capturing full session replay video.
3. Supporting mobile/native apps.
4. Building custom ML models or fine-tuning; use prompt-based LLM + retrieval only.
5. Replacing existing ticketing systems (integrate optionally; BritePulse is triage source).

## 4) Personas and Users
- **Internal App User**
  - Submits feedback or experiences errors.
  - Wants fast, simple reporting and confidence it will be addressed.
- **Product Owner (PO)**
  - Wants one digest and a clean, prioritized queue with recommended actions.
- **Engineering Owner**
  - Wants clear reproduction, evidence, and a sensible fix plan with tests.
- **BritePulse Admin**
  - Registers apps, assigns ownership, configures policies, manages keys.
- **Security/Compliance Stakeholder**
  - Ensures redaction, retention, access controls, and auditability.

## 5) Definitions
- **App**: A BriteCo internal web application that installs BritePulse (example: Cloud Run app URL).
- **Environment**: prod, stage, dev (or other configured environments).
- **Event**: A single captured input (feedback or telemetry error).
- **Issue**: A deduped, grouped, triaged unit representing a bug or request.
- **Fingerprint**: A stable signature used to dedupe error events.
- **Session ID**: Identifies a user session in the browser.
- **Trace ID**: Correlates front-end actions with back-end logs across services.
- **Daily Brief**: One email per app per day sent to configured PO email(s).

## 6) Product Surfaces

### A) In-App Widget (Client)
A persistent Intercom-style button present on every page of an installed app.

User flows:
- Choose type: Bug / Feature / Feedback
- Enter description
- Optional: reproduction steps
- Optional: screenshot attachment (explicit opt-in)
- Optional: allow contact for follow-ups

Auto-captured context (configurable):
- app_id, environment
- route / URL
- timestamp
- session_id
- trace_id
- app version (commit SHA / build id if available)
- user identity metadata (internal user id, role), sanitized per policy

### B) Telemetry Capture
Client-side:
- window.onerror
- unhandledrejection
- (optional) network failures classification

Server-side:
- exceptions and error logs from Cloud Run services via structured logs ingestion or sink export
- service metadata: service name, revision, version (commit SHA/build id) if available

### C) Admin Console
Capabilities:
- Create/edit apps and environments
- Assign PO ownership and notification email(s)
- Configure:
  - install keys
  - redaction policy
  - retention policy
  - AI eligibility thresholds
  - daily brief schedule and recipient list
- Installation health:
  - last event received
  - events per day
  - missing version tags rate
  - missing trace correlation rate
- Access control and audit log

### D) PO Console
Capabilities:
- Issue list with filtering and sorting:
  - severity (P0–P3)
  - status
  - environment
  - app version
  - trend / recurrence
- Issue detail:
  - timeline of related events
  - correlation view (feedback + errors + metadata)
  - AI analysis (structured output)
  - evidence references
- Actions:
  - Accept/reject triage
  - Change severity (with reason)
  - Assign owner
  - Create ticket (integration placeholder in v1 allowed)
  - Request more info (sends prompt back to reporter if contactable)
  - Snooze / block
  - Resolve

### E) Daily Intelligence Brief (Email)
One consolidated email per app per day:
- top 5–10 issues
- each issue includes:
  - title
  - severity
  - impact summary (users affected / frequency)
  - AI summary
  - recommended next action
  - link to issue in console
- link to full dashboard list

## 7) End-to-End Flows

### Flow 1: Manual Feedback Submission
1. User opens widget, selects category, enters description.
2. Client collects context (route, version, session, trace).
3. Client submits Feedback Event to ingestion.
4. System dedupes or creates Issue.
5. AI triage runs based on thresholds.
6. Issue appears in PO Console and is included in daily brief selection logic.

### Flow 2: Front-End Error Monitoring
1. Client captures error.
2. Client generates fingerprint and collects sanitized stack trace + metadata.
3. Client submits Error Event.
4. System dedupes into Issue and increments counts.
5. AI triage runs depending on severity and recurrence.

### Flow 3: Back-End Error Monitoring (Cloud Run)
1. Service throws exception/logs error with trace_id + service metadata.
2. BritePulse ingests logs via configured method.
3. System groups into Issues and correlates with client events via trace_id.

### Flow 4: Daily Brief
1. At scheduled time, system computes priorities per app.
2. Selects top issues and composes email.
3. Sends to configured PO email(s).
4. Logs send result and audit entry.

### Flow 5: PO Resolution Workflow
1. PO opens issue detail.
2. Reviews evidence and AI triage output.
3. Takes action (route, request info, ticket, resolve).
4. System records PO feedback to improve triage and ranking heuristics.

## 8) AI Triage Engine (High-Level)
LLM: Claude (Opus-class).  
Triage should be evidence-based and structured.

Required output elements:
- classification
- severity with rationale
- impact assessment
- root cause hypothesis
- proposed fix plan (1–3 options)
- test plan
- rollout/rollback suggestion
- confidence and explicit assumptions
- next action recommendation if confidence is low

Guardrails:
- no secrets in context
- no unredacted PII
- no claims without evidence references
- if uncertain, request more information

## 9) Prioritization and Ranking (High-Level)
Priority considers:
- severity
- user impact (unique users affected)
- frequency and trend velocity
- workflow criticality (configurable)
- environment (prod > stage > dev)
- recency

Daily brief is capped to avoid a single error cluster dominating.

## 10) MVP Scope (Recommended)
Start with one app (example: internal wizard) in stage, then prod.

MVP includes:
- widget + feedback
- client error capture + dedupe
- Admin Console: app registration + PO assignment + keys
- PO Console: issues list + detail + basic actions
- daily brief email
- basic RBAC and audit log
- AI triage for high-impact issues and user-submitted bug reports

MVP excludes:
- autonomous deploy
- advanced multi-repo mapping
- full back-end log ingestion if needed to simplify phase 1 (but aim to add quickly)

## 11) Success Metrics
- reduction in ad hoc pings to PO
- time to triage, time to resolution
- dedupe ratio (events -> issues)
- acceptance rate of AI triage
- P0 detection time improvement
- recurrence reduction after fixes

## 12) Open Decisions
- Source of truth for user identity and roles
- Ticketing integration target(s)
- Default daily brief time and timezone behavior
- Default retention durations by environment
- Feature request routing vs bug routing
- Maximum repo/service mappings per app in v1
