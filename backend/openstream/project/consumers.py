import json

from asgiref.sync import async_to_sync
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.db import close_old_connections
from django.shortcuts import get_object_or_404
# from channels.generic.websocket import WebsocketConsumer # Synchronous solution

from app.models import Slideshow
from app.serializers import SlideshowSerializer

# This is my first consumer, which handles a basic chat WS connection
class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.room_name = self.scope["url_route"]["kwargs"]["room_name"] # Scope contains (among other things) the url witht the room name parameter in it
        self.room_group_name = f"chat_{self.room_name}" # Sets the group name for the consumer
        # OBS: Group names may only contain alphanumerics (a-z, 0-9), hyphens, underscores, or periods.
        # The group name is also limited to a maximum length of 100

        # Join room group
        await self.channel_layer.group_add(self.room_group_name, self.channel_name)

        # Accept the WebSocket connection (if the user needs to be authenticated, then it should happen before this, so the connection can be rejected)
        await self.accept()

        # Get current slideshow data by id
        self.slideshow = await get_slideshow(self, 2)
        print("consumer has the data: ", self.slideshow)
        # Send current slideshow data to the user
        await self.send(text_data=json.dumps({"current_slideshow": self.slideshow}))


    async def disconnect(self, close_code):
        # Leave room group
        await self.channel_layer.group_discard(self.room_group_name, self.channel_name)

    # Receive message from the WebSocket (message sent from the user)
    async def receive(self, text_data):
        print("receive")
        text_data_json = json.loads(text_data)
        message = text_data_json["message"]

        # Send message to the whole room group
        await self.channel_layer.group_send(self.room_group_name, {"type": "chat.message", "message": message})
        # type indicates which method should be used to receive the event. type: chat.message can be received with chat_message (dot . is being replaced with _)

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
def get_slideshow(self, id):
    """
    Get slideshow by id from database, with Slideshow data included

    :param id: The id of the current slideshow
    """
    print("getting slideshow")

    # Close old DB connections before making new ORM operations
    close_old_connections()

    try:
        # branch = get_branch_from_request(request)
        branch = 15 # Test - will be coming from the request in future
    except ValueError as e:
            return {"detail": str(e)} 

    slideshow_id = id
    context = {"include_slideshow_data": "true"}

    ss = get_object_or_404(Slideshow, pk=slideshow_id, branch=branch)
    ser = SlideshowSerializer(ss, context=context)
    return ser.data

@database_sync_to_async
def patch_slideshow(self, data, id):
    """
    Patch / update slideshow by id

    :param data: The data to update
    :param id: The id of the current slideshow
    """
    print("updating slideshow")

    # Close old DB connections before making new ORM operations
    close_old_connections()

    try:
        # branch = get_branch_from_request(request)
        branch = 15 # Test - will be coming from the request in future
    except ValueError as e:
        return {"detail": str(e)}

    slideshow = get_object_or_404(Slideshow, pk=id, branch=branch)
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