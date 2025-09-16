#!/usr/bin/env just --justfile

# SPDX-FileCopyrightText: 2025 Magenta ApS <https://magenta.dk>
# SPDX-License-Identifier: AGPL-3.0-only

set shell := ["bash", "-uc"]
set windows-shell := ['C:/Program Files/Git/bin/bash.exe', '-uc']

django_container := "openstream"
compose_file := "compose.yaml"

default:
    @just --list

container_managepy +COMMAND:
    docker exec -i --tty {{django_container}} ./manage.py {{COMMAND}}

up *FLAGS:
    docker compose up {{FLAGS}}

up-dev:
    DEPLOYMENT_MODE=development docker compose up --build

up-prod:
    DEPLOYMENT_MODE=production docker compose up --build

#Sets permissions to RW for all, but makes sure git ignores it.
fix_perms:
    cd backend && sudo chmod 777 -R .
    cd backend && git config core.fileMode false

run:
    docker compose up --build

down:
    docker compose down --volumes

run_and_fix_perms:
    @just down
    @just fix_perms
    @just run

enter_container:
    docker exec -it {{django_container}} bash

update_fixtures:
    docker exec -i --tty {{django_container}} bash -c "python manage.py dumpdata --indent 2 --exclude auth.permission --exclude contenttypes --exclude app.slideshowplayerapikey > fixtures/app/data.json"

lint:
    cd backend && black .
    cd frontend && npm run format:all
