// import { BASE_URL } from "../../utils/constants";

document.addEventListener("DOMContentLoaded", async () => {
  //   const roomName = JSON.parse(document.getElementById("room-name").textContent);
  const roomName = "room1";

  const chatSocket = new WebSocket("ws://localhost:8000" + "/ws/chat/" + roomName + "/");
  // ${BASE_URL}/ws/chat/{roomName}/ (BASE_URL = http://) - TO DO: Make WS BASE_URL version?
  // ws://localhost:8000/ws/chat/{roomName}/

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
    const updated_slideshow_data = { name: "my new name" };
    chatSocket.send(
      JSON.stringify({
        message: message,
        data: updated_slideshow_data,
      })
    );
    messageInputDom.value = "";
  };
});
