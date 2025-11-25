import json

from asgiref.sync import async_to_sync
from channels.generic.websocket import AsyncWebsocketConsumer
# from channels.generic.websocket import WebsocketConsumer # Synchronous solution

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

    async def disconnect(self, close_code):
        # Leave room group
        await self.channel_layer.group_discard(self.room_group_name, self.channel_name)

    # Receive message from the WebSocket (message sent from the user)
    async def receive(self, text_data):
        text_data_json = json.loads(text_data)
        message = text_data_json["message"]

        # Send message to the whole room group
        await self.channel_layer.group_send(self.room_group_name, {"type": "chat.message", "message": message})
        # type indicates which method should be used to receive the event. type: chat.message can be received with chat_message (dot . is being replaced with _)
    
     # Receive message from the room group (messages from other users in the room)
    async def chat_message(self, event):
        message = event["message"]

        # Send message to the WebSocket
        await self.send(text_data=json.dumps({"message": message}))



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