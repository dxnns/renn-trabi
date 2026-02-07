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
      visibility: "Website + Update-Erwähnung",
      note: "Solider Einstieg mit klarer Sichtbarkeit in der Community.",
    },
    Silber: {
      visibility: "Website + Fahrzeugbereich + Content",
      note: "Ausgewogene Mischung aus Reichweite und Markenpräsenz.",
    },
    Gold: {
      visibility: "Prominente Platzierung + Co-Branding",
      note: "Maximale Sichtbarkeit und enge Zusammenarbeit.",
    },
  };

  const formatEUR = (value) =>
    new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 }).format(value);

  const getRecommendedPlan = (amount) => {
    if (amount < 900) return "Bronze";
    if (amount < 2200) return "Silber";
    return "Gold";
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
    state.selectedPlan = planName;
    planCards.forEach(card => {
      const isSelected = card.getAttribute("data-plan") === planName;
      card.classList.toggle("is-selected", isSelected);
    });
    if (selectedPlanInput) selectedPlanInput.value = planName;
  };

  const updateBudgetUI = () => {
    const amount = state.amount;
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
      updateBudgetUI();
    });
  });

  if (amountRange) {
    amountRange.addEventListener("input", () => {
      state.amount = Number(amountRange.value);
      updateBudgetUI();
    });
  }

  amountChips.forEach(chip => {
    chip.addEventListener("click", () => {
      const amount = Number(chip.getAttribute("data-amount-chip"));
      if (!amount || !amountRange) return;
      amountRange.value = String(amount);
      state.amount = amount;
      updateBudgetUI();
    });
  });

  if (fundingBar) {
    const target = Number(fundingBar.getAttribute("data-target")) || 68;
    requestAnimationFrame(() => {
      fundingBar.style.width = `${Math.max(0, Math.min(100, target))}%`;
      if (fundingValue) fundingValue.textContent = `${target}%`;
    });
  }

  if (sponsorForm) {
    sponsorForm.addEventListener("submit", (e) => {
      e.preventDefault();

      const name = $("#sponsorName")?.value?.trim() || "";
      const company = $("#sponsorCompany")?.value?.trim() || "";
      const email = $("#sponsorMail")?.value?.trim() || "";
      const phone = $("#sponsorPhone")?.value?.trim() || "";
      const startWindow = $("#startWindow")?.value || "Nach Absprache";
      const message = $("#sponsorMsg")?.value?.trim() || "";
      const interests = $$("input[name='interest']:checked", sponsorForm).map(i => i.value);

      const to = "team@bembel-racing.example";
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
    });
  }

  setSelectedPlan(state.selectedPlan);
  updateBudgetUI();
})();
