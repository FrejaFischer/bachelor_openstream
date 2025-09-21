// SPDX-FileCopyrightText: 2025 Magenta ApS <https://magenta.dk>
// SPDX-License-Identifier: AGPL-3.0-only
import { store } from "./slideStore.js";

function computeZOrderRanks(slideElements) {
  // slideElements is expected to be an array of element data objects with zIndex numeric
  const withIndex = slideElements.map((el, idx) => ({ el, idx }));
  // Sort by zIndex ascending (lowest at bottom). If undefined, treat as 0.
  withIndex.sort((a, b) => (a.el.zIndex || 0) - (b.el.zIndex || 0));
  // Build a map from element id -> rank (1..N) where 1 is bottom, N is top
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
  if (!slide || !slide.elements || !slide.elements.length) {
    container.innerHTML = `<div class="text-muted small">No elements</div>`;
    return;
  }

  // Compute z-order ranks
  const rankMap = computeZOrderRanks(slide.elements);

  // Build rows
  container.innerHTML = "";
  slide.elements.forEach((elData) => {
    const rank = rankMap[elData.id] || "-";
    const summary = elementSummary(elData);
    const row = document.createElement("div");
    row.className = "list-group-item px-1 py-1 d-flex justify-content-between align-items-start";
    row.innerHTML = `
      <div>
        <div class="fw-bold">${summary.type}</div>
        <div class="text-muted small">pos: ${summary.pos} • size: ${summary.size}</div>
      </div>
      <div class="text-end small text-secondary"><span class="rank-badge">${rank}</span></div>
    `;

    // Highlight if this is the selected element
    if (store.selectedElementData && store.selectedElementData.id === elData.id) {
      row.classList.add("active");
    }

    // Click row to select element
    row.addEventListener("click", () => {
      const domEl = document.getElementById("el-" + elData.id);
      if (domEl) {
        // Reuse global selector if available
        if (window.selectElement) {
          window.selectElement(domEl, elData);
        } else if (window.store) {
          // fallback set selection directly
          window.store.selectedElement = domEl;
          window.store.selectedElementData = elData;
        }
        renderSlideElementsSidebar();
      }
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
