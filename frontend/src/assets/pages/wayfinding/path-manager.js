// SPDX-FileCopyrightText: 2025 Magenta ApS <https://magenta.dk>
// SPDX-License-Identifier: AGPL-3.0-only
export function hideAllPaths(paths) {
  if (!Array.isArray(paths)) return;
  paths.forEach((p) => {
    p.visible = false;
  });
}

export function setPathVisibility(paths, pathId, visible) {
  if (!Array.isArray(paths)) return;
  const path = paths.find((p) => p.id === pathId);
  if (path) path.visible = !!visible;
}

export function togglePath(paths, pathId) {
  if (!Array.isArray(paths)) return false;
  const path = paths.find((p) => p.id === pathId);
  if (!path) return false;
  path.visible = !path.visible;
  return path.visible;
}

export function showOnlyPath(paths, pathId) {
  hideAllPaths(paths);
  setPathVisibility(paths, pathId, true);
}
