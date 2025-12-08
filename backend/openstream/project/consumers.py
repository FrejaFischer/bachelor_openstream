# SPDX-FileCopyrightText: 2025 Freja Fischer Nielsen <https://github.com/FrejaFischer/bachelor_openstream>
# SPDX-License-Identifier: AGPL-3.0-only
import json
import asyncio
from urllib.parse import parse_qs

from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async

from django.db import close_old_connections
from django.shortcuts import get_object_or_404
from django.contrib.auth.models import AnonymousUser
from django.contrib.auth import get_user_model
from django.http import Http404

from rest_framework_simplejwt.tokens import AccessToken
from rest_framework_simplejwt.exceptions import TokenError

from app.models import Slideshow
from app.serializers import SlideshowSerializer
from app.permissions import get_branch_for_user

User = get_user_model()


###############################################################################
# Base Authentication Consumer
###############################################################################


class AuthenticatedConsumer(AsyncWebsocketConsumer):
    async def authenticate_user(self, data):
        """
        Authentication of the user client.

        ## If authentication is successful:
        Returns true and sends a message to client.

        ## If authentication fails:
        Returns false, sends an error message to client and closes connection.

        :param data: The data received from the client.
        """
        # Check if the message is of authenticate type (stop users from sending before being authenticated)
        if data.get("type") != "authenticate":
            await self.close_with_auth_error(4002)  # 4002 = Invalid first message
            return False
        # Authenticate user
        token_str = data.get("token")
        if not token_str:
            await self.close_with_auth_error(4004)  # 4004 = Token not found
            return False

        try:
            user = await get_user_from_token(token_str)
        except TokenError:
            # Invalid or expired token
            await self.close_with_auth_error(4001)  # 4001 = User unauthenticated
            return False
        except User.DoesNotExist:
            # No user exists
            await self.close_with_auth_error(4004)  # 4004 = User not found
            return False

        # Success
        self.user = user
        self.authenticated = True

        # Check if self has an auth_timer - Cancel the task
        if hasattr(self, "auth_timer"):
            self.auth_timer.cancel()

        # Send message to client about successful authentication
        await self.send(json.dumps({"type": "authenticated"}))
        return True

    async def close_with_auth_error(self, code):
        """
        Closing connection with authentication error message.

        :param code: Closing code to close connection with
        """
        await self.send(json.dumps({"error": "Missing authentication"}))
        await self.close(code=code)


###############################################################################
# Consumers
###############################################################################


class SlideshowConsumer(AuthenticatedConsumer):

    # Timeout for authentication (in seconds)
    AUTH_TIMEOUT = 5

    async def connect(self):
        # Sets the user to be anonymous and not authenticated to begin with
        self.user = AnonymousUser()
        self.authenticated = False

        # Accept the WebSocket connection
        await self.accept()

        # Start a timer to disconnect if authentication is not received in time
        self.auth_timer = asyncio.create_task(self.disconnect_if_not_authenticated())

    async def disconnect_if_not_authenticated(self):
        await asyncio.sleep(self.AUTH_TIMEOUT)
        if not self.authenticated:
            print("User is not authenticated - self closing")
            await self.close_with_auth_error(4001)

    async def disconnect(self, close_code):
        print("disconnecting", close_code)

    async def receive(self, text_data):
        print("receive")
        # Messages received when user is not authenticated
        if not self.authenticated:
            try:
                data = json.loads(text_data)
                # Authenticate user
                success = await self.authenticate_user(data)
                if not success:
                    print("Authentication failed")
                    return

                # Get slideshow id from url
                self.slideshow_id = self.scope["url_route"]["kwargs"]["slideshow_id"]

                # Get branch id from query params
                query_params = parse_qs(
                    self.scope["query_string"].decode()
                )  # scope['query_string'] is bytes, so decode first
                self.branch_id = query_params.get("branch", [None])[0]

                # Get slideshows current data by id
                results = await get_slideshow(self)

                # Check if slideshow was successfully fetched
                if results.get("type") == "error":
                    print("error happen", results.get("error_message"))
                    await self.send(json.dumps({"error": results["error_message"]}))
                    return

                # Send current slideshow data to the user
                self.slideshow = results
                await self.send(json.dumps({"data": self.slideshow}))

            except json.JSONDecodeError:
                await self.close(code=4005)  # 4005 = Invalid JSON
            except Exception as e:
                await self.close(code=4006)  # 4006 = Generic error

            return

        # If user is authenticated, then handle normal messages
        await self.handle_authenticated_message(text_data)

    async def handle_authenticated_message(self, text_data):
        """
        Handle messages from authenticated users.
        """
        try:
            text_data_object = json.loads(text_data)
        except json.JSONDecodeError:
            print("exception 4005 - Invalid JSON")
            await self.send(json.dumps({"error": "Invalid JSON data"}))
            return

        if text_data_object["type"] == "update":
            data = text_data_object.get("data")
            if isinstance(data, dict) and data:
                # Update the database with data from the user
                results = await patch_slideshow(self, data)
            else:
                await self.send(json.dumps({"error": "Missing or invalid data"}))
                return

            # Check if slideshow was successfully updated
            if results.get("type") == "error":
                print("error happen", results.get("error_message"))
                await self.send(json.dumps({"error": results["error_message"]}))
                return

            self.slideshow = results
            await self.send(json.dumps({"message": "Slideshow updated"}))

            # send new slideshow data to the whole room group
            # await self.channel_layer.group_send(
            #     self.room_group_name,
            #     {"type": "chat.slideshow", "data": updated_slideshow},
            # )


