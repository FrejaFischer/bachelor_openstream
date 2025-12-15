# SPDX-FileCopyrightText: 2025 Freja Fischer Nielsen <https://github.com/FrejaFischer/bachelor_openstream>
# SPDX-License-Identifier: AGPL-3.0-only
from django.urls import re_path

from . import consumers

websocket_urlpatterns = [
    re_path(
        r"ws/slideshows/(?P<slideshow_id>\w+)/$", consumers.SlideshowConsumer.as_asgi()
    ),
]
