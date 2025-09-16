// SPDX-FileCopyrightText: 2025 Magenta ApS <https://magenta.dk>
// SPDX-License-Identifier: AGPL-3.0-only
import { store } from "../core/slideStore.js";
import { pushCurrentSlideState } from "../core/undoRedo.js";
import { loadSlide } from "../core/renderSlide.js";
import { updateSlideSelector } from "../core/slideSelector.js";
import { showToast } from "../../../../utils/utils.js";
import { displayMediaModal } from "../modals/mediaModal.js";
import { gettext } from "../../../../utils/locales.js";
import * as bootstrap from "bootstrap";

// Define image extensions list for filtering
const imageExtensionsList = ["png", "jpeg", "jpg", "svg", "pdf", "webp"];

// Set the background image and then show display options.
function setSlideBackgroundImage(imageId) {
  if (store.currentSlideIndex === -1) {
    showToast(gettext("Please select a slide first!"), "Info");
    return;
  }
  // Save state for undo/redo.
  pushCurrentSlideState();
  // Save the chosen image ID.
  store.slides[store.currentSlideIndex].backgroundImage = imageId;
  // Set default display options.
  store.slides[store.currentSlideIndex].backgroundSize = "contain"; // default is "contain"
  store.slides[store.currentSlideIndex].backgroundRepeat = "no-repeat";
  store.slides[store.currentSlideIndex].backgroundPosition = "center";

  // Load the slide to display the background image
  loadSlide(store.slides[store.currentSlideIndex]);
  updateSlideSelector();

  // Show options modal instead of popover
  showBackgroundImageOptionsModal();
}

// Show Bootstrap modal to choose background sizing and positioning
function showBackgroundImageOptionsModal() {
  const modal = new bootstrap.Modal(
    document.getElementById("backgroundImageOptionsModal"),
  );

  // Update active states before showing the modal
  updateActiveStates();

  modal.show();
}

// Update active states to show current settings
function updateActiveStates() {
  if (store.currentSlideIndex === -1) return;

  const slide = store.slides[store.currentSlideIndex];

  // Clear all active states first
  document.querySelectorAll(".bg-option-btn").forEach((btn) => {
    btn.classList.remove("active");
    btn.classList.remove("btn-primary");
    btn.classList.add("btn-outline-primary");
  });

  document.querySelectorAll(".bg-position-btn").forEach((btn) => {
    btn.classList.remove("active");
    btn.classList.remove("btn-secondary");
    btn.classList.add("btn-outline-secondary");
  });

  // Set active state for sizing option
  const currentSize = slide.backgroundSize || "contain";
  const currentRepeat = slide.backgroundRepeat || "no-repeat";

  let activeOptionBtn = null;
  if (currentSize === "contain" && currentRepeat === "no-repeat") {
    activeOptionBtn = document.getElementById("bgOption-contain");
  } else if (currentSize === "auto" && currentRepeat === "no-repeat") {
    activeOptionBtn = document.getElementById("bgOption-original");
  } else if (currentSize === "100% 100%" && currentRepeat === "no-repeat") {
    activeOptionBtn = document.getElementById("bgOption-stretch");
  } else if (currentSize === "auto" && currentRepeat === "repeat") {
    activeOptionBtn = document.getElementById("bgOption-repeat");
  }

  if (activeOptionBtn) {
    activeOptionBtn.classList.add("active");
    activeOptionBtn.classList.remove("btn-outline-primary");
    activeOptionBtn.classList.add("btn-primary");
  }

  // Set active state for position option
  const currentPosition = slide.backgroundPosition || "center";
  const activePositionBtn = document.querySelector(
    `[data-position="${currentPosition}"]`,
  );

  if (activePositionBtn) {
    activePositionBtn.classList.add("active");
    activePositionBtn.classList.remove("btn-outline-secondary");
    activePositionBtn.classList.add("btn-secondary");
  }
}

