# SPDX-FileCopyrightText: 2025 Freja Fischer Nielsen <https://github.com/FrejaFischer/bachelor_openstream>
# SPDX-License-Identifier: AGPL-3.0-only
import json
import os
import asyncio
import redis.asyncio as aioredis
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

# Create Redis client, with string response
REDIS_URL = os.environ.get("REDIS_URL", "redis://redis:6379/0")
redis_client = aioredis.from_url(REDIS_URL, decode_responses=True)

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
        await self.send(json.dumps({"error": "Missing authentication", "code": code}))
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
        # Only leave group if group name exists
        if hasattr(self, "slideshow_group_name") and self.slideshow_group_name:
            await self.channel_layer.group_discard(
                self.slideshow_group_name, self.channel_name
            )

        # Remove user from Redis set that tracks active users for this slideshow
        try:
            if (
                getattr(self, "user", None)
                and getattr(self.user, "is_authenticated", False)
                and hasattr(self, "slideshow_id")
            ):
                key = f"slideshow:{self.slideshow_id}:users"  # Create key string for slideshow
                await redis_client.srem(
                    key, str(getattr(self.user, "id", self.channel_name))
                )
                await self.broadcast_presence("disconnect")
        except Exception as e:
            print("Redis error - SREM failed:", e)

    async def receive(self, text_data):
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
                    if "code" in results:
                        error_code = results["code"]
                    else:
                        error_code = 4006
                    await self.send(
                        json.dumps(
                            {"error": results["error_message"], "code": error_code}
                        )
                    )
                    return

                # Send current slideshow data to the user
                self.slideshow = results
                await self.send(json.dumps({"data": self.slideshow}))

                # Create group name with slideshow id included
                self.slideshow_group_name = f"slideshow_{self.slideshow_id}"

                # Add user to Channel group
                await self.channel_layer.group_add(
                    self.slideshow_group_name, self.channel_name
                )

                # Add authenticated user to Redis set that tracks active users in this slideshow
                try:
                    if getattr(self, "user", None) and getattr(
                        self.user, "is_authenticated", False
                    ):
                        key = f"slideshow:{self.slideshow_id}:users"  # Create key string for slideshow
                        await redis_client.sadd(
                            key, str(getattr(self.user, "id", self.channel_name))
                        )
                        await self.broadcast_presence("connect")
                except Exception as e:
                    print("Redis SADD error:", e)
                    await self.send(
                        json.dumps(
                            {
                                "error": "User could not be added to list of active users",
                                "code": 4007,
                            }
                        )
                    )  # 4007 = Redis error

            except json.JSONDecodeError:
                await self.send(json.dumps({"error": "Invalid JSON", "code": 4005}))
                await self.close(code=4005)  # 4005 = Invalid JSON
            except Exception as e:
                print("Generic error: ", e)
                await self.send(
                    json.dumps({"error": "An error occurred", "code": 4006})
                )
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
            await self.send(json.dumps({"error": "Invalid JSON data", "code": 4005}))
            return

        if text_data_object["type"] == "update":
            data = text_data_object.get("data")
            if isinstance(data, dict) and data:
                # Update the database with data from the user
                results = await patch_slideshow(self, data)
            else:
                await self.send(
                    json.dumps({"error": "Missing or invalid data", "code": 4004})
                )
                return

            # Check if slideshow was successfully updated
            if results.get("type") == "error":
                print("error happen", results.get("error_message"))
                if "code" in results:
                    error_code = results["code"]
                else:
                    error_code = 4006
                await self.send(
                    json.dumps({"error": results["error_message"], "code": error_code})
                )
                return

            self.slideshow = results
            await self.send(json.dumps({"message": "Slideshow updated"}))

            # Send updated slideshow data to group in channel layer
            await self.channel_layer.group_send(
                self.slideshow_group_name,
                {"type": "receive.slideshow.update", "data": self.slideshow},
            )

    # Receive updated slideshow data from group in channel layer
    async def receive_slideshow_update(self, event):
        data = event["data"]
        # Send updated slideshow data to user
        await self.send(json.dumps({"data": data}))

    # Receive updates on acitve users from group in channel layer
    async def receive_slideshow_presence(self, event):
        users = event.get("users", [])
        await self.send(json.dumps({"presence": users}))

    async def broadcast_presence(self, action):
        """
        Method for broadcasting all active users in this slideshow to Channel Layer group.
        Finds users by id in DB and sends list to Channel Layer.

        :param action: After which event the broadcasting is triggered from
        """
        if not hasattr(self, "slideshow_id"):
            print("Presence broadcast error: Missing slideshow id")
            await self.send(
                json.dumps(
                    {"error": "Could not broadcast list of active users", "code": 4004}
                )
            )
            return

        key = f"slideshow:{self.slideshow_id}:users"  # Create key string for current slideshow
        try:
            # Find and print members of set
            member_ids = await redis_client.smembers(key)
            print(
                f"Slideshow {self.slideshow_id} connected users after {action}: {sorted(member_ids)}"
            )
            # Append all the members ids to list
            user_ids = []
            for member in member_ids:
                if str(member).isdigit():
                    user_ids.append(int(member))

            # Find all users in db
            results = await get_presence_users(user_ids)

            # Send message with all active users
            await self.channel_layer.group_send(
                self.slideshow_group_name,
                {"type": "receive.slideshow.presence", "users": results},
            )
        except Exception as e:
            print("Presence broadcast error:", e)
            await self.send(
                json.dumps(
                    {"error": "Could not broadcast list of active users", "code": 4007}
                )
            )  # 4007 = Redis error


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
    """

    # Close old DB connections before making new ORM operations
    close_old_connections()

    # Check if branch exists and if user has access to it
    try:
        branch_id = getattr(self, "branch_id", None)
        if branch_id is None:
            return {
                "type": "error",
                "error_message": "Branch id not found",
                "code": 4004,
            }

        branch = get_branch_for_user(self.user, branch_id)
    except Http404 as e:
        print("404 exception happen in get_slideshow", e)
        return {
            "type": "error",
            "error_message": "No branch matches with that branch id",
            "code": 4004,
        }
    except ValueError as e:
        return {"type": "error", "error_message": str(e), "code": 4001}

    context = {"include_slideshow_data": "true"}

    # Find Slideshow object
    try:
        slideshow_id = getattr(self, "slideshow_id", None)
        if slideshow_id is None:
            return {
                "type": "error",
                "error_message": "Slideshow id not found",
                "code": 4004,
            }
        ss = get_object_or_404(Slideshow, pk=slideshow_id, branch=branch)
    except Http404:
        return {"type": "error", "error_message": "Slideshow not found", "code": 4004}

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
            return {
                "type": "error",
                "error_message": "Branch id not found",
                "code": 4004,
            }

        branch = get_branch_for_user(self.user, branch_id)
    except Http404 as e:
        print("404 exception happen in patch_slideshow", e)
        return {
            "type": "error",
            "error_message": "No branch matches with that branch id",
            "code": 4004,
        }
    except ValueError as e:
        return {"type": "error", "error_message": str(e), "code": 4001}

    # Find Slideshow object
    try:
        slideshow_id = getattr(self, "slideshow_id", None)
        if slideshow_id is None:
            return {
                "type": "error",
                "error_message": "Slideshow id not found",
                "code": 4004,
            }
        slideshow = get_object_or_404(Slideshow, pk=slideshow_id, branch=branch)
    except Http404:
        return {"type": "error", "error_message": "Slideshow not found", "code": 4004}

    # Update slideshow object
    serializer = SlideshowSerializer(slideshow, data=data, partial=True)
    if serializer.is_valid():
        updated = serializer.save()
        return SlideshowSerializer(updated).data

    print("Updating slideshow failed: ", str(serializer.errors))
    return {
        "type": "error",
        "error_message": "Slideshow could not be updated due to invalid data.",
        "code": 4006,
    }


@database_sync_to_async
def get_presence_users(user_ids):
    """
    Search for users in DB with the user_ids, and returns list of active users display_name and initials.

    :param user_ids: user ids of active users in this slideshow
    """
    if not user_ids:
        return []

    qs = User.objects.filter(id__in=user_ids)
    payload = []
    for user in qs:
        full_name = user.get_full_name().strip()
        display_name = user.username
        initials_source = full_name or display_name or user.email or f"User {user.id}"
        initials_parts = [part[0] for part in initials_source.split() if part]
        initials = "".join(initials_parts[:2]).upper()
        if not initials:
            initials = display_name[:2].upper()
        payload.append(
            {
                "id": str(user.id),
                "display_name": display_name,
                "initials": initials,
            }
        )

    payload.sort(key=lambda item: item["display_name"].lower())
    return payload
