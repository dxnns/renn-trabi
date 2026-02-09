/* =========================
   Sponsoring Anfrage – JS
   ========================= */

(() => {
  const uiCore = window.BEMBEL_UI_CORE || {};
  const $ = typeof uiCore.q === "function"
    ? uiCore.q
    : (sel, root = document) => root.querySelector(sel);
  const $$ = typeof uiCore.qq === "function"
    ? uiCore.qq
    : (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const reduceMotion = typeof uiCore.getReduceMotion === "function"
    ? uiCore.getReduceMotion()
    : window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---- Section build + reveal (shared core) ----
  if (typeof uiCore.initializeSectionBuildAndReveal === "function") {
    uiCore.initializeSectionBuildAndReveal({
      delayStep: 55,
      delayCap: 220,
    });
  }

  const planCards = $$(".plan-card");
  const amountRange = $("[data-amount-range]");
  const amountValue = $("[data-amount-value]");
  const impactTag = $("[data-impact-tag]");
  const chipRow = $(".chip-row");
  const fundingBar = $("[data-funding-bar]");
  const fundingValue = $("[data-funding-value]");
  const metricRatioEl = $("[data-metric-format='ratio']");
  const metricPercentEl = $("[data-metric-format='percent']");
  const metricSeasonEl = $("[data-metric-format='number']");

  const summaryPlan = $("[data-summary-plan]");
  const summaryRecommended = $("[data-summary-recommended]");
  const summaryAmount = $("[data-summary-amount]");
  const summaryVisibility = $("[data-summary-visibility]");
  const summaryImpact = $("[data-summary-impact]");
  const summaryNote = $("[data-summary-note]");

  const selectedPlanInput = $("#selectedPlan");
  const selectedAmountInput = $("#selectedAmount");
  const sponsorForm = $("#sponsorForm");

  const asObject = (value) => (value && typeof value === "object" && !Array.isArray(value) ? value : {});
  const asArray = (value) => (Array.isArray(value) ? value : []);
  const toInt = (value, fallback) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.round(parsed) : fallback;
  };

  const DEFAULT_SPONSORING_CONFIG = {
    mailTo: "sponsoring@bembelracingteam.de",
    defaultPlan: "Bronze",
    defaultAmount: 1200,
    amountRange: {
      min: 300,
      max: 5000,
      step: 50,
    },
    amountChips: [600, 1200, 2500, 4000],
    planMeta: {
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
    },
    metrics: {
      partnerSlots: { used: 7, total: 12 },
      budgetPercent: 68,
      targetSeason: 2026,
      fundingPercent: 68,
    },
    impactRules: {
      starterMax: 899,
      goodMax: 2199,
      strongMax: 3499,
      slotsDivisor: 150,
      slotsMin: 3,
      tags: {
        starter: "Starter-Sichtbarkeit",
        good: "Gute Strecken-Sichtbarkeit",
        strong: "Starker Markenauftritt",
        headline: "Headline-Partner Potenzial",
      },
    },
  };

  const inputConfig = asObject(window.BEMBEL_SPONSORING_CONFIG);
  const inputRange = asObject(inputConfig.amountRange);
  const inputPlanMeta = asObject(inputConfig.planMeta);
  const inputMetrics = asObject(inputConfig.metrics);
  const inputPartnerSlots = asObject(inputMetrics.partnerSlots);
  const inputImpactRules = asObject(inputConfig.impactRules);
  const inputImpactTags = asObject(inputImpactRules.tags);

  const siteConfig = {
    ...DEFAULT_SPONSORING_CONFIG,
    ...inputConfig,
    amountRange: {
      ...DEFAULT_SPONSORING_CONFIG.amountRange,
      ...inputRange,
    },
    amountChips: asArray(inputConfig.amountChips).length
      ? asArray(inputConfig.amountChips)
      : DEFAULT_SPONSORING_CONFIG.amountChips,
    planMeta: {
      ...DEFAULT_SPONSORING_CONFIG.planMeta,
      ...inputPlanMeta,
    },
    metrics: {
      ...DEFAULT_SPONSORING_CONFIG.metrics,
      ...inputMetrics,
      partnerSlots: {
        ...DEFAULT_SPONSORING_CONFIG.metrics.partnerSlots,
        ...inputPartnerSlots,
      },
    },
    impactRules: {
      ...DEFAULT_SPONSORING_CONFIG.impactRules,
      ...inputImpactRules,
      tags: {
        ...DEFAULT_SPONSORING_CONFIG.impactRules.tags,
        ...inputImpactTags,
      },
    },
  };

  if (amountRange) {
    amountRange.min = String(toInt(siteConfig.amountRange.min, DEFAULT_SPONSORING_CONFIG.amountRange.min));
    amountRange.max = String(toInt(siteConfig.amountRange.max, DEFAULT_SPONSORING_CONFIG.amountRange.max));
    amountRange.step = String(Math.max(1, toInt(siteConfig.amountRange.step, DEFAULT_SPONSORING_CONFIG.amountRange.step)));
    amountRange.value = String(toInt(siteConfig.defaultAmount, DEFAULT_SPONSORING_CONFIG.defaultAmount));
  }

  const planNames = ["Bronze", "Silber", "Gold"];
  planCards.forEach((card) => {
    const planName = card.getAttribute("data-plan") || "";
    const meta = siteConfig.planMeta[planName];
    if (!meta) return;
    card.setAttribute("data-visibility", String(meta.visibility || ""));
    card.setAttribute("data-note", String(meta.note || ""));
    const rangeEl = card.querySelector(".plan-range");
    if (rangeEl) {
      rangeEl.textContent = `ab ${toInt(meta.minAmount, 0)} EUR`;
    }
  });

  if (chipRow) {
    chipRow.innerHTML = siteConfig.amountChips
      .map((amount) => `<button type="button" class="chip" data-amount-chip="${toInt(amount, 0)}">${toInt(amount, 0)} EUR</button>`)
      .join("");
  }
  let amountChips = $$("[data-amount-chip]");

  if (metricRatioEl) {
    const used = toInt(siteConfig.metrics.partnerSlots.used, 0);
    const total = Math.max(1, toInt(siteConfig.metrics.partnerSlots.total, 1));
    metricRatioEl.setAttribute("data-metric-target", String(used));
    metricRatioEl.setAttribute("data-metric-total", String(total));
    metricRatioEl.textContent = `${used}/${total}`;
  }
  if (metricPercentEl) {
    const budgetPercent = Math.max(0, Math.min(100, toInt(siteConfig.metrics.budgetPercent, 0)));
    metricPercentEl.setAttribute("data-metric-target", String(budgetPercent));
    metricPercentEl.textContent = `${budgetPercent}%`;
  }
  if (metricSeasonEl) {
    const targetSeason = toInt(siteConfig.metrics.targetSeason, DEFAULT_SPONSORING_CONFIG.metrics.targetSeason);
    metricSeasonEl.setAttribute("data-metric-target", String(targetSeason));
    metricSeasonEl.textContent = String(targetSeason);
  }
  if (fundingBar) {
    const fundingPercent = Math.max(0, Math.min(100, toInt(siteConfig.metrics.fundingPercent, DEFAULT_SPONSORING_CONFIG.metrics.fundingPercent)));
    fundingBar.setAttribute("data-target", String(fundingPercent));
  }

  const resolvedDefaultPlan = planNames.includes(siteConfig.defaultPlan)
    ? siteConfig.defaultPlan
    : DEFAULT_SPONSORING_CONFIG.defaultPlan;
  const state = {
    selectedPlan: resolvedDefaultPlan,
    amount: Number(amountRange?.value || siteConfig.defaultAmount || DEFAULT_SPONSORING_CONFIG.defaultAmount),
  };

  const planMeta = siteConfig.planMeta;

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
    const min = Number(amountRange?.min || DEFAULT_SPONSORING_CONFIG.amountRange.min);
    const max = Number(amountRange?.max || DEFAULT_SPONSORING_CONFIG.amountRange.max);
    const step = Number(amountRange?.step || DEFAULT_SPONSORING_CONFIG.amountRange.step);
    const raw = Number(value);
    const safe = Number.isFinite(raw) ? raw : min;
    const clamped = Math.max(min, Math.min(max, safe));
    return Math.round(clamped / step) * step;
  };

  const getImpactTag = (amount) => {
    if (amount <= Number(siteConfig.impactRules.starterMax)) return String(siteConfig.impactRules.tags.starter);
    if (amount <= Number(siteConfig.impactRules.goodMax)) return String(siteConfig.impactRules.tags.good);
    if (amount <= Number(siteConfig.impactRules.strongMax)) return String(siteConfig.impactRules.tags.strong);
    return String(siteConfig.impactRules.tags.headline);
  };

  const getImpactDetail = (amount) => {
    const slots = Math.max(
      Number(siteConfig.impactRules.slotsMin) || 3,
      Math.round(amount / (Number(siteConfig.impactRules.slotsDivisor) || 150))
    );
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
  const fundingTarget = Number(fundingBar?.getAttribute("data-target")) || Number(siteConfig.metrics.fundingPercent) || 68;

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
    const openMailClient = ({ name, company, email, phone, startWindow, interests, message }) => {
      const to = String(siteConfig.mailTo || DEFAULT_SPONSORING_CONFIG.mailTo);
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

    sponsorForm.addEventListener("submit", (e) => {
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

      openMailClient({ name, company, email, phone, startWindow, interests, message });
      if (formHint) {
        formHint.textContent = "E-Mail-Client geöffnet. Bitte Anfrage dort absenden.";
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

  setAmount(state.amount, { syncPlanFromAmount: true });
  updateBudgetUI();
})();
