// SPDX-FileCopyrightText: 2025 Magenta ApS <https://magenta.dk>
// SPDX-License-Identifier: AGPL-3.0-only
import * as bootstrap from "bootstrap";
import "./style.scss";
import {
  translateHTML,
  gettext,
  fetchUserLangugage,
} from "../../utils/locales";
import {
  token,
  myUserId,
  signOut,
  validateToken,
  makeActiveInNav,
  updateNavbarUsername,
  updateNavbarBranchName,
  genericFetch,
  showToast,
  parentOrgID,
  initSignOutButton,
} from "../../utils/utils";
import { BASE_URL } from "../../utils/constants";

let colors = [];
let colorBeingEdited = null;
let deleteId = null;

// DOM elements
const adminRequiredMessage = document.getElementById("admin-required-message-colors");
const loadingSpinner = document.getElementById("loading-spinner-colors");
const colorsTable = document.getElementById("colors-table");
const colorsTableBody = document.getElementById("colors-table-body");
const deleteModalEl = document.getElementById("deleteModal");
const deleteModal = new bootstrap.Modal(deleteModalEl);
const confirmDeleteBtn = document.getElementById("confirm-delete-btn");
const deleteNameEl = document.getElementById("delete-color-name");

// Modal elements
const colorModal = new bootstrap.Modal(document.getElementById("colorModal"));
const openModalBtn = document.getElementById("open-color-modal-btn");
const modalNameInput = document.getElementById("modal-color-name");
const modalHexInput = document.getElementById("modal-color-hex");
const modalTypeSelect = document.getElementById("modal-color-type");
const modalEditIdInput = document.getElementById("modal-edit-color-id");
const modalSaveBtn = document.getElementById("modal-save-btn");

// Initialize page on load
document.addEventListener("DOMContentLoaded", async () => {
  await fetchUserLangugage();
  translateHTML();
  makeActiveInNav("/manage-color-scheme");
  await validateToken();
  updateNavbarBranchName();
  updateNavbarUsername();
  await loadColors();
  setupEventListeners();
});

// Load colors from API
async function loadColors() {
  show(loadingSpinner);
  hide(colorsTable);
  try {
    colors = await genericFetch(
      `${BASE_URL}/api/custom-colors/?organisation_id=${parentOrgID}`,
      "GET",
    );
    renderColors();
  } catch (err) {
    if (err.status === 403) {
      show(adminRequiredMessage);
    } else {
      showToast(
        gettext("Failed to load colors: ") + (err.detail || err.message),
        "Error",
      );
    }
  } finally {
    hide(loadingSpinner);
  }
}

// Render colors table
function renderColors() {
  colorsTableBody.innerHTML = "";
  if (!colors || colors.length === 0) {
    // nothing
    show(colorsTable);
    return;
  }
  colors.forEach((color) => {
    const row = document.createElement("tr");
    // Name
    const nameTd = document.createElement("td");
    nameTd.textContent = color.name;
    // Preview
    const previewTd = document.createElement("td");
    const previewDiv = document.createElement("div");
    previewDiv.className = "color-preview";
    previewDiv.style.backgroundColor = color.hex_value || color.hexValue || "";
    previewTd.appendChild(previewDiv);
    // Actions
    const actionsTd = document.createElement("td");
    // Edit
    const editBtn = document.createElement("button");
    editBtn.className = "btn btn-sm btn-outline-secondary me-2";
    editBtn.innerHTML = '<span class="material-symbols-outlined">edit</span>';
    editBtn.title = gettext("Edit");
    editBtn.addEventListener("click", () => openEditModal(color));
    // Delete
    const delBtn = document.createElement("button");
    delBtn.className = "btn btn-sm btn-outline-danger";
    delBtn.innerHTML = '<span class="material-symbols-outlined">delete</span>';
    delBtn.title = gettext("Delete");
    delBtn.addEventListener("click", () => showDeleteConfirmation(color));
    actionsTd.appendChild(editBtn);
    actionsTd.appendChild(delBtn);
    // Type column
    const typeTd = document.createElement("td");
    typeTd.textContent = color.type;
    // Append
    row.appendChild(nameTd);
    row.appendChild(previewTd);
    row.appendChild(typeTd);
    row.appendChild(actionsTd);
    colorsTableBody.appendChild(row);
  });
  show(colorsTable);
}

// Open add color modal
function openAddModal() {
  modalEditIdInput.value = "";
  modalNameInput.value = "";
  modalHexInput.value = "#000000";
  modalTypeSelect.value = "primary";
  document.getElementById("colorModalLabel").textContent = gettext("Add Color");
  modalSaveBtn.textContent = gettext("Save");
  colorBeingEdited = null;
  colorModal.show();
}

// Open edit color modal
function openEditModal(color) {
  colorBeingEdited = color;
  modalEditIdInput.value = color.id;
  modalNameInput.value = color.name;
  modalHexInput.value = color.hex_value || color.hexValue;
  modalTypeSelect.value = color.type;
  document.getElementById("colorModalLabel").textContent =
    gettext("Edit Color");
  modalSaveBtn.textContent = gettext("Save");
  colorModal.show();
}

// Handle modal save
async function handleModalSave() {
  const payload = {
    name: modalNameInput.value,
    hexValue: modalHexInput.value,
    type: modalTypeSelect.value,
  };
  try {
    let res;
    if (colorBeingEdited) {
      res = await genericFetch(
        `${BASE_URL}/api/custom-colors/${colorBeingEdited.id}/?organisation_id=${parentOrgID}`,
        "PATCH",
        payload,
      );
      colors = colors.map((c) => (c.id === res.id ? res : c));
      showToast(gettext("Color updated successfully"), "Success");
    } else {
      res = await genericFetch(
        `${BASE_URL}/api/custom-colors/?organisation_id=${parentOrgID}`,
        "POST",
        payload,
      );
      colors.push(res);
      showToast(gettext("Color added successfully"), "Success");
    }
    renderColors();
    colorModal.hide();
  } catch (err) {
    showToast(
      gettext("Failed to save color: ") + (err.detail || err.message),
      "Error",
    );
  }
}

// Show delete confirmation
function showDeleteConfirmation(color) {
  deleteId = color.id;
  deleteNameEl.textContent = color.name;
  deleteModal.show();
}

// Delete color
async function deleteColor() {
  if (!deleteId) return;
  try {
    await genericFetch(
      `${BASE_URL}/api/custom-colors/${deleteId}/?organisation_id=${parentOrgID}`,
      "DELETE",
    );
    colors = colors.filter((c) => c.id !== deleteId);
    renderColors();
    showToast(gettext("Color deleted successfully"), "Success");
  } catch (err) {
    showToast(
      gettext("Failed to delete color: ") + (err.detail || err.message),
      "Error",
    );
  } finally {
    deleteId = null;
    deleteModal.hide();
  }
}

// Utility show/hide
function show(el) {
  if (el) el.classList.remove("d-none");
}
function hide(el) {
  if (el) el.classList.add("d-none");
}

function setupEventListeners() {
  openModalBtn.addEventListener("click", openAddModal);
  modalSaveBtn.addEventListener("click", handleModalSave);
  confirmDeleteBtn.addEventListener("click", deleteColor);
}

function activateNavLink() {
  const navLink = document.querySelector('a[href="/manage-color-scheme"]');
  if (navLink) navLink.classList.add("active");
}
setTimeout(activateNavLink, 200);

initSignOutButton();
