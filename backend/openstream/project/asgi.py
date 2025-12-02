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
from channels.security.websocket import AllowedHostsOriginValidator
from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "project.settings")
# Initialize Django ASGI application early to ensure the AppRegistry
# is populated before importing code that may import ORM models.
django_asgi_app = get_asgi_application()

from project.routing import websocket_urlpatterns

# ASGI can support multiple protocols - ex. Normal HTTP and WebSockets
# First the ProtocolTypeRouter check which kind of request is being made
application = ProtocolTypeRouter({
    "http": django_asgi_app,
    "websocket": AllowedHostsOriginValidator(
            AuthMiddlewareStack(URLRouter(websocket_urlpatterns))
        ),
})
# If it is a WS protocol (ws:// or wss://), then it check if its an allowed host, who is the origin (set to accept all currently in the openstream.env)
# AuthMiddlewareStack will make the connection’s scope with a reference to the currently authenticated user (?)
# URLRouter will route it to a particular consumer, based on the provided url patterns