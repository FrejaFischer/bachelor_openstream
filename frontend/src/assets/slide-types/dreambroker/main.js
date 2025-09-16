// SPDX-FileCopyrightText: 2025 Magenta ApS <https://magenta.dk>
// SPDX-License-Identifier: AGPL-3.0-only
import { queryParams } from "../../utils/utils";

// Parse config from query parameters
const config = {
  video_url: queryParams.video_url || "",
  muted: queryParams.muted === "true",
  userInputUrl: queryParams.userInputUrl || "",
};

document.addEventListener("DOMContentLoaded", function () {
  const videoElement = document.getElementById("fullscreen-video");

  if (!videoElement) {
    console.error("Video element not found");
    return;
  }

  const videoLink = config.video_url;

  if (!videoLink) {
    console.error("No video URL provided");
    videoElement.outerHTML = `
      <div style="display: flex; align-items: center; justify-content: center; height: 100vh; color: white; text-align: center; padding: 20px;">
        <div>
          <h3>No Video URL</h3>
          <p>Please configure a valid Dreambroker video URL.</p>
        </div>
      </div>
    `;
    return;
  }

  // Set video source
  videoElement.src = videoLink;

  // Check if we're in edit mode (mute by default in edit mode)
  const isInEditMode = queryParams.mode === "edit";

  if (!isInEditMode) {
    videoElement.muted = config.muted;
  } else {
    videoElement.muted = true; // Always muted in edit mode
  }

  // Make the video visible and start playback
  videoElement.style.display = "block";

  // Start playback with error handling
  videoElement.play().catch((error) => {
    console.error("Error playing video:", error);
    videoElement.outerHTML = `
      <div style="display: flex; align-items: center; justify-content: center; height: 100vh; color: white; text-align: center; padding: 20px;">
        <div>
          <h3>Video Playback Error</h3>
          <p>Unable to play the video. Please check the URL and try again.</p>
          <small>URL: ${videoLink}</small>
        </div>
      </div>
    `;
  });

  // Handle video errors
  videoElement.addEventListener("error", function (e) {
    console.error("Video error:", e);
    videoElement.outerHTML = `
      <div style="display: flex; align-items: center; justify-content: center; height: 100vh; color: white; text-align: center; padding: 20px;">
        <div>
          <h3>Video Loading Error</h3>
          <p>The video could not be loaded. Please check the URL format.</p>
          <small>URL: ${videoLink}</small>
        </div>
      </div>
    `;
  });
});
