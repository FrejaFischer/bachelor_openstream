// SPDX-FileCopyrightText: 2025 Magenta ApS <https://magenta.dk>
// SPDX-License-Identifier: AGPL-3.0-only
import { store } from "./slideStore.js";
import { selectElement } from "./elementSelector.js";
import { pushCurrentSlideState } from "./undoRedo.js";
import { loadSlide } from "./renderSlide.js";

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
    row.setAttribute("draggable", "true");
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

    // Drag handlers to reorder z-index
    row.addEventListener("dragstart", (ev) => {
      ev.dataTransfer.setData("text/plain", String(elData.id));
      ev.dataTransfer.effectAllowed = "move";
      row.classList.add("dragging");
    });
    row.addEventListener("dragend", () => {
      row.classList.remove("dragging");
      // clear any drop indicators
      document.querySelectorAll(".drop-before").forEach((n) => n.classList.remove("drop-before"));
    });

    row.addEventListener("dragover", (ev) => {
      ev.preventDefault();
      ev.dataTransfer.dropEffect = "move";
      const target = ev.currentTarget;
      // Show visual indicator
      target.classList.add("drop-before");
    });

    row.addEventListener("dragleave", (ev) => {
      ev.currentTarget.classList.remove("drop-before");
    });

    row.addEventListener("drop", (ev) => {
      ev.preventDefault();
      const draggedId = parseInt(ev.dataTransfer.getData("text/plain"), 10);
      const targetId = elData.id;
      if (isNaN(draggedId) || draggedId === targetId) return;

      // Compute new zIndex ordering: we will move dragged element to be just above the target
      // Gather elements belonging to the same slide (origin) if not persistent; for pinned elements
      // we still modify their zIndex globally.
      const allElements = store.slides.flatMap((s) => s.elements || []);
      const draggedEl = allElements.find((e) => e.id === draggedId);
      const targetEl = allElements.find((e) => e.id === targetId);
      if (!draggedEl || !targetEl) return;

      // Save undo snapshot
      pushCurrentSlideState();

      // Compute list of elements that share container (we'll operate on all elements in current slide)
      const currentSlide = store.slides[store.currentSlideIndex];
      const operateOn = currentSlide.elements || [];

      // Sort operateOn by zIndex ascending (bottom to top)
      operateOn.sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));

      // Remove dragged from the array
      const idx = operateOn.findIndex((e) => e.id === draggedId);
      if (idx >= 0) operateOn.splice(idx, 1);

      // Find target index in operateOn (where to insert before/after)
      const targetIndex = operateOn.findIndex((e) => e.id === targetId);
      // We'll insert after target so dragged becomes above target
      const insertIndex = targetIndex + 1;
      operateOn.splice(insertIndex, 0, draggedEl);

      // Reassign zIndex values to maintain integer stacking (lower first)
      operateOn.forEach((el, i) => {
        el.zIndex = i + 1;
      });

      // Reload slide to apply zIndex changes and re-render
      loadSlide(currentSlide, undefined, undefined, true);
      renderSlideElementsSidebar();
    });

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
