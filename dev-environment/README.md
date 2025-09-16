# Development Environment

This directory contains environment configuration files for both frontend and backend development.

## Structure

```
dev-environment/
├── backend/
│   ├── fixtures/           # Django fixtures for database seeding
│   ├── realm-import/       # Keycloak realm import files
│   ├── initdb.sh          # Database initialization script
│   ├── keycloak.env       # Keycloak environment variables
│   └── openstream.env     # Backend/Django environment variables
└── frontend/
    ├── frontend.env       # Frontend development environment variables
    └── production.env     # Frontend production environment variables
```

## Backend Environment (backend/)

- **openstream.env**: Contains Django and database configuration
- **keycloak.env**: Contains Keycloak authentication server configuration
- **fixtures/**: Database fixtures for development data
- **realm-import/**: Keycloak realm configuration
- **initdb.sh**: PostgreSQL initialization script

## Frontend Environment (frontend/)

- **frontend.env**: Contains frontend development environment variables (DEPLOYMENT_MODE=development)
- **production.env**: Contains frontend production environment variables (DEPLOYMENT_MODE=production)

### Frontend Deployment Modes

The frontend Docker service supports two targets based on the `DEPLOYMENT_MODE` environment variable:

- **Development mode** (`DEPLOYMENT_MODE=development`):
  - Uses `npm run dev` with Vite dev server
  - Enables hot reloading and live development
  - Exposes port 5173
  - Mounts source code for live editing

- **Production mode** (`DEPLOYMENT_MODE=production`):
  - Uses `npm run build` to create optimized build
  - Serves static files via nginx
  - Exposes port 4173 (matches Vite preview port)
  - Includes security headers and asset caching

## Usage

### Quick Start Commands

```bash
# Development mode (with hot reloading)
just up-dev

# Production mode (optimized build with nginx)
just up-prod

# Or manually with environment variable
DEPLOYMENT_MODE=development docker compose up --build
DEPLOYMENT_MODE=production docker compose up --build
```

### Frontend URLs

- **Development**: http://localhost:5173 (Vite dev server)
- **Production**: http://localhost:4173 (nginx static server)

The Docker Compose file automatically uses the environment files when starting services. The backend services use the backend environment files, and the frontend uses the appropriate frontend environment file based on the deployment mode.

## Security Note

These are development environment files and should not contain sensitive production data. For secure configurations, create `overrides.env` files in the respective directories that are not tracked by git.
