// SPDX-FileCopyrightText: 2025 Magenta ApS <https://magenta.dk>
// SPDX-License-Identifier: AGPL-3.0-only
import { getPoiTypeByName } from "./poiTypes.js";

export default class WayfindingRenderer {
  constructor({
    mapContainer,
    pointsContainer,
    svgOverlay,
    overlayWrapper,
    mapImage,
    getState,
    onPointClick,
  }) {
    this.mapContainer = mapContainer;
    this.pointsContainer = pointsContainer;
    this.svgOverlay = svgOverlay;
    this.overlayWrapper = overlayWrapper;
    this.mapImage = mapImage;
    this.getState = getState; // function that returns { floors, points, paths, currentFloorId, currentDrawingPath, currentPathElement }
    this.onPointClick = onPointClick;
  }

  updateOverlayDimensions() {
    const containerWidth = this.mapContainer.offsetWidth;
    const containerHeight = this.mapContainer.offsetHeight;
    const imageNaturalWidth = this.mapImage.naturalWidth;
    const imageNaturalHeight = this.mapImage.naturalHeight;

    if (
      !containerWidth ||
      !containerHeight ||
      !imageNaturalWidth ||
      !imageNaturalHeight
    ) {
      return;
    }

    const containerRatio = containerWidth / containerHeight;
    const imageRatio = imageNaturalWidth / imageNaturalHeight;

    let overlayWidth, overlayHeight, overlayTop, overlayLeft;

    if (containerRatio > imageRatio) {
      overlayHeight = containerHeight;
      overlayWidth = containerHeight * imageRatio;
      overlayTop = 0;
      overlayLeft = (containerWidth - overlayWidth) / 2;
    } else {
      overlayWidth = containerWidth;
      overlayHeight = containerWidth / imageRatio;
      overlayLeft = 0;
      overlayTop = (containerHeight - overlayHeight) / 2;
    }

    this.overlayWrapper.style.width = `${overlayWidth}px`;
    this.overlayWrapper.style.height = `${overlayHeight}px`;
    this.overlayWrapper.style.top = `${overlayTop}px`;
    this.overlayWrapper.style.left = `${overlayLeft}px`;
    // ensure overlay sits above subtle backdrop but below UI chrome
    this.overlayWrapper.style.zIndex = "30";
  }

  createPointElement(pointData) {
    const point = document.createElement("div");
    const nameAbove = pointData.y > 50;
    point.className = `point ${pointData.type} ${nameAbove ? "name-above" : ""}`;
    point.style.left = `${pointData.x}%`;
    point.style.top = `${pointData.y}%`;
    point.dataset.id = pointData.id;

    const iconName = this.getIconName(pointData);
    const number =
      pointData.label && pointData.label.substring
        ? pointData.label.substring(1)
        : "";

    point.innerHTML = `
            <div class="point-content flex flex-col items-center justify-center">
                <div class="point-icon flex items-center justify-center gap-px">
                    <span style="font-size: 13px;">${number}</span>
                    <span class="material-symbols-outlined" style="font-size: 16px;">${iconName}</span>
                </div>
                <div class="point-name text-xs text-white font-semibold whitespace-nowrap" style="overflow: hidden; ">${pointData.name || ""}</div>
            </div>`;

    point.addEventListener("click", (e) => {
      e.stopPropagation();
      if (this.onPointClick) this.onPointClick(pointData, e);
    });

    // attach element reference back to point data for external code to use
    pointData.element = point;
    return point;
  }

