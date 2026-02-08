(() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const TOKEN_KEY = "bembel_admin_token";
  const API_BASE = "/api/admin";

  const tokenInput = $("#adminToken");
  const connectBtn = $("#connectBtn");
  const refreshBtn = $("#refreshBtn");
  const sessionHint = $("#sessionHint");
  const statsLine = $("#statsLine");
  const typeFilter = $("#typeFilter");
  const statusFilter = $("#statusFilter");
  const searchInput = $("#searchInput");
  const leadList = $("#leadList");
  const leadTemplate = $("#leadTemplate");

  let adminToken = sessionStorage.getItem(TOKEN_KEY) || "";
  let debounceTimer = 0;

  if (tokenInput) {
    tokenInput.value = adminToken;
  }

  const setHint = (text, isError = false) => {
    if (!sessionHint) return;
    sessionHint.textContent = text;
    sessionHint.style.color = isError ? "#ff9b9b" : "";
  };

  const headers = () => ({
    "x-admin-token": adminToken,
  });

  const fetchJson = async (url, init = {}) => {
    const response = await fetch(url, {
      ...init,
      headers: {
        ...(init.headers || {}),
        ...headers(),
      },
      credentials: "same-origin",
    });

    let data = null;
    try {
      data = await response.json();
    } catch {
      data = null;
    }

    if (!response.ok) {
      const error = data?.error || `http_${response.status}`;
      throw new Error(error);
    }

    return data;
  };

  const formatDate = (iso) => {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso || "-";
    return date.toLocaleString("de-DE");
  };

  const renderStats = (payload) => {
    if (!statsLine) return;
    const s = payload?.stats;
    if (!s) {
      statsLine.textContent = "Keine Daten.";
      return;
    }

    statsLine.textContent =
      `Leads gesamt: ${s.total} | Kontakt: ${s.byType.contact} | Sponsoring: ${s.byType.sponsor} | ` +
      `new: ${s.byStatus.new} | contacted: ${s.byStatus.contacted} | won: ${s.byStatus.won} | spam: ${s.byStatus.spam}`;
  };

  const renderLeadList = (leads) => {
    if (!leadList || !leadTemplate) return;
    leadList.innerHTML = "";

    if (!leads.length) {
      const empty = document.createElement("p");
      empty.className = "muted";
      empty.textContent = "Keine Leads für diese Filter.";
      leadList.appendChild(empty);
      return;
    }

    for (const lead of leads) {
      const node = leadTemplate.content.firstElementChild.cloneNode(true);
      const title = $("[data-lead-title]", node);
      const meta = $("[data-lead-meta]", node);
      const statusBadge = $("[data-lead-status]", node);
      const message = $("[data-lead-message]", node);
      const details = $("[data-lead-details]", node);
      const nextStatus = $("[data-status-next]", node);
      const statusNote = $("[data-status-note]", node);
      const saveBtn = $("[data-status-save]", node);

      if (title) {
        const label = lead.type === "sponsor" ? "Sponsoring" : "Kontakt";
        const name = lead.contact?.name || "Unbekannt";
        const company = lead.contact?.company ? ` (${lead.contact.company})` : "";
        title.textContent = `${label}: ${name}${company}`;
      }

      if (meta) {
        meta.textContent = `${lead.contact?.email || "-"} | ${formatDate(lead.createdAt)} | ${lead.id}`;
      }

      if (statusBadge) {
        statusBadge.textContent = lead.status;
      }

      if (message) {
        message.textContent = lead.details?.message || "Keine Nachricht";
      }

      if (details) {
        const rows = [];
        rows.push(["Typ", lead.type]);
        rows.push(["Thema", lead.details?.topic || "-"]);
        rows.push(["Paket", lead.details?.selectedPlan || "-"]);
        rows.push(["Budget", lead.details?.selectedAmount ? `${lead.details.selectedAmount} EUR` : "-"]);
        rows.push(["Telefon", lead.contact?.phone || "-"]);
        rows.push(["Pfad", lead.source?.path || "-"]);
        rows.push(["Auto-Reply", lead.autoReply?.status || "pending"]);
        rows.push(["Spam-Signale", (lead.spamSignals || []).join(", ") || "-"]);
        details.innerHTML = rows
          .map(([dt, dd]) => `<dt>${escapeHtml(dt)}</dt><dd>${escapeHtml(String(dd))}</dd>`)
          .join("");
      }

      if (nextStatus) nextStatus.value = lead.status;

      if (saveBtn) {
        saveBtn.addEventListener("click", async () => {
          const targetStatus = nextStatus?.value || lead.status;
          const note = statusNote?.value || "";

          saveBtn.disabled = true;
          saveBtn.textContent = "Speichert...";
          try {
            await fetchJson(`${API_BASE}/leads/${lead.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ status: targetStatus, note, actor: "admin-ui" }),
            });
            await loadLeads();
          } catch (err) {
            setHint(`Update fehlgeschlagen: ${err.message}`, true);
          } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = "Speichern";
          }
        });
      }

      leadList.appendChild(node);
    }
  };

  const loadLeads = async () => {
    if (!adminToken) {
      renderLeadList([]);
      renderStats(null);
      return;
    }

    const params = new URLSearchParams();
    if (typeFilter?.value) params.set("type", typeFilter.value);
    if (statusFilter?.value) params.set("status", statusFilter.value);
    if (searchInput?.value?.trim()) params.set("q", searchInput.value.trim());

    const payload = await fetchJson(`${API_BASE}/leads?${params.toString()}`);
    renderStats(payload);
    renderLeadList(payload.leads || []);
  };

  const connect = async () => {
    adminToken = tokenInput?.value?.trim() || "";
    if (!adminToken) {
      setHint("Bitte Admin-Token eingeben.", true);
      return;
    }

    try {
      await fetchJson(`${API_BASE}/session`);
      sessionStorage.setItem(TOKEN_KEY, adminToken);
      setHint("Verbunden");
      await loadLeads();
    } catch (err) {
      setHint(`Verbindung fehlgeschlagen: ${err.message}`, true);
    }
  };

  const debouncedLoad = () => {
    window.clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(() => {
      void loadLeads().catch((err) => setHint(`Laden fehlgeschlagen: ${err.message}`, true));
    }, 260);
  };

  connectBtn?.addEventListener("click", () => void connect());
  refreshBtn?.addEventListener("click", () => void loadLeads().catch((err) => setHint(err.message, true)));
  typeFilter?.addEventListener("change", debouncedLoad);
  statusFilter?.addEventListener("change", debouncedLoad);
  searchInput?.addEventListener("input", debouncedLoad);

  if (adminToken) {
    void connect();
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => {
      const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" };
      return map[char];
    });
  }
})();
