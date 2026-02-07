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
    const statusEls = $$("[data-racestatus]");
    const start = raceStart;

    const pad = (n) => String(n).padStart(2, "0");
    const setRaceStatus = (text) => {
      statusEls.forEach(el => {
        el.textContent = text;
      });
    };

    const tick = () => {
      const now = new Date();
      const diff = start - now;

      if (diff <= 0) {
        if (dEl) dEl.textContent = "0";
        if (hEl) hEl.textContent = "00";
        if (mEl) mEl.textContent = "00";
        if (sEl) sEl.textContent = "00";
        setRaceStatus("Live / läuft");
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

      setRaceStatus("In Vorbereitung");
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

  const getGalleryImageButtons = () => {
    return galleryItems.filter(btn => !!btn.querySelector("img"));
  };

  const updateLightboxNav = () => {
    if (!prevBtn || !nextBtn) return;
    const items = getGalleryImageButtons();
    prevBtn.hidden = currentLightboxIndex <= 0 || items.length <= 1;
    nextBtn.hidden = currentLightboxIndex >= items.length - 1 || items.length <= 1;
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
      openLightboxByIndex(currentLightboxIndex + 1);
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

  // ---- Updates feed ----
  const feed = document.querySelector("[data-feed]");

  const defaultPosts = [
    { title: "Werkstatt", body: "Bremsen gecheckt, Schrauben nachgezogen, Checkliste aktualisiert.", time: Date.now() - 1000 * 60 * 60 * 26 },
    { title: "Setup", body: "Fahrwerk: kleine Anpassungen für stabileres Einlenken.", time: Date.now() - 1000 * 60 * 60 * 9 },
    { title: "Logistik", body: "Transport & Tool-Kisten finalisiert. Pit-Ablauf simuliert.", time: Date.now() - 1000 * 60 * 60 * 2 },
  ];

  const fmt = (t) => {
    const d = new Date(t);
    return d.toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  const renderFeed = () => {
    if (!feed) return;
    const posts = [...defaultPosts].sort((a,b) => b.time - a.time).slice(0, 6);
    feed.innerHTML = posts.map(p => `
      <article class="post article-fx is-visible">
        <div class="post-top">
          <div class="post-title">${escapeHtml(p.title)}</div>
          <div class="post-time">${fmt(p.time)}</div>
        </div>
        <div class="post-body">${escapeHtml(p.body)}</div>
      </article>
    `).join("");
  };

  const escapeHtml = (s) =>
    String(s).replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));

  renderFeed();

  // ---- Contact form: open mail client ----
  const form = document.getElementById("contactForm");
  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();

      const name = $("#name")?.value?.trim() || "";
      const email = $("#email")?.value?.trim() || "";
      const topic = $("#topic")?.value || "Kontakt";
      const msg = $("#msg")?.value?.trim() || "";

      const to = "kontakt@bembelracingteam.de";
      const subject = encodeURIComponent(`[${topic}] Anfrage über Website – ${name || "ohne Namen"}`);
      const body = encodeURIComponent(
        `Name: ${name}\nE-Mail: ${email}\nThema: ${topic}\n\nNachricht:\n${msg}\n\n—\nGesendet via Website`
      );

      window.location.href = `mailto:${to}?subject=${subject}&body=${body}`;
    });
  }
})();
