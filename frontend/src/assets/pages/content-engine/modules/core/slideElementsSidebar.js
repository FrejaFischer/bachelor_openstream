// SPDX-FileCopyrightText: 2025 Magenta ApS <https://magenta.dk>
// SPDX-License-Identifier: AGPL-3.0-only
import { store } from "./slideStore.js";
import { selectElement } from "./elementSelector.js";
import { pushCurrentSlideState } from "./undoRedo.js";
import { loadSlide } from "./renderSlide.js";
import { queryParams } from "../../../../utils/utils.js";
import { gettext } from "../../../../utils/locales.js";
import { showToast } from "../../../../utils/utils.js";
import { getNewZIndex } from "../utils/domUtils.js";
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

function updateElementIndicatorsVisibility() {
  const visibility = store.showElementIndicators ? 'visible' : 'hidden';
  document.querySelectorAll('.element-indicators-wrapper').forEach((wrapper) => {
    wrapper.style.visibility = visibility;
  });
}

function getCurrentShowElementIndicators() {
  const slide = store.slides[store.currentSlideIndex];
  return slide ? (slide.showElementIndicators !== undefined ? slide.showElementIndicators : store.showElementIndicators) : store.showElementIndicators;
}

function setCurrentShowElementIndicators(value) {
  const slide = store.slides[store.currentSlideIndex];
  if (slide) {
    slide.showElementIndicators = value;
  }
  store.showElementIndicators = value;
}

function handleCheckboxChange(e) {
  setCurrentShowElementIndicators(!e.target.checked);
  updateElementIndicatorsVisibility();
}

