// SPDX-FileCopyrightText: 2025 Magenta ApS <https://magenta.dk>
// SPDX-License-Identifier: AGPL-3.0-only
import { store } from "../core/slideStore.js";
import { showToast } from "../../../../utils/utils.js";
import { pushCurrentSlideState } from "../core/undoRedo.js";
import { showColorPalette } from "../utils/colorUtils.js";
import { gettext } from "../../../../utils/locales.js";
// Box Shadow
const boxShadowBtn = document.querySelector("#selected-element-boxshadow");

export function initBoxShadow() {
  boxShadowBtn.addEventListener("click", () => {
    document.querySelectorAll(".popover").forEach((popover) => {
      popover.style.display = "none";
    });
    if (!store.selectedElement) {
      showToast(gettext("Please select an element first!"), "Info");
      return;
    }
    showColorPalette(
      boxShadowBtn,
      (color) => {
        // push state
        pushCurrentSlideState();
        if (color === null) {
          store.selectedElement.style.boxShadow = "";
          store.selectedElementData.boxShadow = "";
          boxShadowBtn.style.border = "";
        } else {
          store.selectedElement.style.boxShadow = "0px 4px 8px 0px " + color;
          store.selectedElementData.boxShadow = color;
          boxShadowBtn.style.border = "5px solid " + color;
        }
      },
      { allowRemove: true },
    );
  });
}

// Helper function for the render engine to the styling
export function _renderBoxShadow(container, el) {
  container.style.boxShadow = `0px 4px 8px 0px ${el.boxShadow}`;
}
