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

  const mappedStops = itineraryData.ports.filter(
    (port) => Array.isArray(port.coords) && port.coords.length === 2
  );

  mapMeta.innerHTML = `
    <article class="map-note">
      <p class="eyebrow">Mapped stops</p>
      <h3>${mappedStops.length} plotted points</h3>
      <p>The cruise line is drawn from the configured coordinates in the itinerary data file.</p>
    </article>
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

  window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 17,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(map);

  const routePath = points.map((point) => [point.lat, point.lng]);
  const routeLine = window.L.polyline(routePath, {
    color: "#1f6c7a",
    weight: 3.5,
    opacity: 0.85,
    lineJoin: "round",
  }).addTo(map);

  state.mapMarkers = points.map((point, order) => {
    const marker = window.L.circleMarker([point.lat, point.lng], {
      radius: 7,
      weight: 2,
      color: "#ffffff",
      fillColor: "#1f6c7a",
      fillOpacity: 0.95,
    }).addTo(map);

    marker.bindPopup(
      `<strong>${String(order + 1).padStart(2, "0")}. ${point.title}</strong><br>${point.date}<br>${point.location}<br>${point.note}`
    );
    return marker;
  });

  map.fitBounds(routeLine.getBounds(), { padding: [24, 24] });
  state.cruiseMap = map;
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
              <p>Editable planning prompts for this part of the journey.</p>
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


