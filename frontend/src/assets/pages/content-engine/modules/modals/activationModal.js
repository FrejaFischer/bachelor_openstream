// SPDX-FileCopyrightText: 2025 Magenta ApS <https://magenta.dk>
// SPDX-License-Identifier: AGPL-3.0-only
import { store } from "../core/slideStore.js";
import { updateSlideSelector } from "../core/slideSelector.js";
import * as bootstrap from "bootstrap";

const activationModalElement = document.getElementById("slideActivationModal");

// Only initialize if the modal element exists
if (!activationModalElement) {
  console.warn("Slide activation modal not found - skipping initialization");
}

const activationModal = activationModalElement
  ? new bootstrap.Modal(activationModalElement)
  : null;

const enabledSwitch = document.getElementById("activationEnabledSwitch");
const dateFieldsDiv = document.getElementById("activationDateFields");
const activationDateInput = document.getElementById("activationDateInput");
const deactivationDateInput = document.getElementById("deactivationDateInput");
const saveButton = document.getElementById("saveActivationSettingsBtn");
const slideIndexInput = document.getElementById("activationModalSlideIndex");

// New elements for recurring activation
const oneTimeActivationRadio = document.getElementById("oneTimeActivation");
const recurringActivationRadio = document.getElementById("recurringActivation");
const oneTimeFields = document.getElementById("oneTimeFields");
const recurringFields = document.getElementById("recurringFields");
const intervalsListDiv = document.getElementById("intervalsList");
const addIntervalBtn = document.getElementById("addIntervalBtn");
const newIntervalDay = document.getElementById("newIntervalDay");
const newIntervalStartTime = document.getElementById("newIntervalStartTime");
const newIntervalEndTime = document.getElementById("newIntervalEndTime");

let intervalCounter = 0;

// Day names for display
const dayNames = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

// Function to create an interval element (without day name since it will be grouped)
function createIntervalElement(day, startTime, endTime) {
  intervalCounter++;
  const intervalId = `interval_${intervalCounter}`;

  const intervalDiv = document.createElement("div");
  intervalDiv.className =
    "interval-item d-flex justify-content-between align-items-center border rounded bg-white";
  intervalDiv.dataset.intervalId = intervalId;
  intervalDiv.dataset.day = day;
  intervalDiv.dataset.startTime = startTime;
  intervalDiv.dataset.endTime = endTime;

  const displayText = `${startTime} - ${endTime}`;

  intervalDiv.innerHTML = `
    <span class="interval-text">${displayText}</span>
    <button type="button" class="remove-interval" title="Remove interval">
      <span class="material-symbols-outlined" style="font-size: 14px;">close</span>
    </button>
  `;

  // Add event listener for remove button
  const removeBtn = intervalDiv.querySelector(".remove-interval");
  removeBtn.addEventListener("click", () => {
    intervalDiv.remove();
    organizeIntervalsByDay();
  });

  return intervalDiv;
}

// Function to create a day section with header and intervals
function createDaySection(day, intervals) {
  const dayName = dayNames[day];
  const sectionDiv = document.createElement("div");
  sectionDiv.className = "day-section d-flex align-items-start";
  sectionDiv.dataset.day = day;

  sectionDiv.innerHTML = `
    <div class="day-header">${dayName}</div>
    <div class="day-intervals"></div>
  `;

  // Add intervals to this day section
  const intervalsContainer = sectionDiv.querySelector(".day-intervals");
  intervals.forEach((interval) => {
    intervalsContainer.appendChild(interval);
  });

  return sectionDiv;
}

// Function to add a new interval
function addInterval(day, startTime, endTime) {
  const intervalElement = createIntervalElement(day, startTime, endTime);
  intervalsListDiv.appendChild(intervalElement);
  organizeIntervalsByDay();
}

