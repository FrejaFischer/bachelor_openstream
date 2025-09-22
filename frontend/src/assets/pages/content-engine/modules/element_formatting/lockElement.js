// SPDX-FileCopyrightText: 2025 Magenta ApS <https://magenta.dk>
// SPDX-License-Identifier: AGPL-3.0-only
import { store } from "../core/slideStore.js";
import { pushCurrentSlideState } from "../core/undoRedo.js";
import { queryParams } from "../../../../utils/utils.js";
import { gettext } from "../../../../utils/locales.js";

export function initLockElement() {
  const lockButton = document.getElementById("lock-element-btn");
  if (lockButton) {
    // Show/hide and allow toggling depending on selection; handler toggles lock in any mode
    lockButton.addEventListener("click", () => {
      if (store.selectedElementData) {
        toggleElementLock();
      }
    });
  }
}

function toggleElementLock() {
  if (!store.selectedElementData) return;

  pushCurrentSlideState();

  const isLocked = store.selectedElementData.isLocked;
  store.selectedElementData.isLocked = !isLocked;

  // Update visual feedback
  const lockButton = document.getElementById("lock-element-btn");
  updateLockButtonState(lockButton, !isLocked);

  // Update element class for styling (keep for hover effect)
  if (store.selectedElement) {
    if (!isLocked) {
      store.selectedElement.classList.add("is-locked");
    } else {
      store.selectedElement.classList.remove("is-locked");
    }
  }
}

function updateLockButtonState(button, isLocked) {
  if (!button) return;

  const icon = button.querySelector(".material-symbols-outlined");
  if (isLocked) {
    button.classList.remove("btn-secondary");
    button.classList.add("btn-primary");
    icon.textContent = "lock";
    button.setAttribute(
      "data-bs-title",
      gettext("Unlock element movement and resizing"),
    );
  } else {
    button.classList.remove("btn-primary");
    button.classList.add("btn-secondary");
    icon.textContent = "lock_open";
    button.setAttribute(
      "data-bs-title",
      gettext(
        "Lock element to prevent movement and resizing when template is used",
      ),
    );
  }
}

function addLockIndicator(element) {
  // Remove existing indicator if present
  removeLockIndicator(element);

  const lockIndicator = document.createElement("div");
  lockIndicator.classList.add("lock-indicator");
  lockIndicator.innerHTML = '<i class="material-symbols-outlined">lock</i>';
  lockIndicator.style.cssText = `
    position: absolute;
    top: 5px;
    right: 5px;
    background: #dc3545;
    color: white;
    border-radius: 50%;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    z-index: 1000;
    pointer-events: none;
    box-shadow: 0 2px 4px rgba(0,0,0,0.3);
    border: 2px solid white;
  `;

  element.appendChild(lockIndicator);
}

function removeLockIndicator(element) {
  const existingIndicator = element.querySelector(".lock-indicator");
  if (existingIndicator) {
    existingIndicator.remove();
  }
}

export function updateLockButtonForSelectedElement() {
  const lockButton = document.getElementById("lock-element-btn");
  if (!lockButton) return;
  if (store.selectedElementData) {
    const isLocked = store.selectedElementData.isLocked || false;
    updateLockButtonState(lockButton, isLocked);
    lockButton.style.display = "flex";
    // Make interactive in any mode; if you want non-interactive in non-template mode,
    // we can change this to pointerEvents = 'none' when queryParams.mode !== 'template_editor'
    lockButton.style.pointerEvents = "auto";
    lockButton.style.opacity = "1";
  } else {
    lockButton.style.display = "none";
  }
}

export function isElementLocked(elementData) {
  return elementData && elementData.isLocked === true;
}

// Function to add lock indicators to all locked elements when rendering
export function addLockIndicatorsToElements() {
  // Lock indicators removed - toolbar indication is sufficient
  return;
}
