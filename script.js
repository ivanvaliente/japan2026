const itineraryData = window.ITINERARY_DATA;
if (!itineraryData) {
  throw new Error("Missing itinerary data. Ensure itinerary-data.js loads before script.js.");
}

const ICONS = {
  flight: "\u2708",
  lodging: "\u2302",
  cruise: "\u2693",
  port: "\u25cc",
  notes: "\u270e",
};

const SEGMENT_RANGES = [
  { start: "2026-06-11", end: "2026-06-13", title: "Outbound flights", summary: itineraryData.timeline[0].summary },
  { start: "2026-06-13", end: "2026-06-18", title: "Shibuya stay", summary: itineraryData.timeline[1].summary },
  { start: "2026-06-19", end: "2026-07-01", title: "Celebrity Millennium cruise", summary: itineraryData.timeline[2].summary },
  { start: "2026-07-01", end: "2026-07-02", title: "Return flights", summary: itineraryData.timeline[3].summary },
];

const state = {
  allExpanded: false,
  cruiseMap: null,
  mapMarkers: [],
};

function optimizeTimelineImageUrl(url, width = 1280) {
  try {
    const parsed = new URL(url);
    const isWikimediaFilePath =
      parsed.hostname.includes("wikimedia.org") &&
      parsed.pathname.includes("/wiki/Special:FilePath/");
    if (isWikimediaFilePath && !parsed.searchParams.has("width")) {
      parsed.searchParams.set("width", String(width));
    }
    return parsed.toString();
  } catch (_error) {
    return url;
  }
}

function parseDate(dateString, endOfDay = false) {
  return new Date(`${dateString}T${endOfDay ? "23:59:59" : "12:00:00"}`);
}

function getDaysBetween(startDate, endDate) {
  const start = parseDate(startDate);
  const end = endDate instanceof Date ? endDate : parseDate(endDate);
  return Math.round((end - start) / 86400000) + 1;
}

function getTripProgress() {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);
  const start = parseDate(itineraryData.trip.startDate);
  const end = parseDate(itineraryData.trip.endDate, true);
  const totalDays = getDaysBetween(itineraryData.trip.startDate, itineraryData.trip.endDate);

  if (today < start) {
    const daysUntil = Math.ceil((start - today) / 86400000);
    return {
      percent: 0,
      chip: `${daysUntil} day${daysUntil === 1 ? "" : "s"} to go`,
      title: "Countdown to departure",
      text: `The trip begins on June 11, 2026. The dashboard is currently in planning mode.`,
    };
  }

  if (today > end) {
    return {
      percent: 100,
      chip: "Trip complete",
      title: "Home again",
      text: "The itinerary has finished, so this page now works well as a clean travel archive or printout.",
    };
  }

  const todayKey = now.toISOString().slice(0, 10);
  const elapsedDays = Math.min(totalDays, getDaysBetween(itineraryData.trip.startDate, todayKey));
  const percent = Math.round((elapsedDays / totalDays) * 100);
  const segment = SEGMENT_RANGES.find((entry) => today >= parseDate(entry.start) && today <= parseDate(entry.end, true));

  return {
    percent,
    chip: `${percent}% complete`,
    title: segment ? segment.title : "In transit",
    text: segment
      ? `${segment.summary} Day ${elapsedDays} of ${totalDays}.`
      : `The trip is active. Day ${elapsedDays} of ${totalDays}.`,
  };
}

function createDetailBox(detail) {
  return `
    <div class="detail-box">
      <p class="detail-box__label">${detail.label}</p>
      <p class="detail-box__value">${detail.value}</p>
      ${
        detail.link
          ? `<a class="detail-box__link" href="${detail.link}" target="_blank" rel="noopener noreferrer">${detail.linkLabel || "Check live status"}</a>`
          : ""
      }
    </div>
  `;
}

function renderHero() {
  document.getElementById("hero-summary").textContent = itineraryData.trip.summary;
  const progress = getTripProgress();
  document.getElementById("progress-fill").style.width = `${progress.percent}%`;
  document.getElementById("progress-content").innerHTML = `
    <span class="progress-chip">${progress.chip}</span>
    <h3>${progress.title}</h3>
    <p class="progress-text">${progress.text}</p>
  `;
}

