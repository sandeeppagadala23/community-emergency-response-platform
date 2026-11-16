
import os
from pathlib import Path
from urllib.parse import urlparse, unquote, parse_qs

from dotenv import load_dotenv
from corsheaders.defaults import default_headers

BASE_DIR = Path(__file__).resolve().parent.parent

# Load environment variables from backend/.env
load_dotenv(BASE_DIR / ".env")


def _environment_list(name, default):
    return [
        value.strip()
        for value in os.environ.get(name, default).split(",")
        if value.strip()
    ]


def _environment_bool(name, default="false"):
    return os.environ.get(name, default).strip().lower() in {
        "1", "true", "yes", "on"
    }


# ---------------------------------------------------------------------------
# SECURITY
# ---------------------------------------------------------------------------

DEBUG = _environment_bool("DJANGO_DEBUG", "true")

SECRET_KEY = os.environ.get(
    "DJANGO_SECRET_KEY",
    "django-insecure-local-development-key-change-before-deployment",
)

if not DEBUG and SECRET_KEY.startswith("django-insecure-"):
    raise ValueError(
        "A secure DJANGO_SECRET_KEY is required in production."
    )

ALLOWED_HOSTS = _environment_list(
    "DJANGO_ALLOWED_HOSTS",
    "localhost,127.0.0.1",
)

SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

secure_cookies = _environment_bool("DJANGO_SECURE_COOKIES", "false")

SESSION_COOKIE_SECURE = secure_cookies
CSRF_COOKIE_SECURE = secure_cookies

SESSION_COOKIE_SAMESITE = os.environ.get(
    "DJANGO_SESSION_COOKIE_SAMESITE",
    "None" if secure_cookies else "Lax",
)

CSRF_COOKIE_SAMESITE = os.environ.get(
    "DJANGO_CSRF_COOKIE_SAMESITE",
    "None" if secure_cookies else "Lax",
)

SECURE_SSL_REDIRECT = _environment_bool(
    "DJANGO_SECURE_SSL_REDIRECT", "false"
)

SECURE_HSTS_SECONDS = int(
    os.environ.get("DJANGO_SECURE_HSTS_SECONDS", "0")
)

SECURE_HSTS_INCLUDE_SUBDOMAINS = _environment_bool(
    "DJANGO_SECURE_HSTS_INCLUDE_SUBDOMAINS", "false"
)

SECURE_HSTS_PRELOAD = _environment_bool(
    "DJANGO_SECURE_HSTS_PRELOAD", "false"
)


# ---------------------------------------------------------------------------
# APPLICATION DEFINITION
# ---------------------------------------------------------------------------

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",

    # Third-party apps
    "rest_framework",
    "corsheaders",

    # Project apps
    "users",
    "society",
    "emergency_contacts",
    "emergency_reports",
    "emergency_alerts",
]


MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]


ROOT_URLCONF = "config.urls"


TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]


WSGI_APPLICATION = "config.wsgi.application"


# ---------------------------------------------------------------------------
# DATABASE
# Local development: SQLite
# Production: PostgreSQL using DATABASE_URL (Neon)
# ---------------------------------------------------------------------------

DATABASE_URL = os.environ.get("DATABASE_URL", "").strip()

if DATABASE_URL:
    parsed_database_url = urlparse(DATABASE_URL)

    if parsed_database_url.scheme not in ("postgres", "postgresql"):
        raise ValueError("DATABASE_URL must use PostgreSQL.")

    database_query = parse_qs(parsed_database_url.query)

    database_name = unquote(parsed_database_url.path.lstrip("/"))

    if not all([
        database_name,
        parsed_database_url.hostname,
        parsed_database_url.username,
    ]):
        raise ValueError("DATABASE_URL is missing required connection details.")

    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": database_name,
            "USER": unquote(parsed_database_url.username),
            "PASSWORD": unquote(parsed_database_url.password or ""),
            "HOST": parsed_database_url.hostname,
            "PORT": parsed_database_url.port or 5432,
            "CONN_MAX_AGE": 60,
            "OPTIONS": {
                "sslmode": database_query.get(
                    "sslmode", ["require"]
                )[0],
            },
        }
    }

else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }


# ---------------------------------------------------------------------------
# PASSWORD VALIDATION
# ---------------------------------------------------------------------------

AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": (
            "django.contrib.auth.password_validation."
            "UserAttributeSimilarityValidator"
        ),
    },
    {
        "NAME": (
            "django.contrib.auth.password_validation."
            "MinimumLengthValidator"
        ),
    },
    {
        "NAME": (
            "django.contrib.auth.password_validation."
            "CommonPasswordValidator"
        ),
    },
    {
        "NAME": (
            "django.contrib.auth.password_validation."
            "NumericPasswordValidator"
        ),
    },
]


# ---------------------------------------------------------------------------
# INTERNATIONALIZATION
# ---------------------------------------------------------------------------

LANGUAGE_CODE = "en-us"

TIME_ZONE = "Asia/Kolkata"

USE_I18N = True

USE_TZ = True


# ---------------------------------------------------------------------------
# STATIC FILES
# ---------------------------------------------------------------------------

STATIC_URL = "/static/"

STATIC_ROOT = BASE_DIR / "staticfiles"

STATICFILES_DIRS = [
    BASE_DIR / "static",
]

STORAGES = {
    "default": {
        "BACKEND": "django.core.files.storage.FileSystemStorage",
    },
    "staticfiles": {
        "BACKEND": (
            "whitenoise.storage.CompressedManifestStaticFilesStorage"
        ),
    },
}


# ---------------------------------------------------------------------------
# CORS
# ---------------------------------------------------------------------------

CORS_ALLOW_ALL_ORIGINS = False

CORS_ALLOW_CREDENTIALS = True

CORS_ALLOWED_ORIGINS = _environment_list(
    "DJANGO_CORS_ALLOWED_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173,https://community-emergency-response-platfo-chi.vercel.app",
)

CORS_ALLOW_HEADERS = (*default_headers,)


# ---------------------------------------------------------------------------
# CSRF
# ---------------------------------------------------------------------------

CSRF_TRUSTED_ORIGINS = _environment_list(
    "DJANGO_CSRF_TRUSTED_ORIGINS",
    "http://localhost:5173,"
    "http://127.0.0.1:5173,"
    "http://localhost:4173,"
    "http://127.0.0.1:4173,"
    "https://m4n4jr4f-4173.inc1.devtunnels.ms",
)


# ---------------------------------------------------------------------------
# DEFAULT PRIMARY KEY
# ---------------------------------------------------------------------------

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"


# ---------------------------------------------------------------------------
# LOGGING
# Keep detailed CSRF diagnostics in local development only.
# ---------------------------------------------------------------------------

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
        },
    },
    "loggers": {
        "django.security.csrf": {
            "handlers": ["console"],
            "level": "DEBUG" if DEBUG else "WARNING",
            "propagate": True,
        },
    },
}


# ---------------------------------------------------------------------------
# EMAIL
# ---------------------------------------------------------------------------

EMAIL_BACKEND = os.environ.get(
    "DJANGO_EMAIL_BACKEND",
    "django.core.mail.backends.console.EmailBackend",
)


# ---------------------------------------------------------------------------
# DJANGO REST FRAMEWORK
# ---------------------------------------------------------------------------

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "users.authentication.TabSessionAuthentication",
        "rest_framework.authentication.SessionAuthentication",
    ],
}

