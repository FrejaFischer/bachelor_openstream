// SPDX-FileCopyrightText: 2025 Magenta ApS <https://magenta.dk>
// SPDX-License-Identifier: AGPL-3.0-only
import { store } from "./slideStore.js";
import { selectElement } from "./elementSelector.js";
import { pushCurrentSlideState } from "./undoRedo.js";
import { loadSlide } from "./renderSlide.js";
import Sortable from "sortablejs";

function computeZOrderRanks(slideElements) {
  // slideElements is expected to be an array of element data objects with zIndex numeric
  const withIndex = slideElements.map((el, idx) => ({ el, idx }));
  // Sort by zIndex descending so highest zIndex (topmost) comes first.
  // If undefined, treat as 0.
  withIndex.sort((a, b) => (b.el.zIndex || 0) - (a.el.zIndex || 0));
  // Build a map from element id -> rank (1..N) where 1 is topmost
  const rankMap = {};
  withIndex.forEach((item, sortedPos) => {
    rankMap[item.el.id] = sortedPos + 1;
  });
  return rankMap;
}

function elementSummary(dataObj) {
  // type, position (gridX, gridY) or (x,y), size (gridWidth, gridHeight or width/height)
  const type = dataObj.type || "?";
  const pos =
    typeof dataObj.gridX !== "undefined"
      ? `${dataObj.gridX}, ${dataObj.gridY}`
      : `${dataObj.x || "-"}, ${dataObj.y || "-"}`;
  const size =
    dataObj.gridWidth && dataObj.gridHeight
      ? `${dataObj.gridWidth}x${dataObj.gridHeight}`
      : `${dataObj.width || "-"}x${dataObj.height || "-"}`;
  return { type, pos, size };
}

export function renderSlideElementsSidebar() {
  const container = document.getElementById("slide-elements-list");
  if (!container) return;

  // Determine current slide from store
  const slide = store.slides[store.currentSlideIndex];
  // Build a merged list of elements to show in the sidebar:
  // - all elements on the current slide
  // - all persistent (pinned) elements from all slides
  // Deduplicate by id so each element appears only once.
  const elementsMap = {};
  if (slide && slide.elements) {
    slide.elements.forEach((el) => {
      elementsMap[el.id] = el;
    });
  }

  // Add pinned elements from all slides
  store.slides.forEach((s) => {
    (s.elements || []).forEach((el) => {
      if (el.isPersistent) elementsMap[el.id] = el;
    });
  });

  const elementsArray = Object.values(elementsMap);
  if (!elementsArray.length) {
    container.innerHTML = `<div class="text-muted small">No elements</div>`;
    return;
  }

  // Compute z-order ranks across the merged set
  const rankMap = computeZOrderRanks(elementsArray);

  // Build rows: iterate elements in order of descending z-index (topmost first)
  container.innerHTML = "";
  const elementsSorted = [...elementsArray].sort((a, b) => (b.zIndex || 0) - (a.zIndex || 0));
  elementsSorted.forEach((elData) => {
    const rank = rankMap[elData.id] || "-";
    const summary = elementSummary(elData);
    const row = document.createElement("div");
    row.className = "list-group-item px-1 py-1 d-flex justify-content-between align-items-start";
  row.dataset.elId = elData.id;
  // Mark pinned elements with a small pin indicator
    const pinnedHtml = elData.isPersistent
      ? `<span class="pin-indicator ms-1" title="Pinned">📌</span>`
      : "";

    row.innerHTML = `
      <div>
        <div class="fw-bold">${summary.type} ${pinnedHtml}</div>
        <div class="text-muted small">pos: ${summary.pos} \u2022 size: ${summary.size}</div>
      </div>
      <div class="text-end small text-secondary"><span class="rank-badge">${rank}</span></div>
    `;

    // Highlight if this is the selected element
    if (store.selectedElementData && store.selectedElementData.id === elData.id) {
      row.classList.add("active");
    }

  // (Sortable will handle drag/drop for smooth UX)

    // Click row to select element
    row.addEventListener("click", () => {
      const domEl = document.getElementById("el-" + elData.id);
      if (!domEl) return;

      // Prefer the module's selectElement which handles toolbars, wrappers and state
      try {
        selectElement(domEl, elData);
      } catch (e) {
        // Fallback to direct store mutation if selectElement is unavailable for any reason
        window.store = window.store || store;
        window.store.selectedElement = domEl;
        window.store.selectedElementData = elData;
      }

      // Update visuals
      renderSlideElementsSidebar();
    });

    container.appendChild(row);
  });

  // Initialize Sortable for smoother dragging. Keep a reference to destroy previous instance.
  if (window.__slideElementsSortable) {
    try {
      window.__slideElementsSortable.destroy();
    } catch (e) {
      // ignore
    }
    window.__slideElementsSortable = null;
  }

  try {
    window.__slideElementsSortable = new Sortable(container, {
      animation: 150,
      ghostClass: "sortable-ghost",
      chosenClass: "sortable-chosen",
      dragClass: "sortable-drag",
      // No explicit handle — allow dragging the whole item for expected UX
      onEnd: function (evt) {
        // Build new ordering from DOM children (topmost first as rendered)
        const ids = Array.from(container.children).map((child) => parseInt(child.dataset.elId, 10)).filter(Boolean);

        if (!ids.length) return;

        const currentSlide = store.slides[store.currentSlideIndex];
        if (!currentSlide) return;

        pushCurrentSlideState();

        // Sidebar is rendered with topmost first; assign zIndex so topmost gets highest value
        ids.forEach((id, idx) => {
          const el = currentSlide.elements.find((e) => e.id === id);
          if (el) {
            el.zIndex = ids.length - idx;
          }
        });

        // Reload slide to apply zIndex changes and re-render canvas.
        loadSlide(currentSlide, undefined, undefined, true);

        // Delay re-render of sidebar slightly to avoid interfering with Sortable's DOM update
        setTimeout(() => {
          renderSlideElementsSidebar();
        }, 150);
      },
    });
  } catch (e) {
    // Sortable may fail in some environments; ignore gracefully
    console.warn("Sortable init failed", e);
  }
}

export function initSlideElementsSidebar() {
  // Render initially and whenever slide data or selection changes
  renderSlideElementsSidebar();

  // Observe store changes by polling simple interval (non-invasive)
  // The editor doesn't appear to use an observable store, so poll for changes
  let lastSlidesStr = store.lastSlidesStr || JSON.stringify(store.slides || []);
  setInterval(() => {
    const cur = JSON.stringify(store.slides || []);
    if (cur !== lastSlidesStr) {
      lastSlidesStr = cur;
      renderSlideElementsSidebar();
    } else if (store.selectedElementData) {
      // Rerender if selection changed
      renderSlideElementsSidebar();
    }
  }, 600);
}

export default initSlideElementsSidebar;
