# import pytest
# from channels.testing import WebsocketCommunicator
# from django.test import override_settings
# from project.asgi import application

from django.test import TestCase


class SmokeTest(TestCase):
    def test_smoke(self):
        print("This test ran!")
        self.assertTrue(True)