class ChatConsumer(AsyncWebsocketConsumer):

    # Timeout for authentication (seconds)
    AUTH_TIMEOUT = 5

    async def connect(self):
        # Sets the user to be anonymous and not authenticated to start with
        self.user = AnonymousUser()
        self.authenticated = False

        # Testing how to get url arguments and query parameters
        # self.slideshow_id = self.scope["url_route"]["kwargs"]["slideshow_id"]
        # print(self.slideshow_id)
        # print(self.scope["query_string"])
        # query_params = parse_qs(
        #     self.scope["query_string"].decode()
        # )  # scope['query_string'] is bytes, so decode first
        # print(query_params)
        # branch_id = query_params.get("branch", [None])[0]
        # print(branch_id)

        # Accept the WebSocket connection
        await self.accept()

        # Start a timer to disconnect if authentication is not received in time
        self.auth_timer = asyncio.create_task(self.disconnect_if_not_authenticated())

    async def disconnect_if_not_authenticated(self):
        await asyncio.sleep(self.AUTH_TIMEOUT)
        if not self.authenticated:
            print("self closing")
            await self.send(
                json.dumps({"error": "User not authenticated - Socket is closing"})
            )
            await self.close(code=4001)  # 4001 = custom code for auth timeout

    async def disconnect(self, close_code):
        print("disconnecting", close_code)
        # Only leave group if room_group_name exists
        if hasattr(self, "room_group_name") and self.room_group_name:
            await self.channel_layer.group_discard(
                self.room_group_name, self.channel_name
            )

    # Receive message from the WebSocket (message sent from the user)
    async def receive(self, text_data):
        print("receive")

        # Messages received when user is not authenticated
        if not self.authenticated:
            try:
                data = json.loads(text_data)
                # Check if the message is of authenticate type (stop users from sending before being authenticated)
                if data.get("type") != "authenticate":
                    await self.close(code=4002)  # 4002 = invalid first message
                    return

                # Authenticate user
                token_str = data.get("token")
                if not token_str:
                    await self.close(code=4004)  # 4004 = token not found
                    return

                try:
                    user = await get_user_from_token(token_str)

                    # Token was valid, and user exists — check authentication state
                    if not user.is_authenticated:
                        print("exception 4001 - user not authenticated: ", user)
                        await self.close(code=4001)  # 4001 = user unauthenticated
                        return

                except TokenError as e:
                    # Invalid or expired token
                    print("exception 4001:", str(e))
                    await self.close(code=4001)  # 4001 = user unauthenticated
                    return

                except User.DoesNotExist as e:
                    # No user exists
                    print("exception 4004 - user not found:", str(e))
                    await self.close(code=4004)  # 4004 = user not found
                    return

                # Authentication successful
                self.user = user
                self.authenticated = True
                # Cancel the auth timeout task
                self.auth_timer.cancel()

                # Send mesage to client about successful authentication
                await self.send(json.dumps({"type": "authenticated"}))

                # Get the room name
                self.room_name = self.scope["url_route"]["kwargs"][
                    "room_name"
                ]  # Scope contains (among other things) the url witht the room name parameter in it (should maybe get the slideshow id)
                self.room_group_name = (
                    f"chat_{self.room_name}"  # Sets the group name for the consumer
                )
                # OBS: Group names may only contain alphanumerics (a-z, 0-9), hyphens, underscores, or periods.
                # The group name is also limited to a maximum length of 100

                # Join room group
                await self.channel_layer.group_add(
                    self.room_group_name, self.channel_name
                )

                # Get slideshows current data by id
                # slideshow_id = self.scope["url_route"]["kwargs"]["slideshow_id"])
                slideshow_id = 2  # Test - will be coming from the scope in future
                results = await get_slideshow(self, slideshow_id)

                # Check if slideshow was successfully fetched
                if results.get("type") == "error":
                    print("error happen", results.get("error_message"))
                    await self.send(json.dumps({"error": results["error_message"]}))
                    return

                # Send slideshow current data to the user
                self.slideshow = results
                await self.send(json.dumps({"current_slideshow": self.slideshow}))

            except json.JSONDecodeError:
                await self.close(code=4005)  # 4005 = invalid JSON
            except Exception as e:
                await self.close(code=4006)  # 4006 = generic error

            return

        # If already authenticated, then handle normal messages
        await self.handle_authenticated_message(text_data)

    async def handle_authenticated_message(self, text_data):
        """
        Handle messages from authenticated users.
        """
        try:
            text_data_json = json.loads(text_data)
        except json.JSONDecodeError:
            print("exception 4005 - Invalid JSON")
            await self.send(json.dumps({"error": "Invalid JSON data"}))
            return

        if text_data_json["type"] == "message":
            message = text_data_json["message"]
            # Send message to the whole room group
            await self.channel_layer.group_send(
                self.room_group_name, {"type": "chat.message", "message": message}
            )
            # type indicates which method should be used to receive the event. type: chat.message can be received with chat_message (dot . is being replaced with _)

        if text_data_json["type"] == "update":
            # Update the database with data from the user
            updated_slideshow_data = text_data_json["data"]
            print(updated_slideshow_data)
            updated_slideshow = await patch_slideshow(self, updated_slideshow_data, 2)
            print("updated_slideshow", updated_slideshow)
            # send new slideshow data to the whole room group
            await self.channel_layer.group_send(
                self.room_group_name,
                {"type": "chat.slideshow", "data": updated_slideshow},
            )

    # Receive message from the room group (messages from other users in the room)
    async def chat_message(self, event):
        print("chat_message", event)
        message = event["message"]

        # Send message to the WebSocket
        await self.send(json.dumps({"message": message}))

    # Receive data from the room group (data from other users in the room)
    async def chat_slideshow(self, event):
        print("chat_slideshow", event)
        data = event["data"]

        await self.send(json.dumps({"data": data}))


