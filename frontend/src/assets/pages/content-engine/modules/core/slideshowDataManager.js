// SPDX-FileCopyrightText: 2025 Magenta ApS <https://magenta.dk>
// SPDX-License-Identifier: AGPL-3.0-only
import { store } from "./slideStore.js";
import { loadSlide, scaleAllSlides } from "./renderSlide.js";
import { updateSlideSelector } from "./slideSelector.js";
import {
  autoHyphenate,
  showToast,
  token,
  selectedBranchID,
} from "../../../../utils/utils.js";
import { openAddSlideModal } from "./addSlide.js";
import { BASE_URL } from "../../../../utils/constants.js";
import { gettext } from "../../../../utils/locales.js";

let autosaveTimer = null;

// Fetching slideshow with slideshowID from function params and selectedBranchID from utils file (get it from query params)
export async function fetchSlideshow(slideshowId) {
  try {
    const resp = await fetch(
      `${BASE_URL}/api/manage_content/?id=${slideshowId}&includeSlideshowData=true&branch_id=${selectedBranchID}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      },
    );
    if (!resp.ok) {
      throw new Error(
        `Failed to load slideshow (ID = ${slideshowId}). Status: ${resp.status}`,
      );
    }
    const data = await resp.json();
    // Set store.slidieshowMode to data.mode
    store.slideshowMode = data.mode;
    // Sets the title element of the slideshow to be data.name
    document.querySelector("#contentEngineTitle").innerHTML = autoHyphenate(data.name);
    // Sets text for slideshow mode in text element
    if (store.slideshowMode === "interactive") {
      document.getElementById("slideshow-mode-text").innerText =
        gettext("Interactive Mode");
    }

    if (store.slideshowMode === "slideshow") {
      document.getElementById("slideshow-mode-text").innerText =
        gettext("Slideshow Mode");
    }

    // Set preview dimensions if they exist in the data. preview height and width is set to be the selected aspect ratio width/height when slideshow is being created
    if (data.previewHeight && data.previewWidth) {
      store.emulatedWidth = data.previewWidth;
      store.emulatedHeight = data.previewHeight;
    }
    // Check if data contains slideshow_data, and there is slides inside and there is more than zero slides
    console.log("This is the data:", data);
    if (data.slideshow_data && data.slideshow_data.slides && data.slideshow_data.slides.length > 0) {
      // Handle the slides - Set the store slides to be empty (start from scratch)
      store.slides.length = 0;
      // Add them to store slides
      data.slideshow_data.slides.forEach((s) => store.slides.push(s));

      store.slides.forEach((s) => {
        if (!s.undoStack) s.undoStack = []; // ??? What is undoStack and redoStack? And why do we do the same on lines 54+55 and 59+60?
        if (!s.redoStack) s.redoStack = [];
      });

      store.slides.forEach((s) => {
        if (!s.undoStack) s.undoStack = [];
        if (!s.redoStack) s.redoStack = [];

        // set data about activation (slide activating setting feature) to be included in the slide (it is not set in the creating of a slide)
        // --> ADDED: Default activation properties <--
        if (typeof s.activationEnabled === "undefined") {
          s.activationEnabled = false;
        }
        if (typeof s.activationDate === "undefined") {
          s.activationDate = null;
        }
        if (typeof s.deactivationDate === "undefined") {
          s.deactivationDate = null;
        }
      });
      // Here it checks how many elements each slide have, so it knows what the next element id number should be
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
      // Store what the current slides contains in a string, called lastSlidesStr in store. This is used later to compare the slides to check for changes
      store.lastSlidesStr = JSON.stringify(store.slides);
      store.currentSlideIndex = 0; // It is the index of the slide which are being shown in the editor. We set it here to be the first slide (starts with 0)

      if (store.currentSlideIndex > -1) {
        loadSlide(store.slides[store.currentSlideIndex]); // Load the slide which are being shown (the first one)
      }
      scaleAllSlides(); // Scale the slides (the view of the slides in the editor)
    } else {
      // If there is no slides (the slideshow is empty)
      // Instead of creating a blank slide, open the add slide modal
      // so users can choose to add a blank slide or use a template
      store.slides = [];
      store.lastSlidesStr = JSON.stringify(store.slides);
      store.currentSlideIndex = -1;

      // Clear the preview area and show placeholder
      const previewSlide = document.querySelector(".preview-slide");
      if (previewSlide) {
        previewSlide.innerHTML =
          '<p class="text-center text-muted mt-5 no-content-placeholder">' +
          gettext("No slides available. Please add a slide to get started.") +
          "</p>";
      }

      // Open the add slide modal
      setTimeout(() => {
        openAddSlideModal();
      }, 100); // Small delay to ensure DOM is ready
    }

    updateSlideSelector(); // All functionality from the slide selector / overview of the left
  } catch (err) {
    console.error("Error fetching slideshow data:", err);
    showToast(`Failed to load slideshow: ${err.message}`, "Error");
  }
}

export function connectToSlideshow(slideshowId) {
  try {
    const slideshowWS = new WebSocket(`ws://localhost:8000/ws/slideshows/${slideshowId}/?branch=${selectedBranchID}`);
    // ${BASE_URL}/ws/slideshows (BASE_URL = http://) - TO DO: Make WS BASE_URL version?

    if (localStorage.getItem("accessToken")) {
      slideshowWS.onopen = () => {
        slideshowWS.send(
          JSON.stringify({
            type: "authenticate",
            token: localStorage.getItem("accessToken"),
          })
        );
      };
    } else {
      console.error("Error making WS connection to slideshow: Missing Access token");
      showToast("Failed to load slideshow: Authentication failed", "Error");
    }

    slideshowWS.onclose = (e) => {
      console.log("WebSocket closed:");
      console.log("Code:", e.code); // Show which closing code the socket closed with
    };

    slideshowWS.onmessage = (e) => {
      const data = JSON.parse(e.data);

      // Catch slideshow data coming from WS
      if (data.data) {
        // TO DO: Check if incoming data is different from current slideshow data?
        // if ( {how the slideshow is now} !== {the slideshow being sent}) {
        //   // render the slideshow again
        //   console.log("I am handling it");
        //   handleSlideshowData(data.data);
        // }
        console.log("This is received data: ", data.data);
        handleSlideshowData(data.data);
      }

      // Catch errors coming from WS
      if (data.error) {
        const error = JSON.stringify(data.error);
        const error_code = data.code ? JSON.stringify(data.code) : "";
        console.error(`WS Error: ${error}, ${error_code}`);
        showToast(`Error: ${error}`, "Error");
      }
    };
  } catch (err) {
    console.error("Error fetching slideshow data:", err);
    showToast(`Failed to load slideshow: ${err.message}`, "Error");
  }
}

function handleSlideshowData(data) {
  try {
    // Set store.slidieshowMode to data.mode
    store.slideshowMode = data.mode;
    // Sets the title element of the slideshow to be data.name
    document.querySelector("#contentEngineTitle").innerHTML = autoHyphenate(data.name);
    // Sets text for slideshow mode in text element
    if (store.slideshowMode === "interactive") {
      document.getElementById("slideshow-mode-text").innerText = gettext("Interactive Mode");
    }

    if (store.slideshowMode === "slideshow") {
      document.getElementById("slideshow-mode-text").innerText = gettext("Slideshow Mode");
    }

    // Set preview dimensions if they exist in the data. preview height and width is set to be the selected aspect ratio width/height when slideshow is being created
    if (data.previewHeight && data.previewWidth) {
      store.emulatedWidth = data.previewWidth;
      store.emulatedHeight = data.previewHeight;
    }
    // Check if data contains slideshow_data, and there is slides inside and there is more than zero slides
    if (data.slideshow_data && data.slideshow_data.slides && data.slideshow_data.slides.length > 0) {
      // Handle the slides - Set the store slides to be empty (start from scratch)
      store.slides.length = 0;
      // Add them to store slides
      data.slideshow_data.slides.forEach((s) => store.slides.push(s));

      store.slides.forEach((s) => {
        if (!s.undoStack) s.undoStack = [];
        if (!s.redoStack) s.redoStack = [];
      });

      store.slides.forEach((s) => {
        if (!s.undoStack) s.undoStack = [];
        if (!s.redoStack) s.redoStack = [];

        // set data about activation (slide activating setting feature) to be included in the slide (it is not set in the creating of a slide)
        // --> ADDED: Default activation properties <--
        if (typeof s.activationEnabled === "undefined") {
          s.activationEnabled = false;
        }
        if (typeof s.activationDate === "undefined") {
          s.activationDate = null;
        }
        if (typeof s.deactivationDate === "undefined") {
          s.deactivationDate = null;
        }
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
      // Store what the current slides contains in a string, called lastSlidesStr in store. This is used later to compare the slides to check for changes
      store.lastSlidesStr = JSON.stringify(store.slides);
      store.currentSlideIndex = 0; // It is the index of the slide which are being shown in the editor. We set it here to be the first slide (starts with 0)

      if (store.currentSlideIndex > -1) {
        loadSlide(store.slides[store.currentSlideIndex]); // Load the slide which are being shown (the first one)
      }
      scaleAllSlides(); // Scale the slides (the view of the slides in the editor)
    } else {
      // If there is no slides (the slideshow is empty)
      // Instead of creating a blank slide, open the add slide modal
      // so users can choose to add a blank slide or use a template
      store.slides = [];
      store.lastSlidesStr = JSON.stringify(store.slides);
      store.currentSlideIndex = -1;

      // Clear the preview area and show placeholder
      const previewSlide = document.querySelector(".preview-slide");
      if (previewSlide) {
        previewSlide.innerHTML = '<p class="text-center text-muted mt-5 no-content-placeholder">' + gettext("No slides available. Please add a slide to get started.") + "</p>";
      }

      // Open the add slide modal
      setTimeout(() => {
        openAddSlideModal();
      }, 100); // Small delay to ensure DOM is ready
    }

    updateSlideSelector(); // All functionality from the slide selector / overview of the left
  } catch (err) {
    console.error("Error showing slideshow data:", err);
    showToast(`Failed to show slideshow: ${err.message}`, "Error");
  }
}

export function initAutoSave(slideshowId) {
  if (autosaveTimer) {
    clearInterval(autosaveTimer);
    autosaveTimer = null;
  }

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

export async function saveSlideshow(slideshowId) {
  const payload = {
    ...(store.emulatedHeight && { previewHeight: store.emulatedHeight }),
    ...(store.emulatedWidth && { previewWidth: store.emulatedWidth }),
    slideshow_data: { slides: store.slides },
  };

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
    throw new Error(
      gettext("Auto-save failed. Status: ") + `${resp.status}: ${errTxt}`,
    );
  }

  const updated = await resp.json();
  return updated;
}

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
