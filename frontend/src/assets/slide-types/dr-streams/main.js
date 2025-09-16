// SPDX-FileCopyrightText: 2025 Magenta ApS <https://magenta.dk>
// SPDX-License-Identifier: AGPL-3.0-only
import { queryParams } from "../../utils/utils";

// Parse config from query parameters
const config = {
  channel_url:
    queryParams.channel_url ||
    "https://drlivedr1hls.akamaized.net/hls/live/2113625/drlivedr1/6.m3u8",
  mute: queryParams.mute === "true",
};

document.addEventListener("DOMContentLoaded", function () {
  const video = document.getElementById("video");

  if (!video) {
    console.error("Video element not found");
    return;
  }

  const channelUrl = config.channel_url;

  // Check if we're in edit mode (mute by default in edit mode)
  const isInEditMode = queryParams.mode === "edit";

  if (!isInEditMode) {
    video.muted = config.mute;
  } else {
    video.muted = true; // Always muted in edit mode
  }

  // Initialize HLS streaming
  if (window.Hls && window.Hls.isSupported()) {
    const hls = new window.Hls();
    hls.loadSource(channelUrl);
    hls.attachMedia(video);
    hls.on(window.Hls.Events.MANIFEST_PARSED, () => {
      video.play().catch((error) => {
        console.error("Error playing video:", error);
      });
    });

    // Handle HLS errors
    hls.on(window.Hls.Events.ERROR, (event, data) => {
      console.error("HLS Error:", data);
      if (data.fatal) {
        switch (data.type) {
          case window.Hls.ErrorTypes.NETWORK_ERROR:
            console.error("Fatal network error encountered, trying to recover");
            hls.startLoad();
            break;
          case window.Hls.ErrorTypes.MEDIA_ERROR:
            console.error("Fatal media error encountered, trying to recover");
            hls.recoverMediaError();
            break;
          default:
            console.error("Fatal error, cannot recover");
            hls.destroy();
            break;
        }
      }
    });
  } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
    // Fallback for Safari/iOS
    video.src = channelUrl;
    video.addEventListener("loadedmetadata", () => {
      video.play().catch((error) => {
        console.error("Error playing video:", error);
      });
    });
  } else {
    // Browser doesn't support HLS
    console.error("HLS is not supported by this browser");
    video.outerHTML = `
      <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: white; text-align: center; padding: 20px;">
        <div>
          <h3>Video Streaming Not Supported</h3>
          <p>Your browser does not support HLS video streaming.</p>
          <p>Please use a modern browser like Chrome, Firefox, or Safari.</p>
        </div>
      </div>
    `;
  }
});
