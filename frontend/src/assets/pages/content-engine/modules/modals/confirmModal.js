// SPDX-FileCopyrightText: 2025 Magenta ApS <https://magenta.dk>
// SPDX-License-Identifier: AGPL-3.0-only
import * as bootstrap from "bootstrap";
import { gettext } from "../../../../utils/locales.js";

export function showConfirmModal(message, onConfirm) {
  let modal = document.getElementById("confirmModal");
  if (!modal) {
    // Create it if not existing
    modal = document.createElement("div");
    modal.id = "confirmModal";
    modal.className = "modal fade";
    modal.tabIndex = -1;
    modal.setAttribute("aria-labelledby", "confirmModalLabel");
    modal.setAttribute("aria-hidden", "true");
    modal.innerHTML = `
        <div class="modal-dialog" role="document">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title" id="confirmModalLabel">${gettext("Confirm Action")}</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="${gettext("Close")}"></button>
            </div>
            <div class="modal-body">${message}</div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">${gettext("Cancel")}</button>
              <button type="button" class="btn btn-danger" id="confirmModalYes">${gettext("Yes")}</button>
            </div>
          </div>
        </div>
      `;
    document.body.appendChild(modal);
  } else {
    modal.querySelector(".modal-body").innerHTML = message;
  }
  let bsModal = bootstrap.Modal.getOrCreateInstance(modal);

  // Remove old event listeners from yes button
  const yesBtn = modal.querySelector("#confirmModalYes");
  const newYesBtn = yesBtn.cloneNode(true);
  yesBtn.parentNode.replaceChild(newYesBtn, yesBtn);

  newYesBtn.addEventListener("click", () => {
    onConfirm();
    bsModal.hide();
  });

  bsModal.show();
}
