// SPDX-FileCopyrightText: 2025 Magenta ApS <https://magenta.dk>
// SPDX-License-Identifier: AGPL-3.0-only
// Prefer runtime-injected config (window.__RUNTIME_CONFIG__) when available.
// This allows setting API endpoints at container start (runtime) instead of build-time.
const runtimeBase =
  (typeof window !== "undefined" && window.__RUNTIME_CONFIG__ && window.__RUNTIME_CONFIG__.VITE_BASE_URL) ||
  null;

export const BASE_URL = runtimeBase || import.meta.env.VITE_BASE_URL || "http://localhost:8000";