function renderStats() {
  const statsGrid = document.getElementById("stats-grid");
  statsGrid.innerHTML = itineraryData.stats
    .map(
      (stat, index) => `
        <article class="stat-card reveal" style="animation-delay:${index * 70}ms">
          <p class="stat-card__label">${stat.label}</p>
          <p class="stat-card__value">${stat.value}</p>
          <p class="stat-card__detail">${stat.detail}</p>
          ${
            stat.link
              ? `<a class="stat-card__link" href="${stat.link}" target="_blank" rel="noopener noreferrer">${stat.linkLabel || "Open link"}</a>`
              : ""
          }
        </article>
      `
    )
    .join("");
}

function renderTimeline() {
  const timelineList = document.getElementById("timeline-list");
  const timelineData = itineraryData.cityTimeline && itineraryData.cityTimeline.length
    ? itineraryData.cityTimeline
    : itineraryData.timeline;

  timelineList.innerHTML = timelineData
    .map(
      (item, index) => `
        <details
          class="timeline-item reveal"
          data-timeline-item
          ${item.image ? `data-timeline-image="${item.image}"` : ""}
          style="animation-delay:${index * 80}ms"
        >
          <summary>
            <div class="timeline-head">
              <div class="timeline-item__icon" aria-hidden="true">${ICONS[item.type]}</div>
              <div class="timeline-head__main">
                <span class="date-badge">${item.dateLabel}</span>
                <h3>${item.title}</h3>
                <div class="timeline-meta">
                  <span class="route-badge">${item.route}</span>
                </div>
              </div>
              <span class="timeline-chevron" aria-hidden="true">\u2304</span>
            </div>
          </summary>
          <div class="timeline-content">
            <p>${item.summary}</p>
            <div class="timeline-detail-grid">
              ${item.details.map(createDetailBox).join("")}
            </div>
          </div>
        </details>
      `
    )
    .join("");
}

function applyTimelineImage(card) {
  if (!card || card.dataset.imageLoaded === "true") {
    return;
  }

  const rawImage = card.dataset.timelineImage;
  if (!rawImage) {
    return;
  }

  const optimizedImage = optimizeTimelineImageUrl(rawImage);
  const preload = new Image();
  preload.decoding = "async";
  preload.src = optimizedImage;
  preload.onload = () => {
    card.style.setProperty("--timeline-image", `url("${optimizedImage}")`);
    card.classList.add("has-photo");
    card.dataset.imageLoaded = "true";
  };
  preload.onerror = () => {
    card.dataset.imageLoaded = "error";
  };
}

function initTimelineImageLoading() {
  const cards = [...document.querySelectorAll("[data-timeline-image]")];
  if (!cards.length) {
    return;
  }

  if (!("IntersectionObserver" in window)) {
    cards.forEach((card) => applyTimelineImage(card));
  } else {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            applyTimelineImage(entry.target);
            observer.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "260px 0px" }
    );

    cards.forEach((card) => observer.observe(card));
  }

  document.querySelectorAll("[data-timeline-item]").forEach((item) => {
    item.addEventListener("toggle", () => {
      if (item.open) {
        applyTimelineImage(item);
      }
    });
  });
}

function renderSegments() {
  const segmentGrid = document.getElementById("segment-grid");
  segmentGrid.innerHTML = itineraryData.segments
    .map(
      (segment, index) => `
        <article class="segment-card reveal" style="animation-delay:${index * 90}ms">
          <div class="segment-card__top">
            <div class="segment-card__icon" aria-hidden="true">${ICONS[segment.type]}</div>
            <div class="segment-card__heading">
              <span class="segment-tag">${segment.kicker}</span>
              <h3>${segment.title}</h3>
              <p>${segment.description}</p>
            </div>
          </div>
          <div class="segment-card__meta">
            <span class="date-badge">${segment.dateLabel}</span>
            <span class="route-badge">${segment.route}</span>
          </div>
          <div class="segment-card__details">
            ${segment.meta.map((entry) => `<div class="detail-box"><p class="detail-box__value">${entry}</p></div>`).join("")}
            ${segment.details.map(createDetailBox).join("")}
          </div>
        </article>
      `
    )
    .join("");
}