// Function to organize intervals by day with left-aligned day headers
function organizeIntervalsByDay() {
  const intervals = Array.from(
    intervalsListDiv.querySelectorAll(".interval-item"),
  );

  if (intervals.length === 0) {
    intervalsListDiv.innerHTML = "";
    return;
  }

  // Group intervals by day
  const intervalsByDay = {};
  intervals.forEach((interval) => {
    const day = parseInt(interval.dataset.day);
    if (!intervalsByDay[day]) {
      intervalsByDay[day] = [];
    }
    intervalsByDay[day].push(interval);
  });

  // Sort intervals within each day by start time
  Object.keys(intervalsByDay).forEach((day) => {
    intervalsByDay[day].sort((a, b) => {
      return a.dataset.startTime.localeCompare(b.dataset.startTime);
    });
  });

  // Clear the container
  intervalsListDiv.innerHTML = "";

  // Add organized content with day sections
  const sortedDays = Object.keys(intervalsByDay)
    .map((d) => parseInt(d))
    .sort((a, b) => {
      // Monday=1, Sunday=0, so Sunday should come last
      const adjustedA = a === 0 ? 7 : a;
      const adjustedB = b === 0 ? 7 : b;
      return adjustedA - adjustedB;
    });

  sortedDays.forEach((day) => {
    const daySection = createDaySection(day, intervalsByDay[day]);
    intervalsListDiv.appendChild(daySection);
  });
}

// Function to clear all intervals
function clearIntervals() {
  intervalsListDiv.innerHTML = "";
  intervalCounter = 0;
}

// Function to get all intervals data
function getIntervals() {
  const intervals = [];
  const intervalElements = intervalsListDiv.querySelectorAll(".interval-item");

  intervalElements.forEach((element) => {
    intervals.push({
      day: parseInt(element.dataset.day),
      startTime: element.dataset.startTime,
      endTime: element.dataset.endTime,
    });
  });

  return intervals;
}

// Function to open the modal for a specific slide
export function openActivationModal(slideIndex) {
  // Check if modal elements exist
  if (!activationModal || !slideIndexInput) {
    console.warn("Activation modal elements not available");
    return;
  }

  const slide = store.slides[slideIndex];
  if (!slide) return;

  slideIndexInput.value = slideIndex; // Store the index

  // Set initial state from slide data
  enabledSwitch.checked = slide.activationEnabled || false;

  // Check if this slide has recurring activation data
  const hasRecurringData =
    slide.recurringActivation && slide.recurringActivation.enabled;

  if (hasRecurringData) {
    // Set to recurring mode
    recurringActivationRadio.checked = true;
    oneTimeActivationRadio.checked = false;
    oneTimeFields.style.display = "none";
    recurringFields.style.display = "block";

    // Load recurring data
    const recurring = slide.recurringActivation;

    // Clear and populate intervals
    clearIntervals();
    if (recurring.intervals && recurring.intervals.length > 0) {
      recurring.intervals.forEach((interval) => {
        addInterval(interval.day, interval.startTime, interval.endTime);
      });
    }
  } else {
    // Set to one-time mode
    oneTimeActivationRadio.checked = true;
    recurringActivationRadio.checked = false;
    oneTimeFields.style.display = "block";
    recurringFields.style.display = "none";

    // Load one-time data
    activationDateInput.value = slide.activationDate || "";
    deactivationDateInput.value = slide.deactivationDate || "";
  }

  // Show/hide date fields based on switch
  dateFieldsDiv.style.display = enabledSwitch.checked ? "block" : "none";

  activationModal.show();
}

