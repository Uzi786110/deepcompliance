require("dotenv").config();

const express = require("express");
const axios = require("axios");

const { getPRFiles } = require("./services/githubService");
const { analyzeDiffWithAI } = require("./services/aiService");
const { commentOnPR } = require("./services/githubCommentService");
const { saveEvent, getEvents } = require("./services/databaseService");

const app = express();
app.use(express.json());

function getStats(events) {
  return {
    total: events.length,
    high: events.filter((e) => e.riskLevel === "HIGH").length,
    medium: events.filter((e) => e.riskLevel === "MEDIUM").length,
    low: events.filter((e) => e.riskLevel === "LOW").length,
    block: events.filter((e) => e.action === "BLOCK").length,
    warn: events.filter((e) => e.action === "WARN").length,
    log: events.filter((e) => e.action === "LOG").length,
  };
}

function buildAIComment(fileName, analysis) {
  const findings =
    analysis.findings.length > 0
      ? analysis.findings
          .map(
            (f) => `
- **${f.title}**
  - Evidence: ${f.evidence}
  - Explanation: ${f.explanation}
  - Recommendation: ${f.recommendation}
  - Confidence: ${f.confidence}
`
          )
          .join("\n")
      : "No detailed findings.";

  return `
## DeepCompliance AI Review

**File:** \`${fileName}\`  
**Risk:** ${analysis.riskLevel}  
**Recommended Action:** ${analysis.action}  
**Areas:** ${(analysis.areas || []).join(", ")}

### Summary
${analysis.summary}

### Findings
${findings}
`;
}

async function analyzeAndSaveFile({ eventType, owner, repoName, prNumber, file }) {
  if (!file.patch) return;

  const analysis = await analyzeDiffWithAI(file.filename, file.patch);

  saveEvent({
    eventType,
    repo: `${owner}/${repoName}`,
    fileName: file.filename,
    riskLevel: analysis.riskLevel,
    action: analysis.action,
    areas: analysis.areas,
    summary: analysis.summary,
    findings: analysis.findings || [],
  });

  if (eventType === "Pull Request" && prNumber) {
    const comment = buildAIComment(file.filename, analysis);
    await commentOnPR(owner, repoName, prNumber, comment);
  }
}

async function handlePullRequestEvent(req) {
  const pr = req.body.pull_request;
  const repo = req.body.repository;

  const owner = repo.owner.login;
  const repoName = repo.name;
  const prNumber = pr.number;

  const files = await getPRFiles(owner, repoName, prNumber);

  for (const file of files) {
    await analyzeAndSaveFile({
      eventType: "Pull Request",
      owner,
      repoName,
      prNumber,
      file,
    });
  }
}

async function handlePushEvent(req) {
  const repo = req.body.repository;
  const owner = repo.owner.login;
  const repoName = repo.name;

  const before = req.body.before;
  const after = req.body.after;

  const url = `https://api.github.com/repos/${owner}/${repoName}/compare/${before}...${after}`;

  const response = await axios.get(url, {
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
    },
  });

  const files = response.data.files || [];

  for (const file of files) {
    await analyzeAndSaveFile({
      eventType: "Push",
      owner,
      repoName,
      file,
    });
  }
}

app.get("/", (req, res) => {
  res.redirect("/dashboard");
});

