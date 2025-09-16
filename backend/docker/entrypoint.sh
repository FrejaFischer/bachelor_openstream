#!/bin/sh

# SPDX-FileCopyrightText: 2025 Magenta ApS <https://magenta.dk>
# SPDX-License-Identifier: AGPL-3.0-only

# tells script to exit as soon as any line in the script fails
set -e

MAKE_MIGRATIONS=${MAKE_MIGRATIONS:=false}
MIGRATE=${MIGRATE:=true}
LOAD_FIXTURES=${LOAD_FIXTURES:=false}
DJANGO_ENV=${DJANGO_ENV:=production}

cd /app

# Database migrations
if [ "${MAKE_MIGRATIONS}" = true ]; then
  echo 'generating migrations'
  ./manage.py makemigrations --no-input
fi

if [ "${MIGRATE}" = true ]; then
  echo 'running migrations'
  ./manage.py migrate
fi

# Load fixtures
if [ "${LOAD_FIXTURES}" = true ]; then
  echo 'loading fixtures'
  if [ -f "/app/fixtures/app/data.json" ]; then
    ./manage.py loaddata /app/fixtures/app/data.json
  else
    echo 'No fixtures found at /app/fixtures/app/data.json'
  fi
fi

# Run the application
if [ "${DJANGO_ENV}" = "development" ]; then
  echo "Running openstream.dk in development mode (live reload)"
  ./manage.py compilemessages
  exec ./manage.py runserver 0.0.0.0:8000
fi

if [ "${DJANGO_ENV}" = "production" ]; then
    echo "Running openstream.dk in production mode"
    exec gunicorn project.wsgi:application --config /app/gunicorn-settings.py --bind 0.0.0.0:8000
fi