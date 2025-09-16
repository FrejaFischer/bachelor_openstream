// SPDX-FileCopyrightText: 2025 Magenta ApS <https://magenta.dk>
// SPDX-License-Identifier: AGPL-3.0-only
import "./style.scss";
import { BASE_URL } from "../../utils/constants";
import { queryParams } from "../../utils/utils";

// Parse config from query parameters
const config = {
  location: queryParams.location || "",
  sub_locations: queryParams.sub_locations
    ? queryParams.sub_locations.split(",")
    : [],
};

const baseUrl = queryParams.baseUrl || BASE_URL;

// Authentication setup
const token = localStorage.getItem("accessToken");
const apiKey = localStorage.getItem("apiKey");

const headers = { "Content-Type": "application/json" };
if (apiKey) {
  headers["X-API-KEY"] = apiKey;
} else if (token) {
  headers["Authorization"] = `Bearer ${token}`;
}

let locationData = {};
let currentPageIndex = 0;
let totalPages = 0;
let bookingPages = [];

// Fetch location data and bookings
async function initializeSlide() {
  try {
    // Fetch location data to get location name
    await fetchLocationData();

    // Fetch and display bookings
    await fetchAndDisplayBookings();

    // Start time updates
    updateCurrentTime();
    setInterval(updateCurrentTime, 60000); // Update every minute

    // Start page rotation if multiple pages
    if (totalPages > 1) {
      setInterval(rotatePage, 15000); // Rotate every 15 seconds
    }
  } catch (error) {
    console.error("Error initializing slide:", error);
    displayError("Failed to load booking data");
  }
}

async function fetchLocationData() {
  try {
    const response = await fetch(`${baseUrl}/api/winkas/locations`, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch location data: ${response.statusText}`);
    }

    locationData = await response.json();

    // Update location title
    const locationTitle = document.getElementById("location-title");
    if (locationTitle && locationData[config.location]) {
      locationTitle.textContent = locationData[config.location].location_name;
    }
  } catch (error) {
    console.error("Error fetching location data:", error);
    throw error;
  }
}

async function fetchAndDisplayBookings() {
  try {
    const subLocationsParam = config.sub_locations.join(",");
    const response = await fetch(
      `${baseUrl}/api/winkas/bookings?location=${config.location}&sub_locations=${subLocationsParam}`,
      { method: "GET", headers },
    );

    if (!response.ok) {
      console.error(
        "Failed to fetch bookings:",
        response.status,
        response.statusText,
      );
      displayError("Failed to fetch booking data");
      return;
    }

    const data = await response.json();
    displayBookingsInCarousel(data);
  } catch (error) {
    console.error("Error fetching bookings:", error);
    displayError("Error loading bookings");
  }
}

function displayBookingsInCarousel(data) {
  const carousel = document.getElementById("booking-carousel");
  if (!carousel) return;

  carousel.innerHTML = "";

  if (!data.bookings || data.bookings.length === 0) {
    carousel.innerHTML = `
      <div class="booking-page">
        <div class="no-bookings-message">
          <span class="material-symbols-outlined">event_busy</span>
          <h3>No bookings scheduled</h3>
          <p>There are currently no bookings for the selected locations.</p>
        </div>
      </div>
    `;
    totalPages = 1;
    return;
  }

  // Group bookings by pages (max 6 per page)
  const bookingsPerPage = 6;
  bookingPages = [];

  for (let i = 0; i < data.bookings.length; i += bookingsPerPage) {
    bookingPages.push(data.bookings.slice(i, i + bookingsPerPage));
  }

  totalPages = bookingPages.length;

  // Create carousel pages
  bookingPages.forEach((pageBookings, pageIndex) => {
    const pageElement = document.createElement("div");
    pageElement.className = "booking-page";
    if (pageIndex !== 0) pageElement.style.display = "none";

    pageBookings.forEach((booking) => {
      const bookingElement = createBookingElement(booking);
      pageElement.appendChild(bookingElement);
    });

    carousel.appendChild(pageElement);
  });

  currentPageIndex = 0;
}

function createBookingElement(booking) {
  const bookingData = booking.booking_data;
  const locationName = booking.location_name;

  // Format time
  const startTime = new Date(bookingData.start);
  const endTime = new Date(bookingData.stop);

  const timeFormatter = new Intl.DateTimeFormat("da-DK", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const dateFormatter = new Intl.DateTimeFormat("da-DK", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

  const startTimeStr = timeFormatter.format(startTime);
  const endTimeStr = timeFormatter.format(endTime);
  const dateStr = dateFormatter.format(startTime);

  // Determine status
  const now = new Date();
  let statusClass = "upcoming";
  let statusText = "Upcoming";

  if (now >= startTime && now <= endTime) {
    statusClass = "ongoing";
    statusText = "Ongoing";
  } else if (now > endTime) {
    statusClass = "completed";
    statusText = "Completed";
  }

  const bookingElement = document.createElement("div");
  bookingElement.className = `booking-entry ${statusClass}`;

  bookingElement.innerHTML = `
    <div class="booking-header">
      <div class="booking-subject">${bookingData.subject || "Untitled Booking"}</div>
      <div class="booking-status ${statusClass}">${statusText}</div>
    </div>
    <div class="booking-details">
      <div class="booking-time">
        <span class="material-symbols-outlined">schedule</span>
        <span>${startTimeStr} - ${endTimeStr}</span>
      </div>
      <div class="booking-date">
        <span class="material-symbols-outlined">calendar_today</span>
        <span>${dateStr}</span>
      </div>
      <div class="booking-location">
        <span class="material-symbols-outlined">location_on</span>
        <span>${locationName}</span>
      </div>
      ${
        bookingData.booked_by
          ? `
        <div class="booking-owner">
          <span class="material-symbols-outlined">person</span>
          <span>${bookingData.booked_by}</span>
        </div>
      `
          : ""
      }
    </div>
  `;

  return bookingElement;
}

function rotatePage() {
  if (totalPages <= 1) return;

  const currentPage = document.querySelector(
    '.booking-page:not([style*="display: none"])',
  );
  if (currentPage) {
    currentPage.style.display = "none";
  }

  currentPageIndex = (currentPageIndex + 1) % totalPages;

  const nextPage = document.querySelectorAll(".booking-page")[currentPageIndex];
  if (nextPage) {
    nextPage.style.display = "flex";
  }
}

function updateCurrentTime() {
  const timeElement = document.getElementById("current-time");
  if (!timeElement) return;

  const now = new Date();
  const timeFormatter = new Intl.DateTimeFormat("da-DK", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const dateFormatter = new Intl.DateTimeFormat("da-DK", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  timeElement.innerHTML = `
    <div class="current-time">${timeFormatter.format(now)}</div>
    <div class="current-date">${dateFormatter.format(now)}</div>
  `;
}

function displayError(message) {
  const carousel = document.getElementById("booking-carousel");
  if (!carousel) return;

  carousel.innerHTML = `
    <div class="booking-page">
      <div class="error-message">
        <span class="material-symbols-outlined">error</span>
        <h3>Error</h3>
        <p>${message}</p>
      </div>
    </div>
  `;
}

// Initialize the slide when DOM is loaded
document.addEventListener("DOMContentLoaded", function () {
  initializeSlide();
});