  createPathElement(points) {
    const pathEl = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "polyline",
    );
    pathEl.setAttribute("class", "path-line");
    pathEl.setAttribute("points", points.map((p) => `${p.x},${p.y}`).join(" "));
    return pathEl;
  }

  getIconName(pointData) {
    // prefer explicit screen icon
    if (pointData.type === "screen") return "tv";
    // lookup POI type from configuration
    if (pointData.poiType) {
      const t = getPoiTypeByName(pointData.poiType);
      if (t && t.icon) return t.icon;
    }
    // fallback
    return "location_pin";
  }

  renderMapContent() {
    const {
      floors,
      points,
      paths,
      currentFloorId,
      currentDrawingPath,
      currentPathElement,
      activeFloorIds,
    } = this.getState();

    // Clear existing elements for the single-map overlay
    this.pointsContainer.innerHTML = "";
    this.svgOverlay.innerHTML = "";

    // locate wrapper so we can toggle multi-floor vs single-floor views
    const wrapper = document.getElementById("map-views-wrapper");

    // If activeFloorIds is provided and contains multiple floors, render side-by-side views
    if (Array.isArray(activeFloorIds) && activeFloorIds.length > 1) {
      this.renderMultiFloor({
        floors,
        points,
        paths,
        activeFloorIds,
        currentDrawingPath,
        currentPathElement,
      });
      return;
    }

    // Ensure any multi-floor container is removed and the original single map is visible again
    if (wrapper) {
      const multi = wrapper.querySelector(".multi-floor-container");
      if (multi) wrapper.removeChild(multi);
      const orig = wrapper.querySelector("#map-container");
      if (orig) orig.style.display = "";
    }

    const currentFloor = floors.find((f) => f.id === currentFloorId);
    if (!currentFloor) {
      this.mapImage.src =
        "https://placehold.co/1600x900/e0e7ff/4338ca?text=No+Floor+Selected";
      // clear title when no floor
      const titleEl = document.getElementById("map-title");
      if (titleEl) titleEl.textContent = "No floor selected";
      return;
    }
    // Ensure single-map title is visible in single-floor mode
    const titleEl = document.getElementById("map-title");
    if (titleEl) titleEl.style.display = "";

    this.mapImage.src = currentFloor.imageUrl;
    // add a gentle fade-in when an image is set
    this.mapImage.classList.add("map-image-loading");
    // remove loading class after the image paints
    this.mapImage.onload = () => {
      this.mapImage.classList.remove("map-image-loading");
      this.updateOverlayDimensions();
    };
    // set single-map title
    if (titleEl)
      titleEl.textContent = currentFloor.name || currentFloor.id || "";
    if (this.mapImage.complete) {
      this.updateOverlayDimensions();
    }

    // compute which paths are currently visible so we can mark the related points as active
    const visiblePaths = Array.isArray(paths)
      ? paths.filter((pa) => pa && pa.visible)
      : [];
    // update map-focused dimming state: add a class on wrapper when a path is visible
    const wrapperEl = document.getElementById("map-views-wrapper");
    if (wrapperEl) {
      if (visiblePaths.length) wrapperEl.classList.add("path-focused");
      else wrapperEl.classList.remove("path-focused");
    }
    points
      .filter((p) => p.floorId === currentFloorId)
      .forEach((pointData) => {
        const pointEl = this.createPointElement(pointData);
        // mark point as active if any visible path originates or ends at this point
        if (
          visiblePaths.length &&
          visiblePaths.some(
            (pa) => pa.fromId === pointData.id || pa.toId === pointData.id,
          )
        ) {
          pointEl.classList.add("active");
        }
        this.pointsContainer.appendChild(pointEl);
      });

    paths.forEach((pathData) => {
      if (!pathData.visible) return;
      pathData.segments.forEach((segment) => {
        if (segment.floorId === currentFloorId) {
          const pathEl = this.createPathElement(segment.points);
          this.svgOverlay.appendChild(pathEl);
        }
      });
    });

    // If there's a current drawing path, ensure preview is visible on current floor
    if (currentDrawingPath && currentPathElement) {
      const currentSegment = currentDrawingPath.segments.slice(-1)[0];
      if (currentSegment.floorId === currentFloorId) {
        this.svgOverlay.appendChild(currentPathElement);
      }
    }
  }

  // Render multiple floors side-by-side inside #map-views-wrapper
  renderMultiFloor({
    floors,
    points,
    paths,
    activeFloorIds,
    currentDrawingPath,
    currentPathElement,
  }) {
    // Find wrapper and prepare a multi-floor container while preserving the original map
    const wrapper = document.getElementById("map-views-wrapper");
    if (!wrapper) return;

    // Hide the single-map title while showing multi-floor views
    const titleEl = document.getElementById("map-title");
    if (titleEl) titleEl.style.display = "none";

    // Hide original single map if present
    const origMap = wrapper.querySelector("#map-container");
    if (origMap) origMap.style.display = "none";

    // update dimming class for multi-floor: if any visible path exists, enable focused mode
    const anyVisible = Array.isArray(paths)
      ? paths.some((p) => p && p.visible)
      : false;
    if (wrapper) {
      if (anyVisible) wrapper.classList.add("path-focused");
      else wrapper.classList.remove("path-focused");
    }

    // Create or clear a dedicated multi-floor container
    let multi = wrapper.querySelector(".multi-floor-container");
    if (!multi) {
      multi = document.createElement("div");
      multi.className = "multi-floor-container";
      wrapper.appendChild(multi);
    } else {
      multi.innerHTML = "";
    }

    multi.style.display = "flex";
    multi.style.flexDirection = "column";
    multi.style.justifyContent = "center";

    // Create flex container for the views
    const container = document.createElement("div");
    container.style.display = "flex";
    container.style.gap = "8px";
    container.style.alignItems = "stretch";
    container.style.height = "auto";
    multi.appendChild(container);

    // For each active floor, create a mini map view showing that floor image and overlay
    activeFloorIds.forEach((floorId) => {
      const floor = floors.find((f) => f.id === floorId);
      // create a panel that holds the title above the mini map view
      const panel = document.createElement("div");
      panel.style.display = "flex";
      panel.style.flexDirection = "column";
      panel.style.flex = "1";
      panel.style.minWidth = "260px";

      // create title label for this mini view (normal block above the image)
      const miniTitle = document.createElement("div");
      miniTitle.style.zIndex = "9998";
      miniTitle.style.background = "rgba(255,255,255,0.95)";
      miniTitle.style.padding = "6px";
      miniTitle.style.borderRadius = "6px";
      miniTitle.style.textAlign = "center";
      miniTitle.style.fontWeight = "600";
      miniTitle.style.pointerEvents = "none";
      miniTitle.style.marginBottom = "8px";
      miniTitle.textContent = floor ? floor.name || floor.id : "—";

      const view = document.createElement("div");
      view.style.position = "relative";
      view.style.height = "480px";
      view.style.border = "1px solid #e5e7eb";
      view.style.borderRadius = "6px";
      view.style.overflow = "hidden";
      // mark view with the floor id so callers can target it
      view.dataset.floorId = floorId;

      const img = document.createElement("img");
      img.src = floor
        ? floor.imageUrl
        : "https://placehold.co/800x450/e0e7ff/4338ca?text=No+Floor";
      img.style.width = "100%";
      img.style.height = "100%";
      // use contain so the image is fully visible and we can compute the visible image area
      img.style.objectFit = "contain";
      view.appendChild(img);

      // append title above the view so it doesn't overlap the image
      panel.appendChild(miniTitle);
      panel.appendChild(view);

      // Create an overlay wrapper sized to the visible image area (to match single-map behavior)
      const overlayWrapper = document.createElement("div");
      overlayWrapper.style.position = "absolute";
      overlayWrapper.style.left = "0px";
      overlayWrapper.style.top = "0px";
      overlayWrapper.style.width = "100%";
      overlayWrapper.style.height = "100%";
      overlayWrapper.style.pointerEvents = "none";

      // overlay container (will be resized to match visible image area)
      const overlay = document.createElement("div");
      overlay.style.position = "absolute";
      overlay.style.left = "0";
      overlay.style.top = "0";
      overlay.style.width = "100%";
      overlay.style.height = "100%";
      overlay.style.pointerEvents = "none";

      // points layer (positioned within overlayWrapper so percent coords map to the image)
      const pointsLayer = document.createElement("div");
      pointsLayer.style.position = "absolute";
      pointsLayer.style.left = "0";
      pointsLayer.style.top = "0";
      pointsLayer.style.width = "100%";
      pointsLayer.style.height = "100%";
      pointsLayer.style.pointerEvents = "auto";
      pointsLayer.className = "multi-points-layer";

      // append overlay and points into the overlay wrapper
      overlayWrapper.appendChild(overlay);
      overlayWrapper.appendChild(pointsLayer);
      view.appendChild(overlayWrapper);

      // draw points for this floor — keep references to recompute precise pixel positions
      const createdPointEls = [];
      // visible paths on this view: used to toggle .active on points
      const visiblePathsForView = Array.isArray(paths)
        ? paths.filter((pa) => pa && pa.visible)
        : [];
      points
        .filter((p) => p.floorId === floorId)
        .forEach((pointData) => {
          const el = this.createPointElement(pointData);
          el.style.position = "absolute";
          // temporarily place at 0, we'll set exact pixel positions in computeOverlayForView
          el.style.left = `0px`;
          el.style.top = `0px`;
          // mark as active if any visible path involves this point
          if (
            visiblePathsForView.length &&
            visiblePathsForView.some(
              (pa) => pa.fromId === pointData.id || pa.toId === pointData.id,
            )
          ) {
            el.classList.add("active");
          }
          pointsLayer.appendChild(el);
          createdPointEls.push({ el, pointData });
        });

      // draw paths segments for this floor
      const svgNS = "http://www.w3.org/2000/svg";
      const svg = document.createElementNS(svgNS, "svg");
      svg.setAttribute("viewBox", "0 0 100 100");
      svg.setAttribute("preserveAspectRatio", "none");
      svg.style.position = "absolute";
      svg.style.left = "0";
      svg.style.top = "0";
      svg.style.width = "100%";
      svg.style.height = "100%";
      svg.style.pointerEvents = "none";

      paths.forEach((pathData) => {
        if (!pathData.visible) return;
        pathData.segments.forEach((segment) => {
          if (segment.floorId === floorId) {
            const poly = this.createPathElement(segment.points);
            svg.appendChild(poly);
          }
        });
      });

      // drawing preview
      if (currentDrawingPath && currentPathElement) {
        const seg = currentDrawingPath.segments.slice(-1)[0];
        if (seg && seg.floorId === floorId) {
          svg.appendChild(currentPathElement.cloneNode(true));
        }
      }

      // append svg into the overlayWrapper so it aligns with the visible image area
      overlayWrapper.appendChild(svg);
      // add the composed panel (title + view) to the container
      // ensure overlayWrapper matches the visible image area by computing dimensions
      const computeOverlayForView = () => {
        const containerWidth = view.clientWidth;
        const containerHeight = view.clientHeight;
        const imageNaturalWidth = img.naturalWidth;
        const imageNaturalHeight = img.naturalHeight;

        if (
          !containerWidth ||
          !containerHeight ||
          !imageNaturalWidth ||
          !imageNaturalHeight
        ) {
          // fallback: make overlayWrapper fill the view
          overlayWrapper.style.left = "0px";
          overlayWrapper.style.top = "0px";
          overlayWrapper.style.width = "100%";
          overlayWrapper.style.height = "100%";
          return;
        }

        const containerRatio = containerWidth / containerHeight;
        const imageRatio = imageNaturalWidth / imageNaturalHeight;

        let overlayWidth, overlayHeight, overlayTop, overlayLeft;

        if (containerRatio > imageRatio) {
          overlayHeight = containerHeight;
          overlayWidth = containerHeight * imageRatio;
          overlayTop = 0;
          overlayLeft = (containerWidth - overlayWidth) / 2;
        } else {
          overlayWidth = containerWidth;
          overlayHeight = containerWidth / imageRatio;
          overlayLeft = 0;
          overlayTop = (containerHeight - overlayHeight) / 2;
        }

        overlayWrapper.style.width = `${overlayWidth}px`;
        overlayWrapper.style.height = `${overlayHeight}px`;
        overlayWrapper.style.top = `${overlayTop}px`;
        overlayWrapper.style.left = `${overlayLeft}px`;

        // position each created point precisely inside the overlay area using pixel coords
        createdPointEls.forEach(({ el, pointData }) => {
          const px = (overlayWidth * (Number(pointData.x) || 0)) / 100;
          const py = (overlayHeight * (Number(pointData.y) || 0)) / 100;
          el.style.left = `${px}px`;
          el.style.top = `${py}px`;
        });
      };

      img.addEventListener("load", computeOverlayForView);
      // compute immediately in case image is already loaded
      computeOverlayForView();

      // recompute on resize to stay in sync
      window.addEventListener("resize", computeOverlayForView);

      container.appendChild(panel);
    });
  }
}
