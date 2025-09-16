// SPDX-FileCopyrightText: 2025 Magenta ApS <https://magenta.dk>
// SPDX-License-Identifier: AGPL-3.0-only
import { queryParams } from "../../utils/utils";

// Parse config from query parameters
const config = {
  color: queryParams.color || "white",
  size: parseInt(queryParams.size) || 100,
};

document.addEventListener("DOMContentLoaded", function () {
  const clockElement = document.getElementById("clock");

  // Set style based on config
  if (clockElement) {
    clockElement.style.color = config.color;
  }

  function updateClock() {
    if (!clockElement) return;

    const now = new Date();
    let hours = now.getHours();
    let minutes = now.getMinutes();
    let seconds = now.getSeconds();

    hours = hours < 10 ? "0" + hours : hours;
    minutes = minutes < 10 ? "0" + minutes : minutes;
    seconds = seconds < 10 ? "0" + seconds : seconds;

    clockElement.textContent = `${hours}:${minutes}:${seconds}`;
  }

  // Start the clock
  updateClock(); // Initial call to display clock immediately
  setInterval(updateClock, 1000);
});
