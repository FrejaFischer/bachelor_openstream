// SPDX-FileCopyrightText: 2025 Magenta ApS <https://magenta.dk>
// SPDX-License-Identifier: AGPL-3.0-only
import { showToast } from "../../../../utils/utils.js";
import { pushCurrentSlideState } from "../core/undoRedo.js";
import { store } from "../core/slideStore.js";
import { getAllRelevantElements } from "../utils/domUtils.js";
import { gettext } from "../../../../utils/locales.js";
export function initBringToFrontBack() {
  // Bring to Front
  const bringToFrontBtn = document.querySelector("#bring-to-front-btn");

  bringToFrontBtn.addEventListener("click", () => {
    if (!store.selectedElement || !store.selectedElementData) {
      showToast(gettext("Please select an element first!"), "Info");
      return;
    }
    // push state
    pushCurrentSlideState();

    // Get all relevant elements (current slide + persistent elements from all slides)
    const allElements = getAllRelevantElements();
    allElements.forEach((el) => {
      if (typeof el.zIndex === "undefined") el.zIndex = 1;
    });

    let maxZ = Math.max(...allElements.map((el) => el.zIndex));
    store.selectedElementData.zIndex = maxZ + 1;
    store.selectedElement.style.zIndex = store.selectedElementData.zIndex;
  });

  // Send to Back
  const sendToBackBtn = document.querySelector("#send-to-back-btn");
  sendToBackBtn.addEventListener("click", () => {
    if (!store.selectedElement || !store.selectedElementData) {
      showToast(gettext("Please select an element first!"), "Info");
      return;
    }
    // push state
    pushCurrentSlideState();

    // Get all relevant elements (current slide + persistent elements from all slides)
    const allElements = getAllRelevantElements();
    let currentMin = Math.min(
      ...allElements.map((el) =>
        typeof el.zIndex !== "undefined" ? el.zIndex : 1,
      ),
    );
    store.selectedElementData.zIndex = currentMin - 1;
    store.selectedElement.style.zIndex = store.selectedElementData.zIndex;

    // Only reorder elements from the current slide
    const currentSlideElements = store.slides[store.currentSlideIndex].elements;
    currentSlideElements.sort((a, b) => a.zIndex - b.zIndex);
    currentSlideElements.forEach((el, index) => {
      el.zIndex = index + 1;
      const domEl = document.getElementById("el-" + el.id);
      if (domEl) {
        domEl.style.zIndex = el.zIndex;
      }
    });
  });
}

// Helper function for the render engine to the styling
export function _renderZIndex(container, el) {
  container.style.zIndex = el.zIndex;
}
