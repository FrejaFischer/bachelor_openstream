// SPDX-FileCopyrightText: 2025 Magenta ApS <https://magenta.dk>
// SPDX-License-Identifier: AGPL-3.0-only
import "./style.scss";
import { BASE_URL } from "../../utils/constants";
import {
  translateHTML,
  fetchUserLangugage,
  gettext,
} from "../../utils/locales";

// Initialize translations
(async () => {
  await fetchUserLangugage();
  translateHTML();
})();

// Get API key from URL parameters
const urlParams = new URLSearchParams(window.location.search);
const apiKey = urlParams.get("apiKey");

// DOM elements
const loadingState = document.getElementById("loading-state");
const registrationState = document.getElementById("registration-state");
const errorState = document.getElementById("error-state");
const screenIdElement = document.getElementById("screen-id");
const errorMessageElement = document.getElementById("error-message");

/**
 * Show error state with a specific message
 */
function showError(message) {
  loadingState.style.display = "none";
  registrationState.style.display = "none";
  errorState.style.display = "block";
  errorMessageElement.textContent = message;
}

/**
 * Show registration state with screen ID
 */
function showRegistration(screenId) {
  loadingState.style.display = "none";
  errorState.style.display = "none";
  registrationState.style.display = "block";
  screenIdElement.textContent = screenId;
}

/**
 * Create a new screen via API
 */
async function createScreen() {
  try {
    const response = await fetch(`${BASE_URL}/api/create-screen/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        apiKey: apiKey,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }

    const data = await response.json();
    return data.screenId;
  } catch (error) {
    console.error("Error creating screen:", error);
    throw error;
  }
}

/**
 * Check if screen is assigned to a group
 */
async function checkForGroupAssignment(screenId) {
  try {
    const response = await fetch(
      `${BASE_URL}/api/check-screen-group/?screenId=${screenId}&apiKey=${apiKey}`,
      {
        method: "GET",
      },
    );

    if (response.ok) {
      const data = await response.json();
      if (data.groupId) {
        // Redirect to the open-screen URL when a group is assigned.
        window.location.href = `/open-screen?displayWebsiteId=${screenId}&apiKey=${apiKey}&mode=slideshow-player`;
        return true;
      }
      return false;
    } else if (response.status === 404) {
      // Screen not found, create a new one
      const newScreenId = await createScreen();
      localStorage.setItem("screenId", newScreenId);
      showRegistration(newScreenId);
      return false;
    } else {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }
  } catch (error) {
    console.error("Error checking group assignment:", error);
    throw error;
  }
}

/**
 * Initialize screen registration process
 */
async function initializeScreen() {
  if (!apiKey) {
    showError(gettext("API key is required."));
    return;
  }

  try {
    // First, try to get existing screen data
    let screenId = localStorage.getItem("screenId");

    if (screenId) {
      // Check if this screen still exists and is valid
      const isAssigned = await checkForGroupAssignment(screenId);
      if (!isAssigned) {
        showRegistration(screenId);
      }
    } else {
      // No screen ID in localStorage, create a new screen
      screenId = await createScreen();
      localStorage.setItem("screenId", screenId);
      showRegistration(screenId);
    }

    // Start polling for group assignment
    const pollInterval = setInterval(async () => {
      try {
        const currentScreenId = localStorage.getItem("screenId");
        if (currentScreenId) {
          const isAssigned = await checkForGroupAssignment(currentScreenId);
          if (isAssigned) {
            clearInterval(pollInterval);
          }
        }
      } catch (error) {
        console.error("Error during polling:", error);
        // Continue polling despite errors
      }
    }, 1000); // Poll every second
  } catch (error) {
    console.error("Error initializing screen:", error);
    showError(
      gettext(
        "Failed to initialize screen registration. Please check your API key and try again.",
      ),
    );
  }
}

// Start the initialization process when the page loads
document.addEventListener("DOMContentLoaded", initializeScreen);
