// SPDX-FileCopyrightText: 2025 Magenta ApS <https://magenta.dk>
// SPDX-License-Identifier: AGPL-3.0-only
export function parseAndValidate(jsonText) {
  if (!jsonText || typeof jsonText !== "string")
    throw new Error("No JSON provided");
  let data;
  try {
    data = JSON.parse(jsonText);
  } catch (e) {
    throw new Error("Invalid JSON format");
  }

  // basic shape validation
  if (
    !Array.isArray(data.floors) ||
    !Array.isArray(data.points) ||
    !Array.isArray(data.paths)
  ) {
    throw new Error(
      "Invalid data format: expected floors, points and paths arrays",
    );
  }

  // Normalize counters if missing
  data.counters = data.counters || {};
  data.counters.pathCounter = data.counters.pathCounter || 1;
  data.counters.floorCounter = data.counters.floorCounter || 1;

  return data;
}

export function exportState({
  floors,
  points,
  paths,
  currentFloorId,
  pathCounter,
  floorCounter,
}) {
  return JSON.stringify(
    {
      floors: floors || [],
      points: points || [],
      paths: paths || [],
      currentFloorId: currentFloorId || (floors && floors[0]?.id) || null,
      counters: {
        pathCounter: pathCounter || 1,
        floorCounter: floorCounter || 1,
      },
    },
    null,
    2,
  );
}
