// SPDX-FileCopyrightText: 2025 Magenta ApS <https://magenta.dk>
// SPDX-License-Identifier: AGPL-3.0-only
import { store } from "../core/slideStore.js";
import { showToast } from "../../../../utils/utils.js";
import { hexToRGBA, showColorPalette } from "../utils/colorUtils.js";
import { pushCurrentSlideState } from "../core/undoRedo.js";
import { gettext } from "../../../../utils/locales.js";

const selectedElementBackgroundColor = document.getElementById(
  "selected-element-background-color",
);

export function initSelectedElementBackgroundColor() {
  selectedElementBackgroundColor.addEventListener("click", () => {
    if (!store.selectedElement) {
      showToast(gettext("Please select an element first!"), "Info");
      return;
    }
    document.querySelectorAll(".popover").forEach((popover) => {
      popover.style.display = "none";
    });
    showColorPalette(
      selectedElementBackgroundColor,
      (color) => {
        // push state
        pushCurrentSlideState();
        if (color === null) {
          store.selectedElement.style.backgroundColor = "";
          store.selectedElementData.backgroundColor = "";
          selectedElementBackgroundColor.style.removeProperty("border");
        } else {
          store.selectedElement.style.backgroundColor = color;
          store.selectedElementData.backgroundColor = color;
          selectedElementBackgroundColor.style.border = "5px solid " + color;
        }
      },
      { allowRemove: true },
    );
  });
}

// Helper function for the render engine to the styling
export function _renderBackgroundColor(container, el) {
  if (typeof el.backgroundOpacity === "number") {
    container.style.backgroundColor = hexToRGBA(
      el.backgroundColor,
      el.backgroundOpacity,
    );
  } else {
    container.style.backgroundColor = el.backgroundColor;
  }
}
