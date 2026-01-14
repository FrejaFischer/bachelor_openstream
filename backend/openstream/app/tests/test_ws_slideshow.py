import json
import asyncio

from project.asgi import application
from app.models import Slideshow

from django.test import override_settings, TransactionTestCase

from channels.testing import WebsocketCommunicator, HttpCommunicator
from channels.db import database_sync_to_async


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

        http_comm = HttpCommunicator(
            application, "POST", "/api/token/", body=body, headers=headers
        )
        response = await http_comm.get_response()

        # Test response from HTTP POST
        self.assertIn("body", response, "Response JSON did not contain 'body' key")
        data = json.loads(response["body"])
        self.assertEqual(response["status"], 200, f"Login failed: {data}")
        self.assertIn("access", data, "Response JSON did not contain 'access' key")

        return data["access"]

    async def _get_authenticated_communicator(self):
        """
        Helper: Logs in the superadmin user and returns a connected, authenticated WebsocketCommunicator.
        """
        # Login
        token = await self._user_login()

        # Setup communicator
        communicator = WebsocketCommunicator(
            application,
            "/ws/slideshows/1/?branch=15",
            headers=[(b"origin", b"http://localhost:5173")],
        )
        connected, _ = await communicator.connect()

        try:
            self.assertTrue(connected, "Connection did NOT equal to true as expected")

            # Authenticate
            await communicator.send_json_to({"type": "authenticate", "token": token})
            response = await communicator.receive_json_from(timeout=10)
            self.assertEqual(
                response, {"type": "authenticated"}, "WS Authentication failed"
            )

            return communicator
        except Exception:
            # Close connection if authentication or assertions fails
            await communicator.disconnect()
            raise  # Re-raise the error so the test using this method shows as "Failed"
    
    async def _assert_message_received(self, communicator, expected_key, expected_value, timeout=5):
        """
        Continually receives messages until a specific key/value pair is found.
        Fails if the timeout is reached first.
        """
        start_time = asyncio.get_event_loop().time()
        
        while (asyncio.get_event_loop().time() - start_time) < timeout:
            try:
                message = await communicator.receive_json_from(timeout=1)
                if message.get(expected_key) == expected_value:
                    return message
            except asyncio.TimeoutError:
                continue
                
        self.fail(f"Timed out waiting for message {expected_key}={expected_value}")


class WSSlideshowPositiveTests(WSSlideshowBase):
    """
    Test class containing positive tests for WebSocket Slideshow
    """

    async def test_slideshow_connection(self):
        """
        Testing creating a WebSocket connection to the slideshows WS endpoint
        """
        self.communicator = WebsocketCommunicator(
            application,
            "/ws/slideshows/1/?branch=15",
            headers=[(b"origin", b"http://localhost:5173")],
        )
        connected, _ = await self.communicator.connect()

        try:
            self.assertTrue(connected, "Connection did NOT equal to true as expected")
        finally:
            await self.communicator.disconnect()

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

        try:
            assert connected

            await self.communicator.send_json_to({"type": "authenticate", "token": token})
            response = await self.communicator.receive_json_from(timeout=10)

            # Test if user has been authenticated
            self.assertEqual(
                response, {"type": "authenticated"}, "WS Authentication failed"
            )
        finally:
            await self.communicator.disconnect()

    async def test_receive_slideshow_data(self):
        """
        Testing receiving slideshow data after connection and authentication.
        """
        communicator = await self._get_authenticated_communicator()

        try:
            response = await communicator.receive_json_from(timeout=10)

            self.assertIn(
                "data", response, "Response JSON did not contain 'data' key as expected"
            )
            self.assertIn(
                "slideshow_data",
                response["data"],
                "Data object in response did not contain 'slideshow_data' key as expected",
            )
        finally:
            await communicator.disconnect()

    async def test_send_slideshow_update(self):
        """
        Testing sending updated slideshow data
        """
        data = {
            "type": "update",
            "data": {"slideshow_data": {"slides": [{"name": "New slide name"}]}}
        }

        communicator = await self._get_authenticated_communicator()

        try:
            # Send the update
            await communicator.send_json_to(data)

            await self._assert_message_received(communicator, "message", "Slideshow updated")

            # Check if data has actually been changed in the db
            updated_slideshow = await database_sync_to_async(Slideshow.objects.get)(id=1)
            self.assertEqual(updated_slideshow.slideshow_data["slides"][0]["name"], "New slide name")

        finally:
            await communicator.disconnect()

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

        try:
            assert connected

            await self.communicator.send_json_to(
                {"type": "message", "data": "Wrong first message"}
            )
            response = await self.communicator.receive_json_from(timeout=10)

            # Test if authentication is failing (as expected)
            self.assertIn(
                "error", response, "Response JSON did not contain 'error' key as expected"
            )
            self.assertIn(
                "code", response, "Response JSON did not contain 'code' key as expected"
            )
            self.assertEqual(response["code"], 4002, f"WS response code don't match")
        finally:
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

        try:
            assert connected

            await self.communicator.send_json_to({"type": "authenticate", "token": token})

            response = await self.communicator.receive_json_from(timeout=10)

            # Test if authentication is failing (as expected)
            self.assertIn(
                "error", response, "Response JSON did not contain 'error' key as expected"
            )
            self.assertIn(
                "code", response, "Response JSON did not contain 'code' key as expected"
            )
            self.assertEqual(response["code"], 4004, f"WS response code don't match")
        finally:
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

        try:
            assert connected

            await self.communicator.send_json_to(
                {"type": "authenticate", "token": invalid_token}
            )

            response = await self.communicator.receive_json_from(timeout=10)

            # Test if authentication is failing (as expected)
            self.assertIn(
                "error", response, "Response JSON did not contain 'error' key as expected"
            )
            self.assertIn(
                "code", response, "Response JSON did not contain 'code' key as expected"
            )
            self.assertEqual(response["code"], 4001, f"WS response code don't match")
        finally:
            await self.communicator.disconnect()

    async def test_auth_timeout(self):
        """
        Testing if the timeout works, and disconnect if no authentication has happened.
        """

        self.communicator = WebsocketCommunicator(
            application,
            "/ws/slideshows/1/?branch=15",
            headers=[(b"origin", b"http://localhost:5173")],
        )
        connected, _ = await self.communicator.connect()

        try:
            assert connected

            # Expect error response after WS consumers 5 second timeout
            response = await self.communicator.receive_json_from(timeout=6)

            self.assertEqual(response["error"], "Missing authentication")
            self.assertEqual(response["code"], 4001)

            # Expect the next output to be the consumer closing the connection
            final_output = await self.communicator.receive_output()
            self.assertEqual(final_output["type"], "websocket.close")
            self.assertEqual(final_output["code"], 4001)
        finally:
            await self.communicator.disconnect()
