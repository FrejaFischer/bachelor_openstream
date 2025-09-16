// SPDX-FileCopyrightText: 2025 Magenta ApS <https://magenta.dk>
// SPDX-License-Identifier: AGPL-3.0-only
import "./style.scss";
import * as bootstrap from "bootstrap";
import {
  gettext,
  translateHTML,
  fetchUserLangugage,
} from "../../utils/locales";
import {
  validateToken,
  makeActiveInNav,
  updateNavbarBranchName,
  updateNavbarUsername,
  showToast,
  genericFetch,
  parentOrgID,
  debounce,
  createMiniSearchInstance,
  searchItems,
  initSignOutButton,
} from "../../utils/utils";
import { BASE_URL } from "../../utils/constants";

/**
 * Manage Tags and Categories Page
 * Allows administrators to create, edit, and delete tags and categories
 */

// DOM Elements - Categories

const categoriesContainer = document.getElementById("categories-container");
const categoriesLoading = document.getElementById("categories-loading");
const noCategoriesAlert = document.getElementById("no-categories-alert");
const categorySearch = document.getElementById("category-search");
const addCategoryBtn = document.getElementById("add-category-btn");
const categoryModal = new bootstrap.Modal(
  document.getElementById("category-modal"),
);
const categoryModalLabel = document.getElementById("categoryModalLabel");
const categoryIdInput = document.getElementById("category-id");
const categoryNameInput = document.getElementById("category-name");
const saveCategoryBtn = document.getElementById("save-category-btn");

// DOM Elements - Tags
const tagsContainer = document.getElementById("tags-container");
const tagsLoading = document.getElementById("tags-loading");
const noTagsAlert = document.getElementById("no-tags-alert");
const tagSearch = document.getElementById("tag-search");
const addTagBtn = document.getElementById("add-tag-btn");
const tagModal = new bootstrap.Modal(document.getElementById("tag-modal"));
const tagModalLabel = document.getElementById("tagModalLabel");
const tagIdInput = document.getElementById("tag-id");
const tagNameInput = document.getElementById("tag-name");
const saveTagBtn = document.getElementById("save-tag-btn");

// DOM Elements - Confirm Delete Modal
const deleteConfirmModal = new bootstrap.Modal(
  document.getElementById("delete-confirm-modal"),
);
const deleteItemName = document.getElementById("delete-item-name");
const confirmDeleteBtn = document.getElementById("confirm-delete-btn");

// Data and State
let allCategories = [];
let allTags = [];
let categorySearchQuery = "";
let tagSearchQuery = "";
let itemToDelete = null;
let deleteType = null; // "category" or "tag"

// Create MiniSearch instances for searching
const categoryMiniSearch = createMiniSearchInstance(["name"]);
const tagMiniSearch = createMiniSearchInstance(["name"]);

// Initialize the page
document.addEventListener("DOMContentLoaded", async () => {
  initSignOutButton();
  await fetchUserLangugage();
  translateHTML();

  makeActiveInNav("/manage-categories-and-tags");
  await validateToken();
  updateNavbarBranchName();
  updateNavbarUsername();
  // Fetch data
  await Promise.all([fetchCategories(), fetchTags()]);

  // Set up event listeners
  setupEventListeners();

  // Mark side nav as active
  const sideNavLink = document.querySelector(
    'a[href="/manage-tags-categories"]',
  );
  if (sideNavLink) sideNavLink.classList.add("active");
});

// Fetch all categories from the API
async function fetchCategories() {
  try {
    // Check if organisation ID is available
    if (!parentOrgID) {
      showToast(
        gettext("Organization ID not found. Please refresh the page."),
        "Error",
      );
      return;
    }

    const categories = await genericFetch(
      `${BASE_URL}/api/categories/?organisation_id=${parentOrgID}`,
    );
    allCategories = categories;
    categoryMiniSearch.removeAll();
    categoryMiniSearch.addAll(categories);
    renderCategories(categories);
  } catch (error) {
    console.error("Error fetching categories:", error);
    showToast(gettext("Failed to load categories"), "Error");
    categoriesLoading.classList.add("d-none");
    noCategoriesAlert.classList.remove("d-none");
  }
}

// Fetch all tags from the API
async function fetchTags() {
  try {
    // Check if organisation ID is available
    if (!parentOrgID) {
      showToast(
        gettext("Organization ID not found. Please refresh the page."),
        "Error",
      );
      return;
    }

    const tags = await genericFetch(
      `${BASE_URL}/api/tags/?organisation_id=${parentOrgID}`,
    );
    allTags = tags;
    tagMiniSearch.removeAll();
    tagMiniSearch.addAll(tags);
    renderTags(tags);
  } catch (error) {
    console.error("Error fetching tags:", error);
    showToast(gettext("Failed to load tags"), "Error");
    tagsLoading.classList.add("d-none");
    noTagsAlert.classList.remove("d-none");
  }
}