function renderMapMeta() {
  const mapMeta = document.getElementById("map-meta");
  if (!mapMeta) {
    return;
  }

  mapMeta.innerHTML = `
    <article class="map-note">
      <p class="eyebrow">How to use</p>
      <h3>Tap any marker</h3>
      <p>Map popups show each date, location, and note for every port call.</p>
    </article>
  `;
}

function initCruiseMap() {
  const mapElement = document.getElementById("cruise-map");
  if (!mapElement || typeof window.L === "undefined") {
    return;
  }

  const points = itineraryData.ports
    .filter((port) => Array.isArray(port.coords) && port.coords.length === 2)
    .map((port, index) => ({ ...port, index, lat: port.coords[0], lng: port.coords[1] }));
  if (!points.length) {
    return;
  }

  const map = window.L.map(mapElement, {
    zoomControl: true,
    scrollWheelZoom: false,
  });

  addReliableBaseLayer(map);

  const routePath = buildCurvedRoutePath(points);
  const routeLine = window.L.polyline(routePath, {
    color: "#1f6c7a",
    weight: 3.5,
    opacity: 0.85,
    lineJoin: "round",
  }).addTo(map);

  // Slightly offset markers that share the exact same coordinates so all days remain clickable.
  const coordGroups = new Map();
  points.forEach((point) => {
    const key = `${point.lat},${point.lng}`;
    if (!coordGroups.has(key)) {
      coordGroups.set(key, []);
    }
    coordGroups.get(key).push(point);
  });

  const dayPositions = new Map();
  coordGroups.forEach((group) => {
    if (group.length === 1) {
      dayPositions.set(group[0].index, [group[0].lat, group[0].lng]);
      return;
    }

    const ringMeters = 170;
    group.forEach((point, duplicateIndex) => {
      const angle = (Math.PI * 2 * duplicateIndex) / group.length;
      const latOffset = (ringMeters / 111320) * Math.sin(angle);
      const lngOffset =
        (ringMeters / (111320 * Math.cos((point.lat * Math.PI) / 180))) * Math.cos(angle);
      dayPositions.set(point.index, [point.lat + latOffset, point.lng + lngOffset]);
    });
  });

  state.mapMarkers = points.map((point, order) => {
    const position = dayPositions.get(point.index) || [point.lat, point.lng];
    const marker = window.L.circleMarker(position, {
      radius: 7,
      weight: 2,
      color: "#ffffff",
      fillColor: "#1f6c7a",
      fillOpacity: 0.95,
    }).addTo(map);

    marker.bindPopup(
      `<strong>Day ${order + 1} - ${point.title}</strong><br>${point.date}<br>${point.location}<br>${point.note}`
    );
    return marker;
  });

  map.fitBounds(routeLine.getBounds(), { padding: [24, 24] });
  state.cruiseMap = map;
}

function addReliableBaseLayer(map) {
  const providers = [
    {
      url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
      options: {
        subdomains: "abcd",
        maxZoom: 20,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      },
    },
    {
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
      options: {
        maxZoom: 19,
        attribution:
          'Tiles &copy; Esri',
      },
    },
  ];

  let activeLayer = null;
  let activeProviderIndex = 0;

  const activateProvider = (index) => {
    if (activeLayer) {
      map.removeLayer(activeLayer);
    }

    activeProviderIndex = index;
    let tileErrors = 0;
    activeLayer = window.L.tileLayer(providers[index].url, {
      ...providers[index].options,
      crossOrigin: true,
      updateWhenIdle: true,
      keepBuffer: 2,
    });

    activeLayer.on("tileerror", () => {
      tileErrors += 1;
      if (tileErrors >= 8 && activeProviderIndex < providers.length - 1) {
        activateProvider(activeProviderIndex + 1);
      }
    });

    activeLayer.addTo(map);
  };

  activateProvider(0);
}

