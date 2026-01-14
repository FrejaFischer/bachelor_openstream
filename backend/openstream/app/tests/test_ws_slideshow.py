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
                event = await communicator.receive_output(timeout=1)
            
                # Check if connection is not closed before checking for receiving messages
                if event["type"] == "websocket.close":
                    self.fail(f"WebSocket closed unexpectedly with code {event.get('code')} "
                            f"while waiting for {expected_key}={expected_value}")
                
                if event["type"] == "websocket.send":
                    message = json.loads(event["text"])
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
        communicator = WebsocketCommunicator(
            application,
            "/ws/slideshows/1/?branch=15",
            headers=[(b"origin", b"http://localhost:5173")],
        )
        connected, _ = await communicator.connect()

        try:
            self.assertTrue(connected, "Connection did connect as expected")
        finally:
            await communicator.disconnect()

    async def test_send_token(self):
        """
        Testing getting authenticated in the WS connection, by sending a valid token.

        The token is received by making an HTTP POST request to login an user.
        """
        token = await self._user_login()

        communicator = WebsocketCommunicator(
            application,
            "/ws/slideshows/1/?branch=15",
            headers=[(b"origin", b"http://localhost:5173")],
        )
        connected, _ = await communicator.connect()

        try:
            assert connected

            await communicator.send_json_to({"type": "authenticate", "token": token})
            response = await communicator.receive_json_from(timeout=10)

            # Test if user has been authenticated
            self.assertEqual(
                response, {"type": "authenticated"}, "WS Authentication failed"
            )
        finally:
            await communicator.disconnect()

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
            self.assertEqual(updated_slideshow.slideshow_data["slides"][0]["name"], "New slide name", "Updated data was not found")

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
        communicator = WebsocketCommunicator(
            application,
            "/ws/slideshows/1/?branch=15",
            headers=[(b"origin", b"http://localhost:5173")],
        )
        connected, _ = await communicator.connect()

        try:
            assert connected

            await communicator.send_json_to(
                {"type": "message", "data": "Wrong first message"}
            )
            # Check for expected error message
            response = await self._assert_message_received(communicator, "error", "Missing authentication")

            # Check for expected closing code in message
            self.assertEqual(response.get("code"), 4002, "Closing code is not as expected")

            # Check if connection closed after that message
            final_event = await communicator.receive_output()
            self.assertEqual(final_event["type"], "websocket.close", "WebSocket connection did not close as expected")
            self.assertEqual(final_event["code"], 4002, "Closing code is not as expected")
        finally:
            await communicator.disconnect()

    async def test_missing_token(self):
        """
        Testing token is missing when getting authenticated in the WS connection (token not send).
        """
        token = ""

        communicator = WebsocketCommunicator(
            application,
            "/ws/slideshows/1/?branch=15",
            headers=[(b"origin", b"http://localhost:5173")],
        )
        connected, _ = await communicator.connect()

        try:
            assert connected

            await communicator.send_json_to({"type": "authenticate", "token": token})

            # Check for expected error message
            response = await self._assert_message_received(communicator, "error", "Missing authentication")

            # Check for expected closing code in message
            self.assertEqual(response.get("code"), 4004, "Closing code is not as expected")

            # Check if connection closed after that message
            final_event = await communicator.receive_output()
            self.assertEqual(final_event["type"], "websocket.close", "WebSocket connection did not close as expected")
            self.assertEqual(final_event["code"], 4004, "Closing code is not as expected")
        finally:
            await communicator.disconnect()

    async def test_invalid_token(self):
        """
        Testing token being invalid when getting authenticated in the WS connection
        """
        invalid_token = "notavalidtoken"

        communicator = WebsocketCommunicator(
            application,
            "/ws/slideshows/1/?branch=15",
            headers=[(b"origin", b"http://localhost:5173")],
        )
        connected, _ = await communicator.connect()

        try:
            assert connected

            await communicator.send_json_to(
                {"type": "authenticate", "token": invalid_token}
            )

            # Check for expected error message
            response = await self._assert_message_received(communicator, "error", "Missing authentication")

            # Check for expected closing code in message
            self.assertEqual(response.get("code"), 4001, "Closing code is not as expected")

            # Check if connection closed after that message
            final_event = await communicator.receive_output()
            self.assertEqual(final_event["type"], "websocket.close", "WebSocket connection did not close as expected")
            self.assertEqual(final_event["code"], 4001, "Closing code is not as expected")
        finally:
            await communicator.disconnect()

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
