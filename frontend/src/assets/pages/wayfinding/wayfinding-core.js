// SPDX-FileCopyrightText: 2025 Magenta ApS <https://magenta.dk>
// SPDX-License-Identifier: AGPL-3.0-only
import WayfindingRenderer from "./renderer.js";
import { parseAndValidate, exportState } from "./data-manager.js";
import * as pathManager from "./path-manager.js";

// Lightweight shared initializer that creates and exposes renderer and data helpers
export function initWayfindingCore({
  mapContainer,
  pointsContainer,
  svgOverlay,
  overlayWrapper,
  mapImage,
  getState,
  onPointClick,
}) {
  const renderer = new WayfindingRenderer({
    mapContainer,
    pointsContainer,
    svgOverlay,
    overlayWrapper,
    mapImage,
    getState,
    onPointClick,
  });

  // Save/Load UI helpers that operate on the expected DOM elements
  function showSaveModal() {
    const state = getState();
    const textarea = document.getElementById("save-json-textarea");
    if (textarea)
      textarea.value = exportState({
        floors: state.floors,
        points: state.points,
        paths: state.paths,
        currentFloorId: state.currentFloorId,
        pathCounter: state.counters?.pathCounter,
        floorCounter: state.counters?.floorCounter,
      });
    const overlay = document.getElementById("save-modal-overlay");
    if (overlay) overlay.classList.add("visible");
  }

  function hideSaveModal() {
    const overlay = document.getElementById("save-modal-overlay");
    if (overlay) overlay.classList.remove("visible");
  }

  function showLoadModal() {
    const fileInput = document.getElementById("load-file-input");
    if (fileInput) fileInput.value = "";
    const textarea = document.getElementById("load-json-textarea");
    if (textarea) textarea.value = "";
    const overlay = document.getElementById("load-modal-overlay");
    if (overlay) overlay.classList.add("visible");
  }

  function hideLoadModal() {
    const overlay = document.getElementById("load-modal-overlay");
    if (overlay) overlay.classList.remove("visible");
  }

  // Attach event listeners for the modal buttons (idempotent)
  function attachModalHandlers(opts = {}) {
    const { onLoad } = opts;

    const copyBtn = document.getElementById("save-copy-btn");
    if (copyBtn)
      copyBtn.addEventListener("click", () => {
        const textarea = document.getElementById("save-json-textarea");
        if (!textarea) return;
        textarea.select();
        document.execCommand("copy");
      });

    const downloadBtn = document.getElementById("save-download-btn");
    if (downloadBtn)
      downloadBtn.addEventListener("click", () => {
        const textarea = document.getElementById("save-json-textarea");
        if (!textarea) return;
        const data = textarea.value;
        const blob = new Blob([data], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "wayfinding-data.json";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      });

    const loadFileInput = document.getElementById("load-file-input");
    if (loadFileInput)
      loadFileInput.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
          const ta = document.getElementById("load-json-textarea");
          if (ta) ta.value = ev.target.result;
        };
        reader.readAsText(file);
      });

    const loadConfirmBtn = document.getElementById("load-confirm-btn");
    if (loadConfirmBtn)
      loadConfirmBtn.addEventListener("click", () => {
        const ta = document.getElementById("load-json-textarea");
        if (!ta) return;
        const jsonText = ta.value.trim();
        if (!jsonText) return;
        try {
          const data = parseAndValidate(jsonText);
          if (onLoad) onLoad(data);
          hideLoadModal();
        } catch (err) {
          console.error(err);
          alert(err.message || "Invalid JSON");
        }
      });

    // close / overlay click handlers
    const saveCloseBtn = document.getElementById("save-close-btn");
    if (saveCloseBtn) saveCloseBtn.addEventListener("click", hideSaveModal);
    const saveOverlay = document.getElementById("save-modal-overlay");
    if (saveOverlay)
      saveOverlay.addEventListener("click", (e) => {
        if (e.target.id === "save-modal-overlay") hideSaveModal();
      });
    const loadCloseBtn = document.getElementById("load-close-btn");
    if (loadCloseBtn) loadCloseBtn.addEventListener("click", hideLoadModal);
    const loadOverlay = document.getElementById("load-modal-overlay");
    if (loadOverlay)
      loadOverlay.addEventListener("click", (e) => {
        if (e.target.id === "load-modal-overlay") hideLoadModal();
      });
  }

  // attach modal handlers with a default onLoad that does nothing (editor will supply real handler)
  attachModalHandlers({ onLoad: null });

  return {
    renderer,
    renderMapContent: () => renderer.renderMapContent(),
    updateOverlayDimensions: () => renderer.updateOverlayDimensions(),
    getIconName: (point) => renderer.getIconName(point),
    createPointElement: (point) => renderer.createPointElement(point),
    createPathElement: (points) => renderer.createPathElement(points),
    // data helpers
    parseAndValidate,
    exportState,
    // path manager helpers
    hideAllPaths: pathManager.hideAllPaths,
    setPathVisibility: pathManager.setPathVisibility,
    togglePath: pathManager.togglePath,
    showOnlyPath: pathManager.showOnlyPath,
    // modal helpers
    showSaveModal,
    hideSaveModal,
    showLoadModal,
    hideLoadModal,
    attachModalHandlers,
  };
}

export default initWayfindingCore;
