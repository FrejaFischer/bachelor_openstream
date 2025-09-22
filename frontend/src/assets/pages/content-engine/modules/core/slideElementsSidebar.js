// SPDX-FileCopyrightText: 2025 Magenta ApS <https://magenta.dk>
// SPDX-License-Identifier: AGPL-3.0-only
import { store } from "./slideStore.js";
import { selectElement } from "./elementSelector.js";
import { pushCurrentSlideState } from "./undoRedo.js";
import { loadSlide } from "./renderSlide.js";
import Sortable from "sortablejs";

// Simple HTML escape for insertion into innerHTML
function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

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
    row.className = "list-group-item px-1 py-1 d-flex justify-content-between align-items-start my-1 border border-dark rounded";
  row.dataset.elId = elData.id;
  // We'll render a checkbox with a pin icon in the right column to toggle persistence

    // Render a clear, semantic summary where each property is on its own line.
    // Name is editable in-place (defaults to type). Clicking the input should
    // not select the element; changes are applied to the element data and
    // the sidebar is re-rendered.
    const displayName = elData.name || summary.type;
    row.innerHTML = `
      <div class="w-100">
        <div class="d-flex justify-content-between align-items-center mb-1 text-muted small">
          <label class="d-inline-flex align-items-center pin-checkbox-wrapper" title="Toggle pinned">
            <input type="checkbox" id="pin-checkbox-${elData.id}" class="form-check-input me-1" ${elData.isPersistent ? "checked" : ""} />
            <span id="pin-icon-${elData.id}" class="material-symbols-outlined pin-icon">push_pin</span>
          </label>
          <label class="d-inline-flex align-items-center lock-checkbox-wrapper" title="Toggle locked">
            <input type="checkbox" id="lock-checkbox-${elData.id}" class="form-check-input me-1" ${elData.isLocked ? "checked" : ""} />
            <span id="lock-icon-${elData.id}" class="material-symbols-outlined lock-icon">${elData.isLocked ? 'lock' : 'lock_open'}</span>
          </label>
          <span class="rank-badge">${rank}</span>
        </div>
        <div class="fw-bold mb-1">
          <label class="visually-hidden">Name</label>
          <input id="el-name-${elData.id}" class="form-control form-control-sm p-0 m-0 border-0 bg-transparent fw-bold" type="text" value="${escapeHtml(displayName)}" aria-label="Element name" />
        </div>
        <div class="text-muted small mb-1"><strong>Type:</strong> ${summary.type}</div>
        <div class="text-muted small mb-1"><strong>Size:</strong> ${summary.size}</div>
        <div class="text-muted small mb-1"><strong>Position:</strong> ${summary.pos}</div>
      </div>
    `;

    // Wire up pin checkbox behavior
    const pinCheckbox = row.querySelector(`#pin-checkbox-${elData.id}`);
    const pinIconEl = row.querySelector(`#pin-icon-${elData.id}`);
    if (pinIconEl) {
      // set filled vs outlined according to current state
      try {
        pinIconEl.style.fontVariationSettings = elData.isPersistent ? "'FILL' 1" : "'FILL' 0";
      } catch (e) {
        // ignore if browser doesn't support
      }
    }

    if (pinCheckbox) {
      // prevent checkbox clicks from selecting the row
      pinCheckbox.addEventListener('click', (e) => e.stopPropagation());
      pinCheckbox.addEventListener('change', (e) => {
        e.stopPropagation();
        // push undo state
        try {
          pushCurrentSlideState();
        } catch (err) {
          // ignore if undo not available
        }

        const shouldBePersistent = pinCheckbox.checked;
        // Toggle persistence flag on the element data
        elData.isPersistent = shouldBePersistent;

        // Reload current slide to reflect persistent change in preview
        try {
          loadSlide(store.slides[store.currentSlideIndex], undefined, undefined, true);
        } catch (err) {
          console.warn('Failed to reload slide after toggling persistence', err);
        }

        // Re-render sidebar to update all rows
        renderSlideElementsSidebar();
      });
    }

      // Wire up lock checkbox behavior (same pattern as pin)
      const lockCheckbox = row.querySelector(`#lock-checkbox-${elData.id}`);
      const lockIconEl = row.querySelector(`#lock-icon-${elData.id}`);
      if (lockIconEl) {
        // set icon according to current state
        try {
          lockIconEl.textContent = elData.isLocked ? 'lock' : 'lock_open';
        } catch (e) {
          // ignore
        }
      }

      if (lockCheckbox) {
        // prevent checkbox clicks from selecting the row and from bubbling to global handlers
        lockCheckbox.addEventListener('click', (e) => e.stopPropagation());
        lockCheckbox.addEventListener('change', (e) => {
          e.stopPropagation();
          try {
            pushCurrentSlideState();
          } catch (err) {
            // ignore if undo not available
          }

          const shouldBeLocked = lockCheckbox.checked;
          // Toggle locked flag on the element data
          elData.isLocked = shouldBeLocked;

          // Update element DOM if present
          try {
            const domEl = document.getElementById("el-" + elData.id);
            if (domEl) {
              if (shouldBeLocked) domEl.classList.add('is-locked');
              else domEl.classList.remove('is-locked');
            }
          } catch (err) {
            // ignore
          }

          if (lockIconEl) lockIconEl.textContent = shouldBeLocked ? 'lock' : 'lock_open';

          // Reload current slide to reflect locked change (hides handles etc.)
          try {
            loadSlide(store.slides[store.currentSlideIndex], undefined, undefined, true);
          } catch (err) {
            console.warn('Failed to reload slide after toggling lock', err);
          }

          // Re-render sidebar to update all rows
          renderSlideElementsSidebar();
        });
      }

    // Wire up name editing after inserting HTML
    const nameInput = row.querySelector(`#el-name-${elData.id}`);
    if (nameInput) {
      // Prevent clicks in the input from selecting the row
      nameInput.addEventListener('click', (e) => e.stopPropagation());
      nameInput.addEventListener('mousedown', (e) => e.stopPropagation());

      // Commit change on blur or Enter key
      const commitName = () => {
        const newName = nameInput.value.trim();
        // Update the element data in-place. This object references the
        // element in the store.slides structure, so changes are live.
        elData.name = newName || elData.type;
        // Re-render sidebar to reflect change
        renderSlideElementsSidebar();
      };

      nameInput.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter') {
          ev.preventDefault();
          nameInput.blur();
        } else if (ev.key === 'Escape') {
          // revert to original
          nameInput.value = elData.name || summary.type;
          nameInput.blur();
        }
      });

      nameInput.addEventListener('blur', () => {
        try {
          commitName();
        } catch (err) {
          console.warn('Failed to commit element name', err);
        }
      });
    }

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
  // Track last selected element id to avoid re-rendering repeatedly while an
  // element remains selected. Re-render only when slides change or the
  // selected element id changes.
  let lastSelectedElementId = store.selectedElementData
    ? store.selectedElementData.id
    : null;

  setInterval(() => {
    const cur = JSON.stringify(store.slides || []);
    const curSelectedId = store.selectedElementData
      ? store.selectedElementData.id
      : null;

    if (cur !== lastSlidesStr) {
      lastSlidesStr = cur;
      renderSlideElementsSidebar();
    } else if (curSelectedId !== lastSelectedElementId) {
      // Selected element changed (selected, deselected, or switched to another id)
      lastSelectedElementId = curSelectedId;
      renderSlideElementsSidebar();
    }
    // Otherwise, do nothing to avoid interfering with drag interactions.
  }, 600);
}

export default initSlideElementsSidebar;
