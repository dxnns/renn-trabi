/* ===============================
   Mainpage content configuration
   Edit this file for recurring updates.
   =============================== */

window.BEMBEL_MAINPAGE_CONFIG = {
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

  raceCenter: {
    summary: {
      state: "In Vorbereitung",
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
  },
};
