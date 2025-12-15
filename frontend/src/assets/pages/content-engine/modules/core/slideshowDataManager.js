// SPDX-FileCopyrightText: 2025 Magenta ApS <https://magenta.dk>
// SPDX-License-Identifier: AGPL-3.0-only
import { store } from "./slideStore.js";
import { loadSlide, scaleAllSlides } from "./renderSlide.js";
import { updateSlideSelector } from "./slideSelector.js";
import { autoHyphenate, showToast, token, selectedBranchID } from "../../../../utils/utils.js";
import { openAddSlideModal } from "./addSlide.js";
import { BASE_URL } from "../../../../utils/constants.js";
import { gettext } from "../../../../utils/locales.js";

let autosaveTimer = null;
let slideshowSocket = null;

/**
 * Helper function for creating URL to backends WebSocket endpoint
 * @param {*} slideshowId Slideshow to connect to
 * @returns 
 */
function buildWsUrl(slideshowId) {
  const parsed = new URL(BASE_URL);
  const protocol = parsed.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${parsed.host}/ws/slideshows/${slideshowId}/?branch=${selectedBranchID}`;
}

/**
 * Connecting client to the slideshow through a WebSocket,
 * gets the current slideshow data after connection is open
 * and handle receiving messages / slideshow updates from socket
 * @param {*} slideshowId Sldieshow to create WS connection for
 */
export function connectToSlideshow(slideshowId) {
  // Close previous socket if any
  if (slideshowSocket) {
    try {
      slideshowSocket.close();
    } catch (e) {
      console.warn("Error closing previous slideshow socket", e);
    }
    slideshowSocket = null;
  }

  try {
    const wsUrl = buildWsUrl(slideshowId);
    slideshowSocket = new WebSocket(wsUrl);

    // Initialize auto saving
    initAutoSave(slideshowId);

    // First send authentication message (WS consumer expects this as first message)
    slideshowSocket.onopen = () => {
      if (token) {
        slideshowSocket.send(
          JSON.stringify({
            type: "authenticate",
            token: token,
          })
        );
      } else {
        console.error("Error making WS connection to slideshow: Missing Access token");
        showToast("Failed to connect to realtime view of slideshow: Authentication failed", "Error");
      }
    }

    slideshowSocket.onclose = (e) => {
      console.log("Slideshow socket closed", e.code);
      slideshowSocket = null;
      // set interval from saving to null? is this nessecary?
      autosaveTimer = null;
    };

    slideshowSocket.onmessage = (e) => {
      const msg = JSON.parse(e.data);

      // Catch slideshow data coming from WS
      if (msg.data) {
        const incomingStr = JSON.stringify(msg.data.slideshow_data?.slides ?? []);

        // Only apply if different from last saved local state
        if (incomingStr !== store.lastSlidesStr) {
          console.log("Incoming WS update is different — applying update");

          handleSlideshowData(msg.data);
        }
      }

      // Catch errors coming from socket
      if (msg.error) {
        const errorMsg = msg.error || "WebSocket error";
        const code = msg.code ? ` (code ${msg.code})` : "";
        showToast(`Socket error: ${errorMsg}${code}`, "Error");
        return;
      }

      // Handle simple messages
      if (msg.message) {
        console.log("Socket message:", msg.message);
      }
    };
  } catch (err) {
    console.error("Error fetching slideshow data:", err);
    showToast(`Failed to load slideshow: ${err.message}`, "Error");
  }
}

/**
 * Handles slideshow data by updating local store object and callig loadSlide to render the DOM
 * @param {*} data Slideshow data to handle
 */
function handleSlideshowData(data) {
  try {
    store.slideshowMode = data.mode;
    if (data.name) {
      const titleEl = document.querySelector("#contentEngineTitle");
      if (titleEl) titleEl.innerHTML = autoHyphenate(data.name);
    }

    if (store.slideshowMode === "interactive") {
      const el = document.getElementById("slideshow-mode-text");
      if (el) el.innerText = gettext("Interactive Mode");
    }

    if (store.slideshowMode === "slideshow") {
      const el = document.getElementById("slideshow-mode-text");
      if (el) el.innerText = gettext("Slideshow Mode");
    }

    // Set preview dimensions if they exist in the data (regardless of slides)
    if (data.previewHeight && data.previewWidth) {
      store.emulatedWidth = data.previewWidth;
      store.emulatedHeight = data.previewHeight;
    }

    if (data.slideshow_data && data.slideshow_data.slides && data.slideshow_data.slides.length > 0) {
      store.slides.length = 0;
      data.slideshow_data.slides.forEach((s) => store.slides.push(s));

      store.slides.forEach((s) => {
        if (!s.undoStack) s.undoStack = [];
        if (!s.redoStack) s.redoStack = [];

        if (typeof s.activationEnabled === "undefined") s.activationEnabled = false;
        if (typeof s.activationDate === "undefined") s.activationDate = null;
        if (typeof s.deactivationDate === "undefined") s.deactivationDate = null;
      });

      for (const slide of store.slides) {
        slide.elements.forEach((element) => {
          if (element.id >= store.elementIdCounter) {
            store.elementIdCounter = element.id + 1;
          }
        });
      }

      // Restore html, css, js fields for HTML elements from the combined content
      store.slides.forEach((slide) => {
        slide.elements.forEach((element) => {
          if (element.type === "html" && element.content) {
            try {
              const parser = new DOMParser();
              const doc = parser.parseFromString(element.content, "text/html");
              element.html = doc.body.innerHTML.trim();
              const styleEl = doc.querySelector("style");
              element.css = styleEl ? styleEl.textContent : "";
              const scriptEl = doc.querySelector("script");
              element.js = scriptEl ? scriptEl.textContent : "";
            } catch (e) {
              console.error("Failed to parse HTML element content", e);
              element.html = element.html || "";
              element.css = element.css || "";
              element.js = element.js || "";
            }
          }
        });
      });

      // Set current slides to be lastSlidesStr to check for changes later
      store.lastSlidesStr = JSON.stringify(store.slides);

      // If currentSlideIndex is not set (first load), then set to the first slide
      if (store.currentSlideIndex < 0) {
        store.currentSlideIndex = 0;
      }

      if (store.currentSlideIndex > -1) {
        // Load current slide being viewed - with force complete reload - to ensure changes is shown
        loadSlide(store.slides[store.currentSlideIndex], ".preview-slide", true, true);
      }
      scaleAllSlides();
    } else {
      // No slides — clear store and show UI placeholder
      store.slides = [];
      store.lastSlidesStr = JSON.stringify(store.slides);
      store.currentSlideIndex = -1;

      const previewSlide = document.querySelector(".preview-slide");
      if (previewSlide) {
        previewSlide.innerHTML = '<p class="text-center text-muted mt-5 no-content-placeholder">' + gettext("No slides available. Please add a slide to get started.") + "</p>";
      }

      // Open the add slide modal
      setTimeout(() => {
        openAddSlideModal();
      }, 100); // Small delay to ensure DOM is ready
    }

    updateSlideSelector();
  } catch (err) {
    console.error("Error applying slideshow payload:", err);
  }
}

/**
 * Checks if socket exists and is open
 * @returns true if socket is available, or false if not
 */
function isSocketReady() {
  return slideshowSocket && slideshowSocket.readyState === WebSocket.OPEN;
}

/**
 * Sends slideshow update through WebSocket connection if any
 * @param {*} payload The slideshow update
 * @returns true if update is succesfully send, false if not
 */
function sendUpdateThroughSocket(payload) {
  if (!isSocketReady()) {
    return false;
  }
  try {
    slideshowSocket.send(
      JSON.stringify({
        type: "update",
        data: payload,
      })
    );
    return true;
  } catch (err) {
    console.error("Failed to send slideshow update via socket", err);
    return false;
  }
}

/**
 * Initialize auto saving slideshow
 * Checks for changes in an interval, and calls saveSlideshow if changes is detected
 * @param {*} slideshowId The slideshow ID
 */
export function initAutoSave(slideshowId) {

  // Clear autosaveTimer is it alreadyt exists
  if (autosaveTimer) {
    clearInterval(autosaveTimer);
    autosaveTimer = null;
  }

  // Create autosaveTimer with interval
  autosaveTimer = setInterval(() => {
    const currentStateStr = JSON.stringify(store.slides);

    if (currentStateStr !== store.lastSlidesStr) {
      // Update lastSlidesStr before saving to prevent duplicate triggers
      store.lastSlidesStr = currentStateStr;
      saveSlideshow(slideshowId)
        .then(() => {
          showSavingStatus();
        })
        .catch((err) => {
          console.error("Auto-save failed:", err);
          showToast(gettext("Auto-save error: ") + err.message, "Error");
        });
    }
  }, 500);
}

/**
 * Saves slideshow by Id. First tries to save through websocket, else makes HTTP PATCH request
 * @param {*} slideshowId Slideshow to save
 * @returns object with socket confirmation if sent through websocket, else returns response from HTTP request
 */
export async function saveSlideshow(slideshowId) {
  const payload = {
    ...(store.emulatedHeight && { previewHeight: store.emulatedHeight }),
    ...(store.emulatedWidth && { previewWidth: store.emulatedWidth }),
    slideshow_data: { slides: store.slides },
  };

  // Try to real-time update via WebSocket first
  const sentViaSocket = sendUpdateThroughSocket(payload);
  if (sentViaSocket) {
    console.log("Send via socket");
    return { via: "socket" };
  }

  // Else update via HTTP PATCH if socket is not available
  const url = `${BASE_URL}/api/manage_content/${slideshowId}/?branch_id=${selectedBranchID}`;
  const resp = await fetch(url, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) {
    const errTxt = await resp.text();
    throw new Error(gettext("Auto-save failed. Status: ") + `${resp.status}: ${errTxt}`);
  }

  const updated = await resp.json();
  console.log("HTTP update happened");
  return updated;
}

/**
 * Updates saving status in UI after last save
 * @returns if no auto save element found in UI
 */
export function showSavingStatus() {
  const autosaveInfo = document.querySelector(".autosave-info");
  if (!autosaveInfo) return;

  autosaveInfo.innerHTML = `
    <span>
      <i class="material-symbols-outlined text-secondary me-1 saving-icon" 
         >sync</i>
      ${gettext("Saving...")}
    </span>
  `;

  setTimeout(() => {
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    autosaveInfo.innerHTML = `
      <span class="text-muted small">
        <i class="material-symbols-outlined text-secondary me-1" 
          >sync</i>
          
           <i class="material-symbols-outlined text-secondary me-1" >save</i>
         <strong>${timeStr}</strong>
      </span>
    `;
  }, 500);
}

/**
 * Function for fetching slideshow data with HTTP request.
 * @param {*} slideshowId The slideshow to fetch
 */
export async function fetchSlideshow(slideshowId) {
  try {
    const resp = await fetch(`${BASE_URL}/api/manage_content/?id=${slideshowId}&includeSlideshowData=true&branch_id=${selectedBranchID}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });
    if (!resp.ok) {
      throw new Error(`Failed to load slideshow (ID = ${slideshowId}). Status: ${resp.status}`);
    }
    const data = await resp.json();
    
    handleSlideshowData(data);
  } catch (err) {
    console.error("Error fetching slideshow data:", err);
    showToast(`Failed to load slideshow: ${err.message}`, "Error");
  }
}