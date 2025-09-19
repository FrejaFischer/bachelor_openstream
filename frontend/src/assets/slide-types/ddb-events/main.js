// SPDX-FileCopyrightText: 2025 Magenta ApS <https://magenta.dk>
// SPDX-License-Identifier: AGPL-3.0-only
import "./style.scss";
import { BASE_URL } from "../../utils/constants";
import { queryParams } from "../../utils/utils";

// Parse config from query parameters
const config = {
  kommune: queryParams.kommune || "",
  library: queryParams.library || "",
  days: queryParams.days || "7",
  layout: queryParams.layout || "vertical",
  showSubtitle: queryParams.showSubtitle === "true",
  showDescription: queryParams.showDescription === "true",
  showQr: queryParams.showQr === "true",
  slideDuration: parseInt(queryParams.slideDuration) || 10,
};

document
  .getElementById("eventsCarousel")
  .setAttribute("data-bs-interval", config.slideDuration * 1000);

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

// Fetch events based on config
async function fetchEvents() {
  try {
    const response = await fetch(
      `${baseUrl}/api/ddb/events?kommune=${config.kommune}&branches=${config.library}&days=${config.days}`,
      { method: "GET", headers },
    );

    if (!response.ok) {
      console.error(
        "Failed to fetch events:",
        response.status,
        response.statusText,
      );
      return;
    }

    const data = await response.json();
    displayEventsInCarousel(data);
  } catch (error) {
    console.error("Error fetching events:", error);
  }
}

function displayEventsInCarousel(events) {
  const carouselInner = document.getElementById("carouselInner");
  carouselInner.innerHTML = "";

  if (events.length === 0) {
    carouselInner.innerHTML = `
      <div class="carousel-item active">
        <div class="d-flex justify-content-center align-items-center" style="height: 100vh; color:#333;">
          No events found
        </div>
      </div>`;
    return;
  }

  events.forEach((event, index) => {
    const isActive = index === 0 ? "active" : "";
    const imageUrl = event.image?.url || "https://via.placeholder.com/800x400";
    const title = event.title || "Untitled Event";
    const subtitle = event.subtitle || "";
    const description = config.showSubtitle ? subtitle : "";
    const startDate = new Date(event.date_time?.start);
    const endDate = new Date(event.date_time?.end);

    const dateOptions = {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    };

    const formattedStart = startDate.toLocaleString("da-DK", dateOptions);
    const formattedEnd = endDate.toLocaleString("da-DK", dateOptions);
    const dateInfo = `${formattedStart}`;

    const branches = event.branches?.join(", ") || "";
    const address = event.address
      ? `${event.address.street}, ${event.address.zip_code} ${event.address.city}`
      : "";
    const body = config.showDescription ? event.body : "";

    const qrValue = event.url || "";

    let carouselItemMarkup = "";

    if (config.layout === "vertical") {
      carouselItemMarkup = `
        <div class="carousel-item vertical ${isActive}">
          <div class="col-12 col-image">
            <img src="${imageUrl}" alt="${title}" class="p-1" style="object-fit: contain; height: 100%; width: 100%;">
          </div>
          <div class="vertical-layout-bottom">
            <div class="vertical-layout-text">
              <div class="event-title">${title}</div>
              <div class="event-description">${description}</div>
              <div class="event-date">${dateInfo}</div>
              <div class="event-location">${branches} | ${address}</div>
              <div class="event-address"></div>
              <div class="event-body">${body}</div>
            </div>
            ${config.showQr ? `<div class="vertical-layout-qr"><div id="qrcode-${index}"></div></div>` : ``}
          </div>
        </div>
      `;
    } else {
      carouselItemMarkup = `
        <div class="carousel-item ${isActive}">
          <div class="row g-0">
            <div class="col-6 col-image" style="height: 100vh;">
              <img src="${imageUrl}" alt="${title}">
            </div>
            <div class="col-6 col-info">
              <div class="event-title">${title}</div>
              <div class="event-description">${description}</div>
              <div class="event-date">${dateInfo}</div>
              <div class="event-location">${branches} | ${address}</div>
              ${config.showQr ? `<div class="event-qr"><div id="qrcode-${index}"></div></div>` : ``}
              <div class="event-body">${body}</div>
            </div>
          </div>
        </div>
      `;
    }

    carouselInner.insertAdjacentHTML("beforeend", carouselItemMarkup);

    if (config.showQr && qrValue) {
      setTimeout(() => {
        const qrContainer = document.getElementById(`qrcode-${index}`);
        if (qrContainer) {
          new QRCode(qrContainer, {
            text: qrValue,
            width: 200,
            height: 200,
          });
        }
      }, 0);
    }
  });
}

// Initialize the slide when DOM is loaded
document.addEventListener("DOMContentLoaded", function () {
  fetchEvents();
});
