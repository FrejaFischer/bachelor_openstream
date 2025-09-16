// SPDX-FileCopyrightText: 2025 Magenta ApS <https://magenta.dk>
// SPDX-License-Identifier: AGPL-3.0-only
// ─────────────────────────────────────────────────────────────
// FONT UTILITIES
// Handles fetching and managing custom fonts across the application
// ─────────────────────────────────────────────────────────────

import {
  parentOrgID,
  showToast,
  token,
  genericFetch,
  queryParams,
} from "../../../../utils/utils.js";
import { BASE_URL } from "../../../../utils/constants.js";
import { gettext } from "../../../../utils/locales.js";

let availableFonts = []; // Global store for fetched fonts
let fontStyleSheet = null; // Global stylesheet for @font-face rules

/**
 * Fetches custom fonts from the API and makes them available globally
 * @returns {Promise<Array>} Array of font objects
 */
export async function fetchAndInitializeFonts() {
  if (queryParams.mode !== "slideshow-player") {
    try {
      const fonts = await genericFetch(
        `${BASE_URL}/api/fonts/?organisation_id=${parentOrgID}`,
        "GET",
        null,
        {
          Authorization: `Bearer ${token}`,
        },
      );

      if (fonts && Array.isArray(fonts)) {
        availableFonts = fonts;
        injectFontFacesIntoStylesheet(availableFonts);
        return fonts;
      } else {
        console.warn("No custom fonts found or invalid response.");
        return [];
      }
    } catch (error) {
      console.error("Error fetching custom fonts:", error);
      showToast(gettext("Failed to load custom fonts."), "Error");
      return [];
    }
  }
}

/**
 * Injects @font-face rules into a global stylesheet for fetched fonts
 * @param {Array} fonts - Array of font objects with name and font_url properties
 */
function injectFontFacesIntoStylesheet(fonts) {
  if (!fontStyleSheet) {
    const styleEl = document.createElement("style");
    styleEl.id = "custom-fonts-stylesheet";
    document.head.appendChild(styleEl);
    fontStyleSheet = styleEl.sheet;
  }

  // Clear existing rules if any
  while (fontStyleSheet.cssRules.length > 0) {
    fontStyleSheet.deleteRule(0);
  }

  fonts.forEach((font) => {
    if (font.name && font.font_url) {
      const rule = `
        @font-face {
          font-family: '${font.name}'; 
          src: url('${font.font_url}');
        }
      `;
      try {
        fontStyleSheet.insertRule(rule, fontStyleSheet.cssRules.length);
      } catch (e) {
        console.error(`Failed to insert @font-face rule for ${font.name}:`, e);
      }
    }
  });
}

/**
 * Gets all available fonts (custom + default system fonts)
 * @returns {Array} Array of all available fonts
 */
export function getAvailableFonts() {
  return availableFonts;
}

/**
 * Gets default system fonts
 * @returns {Array} Array of default system font names
 */
export function getDefaultFonts() {
  return ["Arial"];
}

/**
 * Gets a default font (first custom font or fallback to Arial)
 * @returns {string} Default font name
 */
export function getDefaultFont() {
  return availableFonts.length > 0 ? availableFonts[0].name : "Arial";
}

/**
 * Checks if fonts have been loaded
 * @returns {boolean} True if fonts are loaded
 */
export function areFontsLoaded() {
  return availableFonts.length > 0;
}
