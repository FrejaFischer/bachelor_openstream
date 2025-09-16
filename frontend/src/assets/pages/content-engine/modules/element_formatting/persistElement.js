// SPDX-FileCopyrightText: 2025 Magenta ApS <https://magenta.dk>
// SPDX-License-Identifier: AGPL-3.0-only
import { store } from "../core/slideStore.js";
import { queryParams } from "../../../../utils/utils.js";
import { loadSlide } from "../core/renderSlide.js";
import { pushCurrentSlideState } from "../core/undoRedo.js";
import { gettext } from "../../../../utils/locales.js";
import * as bootstrap from "bootstrap";

export function initPersistElement() {
  const persistButton = document.getElementById("persist-element-btn");
  if (persistButton) {
    persistButton.addEventListener("click", () => {
      if (store.selectedElementData) {
        const isPersistent = store.selectedElementData.isPersistent;
        if (isPersistent) {
          // Element is currently pinned, show confirmation modal for unpinning
          showUnpinConfirmationModal();
        } else {
          // Element is not pinned, pin it immediately
          pinElement();
        }
      }
    });
  }
}

function pinElement() {
  if (!store.selectedElementData) return;

  pushCurrentSlideState();
  store.selectedElementData.isPersistent = true;

  // Update visual feedback
  const persistButton = document.getElementById("persist-element-btn");
  updatePersistButtonState(persistButton, true);

  // Update element visual state
  if (store.selectedElement) {
    store.selectedElement.classList.add("is-persistent");
    addPersistentIndicator(store.selectedElement);
  }

  // Re-render all slides to show the element everywhere
  loadSlide(store.slides[store.currentSlideIndex]);
}

function unpinElement() {
  if (!store.selectedElementData) return;

  pushCurrentSlideState();
  const element = store.selectedElementData;
  const currentSlideIndex = store.currentSlideIndex;
  const originSlideIndex = element.originSlideIndex;

  element.isPersistent = false;
  store.selectedElement.classList.remove("is-persistent");

  const persistButton = document.getElementById("persist-element-btn");
  updatePersistButtonState(persistButton, false);

  const toolbar = document.querySelector(".toolbar-general");
  if (toolbar) {
    toolbar.style.visibility = "hidden";
  }

  if (
    store.slides[currentSlideIndex].elements.some((el) => el.id === element.id)
  ) {
    store.selectedElement.querySelector(".persistent-indicator").remove();
  } else {
    store.selectedElement.remove();
  }

  // Clear selection since the element behavior is changing
  store.selectedElement = null;
  store.selectedElementData = null;
  window.selectedElementForUpdate = null;
}

function showUnpinConfirmationModal() {
  const element = store.selectedElementData;
  if (!element) return;

  // Find the origin slide information
  const originSlideIndex = element.originSlideIndex;
  let originSlideName = gettext("Unknown Slide");
  let originSlideNumber = 1;

  if (typeof originSlideIndex === "number" && store.slides[originSlideIndex]) {
    originSlideName = store.slides[originSlideIndex].name;
    originSlideNumber = originSlideIndex + 1;
  }

  // Update modal content
  const originSlideNameEl = document.getElementById("originSlideName");
  const originSlideNumberEl = document.getElementById("originSlideNumber");

  if (originSlideNameEl) originSlideNameEl.textContent = originSlideName;
  if (originSlideNumberEl) originSlideNumberEl.textContent = originSlideNumber;

  // Show the modal
  const modal = new bootstrap.Modal(
    document.getElementById("unpinConfirmationModal"),
  );
  modal.show();

  // Set up the confirm button event listener (remove any existing listeners first)
  const confirmBtn = document.getElementById("confirmUnpinBtn");
  if (confirmBtn) {
    // Clone the button to remove all existing event listeners
    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);

    // Add new event listener
    newConfirmBtn.addEventListener("click", () => {
      modal.hide();
      unpinElement();
    });
  }
}

function updatePersistButtonState(button, isPersistent) {
  const icon = button.querySelector(".material-symbols-outlined");
  const statusText = button.querySelector(".persist-status-text");

  if (isPersistent) {
    // Active state - element is pinned
    button.classList.remove("btn-secondary");
    button.classList.add("btn-primary");
    icon.style.fontVariationSettings = "'FILL' 1"; // Filled pin icon
    button.setAttribute(
      "data-bs-title",
      gettext("Element is pinned to all slides. Click to unpin."),
    );
  } else {
    // Inactive state - element is not pinned
    button.classList.remove("btn-primary");
    button.classList.add("btn-secondary");
    icon.style.fontVariationSettings = "'FILL' 0"; // Outlined pin icon
    button.setAttribute(
      "data-bs-title",
      gettext("Pin this element to appear on all slides."),
    );
  }
}

function addPersistentIndicator(element) {
  // Check if indicator already exists
  if (element.querySelector(".persistent-indicator")) {
    return;
  }

  // Only add in editor mode
  if (queryParams.mode !== "edit" && queryParams.mode !== "template_editor") {
    return;
  }

  const persistentIndicator = document.createElement("div");
  persistentIndicator.className = "persistent-indicator";
  persistentIndicator.innerHTML =
    '<span class="material-symbols-outlined">push_pin</span>';
  persistentIndicator.style.cssText = `
        position: absolute;
        top: 8px;
        right: 8px;
        width: 40px;
        height: 40px;
        background-color: black;
        color: white;
        border: 3px solid white;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 22px;
        z-index: 1000;
        box-shadow: 0 3px 8px rgba(0,0,0,0.5);
        pointer-events: none;
    `;
  persistentIndicator.querySelector(
    ".material-symbols-outlined",
  ).style.fontVariationSettings = "'FILL' 1";
  element.appendChild(persistentIndicator);
}

// Export the update function so it can be called when elements are selected
export function updatePersistButtonForSelectedElement() {
  const persistButton = document.getElementById("persist-element-btn");
  if (persistButton && store.selectedElementData) {
    const isPersistent = store.selectedElementData.isPersistent || false;
    updatePersistButtonState(persistButton, isPersistent);
  }
}
