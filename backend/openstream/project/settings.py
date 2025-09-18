# SPDX-FileCopyrightText: 2025 Magenta ApS <https://magenta.dk>
# SPDX-License-Identifier: AGPL-3.0-only

from datetime import timedelta
from pathlib import Path
import os

###############################################################################
# Base Directories
###############################################################################
BASE_DIR = Path(__file__).resolve().parent.parent

###############################################################################
# Security and General Settings
###############################################################################

PRODUCTION = os.environ.get("ENV", "production") == "production"

SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY")
SLIDETYPE_BASE_API_URL = os.environ.get(
    "SLIDETYPE_BASE_API_URL", "http://localhost:9000/api"
)
SPEEDADMIN_API_KEY = os.environ.get("SPEEDADMIN_API_KEY")
KMD_API_KEY = os.environ.get("KMD_API_KEY")
FRONTDESK_API_KEY = os.environ.get("FRONTDESK_API_KEY")
WINKAS_USERNAME = os.environ.get("WINKAS_USERNAME")
WINKAS_PW = os.environ.get("WINKAS_PW")
WINKAS_CONTRACTCODE = os.environ.get("WINKAS_CONTRACTCODE")


DEBUG = os.environ.get("DEBUG") == "True"

if os.environ.get("ALLOWED_HOSTS"):
    ALLOWED_HOSTS = os.environ.get("ALLOWED_HOSTS").split(",")
else:
    ALLOWED_HOSTS = []

if os.environ.get("CSRF_TRUSTED_ORIGINS"):
    CSRF_TRUSTED_ORIGINS = os.environ.get("CSRF_TRUSTED_ORIGINS").split(",")
else:
    CSRF_TRUSTED_ORIGINS = []

###############################################################################
# Media Files and DigitalOcean Spaces (Using Django 4.2+ STORAGES)
###############################################################################

DO_SPACE_KEY = os.environ.get("DO_SPACE_KEY")
DO_SPACE_SECRET = os.environ.get("DO_SPACE_SECRET")
DO_SPACE_BUCKET = os.environ.get("DO_SPACE_BUCKET")

if DO_SPACE_KEY and DO_SPACE_SECRET and DO_SPACE_BUCKET:
    AWS_ACCESS_KEY_ID = DO_SPACE_KEY
    AWS_SECRET_ACCESS_KEY = DO_SPACE_SECRET
    AWS_STORAGE_BUCKET_NAME = DO_SPACE_BUCKET
    AWS_S3_ENDPOINT_URL = "https://fra1.digitaloceanspaces.com"
    AWS_S3_CUSTOM_DOMAIN = f"{DO_SPACE_BUCKET}.fra1.digitaloceanspaces.com"
    AWS_S3_OBJECT_PARAMETERS = {"CacheControl": "max-age=86400"}
    AWS_DEFAULT_ACL = "public-read"

    STORAGES = {
        "default": {
            "BACKEND": "storages.backends.s3boto3.S3Boto3Storage",
        },
        "staticfiles": {
            "BACKEND": "whitenoise.storage.CompressedStaticFilesStorage",
        },
    }
    MEDIA_URL = f"https://{AWS_S3_CUSTOM_DOMAIN}/"
    # No MEDIA_ROOT needed because we're using Spaces for media
else:
    STORAGES = {
        "default": {
            "BACKEND": "django.core.files.storage.FileSystemStorage",
        },
        "staticfiles": {
            "BACKEND": "whitenoise.storage.CompressedStaticFilesStorage",
        },
    }
    MEDIA_URL = "/media/"
    MEDIA_ROOT = os.path.join(BASE_DIR, "media")

###############################################################################
# Application Definition
###############################################################################

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # 3rd party apps
    "rest_framework",  # Django REST Framework
    "rest_framework_simplejwt",  # Simple JWT for authentication
    "corsheaders",  # CORS headers
    "storages",  # django-storages for DigitalOcean Spaces
    # OpenStream Apps
    "osauth.apps.OSAuthConfig",
    "app.apps.App",
    "sso.apps.SSOConfig",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    # WhiteNoise serves static files directly when DEBUG=False
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

###############################################################################
# CORS Settings
###############################################################################

