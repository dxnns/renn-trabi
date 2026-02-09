(() => {
  const $ = (selector, root = document) => root.querySelector(selector);

  const STORAGE_KEYS = {
    auth: "bembel_admin_local_auth_v1",
    session: "bembel_admin_local_session_v1",
    lock: "bembel_admin_local_lock_v1",
    raceOverride: "bembel_race_center_override",
  };

  const AUTH_WINDOW_MS = 15 * 60_000;
  const AUTH_LOCK_MS = 10 * 60_000;
  const AUTH_MAX_FAILURES = 5;

  const DEFAULT_CONFIG = {
    summary: {
      state: "In Vorbereitung",
      nextMilestone: "Transport, Pit-Setup und Abnahme",
      lastUpdateAt: "",
      lastUpdateLabel: "",
    },
    feed: [
      {
        id: "admin-default-setup-check",
        category: "technik",
        title: "Setup-Check abgeschlossen",
        body: "Bremsbalance stabil, Temperaturfenster passt fuer den Testlauf.",
        at: "2026-08-06T18:00:00+02:00",
        reactions: { fire: 0, checkered: 0, wrench: 0 },
      },
      {
        id: "admin-default-pit-ablauf",
        category: "team",
        title: "Pit-Ablauf geprobt",
        body: "Tool-Positionen angepasst, Boxenfenster weiter verbessert.",
        at: "2026-08-07T20:10:00+02:00",
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

  const localStore = (() => {
    try {
      return window.localStorage;
    } catch {
      return null;
    }
  })();

  const sessionStore = (() => {
    try {
      return window.sessionStorage;
    } catch {
      return null;
    }
  })();

  const authBadge = $("#authBadge");
  const authModeLabel = $("#authModeLabel");
  const adminPin = $("#adminPin");
  const adminPinConfirm = $("#adminPinConfirm");
  const pinConfirmRow = $("#pinConfirmRow");
  const authBtn = $("#authBtn");
  const logoutBtn = $("#logoutBtn");
  const resetAuthBtn = $("#resetAuthBtn");
  const authHint = $("#authHint");
  const authMeta = $("#authMeta");

  const protectedPanels = Array.from(document.querySelectorAll("[data-admin-protected]"));

  const siteState = $("#siteState");
  const siteLastUpdateLabel = $("#siteLastUpdateLabel");
  const siteLastUpdateAt = $("#siteLastUpdateAt");
  const siteNextMilestone = $("#siteNextMilestone");
  const saveSummaryBtn = $("#saveSummaryBtn");
  const resetOverrideBtn = $("#resetOverrideBtn");
  const loadDefaultsBtn = $("#loadDefaultsBtn");
  const configHint = $("#configHint");

  const feedCategory = $("#feedCategory");
  const feedTitle = $("#feedTitle");
  const feedAt = $("#feedAt");
  const feedBody = $("#feedBody");
  const addFeedBtn = $("#addFeedBtn");
  const feedList = $("#feedList");

  const configJson = $("#configJson");
  const copyConfigBtn = $("#copyConfigBtn");
  const downloadConfigBtn = $("#downloadConfigBtn");
  const importConfigBtn = $("#importConfigBtn");

  const openContactInboxBtn = $("#openContactInboxBtn");
  const openSponsorInboxBtn = $("#openSponsorInboxBtn");
  const replyType = $("#replyType");
  const replyName = $("#replyName");
  const replyEmail = $("#replyEmail");
  const replyNextStep = $("#replyNextStep");
  const replyMessage = $("#replyMessage");
  const openReplyMailBtn = $("#openReplyMailBtn");
  const mailHint = $("#mailHint");

  const state = {
    authMode: "setup",
    authenticated: false,
    config: deepClone(DEFAULT_CONFIG),
  };

  function readJson(storage, key, fallback) {
    if (!storage) return fallback;
    try {
      const raw = storage.getItem(key);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : fallback;
    } catch {
      return fallback;
    }
  }

  function writeJson(storage, key, value) {
    if (!storage) return;
    try {
      storage.setItem(key, JSON.stringify(value));
    } catch {}
  }

  function removeItem(storage, key) {
    if (!storage) return;
    try {
      storage.removeItem(key);
    } catch {}
  }

  function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function sanitizeText(value, maxLength = 300) {
    return String(value || "")
      .replace(/[\r\n\t]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, maxLength);
  }

  function sanitizeMulti(value, maxLength = 2_000) {
    return String(value || "")
      .replace(/\r/g, "")
      .trim()
      .slice(0, maxLength);
  }

  function formatDateTime(iso) {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleString("de-DE");
  }

  function toDateTimeLocal(iso) {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "";
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hour = String(date.getHours()).padStart(2, "0");
    const minute = String(date.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day}T${hour}:${minute}`;
  }

  function fromDateTimeLocal(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toISOString();
  }

  function randomSalt(length = 24) {
    if (window.crypto?.getRandomValues) {
      const bytes = new Uint8Array(length);
      window.crypto.getRandomValues(bytes);
      return Array.from(bytes, (entry) => entry.toString(16).padStart(2, "0")).join("");
    }
    return `${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`;
  }

  function fallbackHash(input) {
    let hash = 2166136261;
    for (let i = 0; i < input.length; i += 1) {
      hash ^= input.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16).padStart(8, "0");
  }

  async function hashPin(pin, salt) {
    const source = `${salt}::${pin}::bembel-admin-local-v1`;
    if (window.crypto?.subtle && window.TextEncoder) {
      const bytes = new TextEncoder().encode(source);
      const digest = await window.crypto.subtle.digest("SHA-256", bytes);
      return Array.from(new Uint8Array(digest), (entry) => entry.toString(16).padStart(2, "0")).join("");
    }
    return fallbackHash(source);
  }

  function getAuthRecord() {
    const record = readJson(localStore, STORAGE_KEYS.auth, null);
    if (!record || typeof record !== "object") return null;
    const salt = sanitizeText(record.salt, 200);
    const pinHash = sanitizeText(record.pinHash, 200);
    if (!salt || !pinHash) return null;
    return { salt, pinHash, updatedAt: sanitizeText(record.updatedAt, 64) };
  }

  function getSessionRecord() {
    const record = readJson(sessionStore, STORAGE_KEYS.session, null);
    if (!record || typeof record !== "object") return null;
    if (record.active !== true) return null;
    const at = sanitizeText(record.at, 64);
    return { active: true, at };
  }

  function setSession() {
    writeJson(sessionStore, STORAGE_KEYS.session, { active: true, at: new Date().toISOString() });
  }

  function clearSession() {
    removeItem(sessionStore, STORAGE_KEYS.session);
  }

  function getLockRecord() {
    const raw = readJson(localStore, STORAGE_KEYS.lock, {
      failures: 0,
      windowStart: 0,
      lockUntil: 0,
    });

    return {
      failures: Math.max(0, Number(raw.failures) || 0),
      windowStart: Math.max(0, Number(raw.windowStart) || 0),
      lockUntil: Math.max(0, Number(raw.lockUntil) || 0),
    };
  }

  function setLockRecord(value) {
    writeJson(localStore, STORAGE_KEYS.lock, value);
  }

  function clearLockRecord() {
    removeItem(localStore, STORAGE_KEYS.lock);
  }

  function getRemainingLockMs() {
    const lock = getLockRecord();
    return Math.max(0, lock.lockUntil - Date.now());
  }

  function registerAuthFailure() {
    const now = Date.now();
    const lock = getLockRecord();
    const sameWindow = now - lock.windowStart <= AUTH_WINDOW_MS;

    const failures = sameWindow ? lock.failures + 1 : 1;
    const windowStart = sameWindow ? lock.windowStart : now;

    const lockUntil = failures >= AUTH_MAX_FAILURES ? now + AUTH_LOCK_MS : 0;
    setLockRecord({ failures, windowStart, lockUntil });
  }

  function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(value || ""));
  }

  function normalizeFeedItem(raw) {
    if (!raw || typeof raw !== "object") return null;

    const id = sanitizeText(raw.id, 120) || createId("manual");
    const category = ["technik", "rennen", "team"].includes(raw.category) ? raw.category : "rennen";
    const title = sanitizeText(raw.title, 140);
    const body = sanitizeMulti(raw.body, 2_200);
    if (!title || !body) return null;

    let at = sanitizeText(raw.at, 80);
    const parsedDate = Date.parse(at);
    at = Number.isFinite(parsedDate) ? new Date(parsedDate).toISOString() : new Date().toISOString();

    const reactions = raw.reactions && typeof raw.reactions === "object" ? raw.reactions : {};
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
  }

  function normalizePoll(raw) {
    if (!raw || typeof raw !== "object") return null;
    const id = sanitizeText(raw.id, 120);
    const question = sanitizeText(raw.question, 220);
    if (!id || !question) return null;

    const options = Array.isArray(raw.options)
      ? raw.options
          .map((entry) => {
            const optionId = sanitizeText(entry?.id, 80);
            const label = sanitizeText(entry?.label, 120);
            if (!optionId || !label) return null;
            return {
              id: optionId,
              label,
              votes: Math.max(0, Number(entry?.votes) || 0),
            };
          })
          .filter(Boolean)
      : [];

    if (options.length < 2) return null;
    return { id, question, options };
  }

  function normalizeConfig(raw) {
    const fallback = deepClone(DEFAULT_CONFIG);
    if (!raw || typeof raw !== "object") return fallback;

    const summary = raw.summary && typeof raw.summary === "object" ? raw.summary : {};
    fallback.summary = {
      state: sanitizeText(summary.state, 120) || fallback.summary.state,
      nextMilestone: sanitizeText(summary.nextMilestone, 220) || fallback.summary.nextMilestone,
      lastUpdateAt: sanitizeText(summary.lastUpdateAt, 80),
      lastUpdateLabel: sanitizeText(summary.lastUpdateLabel, 180),
    };

    if (Array.isArray(raw.feed)) {
      fallback.feed = raw.feed.map(normalizeFeedItem).filter(Boolean).slice(0, 60);
    }

    if (Array.isArray(raw.polls)) {
      const polls = raw.polls.map(normalizePoll).filter(Boolean).slice(0, 8);
      if (polls.length) {
        fallback.polls = polls;
      }
    }

    return fallback;
  }

  function createId(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function setHint(node, message, type = "info") {
    if (!node) return;
    node.textContent = message;
    node.classList.remove("is-error", "is-success");
    if (type === "error") node.classList.add("is-error");
    if (type === "success") node.classList.add("is-success");
  }

  function updateProtectedPanels() {
    for (const panel of protectedPanels) {
      panel.classList.toggle("is-locked", !state.authenticated);
      const controls = Array.from(panel.querySelectorAll("input, textarea, select, button"));
      for (const control of controls) {
        control.disabled = !state.authenticated;
      }
    }
  }

  function updateAuthBadge() {
    if (!authBadge) return;
    authBadge.classList.toggle("is-online", state.authenticated);
    authBadge.classList.toggle("is-offline", !state.authenticated);
    authBadge.textContent = state.authenticated ? "Freigeschaltet" : "Gesperrt";
  }

  function updateAuthMode() {
    const hasSetup = Boolean(getAuthRecord());
    state.authMode = hasSetup ? "login" : "setup";
    if (pinConfirmRow) {
      pinConfirmRow.hidden = hasSetup;
    }
    if (authModeLabel) {
      authModeLabel.textContent = hasSetup
        ? "Login: lokale PIN eingeben"
        : "Erstanmeldung: lokale PIN einrichten";
    }
    if (authBtn) {
      authBtn.textContent = hasSetup ? "Anmelden" : "PIN einrichten";
    }
  }

  function updateAuthMeta() {
    if (!authMeta) return;
    const session = getSessionRecord();
    if (!session || !state.authenticated) {
      authMeta.textContent = "Session: inaktiv";
      return;
    }
    authMeta.textContent = `Session aktiv seit ${formatDateTime(session.at)}`;
  }

  function persistConfig() {
    writeJson(localStore, STORAGE_KEYS.raceOverride, state.config);
    updateConfigJsonArea();
  }

  function loadConfig() {
    const stored = readJson(localStore, STORAGE_KEYS.raceOverride, null);
    state.config = normalizeConfig(stored);
    renderSummaryFields();
    renderFeedList();
    updateConfigJsonArea();
  }

  function loadDefaults() {
    state.config = deepClone(DEFAULT_CONFIG);
    renderSummaryFields();
    renderFeedList();
    updateConfigJsonArea();
  }

  function clearOverrides() {
    removeItem(localStore, STORAGE_KEYS.raceOverride);
    state.config = deepClone(DEFAULT_CONFIG);
    renderSummaryFields();
    renderFeedList();
    updateConfigJsonArea();
  }

  function renderSummaryFields() {
    const summary = state.config.summary || {};
    if (siteState) siteState.value = summary.state || "";
    if (siteLastUpdateLabel) siteLastUpdateLabel.value = summary.lastUpdateLabel || "";
    if (siteLastUpdateAt) siteLastUpdateAt.value = toDateTimeLocal(summary.lastUpdateAt);
    if (siteNextMilestone) siteNextMilestone.value = summary.nextMilestone || "";
  }

  function applySummaryFields() {
    state.config.summary = {
      state: sanitizeText(siteState?.value, 120) || DEFAULT_CONFIG.summary.state,
      lastUpdateLabel: sanitizeText(siteLastUpdateLabel?.value, 180),
      lastUpdateAt: fromDateTimeLocal(siteLastUpdateAt?.value || ""),
      nextMilestone:
        sanitizeText(siteNextMilestone?.value, 220) || DEFAULT_CONFIG.summary.nextMilestone,
    };
  }

  function renderFeedList() {
    if (!feedList) return;
    feedList.innerHTML = "";

    const entries = Array.isArray(state.config.feed) ? [...state.config.feed] : [];
    entries.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));

    if (!entries.length) {
      const empty = document.createElement("p");
      empty.className = "small muted";
      empty.textContent = "Noch keine Feed-Updates vorhanden.";
      feedList.appendChild(empty);
      return;
    }

    for (const item of entries) {
      const article = document.createElement("article");
      article.className = "feed-item";
      article.setAttribute("data-feed-id", item.id);

      const header = document.createElement("div");
      header.className = "feed-item-head";
      header.innerHTML =
        `<strong>${escapeHtml(item.title)}</strong>` +
        `<span class="small muted">${escapeHtml(item.category)} • ${escapeHtml(formatDateTime(item.at))}</span>`;

      const body = document.createElement("p");
      body.className = "small";
      body.textContent = item.body;

      const actions = document.createElement("div");
      actions.className = "feed-item-actions";
      actions.innerHTML =
        `<button type="button" class="btn btn-ghost btn-small" data-action="use-latest" data-feed-id="${escapeHtml(item.id)}">` +
        "Als Letztes Update setzen</button>" +
        `<button type="button" class="btn btn-ghost btn-small danger" data-action="delete" data-feed-id="${escapeHtml(item.id)}">` +
        "Loeschen</button>";

      article.appendChild(header);
      article.appendChild(body);
      article.appendChild(actions);
      feedList.appendChild(article);
    }
  }

  function updateConfigJsonArea() {
    if (!configJson) return;
    configJson.value = `${JSON.stringify(state.config, null, 2)}\n`;
  }

  function addFeedItem() {
    const category = sanitizeText(feedCategory?.value, 20);
    const title = sanitizeText(feedTitle?.value, 140);
    const body = sanitizeMulti(feedBody?.value, 2_200);
    const at = fromDateTimeLocal(feedAt?.value || "") || new Date().toISOString();

    if (!title || !body) {
      setHint(configHint, "Titel und Text sind Pflichtfelder.", "error");
      return;
    }

    const item = normalizeFeedItem({
      id: createId("manual"),
      category,
      title,
      body,
      at,
      reactions: { fire: 0, checkered: 0, wrench: 0 },
    });

    if (!item) {
      setHint(configHint, "Feed-Update konnte nicht erstellt werden.", "error");
      return;
    }

    if (!Array.isArray(state.config.feed)) {
      state.config.feed = [];
    }

    state.config.feed.unshift(item);
    state.config.feed = state.config.feed.slice(0, 60);
    persistConfig();
    renderFeedList();

    if (feedTitle) feedTitle.value = "";
    if (feedBody) feedBody.value = "";
    if (feedAt) feedAt.value = "";
    setHint(configHint, "Feed-Update gespeichert.", "success");
  }

  function deleteFeedItem(itemId) {
    const current = Array.isArray(state.config.feed) ? state.config.feed : [];
    const next = current.filter((entry) => entry.id !== itemId);
    if (next.length === current.length) return;
    state.config.feed = next;
    persistConfig();
    renderFeedList();
    setHint(configHint, "Feed-Update geloescht.", "success");
  }

  function useFeedItemAsLatest(itemId) {
    const item = Array.isArray(state.config.feed)
      ? state.config.feed.find((entry) => entry.id === itemId)
      : null;
    if (!item) return;

    state.config.summary.lastUpdateLabel = item.title;
    state.config.summary.lastUpdateAt = item.at;
    renderSummaryFields();
    persistConfig();
    setHint(configHint, "Als 'Letztes Update' uebernommen.", "success");
  }

  async function copyConfigJson() {
    if (!configJson?.value) return;
    try {
      await navigator.clipboard.writeText(configJson.value);
      setHint(configHint, "JSON in Zwischenablage kopiert.", "success");
    } catch {
      setHint(configHint, "Kopieren nicht moeglich. Bitte manuell kopieren.", "error");
    }
  }

  function downloadConfigJson() {
    if (!configJson?.value) return;
    const blob = new Blob([configJson.value], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `race-center-config-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    setHint(configHint, "JSON-Datei heruntergeladen.", "success");
  }

  function importConfigJson() {
    if (!configJson?.value?.trim()) {
      setHint(configHint, "Kein JSON zum Import gefunden.", "error");
      return;
    }

    try {
      const parsed = JSON.parse(configJson.value);
      state.config = normalizeConfig(parsed);
      persistConfig();
      renderSummaryFields();
      renderFeedList();
      updateConfigJsonArea();
      setHint(configHint, "JSON importiert und gespeichert.", "success");
    } catch {
      setHint(configHint, "Ungueltiges JSON. Import abgebrochen.", "error");
    }
  }

  function openMailbox(address, subject = "") {
    const normalized = sanitizeText(address, 220);
    if (!normalized) return;
    const encodedSubject = subject ? `?subject=${encodeURIComponent(subject)}` : "";
    window.location.href = `mailto:${encodeURIComponent(normalized)}${encodedSubject}`;
  }

  function openReplyMail() {
    const type = sanitizeText(replyType?.value, 20) === "sponsor" ? "sponsor" : "contact";
    const name = sanitizeText(replyName?.value, 120) || "Team";
    const recipient = sanitizeText(replyEmail?.value, 220);
    const nextStep = sanitizeText(replyNextStep?.value, 180);
    const extra = sanitizeMulti(replyMessage?.value, 1_500);

    if (!recipient || !isValidEmail(recipient)) {
      setHint(mailHint, "Bitte eine gueltige Empfaengeradresse angeben.", "error");
      return;
    }

    const subject = type === "sponsor"
      ? "Rueckmeldung zu Ihrer Sponsoring-Anfrage"
      : "Rueckmeldung zu Ihrer Nachricht";

    const lines = [
      `Hallo ${name},`,
      "",
      "vielen Dank fuer Ihre Nachricht an das Bembel Racing Team.",
      "",
    ];

    if (nextStep) {
      lines.push(`Naechster Schritt: ${nextStep}`);
      lines.push("");
    }

    if (extra) {
      lines.push(extra);
      lines.push("");
    }

    lines.push("Beste Gruesse");
    lines.push("Bembel Racing Team");

    const body = encodeURIComponent(lines.join("\n"));
    const mailto = `mailto:${encodeURIComponent(recipient)}?subject=${encodeURIComponent(subject)}&body=${body}`;
    window.location.href = mailto;
    setHint(mailHint, "Antwortmail im lokalen Mail-Client geoeffnet.", "success");
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => {
      const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" };
      return map[char];
    });
  }

  function applyAuthUiState() {
    updateAuthMode();
    updateAuthBadge();
    updateProtectedPanels();
    updateAuthMeta();

    if (!state.authenticated) {
      setHint(authHint, "Nicht angemeldet.", "info");
      return;
    }

    const session = getSessionRecord();
    setHint(
      authHint,
      session?.at
        ? `Lokale Session aktiv seit ${formatDateTime(session.at)}.`
        : "Lokale Session aktiv.",
      "success"
    );
  }

  function setAuthenticated(isAuthenticated) {
    state.authenticated = isAuthenticated;
    if (state.authenticated) {
      loadConfig();
    }
    applyAuthUiState();
  }

  async function setupPin() {
    const pin = adminPin?.value || "";
    const pinConfirm = adminPinConfirm?.value || "";

    if (pin.length < 8) {
      setHint(authHint, "PIN muss mindestens 8 Zeichen haben.", "error");
      return;
    }

    if (pin !== pinConfirm) {
      setHint(authHint, "PIN und Bestaetigung stimmen nicht ueberein.", "error");
      return;
    }

    const salt = randomSalt();
    const pinHash = await hashPin(pin, salt);
    writeJson(localStore, STORAGE_KEYS.auth, {
      salt,
      pinHash,
      updatedAt: new Date().toISOString(),
    });
    clearLockRecord();
    setSession();
    if (adminPin) adminPin.value = "";
    if (adminPinConfirm) adminPinConfirm.value = "";
    setAuthenticated(true);
    setHint(authHint, "PIN eingerichtet. Workspace freigeschaltet.", "success");
  }

  async function loginWithPin() {
    const lockMs = getRemainingLockMs();
    if (lockMs > 0) {
      const minutes = Math.ceil(lockMs / 60_000);
      setHint(authHint, `Zu viele Fehlversuche. Erneut in ca. ${minutes} Min.`, "error");
      return;
    }

    const record = getAuthRecord();
    if (!record) {
      setHint(authHint, "Keine PIN eingerichtet. Bitte Erstanmeldung ausfuehren.", "error");
      updateAuthMode();
      return;
    }

    const pin = adminPin?.value || "";
    if (!pin) {
      setHint(authHint, "Bitte PIN eingeben.", "error");
      return;
    }

    const candidate = await hashPin(pin, record.salt);
    if (candidate !== record.pinHash) {
      registerAuthFailure();
      const lock = getLockRecord();
      const remaining = Math.max(0, AUTH_MAX_FAILURES - lock.failures);
      if (lock.lockUntil > Date.now()) {
        const minutes = Math.ceil((lock.lockUntil - Date.now()) / 60_000);
        setHint(authHint, `Zu viele Fehlversuche. Erneut in ca. ${minutes} Min.`, "error");
      } else {
        setHint(authHint, `PIN ungueltig. Verbleibende Versuche in diesem Fenster: ${remaining}.`, "error");
      }
      return;
    }

    clearLockRecord();
    setSession();
    if (adminPin) adminPin.value = "";
    setAuthenticated(true);
  }

  async function handleAuthAction() {
    if (state.authMode === "setup") {
      await setupPin();
      return;
    }
    await loginWithPin();
  }

  function logout() {
    clearSession();
    setAuthenticated(false);
    setHint(authHint, "Abgemeldet.", "info");
  }

  function resetPin() {
    const confirmed = window.confirm(
      "Lokale PIN wirklich zuruecksetzen? Danach ist eine Erstanmeldung erforderlich."
    );
    if (!confirmed) return;

    removeItem(localStore, STORAGE_KEYS.auth);
    clearLockRecord();
    clearSession();
    setAuthenticated(false);
    updateAuthMode();
    setHint(authHint, "PIN zurueckgesetzt. Bitte neue PIN einrichten.", "success");
  }

  function saveSummary() {
    applySummaryFields();
    persistConfig();
    setHint(configHint, "Zusammenfassung gespeichert.", "success");
  }

  function bindEvents() {
    authBtn?.addEventListener("click", () => {
      void handleAuthAction();
    });

    adminPin?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        void handleAuthAction();
      }
    });

    adminPinConfirm?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        void handleAuthAction();
      }
    });

    logoutBtn?.addEventListener("click", logout);
    resetAuthBtn?.addEventListener("click", resetPin);

    saveSummaryBtn?.addEventListener("click", saveSummary);
    loadDefaultsBtn?.addEventListener("click", () => {
      loadDefaults();
      persistConfig();
      setHint(configHint, "Standardwerte geladen und gespeichert.", "success");
    });

    resetOverrideBtn?.addEventListener("click", () => {
      clearOverrides();
      setHint(configHint, "Lokale Overrides geloescht.", "success");
    });

    addFeedBtn?.addEventListener("click", addFeedItem);

    feedList?.addEventListener("click", (event) => {
      const target = event.target instanceof Element ? event.target.closest("[data-action][data-feed-id]") : null;
      if (!(target instanceof HTMLButtonElement)) return;
      const action = target.getAttribute("data-action");
      const itemId = sanitizeText(target.getAttribute("data-feed-id"), 120);
      if (!itemId) return;

      if (action === "delete") {
        deleteFeedItem(itemId);
      } else if (action === "use-latest") {
        useFeedItemAsLatest(itemId);
      }
    });

    copyConfigBtn?.addEventListener("click", () => {
      void copyConfigJson();
    });
    downloadConfigBtn?.addEventListener("click", downloadConfigJson);
    importConfigBtn?.addEventListener("click", importConfigJson);

    openContactInboxBtn?.addEventListener("click", () => {
      openMailbox("kontakt@bembelracingteam.de", "Kontaktanfragen");
      setHint(mailHint, "Kontakt-Postfach im Mail-Client geoeffnet.", "success");
    });

    openSponsorInboxBtn?.addEventListener("click", () => {
      openMailbox("sponsoring@bembelracingteam.de", "Sponsoringanfragen");
      setHint(mailHint, "Sponsoring-Postfach im Mail-Client geoeffnet.", "success");
    });

    openReplyMailBtn?.addEventListener("click", openReplyMail);
  }

  function bootstrap() {
    updateAuthMode();
    bindEvents();

    const hasSession = Boolean(getSessionRecord());
    const hasAuth = Boolean(getAuthRecord());
    setAuthenticated(hasSession && hasAuth);

    if (!state.authenticated) {
      updateConfigJsonArea();
      renderFeedList();
      renderSummaryFields();
    }
  }

  bootstrap();
})();
