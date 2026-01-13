import json
from asgiref.sync import async_to_sync
from project.asgi import application

from django.db import connections
from django.test import override_settings, TransactionTestCase

from channels.testing import WebsocketCommunicator, HttpCommunicator


@override_settings(
    CHANNEL_LAYERS={"default": {"BACKEND": "channels.layers.InMemoryChannelLayer"}}
)
class WSSlideshowBase(TransactionTestCase):
    """
    Base class for WebSocket Slideshow test classes
    """

    # Insert test data into test database
    fixtures = ["/app/fixtures/app/data_ws_test.json"]

    async def _user_login(self):
        """
        Helper: Sends HTTP request to login an user (superadmin).

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

    async def _get_authenticated_communicator(self):
        """
        Helper: Logs in the superadmin user and returns a connected WebsocketCommunicator.
        """
        # Login
        token = await self._user_login()

        # Setup communicator
        self.communicator = WebsocketCommunicator(
            application,
            "/ws/slideshows/1/?branch=15",
            headers=[(b"origin", b"http://localhost:5173")],
        )

        # Connect
        connected, _ = await self.communicator.connect()
        self.assertTrue(connected, "Connection did NOT equal to true as expected")

        # Authenticate
        await self.communicator.send_json_to({"type": "authenticate", "token": token})
        response = await self.communicator.receive_json_from()
        self.assertEqual(
            response, {"type": "authenticated"}, "WS Authentication failed"
        )

        return self.communicator

    def tearDown(self):
        """
        Disconnect communicators and database after test has ended.
        """
        if hasattr(self, "communicator"):
            async_to_sync(self.communicator.disconnect)()

        self.close_db_connections()
        super().tearDown()

    def close_db_connections(self):
        for conn in connections.all():
            conn.close()


class WSSlideshowPositiveTests(WSSlideshowBase):
    """
    Test class containing positive tests for WebSocket Slideshow
    """

    async def test_slideshow_connection(self):
        """
        Testing creating a WebSocket connection to the slideshows WS endpoint
        """
        communicator = WebsocketCommunicator(
            application,
            "/ws/slideshows/1/?branch=15",
            headers=[(b"origin", b"http://localhost:5173")],
        )
        connected, _ = await communicator.connect()

        self.assertTrue(connected, "Connection did NOT equal to true as expected")
        await communicator.disconnect()

    async def test_send_token(self):
        """
        Testing getting authenticated in the WS connection, by sending a valid token.

        The token is received by making an HTTP POST request to login an user.
        """
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
        self.assertEqual(
            response, {"type": "authenticated"}, "WS Authentication failed"
        )

        await self.communicator.disconnect()

    async def test_receive_slideshow_data(self):
        """
        Testing receiving slideshow data after connection and authentication.
        """
        self.communicator = await self._get_authenticated_communicator()

        response = await self.communicator.receive_json_from()

        self.assertIn(
            "data", response, "Response JSON did not contain 'data' key as expected"
        )
        self.assertIn(
            "slideshow_data",
            response["data"],
            "Data object in response did not contain 'slideshow_data' key as expected",
        )

        await self.communicator.disconnect()


class WSSlideshowNegativeTests(WSSlideshowBase):
    """
    Test class for negative tests for WebSocket Slideshow
    """

    async def test_wrong_first_message(self):
        """
        Testing what happens if the first messages send through the socket is not for authentication
        """
        self.communicator = WebsocketCommunicator(
            application,
            "/ws/slideshows/1/?branch=15",
            headers=[(b"origin", b"http://localhost:5173")],
        )
        connected, _ = await self.communicator.connect()
        assert connected

        await self.communicator.send_json_to(
            {"type": "message", "data": "Wrong first message"}
        )
        response = await self.communicator.receive_json_from()

        # Test if authentication is failing (as expected)
        self.assertIn(
            "error", response, "Response JSON did not contain 'error' key as expected"
        )
        self.assertIn(
            "code", response, "Response JSON did not contain 'code' key as expected"
        )
        self.assertEqual(response["code"], 4002, f"WS response code don't match")

        await self.communicator.disconnect()

    async def test_missing_token(self):
        """
        Testing token is missing when getting authenticated in the WS connection (token not send).
        """
        token = ""

        self.communicator = WebsocketCommunicator(
            application,
            "/ws/slideshows/1/?branch=15",
            headers=[(b"origin", b"http://localhost:5173")],
        )
        connected, _ = await self.communicator.connect()
        assert connected

        await self.communicator.send_json_to({"type": "authenticate", "token": token})

        response = await self.communicator.receive_json_from()

        # Test if authentication is failing (as expected)
        self.assertIn(
            "error", response, "Response JSON did not contain 'error' key as expected"
        )
        self.assertIn(
            "code", response, "Response JSON did not contain 'code' key as expected"
        )
        self.assertEqual(response["code"], 4004, f"WS response code don't match")

        await self.communicator.disconnect()

    async def test_invalid_token(self):
        """
        Testing token being invalid when getting authenticated in the WS connection
        """
        invalid_token = "notavalidtoken"

        self.communicator = WebsocketCommunicator(
            application,
            "/ws/slideshows/1/?branch=15",
            headers=[(b"origin", b"http://localhost:5173")],
        )
        connected, _ = await self.communicator.connect()
        assert connected

        await self.communicator.send_json_to(
            {"type": "authenticate", "token": invalid_token}
        )

        response = await self.communicator.receive_json_from()

        # Test if authentication is failing (as expected)
        self.assertIn(
            "error", response, "Response JSON did not contain 'error' key as expected"
        )
        self.assertIn(
            "code", response, "Response JSON did not contain 'code' key as expected"
        )
        self.assertEqual(response["code"], 4001, f"WS response code don't match")

        await self.communicator.disconnect()
