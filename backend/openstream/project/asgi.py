# SPDX-FileCopyrightText: 2025 Magenta ApS <https://magenta.dk>
# SPDX-FileCopyrightText: 2025 Freja Fischer Nielsen <https://github.com/FrejaFischer/bachelor_openstream>
# SPDX-License-Identifier: AGPL-3.0-only

"""
ASGI config for slideshow project.

It exposes the ASGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/5.1/howto/deployment/asgi/
"""

import os

from channels.auth import AuthMiddlewareStack
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.security.websocket import OriginValidator
from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "project.settings")
# Initialize Django ASGI application early to ensure the AppRegistry
# is populated before importing code that may import ORM models.
django_asgi_app = get_asgi_application()

from project.routing import websocket_urlpatterns
from project.settings import CORS_ALLOWED_ORIGINS

# ASGI can support multiple protocols - ex. Normal HTTP and WebSockets
# First the ProtocolTypeRouter check which kind of request is being made
application = ProtocolTypeRouter(
    {
        "http": django_asgi_app,
        "websocket": OriginValidator(
            AuthMiddlewareStack(URLRouter(websocket_urlpatterns)), CORS_ALLOWED_ORIGINS
        ),
    }
)
# If it is a WS protocol (ws:// or wss://):
# - OriginValidator checks if the origin is allowed based on env variable (same used as HTTP CORS rules)
# - AuthMiddlewareStack will make the connection’s scope with a reference to the clients user
# - URLRouter will route it to a particular consumer, based on the provided url patterns