function buildCurvedRoutePath(points) {
  if (!Array.isArray(points) || points.length < 2) {
    return points.map((point) => [point.lat, point.lng]);
  }

  const curved = [];
  const stepsPerLeg = 18;

  points.forEach((point, index) => {
    if (index === points.length - 1) {
      return;
    }

    const start = points[index];
    const end = points[index + 1];
    const dx = end.lng - start.lng;
    const dy = end.lat - start.lat;
    const len = Math.hypot(dx, dy);

    if (len < 0.00001) {
      if (!curved.length) {
        curved.push([start.lat, start.lng]);
      }
      return;
    }

    const midLat = (start.lat + end.lat) / 2;
    const midLng = (start.lng + end.lng) / 2;
    const nx = -dy / len;
    const ny = dx / len;
    const direction = end.lng >= start.lng ? 1 : -1;
    const bend = Math.min(1.15, len * 0.34) * direction;
    const controlLat = midLat + ny * bend;
    const controlLng = midLng + nx * bend;

    for (let step = 0; step <= stepsPerLeg; step += 1) {
      const t = step / stepsPerLeg;
      const omt = 1 - t;
      const lat =
        omt * omt * start.lat + 2 * omt * t * controlLat + t * t * end.lat;
      const lng =
        omt * omt * start.lng + 2 * omt * t * controlLng + t * t * end.lng;
      if (!curved.length || step > 0) {
        curved.push([lat, lng]);
      }
    }
  });

  const lastPoint = points[points.length - 1];
  if (!curved.length) {
    curved.push([lastPoint.lat, lastPoint.lng]);
  }
  return curved;
}

function renderNotes() {
  const notesGrid = document.getElementById("notes-grid");
  notesGrid.innerHTML = itineraryData.notes
    .map(
      (group, index) => `
        <article class="note-card reveal" style="animation-delay:${index * 90}ms">
          <div class="note-card__top">
            <div class="note-card__icon" aria-hidden="true">${ICONS.notes}</div>
            <div class="note-card__heading">
              <p class="eyebrow">Notes</p>
              <h3>${group.title}</h3>
            </div>
          </div>
          <ul class="note-list">
            ${group.items.map((item) => `<li>${item}</li>`).join("")}
          </ul>
        </article>
      `
    )
    .join("");
}

function setTimelineExpanded(expandAll) {
  document.querySelectorAll("[data-timeline-item]").forEach((item) => {
    item.open = expandAll;
  });
  state.allExpanded = expandAll;
  document.getElementById("timeline-toggle").textContent = expandAll ? "Collapse all" : "Expand all";
}

function bindInteractions() {
  const toggleButton = document.getElementById("timeline-toggle");
  toggleButton.addEventListener("click", () => {
    setTimelineExpanded(!state.allExpanded);
  });

  document.querySelectorAll("[data-timeline-item]").forEach((item) => {
    item.addEventListener("toggle", () => {
      const items = [...document.querySelectorAll("[data-timeline-item]")];
      const everyOpen = items.every((entry) => entry.open);
      state.allExpanded = everyOpen;
      toggleButton.textContent = everyOpen ? "Collapse all" : "Expand all";
    });
  });
}

function bindMenu() {
  const topNav = document.querySelector(".top-nav");
  const menuToggle = document.getElementById("menu-toggle");
  const menuLinks = document.querySelectorAll(".nav-links a");
  if (!topNav || !menuToggle) {
    return;
  }

  function closeMenu() {
    topNav.classList.remove("is-open");
    menuToggle.setAttribute("aria-expanded", "false");
    menuToggle.setAttribute("aria-label", "Open navigation menu");
    document.body.classList.remove("menu-open");
  }

  menuToggle.addEventListener("click", () => {
    const willOpen = !topNav.classList.contains("is-open");
    topNav.classList.toggle("is-open", willOpen);
    document.body.classList.toggle("menu-open", willOpen);
    menuToggle.setAttribute("aria-expanded", String(willOpen));
    menuToggle.setAttribute(
      "aria-label",
      willOpen ? "Close navigation menu" : "Open navigation menu"
    );
  });

  menuLinks.forEach((link) => {
    link.addEventListener("click", closeMenu);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeMenu();
    }
  });

  document.addEventListener("click", (event) => {
    if (!topNav.contains(event.target)) {
      closeMenu();
    }
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth >= 900) {
      closeMenu();
    }
  });
}

function init() {
  renderHero();
  renderStats();
  renderTimeline();
  initTimelineImageLoading();
  renderMapMeta();
  renderNotes();
  initCruiseMap();
  bindInteractions();
  bindMenu();
}

init();


