import json
from asgiref.sync import async_to_sync
from project.asgi import application

from django.db import connections
from django.test import TestCase, override_settings, TransactionTestCase
from django.contrib.auth.models import User

from channels.db import database_sync_to_async
from channels.testing import WebsocketCommunicator, HttpCommunicator


@override_settings(
    CHANNEL_LAYERS={"default": {"BACKEND": "channels.layers.InMemoryChannelLayer"}}
)
class WSSlideshowPositiveTests(TransactionTestCase):
    # Insert test data into test database
    fixtures = ["/app/fixtures/app/data_ws_test.json"]

    # def setUp(self):
    #     print("Running setUp")
    #     User.objects.create_superuser(username="superadmin", password="superadmin", email="superadmin@app.dk")

    async def test_slideshow_connection(self):
        """
        Testing creating a WebSocket connection to the slideshows WS endpoint
        """
        print("### Connection to WS slideshow test begins")
        communicator = WebsocketCommunicator(
            application,
            "/ws/slideshows/1/?branch=15",
            headers=[(b"origin", b"http://localhost:5173")],
        )
        connected, _ = await communicator.connect()

        self.assertTrue(connected)
        await communicator.disconnect()
        print("### Connection to WS slideshow successful")

    async def test_send_token(self):
        """
        Testing getting authenticated in the WS connection, by creating a WS connection and sending a valid token.

        The token is received by making an HTTP POST request to login an user.
        """
        print("### Send token test begins")
        token = await self._user_login()

        self.communicator = WebsocketCommunicator(
            application,
            "/ws/slideshows/1/?branch=15",
            headers=[(b"origin", b"http://localhost:5173")],
        )
        connected, _ = await self.communicator.connect()
        assert connected

        await self.communicator.send_json_to({"type": "authenticate", "token": token})
        response = await self.communicator.receive_json_from()

        # Test if user has been authenticated
        self.assertEqual(response, {"type": "authenticated"})

        await self.communicator.disconnect()
        print("### Sending token was successful")

    async def _user_login(self):
        """
        Sends HTTP request to login an user (superadmin).

        :return: user token (JSON WebToken)
        """
        # Prepares body and header content
        body = json.dumps({"username": "superadmin", "password": "superadmin"}).encode(
            "utf-8"
        )
        headers = [
            (b"content-type", b"application/json"),
            (b"content-length", str(len(body)).encode("utf-8")),
            (b"origin", b"http://localhost:5173"),
        ]

        self.communicator = HttpCommunicator(
            application, "POST", "/api/token/", body=body, headers=headers
        )
        response = await self.communicator.get_response()

        # Test response from HTTP POST
        self.assertIn("body", response, "Response JSON did not contain 'body' key")
        data = json.loads(response["body"])
        self.assertEqual(response["status"], 200, f"Login failed: {data}")
        self.assertIn("access", data, "Response JSON did not contain 'access' key")

        return data["access"]

    def tearDown(self):
        """
        Disconnect communicators and database after test has ended.
        """
        print("running tearDown")
        if hasattr(self, "communicator"):
            async_to_sync(self.communicator.disconnect)()

        self.close_db_connections()
        super().tearDown()

    def close_db_connections(self):
        print("Closing DB connections")
        for conn in connections.all():
            conn.close()
