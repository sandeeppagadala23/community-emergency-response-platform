# Milestone 3 API Reference

Base URL: `http://localhost:8001`

All API requests except the CSRF bootstrap and login require the bearer session key returned by login:

```http
Authorization: Bearer <tab_session_key>
```

The session key is a Django server-side session credential, not a JWT. Treat it as a password: do not log it, commit it, or share it. The frontend stores it per tab. Use separate Postman environments when testing identities in parallel. Unsafe requests also need the CSRF cookie and matching `X-CSRFToken` header.

## Authentication

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/auth/csrf/` | Set the CSRF cookie; response contains `csrfToken`. |
| POST | `/api/auth/login/` | Authenticate and return `{token, user}`. |
| POST | `/api/auth/register/` | Create a resident account and return `{token, user}`. |
| GET | `/api/auth/me/` | Return the identity associated with the bearer session. |
| POST | `/api/auth/logout/` | Delete only the supplied bearer session. |

Login body:

```json
{"identifier":"username-or-email","password":"<password>"}
```

Registration creates resident accounts only; roles are not accepted from the client.

## Emergency reports

| Method | Path | Purpose |
|---|---|---|
| GET | `/reports/api/reports/` | List reports visible to the authenticated user. |
| POST | `/reports/api/reports/` | Create a report; reporter is always `request.user`. |
| GET | `/reports/api/reports/?category=FIRE&status=PENDING&search=kitchen` | Filter by category/status and search title, location, description, or reporter username. Filters are optional. |
| GET | `/reports/api/reports/{id}/` | Read a report visible to the authenticated user. |
| PATCH | `/reports/api/reports/{id}/` | Edit an authorized report's editable fields. |
| PATCH | `/reports/api/reports/{id}/status/` | Apply an allowed status transition and record history. |
| GET | `/reports/api/reports/{id}/history/` | Read the report's history if the report is visible to the user. |
| GET | `/reports/api/volunteers/` | Admin-only list of active, verified volunteers without another active assignment. |
| POST | `/reports/api/reports/{id}/assign/` | Admin-only volunteer assignment after acknowledgement. |

Creation body:

```json
{
  "title": "Kitchen smoke",
  "incident_type": "FIRE",
  "location": "Block A, Flat 101",
  "description": "Smoke is coming from the kitchen.",
  "latitude": 12.971599,
  "longitude": 77.594563
}
```

`title`, `incident_type`, `location`, and `description` are required. Coordinates are optional but must be supplied together, and must be within latitude `[-90, 90]` and longitude `[-180, 180]`. The backend associates the report with the validated authenticated user.

Status values are `PENDING` (display label “Reported”), `ACKNOWLEDGED`, `ASSIGNED`, `IN_PROGRESS`, `RESOLVED`, and `CLOSED`. Assignment requires `ACKNOWLEDGED` (or an existing `ASSIGNED` status); assignment updates status to `ASSIGNED`, writes history, and notifies the assigned volunteer. Only administrators can assign; verified security can manage report status; a volunteer can manage only a report assigned to them and can only move it to `IN_PROGRESS` or `RESOLVED`.

New reports notify active administrators and verified security staff; assignment notifies the assigned volunteer; status changes notify the reporter when the actor is a different user. Each inbox response is recipient-scoped.

Status body:

```json
{"status":"ACKNOWLEDGED","response_notes":"Security team is responding."}
```

Assignment body:

```json
{"volunteer_id":17}
```

Access rules: administrators and verified security users can list all reports; verified volunteers can see their own and assigned reports; other users can see only their own. An inaccessible report is returned as `404` to avoid disclosing its existence. Invalid data returns `400`; missing/invalid authentication returns `401`.

## SOS alerts

| Method | Path | Purpose |
|---|---|---|
| POST | `/alerts/api/sos/` | Create an SOS alert and recipient notifications. |
| GET | `/alerts/api/sos/list/` | List alerts visible to the authenticated user. |
| GET | `/alerts/api/sos/{id}/` | Read visible alert detail and event/assignment information. |
| GET | `/alerts/api/responders/` | List active, verified security personnel and volunteers (verified security/admin only). |
| POST | `/alerts/api/sos/{id}/assign/` | Assign an active, verified responder to an open SOS (verified security/admin only). |
| POST | `/alerts/api/sos/{id}/check-in/` | The authenticated assigned responder self-reports arrival; GPS is optional and the report does not change incident status. |
| POST | `/alerts/api/sos/{id}/assignments/{assignment_id}/confirm-arrival/` | Verified security/admin independently confirms the arrival report for that specific assignment. |
| POST | `/alerts/api/sos/{id}/acknowledge/` | Security/admin acknowledges a pending alert. |
| POST | `/alerts/api/sos/{id}/transition/` | Security/admin moves an alert through an allowed status; `IN_PROGRESS` requires the confirmed assignment ID. |

Example request:

```json
{
  "category": "MEDICAL",
  "message": "Immediate assistance needed",
  "location_text": "Block A entrance",
  "latitude": 12.971599,
  "longitude": 77.594563
}
```

Coordinates are optional but must be supplied together and within geographic ranges. Send a unique UUID in the `Idempotency-Key` header to make retries safe; the same user/key pair returns the original alert rather than creating a duplicate. The authenticated request user is always the reporter. Supported categories and allowed transitions are validated by the backend.

Active administrators can create and manage volunteer users and profiles in Django Admin (`/admin/`); set the profile role to Volunteer and mark the profile verified before assignment. At SOS creation, verified security, administrators, and verified linked guardians are notified; volunteers receive an in-app notification only when assigned. Verified security personnel and administrators can assign responders from the incident detail view or assignment API. Each assignment is stored, recorded in the incident timeline, and creates a recipient-private, database-backed `SOS_ASSIGNED` in-app notification. Repeating an assignment request does not create duplicate assignments or assignment notifications.

Administrators and verified security users can view all SOS alerts. Verified volunteers can view only alerts they reported or that are assigned to them; guardians see linked residents' alerts, and residents see their own. An assigned, verified responder can self-report arrival only while the alert is acknowledged; GPS is optional and is not accepted as proof of presence. This report does not change the alert status. Verified security personnel or administrators independently confirm a specific assigned responder using the confirmation endpoint. Confirmation is idempotent and recorded with the assignment, responder, authenticated confirmer, confirmer role, timestamp, result, and optional note. The generic transition endpoint requires the `assignment_id` of a confirmed arrival to move an acknowledged SOS to `IN_PROGRESS`; resident acknowledgment is separate and does not satisfy this requirement. A volunteer can resolve an in-progress SOS only if that volunteer's own assignment has an independent arrival confirmation. Acknowledging alerts, confirmation, other status transitions, responder management, and dispatch logs remain restricted to security/admin as applicable.

Example transition body after confirming assignment `17`:

```json
{"status":"IN_PROGRESS","assignment_id":17}
```

## Recipient-private notifications

| Method | Path | Purpose |
|---|---|---|
| GET | `/alerts/api/notifications/` | List only the authenticated user's in-app notifications. |
| GET | `/alerts/api/notifications/unread-count/` | Return `{"count": n}` for that user. |
| PATCH | `/alerts/api/notifications/{id}/read/` | Mark one owned notification as read. |
| PATCH | `/alerts/api/notifications/read-all/` | Mark all of the current user's in-app notifications as read. |

Notification records may refer to either an SOS alert or an emergency report. `notification_type`, `alert_id`, `report_id`, `incident_id`, `title`, `message`, `status`, `read`, and timestamps are returned by the inbox endpoint. A notification owned by another user is not readable or mutable by changing its ID.

Email and SMS use Django's console backend in development. A console log is a simulation, not delivery confirmation; the in-app notification is the database-backed record.

## Postman

Import `postman/Community-Emergency-Response-M3.postman_collection.json` and `postman/Local API Tests.postman_environment.json` from this directory. Select the local environment, enter an authorized test account's identifier/password, and run the CSRF bootstrap followed by login. For parallel role testing, clone the environment per account; each active environment stores its own session key. Assignment requests require a staff administrator, an acknowledged report, and at least one active verified volunteer. Do not export/share an environment after entering credentials or session keys.
