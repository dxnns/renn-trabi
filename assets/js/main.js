/* =========================
   Bembel Racing Team – JS
   ========================= */

(() => {
  const uiCore = window.BEMBEL_UI_CORE || {};

  // ---- Mainpage config ----
  const asObject = (value) => (value && typeof value === "object" && !Array.isArray(value) ? value : {});
  const asArray = (value) => (Array.isArray(value) ? value : []);
  const toText = (value, fallback = "") => {
    if (value === null || value === undefined) return fallback;
    return String(value);
  };

  const DEFAULT_MAINPAGE_CONFIG = {
    hero: {
      badge: "Saison 2026 • Trabi-Rennen Sachsen",
      lead: "Wir sind ein kleines Rennteam und gehen dieses Jahr in Sachsen an den Start. Hier findest du Updates, Fahrzeugdetails, Sponsoren und wie du uns supporten kannst.",
      stats: {
        raceCars: 1,
        raceCarsLabel: "Renn-Trabi",
        crewCount: 3,
        crewLabel: "Crew",
        season: 2026,
        seasonLabel: "Saison",
      },
    },
    race: {
      heading: "Trabi-Rennen Sachsen",
      startLocal: "2026-08-15T10:00:00",
      location: "Sachsen",
      eventName: "Trabi-Rennen",
      region: "Sachsen",
      startWindow: "10:00 Uhr • Sprintlauf",
      statusUpcoming: "In Vorbereitung",
      statusLive: "Live / läuft",
      className: "2-Takt Fun Cup",
      crew: "3 Fahrer + Boxencrew",
      pitSlot: "Box 12",
      goal: "Finish + saubere Pace",
      roadmap: [
        { task: "Wartung & Sicherheitscheck", date: "06.08", state: "done" },
        { task: "Testlauf + Fahrwerks-Feintuning", date: "07.08", state: "done" },
        { task: "Transport, Pit-Setup, Abnahme", date: "14.08", state: "active" },
        { task: "Rennwochenende & Race Day", date: "15.08", state: "" },
      ],
    },
    ticker: [
      "⚙️ Setup: Fahrwerk feinjustiert",
      "🧰 Pit-Gear: Checkliste aktualisiert",
      "🏁 Ziel: sauberer Lauf, keine DNFs",
      "🔥 „Enke 666“ ready to race",
    ],
    contact: {
      primaryEmail: "kontakt@bembelracingteam.de",
      footerEmail: "info@bembelracingteam.de",
      formMailTo: "kontakt@bembelracingteam.de",
      locationLabel: "Unterwegs • Sachsen 2026",
      instagram: {
        handle: "@bembelracingteam",
        webUrl: "https://www.instagram.com/bembelracingteam/",
        appUrl: "instagram://user?username=bembelracingteam",
      },
    },
    joinModal: {
      badge: "Team-Update",
      title: "Aktuell sind alle Teamplätze vergeben.",
      bodyMain: "Danke für dein Interesse am Mitmachen. Im Moment haben wir leider keine freien Plätze im Team.",
      bodySoft: "Wenn du uns trotzdem unterstützen möchtest, freuen wir uns sehr über Sponsoring.",
      ctaHref: "/sponsoring-anfrage.html",
      ctaLabel: "Sponsoring anfragen",
    },
    raceCenter: {},
  };

  const inputConfig = asObject(window.BEMBEL_MAINPAGE_CONFIG);
  const inputHero = asObject(inputConfig.hero);
  const inputRace = asObject(inputConfig.race);
  const inputContact = asObject(inputConfig.contact);
  const inputContactInstagram = asObject(inputContact.instagram);
  const inputJoinModal = asObject(inputConfig.joinModal);

  const siteConfig = {
    hero: {
      ...DEFAULT_MAINPAGE_CONFIG.hero,
      ...inputHero,
      stats: {
        ...DEFAULT_MAINPAGE_CONFIG.hero.stats,
        ...asObject(inputHero.stats),
      },
    },
    race: {
      ...DEFAULT_MAINPAGE_CONFIG.race,
      ...inputRace,
      roadmap: asArray(inputRace.roadmap).length ? inputRace.roadmap : DEFAULT_MAINPAGE_CONFIG.race.roadmap,
    },
    ticker: asArray(inputConfig.ticker).length ? inputConfig.ticker : DEFAULT_MAINPAGE_CONFIG.ticker,
    contact: {
      ...DEFAULT_MAINPAGE_CONFIG.contact,
      ...inputContact,
      instagram: {
        ...DEFAULT_MAINPAGE_CONFIG.contact.instagram,
        ...inputContactInstagram,
      },
    },
    joinModal: {
      ...DEFAULT_MAINPAGE_CONFIG.joinModal,
      ...inputJoinModal,
    },
    raceCenter: asObject(inputConfig.raceCenter),
  };

  // ---- Helpers ----
  const $ = typeof uiCore.q === "function"
    ? uiCore.q
    : (sel, root = document) => root.querySelector(sel);
  const $$ = typeof uiCore.qq === "function"
    ? uiCore.qq
    : (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const escapeHtml = (s) =>
    String(s).replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
  const isMobileDevice = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || "");
  const reduceMotion = typeof uiCore.getReduceMotion === "function"
    ? uiCore.getReduceMotion()
    : window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const RACE_START_LOCAL = toText(siteConfig.race.startLocal, DEFAULT_MAINPAGE_CONFIG.race.startLocal);
  const RACE_LOCATION = toText(siteConfig.race.location, DEFAULT_MAINPAGE_CONFIG.race.location);
  const RACE_STATUS_UPCOMING = toText(siteConfig.race.statusUpcoming, DEFAULT_MAINPAGE_CONFIG.race.statusUpcoming);
  const RACE_STATUS_LIVE = toText(siteConfig.race.statusLive, DEFAULT_MAINPAGE_CONFIG.race.statusLive);

  const getConfigValueByPath = (path) => {
    const keys = String(path || "").split(".").filter(Boolean);
    if (!keys.length) return undefined;

    let value = siteConfig;
    for (const key of keys) {
      if (!value || typeof value !== "object" || !(key in value)) return undefined;
      value = value[key];
    }
    return value;
  };

  const applyConfigBindings = () => {
    $$("[data-site-text]").forEach((el) => {
      const path = el.getAttribute("data-site-text");
      const value = getConfigValueByPath(path);
      if (value === undefined || value === null) return;
      el.textContent = String(value);
    });

    $$("[data-site-counter]").forEach((el) => {
      const path = el.getAttribute("data-site-counter");
      const value = Number(getConfigValueByPath(path));
      if (!Number.isFinite(value)) return;
      el.setAttribute("data-counter", String(value));
    });

    $$("[data-site-mailto]").forEach((el) => {
      const path = el.getAttribute("data-site-mailto");
      const value = String(getConfigValueByPath(path) || "").trim();
      if (!value) return;

      if (el instanceof HTMLAnchorElement) {
        el.href = `mailto:${value}`;
      }
      el.textContent = value;
    });

    $$("[data-site-href]").forEach((el) => {
      const path = el.getAttribute("data-site-href");
      const value = String(getConfigValueByPath(path) || "").trim();
      if (!value || !(el instanceof HTMLAnchorElement)) return;
      el.href = value;
    });
  };

  const renderRoadmap = () => {
    const roadmapEl = document.querySelector("[data-race-roadmap]");
    if (!roadmapEl) return;

    const items = asArray(siteConfig.race.roadmap)
      .map((entry) => {
        const task = String(entry?.task || "").trim();
        const date = String(entry?.date || "").trim();
        const state = String(entry?.state || "").trim().toLowerCase();
        if (!task || !date) return null;

        const itemClass =
          state === "done"
            ? "roadmap-item is-done"
            : state === "active"
              ? "roadmap-item is-active"
              : "roadmap-item";

        return `
          <li class="${itemClass}">
            <span class="roadmap-task">${escapeHtml(task)}</span>
            <span class="roadmap-date">${escapeHtml(date)}</span>
          </li>
        `;
      })
      .filter(Boolean);

    if (!items.length) return;
    roadmapEl.innerHTML = items.join("");
  };

  const renderTicker = () => {
    const tickerTrack = document.querySelector("[data-ticker]");
    if (!tickerTrack) return;

    const entries = asArray(siteConfig.ticker)
      .map((entry) => String(entry || "").trim())
      .filter(Boolean);

    if (!entries.length) return;
    tickerTrack.innerHTML = entries.map((entry) => `<span>${escapeHtml(entry)}</span>`).join("");
  };

  // ---- Instagram links (prefer app on mobile, fallback to web) ----
  const instagramLinks = $$("[data-instagram-link]");
  if (instagramLinks.length) {
    const instaWebUrl = toText(siteConfig.contact.instagram.webUrl, DEFAULT_MAINPAGE_CONFIG.contact.instagram.webUrl);
    const instaAppUrl = toText(siteConfig.contact.instagram.appUrl, DEFAULT_MAINPAGE_CONFIG.contact.instagram.appUrl);

    instagramLinks.forEach((linkEl) => {
      if (!(linkEl instanceof HTMLAnchorElement)) return;
      linkEl.href = instaWebUrl;
      linkEl.rel = "noopener noreferrer";

      if (!isMobileDevice || !instaAppUrl) {
        linkEl.target = "_blank";
        return;
      }

      linkEl.addEventListener("click", (e) => {
        e.preventDefault();
        const fallbackUrl = linkEl.href;
        const startedAt = Date.now();

        window.location.href = instaAppUrl;

        window.setTimeout(() => {
          if (document.visibilityState === "visible" && Date.now() - startedAt < 1600) {
            window.location.href = fallbackUrl;
          }
        }, 900);
      });
    });
  }

  applyConfigBindings();
  renderRoadmap();
  renderTicker();

  // ---- Mobile nav ----
  const toggle = $(".nav-toggle");
  const navmenu = $("#navmenu");
  if (toggle && navmenu) {
    toggle.addEventListener("click", () => {
      const open = navmenu.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", String(open));
    });

    // close on link click
    $$("#navmenu a").forEach(a => {
      a.addEventListener("click", () => {
        navmenu.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  // ---- Scroll progress bar ----
  const bar = $(".progress-bar");
  const onScroll = () => {
    const doc = document.documentElement;
    const max = doc.scrollHeight - doc.clientHeight;
    const pct = max > 0 ? (doc.scrollTop / max) * 100 : 0;
    if (bar) bar.style.width = `${pct}%`;
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // ---- Footer year ----
  const y = new Date().getFullYear();
  const yEl = $("[data-year]");
  if (yEl) yEl.textContent = String(y);

  // ---- Back to top links ----
  const backToTopLinks = $$('a[href="#top"]');
  backToTopLinks.forEach((linkEl) => {
    linkEl.addEventListener("click", (e) => {
      e.preventDefault();
      window.scrollTo({
        top: 0,
        behavior: reduceMotion ? "auto" : "smooth",
      });
    });
  });

  // ---- Section build + reveal (shared core) ----
  const sections = (() => {
    if (typeof uiCore.initializeSectionBuildAndReveal === "function") {
      const result = uiCore.initializeSectionBuildAndReveal({
        delayStep: 45,
        delayCap: 180,
      });
      return Array.isArray(result?.sections) ? result.sections : [];
    }
    return $$("main > section");
  })();

  // ---- Counters ----
  const counterEls = $$("[data-counter]");
  const animateCounter = (el) => {
    const target = Number(el.getAttribute("data-counter")) || 0;
    const duration = 900;
    const start = performance.now();
    const from = 0;

    const step = (t) => {
      const p = Math.min(1, (t - start) / duration);
      // ease out
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = String(Math.floor(from + (target - from) * eased));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  const counterIO = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        animateCounter(e.target);
        counterIO.unobserve(e.target);
      }
    });
  }, { threshold: 0.6 });
  counterEls.forEach(el => counterIO.observe(el));

  // ---- Race meta ----
  const raceStart = new Date(RACE_START_LOCAL);
  const raceDateEls = $$("[data-racedate]");
  const raceLocationEls = $$("[data-racelocation]");
  const raceStatusEls = $$("[data-racestatus]");
  let raceStatusOverride = "";

  raceLocationEls.forEach((el) => {
    el.textContent = RACE_LOCATION;
  });

  if (!Number.isNaN(raceStart.getTime())) {
    const raceDateText = new Intl.DateTimeFormat("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    }).format(raceStart);

    raceDateEls.forEach((el) => {
      el.textContent = raceDateText;
    });
  }

  const setRaceStatus = (text) => {
    raceStatusEls.forEach((el) => {
      el.textContent = text;
    });
  };

  const setRaceStatusOverride = (text) => {
    raceStatusOverride = String(text || "").trim();
    if (raceStatusOverride) {
      setRaceStatus(raceStatusOverride);
    }
  };

  // ---- Sponsor logos: show image only if file exists ----
  const sponsorLogoEls = $$("[data-sponsor-logo]");
  sponsorLogoEls.forEach((img) => {
    const logoBox = img.closest(".logo-box");
    if (!logoBox) return;

    const setLoaded = () => {
      logoBox.classList.add("has-logo");
    };
    const setMissing = () => {
      logoBox.classList.remove("has-logo");
    };

    if (img.complete) {
      if (img.naturalWidth > 0) setLoaded();
      else setMissing();
      return;
    }

    img.addEventListener("load", setLoaded, { once: true });
    img.addEventListener("error", setMissing, { once: true });
  });

  // ---- Countdown ----
  const cd = document.querySelector("[data-countdown]");
  if (cd) {
    const dEl = cd.querySelector("[data-days]");
    const hEl = cd.querySelector("[data-hours]");
    const mEl = cd.querySelector("[data-mins]");
    const sEl = cd.querySelector("[data-secs]");
    const start = raceStart;

    const pad = (n) => String(n).padStart(2, "0");

    const tick = () => {
      const now = new Date();
      const diff = start - now;

      if (diff <= 0) {
        if (dEl) dEl.textContent = "0";
        if (hEl) hEl.textContent = "00";
        if (mEl) mEl.textContent = "00";
        if (sEl) sEl.textContent = "00";
        if (raceStatusOverride) setRaceStatus(raceStatusOverride);
        else setRaceStatus(RACE_STATUS_LIVE);
        return;
      }

      const sec = Math.floor(diff / 1000);
      const days = Math.floor(sec / (3600 * 24));
      const hours = Math.floor((sec % (3600 * 24)) / 3600);
      const mins = Math.floor((sec % 3600) / 60);
      const secs = sec % 60;

      if (dEl) dEl.textContent = String(days);
      if (hEl) hEl.textContent = pad(hours);
      if (mEl) mEl.textContent = pad(mins);
      if (sEl) sEl.textContent = pad(secs);

      if (raceStatusOverride) setRaceStatus(raceStatusOverride);
      else setRaceStatus(RACE_STATUS_UPCOMING);
    };

    tick();
    setInterval(tick, 1000);
  }

  // ---- Ticker duplication (seamless loop) ----
  const track = document.querySelector("[data-ticker]");
  if (track) {
    const originalItems = Array.from(track.children);
    if (originalItems.length) {
      const cloneFragment = document.createDocumentFragment();
      originalItems.forEach((item) => {
        cloneFragment.appendChild(item.cloneNode(true));
      });
      track.appendChild(cloneFragment);

      const updateTickerMetrics = () => {
        const firstOriginal = track.children[0];
        const firstClone = track.children[originalItems.length];
        if (!firstOriginal || !firstClone) return;

        const shift = firstClone.offsetLeft - firstOriginal.offsetLeft;
        if (shift <= 0) return;

        // Keep movement speed constant across viewport/font changes.
        const pixelsPerSecond = 90;
        const duration = shift / pixelsPerSecond;

        track.style.setProperty("--ticker-shift", `${shift}px`);
        track.style.setProperty("--ticker-duration", `${duration.toFixed(2)}s`);
      };

      updateTickerMetrics();
      window.addEventListener("resize", updateTickerMetrics, { passive: true });

      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(updateTickerMetrics).catch(() => {});
      }
    }
  }

  // ---- Optional gallery thumbnails ----
  const galleryItems = $$("[data-lightbox]");
  galleryItems.forEach(btn => {
    const src = btn.getAttribute("data-lightbox");
    const placeholder = btn.querySelector(".g-placeholder");
    const hasThumb = !!btn.querySelector("img");
    if (!src || !placeholder || hasThumb) return;

    const thumb = new Image();
    thumb.onload = () => {
      thumb.className = "g-thumb";
      thumb.alt = `Galeriebild ${src.split("/").pop() || ""}`.trim();
      thumb.loading = "lazy";
      placeholder.replaceWith(thumb);
    };
    thumb.onerror = () => {
      // Keep placeholder visible if optional file is missing.
    };
    thumb.src = src;
  });

  // ---- Lightbox ----
  const modal = document.querySelector("[data-lightbox-modal]");
  const modalImg = document.querySelector("[data-lightbox-img]");
  const closeBtn = document.querySelector("[data-lightbox-close]");
  const prevBtn = document.querySelector("[data-lightbox-prev]");
  const nextBtn = document.querySelector("[data-lightbox-next]");
  let currentLightboxIndex = -1;

  // Keep lightbox outside animated sections so fixed positioning always uses the viewport.
  if (modal && modal.parentElement !== document.body) {
    document.body.appendChild(modal);
  }

  const getGalleryImageButtons = () => {
    return galleryItems.filter(btn => !!btn.querySelector("img"));
  };

  const updateLightboxNav = () => {
    const items = getGalleryImageButtons();
    const hasMultipleItems = items.length > 1;
    const canGoPrev = hasMultipleItems && currentLightboxIndex > 0;
    const canGoNext = hasMultipleItems && currentLightboxIndex >= 0 && currentLightboxIndex < items.length - 1;

    if (prevBtn) {
      prevBtn.hidden = !canGoPrev;
      prevBtn.disabled = !canGoPrev;
    }
    if (nextBtn) {
      nextBtn.hidden = !canGoNext;
      nextBtn.disabled = !canGoNext;
    }
  };

  const openLightboxByIndex = (index) => {
    if (!modal || !modalImg) return;
    const items = getGalleryImageButtons();
    if (!items.length) return;

    const safeIndex = Math.max(0, Math.min(index, items.length - 1));
    const activeBtn = items[safeIndex];
    const src = activeBtn.getAttribute("data-lightbox");
    if (!src) return;

    currentLightboxIndex = safeIndex;
    modalImg.src = src;
    modalImg.alt = activeBtn.querySelector("img")?.alt || "Galeriebild";
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    updateLightboxNav();
  };

  const closeLightbox = () => {
    if (!modal || !modalImg) return;
    modal.setAttribute("aria-hidden", "true");
    modalImg.src = "";
    modalImg.alt = "";
    document.body.style.overflow = "";
    currentLightboxIndex = -1;
    updateLightboxNav();
  };

  galleryItems.forEach(btn => {
    btn.addEventListener("click", () => {
      const items = getGalleryImageButtons();
      const idx = items.indexOf(btn);
      if (idx === -1) return;
      openLightboxByIndex(idx);
    });
  });

  if (prevBtn) {
    prevBtn.addEventListener("click", () => {
      if (currentLightboxIndex <= 0) return;
      openLightboxByIndex(currentLightboxIndex - 1);
    });
  }
  if (nextBtn) {
    nextBtn.addEventListener("click", () => {
      openLightboxByIndex(currentLightboxIndex + 1);
    });
  }

  if (closeBtn) closeBtn.addEventListener("click", closeLightbox);
  if (modal) modal.addEventListener("click", (e) => {
    if (e.target === modal) closeLightbox();
  });
  window.addEventListener("keydown", (e) => {
    if (!modal || modal.getAttribute("aria-hidden") !== "false") return;
    if (e.key === "Escape") closeLightbox();
    if (e.key === "ArrowLeft" && currentLightboxIndex > 0) {
      openLightboxByIndex(currentLightboxIndex - 1);
    }
    if (e.key === "ArrowRight") {
      const items = getGalleryImageButtons();
      if (currentLightboxIndex < items.length - 1) {
        openLightboxByIndex(currentLightboxIndex + 1);
      }
    }
  });

  // ---- Team join popup ----
  const joinTriggers = $$("[data-team-join-trigger]");
  const joinModal = document.querySelector("[data-joinmodal]");
  const joinCloseButtons = $$("[data-joinmodal-close]");
  let lastFocusedEl = null;

  const isJoinModalOpen = () => {
    return !!joinModal && joinModal.getAttribute("aria-hidden") === "false";
  };

  const openJoinModal = () => {
    if (!joinModal) return;
    lastFocusedEl = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    joinModal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";

    const primaryClose = joinModal.querySelector("[data-joinmodal-close]");
    if (primaryClose instanceof HTMLElement) {
      primaryClose.focus();
    }
  };

  const closeJoinModal = () => {
    if (!joinModal) return;
    joinModal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    if (lastFocusedEl instanceof HTMLElement) {
      lastFocusedEl.focus();
    }
  };

  if (joinTriggers.length && joinModal) {
    joinTriggers.forEach((trigger) => {
      trigger.addEventListener("click", (e) => {
        if (e.currentTarget instanceof HTMLAnchorElement) {
          e.preventDefault();
        }
        openJoinModal();
      });
    });

    joinCloseButtons.forEach((btn) => {
      btn.addEventListener("click", closeJoinModal);
    });

    joinModal.addEventListener("click", (e) => {
      if (e.target === joinModal) {
        closeJoinModal();
      }
    });

    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && isJoinModalOpen()) {
        closeJoinModal();
      }
    });
  }

  // ---- Boost Mode (visual) ----
  const boostBtn = document.querySelector("[data-boost]");
  const boostFill = document.querySelector("[data-boostfill]");
  const boostPopup = document.querySelector("[data-boostpopup]");
  const boostBar = boostFill ? boostFill.closest(".boostbar") : null;
  if (boostBtn && boostFill) {
    let boostResetTimer = 0;

    const setBoostLevel = (value) => {
      boostFill.style.width = `${value}%`;
    };

    setBoostLevel(22);

    boostBtn.addEventListener("click", () => {
      const current = parseFloat(boostFill.style.width || "22") || 22;
      const next = Math.min(100, current + 22);
      const isMax = next >= 100;

      window.clearTimeout(boostResetTimer);
      setBoostLevel(next);
      boostBtn.textContent = isMax ? "Boost Mode: MAX" : "Boost Mode";

      if (boostBar) boostBar.classList.toggle("is-max", isMax);
      if (boostPopup) boostPopup.setAttribute("aria-hidden", isMax ? "false" : "true");

      if (isMax) {
        boostResetTimer = window.setTimeout(() => {
          if (boostBar) boostBar.classList.remove("is-max");
          if (boostPopup) boostPopup.setAttribute("aria-hidden", "true");
          setBoostLevel(22);
          boostBtn.textContent = "Boost Mode";
        }, 1200);
      }
    });
  }

  // ---- Race Center ----
  const feed = document.querySelector("[data-feed]");
  const raceFeedStatusEl = document.querySelector("[data-race-feed-status]");
  const raceFilters = $$("[data-race-filter]");
  const racePollsList = document.querySelector("[data-race-polls-list]");
  const raceLastUpdateEl = document.querySelector("[data-race-lastupdate]");
  const raceNextMilestoneEl = document.querySelector("[data-race-nextmilestone]");

  const RACE_POLL_VOTES_KEY = "bembel_race_poll_votes";
  const RACE_REACTIONS_KEY = "bembel_race_reactions";

  // Manuelle Race-Center-Daten (statische GitHub-Pages-Version ohne Backend-API).
  // Primäre Pflege in assets/js/mainpage-config.js unter raceCenter.
  // Dieser Block bleibt als Fallback, falls keine Konfig geladen ist.
  const DEFAULT_RACE_CENTER_MANUAL = {
    summary: {
      state: RACE_STATUS_UPCOMING,
      nextMilestone: "Transport, Pit-Setup und Abnahme",
      lastUpdateAt: "",
    },
    feed: [
      {
        id: "manual-setup-check",
        category: "technik",
        title: "Setup-Check abgeschlossen",
        body: "Bremsbalance stabil, Temperaturfenster passt fuer den Testlauf.",
        at: "2026-08-06T18:00:00+02:00",
        reactions: { fire: 0, checkered: 0, wrench: 0 },
      },
      {
        id: "manual-pit-ablauf",
        category: "team",
        title: "Pit-Ablauf geprobt",
        body: "Tool-Positionen angepasst, Boxenfenster weiter verbessert.",
        at: "2026-08-07T20:10:00+02:00",
        reactions: { fire: 0, checkered: 0, wrench: 0 },
      },
      {
        id: "manual-anreise",
        category: "rennen",
        title: "Anreisefenster fix",
        body: "Transport und Abnahme fuer den Vorabend finalisiert.",
        at: "2026-08-14T19:30:00+02:00",
        reactions: { fire: 0, checkered: 0, wrench: 0 },
      },
    ],
    polls: [
      {
        id: "manual-focus-poll",
        question: "Was soll im naechsten Update im Fokus stehen?",
        options: [
          { id: "pace", label: "Pace pushen", votes: 0 },
          { id: "safety", label: "Safety zuerst", votes: 0 },
          { id: "stops", label: "Pit-Stops optimieren", votes: 0 },
        ],
      },
    ],
  };
  const configuredRaceCenter = asObject(siteConfig.raceCenter);
  const hasConfiguredRaceCenter =
    Array.isArray(configuredRaceCenter.feed) ||
    Array.isArray(configuredRaceCenter.polls) ||
    (configuredRaceCenter.summary && typeof configuredRaceCenter.summary === "object");
  const RACE_CENTER_MANUAL = hasConfiguredRaceCenter ? configuredRaceCenter : DEFAULT_RACE_CENTER_MANUAL;
  // Struktur-Hinweis fuer manuelle Eintraege:
  // feed item: { id, category: "technik|rennen|team", title, body, at: ISO-Datum, reactions: { fire, checkered, wrench } }
  // poll: { id, question, options: [{ id, label, votes }] }

  const safeLocalStorage = (() => {
    try {
      return window.localStorage;
    } catch {
      return null;
    }
  })();

  const safeSessionStorage = (() => {
    try {
      return window.sessionStorage;
    } catch {
      return null;
    }
  })();

  const reactionConfig = [
    { key: "fire", icon: "🔥", label: "Feuer" },
    { key: "checkered", icon: "🏁", label: "Finish" },
    { key: "wrench", icon: "🛠️", label: "Setup" },
  ];

  const categoryLabels = {
    technik: "Technik",
    rennen: "Rennen",
    team: "Team",
  };

  const readJsonStorage = (storage, key, fallback) => {
    if (!storage) return fallback;
    try {
      const raw = storage.getItem(key);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : fallback;
    } catch {
      return fallback;
    }
  };

  const writeJsonStorage = (storage, key, value) => {
    if (!storage) return;
    try {
      storage.setItem(key, JSON.stringify(value));
    } catch {}
  };

  const pollVotesById = readJsonStorage(safeLocalStorage, RACE_POLL_VOTES_KEY, {});
  const reactedByKey = readJsonStorage(safeSessionStorage, RACE_REACTIONS_KEY, {});

  const raceCenterState = {
    activeFilter: "all",
    feed: [],
    polls: [],
  };

  const formatDateTime = (value) => {
    const ms = Date.parse(value || "");
    if (!Number.isFinite(ms)) return "—";
    return new Intl.DateTimeFormat("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(ms));
  };

  const parseDate = (value) => {
    const ms = Date.parse(value || "");
    return Number.isFinite(ms) ? ms : Number.NaN;
  };

  const setRaceFeedStatus = (text, isError = false) => {
    if (!raceFeedStatusEl) return;
    raceFeedStatusEl.textContent = text;
    raceFeedStatusEl.style.color = isError ? "#ff9b9b" : "";
  };

  const normalizeFeedItem = (item) => {
    const id = String(item?.id || "").trim();
    const title = String(item?.title || "").trim();
    const body = String(item?.body || "").trim();
    if (!id || !title || !body) return null;

    const category = ["technik", "rennen", "team"].includes(item?.category) ? item.category : "rennen";
    const at = Number.isFinite(parseDate(item?.at))
      ? new Date(parseDate(item.at)).toISOString()
      : new Date().toISOString();
    const reactions = item?.reactions && typeof item.reactions === "object" ? item.reactions : {};

    return {
      id,
      category,
      title,
      body,
      at,
      reactions: {
        fire: Math.max(0, Number(reactions.fire) || 0),
        checkered: Math.max(0, Number(reactions.checkered) || 0),
        wrench: Math.max(0, Number(reactions.wrench) || 0),
      },
    };
  };

  const normalizePoll = (poll) => {
    const id = String(poll?.id || "").trim();
    const question = String(poll?.question || "").trim();
    if (!id || !question) return null;

    const options = Array.isArray(poll?.options)
      ? poll.options
          .map((option) => {
            const optionId = String(option?.id || "").trim();
            const label = String(option?.label || "").trim();
            if (!optionId || !label) return null;
            return {
              id: optionId,
              label,
              votes: Math.max(0, Number(option?.votes) || 0),
            };
          })
          .filter(Boolean)
      : [];

    if (options.length < 2) return null;

    return {
      id,
      question,
      options,
      totalVotes: options.reduce((sum, option) => sum + option.votes, 0),
      status: "active",
      expiresAt: "",
    };
  };

  const getLastManualUpdate = (items) => {
    const sorted = [...items].sort((a, b) => parseDate(b.at) - parseDate(a.at));
    return sorted[0] || null;
  };

  const createSummaryFromFeed = (summaryInput, items) => {
    const latest = getLastManualUpdate(items);
    const summary = summaryInput && typeof summaryInput === "object" ? summaryInput : {};

    return {
      state: String(summary.state || "").trim() || "In Vorbereitung",
      nextMilestone: String(summary.nextMilestone || "").trim() || "Naechster Meilenstein folgt",
      lastUpdateAt: String(summary.lastUpdateAt || latest?.at || "").trim(),
      lastUpdate: latest
        ? {
            id: latest.id,
            title: latest.title,
            category: latest.category,
            at: latest.at,
          }
        : null,
    };
  };

  const getManualRaceCenterData = () => {
    const source =
      window.BEMBEL_RACE_CENTER_DATA && typeof window.BEMBEL_RACE_CENTER_DATA === "object"
        ? window.BEMBEL_RACE_CENTER_DATA
        : RACE_CENTER_MANUAL;

    const feedItems = Array.isArray(source.feed)
      ? source.feed.map(normalizeFeedItem).filter(Boolean).sort((a, b) => parseDate(a.at) - parseDate(b.at))
      : [];

    const polls = Array.isArray(source.polls)
      ? source.polls.map(normalizePoll).filter(Boolean)
      : [];

    const summary = createSummaryFromFeed(source.summary, feedItems);
    return { feedItems, polls, summary };
  };

  const updateSummaryUi = (summary) => {
    if (!summary || typeof summary !== "object") return;

    const state = String(summary.state || "").trim();
    const nextMilestone = String(summary.nextMilestone || "").trim();
    const lastUpdate = summary.lastUpdate && typeof summary.lastUpdate === "object" ? summary.lastUpdate : null;

    if (state) {
      setRaceStatusOverride(state);
    }

    if (raceNextMilestoneEl) {
      raceNextMilestoneEl.textContent = nextMilestone || "Naechster Check folgt";
    }

    if (raceLastUpdateEl) {
      if (lastUpdate?.title) {
        raceLastUpdateEl.textContent = `${lastUpdate.title} • ${formatDateTime(lastUpdate.at)}`;
      } else if (summary.lastUpdateAt) {
        raceLastUpdateEl.textContent = formatDateTime(summary.lastUpdateAt);
      } else {
        raceLastUpdateEl.textContent = "Noch keine Updates";
      }
    }
  };

  const persistPollVotes = () => {
    writeJsonStorage(safeLocalStorage, RACE_POLL_VOTES_KEY, pollVotesById);
  };

  const persistReactions = () => {
    writeJsonStorage(safeSessionStorage, RACE_REACTIONS_KEY, reactedByKey);
  };

  const hasReacted = (postId, reactionKey) => {
    return Boolean(reactedByKey[`${postId}:${reactionKey}`]);
  };

  const setReactionState = (postId, reactionKey, isActive) => {
    const key = `${postId}:${reactionKey}`;
    if (isActive) {
      reactedByKey[key] = true;
    } else {
      delete reactedByKey[key];
    }
    persistReactions();
  };

  const getReactionCount = (item, reactionKey) => {
    const base = Math.max(0, Number(item.reactions?.[reactionKey]) || 0);
    const localBoost = hasReacted(item.id, reactionKey) ? 1 : 0;
    return base + localBoost;
  };

  const setActiveFilter = (filterKey) => {
    raceCenterState.activeFilter = filterKey;
    raceFilters.forEach((btn) => {
      const isActive = btn.getAttribute("data-race-filter") === filterKey;
      btn.classList.toggle("is-active", isActive);
      btn.setAttribute("aria-pressed", isActive ? "true" : "false");
    });
  };

  const renderFeed = () => {
    if (!feed) return;

    const list = [...raceCenterState.feed]
      .filter((item) => raceCenterState.activeFilter === "all" || item.category === raceCenterState.activeFilter)
      .sort((a, b) => parseDate(b.at) - parseDate(a.at));

    if (!list.length) {
      feed.innerHTML = `<article class="post article-fx is-visible"><div class="post-body">Keine Updates fuer diesen Filter.</div></article>`;
      return;
    }

    feed.innerHTML = list.map((item) => {
      const categoryLabel = categoryLabels[item.category] || "Rennen";
      const reactionHtml = reactionConfig.map((reaction) => {
        const reacted = hasReacted(item.id, reaction.key);
        const count = getReactionCount(item, reaction.key);
        return `
          <button
            class="reaction-btn${reacted ? " is-selected" : ""}"
            type="button"
            data-react-id="${escapeHtml(item.id)}"
            data-react-key="${escapeHtml(reaction.key)}"
            aria-label="${escapeHtml(reaction.label)} reagieren"
          >
            <span>${reaction.icon}</span>
            <span class="reaction-count">${count}</span>
          </button>
        `;
      }).join("");

      return `
        <article class="post article-fx is-visible">
          <div class="post-top">
            <div class="post-title-wrap">
              <span class="feed-tag" data-category="${escapeHtml(item.category)}">${escapeHtml(categoryLabel)}</span>
              <div class="post-title">${escapeHtml(item.title)}</div>
            </div>
            <div class="post-time">${formatDateTime(item.at)}</div>
          </div>
          <div class="post-body">${escapeHtml(item.body)}</div>
          <div class="post-reactions">${reactionHtml}</div>
        </article>
      `;
    }).join("");
  };

  const getLocalPollOptionVotes = (poll, option) => {
    const baseVotes = Math.max(0, Number(option?.votes) || 0);
    const localVote = pollVotesById[poll.id] === option.id ? 1 : 0;
    return baseVotes + localVote;
  };

  const renderPolls = () => {
    if (!racePollsList) return;

    if (!raceCenterState.polls.length) {
      racePollsList.innerHTML = `<p class="small muted">Aktuell keine aktiven Polls.</p>`;
      return;
    }

    racePollsList.innerHTML = raceCenterState.polls.map((poll) => {
      const selectedOption = pollVotesById[poll.id] || "";
      const totalVotes = poll.options.reduce((sum, option) => sum + getLocalPollOptionVotes(poll, option), 0);

      const optionsHtml = poll.options.map((option) => {
        const votes = getLocalPollOptionVotes(poll, option);
        const ratio = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
        const isSelected = selectedOption === option.id;

        return `
          <button
            class="poll-option${isSelected ? " is-selected" : ""}"
            type="button"
            data-poll-id="${escapeHtml(poll.id)}"
            data-option-id="${escapeHtml(option.id)}"
          >
            <span class="poll-option-line">
              <span>${escapeHtml(option.label)}</span>
              <span>${votes} (${ratio}%)</span>
            </span>
            <span class="poll-option-bar"><span style="width:${ratio}%"></span></span>
          </button>
        `;
      }).join("");

      return `
        <article class="poll-card">
          <p class="poll-question">${escapeHtml(poll.question)}</p>
          <div class="poll-options">${optionsHtml}</div>
          <p class="small muted poll-meta">${totalVotes} Stimmen gesamt (lokal)</p>
        </article>
      `;
    }).join("");
  };

  const loadManualRaceCenter = ({ silent = false } = {}) => {
    if (!silent) {
      setRaceFeedStatus("Race Center wird aktualisiert ...");
    }

    const data = getManualRaceCenterData();
    raceCenterState.feed = data.feedItems;
    raceCenterState.polls = data.polls;

    updateSummaryUi(data.summary);
    renderFeed();
    renderPolls();

    if (!raceCenterState.feed.length) {
      setRaceFeedStatus("Lokales Race Center bereit. Updates in assets/js/mainpage-config.js unter raceCenter pflegen.");
      return;
    }

    const latest = getLastManualUpdate(raceCenterState.feed);
    setRaceFeedStatus(`Lokales Race Center • zuletzt ${formatDateTime(latest?.at)}.`);
  };

  const submitReaction = (postId, reactionKey) => {
    if (!postId || !reactionKey) return;

    const wasActive = hasReacted(postId, reactionKey);
    setReactionState(postId, reactionKey, !wasActive);
    renderFeed();
    setRaceFeedStatus(wasActive ? "Reaktion entfernt (lokal)." : "Reaktion gespeichert (lokal).");
  };

  const submitPollVote = (pollId, optionId) => {
    if (!pollId || !optionId) return;

    const poll = raceCenterState.polls.find((entry) => entry.id === pollId);
    if (!poll || !poll.options.some((entry) => entry.id === optionId)) return;

    const currentOption = String(pollVotesById[pollId] || "");
    if (currentOption === optionId) {
      delete pollVotesById[pollId];
      setRaceFeedStatus("Vote entfernt (lokal).");
    } else {
      pollVotesById[pollId] = optionId;
      setRaceFeedStatus("Vote gespeichert (lokal).");
    }

    persistPollVotes();
    renderPolls();
  };

  if (feed) {
    setActiveFilter("all");
    renderFeed();
    renderPolls();

    raceFilters.forEach((btn) => {
      btn.addEventListener("click", () => {
        const key = btn.getAttribute("data-race-filter") || "all";
        setActiveFilter(key);
        renderFeed();
      });
    });

    feed.addEventListener("click", (e) => {
      const btn = e.target instanceof Element ? e.target.closest("[data-react-id][data-react-key]") : null;
      if (!(btn instanceof HTMLButtonElement)) return;
      const postId = btn.getAttribute("data-react-id") || "";
      const reactionKey = btn.getAttribute("data-react-key") || "";
      submitReaction(postId, reactionKey);
    });

    racePollsList?.addEventListener("click", (e) => {
      const btn = e.target instanceof Element ? e.target.closest("[data-poll-id][data-option-id]") : null;
      if (!(btn instanceof HTMLButtonElement)) return;
      const pollId = btn.getAttribute("data-poll-id") || "";
      const optionId = btn.getAttribute("data-option-id") || "";
      submitPollVote(pollId, optionId);
    });

    loadManualRaceCenter({ silent: false });
  }
  // ---- Contact form: local mail client ----
  const form = document.getElementById("contactForm");
  if (form) {
    const formHint = document.getElementById("formHint");
    const submitBtn = form.querySelector("button[type='submit']");
    const initialHint = formHint?.textContent || "";

    const openContactMailClient = ({ name, email, topic, msg }) => {
      const to = toText(siteConfig.contact.formMailTo || siteConfig.contact.primaryEmail, DEFAULT_MAINPAGE_CONFIG.contact.formMailTo);
      const subject = encodeURIComponent(
        `[Kontakt] ${topic || "Anfrage"} – ${name || "Website"}`
      );
      const body = encodeURIComponent(
        [
          `Name: ${name || "-"}`,
          `E-Mail: ${email || "-"}`,
          `Thema: ${topic || "-"}`,
          "",
          "Nachricht:",
          msg || "-",
          "",
          "Gesendet über das Kontaktformular.",
        ].join("\n")
      );
      window.location.href = `mailto:${to}?subject=${subject}&body=${body}`;
    };

    form.addEventListener("submit", (e) => {
      e.preventDefault();

      const name = $("#name")?.value?.trim() || "";
      const email = $("#email")?.value?.trim() || "";
      const topic = $("#topic")?.value || "Kontakt";
      const msg = $("#msg")?.value?.trim() || "";

      if (submitBtn instanceof HTMLButtonElement) {
        submitBtn.disabled = true;
      }
      if (formHint) {
        formHint.textContent = "Senden ...";
      }

      openContactMailClient({ name, email, topic, msg });
      if (formHint) {
        formHint.textContent = "E-Mail-Client geöffnet. Bitte Nachricht dort absenden.";
      }
      if (submitBtn instanceof HTMLButtonElement) {
        submitBtn.disabled = false;
      }
      if (formHint && initialHint) {
        window.setTimeout(() => {
          if (formHint.textContent !== initialHint) {
            formHint.textContent = initialHint;
          }
        }, 7000);
      }
    });
  }
})();

