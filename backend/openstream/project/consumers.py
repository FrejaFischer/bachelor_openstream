# SPDX-FileCopyrightText: 2025 Freja Fischer Nielsen <https://github.com/FrejaFischer/bachelor_openstream>
# SPDX-License-Identifier: AGPL-3.0-only
import json
import asyncio

from asgiref.sync import async_to_sync
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.db import close_old_connections
from django.shortcuts import get_object_or_404
# from channels.generic.websocket import WebsocketConsumer # Synchronous solution
from rest_framework_simplejwt.tokens import AccessToken
from django.contrib.auth.models import AnonymousUser
from django.contrib.auth import get_user_model
from django.http import Http404

from app.models import Slideshow
from app.serializers import SlideshowSerializer
from app.permissions import get_branch_for_user

User = get_user_model()
# This is my first consumer, which handles a basic chat WS connection
class ChatConsumer(AsyncWebsocketConsumer):

    # Timeout for authentication (seconds)
    AUTH_TIMEOUT = 5

    async def connect(self):
        # Sets the user to be anonymous and not authenticated to start with
        self.user = AnonymousUser()
        self.authenticated = False

        # # Get the room name
        # self.room_name = self.scope["url_route"]["kwargs"]["room_name"] # Scope contains (among other things) the url witht the room name parameter in it
        # self.room_group_name = f"chat_{self.room_name}" # Sets the group name for the consumer
        # # OBS: Group names may only contain alphanumerics (a-z, 0-9), hyphens, underscores, or periods.
        # # The group name is also limited to a maximum length of 100

        # # Join room group
        # await self.channel_layer.group_add(self.room_group_name, self.channel_name)

        # Accept the WebSocket connection
        await self.accept()

        # Start a timer to disconnect if authentication is not received in time
        self.auth_timer = asyncio.create_task(self.disconnect_if_not_authenticated())

    async def disconnect_if_not_authenticated(self):
        await asyncio.sleep(self.AUTH_TIMEOUT)
        if not self.authenticated:
            print("self closing")
            await self.close(code=4001)  # 4001 = custom code for auth timeout


    async def disconnect(self, close_code):
        # Leave room group
        print("disconnecting", close_code)
        await self.channel_layer.group_discard(self.room_group_name, self.channel_name)

    # Receive message from the WebSocket (message sent from the user)
    async def receive(self, text_data):
        print("receive")

        # Messages received when user is not authenticated
        if not self.authenticated:
            try:
                data = json.loads(text_data)
                # check if the message is of authenticate type (stop users from sending before being authenticated)
                if data.get("type") != "authenticate":
                    await self.close(code=4002)  # 4002 = invalid first message
                    return

                token_str = data.get("token")
                if not token_str:
                    await self.close(code=4003)  # 4003 = missing token
                    return

                user = await get_user_from_token(token_str)
                if user is None or not user.is_authenticated:
                    print("exception 4004 - user: ", user)
                    await self.close(code=4004)  # 4004 = invalid token
                    return
                
                # Authentication successfull
                self.user = user
                self.authenticated = True
                # Cancel the auth timeout task
                self.auth_timer.cancel()

                # Send mesage to client about succesfull authentication
                await self.send(json.dumps({"type": "authenticated"}))

                # Get the room name
                self.room_name = self.scope["url_route"]["kwargs"]["room_name"] # Scope contains (among other things) the url witht the room name parameter in it (should maybe get the slideshow id)
                self.room_group_name = f"chat_{self.room_name}" # Sets the group name for the consumer
                # OBS: Group names may only contain alphanumerics (a-z, 0-9), hyphens, underscores, or periods.
                # The group name is also limited to a maximum length of 100

                # Join room group
                await self.channel_layer.group_add(self.room_group_name, self.channel_name)

                # Get slideshows current data by id
                # slideshow_id = self.scope["url_route"]["kwargs"]["slideshow_id"])
                slideshow_id = 2 # Test - will be coming from the scope in future
                results = await get_slideshow(self, slideshow_id)
                
                # Check if slideshow was succesfully fetched
                if results.get("type") == "error":
                    print("error happen", results.get("error_message"))
                    await self.send(text_data=json.dumps({"error": results["error_message"]}))
                    return
                
                # Send slideshow current data to the user
                self.slideshow = results
                await self.send(text_data=json.dumps({"current_slideshow": self.slideshow}))

            except json.JSONDecodeError:
                await self.close(code=4005)  # 4005 = invalid JSON
            except Exception as e:
                print(e)
                await self.close(code=4006)  # 4006 = generic error

            return
        
        # If already authenticated, then handle normal messages
        await self.handle_authenticated_message(text_data)
        
    async def handle_authenticated_message(self, text_data):
        """
        Handle messages from authenticated users.
        """
        text_data_json = json.loads(text_data)

        if text_data_json["type"] == "message":
            message = text_data_json["message"]
            # Send message to the whole room group
            await self.channel_layer.group_send(self.room_group_name, {"type": "chat.message", "message": message})
            # type indicates which method should be used to receive the event. type: chat.message can be received with chat_message (dot . is being replaced with _)

        if text_data_json["type"] == "update":
            # Update the database with data from the user
            updated_slideshow_data = text_data_json["data"]
            print(updated_slideshow_data)
            updated_slideshow = await patch_slideshow(self, updated_slideshow_data, 2)
            print("updated_slideshow", updated_slideshow)
            # send new slideshow data to the whole room group
            await self.channel_layer.group_send(self.room_group_name, {"type": "chat.slideshow", "data": updated_slideshow})
    
    # Receive message from the room group (messages from other users in the room)
    async def chat_message(self, event):
        print("chat_message", event)
        message = event["message"]

        # Send message to the WebSocket
        await self.send(text_data=json.dumps({"message": message}))

    # Receive data from the room group (data from other users in the room)
    async def chat_slideshow(self, event):
        print("chat_slideshow", event)
        data = event["data"]

        await self.send(text_data=json.dumps({"data": data}))


