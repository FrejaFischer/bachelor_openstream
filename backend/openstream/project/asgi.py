# SPDX-FileCopyrightText: 2025 Magenta ApS <https://magenta.dk>
# SPDX-License-Identifier: AGPL-3.0-only

"""
ASGI config for slideshow project.

It exposes the ASGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/5.1/howto/deployment/asgi/
"""

import os

from channels.routing import ProtocolTypeRouter, URLRouter
from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "project.settings")

django_asgi_app = get_asgi_application()
# ASGI can support multiple protocols - ex. Normal HTTP and WebSockets
application = ProtocolTypeRouter({
    "http": django_asgi_app,
     # "websocket": URLRouter([...])  # add later when creating ws routes
})
