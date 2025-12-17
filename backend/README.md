# OpenStream Backend

API for the OpenStream frontend, made with Django & Django-Rest-Framework.

## Development

We use docker both in production and for development, so the repo comes with a docker compose file (`compose.yml`).
Running the docker compose file will start 5 containers:

* `openstream` - The Django Backend application
* `openstream-frontend` - Frontend made with NodeJS & Vite
* `openstream-cron` - CRON container, based on the backend docker-image
* `openstream-keycloak` - Keycloak development instance
* `openstream-db` - Postgres db server with databases for the backend & keycloak
* `redis` - Used for Django Channel layers to handle communication between clients Websocket connections to slideshows

Configurations / environment variables for each container can be found in the folder `dev-environment/`.

### Installation

Install poetry (https://python-poetry.org/docs/#installation), which is used for intellisense in our IDEs when developing locally:

```shell
pipx install poetry
```

#### Clone GIT repository & install using poetry

```shell
git clone git@git.magenta.dk:os2borgerpc/openstream/openstreamadminsite.git
cd openstreamadminsite

poetry install
```

### IDEs

#### VSCode configuration

If you open the entire GIT repository folder in VSCode, you need to configure the `PYTHONPATH` in order
for VSCode to correctly autocomplete modules & packages.

Create the following files:

```json
// File: .vscode/settings.json
{
    "python.envFile": "${workspaceFolder}/.env",
}
```

```bash
# File: .env
PYTHONPATH=${PYTHONPATH}:${workspaceFolder}/openstream
```

NOTE: These files are in `.gitignore`.

### Running the project (Docker & Compsoe)

You need to have Docker & Docker Compose, or Podman and Podman Compose installed.

To start the application run following:

```shell
docker compose up -d
```

You can now access the site at: http://localhost:8000

### Developing with `just`

The project have a `justfile`, with some helper commands. Ex. to

```shell
just run
```

## WebSocket connection
OpenStream will handle WebSocket connections (ws:// + wss://) with Django Channels. We have implemented these custom closing codes:
* `4001` - Unauthorized / unathenticated
* `4002` - Invalid first message / missing authentication message
* `4003` - Forbidden - user has no access
* `4004` - data missing (ex. token missing)
* `4005` - Invalid JSON
* `4006` - Generic error
* `4007` - Redis error

## STATIC files

OpenStream hosts static files using the Whitenoise middleware (`whitenoise.middleware.WhiteNoiseMiddleware`).

Whitenoise will host files specified in `STATIC_ROOT` (`/data/static`) when running in production (`DEBUG=False`).

When running in development (`DEBUG=True`), static files are served directly from the `static/` folder in each Django app.
This is also the reason why we have an empty Django app called `frontend`. During the Docker build, frontend dependencies
from `npm ci` are stored in the folder `/app/frontend/static`. This is done to prevent volume-mount problems during development,
since we mount `./openstream/app:/app/app`. If we stored the frontend npm dependencies in `/app/app/static`, these would be
overridden by the Docker Compose volume mount.

## Production

### SUBJECT TO CHANGE

The OpenStream `Dockerfile` is written with `production` as the default environment, which makes configuration
of `.gitlab-ci.yml` very minimal.

### Running production locally

In order to run OpenStream's production build locally, we need to override the `compose.yaml`-file in the project root,
since that file is configured for development.

To do so, make the following `compose.override.yml` file:

```yaml
services:
  openstream:
    container_name: openstream-prod
    build:
      context: .
      dockerfile: docker/Dockerfile
      target: production
      args:
        INSTALL_DEV_DEPS: false
    environment:
      - DJANGO_ENV=production
```

Now run the docker compose up command with the `--build`-flag:

```shell
docker compose up -d --build
```

OBS: To revert back to the default development setup, just delete the `compose.override.yaml` file or comment out all the lines in it.

Note: The production image now runs `manage.py collectstatic --noinput` during container startup (entrypoint) so
static assets (including the Django admin CSS) are written to `/data/static` and served by WhiteNoise. Also ensure
`STATIC_URL` is set to begin with a leading slash (`/static/`) so templates generate correct absolute paths.

### Using MinIO / local S3 for media files

If you want to use a local MinIO server for media uploads, set the env vars below in your container or `.env` file.

Example env vars:

```env
# minio running on localhost:9000
AWS_S3_KEY=minioaccesskey
AWS_S3_SECRET=miniosecretkey
AWS_S3_BUCKET=infoscreen
AWS_S3_ENDPOINT_URL=http://localhost:9000
```

With the above, Django will construct MEDIA_URL from the endpoint and bucket, e.g.: `http://localhost:9000/infoscreen/`.
This ensures generated file URLs point to the actual MinIO host and port instead of a fabricated `<bucket>.local` domain.