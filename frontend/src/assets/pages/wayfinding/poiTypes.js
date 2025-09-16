// SPDX-FileCopyrightText: 2025 Magenta ApS <https://magenta.dk>
// SPDX-License-Identifier: AGPL-3.0-only
// POI types used by the wayfinding editor/renderer
// Each entry: { name, icon, canChangeFloor }
// Icons based on material symbols
export const POI_TYPES = [
  { name: "Normal", icon: "location_pin", canChangeFloor: false },
  { name: "Stairs", icon: "stairs", canChangeFloor: true },
  { name: "Escalator", icon: "escalator", canChangeFloor: true },
  { name: "Elevator", icon: "elevator", canChangeFloor: true },
  { name: "Ramp", icon: "accessible_forward", canChangeFloor: true },
  { name: "Toilet", icon: "wc", canChangeFloor: false },
  { name: "Accessible Toilet", icon: "accessible", canChangeFloor: false },
  { name: "Baby Lounge", icon: "child_friendly", canChangeFloor: false },
  { name: "First Aid", icon: "medical_services", canChangeFloor: false },
  { name: "Information", icon: "info", canChangeFloor: false },
  { name: "Ticket Office", icon: "confirmation_number", canChangeFloor: false },
  { name: "Entrance/Exit", icon: "exit_to_app", canChangeFloor: true },
  { name: "Security", icon: "security", canChangeFloor: false },
  { name: "Baggage", icon: "work", canChangeFloor: false },
  { name: "Shop", icon: "store", canChangeFloor: false },
  { name: "Restaurant", icon: "restaurant", canChangeFloor: false },
  { name: "Cafe", icon: "local_cafe", canChangeFloor: false },
  { name: "ATM", icon: "local_atm", canChangeFloor: false },
  { name: "Parking", icon: "local_parking", canChangeFloor: false },
  { name: "Bus Stop", icon: "directions_bus", canChangeFloor: false },
  { name: "Taxi", icon: "local_taxi", canChangeFloor: false },
  { name: "Charging Station", icon: "ev_station", canChangeFloor: false },
  { name: "Cinema Hall", icon: "local_activity", canChangeFloor: false },
];

export function getPoiTypeByName(name) {
  return POI_TYPES.find((t) => t.name === name) || null;
}

export default POI_TYPES;