###############################################################################
# Database helper functions
###############################################################################


@database_sync_to_async
def get_user_from_token(token_str):
    """
    Uses SimpleJWT AccessToken to validate token and getting user.

    Returns user.

    Raises Exceptions if token is invalid or expired, and if user do not exists.

    :param token_str: The token from the user
    """
    # Validate token
    try:
        token = AccessToken(token_str)
    except Exception:
        # Any token parsing or validation error
        raise TokenError("Token invalid")
    # Find user
    try:
        user_id = token.get("user_id")
        return User.objects.get(id=user_id)
    except User.DoesNotExist:
        raise User.DoesNotExist("User not found")


@database_sync_to_async
def get_slideshow(self):
    """
    Get slideshow by id from database, with Slideshow data included

    :param self: The consumers self
    :param slideshow_id: The id of the slideshow
    """

    # Close old DB connections before making new ORM operations
    close_old_connections()

    # Check if branch exists and if user has access to it
    try:
        branch_id = getattr(self, "branch_id", None)
        if branch_id is None:
            return {"type": "error", "error_message": "Branch id not found"}

        branch = get_branch_for_user(self.user, branch_id)
    except Http404 as e:
        print("404 exception happen in get_slideshow", e)
        return {
            "type": "error",
            "error_message": "No branch matches with that branch id",
        }
    except ValueError as e:
        return {"type": "error", "error_message": str(e)}

    context = {"include_slideshow_data": "true"}

    # Find Slideshow object
    try:
        slideshow_id = getattr(self, "slideshow_id", None)
        if slideshow_id is None:
            return {"type": "error", "error_message": "Slideshow id not found"}
        ss = get_object_or_404(Slideshow, pk=slideshow_id, branch=branch)
    except Http404:
        return {"type": "error", "error_message": "Slideshow not found"}

    ser = SlideshowSerializer(ss, context=context)
    return ser.data


@database_sync_to_async
def patch_slideshow(self, data):
    """
    Patch / update slideshow by id

    :param data: The slideshow data to update
    """

    # Close old DB connections before making new ORM operations
    close_old_connections()

    # Check if branch exists and if user has access to it
    try:
        branch_id = getattr(self, "branch_id", None)
        if branch_id is None:
            return {"type": "error", "error_message": "Branch id not found"}

        branch = get_branch_for_user(self.user, branch_id)
    except Http404 as e:
        print("404 exception happen in get_slideshow", e)
        return {
            "type": "error",
            "error_message": "No branch matches with that branch id",
        }
    except ValueError as e:
        return {"type": "error", "error_message": str(e)}

    # Find Slideshow object
    try:
        slideshow_id = getattr(self, "slideshow_id", None)
        if slideshow_id is None:
            return {"type": "error", "error_message": "Slideshow id not found"}
        slideshow = get_object_or_404(Slideshow, pk=slideshow_id, branch=branch)
    except Http404:
        return {"type": "error", "error_message": "Slideshow not found"}

    # Update slideshow object
    serializer = SlideshowSerializer(slideshow, data=data, partial=True)
    if serializer.is_valid():
        updated = serializer.save()
        return SlideshowSerializer(updated).data
    return {
        "type": "error",
        "error_message": "Slideshow not updated. Reason: " + str(serializer.errors),
    }
