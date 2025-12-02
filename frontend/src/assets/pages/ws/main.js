// SPDX-FileCopyrightText: 2025 Freja Fischer Nielsen <https://github.com/FrejaFischer/bachelor_openstream>
// SPDX-License-Identifier: AGPL-3.0-only
// import { BASE_URL } from "../../utils/constants";

document.addEventListener("DOMContentLoaded", async () => {
  //   const roomName = JSON.parse(document.getElementById("room-name").textContent);
  const roomName = "room1";

  const chatSocket = new WebSocket("ws://localhost:8000" + "/ws/chat/" + roomName + "/");
  // ${BASE_URL}/ws/chat/{roomName}/ (BASE_URL = http://) - TO DO: Make WS BASE_URL version?
  // ws://localhost:8000/ws/chat/{roomName}/

  // Test if user can send anything without sending token (will get rejected by backend)
  // chatSocket.onopen = () => {
  //   console.log("trying to send");
  //   chatSocket.send(
  //     JSON.stringify({
  //       type: "message",
  //       message: "hello!!",
  //     })
  //   );
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
      // console.log("middle");
      // chatSocket.send(
      //   JSON.stringify({
      //     type: "message",
      //     message: "hello!!",
      //   })
      // );
    };
  }

  chatSocket.onmessage = function (e) {
    console.log("onMessage", e);
    const data = JSON.parse(e.data);
    console.log(data);
    if (data.message) {
      document.querySelector("#chat-log").value += data.message + "\n";
    }
    if (data.data) {
      const data_ready = JSON.stringify(data.data);
      document.querySelector("#chat-log").value += data_ready + "\n";
    }
    if (data.current_slideshow) {
      const current_slideshow = JSON.stringify(data.current_slideshow);
      document.querySelector("#chat-log").value += current_slideshow + "\n";
    }
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
    //const updated_slideshow_data = { name: "my new name" };
    chatSocket.send(
      JSON.stringify({
        type: "message",
        message: message,
      })
    );
    // chatSocket.send(
    //   JSON.stringify({
    //     type: "update",
    //     message: message,
    //     data: updated_slideshow_data,
    //   })
    // );
    messageInputDom.value = "";
  };
});
