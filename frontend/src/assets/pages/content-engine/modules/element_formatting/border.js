// SPDX-FileCopyrightText: 2025 Magenta ApS <https://magenta.dk>
// SPDX-License-Identifier: AGPL-3.0-only
import { store } from "../core/slideStore.js";
import { showToast } from "../../../../utils/utils.js";
import { pushCurrentSlideState } from "../core/undoRedo.js";
import { baseColors } from "../utils/colorUtils.js";
import { gettext } from "../../../../utils/locales.js";

function showBorderPopover(button, currentColor, currentThickness, callback) {
  let selectedColor = currentColor || baseColors[0];
  let popover = document.createElement("div");
  popover.className = "border-popover popover";

  // color grid
  let colorGrid = document.createElement("div");
  colorGrid.className = "color-grid";
  baseColors.forEach((color) => {
    let colorDiv = document.createElement("div");
    colorDiv.style.backgroundColor = color.hexValue;
    colorDiv.title = color.name;
    if (color === selectedColor) {
      colorDiv.style.outline = "2px solid blue";
    }
    colorDiv.addEventListener("click", (e) => {
      e.stopPropagation();
      selectedColor = color.hexValue;
      Array.from(colorGrid.children).forEach((child) => {
        child.style.outline = "";
      });
      colorDiv.style.outline = "2px solid blue";
    });
    colorGrid.appendChild(colorDiv);
  });
  popover.appendChild(colorGrid);

  // thickness input
  let thicknessLabel = document.createElement("label");
  thicknessLabel.textContent = gettext("Thickness (px): ");
  let thicknessInput = document.createElement("input");
  thicknessInput.type = "number";
  thicknessInput.min = "0";
  thicknessInput.value = currentThickness || 1;
  thicknessInput.className = "thickness-input";
  thicknessInput.style.width = "50px";
  thicknessLabel.appendChild(thicknessInput);
  popover.appendChild(thicknessLabel);

  // Rounded checkbox
  let roundedLabel = document.createElement("label");
  roundedLabel.style.marginLeft = "10px";
  roundedLabel.style.display = "block";
  let roundedCheckbox = document.createElement("input");
  roundedCheckbox.type = "checkbox";
  roundedCheckbox.style.marginRight = "5px";
  roundedLabel.appendChild(roundedCheckbox);
  roundedLabel.appendChild(document.createTextNode(gettext("Round Corners")));
  popover.appendChild(roundedLabel);

  // buttons
  let buttonsDiv = document.createElement("div");

  let removeBtn = document.createElement("button");
  removeBtn.className = "btn btn-danger btn-sm";
  removeBtn.textContent = gettext("Remove Border");
  removeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    callback(null);
    if (document.body.contains(popover)) {
      document.body.removeChild(popover);
    }
  });
  buttonsDiv.appendChild(removeBtn);

  let applyBtn = document.createElement("button");
  applyBtn.className = "btn btn-primary btn-sm";
  applyBtn.textContent = gettext("Apply");
  applyBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    let thickness = parseInt(thicknessInput.value, 10);
    if (isNaN(thickness) || thickness <= 0) {
      callback(null);
    } else {
      callback({
        border: thickness + "px solid " + selectedColor,
        rounded: roundedCheckbox.checked,
      });
    }
    if (document.body.contains(popover)) {
      document.body.removeChild(popover);
    }
  });
  buttonsDiv.appendChild(applyBtn);

  popover.appendChild(buttonsDiv);

  // Position popover
  const rect = button.getBoundingClientRect();
  const popoverWidth = 220;
  let left = rect.left;
  if (rect.left + popoverWidth > window.innerWidth) {
    left = window.innerWidth - popoverWidth - 10;
  }
  popover.style.left = left + "px";
  popover.style.top = rect.bottom + window.scrollY + "px";

  document.body.appendChild(popover);

  const removePopover = (e) => {
    if (!popover.contains(e.target)) {
      if (document.body.contains(popover)) {
        document.body.removeChild(popover);
      }
      document.removeEventListener("click", removePopover);
    }
  };
  setTimeout(() => {
    document.addEventListener("click", removePopover);
  }, 0);
}

export function initSelectedElementBorder() {
  const selectedElementBorder = document.getElementById(
    "selected-element-border",
  );
  if (selectedElementBorder) {
    selectedElementBorder.addEventListener("click", () => {
      document.querySelectorAll(".popover").forEach((popover) => {
        popover.style.display = "none";
      });
      if (!store.selectedElement) {
        showToast(gettext("Please select an element first!"), "Info");
        return;
      }
      let currentBorder = store.selectedElement.style.border;
      let currentBorderColor = "";
      let currentBorderThickness = 1;
      if (currentBorder) {
        let parts = currentBorder.split(" ");
        if (parts.length >= 3) {
          currentBorderThickness = parseInt(parts[0]) || 1;
          currentBorderColor = parts[2];
        }
      }
      showBorderPopover(
        selectedElementBorder,
        currentBorderColor,
        currentBorderThickness,
        (newBorder) => {
          // push state
          pushCurrentSlideState();
          if (newBorder === null) {
            store.selectedElement.style.border = "";
            store.selectedElementData.border = false;
            store.selectedElementData.rounded = false;
            store.selectedElement.classList.remove("rounded");
          } else {
            store.selectedElement.style.border = newBorder.border;
            store.selectedElementData.border = newBorder.border;
            store.selectedElementData.rounded = newBorder.rounded;
            if (newBorder.rounded) {
              store.selectedElement.classList.add("rounded");
            } else {
              store.selectedElement.classList.remove("rounded");
            }
          }
          if (selectedElementBorder) {
            if (newBorder) {
              let parts = newBorder.border.split(" ");
              selectedElementBorder.style.border =
                "5px solid " + parts[2] || "";
            } else {
              selectedElementBorder.style.border = "";
            }
          }
        },
      );
    });
  }
}

// Helper function for the render engine to the styling
export function _renderBorderRadius(container) {
  container.classList.add("rounded");
}

// Helper function for the render engine to the styling
export function _renderBorder(container, el) {
  container.style.border = el.border;
}
