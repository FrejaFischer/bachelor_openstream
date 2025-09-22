// SPDX-FileCopyrightText: 2025 Magenta ApS <https://magenta.dk>
// SPDX-License-Identifier: AGPL-3.0-only
import { showToast } from "../../../../utils/utils.js";
import { pushCurrentSlideState } from "../core/undoRedo.js";
import { store } from "../core/slideStore.js";
import { getAllRelevantElements } from "../utils/domUtils.js";
import { gettext } from "../../../../utils/locales.js";

// Helper function for the render engine to the styling
export function _renderZIndex(container, el) {
  container.style.zIndex = el.zIndex;
}
