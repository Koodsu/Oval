# Bridge Incident Response

Effective: June 8, 2026

Use this runbook for safety reports, outages, compromised accounts, suspected data
exposure, and privacy requests. The launch owner must assign a named primary and
backup responder before public promotion.

## First 15 Minutes

1. Record when and how the issue was reported. Do not copy sensitive data into
   personal notes or chat.
2. Decide the severity:
   - P0: immediate physical danger, credible threat, active account takeover,
     confirmed sensitive-data exposure, or widespread outage.
   - P1: serious harassment, exploit attempt, repeated unauthorized access, or a
     core flow unavailable to many users.
   - P2: ordinary abuse, spam, isolated defects, and non-urgent data requests.
3. Protect people and data first. Remove dangerous content, suspend risky accounts,
   revoke sessions, or disable an affected feature when necessary.
4. Preserve relevant report records, request IDs, timestamps, deployment IDs, and
   logs. Do not retain unrelated personal data.

## Response Targets

- P0: acknowledge and begin response immediately.
- P1: acknowledge within 24 hours.
- P2: acknowledge within 72 hours.

Call emergency services for an immediate threat. Bridge is not an emergency
service. Do not investigate a potentially criminal event by contacting a suspected
offender directly.

## Incident Types

### Safety Or Abuse

Open the signed moderation review link, inspect the retained report context, remove
violating content, suspend or ban the account when justified, close the report with
brief factual notes, and notify the reporter only when appropriate.

### Outage

Check the live health endpoint, Vercel deployment status, database status, and recent
changes. Roll forward with a tested fix or use the hosting provider's deployment
rollback. Verify registration, login, pods, messaging, uploads, and cron jobs after
recovery.

### Compromised Account

Suspend access if needed, increment the account token version to revoke sessions,
assist with password reset through the verified email, review recent account
activity, and document unauthorized changes.

### Suspected Data Exposure

Stop the exposure, preserve evidence, rotate affected credentials, identify the data
and people involved, and contact qualified privacy counsel promptly to determine
notification duties and deadlines. Do not promise that an incident is contained
until scope has been verified.

### Privacy Request

Verify the requester through the account email, classify the request, use the
in-app export or deletion flow where applicable, record completion, and retain only
the limited safety records described in the Privacy Policy.

## Closeout

Confirm the service is stable, record actions and timestamps, notify affected people
when required, and add one concrete prevention task. Never include passwords,
verification codes, API keys, or full database exports in the incident record.
