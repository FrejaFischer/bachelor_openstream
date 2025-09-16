# SPDX-FileCopyrightText: 2025 Magenta ApS <https://magenta.dk>
# SPDX-License-Identifier: AGPL-3.0-only
import logging
from rest_framework import exceptions

from osauth.keycloak import KeycloakError

logger = logging.getLogger(__name__)


def handle_keycloak_error(e: KeycloakError):
    if e.status_code == 400:
        raise exceptions.ValidationError(e.data)
    elif e.status_code == 401:
        raise exceptions.AuthenticationFailed(e.data)
    elif e.status_code == 403:
        raise exceptions.PermissionDenied(e.data)

    logger.exception(f"unknown keycloak error: {e.data}")
    raise exceptions.APIException