app.get("/dashboard", (req, res) => {
  const events = getEvents();
  const stats = getStats(events);

  const rows = events
    .map((e) => {
      const risk = (e.riskLevel || "LOW").toLowerCase();
      const action = (e.action || "LOG").toLowerCase();

      return `
        <tr>
          <td>
            <div class="repo">${e.repo}</div>
            <div class="muted">${e.eventType} · ${e.time}</div>
          </td>
          <td>${e.fileName}</td>
          <td><span class="risk ${risk}">${e.riskLevel}</span></td>
          <td><span class="action ${action}">${e.action}</span></td>
          <td>${(e.areas || []).join(", ")}</td>
          <td>${e.summary}</td>
        </tr>
      `;
    })
    .join("");

  res.send(`
<!DOCTYPE html>
<html>
<head>
  <title>DeepCompliance AI Officer</title>
  <meta http-equiv="refresh" content="6">
  <style>
    * { box-sizing: border-box; }

    body {
      margin: 0;
      font-family: Inter, Arial, sans-serif;
      background: #f8fafc;
      color: #0f172a;
    }

    .layout {
      display: grid;
      grid-template-columns: 260px 1fr;
      min-height: 100vh;
    }

    .sidebar {
      background: white;
      border-right: 1px solid #e5e7eb;
      padding: 28px 20px;
    }

    .brand {
      font-size: 22px;
      font-weight: 800;
      margin-bottom: 6px;
    }

    .brand span { color: #2563eb; }

    .brand-subtitle {
      color: #64748b;
      font-size: 13px;
      line-height: 1.5;
      margin-bottom: 32px;
    }

    .nav {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .nav-item {
      padding: 11px 12px;
      border-radius: 10px;
      color: #475569;
      font-size: 14px;
    }

    .nav-item.active {
      background: #eff6ff;
      color: #1d4ed8;
      font-weight: 700;
    }

    .main {
      padding: 32px 40px;
    }

    .topbar {
      display: flex;
      justify-content: space-between;
      margin-bottom: 28px;
    }

    h1 {
      margin: 0;
      font-size: 32px;
      letter-spacing: -0.03em;
    }

    .subtitle {
      margin-top: 8px;
      color: #64748b;
      font-size: 15px;
    }

    .live {
      display: flex;
      gap: 8px;
      align-items: center;
      padding: 9px 13px;
      background: #ecfdf5;
      border: 1px solid #bbf7d0;
      color: #047857;
      border-radius: 999px;
      font-size: 13px;
      font-weight: 700;
    }

    .dot {
      width: 8px;
      height: 8px;
      background: #10b981;
      border-radius: 50%;
    }

    .stats {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 14px;
      margin-bottom: 30px;
    }

    .stat {
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 16px;
      padding: 18px;
      box-shadow: 0 10px 25px rgba(15, 23, 42, 0.04);
    }

    .stat-label {
      color: #64748b;
      font-size: 13px;
      margin-bottom: 10px;
    }

    .stat-value {
      font-size: 28px;
      font-weight: 800;
    }

    .panel {
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 18px;
      padding: 22px;
      box-shadow: 0 10px 25px rgba(15, 23, 42, 0.04);
    }

    .panel-title {
      margin: 0 0 18px;
      font-size: 18px;
      font-weight: 800;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 14px;
    }

    th {
      text-align: left;
      color: #64748b;
      border-bottom: 1px solid #e5e7eb;
      padding: 12px 10px;
      font-size: 12px;
      text-transform: uppercase;
    }

    td {
      padding: 14px 10px;
      border-bottom: 1px solid #f1f5f9;
      vertical-align: top;
    }

    .repo {
      font-weight: 800;
    }

    .muted {
      color: #64748b;
      font-size: 13px;
      margin-top: 4px;
    }

    .risk, .action {
      display: inline-flex;
      padding: 5px 10px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 800;
    }

    .risk.high, .action.block {
      background: #fef2f2;
      color: #b91c1c;
      border: 1px solid #fecaca;
    }

    .risk.medium, .action.warn {
      background: #fffbeb;
      color: #b45309;
      border: 1px solid #fde68a;
    }

    .risk.low, .action.log {
      background: #ecfdf5;
      color: #047857;
      border: 1px solid #bbf7d0;
    }

    .empty {
      color: #64748b;
      padding: 30px;
      background: #f8fafc;
      border: 1px dashed #cbd5e1;
      border-radius: 14px;
    }

    @media (max-width: 1200px) {
      .stats { grid-template-columns: repeat(2, 1fr); }
      .layout { grid-template-columns: 1fr; }
      .sidebar { display: none; }
    }
  </style>
</head>
<body>
  <div class="layout">
    <aside class="sidebar">
      <div class="brand">Deep<span>Compliance</span></div>
      <div class="brand-subtitle">
        AI Officer for real-time compliance monitoring across engineering workflows.
      </div>

      <nav class="nav">
        <div class="nav-item active">Dashboard</div>
        <div class="nav-item">GitHub Monitoring</div>
        <div class="nav-item">Risk Events</div>
        <div class="nav-item">Policies</div>
        <div class="nav-item">Audit Trail</div>
        <div class="nav-item">Settings</div>
      </nav>
    </aside>

    <main class="main">
      <div class="topbar">
        <div>
          <h1>AI Compliance Officer</h1>
          <div class="subtitle">
            Real-time monitoring of code changes for security, GDPR, AI governance and internal policy risks.
          </div>
        </div>

        <div class="live">
          <span class="dot"></span>
          Live monitoring active
        </div>
      </div>

      <section class="stats">
        <div class="stat"><div class="stat-label">Total Events</div><div class="stat-value">${stats.total}</div></div>
        <div class="stat"><div class="stat-label">High Risk</div><div class="stat-value">${stats.high}</div></div>
        <div class="stat"><div class="stat-label">Medium Risk</div><div class="stat-value">${stats.medium}</div></div>
        <div class="stat"><div class="stat-label">Low Risk</div><div class="stat-value">${stats.low}</div></div>
        <div class="stat"><div class="stat-label">Block</div><div class="stat-value">${stats.block}</div></div>
        <div class="stat"><div class="stat-label">Warn</div><div class="stat-value">${stats.warn}</div></div>
        <div class="stat"><div class="stat-label">Log</div><div class="stat-value">${stats.log}</div></div>
      </section>

      <section class="panel">
        <h2 class="panel-title">Latest Compliance Events</h2>

        ${
          events.length
            ? `
          <table>
            <thead>
              <tr>
                <th>Repository</th>
                <th>File</th>
                <th>Risk</th>
                <th>Action</th>
                <th>Area</th>
                <th>Summary</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
          `
            : `<div class="empty">No events yet. Create or update a GitHub pull request to see analysis here.</div>`
        }
      </section>
    </main>
  </div>
</body>
</html>
  `);
});

app.post("/webhook", (req, res) => {
  const event = req.headers["x-github-event"];

  res.status(200).send("OK");

  setImmediate(async () => {
    try {
      if (event === "pull_request") await handlePullRequestEvent(req);
      if (event === "push") await handlePushEvent(req);
    } catch (err) {
      console.error("Background error:", err.message);
    }
  });
});

app.listen(3000, () => {
  console.log("🚀 Server running on port 3000");
});