if os.environ.get("CORS_ALLOWED_ORIGINS"):
    CORS_ALLOWED_ORIGINS = os.environ.get("CORS_ALLOWED_ORIGINS").split(",")
else:
    CORS_ALLOWED_ORIGINS = ["http://localhost:5173", "http://localhost:4173"]

CORS_ALLOW_HEADERS = [
    "accept",
    "accept-encoding",
    "authorization",
    "content-type",
    "dnt",
    "origin",
    "user-agent",
    "x-csrftoken",
    "x-requested-with",
    "x-api-key",
]

ROOT_URLCONF = "project.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "project.wsgi.application"

###############################################################################
# Database Configuration
###############################################################################

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.environ.get("DATABASE_NAME", "db"),
        "USER": os.environ.get("DATABASE_USERNAME", "db"),
        "PASSWORD": os.environ.get("DATABASE_PASSWORD", "dbpassword"),
        "HOST": os.environ.get("DATABASE_HOST", "db"),
        "PORT": os.environ.get("DATABASE_PORT", "5432"),
    }
}

###############################################################################
# Password Validation
###############################################################################

AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"
    },
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

USE_TZ = True
TIME_ZONE = "Europe/Copenhagen"


###############################################################################
# Static Files
###############################################################################

STATIC_URL = "/static/"
STATIC_ROOT = "/data/static"

###############################################################################
# Default Primary Key Field Type
###############################################################################

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

###############################################################################
# Django REST Framework and Simple JWT
###############################################################################

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=99999),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=1),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "ALGORITHM": "HS256",
    "SIGNING_KEY": SECRET_KEY,
    "AUTH_HEADER_TYPES": ("Bearer",),
    "USER_ID_FIELD": "id",
    "USER_ID_CLAIM": "user_id",
}

###############################################################################
# Logging Configuration
###############################################################################

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "filters": {
        "require_debug_false": {
            "()": "django.utils.log.RequireDebugFalse",
        },
    },
    "handlers": {
        "console": {
            "level": "WARNING",  # Change to "ERROR" or "CRITICAL" to reduce more output
            "class": "logging.StreamHandler",
        },
    },
    "loggers": {
        "django": {
            "handlers": ["console"],
            "level": "WARNING",  # Change to "ERROR" to suppress most logs
            "propagate": True,
        },
        "django.server": {  # Suppresses server startup logs
            "handlers": ["console"],
            "level": "ERROR",
            "propagate": False,
        },
    },
}

###############################################################################
# Additional Security Settings
###############################################################################

X_FRAME_OPTIONS = "SAMEORIGIN"

USE_TZ = True
TIME_ZONE = "Europe/Copenhagen"

###############################################################################
# EMAIL
###############################################################################

EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
EMAIL_HOST = os.environ.get("EMAIL_HOST", "smtp.eu.mailgun.org")
EMAIL_PORT = int(os.environ.get("EMAIL_PORT", "587"))
EMAIL_USE_TLS = os.environ.get("EMAIL_USE_TLS", "True").lower() == "true"
EMAIL_HOST_USER = os.environ.get("EMAIL_HOST_USER", "")
EMAIL_HOST_PASSWORD = os.environ.get("EMAIL_HOST_PASSWORD", "")
DEFAULT_FROM_EMAIL = EMAIL_HOST_USER or "noreply@openstream.dk"

###############################################################################
# Keycloak Configuration
###############################################################################

KEYCLOAK_HOST = os.environ.get("KEYCLOAK_HOST", "auth.openstream.dk")
KEYCLOAK_PORT = os.environ.get("KEYCLOAK_PORT", "")

KEYCLOAK_REALM = os.environ.get("KEYCLOAK_REALM", "openstream-customer_name-here")
KEYCLOAK_CLIENT_ID = os.environ.get(
    "KEYCLOAK_CLIENT_ID", "openstream-customer_name-client_id-here"
)
KEYCLOAK_CLIENT_SECRET = os.environ.get(
    "KEYCLOAK_CLIENT_SECRET", "openstream-customer_name-client_secret-here"
)

KEYCLOAK_TIMEOUT = int(os.environ.get("KEYCLOAK_TIMEOUT", "5"))
