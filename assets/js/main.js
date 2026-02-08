/* =========================
   Bembel Racing Team – JS
   ========================= */

(() => {
  // ---- Config: Race Date/Time (Europe/Berlin) ----
  // Setze das echte Datum hier:
  // Beispiel: 2026-08-15T10:00:00 (lokale Zeit des Browsers)
  const RACE_START_LOCAL = "2026-08-15T10:00:00";
  const RACE_LOCATION = "Sachsen";

  // ---- Helpers ----
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const isMobileDevice = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || "");
  const apiBaseMeta = $('meta[name="api-base"]')?.getAttribute("content")?.trim() || "";
  const apiBaseByHost =
    window.location.hostname === "www.bembelracingteam.de" || window.location.hostname === "bembelracingteam.de"
      ? "https://api.bembelracingteam.de"
      : "";
  const apiBase = apiBaseMeta || apiBaseByHost;
  const mailFallbackEnabled =
    (($('meta[name="mail-fallback-enabled"]')?.getAttribute("content") || "").trim().toLowerCase() === "true");
  const toApiUrl = (path) => {
    if (!apiBase) return path;
    try {
      return new URL(path, `${apiBase.replace(/\/+$/, "")}/`).toString();
    } catch {
      return path;
    }
  };

  // ---- Instagram links (prefer app on mobile, fallback to web) ----
  const instagramLinks = $$("[data-instagram-link]");
  if (instagramLinks.length) {
    const instaWebUrl = "https://www.instagram.com/bembelracingteam/";
    const instaAppUrl = "instagram://user?username=bembelracingteam";

    instagramLinks.forEach((linkEl) => {
      if (!(linkEl instanceof HTMLAnchorElement)) return;
      linkEl.href = instaWebUrl;
      linkEl.rel = "noopener noreferrer";

      if (!isMobileDevice) {
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

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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

  // ---- Section build on scroll ----
  const sections = $$("main > section");
  if (sections.length) {
    const viewportH = window.innerHeight || document.documentElement.clientHeight;
    const pendingSections = [];

    sections.forEach((section) => {
      section.classList.add("scroll-section");
      const rect = section.getBoundingClientRect();
      const initiallyVisible = rect.top < viewportH * 0.88 && rect.bottom > 0;
      if (initiallyVisible || reduceMotion) {
        section.classList.add("is-built");
      } else {
        pendingSections.push(section);
      }
    });

    if (!reduceMotion && pendingSections.length && "IntersectionObserver" in window) {
      const sectionIO = new IntersectionObserver((entries, observer) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-built");
          observer.unobserve(entry.target);
        });
      }, { threshold: 0.18, rootMargin: "0px 0px -8% 0px" });

      pendingSections.forEach((section) => sectionIO.observe(section));
    } else {
      pendingSections.forEach((section) => section.classList.add("is-built"));
    }
  }

  // ---- Reveal on scroll ----
  const sectionArticles = $$("main > section article[class]");
  sectionArticles.forEach((article) => {
    article.classList.add("article-fx", "reveal");
  });

  const revealEls = $$(".reveal");
  sections.forEach((section) => {
    $$(".reveal", section).forEach((el, idx) => {
      el.style.setProperty("--reveal-delay", `${Math.min(idx * 45, 180)}ms`);
    });
  });

  if (reduceMotion || !("IntersectionObserver" in window)) {
    revealEls.forEach((el) => el.classList.add("is-visible"));
  } else {
    const io = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -5% 0px" });
    revealEls.forEach((el) => io.observe(el));
  }

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
        else setRaceStatus("Live / läuft");
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
      else setRaceStatus("In Vorbereitung");
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
  const joinTrigger = document.querySelector("[data-team-join-trigger]");
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

  if (joinTrigger && joinModal) {
    joinTrigger.addEventListener("click", openJoinModal);

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

  const escapeHtml = (s) =>
    String(s).replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));

  // ---- Race Center ----
  const feed = document.querySelector("[data-feed]");
  const raceFeedStatusEl = document.querySelector("[data-race-feed-status]");
  const raceRefreshBtn = document.querySelector("[data-race-refresh]");
  const raceFilters = $$("[data-race-filter]");
  const raceFollowToggle = document.querySelector("[data-race-follow-toggle]");
  const raceFollowHint = document.querySelector("[data-race-follow-hint]");
  const racePollsList = document.querySelector("[data-race-polls-list]");
  const raceLastUpdateEl = document.querySelector("[data-race-lastupdate]");
  const raceNextMilestoneEl = document.querySelector("[data-race-nextmilestone]");

  const FOLLOW_MODE_KEY = "bembel_race_follow_mode";
  const RACE_VOTER_KEY = "bembel_race_voter_id";
  const RACE_POLL_VOTES_KEY = "bembel_race_poll_votes";
  const RACE_REACTIONS_KEY = "bembel_race_reactions";
  const RACE_LAST_SEEN_KEY = "bembel_race_last_seen_at";
  const RACE_FEED_CACHE_KEY = "bembel_race_feed_cache";
  const RACE_POLLS_CACHE_KEY = "bembel_race_polls_cache";

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

  const getStorageBool = (storage, key, fallback = false) => {
    if (!storage) return fallback;
    try {
      const value = storage.getItem(key);
      if (value === "1") return true;
      if (value === "0") return false;
      return fallback;
    } catch {
      return fallback;
    }
  };

  const setStorageBool = (storage, key, value) => {
    if (!storage) return;
    try {
      storage.setItem(key, value ? "1" : "0");
    } catch {}
  };

  const getOrCreateVoterId = () => {
    try {
      const existing = safeLocalStorage?.getItem(RACE_VOTER_KEY);
      if (existing) return existing;
      const generated = typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `race-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      safeLocalStorage?.setItem(RACE_VOTER_KEY, generated);
      return generated;
    } catch {
      return `race-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    }
  };

  const voterId = getOrCreateVoterId();
  const pollVotesById = readJsonStorage(safeLocalStorage, RACE_POLL_VOTES_KEY, {});
  const reactedByKey = readJsonStorage(safeSessionStorage, RACE_REACTIONS_KEY, {});

  const raceCenterState = {
    activeFilter: "all",
    feed: [],
    polls: [],
    hasApiData: false,
    followMode: getStorageBool(safeLocalStorage, FOLLOW_MODE_KEY, false),
    lastFeedAt: "",
    refreshTimer: 0,
    offlineMode: false,
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
      status: String(poll?.status || "active"),
      expiresAt: String(poll?.expiresAt || ""),
    };
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
      raceNextMilestoneEl.textContent = nextMilestone || "Nächster Check folgt";
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

  const persistFeedCache = () => {
    writeJsonStorage(safeLocalStorage, RACE_FEED_CACHE_KEY, raceCenterState.feed.slice(-40));
  };

  const persistPollsCache = () => {
    writeJsonStorage(safeLocalStorage, RACE_POLLS_CACHE_KEY, raceCenterState.polls.slice(0, 10));
  };

  const loadFeedCache = () => {
    return readJsonStorage(safeLocalStorage, RACE_FEED_CACHE_KEY, [])
      .map(normalizeFeedItem)
      .filter(Boolean);
  };

  const loadPollsCache = () => {
    return readJsonStorage(safeLocalStorage, RACE_POLLS_CACHE_KEY, [])
      .map(normalizePoll)
      .filter(Boolean);
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

  const updateFollowUi = () => {
    if (!raceFollowToggle || !raceFollowHint) return;

    raceFollowToggle.classList.toggle("is-on", raceCenterState.followMode);
    raceFollowToggle.setAttribute("aria-pressed", raceCenterState.followMode ? "true" : "false");
    raceFollowToggle.textContent = raceCenterState.followMode ? "Follow Mode: An" : "Follow Mode: Aus";
    if (raceCenterState.followMode && raceCenterState.offlineMode) {
      raceFollowHint.textContent = "Follow Mode aktiv im lokalen Modus. Live-API wird automatisch weiter geprüft.";
      return;
    }
    raceFollowHint.textContent = raceCenterState.followMode
      ? "Follow Mode aktiv: Race Center prüft automatisch auf neue Updates."
      : "Follow Mode aus. Aktivieren für automatische Live-Updates.";
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
      feed.innerHTML = `<article class="post article-fx is-visible"><div class="post-body">Keine Updates für diesen Filter.</div></article>`;
      return;
    }

    feed.innerHTML = list.map((item) => {
      const categoryLabel = categoryLabels[item.category] || "Rennen";
      const reactionHtml = reactionConfig.map((reaction) => {
        const reacted = hasReacted(item.id, reaction.key);
        const count = Math.max(0, Number(item.reactions?.[reaction.key]) || 0);
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

  const renderPolls = () => {
    if (!racePollsList) return;

    if (!raceCenterState.polls.length) {
      racePollsList.innerHTML = `<p class="small muted">Aktuell keine aktiven Polls.</p>`;
      return;
    }

    racePollsList.innerHTML = raceCenterState.polls.map((poll) => {
      const selectedOption = pollVotesById[poll.id] || "";
      const totalVotes = poll.totalVotes || poll.options.reduce((sum, option) => sum + option.votes, 0);

      const optionsHtml = poll.options.map((option) => {
        const ratio = totalVotes > 0 ? Math.round((option.votes / totalVotes) * 100) : 0;
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
              <span>${option.votes} (${ratio}%)</span>
            </span>
            <span class="poll-option-bar"><span style="width:${ratio}%"></span></span>
          </button>
        `;
      }).join("");

      return `
        <article class="poll-card">
          <p class="poll-question">${escapeHtml(poll.question)}</p>
          <div class="poll-options">${optionsHtml}</div>
          <p class="small muted poll-meta">${totalVotes} Stimmen gesamt</p>
        </article>
      `;
    }).join("");
  };

  const fetchJson = async (url, init = {}) => {
    const response = await fetch(toApiUrl(url), {
      ...init,
      credentials: "same-origin",
      headers: {
        ...(init.headers || {}),
      },
    });

    let payload = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    if (!response.ok) {
      const err = new Error(payload?.error || `http_${response.status}`);
      err.status = response.status;
      err.payload = payload;
      throw err;
    }

    return payload;
  };

  const mergeFeedItem = (incoming) => {
    const normalized = normalizeFeedItem(incoming);
    if (!normalized) return;
    const idx = raceCenterState.feed.findIndex((item) => item.id === normalized.id);
    if (idx === -1) {
      raceCenterState.feed.push(normalized);
    } else {
      raceCenterState.feed[idx] = normalized;
    }
  };

  const upsertPoll = (incomingPoll) => {
    const normalized = normalizePoll(incomingPoll);
    if (!normalized) return;
    const idx = raceCenterState.polls.findIndex((poll) => poll.id === normalized.id);
    if (idx === -1) raceCenterState.polls.push(normalized);
    else raceCenterState.polls[idx] = normalized;
  };

  const rememberLastSeen = (timestamp) => {
    if (!timestamp) return;
    try {
      safeLocalStorage?.setItem(RACE_LAST_SEEN_KEY, timestamp);
    } catch {}
  };

  const getLastSeen = () => {
    try {
      return safeLocalStorage?.getItem(RACE_LAST_SEEN_KEY) || "";
    } catch {
      return "";
    }
  };

  const highlightFollowNews = () => {
    if (!raceFollowToggle) return;
    raceFollowToggle.classList.add("has-news");
    window.setTimeout(() => {
      raceFollowToggle.classList.remove("has-news");
    }, 2600);
  };

  const getApiFailureHint = (err) => {
    if (window.location.protocol === "file:") {
      return "Die Seite wird als lokale Datei geöffnet. API-Routen funktionieren nur über den Node-Server.";
    }
    if (!navigator.onLine) {
      return "Es besteht aktuell keine Netzwerkverbindung.";
    }
    if (Number.isFinite(err?.status)) {
      return `Backend antwortet mit HTTP ${err.status}.`;
    }
    if (apiBase) {
      return `Backend nicht erreichbar unter ${apiBase}.`;
    }
    return "Backend nicht erreichbar. Starte den Server mit `npm run dev` und öffne die Seite über `http://127.0.0.1:8080/`.";
  };

  const loadRaceSummary = async () => {
    try {
      const payload = await fetchJson("/api/race/summary");
      updateSummaryUi(payload?.summary);
    } catch {}
  };

  const loadRaceFeed = async ({ silent = false } = {}) => {
    if (!silent) {
      setRaceFeedStatus("Race Center lädt ...");
    }

    try {
      const payload = await fetchJson("/api/race/feed?limit=40");
      const items = Array.isArray(payload?.items)
        ? payload.items.map(normalizeFeedItem).filter(Boolean)
        : [];

      const previousLast = raceCenterState.lastFeedAt;
      raceCenterState.feed = items;
      raceCenterState.hasApiData = true;
      raceCenterState.offlineMode = false;

      const sortedNewest = [...items].sort((a, b) => parseDate(b.at) - parseDate(a.at));
      const newestAt = sortedNewest[0]?.at || "";
      raceCenterState.lastFeedAt = newestAt;
      renderFeed();
      persistFeedCache();
      updateFollowUi();

      if (!newestAt) {
        setRaceFeedStatus("Noch keine Race-Updates.");
        return;
      }

      if (raceCenterState.followMode) {
        const lastSeen = getLastSeen();
        const hasNewSinceSeen = Number.isFinite(parseDate(lastSeen)) && parseDate(newestAt) > parseDate(lastSeen);
        const hasNewSinceRefresh = Number.isFinite(parseDate(previousLast)) && parseDate(newestAt) > parseDate(previousLast);
        if (hasNewSinceSeen || hasNewSinceRefresh) {
          setRaceFeedStatus("Neue Pitwall-Updates eingetroffen.");
          highlightFollowNews();
        } else {
          setRaceFeedStatus(`Live aktiv • zuletzt ${formatDateTime(newestAt)}`);
        }
      } else {
        setRaceFeedStatus(`Zuletzt aktualisiert: ${formatDateTime(newestAt)}`);
      }

      rememberLastSeen(newestAt);
    } catch (err) {
      raceCenterState.offlineMode = true;
      updateFollowUi();

      if (!raceCenterState.hasApiData) {
        const cachedFeed = loadFeedCache();
        raceCenterState.feed = cachedFeed;
        renderFeed();
      }

      if (raceCenterState.followMode) {
        setRaceFeedStatus("Follow Mode aktiv • lokaler Modus (Live-API derzeit nicht erreichbar).");
      } else {
        setRaceFeedStatus("Lokaler Modus aktiv. Letzte bekannte Daten werden angezeigt.");
      }

      const hint = getApiFailureHint(err);
      if (hint) {
        setRaceFeedStatus(
          raceCenterState.followMode
            ? `Follow Mode aktiv • lokaler Modus. ${hint}`
            : `Lokaler Modus aktiv. ${hint}`
        );
      }
    }
  };

  const loadRacePolls = async () => {
    try {
      const payload = await fetchJson("/api/race/polls/active");
      raceCenterState.polls = Array.isArray(payload?.polls)
        ? payload.polls.map(normalizePoll).filter(Boolean)
        : [];
      renderPolls();
      persistPollsCache();
    } catch {
      if (!raceCenterState.polls.length) {
        const cachedPolls = loadPollsCache();
        if (cachedPolls.length) {
          raceCenterState.polls = cachedPolls;
          renderPolls();
        } else {
          racePollsList && (racePollsList.innerHTML = `<p class="small muted">Polls aktuell nicht verfügbar.</p>`);
        }
      }
    }
  };

  const refreshRaceCenter = async ({ silent = false } = {}) => {
    await Promise.all([
      loadRaceSummary(),
      loadRaceFeed({ silent }),
      loadRacePolls(),
    ]);
  };

  const startRaceRefreshLoop = () => {
    window.clearInterval(raceCenterState.refreshTimer);
    const intervalMs = raceCenterState.followMode ? 20_000 : 45_000;
    raceCenterState.refreshTimer = window.setInterval(() => {
      void refreshRaceCenter({ silent: true });
    }, intervalMs);
  };

  const submitReaction = async (postId, reactionKey) => {
    if (!postId || !reactionKey) return;

    const applyLocalReactionToggle = () => {
      const item = raceCenterState.feed.find((entry) => entry.id === postId);
      if (!item || !item.reactions || typeof item.reactions !== "object") return false;
      const wasActive = hasReacted(postId, reactionKey);
      if (wasActive) {
        item.reactions[reactionKey] = Math.max(0, (Number(item.reactions[reactionKey]) || 0) - 1);
        setReactionState(postId, reactionKey, false);
      } else {
        item.reactions[reactionKey] = Math.max(0, Number(item.reactions[reactionKey]) || 0) + 1;
        setReactionState(postId, reactionKey, true);
      }
      renderFeed();
      persistFeedCache();
      return wasActive ? "removed" : "added";
    };

    if (raceCenterState.offlineMode) {
      const offlineResult = applyLocalReactionToggle();
      if (offlineResult) {
        setRaceFeedStatus(
          offlineResult === "removed"
            ? "Reaktion entfernt (lokaler Modus)."
            : "Reaktion gespeichert (lokaler Modus)."
        );
        return;
      }
    }

    const wasActive = hasReacted(postId, reactionKey);

    try {
      const payload = await fetchJson(`/api/race/feed/${encodeURIComponent(postId)}/react`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reaction: reactionKey,
          voterId,
          action: "toggle",
        }),
      });

      if (payload?.item) {
        mergeFeedItem(payload.item);
      }
      const nowActive = typeof payload?.reacted === "boolean" ? payload.reacted : !wasActive;
      raceCenterState.offlineMode = false;
      setReactionState(postId, reactionKey, nowActive);
      renderFeed();
      persistFeedCache();
      updateFollowUi();
    } catch (err) {
      if (err?.status === 409 && err.payload?.item) {
        mergeFeedItem(err.payload.item);
        const nowActive = typeof err.payload?.reacted === "boolean" ? err.payload.reacted : hasReacted(postId, reactionKey);
        raceCenterState.offlineMode = false;
        setReactionState(postId, reactionKey, nowActive);
        renderFeed();
        persistFeedCache();
        updateFollowUi();
        return;
      }

      if (err?.status === 429) {
        setRaceFeedStatus("Zu viele Reaktionen in kurzer Zeit. Bitte kurz warten.", true);
        return;
      }

      raceCenterState.offlineMode = true;
      updateFollowUi();
      const offlineResult = applyLocalReactionToggle();
      if (offlineResult) {
        setRaceFeedStatus(
          offlineResult === "removed"
            ? "Reaktion entfernt (lokaler Modus)."
            : "Reaktion gespeichert (lokaler Modus)."
        );
        return;
      }

      setRaceFeedStatus("Reaktion konnte nicht gespeichert werden.", true);
    }
  };

  const submitPollVote = async (pollId, optionId) => {
    if (!pollId || !optionId) return;

    try {
      const payload = await fetchJson(`/api/race/polls/${encodeURIComponent(pollId)}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          optionId,
          voterId,
          action: "toggle",
        }),
      });

      const selectedOptionId = String(payload?.selectedOptionId || "").trim();
      if (selectedOptionId) {
        pollVotesById[pollId] = selectedOptionId;
      } else {
        delete pollVotesById[pollId];
      }
      persistPollVotes();
      if (payload?.poll) {
        upsertPoll(payload.poll);
      }
      raceCenterState.offlineMode = false;
      renderPolls();
      persistPollsCache();
      updateFollowUi();
    } catch (err) {
      if (err?.status === 409 && err.payload?.poll) {
        const selectedOptionId = String(err.payload?.selectedOptionId || "").trim();
        if (selectedOptionId) {
          pollVotesById[pollId] = selectedOptionId;
        } else {
          delete pollVotesById[pollId];
        }
        persistPollVotes();
        upsertPoll(err.payload.poll);
        raceCenterState.offlineMode = false;
        renderPolls();
        persistPollsCache();
        updateFollowUi();
        return;
      }
      raceCenterState.offlineMode = true;
      updateFollowUi();
      setRaceFeedStatus("Voting fehlgeschlagen. Bitte später erneut probieren.", true);
    }
  };

  if (feed) {
    setActiveFilter("all");
    updateFollowUi();
    renderFeed();
    renderPolls();

    raceFilters.forEach((btn) => {
      btn.addEventListener("click", () => {
        const key = btn.getAttribute("data-race-filter") || "all";
        setActiveFilter(key);
        renderFeed();
      });
    });

    raceRefreshBtn?.addEventListener("click", () => {
      void refreshRaceCenter({ silent: false });
    });

    raceFollowToggle?.addEventListener("click", () => {
      raceCenterState.followMode = !raceCenterState.followMode;
      setStorageBool(safeLocalStorage, FOLLOW_MODE_KEY, raceCenterState.followMode);
      updateFollowUi();
      startRaceRefreshLoop();
      setRaceFeedStatus(
        raceCenterState.followMode
          ? raceCenterState.offlineMode
            ? "Follow Mode aktiv • lokaler Modus."
            : "Follow Mode aktiv. Race Center aktualisiert automatisch."
          : "Follow Mode deaktiviert."
      );
    });

    feed.addEventListener("click", (e) => {
      const btn = e.target instanceof Element ? e.target.closest("[data-react-id][data-react-key]") : null;
      if (!(btn instanceof HTMLButtonElement)) return;
      const postId = btn.getAttribute("data-react-id") || "";
      const reactionKey = btn.getAttribute("data-react-key") || "";
      void submitReaction(postId, reactionKey);
    });

    racePollsList?.addEventListener("click", (e) => {
      const btn = e.target instanceof Element ? e.target.closest("[data-poll-id][data-option-id]") : null;
      if (!(btn instanceof HTMLButtonElement)) return;
      const pollId = btn.getAttribute("data-poll-id") || "";
      const optionId = btn.getAttribute("data-option-id") || "";
      void submitPollVote(pollId, optionId);
    });

    void refreshRaceCenter({ silent: false });
    startRaceRefreshLoop();
  }

  // ---- Contact form: backend lead submit ----
  const form = document.getElementById("contactForm");
  if (form) {
    const formHint = document.getElementById("formHint");
    const submitBtn = form.querySelector("button[type='submit']");
    const initialHint = formHint?.textContent || "";
    const formStartedAt = Date.now();

    const openContactMailFallback = ({ name, email, topic, msg }) => {
      const to = "kontakt@bembelracingteam.de";
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

    form.addEventListener("submit", async (e) => {
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

      try {
        const response = await fetch(toApiUrl("/api/leads/contact"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({
            name,
            email,
            topic,
            msg,
            website: "",
            pagePath: window.location.pathname,
            formStartedAt,
          }),
        });

        if (!response.ok) {
          const err = new Error(`HTTP ${response.status}`);
          err.status = response.status;
          throw err;
        }

        form.reset();
        if (formHint) {
          formHint.textContent = "Danke! Anfrage erfolgreich übermittelt.";
        }
      } catch (err) {
        if (err?.status === 429) {
          if (formHint) {
            formHint.textContent = "Zu viele Anfragen in kurzer Zeit. Bitte kurz warten.";
          }
          return;
        }

        if (mailFallbackEnabled) {
          openContactMailFallback({ name, email, topic, msg });
        }
        if (formHint) {
          const hint = getApiFailureHint(err);
          formHint.textContent = mailFallbackEnabled
            ? "API aktuell nicht erreichbar. E-Mail-Client wird geöffnet."
            : `Senden derzeit nicht möglich. ${hint}`;
        }
      } finally {
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
      }
    });
  }
})();
