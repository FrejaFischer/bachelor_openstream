// SPDX-FileCopyrightText: 2025 Freja Fischer Nielsen <https://github.com/FrejaFischer/bachelor_openstream>
// SPDX-License-Identifier: AGPL-3.0-only
// import { BASE_URL } from "../../utils/constants";

document.addEventListener("DOMContentLoaded", async () => {
  //   const roomName = JSON.parse(document.getElementById("room-name").textContent);
  const roomName = "room1";
  const slideshow_id = 2;
  let current_slideshow;

  const chatSocket = new WebSocket("ws://localhost:8000" + "/ws/slideshows/" + slideshow_id + "/?branch=15");
  // const chatSocket = new WebSocket("ws://localhost:8000" + "/ws/chat/" + roomName + "/");
  // ${BASE_URL}/ws/chat/{roomName}/ (BASE_URL = http://) - TO DO: Make WS BASE_URL version?
  // ws://localhost:8000/ws/chat/{roomName}/

  // Test if user can send anything without sending token (will get rejected by backend)
  // chatSocket.onopen = () => {
  //   console.log("trying to send");
  //   const token123 = "1234notatoken";
  //   chatSocket.send(
  //     JSON.stringify({
  //       type: "authenticate",
  //       token: token123,
  //     })
  //   );
  //   console.log("send complete");
  // };
  // chatSocket.onopen = () => {
  //   console.log("trying to send message");
  //   chatSocket.send(JSON.stringify({ type: "message", message: "hello!!" }));

  //   const token = localStorage.getItem("accessToken");
  //   if (token) {
  //     console.log("sending token");
  //     chatSocket.send(JSON.stringify({ type: "authenticate", token }));
  //   }

  //   console.log("send complete");
  // };

  // Send token to WS
  if (localStorage.getItem("accessToken")) {
    chatSocket.onopen = () => {
      chatSocket.send(
        JSON.stringify({
          type: "authenticate",
          token: localStorage.getItem("accessToken"),
        })
      );
    };
  }

  chatSocket.onmessage = function (e) {
    console.log("onMessage", e);
    const data = JSON.parse(e.data);
    if (data.message) {
      document.querySelector("#chat-log").value += data.message + "\n";
    }
    if (data.data) {
      const data_ready = JSON.stringify(data.data);
      const current = JSON.stringify(current_slideshow);
      // Check if data has changed
      if (data_ready === current) {
        console.log("the same");
      } else {
        document.querySelector("#chat-log").value += data_ready + "\n";
      }
    }
    // if (data.current_slideshow) {
    //   const current_slideshow = JSON.stringify(data.current_slideshow);
    //   document.querySelector("#chat-log").value += current_slideshow + "\n";
    // }
    if (data.error) {
      const error = JSON.stringify(data.error);
      document.querySelector("#chat-log").value += "ERROR: " + error + "\n";
    }
  };

  chatSocket.onclose = function (e) {
    console.error("Chat socket closed unexpectedly");
  };

  document.querySelector("#chat-message-input").focus();
  document.querySelector("#chat-message-input").onkeyup = function (e) {
    if (e.key === "Enter") {
      // enter, return
      document.querySelector("#chat-message-submit").click();
    }
  };

  document.querySelector("#chat-message-submit").onclick = function (e) {
    const messageInputDom = document.querySelector("#chat-message-input");
    const message = messageInputDom.value;
    // const updated_slideshow_data = { name: "test 123" };
    // const updated_slideshow_data = { name: "New name", wrong_field: "test 123" };
    // const updated_slideshow_data = { wrong_field: "test 123" };
    const updated_slideshow_data = {
      id: 2,
      name: "slideshow name 3",
      category: null,
      tags: [],
      mode: "slideshow",
      branch: 15,
      created_by: 32,
      previewWidth: 1920,
      previewHeight: 1080,
      isCustomDimensions: true,
      slideshow_data: {
        slides: [
          {
            id: 1,
            name: "nutella",
            duration: 5,
            elements: [
              {
                id: 1,
                text: '<p><span style="font-size: 2.58cqw; line-height: 1.2; color: rgb(0, 0, 0); font-family: Roboto;">Double click to edit text</span></p>',
                type: "tiptap-textbox",
                gridX: 10,
                gridY: 10,
                border: false,
                zIndex: 1,
                fontSize: "12",
                isHidden: false,
                isLocked: false,
                gridWidth: 110,
                textAlign: "left",
                textColor: "#000000",
                fontFamily: "Roboto",
                gridHeight: 35,
                lineHeight: "1.2",
                isPersistent: false,
                tiptapContent: '<p><span style="font-size: 2.58cqw; line-height: 1.2; color: rgb(0, 0, 0); font-family: Roboto;">Double click to edit text</span></p>',
                backgroundColor: "transparent",
                originSlideIndex: 0,
              },
            ],
            redoStack: [],
            undoStack: [],
            activationDate: null,
            backgroundColor: "#ffffff",
            deactivationDate: null,
            activationEnabled: false,
          },
        ],
      },
      aspect_ratio: "16:9",
    };
    // const updated_slideshow_data = "hej";

    // chatSocket.send(updated_slideshow_data); // Invalid json send
    chatSocket.send(
      JSON.stringify({
        type: "update",
        data: updated_slideshow_data,
      })
    );
    current_slideshow = updated_slideshow_data;
    // chatSocket.send(
    //   JSON.stringify({
    //     type: "update",
    //     message: message,
    //   })
    // );
    messageInputDom.value = "";
  };
});
