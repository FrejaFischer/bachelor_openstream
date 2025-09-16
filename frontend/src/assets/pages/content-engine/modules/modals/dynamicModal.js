// SPDX-FileCopyrightText: 2025 Magenta ApS <https://magenta.dk>
// SPDX-License-Identifier: AGPL-3.0-only
/************************************************************
 * dynamicModal.js
 *    - Handles two ways to insert “dynamic content”:
 ************************************************************/

import {
  createMiniSearchInstance,
  searchItems,
  selectedBranchID,
  showToast,
  token,
} from "../../../../utils/utils.js";
import { addIframe } from "../elements/iframeElement.js";
import { BASE_URL } from "../../../../utils/constants.js";
import * as bootstrap from "bootstrap";
import { gettext } from "../../../../utils/locales.js";

/************************************************************
 * PART 1: The simple #dynamicContentModal
 ************************************************************/

// This modal has a textarea with id="dynamicContentHtml"
// and a Save button with id="saveDynamicContentBtn"
const saveDynamicBtn = document.getElementById("saveDynamicContentBtn");
if (saveDynamicBtn) {
  saveDynamicBtn.addEventListener("click", () => {
    const htmlInput = document.getElementById("dynamicContentHtml");
    if (!htmlInput) {
      console.error("No #dynamicContentHtml textarea found.");
      return;
    }

    const userHtml = htmlInput.value.trim();
    if (!userHtml) {
      showToast(
        gettext("Please enter some dynamic content (HTML)."),
        "Warning",
      );
      return;
    }

    // Call the iframeElement function
    addIframe(userHtml);

    // Hide the modal
    const dynamicContentModalEl = document.getElementById(
      "dynamicContentModal",
    );
    if (dynamicContentModalEl) {
      const bsModal = bootstrap.Modal.getInstance(dynamicContentModalEl);
      bsModal.hide();
    }
  });
}

/************************************************************
 * PART 2: The advanced #slideTypeModal with big table + search
 *
 * This section references these DOM IDs (which you must have):
 *    - #slideTypeModal (the Bootstrap modal itself)
 *    - #slideTypeSearchInput, #slideTypeSearchBtn
 *    - #categoryCheckboxes (container for category checkboxes)
 *    - #slideTypeTable (the table that lists all “slide types”)
 *    - #slideTypeOverviewRow (a row or div that shows the table)
 *    - #slideTypeContainer (a div to show the “form” after you click ‘Open’)
 *
 * You’ll also see references to “window.currentSlideType” and
 * “window.currentFormScript” or “window.currentSlideTypeInit” —
 * which are used to dynamically inject the custom form_js_content.
 ************************************************************/

// We'll store all slide types in memory after fetching:
let allSlideTypes = [];
let visibleSlideTypes = [];

// For category filtering:
let selectedCategories = new Set();

// For sorting:
let currentSortKey = null;
let currentSortDir = "asc";

/**
 * fetchAllSlideTypesForModal()
 *  - GET /api/slide-type-categories?include=widget
 *  - Flatten them into an array of slide types { name, categoryName, ... }
 *  - Build the category checkboxes
 *  - Render the table
 */
