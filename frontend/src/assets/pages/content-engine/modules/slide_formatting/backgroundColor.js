// SPDX-FileCopyrightText: 2025 Magenta ApS <https://magenta.dk>
// SPDX-License-Identifier: AGPL-3.0-only
import { pushCurrentSlideState } from "../core/undoRedo.js";
import { store } from "../core/slideStore.js";
import { updateSlideSelector } from "../core/slideSelector.js";
import { loadSlide } from "../core/renderSlide.js";
import { showColorPalette } from "../utils/colorUtils.js";
import { showToast } from "../../../../utils/utils.js";

const changeSlideBgColorOption = document.querySelector(
  '[data-type="change-background-color"]',
);

export function initSlideBackgroundColor() {
  changeSlideBgColorOption.addEventListener("click", () => {
    if (store.currentSlideIndex < 0) {
      showToast(gettext("Please select a slide first!"), "Info");
      return;
    }
    showColorPalette(
      changeSlideBgColorOption,
      (color) => {
        // push state
        pushCurrentSlideState();
        if (color === null) {
          store.slides[store.currentSlideIndex].backgroundColor = "#ffffff";
          const icon =
            changeSlideBgColorOption.querySelector(".img-container i");
          if (icon) icon.style.border = "#ffffff";
        } else {
          store.slides[store.currentSlideIndex].backgroundColor = color;
          const icon =
            changeSlideBgColorOption.querySelector(".img-container i");
          if (icon) icon.style.border = "5px solid " + color;
        }
        loadSlide(store.slides[store.currentSlideIndex]);
        updateSlideSelector();
      },
      { allowRemove: true },
    );
  });
}