function computeZOrderRanks(slideElements) {
  // slideElements is expected to be an array of element data objects with zIndex numeric
  const withIndex = slideElements.map((el, idx) => ({ el, idx }));
  // Sort by isAlwaysOnTop descending, then zIndex descending so highest zIndex (topmost) comes first.
  // If undefined, treat as 0.
  withIndex.sort((a, b) => {
    if (a.el.isAlwaysOnTop && !b.el.isAlwaysOnTop) return -1;
    if (!a.el.isAlwaysOnTop && b.el.isAlwaysOnTop) return 1;
    return (b.el.zIndex || 0) - (a.el.zIndex || 0);
  });
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

function getLinkOptions(dataObj) {
  let options = `<option value="Open page by clicking ..">${gettext("Open page by clicking ..")}</option>`;
  store.slides.forEach((slide, index) => {
    const selected = (typeof dataObj.goToSlideIndex === "number" && dataObj.goToSlideIndex === index) ? "selected" : "";
    options += `<option value="${index}" ${selected}>${index + 1}: ${slide.name}</option>`;
  });
  return options;
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

  // Build rows: iterate elements with always on top first, then by descending z-index
  container.innerHTML = "";
  const elementsSorted = [...elementsArray].sort((a, b) => {
    if (a.isAlwaysOnTop && !b.isAlwaysOnTop) return -1;
    if (!a.isAlwaysOnTop && b.isAlwaysOnTop) return 1;
    return (b.zIndex || 0) - (a.zIndex || 0);
  });
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
        <div class="d-flex justify-content-between align-items-center mb-1 text-muted small border-bottom pb-1 border-gray">
          <label class="d-inline-flex align-items-center pin-checkbox-wrapper" title="Toggle pinned">
            <input type="checkbox" id="pin-checkbox-${elData.id}" class="form-check-input me-1" ${elData.isPersistent ? "checked" : ""} />
            <span id="pin-icon-${elData.id}" class="material-symbols-outlined pin-icon">push_pin</span>
          </label>
          <label class="d-inline-flex align-items-center lock-checkbox-wrapper" title="Toggle locked">
            <input type="checkbox" id="lock-checkbox-${elData.id}" class="form-check-input me-1" ${elData.isLocked ? "checked" : ""} />
            <span id="lock-icon-${elData.id}" class="material-symbols-outlined lock-icon">${elData.isLocked ? 'lock' : 'lock_open'}</span>
          </label>
          <label class="d-inline-flex align-items-center block-select-checkbox-wrapper" title="Block selection">
            <input type="checkbox" id="block-select-checkbox-${elData.id}" class="form-check-input me-1" ${elData.isSelectionBlocked ? "checked" : ""} />
            <span id="block-select-icon-${elData.id}" class="material-symbols-outlined block-select-icon">block</span>
          </label>
          ${queryParams.mode === "template_editor" ? `<label class="d-inline-flex align-items-center force-settings-checkbox-wrapper" title="Prevent template users changing settings">
            <input type="checkbox" id="force-settings-checkbox-${elData.id}" class="form-check-input me-1" ${elData.preventSettingsChanges ? "checked" : ""} />
            <span id="force-settings-icon-${elData.id}" class="material-symbols-outlined force-settings-icon">lock_person</span>
          </label>` : ''}
          <label class="d-inline-flex align-items-center always-on-top-checkbox-wrapper" title="Always on top">
            <input type="checkbox" id="always-on-top-checkbox-${elData.id}" class="form-check-input me-1" ${elData.isAlwaysOnTop ? "checked" : ""} />
            <span id="always-on-top-icon-${elData.id}" class="material-symbols-outlined always-on-top-icon">vertical_align_top</span>
          </label>
          <span class="rank-badge">${rank}</span>
        </div>
        <div class="fw-bold mb-1">
          <label class="visually-hidden">Name</label>
          <input id="el-name-${elData.id}" class="form-control form-control-sm p-0 m-0 border-0 bg-transparent fw-bold" type="text" value="${escapeHtml(displayName)}" aria-label="Element name" />
        </div>
        <div class="text-muted small mb-1"><strong>${gettext("Type")}:</strong> ${summary.type}</div>
        <div class="text-muted small mb-1"><strong>${gettext("Size")}:</strong> ${summary.size}</div>
        <div class="text-muted small mb-1"><strong>${gettext("Position")}:</strong> ${summary.pos}</div>
        ${store.slideshowMode === "interactive" && queryParams.mode === "edit" ? `<div class="text-muted small mb-1"><strong>${gettext("Link")}:</strong> <select id="link-select-${elData.id}" class="form-select form-select-sm">${getLinkOptions(elData)}</select></div>` : ''}
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
        // Prevent changes outside template editor when flagged
        if (queryParams.mode !== "template_editor" && elData.preventSettingsChanges) {
          try {
            showToast(gettext("This element's settings are enforced by the template."), "Info");
          } catch (err) {}
          // Revert checkbox
          pinCheckbox.checked = !!elData.isPersistent;
          return;
        }

        const shouldBePersistent = pinCheckbox.checked;
        // Toggle persistence flag on the element data
        elData.isPersistent = shouldBePersistent;

        // If the DOM element exists, update indicators live (so icons don't disappear briefly)
        try {
          const domEl = document.getElementById("el-" + elData.id);
          if (domEl) {
            // adjust blocked-indicator offset if present
            const blocked = domEl.querySelector('.blocked-indicator');
            if (blocked) blocked.style.right = shouldBePersistent ? '56px' : '8px';
            const force = domEl.querySelector('.force-settings-indicator');
            if (force) force.style.right = shouldBePersistent ? '56px' : '8px';
            const top = domEl.querySelector('.always-on-top-indicator');
            if (top) top.style.right = shouldBePersistent ? '56px' : '8px';
          }
        } catch (err) {}

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

          // Prevent changes outside template editor when flagged
          if (queryParams.mode !== "template_editor" && elData.preventSettingsChanges) {
            try {
              showToast(gettext("This element's settings are enforced by the template."), "Info");
            } catch (err) {}
            lockCheckbox.checked = !!elData.isLocked;
            return;
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
              // update blocked indicator offset if present
              const blocked = domEl.querySelector('.blocked-indicator');
              if (blocked) {
                const right = elData.isPersistent ? '56px' : '8px';
                blocked.style.right = right;
              }
              const force = domEl.querySelector('.force-settings-indicator');
              if (force) {
                // If locked and persistent, move further left
                const right = elData.isLocked && elData.isPersistent ? '104px' : elData.isPersistent ? '56px' : '8px';
                force.style.right = right;
              }
              const top = domEl.querySelector('.always-on-top-indicator');
              if (top) {
                // recompute offset cumulatively
                let offset = 8;
                if (elData.preventSettingsChanges) offset += 48;
                if (elData.isPersistent) offset += 48;
                if (elData.isLocked) offset += 48;
                top.style.right = offset + 'px';
              }
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

      // Wire up always on top checkbox behavior
      const alwaysOnTopCheckbox = row.querySelector(`#always-on-top-checkbox-${elData.id}`);
      const alwaysOnTopIconEl = row.querySelector(`#always-on-top-icon-${elData.id}`);
      if (alwaysOnTopIconEl) {
        try {
          alwaysOnTopIconEl.style.fontVariationSettings = elData.isAlwaysOnTop ? "'FILL' 1" : "'FILL' 0";
        } catch (e) {
          // ignore
        }
      }

      if (alwaysOnTopCheckbox) {
        alwaysOnTopCheckbox.addEventListener('click', (e) => e.stopPropagation());
        alwaysOnTopCheckbox.addEventListener('change', (e) => {
          e.stopPropagation();
          try {
            pushCurrentSlideState();
          } catch (err) {
            // ignore if undo not available
          }

          // Prevent changes outside template editor when flagged
          if (queryParams.mode !== "template_editor" && elData.preventSettingsChanges) {
            try {
              showToast(gettext("This element's settings are enforced by the template."), "Info");
            } catch (err) {}
            alwaysOnTopCheckbox.checked = !!elData.isAlwaysOnTop;
            return;
          }

          const shouldBeAlwaysOnTop = alwaysOnTopCheckbox.checked;
          elData.isAlwaysOnTop = shouldBeAlwaysOnTop;

          // Adjust zIndex
          // Reserve a high range for always-on-top elements so they cannot be
          // accidentally covered by regular elements. Use a large base offset
          // and keep always-on-top elements inside that bucket.
          const ALWAYS_ON_TOP_BASE = 100000;
          const alwaysOnTopElements = elementsArray.filter(el => el.isAlwaysOnTop && el.id !== elData.id);
          if (shouldBeAlwaysOnTop) {
            // Determine next offset inside the always-on-top bucket
            const offsets = alwaysOnTopElements.map(el => (Number(el.zIndex) || 0) - ALWAYS_ON_TOP_BASE).filter(n => n >= 0);
            const nextOffset = offsets.length ? Math.max(...offsets) + 1 : 1;
            elData.zIndex = ALWAYS_ON_TOP_BASE + nextOffset;
          } else {
            // When removing always-on-top, put element back into the regular z-index space
            try {
              elData.zIndex = getNewZIndex();
            } catch (err) {
              // Fallback to 1 if z-index utility is unavailable for any reason
              elData.zIndex = 1;
            }
          }

          // Update DOM zIndex
          try {
            const domEl = document.getElementById("el-" + elData.id);
            if (domEl) domEl.style.zIndex = String(Number(elData.zIndex) || 0);
          } catch (err) {
            // ignore
          }

          if (alwaysOnTopIconEl) alwaysOnTopIconEl.style.fontVariationSettings = shouldBeAlwaysOnTop ? "'FILL' 1" : "'FILL' 0";

          try {
            loadSlide(store.slides[store.currentSlideIndex], undefined, undefined, true);
          } catch (err) {
            console.warn('Failed to reload slide after toggling always on top', err);
          }

          // Re-render sidebar to update all rows
          renderSlideElementsSidebar();
        });
      }

      // Wire up link select
      if (store.slideshowMode === "interactive" && queryParams.mode === "edit") {
        const linkSelect = row.querySelector(`#link-select-${elData.id}`);
        if (linkSelect) {
          linkSelect.addEventListener('click', (e) => e.stopPropagation());
          linkSelect.addEventListener('change', (e) => {
            e.stopPropagation();
            try {
              pushCurrentSlideState();
            } catch (err) {
            }
            const chosenValue = e.target.value;
            if (chosenValue === "Open page by clicking ..") {
              delete elData.goToSlideIndex;
            } else {
              const chosenIndex = parseInt(chosenValue, 10);
              if (!isNaN(chosenIndex)) {
                elData.goToSlideIndex = chosenIndex;
              }
            }
          });
        }
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

    // Wire up block-selection checkbox behavior
    const blockSelectCheckbox = row.querySelector(`#block-select-checkbox-${elData.id}`);
    const blockSelectIconEl = row.querySelector(`#block-select-icon-${elData.id}`);
    if (blockSelectIconEl) {
      try {
        // show filled block icon when blocked
        blockSelectIconEl.style.fontVariationSettings = elData.isSelectionBlocked ? "'FILL' 1" : "'FILL' 0";
      } catch (e) {
        // ignore
      }
    }

    if (blockSelectCheckbox) {
      blockSelectCheckbox.addEventListener('click', (e) => e.stopPropagation());
      blockSelectCheckbox.addEventListener('change', (e) => {
        e.stopPropagation();
        try {
          pushCurrentSlideState();
        } catch (err) {
          // ignore if undo not available
        }

        // Prevent changes outside template editor when flagged
        if (queryParams.mode !== "template_editor" && elData.preventSettingsChanges) {
          try {
            showToast(gettext("This element's settings are enforced by the template."), "Info");
          } catch (err) {}
          blockSelectCheckbox.checked = !!elData.isSelectionBlocked;
          return;
        }

        const shouldBlock = blockSelectCheckbox.checked;
        elData.isSelectionBlocked = shouldBlock;

        // Update DOM element to prevent pointer events if blocked
        try {
          const domEl = document.getElementById("el-" + elData.id);
          if (domEl) {
            if (shouldBlock) {
                domEl.classList.add('is-selection-blocked');
                domEl.style.pointerEvents = 'none';
                // add blocked indicator if missing; place inside wrapper if present
                if (!domEl.querySelector('.blocked-indicator')) {
                  const bi = document.createElement('div');
                  bi.className = 'blocked-indicator element-indicator';
                  bi.innerHTML = '<i class="material-symbols-outlined">block</i>';
                  const inner = bi.querySelector('.material-symbols-outlined');
                  if (inner) inner.style.fontVariationSettings = "'FILL' 1";
                  // Try to append to wrapper for consistent layout
                  let wrapper = domEl.querySelector('.element-indicators-wrapper');
                  if (!wrapper) {
                    wrapper = document.createElement('div');
                    wrapper.className = 'element-indicators-wrapper';
                    domEl.appendChild(wrapper);
                    // move any existing indicator nodes into wrapper
                    ['.persistent-indicator', '.lock-indicator', '.force-settings-indicator', '.always-on-top-indicator', '.element-indicator'].forEach((sel) => {
                      const n = domEl.querySelector(sel);
                      if (n) wrapper.appendChild(n);
                    });
                  }
                  wrapper.appendChild(bi);
                  wrapper.style.visibility = getCurrentShowElementIndicators() ? 'visible' : 'hidden';
                }
            } else {
              domEl.classList.remove('is-selection-blocked');
              domEl.style.pointerEvents = '';
              const existing = domEl.querySelector('.blocked-indicator');
              if (existing) existing.remove();
            }
          }
        } catch (err) {
          // ignore
        }

        // If this element is currently selected, deselect it
        if (store.selectedElementData && store.selectedElementData.id === elData.id) {
          // Clear selection state and remove selection visuals
          window.selectedElementForUpdate = null;
          store.selectedElement = null;
          store.selectedElementData = null;
          document.querySelectorAll('.gradient-border-wrapper').forEach(n => n.remove());
        }

        // Reload current slide preview to ensure UI matches
        try {
          loadSlide(store.slides[store.currentSlideIndex], undefined, undefined, true);
        } catch (err) {
          console.warn('Failed to reload slide after toggling selection block', err);
        }

        // Re-render sidebar to update icons
        renderSlideElementsSidebar();
      });
    }

    // Wire up force-settings checkbox (template-only) to prevent changes by template users
    if (queryParams.mode === "template_editor") {
      const forceSettingsCheckbox = row.querySelector(`#force-settings-checkbox-${elData.id}`);
      const forceSettingsIcon = row.querySelector(`#force-settings-icon-${elData.id}`);
      if (forceSettingsIcon) {
        try {
          forceSettingsIcon.style.fontVariationSettings = elData.preventSettingsChanges ? "'FILL' 1" : "'FILL' 0";
        } catch (e) {}
      }
      if (forceSettingsCheckbox) {
        forceSettingsCheckbox.addEventListener('click', (e) => e.stopPropagation());
        forceSettingsCheckbox.addEventListener('change', (e) => {
          e.stopPropagation();
          try { pushCurrentSlideState(); } catch (err) {}
          elData.preventSettingsChanges = !!forceSettingsCheckbox.checked;
          // Update the element DOM immediately so the indicator appears without a reload
          try {
            const domEl = document.getElementById("el-" + elData.id);
            if (domEl) {
              // Ensure we have an indicators wrapper to keep layout consistent
              let wrapper = domEl.querySelector('.element-indicators-wrapper');
              const ensureWrapper = () => {
                if (!wrapper) {
                  wrapper = document.createElement('div');
                  wrapper.className = 'element-indicators-wrapper';
                  // Append wrapper to top-right of element; CSS will position it
                  domEl.appendChild(wrapper);
                  // Move any pre-existing absolute indicators into the wrapper
                  ['.persistent-indicator', '.lock-indicator', '.blocked-indicator', '.always-on-top-indicator', '.force-settings-indicator', '.element-indicator'].forEach((sel) => {
                    const n = domEl.querySelector(sel);
                    if (n) wrapper.appendChild(n);
                  });
                  wrapper.style.visibility = getCurrentShowElementIndicators() ? 'visible' : 'hidden';
                }
              };

              if (elData.preventSettingsChanges) {
                ensureWrapper();
                if (!wrapper.querySelector('.force-settings-indicator')) {
                  const fi = document.createElement('div');
                  fi.className = 'force-settings-indicator element-indicator';
                  fi.innerHTML = '<i class="material-symbols-outlined">lock_person</i>';
                  const inner = fi.querySelector('.material-symbols-outlined');
                  if (inner) inner.style.fontVariationSettings = "'FILL' 1";
                  wrapper.appendChild(fi);
                }
              } else {
                const existing = domEl.querySelector('.force-settings-indicator');
                if (existing) existing.remove();
                // If wrapper exists and now has no meaningful indicators, remove it
                if (wrapper) {
                  const hasChildren = Array.from(wrapper.children).some((c) => c.classList && (c.classList.contains('persistent-indicator') || c.classList.contains('lock-indicator') || c.classList.contains('blocked-indicator') || c.classList.contains('always-on-top-indicator') || c.classList.contains('element-indicator')));
                  if (!hasChildren) wrapper.remove();
                }
              }
            }
          } catch (err) {}

          renderSlideElementsSidebar();
        });
      }
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

      // Do not allow selecting if element blocks selection
      if (elData.isSelectionBlocked) {
        try {
          showToast(gettext('Selection is blocked for this element'), 'Info');
        } catch (e) {
          // ignore
        }
        return;
      }

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

  document.addEventListener("os:slideChanged", () => {
    try {
      renderSlideElementsSidebar();
      const slide = store.slides[store.currentSlideIndex];
      if (slide && slide.showElementIndicators === undefined) {
        slide.showElementIndicators = store.showElementIndicators;
      }
      store.showElementIndicators = slide ? slide.showElementIndicators : store.showElementIndicators;
      const showElementIconsCheckbox = document.getElementById("toggle-element-icons");
      if (showElementIconsCheckbox && !showElementIconsCheckbox.hasAttribute('data-listener-attached')) {
        showElementIconsCheckbox.addEventListener('change', handleCheckboxChange);
        showElementIconsCheckbox.setAttribute('data-listener-attached', 'true');
      }
      if (showElementIconsCheckbox) showElementIconsCheckbox.checked = !store.showElementIndicators;
      updateElementIndicatorsVisibility();
    } catch (err) {
      console.warn("Failed to render slide elements sidebar on slide change", err);
    }
  });




export function initSlideElementsSidebar() {


  const showElementIconsCheckbox = document.getElementById("toggle-element-icons");

  showElementIconsCheckbox.addEventListener('change', handleCheckboxChange);

  showElementIconsCheckbox.setAttribute('data-listener-attached', 'true');

  showElementIconsCheckbox.checked = !getCurrentShowElementIndicators();
  // Render initially and whenever slide data or selection changes
  renderSlideElementsSidebar();

  // Add a small toggle in the top toolbar to show/hide element indicators
  try {
    const topToolbar = document.querySelector('.top-toolbar');
    if (topToolbar && !document.getElementById('toggle-element-indicators-btn')) {
      const btn = document.createElement('button');
      btn.id = 'toggle-element-indicators-btn';
      btn.className = 'btn btn-sm btn-outline-secondary ms-2';
      btn.type = 'button';
      btn.title = 'Show / hide element icons';
      btn.innerHTML = '<span class="material-symbols-outlined">visibility</span>';
      topToolbar.appendChild(btn);

      const updateButtonState = () => {
        const visible = !!getCurrentShowElementIndicators();
        const icon = btn.querySelector('.material-symbols-outlined');
        if (icon) icon.textContent = visible ? 'visibility' : 'visibility_off';
      };

      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        setCurrentShowElementIndicators(!store.showElementIndicators);
        updateButtonState();

        updateElementIndicatorsVisibility();
      });

      updateButtonState();
    }
  } catch (err) {}

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
      const slide = store.slides[store.currentSlideIndex];
      if (slide && slide.showElementIndicators === undefined) {
        slide.showElementIndicators = store.showElementIndicators;
      }
      store.showElementIndicators = slide ? slide.showElementIndicators : store.showElementIndicators;
      const showElementIconsCheckbox = document.getElementById("toggle-element-icons");
      if (showElementIconsCheckbox && !showElementIconsCheckbox.hasAttribute('data-listener-attached')) {
        showElementIconsCheckbox.addEventListener('change', handleCheckboxChange);
        showElementIconsCheckbox.setAttribute('data-listener-attached', 'true');
      }
      if (showElementIconsCheckbox) showElementIconsCheckbox.checked = !store.showElementIndicators;
      updateElementIndicatorsVisibility();
    } else if (curSelectedId !== lastSelectedElementId) {
      // Selected element changed (selected, deselected, or switched to another id)
      lastSelectedElementId = curSelectedId;
      renderSlideElementsSidebar();
      const slide = store.slides[store.currentSlideIndex];
      if (slide && slide.showElementIndicators === undefined) {
        slide.showElementIndicators = store.showElementIndicators;
      }
      store.showElementIndicators = slide ? slide.showElementIndicators : store.showElementIndicators;
      const showElementIconsCheckbox = document.getElementById("toggle-element-icons");
      if (showElementIconsCheckbox && !showElementIconsCheckbox.hasAttribute('data-listener-attached')) {
        showElementIconsCheckbox.addEventListener('change', handleCheckboxChange);
        showElementIconsCheckbox.setAttribute('data-listener-attached', 'true');
      }
      if (showElementIconsCheckbox) showElementIconsCheckbox.checked = !store.showElementIndicators;
      updateElementIndicatorsVisibility();
    }
    // Otherwise, do nothing to avoid interfering with drag interactions.
  }, 600);
}

export default initSlideElementsSidebar;