// Setup all event listeners
function setupEventListeners() {
  // Category search
  categorySearch.addEventListener(
    "input",
    debounce(() => {
      categorySearchQuery = categorySearch.value.trim().toLowerCase();
      searchAndRenderCategories();
    }, 300),
  );

  // Tag search
  tagSearch.addEventListener(
    "input",
    debounce(() => {
      tagSearchQuery = tagSearch.value.trim().toLowerCase();
      searchAndRenderTags();
    }, 300),
  );

  // Category modal events
  addCategoryBtn.addEventListener("click", () => showAddCategoryModal());
  saveCategoryBtn.addEventListener("click", saveCategory);

  // Tag modal events
  addTagBtn.addEventListener("click", () => showAddTagModal());
  saveTagBtn.addEventListener("click", saveTag);

  // Delete confirmation
  confirmDeleteBtn.addEventListener("click", confirmDelete);
}

// Show the add category modal
function showAddCategoryModal() {
  categoryIdInput.value = "";
  categoryNameInput.value = "";
  categoryModalLabel.textContent = gettext("Add Category");
  categoryModal.show();
}

// Show the edit category modal
function showEditCategoryModal(category) {
  categoryIdInput.value = category.id;
  categoryNameInput.value = category.name;
  categoryModalLabel.textContent = gettext("Edit Category");
  categoryModal.show();
}

// Show the add tag modal
function showAddTagModal() {
  tagIdInput.value = "";
  tagNameInput.value = "";
  tagModalLabel.textContent = gettext("Add Tag");
  tagModal.show();
}

// Show the edit tag modal
function showEditTagModal(tag) {
  tagIdInput.value = tag.id;
  tagNameInput.value = tag.name;
  tagModalLabel.textContent = gettext("Edit Tag");
  tagModal.show();
}

// Save a category (create or update)
async function saveCategory() {
  const categoryId = categoryIdInput.value;
  const categoryName = categoryNameInput.value.trim();

  if (!categoryName) {
    showToast(gettext("Category name is required"), "Warning");
    return;
  }

  try {
    let savedCategory;
    if (categoryId) {
      // Update existing category
      savedCategory = await genericFetch(
        `${BASE_URL}/api/categories/${categoryId}/?organisation_id=${parentOrgID}`,
        "PATCH",
        JSON.stringify({ name: categoryName }),
      );
      showToast(gettext("Category updated successfully"), "Success");
    } else {
      // Create new category
      savedCategory = await genericFetch(
        `${BASE_URL}/api/categories/?organisation_id=${parentOrgID}`,
        "POST",
        JSON.stringify({ name: categoryName, organisation_id: parentOrgID }),
      );
      showToast(gettext("Category created successfully"), "Success");
    }

    // Update the list of categories
    await fetchCategories();
    categoryModal.hide();
  } catch (error) {
    console.error("Error saving category:", error);
    showToast(error.detail || gettext("Failed to save category"), "Error");
  }
}

// Save a tag (create or update)
async function saveTag() {
  const tagId = tagIdInput.value;
  const tagName = tagNameInput.value.trim();

  if (!tagName) {
    showToast(gettext("Tag name is required"), "Warning");
    return;
  }

  try {
    if (tagId) {
      await genericFetch(
        `${BASE_URL}/api/tags/${tagId}/?organisation_id=${parentOrgID}`,
        "PATCH",
        JSON.stringify({ name: tagName }),
      );
      showToast(gettext("Tag updated successfully"), "Success");
    } else {
      await genericFetch(
        `${BASE_URL}/api/tags/?organisation_id=${parentOrgID}`,
        "POST",
        JSON.stringify({ name: tagName, organisation_id: parentOrgID }),
      );
      showToast(gettext("Tag created successfully"), "Success");
    }
    await fetchTags();
    tagModal.hide();
  } catch (error) {
    console.error("Error saving tag:", error);
    showToast(error.detail || gettext("Failed to save tag"), "Error");
  }
}

// Show delete confirmation modal
function showDeleteConfirmation(item, type) {
  itemToDelete = item;
  deleteType = type;
  deleteItemName.textContent = `${item.name} (${gettext(type)})`;
  deleteConfirmModal.show();
}