export function fetchAllSlideTypesForModal() {
  fetch(
    `${BASE_URL}/api/slide-type-categories?include=widget&branch_id=${selectedBranchID}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        // Corrected: Authorization header should be at this level
        Authorization: `Bearer ${token}`,
        "Accept-Language": window.LANGUAGE_CODE || "en",
      },
    },
  )
    .then((resp) => {
      // Add check for response status
      if (!resp.ok) {
        // Log the status and potentially the response body for debugging
        console.error(
          `Error fetching slide types: ${resp.status} ${resp.statusText}`,
        );
        // Try to read the response body as text for more detailed error messages
        resp.text().then((text) => console.error("Error details:", text));
        throw new Error(`HTTP error! status: ${resp.status}`);
      }
      return resp.json();
    })
    .then((categories) => {
      // ... existing code to process categories ...
      const flattened = [];
      categories.forEach((cat) => {
        if (cat.slide_types && cat.slide_types.length) {
          cat.slide_types.forEach((st) => {
            st.categoryName = cat.name;
            flattened.push(st);
          });
        }
      });
      allSlideTypes = flattened;
      dynamicContentSearcher.removeAll();
      dynamicContentSearcher.addAll(allSlideTypes);
      buildCategoryCheckboxes(categories);
      selectedCategories.clear();
      visibleSlideTypes = [...allSlideTypes];
      renderSlideTypeTable();
    })
    .catch((err) => console.error("Failed to fetch slide types:", err));
}

/**
 * buildCategoryCheckboxes(categories)
 *   - Renders a list of checkbox filters for each category
 *   - Container: #categoryCheckboxes
 */
function buildCategoryCheckboxes(categories) {
  const container = document.getElementById("categoryCheckboxes");
  if (!container) return;

  container.innerHTML = "";
  categories.forEach((cat) => {
    const wrapper = document.createElement("div");
    wrapper.classList.add("form-check", "mb-1");

    const input = document.createElement("input");
    input.classList.add("form-check-input");
    input.type = "checkbox";
    input.value = cat.name;
    input.id = `cat-${cat.id}`;

    // Checking/unchecking filters
    input.addEventListener("change", (e) => {
      if (e.target.checked) {
        selectedCategories.add(cat.name);
      } else {
        selectedCategories.delete(cat.name);
      }
      applyFiltersAndRender();
    });

    const label = document.createElement("label");
    label.classList.add("form-check-label");
    label.setAttribute("for", `cat-${cat.id}`);
    label.textContent = cat.name;

    wrapper.appendChild(input);
    wrapper.appendChild(label);
    container.appendChild(wrapper);
  });
}

/**
 * applyFiltersAndRender()
 *   - Filters the array of allSlideTypes => visibleSlideTypes
 *   - Then calls the sorting function and table render
 */

const dynamicContentSearcher = createMiniSearchInstance(
  ["name", "categoryName"],
  { idField: "name" },
);
function applyFiltersAndRender() {
  const searchInput = document.getElementById("slideTypeSearchInput");

  const searchResults = searchItems(
    searchInput.value,
    allSlideTypes,
    dynamicContentSearcher,
  );
  visibleSlideTypes = searchResults.filter((st) => {
    if (selectedCategories.size > 0) {
      // If user has selected some categories, only match those
      return selectedCategories.has(st.categoryName);
    }
    return true;
  });

  if (currentSortKey) {
    sortSlideTypes(currentSortKey);
  } else {
    renderSlideTypeTable();
  }
}

/**
 * sortSlideTypes(sortKey)
 *   - Sorts the visibleSlideTypes by sortKey (e.g. "name" or "categoryName")
 *   - Toggles ascending/descending if we click the same column
 */
function sortSlideTypes(sortKey) {
  if (currentSortKey === sortKey) {
    currentSortDir = currentSortDir === "asc" ? "desc" : "asc";
  } else {
    currentSortKey = sortKey;
    currentSortDir = "asc";
  }

  visibleSlideTypes.sort((a, b) => {
    if (a[sortKey] < b[sortKey]) return currentSortDir === "asc" ? -1 : 1;
    if (a[sortKey] > b[sortKey]) return currentSortDir === "asc" ? 1 : -1;
    return 0;
  });

  renderSlideTypeTable();
}

/**
 * renderSlideTypeTable()
 *   - Renders visibleSlideTypes into #slideTypeTable
 */
function renderSlideTypeTable() {
  const tbody = document.querySelector("#slideTypeTable tbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  visibleSlideTypes.forEach((st) => {
    const tr = document.createElement("tr");

    const tdName = document.createElement("td");
    tdName.textContent = st.name;
    tr.appendChild(tdName);

    const tdCat = document.createElement("td");
    tdCat.textContent = st.categoryName || gettext("(none)");
    tr.appendChild(tdCat);

    // Action col => "Open" button
    const tdAction = document.createElement("td");
    const openBtn = document.createElement("button");
    openBtn.classList.add("btn", "btn-sm", "btn-primary");
    openBtn.textContent = gettext("Open");
    openBtn.addEventListener("click", () => {
      loadSlideTypeForm(st);
    });
    tdAction.appendChild(openBtn);
    tr.appendChild(tdAction);

    tbody.appendChild(tr);
  });
}

/**
 * loadSlideTypeForm(slideType)
 *   - Hides the overview table row (#slideTypeOverviewRow)
 *   - Shows #slideTypeContainer
 *   - Dynamically loads form_html_content and form_js_content
 */
function loadSlideTypeForm(slideType, existingConfig = null) {
  window.currentSlideType = slideType; // If you want to store it in window
  window.existingConfig = existingConfig; // Store config for the form script
  const overviewRow = document.getElementById("slideTypeOverviewRow");
  const container = document.getElementById("slideTypeContainer");
  if (overviewRow) overviewRow.style.display = "none";
  if (!container) return;

  container.style.display = "block";
  cleanupForm(); // remove any previously loaded script

  document.getElementById("slideTypeModalLabel").textContent = slideType.name;

  // Insert the HTML form (if provided)
  if (slideType.form_html_content) {
    container.innerHTML = slideType.form_html_content;
  } else {
    container.innerHTML = `<p class="text-muted">${gettext("No form available.")}</p>`;
  }

  // Insert the JS content
  if (slideType.form_js_content) {
    window.currentFormScript = document.createElement("script");
    window.currentFormScript.textContent = `
      (function() {
        window.currentSlideTypeInit = {
          initialize: function() {
            ${slideType.form_js_content}
          }
        };
        window.currentSlideTypeInit.initialize();
      })();
    `;
    document.body.appendChild(window.currentFormScript);
  }

  // “Back” button to return to table
  const backButton = document.createElement("button");
  backButton.className = "btn btn-secondary mt-3";
  backButton.style.position = "relative";
  backButton.innerHTML = `<span id="dyanmic-go-back-btn" class="material-symbols-outlined me-1" >arrow_back</span>${gettext("Go Back")}`;
  backButton.onclick = function () {
    if (container) container.style.display = "none";
    if (overviewRow) overviewRow.style.display = "flex";
    cleanupForm();
    document.getElementById("slideTypeModalLabel").textContent = gettext(
      "Add Dynamic Content",
    );
  };
  container.appendChild(backButton);
}

/**
 * cleanupForm()
 *   - Removes any leftover form HTML or <script> from a previous slideType
 */
function cleanupForm() {
  const container = document.getElementById("slideTypeContainer");
  if (container) {
    container.innerHTML = "";
  }
  if (window.currentFormScript) {
    try {
      document.body.removeChild(window.currentFormScript);
    } catch (e) {
      console.warn("Failed removing old form script:", e);
    }
    window.currentFormScript = null;
  }
}

/************************************************************
 *  PART 3: Hook up search/sort events, and hide form on close
 ************************************************************/

// 1) The “Search” button: #slideTypeSearchBtn
const slideTypeSearchBtn = document.getElementById("slideTypeSearchBtn");
if (slideTypeSearchBtn) {
  slideTypeSearchBtn.addEventListener("click", () => {
    applyFiltersAndRender();
  });
}

// 2) Pressing Enter in #slideTypeSearchInput
const slideTypeSearchInput = document.getElementById("slideTypeSearchInput");
if (slideTypeSearchInput) {
  slideTypeSearchInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      applyFiltersAndRender();
    }
  });
}

// 3) Table sorting if you have <th data-sort-key="name" class="sortable-col">, etc.
document
  .querySelectorAll("#slideTypeTable thead th.sortable-col")
  .forEach((th) => {
    th.addEventListener("click", () => {
      const sortKey = th.getAttribute("data-sort-key");
      sortSlideTypes(sortKey);
    });
  });

// 4) If you want to reset everything when #slideTypeModal is closed
const slideTypeModalEl = document.getElementById("slideTypeModal");
if (slideTypeModalEl) {
  slideTypeModalEl.addEventListener("hidden.bs.modal", () => {
    // Show the table row again
    const overviewRow = document.getElementById("slideTypeOverviewRow");
    const container = document.getElementById("slideTypeContainer");
    if (overviewRow) overviewRow.style.display = "flex";
    if (container) container.style.display = "none";
    cleanupForm();
    const titleEl = document.getElementById("slideTypeModalLabel");
    if (titleEl) {
      titleEl.textContent = gettext("Add Dynamic Content");
    }
  });
}

/************************************************************
 *  PART 4: If you want a helper to open #slideTypeModal
 ************************************************************/

export function showSlideTypeModal(elementToUpdate = null) {
  const modalEl = document.getElementById("slideTypeModal");
  const bsModal = bootstrap.Modal.getOrCreateInstance(modalEl);

  if (elementToUpdate && elementToUpdate.slideTypeId) {
    // This is the "edit" path
    fetch(
      `${BASE_URL}/api/slide-type-categories?include=widget&branch_id=${selectedBranchID}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "Accept-Language": window.LANGUAGE_CODE || "en",
        },
      },
    )
      .then((resp) => {
        if (!resp.ok) {
          throw new Error(`HTTP error! status: ${resp.status}`);
        }
        return resp.json();
      })
      .then((categories) => {
        const slideType = categories
          .flatMap((cat) => cat.slide_types || [])
          .find((st) => st.id === elementToUpdate.slideTypeId);

        if (slideType) {
          loadSlideTypeForm(slideType, elementToUpdate.config);
        } else {
          console.error(
            `Could not find slide type with ID: ${elementToUpdate.slideTypeId}`,
          );
          fetchAllSlideTypesForModal(); // Fallback to showing the list
        }
      })
      .catch((err) => {
        console.error("Failed to fetch slide types for update:", err);
        fetchAllSlideTypesForModal(); // Fallback
      });
  } else {
    // This is the "add new" path
    fetchAllSlideTypesForModal();
  }

  bsModal.show();
}
