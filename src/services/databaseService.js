const Database = require("better-sqlite3");

const db = new Database("deepcompliance.db");

db.prepare(`
  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    time TEXT NOT NULL,
    eventType TEXT NOT NULL,
    repo TEXT NOT NULL,
    fileName TEXT NOT NULL,
    riskLevel TEXT NOT NULL,
    action TEXT NOT NULL,
    areas TEXT,
    summary TEXT,
    findings TEXT
  )
`).run();

function saveEvent(event) {
  const stmt = db.prepare(`
    INSERT INTO events (
      time, eventType, repo, fileName, riskLevel, action, areas, summary, findings
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    new Date().toLocaleString(),
    event.eventType,
    event.repo,
    event.fileName,
    event.riskLevel,
    event.action,
    JSON.stringify(event.areas || []),
    event.summary || "",
    JSON.stringify(event.findings || [])
  );
}

function getEvents() {
  const rows = db.prepare(`
    SELECT * FROM events
    ORDER BY id DESC
    LIMIT 100
  `).all();

  return rows.map((row) => ({
    ...row,
    areas: JSON.parse(row.areas || "[]"),
    findings: JSON.parse(row.findings || "[]"),
  }));
}

module.exports = {
  saveEvent,
  getEvents,
};