// Handle delete confirmation
async function confirmDelete() {
  if (!itemToDelete || !deleteType) return;

  try {
    if (deleteType === "category") {
      await genericFetch(
        `${BASE_URL}/api/categories/${itemToDelete.id}/?organisation_id=${parentOrgID}`,
        "DELETE",
      );
      await fetchCategories();
      showToast(gettext("Category deleted successfully"), "Success");
    } else if (deleteType === "tag") {
      await genericFetch(
        `${BASE_URL}/api/tags/${itemToDelete.id}/?organisation_id=${parentOrgID}`,
        "DELETE",
      );
      await fetchTags();
      showToast(gettext("Tag deleted successfully"), "Success");
    }
    deleteConfirmModal.hide();
  } catch (error) {
    console.error(`Error deleting ${deleteType}:`, error);
    showToast(
      error.detail ||
        gettext(
          `This ${deleteType} cannot be deleted because it is being used`,
        ),
      "Error",
    );
  } finally {
    itemToDelete = null;
    deleteType = null;
  }
}

// Search and render categories
function searchAndRenderCategories() {
  if (!categorySearchQuery) {
    renderCategories(allCategories);
    return;
  }

  const results = searchItems(
    categorySearchQuery,
    allCategories,
    categoryMiniSearch,
  );
  renderCategories(results);
}

// Search and render tags
function searchAndRenderTags() {
  if (!tagSearchQuery) {
    renderTags(allTags);
    return;
  }

  const results = searchItems(tagSearchQuery, allTags, tagMiniSearch);
  renderTags(results);
}

// Render categories to the DOM
function renderCategories(categories) {
  categoriesLoading.classList.add("d-none");

  if (!categories || categories.length === 0) {
    noCategoriesAlert.classList.remove("d-none");
    categoriesContainer.innerHTML = ""; // Clear existing categories
    return;
  }

  noCategoriesAlert.classList.add("d-none");
  categoriesContainer.innerHTML = ""; // Clear existing categories

  categories.forEach((category) => {
    const categoryEl = document.createElement("div");
    categoryEl.className =
      "list-item d-flex justify-content-between align-items-center p-3 border-bottom";
    categoryEl.innerHTML = `
            <div class="d-flex align-items-center">
                <span class="material-symbols-outlined me-2">category</span>
                <span class="item-name">${category.name}</span>
            </div>
            <div class="actions">
                <button class="btn btn-sm btn-outline-primary edit-btn me-2">
                    <span class="material-symbols-outlined">edit</span>
                </button>
                <button class="btn btn-sm btn-outline-danger delete-btn">
                    <span class="material-symbols-outlined">delete</span>
                </button>
            </div>
        `;

    // Add event listeners
    categoryEl
      .querySelector(".edit-btn")
      .addEventListener("click", () => showEditCategoryModal(category));
    categoryEl
      .querySelector(".delete-btn")
      .addEventListener("click", () =>
        showDeleteConfirmation(category, "category"),
      );

    categoriesContainer.appendChild(categoryEl);
  });
}

// Render tags to the DOM
function renderTags(tags) {
  tagsLoading.classList.add("d-none");

  if (!tags || tags.length === 0) {
    noTagsAlert.classList.remove("d-none");
    tagsContainer.innerHTML = ""; // Clear existing tags
    return;
  }

  noTagsAlert.classList.add("d-none");
  tagsContainer.innerHTML = ""; // Clear existing tags

  tags.forEach((tag) => {
    const tagEl = document.createElement("div");
    tagEl.className =
      "list-item d-flex justify-content-between align-items-center p-3 border-bottom";
    tagEl.innerHTML = `
            <div class="d-flex align-items-center">
                <span class="material-symbols-outlined me-2">sell</span>
                <span class="item-name">${tag.name}</span>
            </div>
            <div class="actions">
                <button class="btn btn-sm btn-outline-primary edit-btn me-2">
                    <span class="material-symbols-outlined">edit</span>
                </button>
                <button class="btn btn-sm btn-outline-danger delete-btn">
                    <span class="material-symbols-outlined">delete</span>
                </button>
            </div>
        `;

    // Add event listeners
    tagEl
      .querySelector(".edit-btn")
      .addEventListener("click", () => showEditTagModal(tag));
    tagEl
      .querySelector(".delete-btn")
      .addEventListener("click", () => showDeleteConfirmation(tag, "tag"));

    tagsContainer.appendChild(tagEl);
  });
}

function activateNavLink() {
  const navLink = document.querySelector('a[href="/manage-tags-categories"]');
  if (navLink) navLink.classList.add("active");
}
setTimeout(activateNavLink, 200);