// Add this init function if you create it as a separate module
export function initActivationModal() {
  // Only initialize if all required elements exist
  if (!activationModalElement || !enabledSwitch || !saveButton) {
    console.warn(
      "Activation modal elements not found - skipping event listener setup",
    );
    return;
  }

  // Event listener for the toggle switch
  enabledSwitch.addEventListener("change", () => {
    if (dateFieldsDiv) {
      dateFieldsDiv.style.display = enabledSwitch.checked ? "block" : "none";
    }
  });

  // Event listeners for activation type radio buttons
  if (oneTimeActivationRadio) {
    oneTimeActivationRadio.addEventListener("change", () => {
      if (oneTimeActivationRadio.checked && oneTimeFields && recurringFields) {
        oneTimeFields.style.display = "block";
        recurringFields.style.display = "none";
      }
    });
  }

  if (recurringActivationRadio) {
    recurringActivationRadio.addEventListener("change", () => {
      if (
        recurringActivationRadio.checked &&
        oneTimeFields &&
        recurringFields
      ) {
        oneTimeFields.style.display = "none";
        recurringFields.style.display = "block";
      }
    });
  }

  // Event listener for add interval button
  if (addIntervalBtn) {
    addIntervalBtn.addEventListener("click", () => {
      if (!newIntervalDay || !newIntervalStartTime || !newIntervalEndTime)
        return;

      const day = parseInt(newIntervalDay.value);
      const startTime = newIntervalStartTime.value;
      const endTime = newIntervalEndTime.value;

      // Validate inputs
      if (!startTime || !endTime) {
        alert("Please select both start and end times.");
        return;
      }

      if (startTime >= endTime) {
        alert("End time must be after start time.");
        return;
      }

      // Add the interval
      addInterval(day, startTime, endTime);

      // Clear inputs
      newIntervalStartTime.value = "";
      newIntervalEndTime.value = "";
    });
  }

  // Event listener for the save button
  saveButton.addEventListener("click", () => {
    if (!slideIndexInput) return;

    const slideIndex = parseInt(slideIndexInput.value, 10);
    if (isNaN(slideIndex) || !store.slides[slideIndex]) return;

    const slide = store.slides[slideIndex];

    // --- Optional: Add to Undo Stack ---
    // pushCurrentSlideState(); // Uncomment if you have initUndoRedo and want this action undoable
    // ---------------------------------

    slide.activationEnabled = enabledSwitch.checked;

    if (recurringActivationRadio && recurringActivationRadio.checked) {
      // Handle recurring activation
      const intervals = getIntervals();

      // Validate that at least one interval is defined
      if (intervals.length === 0) {
        alert("Please add at least one weekly interval.");
        return;
      }

      slide.recurringActivation = {
        enabled: true,
        intervals: intervals,
      };

      // Clear one-time activation data
      slide.activationDate = null;
      slide.deactivationDate = null;
    } else {
      // Handle one-time activation
      slide.activationDate =
        (activationDateInput && activationDateInput.value) || null;
      slide.deactivationDate =
        (deactivationDateInput && deactivationDateInput.value) || null;

      // Convert dates to ensure consistency if needed, e.g., ensure they are just dates, not datetime
      if (slide.activationDate) {
        slide.activationDate = slide.activationDate.split("T")[0];
      }
      if (slide.deactivationDate) {
        slide.deactivationDate = slide.deactivationDate.split("T")[0];
      }

      // Clear recurring activation data
      slide.recurringActivation = {
        enabled: false,
        intervals: [],
      };
    }

    updateSlideSelector(); // Refresh the slide list UI
    if (activationModal) {
      activationModal.hide();
    }
  });
}

// Utility function to check if a slide should be active based on recurring settings
export function isSlideActiveNow(slide) {
  if (!slide.activationEnabled) return true;

  const now = new Date();
  const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
  const currentTime =
    now.getHours().toString().padStart(2, "0") +
    ":" +
    now.getMinutes().toString().padStart(2, "0");
  const currentDateString = now.toISOString().split("T")[0];

  if (slide.recurringActivation && slide.recurringActivation.enabled) {
    // Check recurring activation
    const recurring = slide.recurringActivation;

    // Check if any intervals match the current day and time
    if (!recurring.intervals || recurring.intervals.length === 0) return false;

    for (const interval of recurring.intervals) {
      if (
        interval.day === currentDay &&
        currentTime >= interval.startTime &&
        currentTime <= interval.endTime
      ) {
        return true;
      }
    }

    return false;
  } else {
    // Check one-time activation
    if (slide.activationDate && currentDateString < slide.activationDate)
      return false;
    if (slide.deactivationDate && currentDateString > slide.deactivationDate)
      return false;

    return true;
  }
}

// Utility function to get a human-readable description of activation schedule
export function getActivationScheduleDescription(slide) {
  if (!slide.activationEnabled) return "Always active";

  if (slide.recurringActivation && slide.recurringActivation.enabled) {
    const recurring = slide.recurringActivation;

    if (!recurring.intervals || recurring.intervals.length === 0) {
      return "Recurring (no intervals defined)";
    }

    const dayNames = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ];
    const intervalDescriptions = recurring.intervals.map((interval) => {
      const dayName = dayNames[interval.day];
      return `${dayName} ${interval.startTime}-${interval.endTime}`;
    });

    return `Active: ${intervalDescriptions.join(", ")}`;
  } else {
    let description = "Active";
    if (slide.activationDate || slide.deactivationDate) {
      description += ` from ${slide.activationDate || "start"} to ${slide.deactivationDate || "end"}`;
    }
    return description;
  }
}