###############################################################################
# Database helper functions using Decorators
###############################################################################

@database_sync_to_async
def get_user_from_token(token_str):
    """
    Uses SimpleJWT AccessToken to validate token and return User.
    Returns None if token is invalid or expired.

    :param token_str: The token from the user
    """
    try:
        print("get_user_from_token starting")
        token = AccessToken(token_str)
        user_id = token["user_id"]
        print("get_user_from_token - Token: ",token, "user_id", user_id)
        return User.objects.get(id=user_id) # this fails
    except Exception:
        print("get_user_from_token - Exception")
        return None

@database_sync_to_async
def get_slideshow(self, slideshow_id):
    """
    Get slideshow by id from database, with Slideshow data included

    :param self: The consumers self
    :param slideshow_id: The id of the slideshow
    """

    # Close old DB connections before making new ORM operations
    close_old_connections()

    # Check branch exists and if user has access to it
    try:
        # branch_id = self.scope["url_route"]["kwargs"]["branch_id"]) # maybe not the correct way of getting query params (?branch_id=x)
        branch_id = 15 # Test - will be coming from the scope in future
        branch = get_branch_for_user(self.user, branch_id)
    except Http404 as e:
        print("404 exception happen in get_slideshow", e)
        return {"type":"error", "error_message": str(e)} 
    except ValueError as e:
        # Catch Error from get_branch_for_user
        return {"type":"error", "error_message": str(e)} 

    context = {"include_slideshow_data": "true"}

    # Find Slideshow object
    try:
        ss = get_object_or_404(Slideshow, pk=slideshow_id, branch=branch)
    except Http404:
        return {"type": "error", "error_message": "Slideshow not found"}
    
    ser = SlideshowSerializer(ss, context=context)
    return ser.data

@database_sync_to_async
def patch_slideshow(self, data, slideshow_id):
    """
    Patch / update slideshow by id

    :param data: The data to update
    :param slideshow_id: The id of the slideshow
    """
    print("updating slideshow")

    # Close old DB connections before making new ORM operations
    close_old_connections()

    # Check branch exists and if user has access to it
    try:
        # branch_id = self.scope["url_route"]["kwargs"]["branch_id"])
        branch_id = 15 # Test - will be coming from the scope in future
        branch = get_branch_for_user(self.user, branch_id)
    except ValueError as e:
            # Catch Error from get_branch_for_user
            return {"type":"error", "error_message": str(e)} 

    # Find Slideshow object
    try:
        slideshow = get_object_or_404(Slideshow, pk=slideshow_id, branch=branch)
    except Http404:
        return {"type": "error", "error_message": "Slideshow not found"}
    
    serializer = SlideshowSerializer(slideshow, data=data, partial=True)
    if serializer.is_valid():
        updated = serializer.save()
        return SlideshowSerializer(updated).data
    return serializer.errors

### First solution with the consumer being synchronous
# class ChatConsumer(WebsocketConsumer): 
    # def connect(self):
    #     self.room_name = self.scope["url_route"]["kwargs"]["room_name"] # Scope contains (among other things) the url witht the room name parameter in it
    #     self.room_group_name = f"chat_{self.room_name}" # Sets the group name for the consumer
        # OBS: Group names may only contain alphanumerics (a-z, 0-9), hyphens, underscores, or periods.
        # The group name is also limited to a maximum length of 100

        # Join room group
        # async_to_sync(self.channel_layer.group_add)(
        #     self.room_group_name, self.channel_name
        # )
        # async_to_sync is required because ChatConsumer is a synchronous WebsocketConsumer, but it's calling an asynchronous channel layer method. (All channel layer methods are asynchronous.)

        # Accept the WebSocket connection (if the user needs to be authenticated, then it should happen before this, so the connection can be rejected)
        # self.accept()

    # def disconnect(self, close_code):
        # Leave room group
        # async_to_sync(self.channel_layer.group_discard)(
        #     self.room_group_name, self.channel_name
        # )

    # Receive message from the WebSocket (message sent from the user)
    # def receive(self, text_data):
    #     text_data_json = json.loads(text_data)
    #     message = text_data_json["message"]

        # Send message to the whole room group
        # async_to_sync(self.channel_layer.group_send)(
        #     self.room_group_name, {"type": "chat.message", "message": message}
        # )
        # type indicates which method should be used to receive the event. type: chat.message can be received with chat_message (dot . is being replaced with _)

        # Synchronous solution
        # Older solution where it didn't use channels layers - only the user got the message
        # self.send(text_data=json.dumps({"message": message})) # 
    
     # Receive message from the room group (messages from other users in the room)
    # def chat_message(self, event):
    #     message = event["message"]

        # Send message to the WebSocket
        # self.send(text_data=json.dumps({"message": message}))