# Deployment Preparation

This config prepares separate Render (Django/PostgreSQL API) and Vercel (React/Vite) projects. It does not create accounts, provision a database, run a live deployment, or migrate production data.

## Local development

Start the backend from the Django project directory (use its configured virtual environment and local `.env`):

```powershell
Set-Location 'C:\Users\Pagadala Venkatapath\Documents\projects\Emergency-Response-Project\Web-Based Community Emergency Response System'
.\venv\Scripts\python.exe manage.py runserver 127.0.0.1:8001
```

In another terminal, start the frontend:

```powershell
Set-Location 'C:\Users\Pagadala Venkatapath\Documents\ui  gg\ui  gg'
npm run dev -- --host 127.0.0.1 --port 5173
```

Open the frontend at `http://localhost:5173/` and Django Admin at `http://localhost:8001/admin/`. Use `https://` for deployed browser geolocation and PWA installation.

## Backend: Render

1. Connect the backend repository containing `manage.py` and `render.yaml`.
2. Provision PostgreSQL with a persistent provider and add its private connection URL as `DATABASE_URL`. Use a database backup before the first production migration.
3. Configure the Render service's unsynced variables:
   - `DJANGO_ALLOWED_HOSTS`: the exact Render API host, for example `community-emergency-api.onrender.com`.
   - `DJANGO_CORS_ALLOWED_ORIGINS`: the exact Vercel origin, including `https://`, for example `https://community-emergency-ui.vercel.app`.
   - `DJANGO_CSRF_TRUSTED_ORIGINS`: the same exact HTTPS frontend origin.
4. Keep `DJANGO_DEBUG=false`, `DJANGO_SECURE_COOKIES=true`, and `DJANGO_SECURE_SSL_REDIRECT=true`. Render generates the secret key through the blueprint; never commit `.env` or database credentials.
5. Before serving the application, run `python manage.py check --deploy` and `python manage.py migrate --plan` with the production environment. Review the plan and back up the database, then apply `python manage.py migrate --noinput` as a deliberate deployment step. Do not run `flush`, drop/recreate the database, or reset user data.
6. Deploy with the blueprint's `pip install -r requirements.txt && python manage.py collectstatic --noinput` build and Gunicorn start command. Verify the health URL and admin login after deployment.

The database URL parser accepts `postgres://` and `postgresql://`. Remote PostgreSQL connections default to `sslmode=require` unless a query parameter explicitly configures it.

## Frontend: Vercel

1. Import the frontend folder as a Vite project. Set the build command to `npm run build` and output directory to `dist`.
2. Set `VITE_API_BASE_URL` to the deployed Django API origin, without a trailing slash. Do not use a local URL in production.
3. Add that same exact public origin to Django's `DJANGO_CORS_ALLOWED_ORIGINS` and `DJANGO_CSRF_TRUSTED_ORIGINS`.
4. Verify registration/login, browser geolocation over HTTPS, report creation, notifications, and refresh/deep links after deploy.

`vercel.json` sends client-side routes back to `index.html`. The frontend and backend are currently in separate local project directories, so configure them as separate deployments or assemble them into a repository without copying local secrets or database files.

## Limitations and deployment checks

- No provider account, production URL, hosted database, test credentials, or deployment authorization was supplied; no live deployment or production migration has been performed.
- Email and SMS remain console-backend simulations; they are not delivery confirmations.
- Configure and verify PostgreSQL backups, retention, access controls, and monitoring with the hosting provider before production use.
- The Render blueprint explicitly enables one-year HSTS and subdomain coverage. These secure-cookie/redirect/HSTS flags default off for the existing local HTTP development setup. HSTS preload is intentionally off until a production domain and every affected subdomain have been confirmed HTTPS-only; Django's `security.W021` warning is expected until that opt-in is made.
- Browser notifications, install prompts, offline caching, and GPS require a secure origin (HTTPS, except `localhost`). Test them on actual supported devices before advertising production availability.
- Run backend tests and frontend checks locally before deploying. For a database that contains existing records, inspect migrations and make a backup before applying them.