// Initialize background image options modal event listeners
function initBackgroundImageOptionsModal() {
  // Change background image button
  document
    .getElementById("bgOption-changeImage")
    .addEventListener("click", () => {
      // Hide the options modal first
      const optionsModal = bootstrap.Modal.getInstance(
        document.getElementById("backgroundImageOptionsModal"),
      );
      optionsModal.hide();

      // Open media selector
      displayMediaModal(
        1,
        setSlideBackgroundImage,
        {
          file_types: imageExtensionsList,
        },
        gettext("Image"),
      );
    });

  // Sizing options - don't close modal, just apply changes
  document.getElementById("bgOption-contain").addEventListener("click", () => {
    applyBackgroundOption("contain", "no-repeat");
  });

  document.getElementById("bgOption-original").addEventListener("click", () => {
    applyBackgroundOption("auto", "no-repeat");
  });

  document.getElementById("bgOption-stretch").addEventListener("click", () => {
    applyBackgroundOption("100% 100%", "no-repeat");
  });

  document.getElementById("bgOption-repeat").addEventListener("click", () => {
    applyBackgroundOption("auto", "repeat");
  });

  // Position options - don't close modal, just apply changes
  document.querySelectorAll("[data-position]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const position = btn.getAttribute("data-position");
      applyBackgroundPosition(position);
    });
  });

  // Remove background option
  document.getElementById("bgOption-remove").addEventListener("click", () => {
    // Hide the options modal first
    const optionsModal = bootstrap.Modal.getInstance(
      document.getElementById("backgroundImageOptionsModal"),
    );
    optionsModal.hide();

    // Show confirmation modal
    const confirmModal = new bootstrap.Modal(
      document.getElementById("removeBgImageConfirmModal"),
    );
    confirmModal.show();

    // Set up one-time event listener for confirmation
    const confirmBtn = document.getElementById("confirmRemoveBgImage");
    const handleConfirm = () => {
      pushCurrentSlideState();
      // Remove background image properties
      store.slides[store.currentSlideIndex].backgroundImage = null;
      delete store.slides[store.currentSlideIndex].backgroundSize;
      delete store.slides[store.currentSlideIndex].backgroundRepeat;
      delete store.slides[store.currentSlideIndex].backgroundPosition;
      loadSlide(store.slides[store.currentSlideIndex]);
      updateSlideSelector();
      confirmModal.hide();

      // Remove the event listener after use
      confirmBtn.removeEventListener("click", handleConfirm);
    };

    confirmBtn.addEventListener("click", handleConfirm);
  });
}

// Apply background size and repeat options (keep modal open)
function applyBackgroundOption(size, repeat) {
  pushCurrentSlideState();
  store.slides[store.currentSlideIndex].backgroundSize = size;
  store.slides[store.currentSlideIndex].backgroundRepeat = repeat;
  loadSlide(store.slides[store.currentSlideIndex]);
  updateSlideSelector();

  // Update active states to reflect the change
  updateActiveStates();

  // Don't close the modal - let users experiment with different options
}

// Apply background position (keep modal open)
function applyBackgroundPosition(position) {
  pushCurrentSlideState();
  store.slides[store.currentSlideIndex].backgroundPosition = position;
  loadSlide(store.slides[store.currentSlideIndex]);
  updateSlideSelector();

  // Update active states to reflect the change
  updateActiveStates();

  // Don't close the modal - let users experiment with different options
}

export function initSlideBackgroundImage() {
  // Initialize the background image options modal
  initBackgroundImageOptionsModal();

  const bgImageOption = document.querySelector(
    '[data-type="change-slide-background-image"]',
  );
  if (bgImageOption) {
    bgImageOption.addEventListener("click", () => {
      if (store.currentSlideIndex === -1) {
        showToast("Please select a slide first!", "Info");
        return;
      }

      // Check if slide already has a background image
      if (store.slides[store.currentSlideIndex].backgroundImage) {
        // If background image exists, show options modal directly
        showBackgroundImageOptionsModal();
      } else {
        // If no background image, show media selector first
        displayMediaModal(
          1,
          setSlideBackgroundImage,
          {
            file_types: imageExtensionsList,
          },
          gettext("Image"),
        );
      }
    });
  }
}
