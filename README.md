
# Community Emergency Response Portal

React/Vite frontend for the Community Emergency Response Portal. The Django backend provides authenticated accounts and database-backed emergency alerts, notifications, contacts, and reports.

## Start the Application

Run the backend and frontend in separate PowerShell terminals.

### Backend (Django)

```powershell
Set-Location "C:\Users\Pagadala Venkatapath\Documents\ui  gg\ui  gg\backend"

.\.venv\Scripts\python.exe manage.py runserver 127.0.0.1:8001
```

### Frontend (React + Vite)

```powershell
Set-Location "C:\Users\Pagadala Venkatapath\Documents\ui  gg\ui  gg"

npm install
npm run dev -- --host 127.0.0.1 --port 5173
```

Open the application:

- Frontend: http://localhost:5173/
- Django Admin: http://localhost:8001/admin/

The Vite development server proxies API requests under `/api`, `/alerts`, and `/reports` to `http://127.0.0.1:8001`.

This local proxy is used when `VITE_API_BASE_URL` is unset. Production API configuration is handled separately.

### Database Configuration

Local development uses the existing SQLite database by default.

Django reads environment configuration from `backend/.env`.

For production, PostgreSQL is configured through `DATABASE_URL`. Production database migrations must be reviewed and applied deliberately after backing up and verifying existing data.

Do not run migrations against the production database until the database setup and data transfer plan is ready.

## Development Checks

### Frontend

```powershell
npm test -- --run
npm run build
npm run lint
```

### Backend

```powershell
Set-Location "C:\Users\Pagadala Venkatapath\Documents\ui  gg\ui  gg\backend"

..\backend\.venv\Scripts\python.exe manage.py check
..\backend\.venv\Scripts\python.exe manage.py makemigrations --check --dry-run
..\backend\.venv\Scripts\python.exe manage.py test
```

## Authentication and API

The application uses Django authentication with a per-tab session key.

After successful login or registration, the backend issues a session key. The frontend stores this key in `sessionStorage` and sends it with API requests using the `Authorization: Bearer` header.

Django validates the session key against its server-side session store. CSRF protection is also used for applicable requests.

The frontend's cached user information is only a display cache and is not proof of authentication.

On refresh, the frontend checks the cached account against `/api/auth/me/`. API requests include an expected-account marker that Django uses only to reject stale tabs, never to authenticate or authorize a request.

Signing in or out in another tab clears the other tab's cached authentication. Use separate browser profiles for simultaneous accounts.

Registration is rejected while that browser session is already authenticated.

Self-service registration creates resident accounts. Guardian, volunteer, security, and administrator privileges are assigned by authorized staff.

### API Endpoints

| Purpose | Endpoint |
|---|---|
| Session profile / login / logout / registration | `/api/auth/me/`, `/api/auth/login/`, `/api/auth/logout/`, `/api/auth/register/` |
| Create and list SOS alerts | `/alerts/api/sos/`, `/alerts/api/sos/list/` |
| Report arrival and confirm responder arrival | `/alerts/api/sos/<id>/check-in/`, `/alerts/api/sos/<id>/assignments/<assignment_id>/confirm-arrival/` |
| Update SOS lifecycle and location | `/alerts/api/sos/<id>/transition/`, `/alerts/api/sos/<id>/location/` |
| Read and mark in-app notifications | `/alerts/api/notifications/`, `/alerts/api/notifications/<id>/read/` |
| Guardian contact CRUD and OTP | `/api/guardian-contacts/`, `/api/guardian-contacts/<id>/send-otp/`, `/api/guardian-contacts/<id>/verify-otp/` |
| Reports and responder updates | `/reports/api/reports/`, `/reports/api/reports/<id>/status/` |

## Notification Simulation

In development, email uses Django's console backend and SMS is logged to the Django console.

These channels are recorded as **simulated**, not delivered.

No external SMS or email provider is configured.

## Responder Workflow

Verified Security users and administrators can acknowledge alerts, assign verified responders, and independently confirm each assigned responder's self-reported arrival.

Assigned verified responders can report arrival after the alert is acknowledged. GPS is not required, and the report alone does not advance the incident.

Only a verified Security user or administrator can confirm a specific assignment. The incident cannot move to In Progress until that assignment's confirmation is recorded.

The resident's separate arrival acknowledgment remains available and does not replace dispatch confirmation.

An assigned volunteer can resolve an in-progress alert only after their own arrival has been independently confirmed.

### Location Handling

When GPS is unavailable, residents can provide an address or landmark with an SOS.

Registered flat assignments are used as a text-only fallback when available.

The reporting resident or authorized security/admin staff can add a location description to an existing alert. This is audit-logged and is not represented as GPS coordinates.

## Django Environment

Django reads configuration from the backend project's `.env` file.

- `DJANGO_DEBUG` defaults to `true` for local development in the current settings.
- `DJANGO_ALLOWED_HOSTS` accepts comma-separated hostnames.
- `DJANGO_CORS_ALLOWED_ORIGINS` accepts comma-separated frontend origins.
- `DJANGO_CSRF_TRUSTED_ORIGINS` accepts comma-separated trusted origins.
- Wildcard CORS is disabled.

Production must use a secure secret key, `DEBUG=false`, HTTPS, and explicitly configured allowed hosts, CORS origins, and CSRF trusted origins.

Never commit actual `.env` files, passwords, database connection strings, or production credentials.
