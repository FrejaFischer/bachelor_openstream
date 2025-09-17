#!/bin/sh
# runtime-entrypoint.sh
# Writes runtime-config.js based on environment variables and then starts nginx.

set -e

# Defaults (match app fallback)
: ${VITE_BASE_URL:="http://localhost:8000"}
: ${VITE_API_BASE_URL:=$VITE_BASE_URL}
: ${VITE_KEYCLOAK_URL:="http://localhost:8080"}
: ${VITE_DEBUG:="false"}

RUNTIME_FILE="/usr/share/nginx/html/runtime-config.js"

cat > "$RUNTIME_FILE" <<EOF
// This file is generated at container start to allow runtime configuration
window.__RUNTIME_CONFIG__ = {
  VITE_BASE_URL: "${VITE_BASE_URL}",
  VITE_API_BASE_URL: "${VITE_API_BASE_URL}",
  VITE_KEYCLOAK_URL: "${VITE_KEYCLOAK_URL}",
  VITE_DEBUG: "${VITE_DEBUG}"
};
EOF

# Ensure file permissions
chmod 644 "$RUNTIME_FILE"

# Exec the provided command (default to nginx)
if [ "$#" -gt 0 ]; then
  exec "$@"
else
  exec nginx -g 'daemon off;'
fi
