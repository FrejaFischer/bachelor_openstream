// SPDX-FileCopyrightText: 2025 Magenta ApS <https://magenta.dk>
// SPDX-License-Identifier: AGPL-3.0-only
/************************************************************
 * frontdeskLtkBorgerserviceSlideType.js
 * Frontdesk LTK Borgerservice queue display slide type definition
 ************************************************************/

import { BASE_URL } from "../../../../../utils/constants.js";
import { SlideTypeUtils } from "../slideTypeRegistry.js";

export const FrontdeskLtkBorgerserviceSlideType = {
  name: "Frontdesk LTK Borgerservice",
  description: "Display live frontdesk queue for LTK Borgerservice",
  categoryId: 1,

  ...SlideTypeUtils.getDefaultSlideSettings(),

  _apiKey: null,

  async fetchApiKey() {
    if (this._apiKey) return this._apiKey;

    try {
      const token = localStorage.getItem("accessToken");
      const response = await fetch(
        `${BASE_URL}/api/frontdesk_ltk_borgerservice_api_key`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        },
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch API key: ${response.statusText}`);
      }

      const data = await response.json();
      this._apiKey = data.apiKey;
      return this._apiKey;
    } catch (error) {
      console.error("Error fetching API key:", error);
      return null;
    }
  },

  getDefaultConfig(existingConfig = {}) {
    // This integration doesn't have configurable options
    const config = existingConfig || {};
    return {};
  },

  async generateForm(existingConfig = null) {
    try {
      // Try to fetch the API key to verify it's available
      const apiKey = await this.fetchApiKey();
      if (!apiKey) {
        return SlideTypeUtils.getErrorTemplate(
          "Could not retrieve Frontdesk API key. Please contact your administrator.",
          "Frontdesk LTK Borgerservice",
        );
      }

      return await SlideTypeUtils.loadFormTemplateWithCallback(
        "/slide-types/frontdesk-ltk-borgerservice-form",
        "Frontdesk LTK Borgerservice Form",
        () => {
          this.setupFormEventListeners();
        },
      );
    } catch (error) {
      console.error(
        "Error generating Frontdesk LTK Borgerservice form:",
        error,
      );
      return SlideTypeUtils.getErrorTemplate(
        `Could not initialize Frontdesk LTK Borgerservice form: ${error.message}`,
        "Frontdesk LTK Borgerservice Form",
      );
    }
  },

  setupFormEventListeners() {
    // Set up the add queue display button
    const addBtn = document.getElementById("add-webview-btn");
    if (!addBtn) {
      setTimeout(() => this.setupFormEventListeners(), 100);
      return;
    }

    // Store cleanup functions
    this.eventListenerCleanup = [];

    const addQueueHandler = async () => {
      try {
        const apiKey = await this.fetchApiKey();
        if (!apiKey) {
          alert(
            "Could not retrieve API key. Please contact your administrator.",
          );
          return;
        }

        const url = `https://clientdevicebrowser.frontdesksuite.com/ltk?clientIdentifier=${apiKey}`;

        // Use the global embed website function to add the element
        if (window.addEmbedWebsiteElementToSlide) {
          window.addEmbedWebsiteElementToSlide(url);

          // Close any modal that might be open
          const modal = document.querySelector(".modal.show");
          if (modal) {
            const bootstrapModal = bootstrap.Modal.getInstance(modal);
            if (bootstrapModal) {
              bootstrapModal.hide();
            }
          }
        } else {
          console.error("addEmbedWebsiteElementToSlide function not available");
          alert("Error: Could not add queue display. Please try again.");
        }
      } catch (error) {
        console.error("Error adding frontdesk queue display:", error);
        alert("Error adding queue display. Please try again.");
      }
    };

    addBtn.addEventListener("click", addQueueHandler);
    this.eventListenerCleanup.push(() =>
      addBtn.removeEventListener("click", addQueueHandler),
    );
  },

  cleanupFormEventListeners() {
    if (this.eventListenerCleanup) {
      this.eventListenerCleanup.forEach((cleanup) => cleanup());
      this.eventListenerCleanup = null;
    }
    this._apiKey = null;
  },

  async generateSlide(config) {
    // This integration creates embed website elements instead of custom slides
    // So this method shouldn't be called, but we'll provide a fallback
    const apiKey = await this.fetchApiKey();
    if (!apiKey) {
      return SlideTypeUtils.getErrorTemplate(
        "Could not retrieve API key for Frontdesk LTK Borgerservice",
        "Frontdesk LTK Borgerservice",
      );
    }

    const url = `https://clientdevicebrowser.frontdesksuite.com/ltk?clientIdentifier=${apiKey}`;
    return SlideTypeUtils.generateSlideUrl(
      "about:blank",
      { url },
      "Frontdesk LTK Borgerservice",
    );
  },

  extractFormData() {
    // No form data to extract for this integration
    return {};
  },

  validateSlide() {
    // No validation needed - the API key fetch handles the validation
    return true;
  },

  generateSlideData() {
    // This integration creates embed website elements, not slide data
    const defaults = SlideTypeUtils.getDefaultSlideSettings();

    return {
      gridWidth: defaults.gridWidth,
      gridHeight: defaults.gridHeight,
      gridX: defaults.gridX,
      gridY: defaults.gridY,
      backgroundColor: defaults.backgroundColor,
      slideTypeId: "frontdesk-ltk-borgerservice",
      config: {},
      integrationName: "Frontdesk LTK Borgerservice",
    };
  },
};
