/* =========================
   Shared UI Core
   ========================= */

(() => {
  const q = (sel, root = document) => root.querySelector(sel);
  const qq = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const getReduceMotion = () =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const initializeSectionBuildAndReveal = (options = {}) => {
    const sectionSelector = options.sectionSelector || "main > section";
    const articleSelector = options.articleSelector || "main > section article[class]";
    const revealSelector = options.revealSelector || ".reveal";
    const delayStep = Number.isFinite(options.delayStep) ? options.delayStep : 45;
    const delayCap = Number.isFinite(options.delayCap) ? options.delayCap : 180;
    const sectionThreshold = Number.isFinite(options.sectionThreshold) ? options.sectionThreshold : 0.18;
    const sectionRootMargin = typeof options.sectionRootMargin === "string"
      ? options.sectionRootMargin
      : "0px 0px -8% 0px";
    const revealThreshold = Number.isFinite(options.revealThreshold) ? options.revealThreshold : 0.12;
    const revealRootMargin = typeof options.revealRootMargin === "string"
      ? options.revealRootMargin
      : "0px 0px -5% 0px";

    const reduceMotion = getReduceMotion();
    const sections = qq(sectionSelector);
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
        }, { threshold: sectionThreshold, rootMargin: sectionRootMargin });

        pendingSections.forEach((section) => sectionIO.observe(section));
      } else {
        pendingSections.forEach((section) => section.classList.add("is-built"));
      }
    }

    const sectionArticles = qq(articleSelector);
    sectionArticles.forEach((article) => {
      article.classList.add("article-fx", "reveal");
    });

    const revealEls = qq(revealSelector);
    sections.forEach((section) => {
      qq(revealSelector, section).forEach((el, idx) => {
        el.style.setProperty("--reveal-delay", `${Math.min(idx * delayStep, delayCap)}ms`);
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
      }, { threshold: revealThreshold, rootMargin: revealRootMargin });
      revealEls.forEach((el) => revealIO.observe(el));
    }

    return { sections, revealEls, reduceMotion };
  };

  window.BEMBEL_UI_CORE = {
    q,
    qq,
    getReduceMotion,
    initializeSectionBuildAndReveal,
  };
})();
