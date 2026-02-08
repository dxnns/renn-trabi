/* =========================
   Sponsoring Anfrage – JS
   ========================= */

(() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
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

  // ---- Reveal cards/items on scroll ----
  const sectionArticles = $$("main > section article[class]");
  sectionArticles.forEach((article) => {
    article.classList.add("article-fx", "reveal");
  });

  const revealEls = $$(".reveal");
  sections.forEach((section) => {
    $$(".reveal", section).forEach((el, idx) => {
      el.style.setProperty("--reveal-delay", `${Math.min(idx * 55, 220)}ms`);
    });
  });

  if (reduceMotion || !("IntersectionObserver" in window)) {
    revealEls.forEach((el) => el.classList.add("is-visible"));
  } else {
    const revealIO = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -5% 0px" });

    revealEls.forEach((el) => revealIO.observe(el));
  }

  const planCards = $$(".plan-card");
  const amountRange = $("[data-amount-range]");
  const amountValue = $("[data-amount-value]");
  const impactTag = $("[data-impact-tag]");
  const amountChips = $$("[data-amount-chip]");
  const fundingBar = $("[data-funding-bar]");
  const fundingValue = $("[data-funding-value]");

  const summaryPlan = $("[data-summary-plan]");
  const summaryRecommended = $("[data-summary-recommended]");
  const summaryAmount = $("[data-summary-amount]");
  const summaryVisibility = $("[data-summary-visibility]");
  const summaryImpact = $("[data-summary-impact]");
  const summaryNote = $("[data-summary-note]");

  const selectedPlanInput = $("#selectedPlan");
  const selectedAmountInput = $("#selectedAmount");
  const sponsorForm = $("#sponsorForm");

  const state = {
    selectedPlan: "Bronze",
    amount: Number(amountRange?.value || 1200),
  };

  const planMeta = {
    Bronze: {
      minAmount: 450,
      visibility: "Website + Update-Erwähnung",
      note: "Solider Einstieg mit klarer Sichtbarkeit in der Community.",
    },
    Silber: {
      minAmount: 1100,
      visibility: "Website + Fahrzeugbereich + Content",
      note: "Ausgewogene Mischung aus Reichweite und Markenpräsenz.",
    },
    Gold: {
      minAmount: 2200,
      visibility: "Prominente Platzierung + Co-Branding",
      note: "Maximale Sichtbarkeit und enge Zusammenarbeit.",
    },
  };

  const formatEUR = (value) =>
    new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 }).format(value);

  const getPlanForAmount = (amount) => {
    if (amount >= planMeta.Gold.minAmount) return "Gold";
    if (amount >= planMeta.Silber.minAmount) return "Silber";
    return "Bronze";
  };

  const getRecommendedPlan = (amount) => {
    return getPlanForAmount(amount);
  };

  const normalizeAmount = (value) => {
    const min = Number(amountRange?.min || 300);
    const max = Number(amountRange?.max || 5000);
    const step = Number(amountRange?.step || 50);
    const raw = Number(value);
    const safe = Number.isFinite(raw) ? raw : min;
    const clamped = Math.max(min, Math.min(max, safe));
    return Math.round(clamped / step) * step;
  };

  const getImpactTag = (amount) => {
    if (amount < 900) return "Starter-Sichtbarkeit";
    if (amount < 2200) return "Gute Strecken-Sichtbarkeit";
    if (amount < 3500) return "Starker Markenauftritt";
    return "Headline-Partner Potenzial";
  };

  const getImpactDetail = (amount) => {
    const slots = Math.max(3, Math.round(amount / 150));
    return `ca. ${slots} Setup-Slots abgesichert`;
  };

  const setSelectedPlan = (planName) => {
    if (!planMeta[planName]) return;
    state.selectedPlan = planName;
    planCards.forEach(card => {
      const isSelected = card.getAttribute("data-plan") === planName;
      card.classList.toggle("is-selected", isSelected);
    });
    if (selectedPlanInput) selectedPlanInput.value = planName;
  };

  const setAmount = (value, { syncPlanFromAmount = true } = {}) => {
    const normalized = normalizeAmount(value);
    state.amount = normalized;
    if (amountRange) amountRange.value = String(normalized);
    if (syncPlanFromAmount) {
      setSelectedPlan(getPlanForAmount(normalized));
    }
  };

  const updateBudgetUI = () => {
    const amount = normalizeAmount(state.amount);
    state.amount = amount;
    const recommended = getRecommendedPlan(amount);
    const activeMeta = planMeta[state.selectedPlan] || planMeta.Bronze;

    if (amountValue) amountValue.textContent = formatEUR(amount);
    if (summaryAmount) summaryAmount.textContent = formatEUR(amount);
    if (summaryPlan) summaryPlan.textContent = state.selectedPlan;
    if (summaryRecommended) summaryRecommended.textContent = recommended;
    if (summaryVisibility) summaryVisibility.textContent = activeMeta.visibility;
    if (summaryImpact) summaryImpact.textContent = getImpactDetail(amount);
    if (summaryNote) summaryNote.textContent = activeMeta.note;
    if (impactTag) impactTag.textContent = getImpactTag(amount);
    if (selectedAmountInput) selectedAmountInput.value = String(amount);

    amountChips.forEach(chip => {
      const chipValue = Number(chip.getAttribute("data-amount-chip"));
      chip.classList.toggle("is-active", chipValue === amount);
    });
  };

  planCards.forEach(card => {
    card.addEventListener("click", () => {
      const planName = card.getAttribute("data-plan");
      if (!planName) return;
      setSelectedPlan(planName);
      setAmount(planMeta[planName].minAmount, { syncPlanFromAmount: false });
      updateBudgetUI();
    });
  });

  if (amountRange) {
    amountRange.addEventListener("input", () => {
      setAmount(Number(amountRange.value), { syncPlanFromAmount: true });
      updateBudgetUI();
    });
  }

  amountChips.forEach(chip => {
    chip.addEventListener("click", () => {
      const amount = Number(chip.getAttribute("data-amount-chip"));
      if (!amount) return;
      setAmount(amount, { syncPlanFromAmount: true });
      updateBudgetUI();
    });
  });

  const animateNumber = ({ from = 0, to = 0, duration = 900, onFrame, onDone }) => {
    const start = performance.now();
    const delta = to - from;

    const step = (now) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = from + delta * eased;
      if (typeof onFrame === "function") onFrame(current);
      if (progress < 1) {
        requestAnimationFrame(step);
        return;
      }
      if (typeof onDone === "function") onDone();
    };

    requestAnimationFrame(step);
  };

  // ---- Hero metrics + funding animation ----
  const heroMetrics = $$("[data-metric-target]");
  const fundingTarget = Number(fundingBar?.getAttribute("data-target")) || 68;

  const renderMetricValue = (el, value) => {
    const target = Number(el.getAttribute("data-metric-target")) || 0;
    const safeValue = Math.max(0, Math.min(target, Math.round(value)));
    const format = el.getAttribute("data-metric-format") || "number";

    if (format === "ratio") {
      const total = Number(el.getAttribute("data-metric-total")) || 12;
      el.textContent = `${safeValue}/${total}`;
      return;
    }

    if (format === "percent") {
      el.textContent = `${safeValue}%`;
      return;
    }

    el.textContent = String(safeValue);
  };

  const animateHeroStats = () => {
    heroMetrics.forEach((el) => {
      const target = Number(el.getAttribute("data-metric-target")) || 0;
      if (reduceMotion) {
        renderMetricValue(el, target);
        return;
      }

      animateNumber({
        from: 0,
        to: target,
        duration: target > 999 ? 1200 : 900,
        onFrame: (value) => {
          renderMetricValue(el, value);
        },
        onDone: () => {
          renderMetricValue(el, target);
        },
      });
    });

    if (!fundingBar) return;

    const target = Math.max(0, Math.min(100, fundingTarget));
    if (reduceMotion) {
      fundingBar.style.width = `${target}%`;
      if (fundingValue) fundingValue.textContent = `${target}%`;
      return;
    }

    const previousTransition = fundingBar.style.transition;
    fundingBar.style.transition = "none";
    fundingBar.style.width = "0%";
    if (fundingValue) fundingValue.textContent = "0%";

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        fundingBar.style.transition = previousTransition;
        fundingBar.style.width = `${target}%`;
      });
    });

    animateNumber({
      from: 0,
      to: target,
      duration: 1000,
      onFrame: (value) => {
        if (fundingValue) fundingValue.textContent = `${Math.round(value)}%`;
      },
      onDone: () => {
        if (fundingValue) fundingValue.textContent = `${target}%`;
      },
    });
  };

  animateHeroStats();

  if (sponsorForm) {
    const formHint = sponsorForm.querySelector(".form-actions .muted.small");
    const submitBtn = sponsorForm.querySelector("button[type='submit']");
    const initialHint = formHint?.textContent || "";
    const formStartedAt = Date.now();

    const openMailFallback = ({ name, company, email, phone, startWindow, interests, message }) => {
      const to = "sponsoring@bembelracingteam.de";
      const subject = encodeURIComponent(
        `[Sponsoring] ${company || "Anfrage"} – ${state.selectedPlan} (${formatEUR(state.amount)} EUR)`
      );
      const body = encodeURIComponent(
        [
          `Name: ${name}`,
          `Unternehmen: ${company}`,
          `E-Mail: ${email}`,
          `Telefon: ${phone || "-"}`,
          `Paket: ${state.selectedPlan}`,
          `Budget: ${formatEUR(state.amount)} EUR`,
          `Startzeitraum: ${startWindow}`,
          `Interessen: ${interests.length ? interests.join(", ") : "-"}`,
          "",
          "Nachricht:",
          message || "-",
          "",
          "Gesendet über die Sponsoring-Anfrage-Seite.",
        ].join("\n")
      );

      window.location.href = `mailto:${to}?subject=${subject}&body=${body}`;
    };

    sponsorForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const name = $("#sponsorName")?.value?.trim() || "";
      const company = $("#sponsorCompany")?.value?.trim() || "";
      const email = $("#sponsorMail")?.value?.trim() || "";
      const phone = $("#sponsorPhone")?.value?.trim() || "";
      const startWindow = $("#startWindow")?.value || "Nach Absprache";
      const message = $("#sponsorMsg")?.value?.trim() || "";
      const interests = $$("input[name='interest']:checked", sponsorForm).map(i => i.value);

      if (submitBtn instanceof HTMLButtonElement) {
        submitBtn.disabled = true;
      }
      if (formHint) {
        formHint.textContent = "Senden ...";
      }

      try {
        const response = await fetch("/api/leads/sponsor", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({
            name,
            company,
            email,
            phone,
            selectedPlan: state.selectedPlan,
            selectedAmount: state.amount,
            startWindow,
            interests,
            message,
            website: "",
            pagePath: window.location.pathname,
            formStartedAt,
          }),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        sponsorForm.reset();
        if (amountRange) amountRange.value = String(state.amount);
        setSelectedPlan(state.selectedPlan);
        updateBudgetUI();
        if (formHint) {
          formHint.textContent = "Danke! Anfrage erfolgreich übermittelt.";
        }
      } catch {
        openMailFallback({ name, company, email, phone, startWindow, interests, message });
        if (formHint) {
          formHint.textContent = "API aktuell nicht erreichbar. E-Mail-Client wird geöffnet.";
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

  setAmount(state.amount, { syncPlanFromAmount: true });
  updateBudgetUI();
})();
