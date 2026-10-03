import "dotenv/config";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";
import { careerPathways, skills, opportunities } from "./data.js";
import { researchAgent, verificationAgent, careerIntelligenceAgent, matchingAgent, fingerprint } from "./agents.js";
import { careerCoach } from "./ai.js";

globalThis.__LEGALPATH_PATHWAYS__ = careerPathways;

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

const port = process.env.PORT || 8787;
const runs = [];

const log = (agent, status, meta = {}) => {
  const entry = {
    id: crypto.randomUUID?.() || String(Date.now()),
    agent,
    status,
    timestamp: new Date().toISOString(),
    ...meta
  };
  runs.unshift(entry);
  return entry;
};

app.get("/api/health", (req, res) =>
  res.json({
    ok: true,
    service: "LegalPath Pakistan API",
    database: "not connected",
    ai: !!process.env.GEMINI_API_KEY,
    version: "0.3.0"
  })
);

app.get("/api/career-pathways", (req, res) => res.json({ data: careerPathways }));
app.get("/api/skills", (req, res) => res.json({ data: skills }));
app.get("/api/opportunities", (req, res) => res.json({ data: opportunities }));

app.post("/api/agents/research", async (req, res) => {
  try {
    const out = await researchAgent(req.body);
    log(out.agent, out.status, { count: out.count });
    res.json(out);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.post("/api/agents/verify", async (req, res) => {
  try {
    const out = await verificationAgent(req.body.records || []);
    log(out.agent, out.status, { verified: out.verified, rejected: out.rejected });
    res.json(out);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.post("/api/agents/career-intelligence", async (req, res) => {
  try {
    const out = careerIntelligenceAgent(req.body.profile || {});
    log(out.agent, out.status);
    res.json(out);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.post("/api/agents/match", async (req, res) => {
  try {
    const out = matchingAgent(req.body.profile || {}, req.body.opportunities || opportunities);
    log(out.agent, out.status, { count: out.matches.length });
    res.json(out);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.post("/api/agents/coach", async (req, res) => {
  try {
    const out = await careerCoach(req.body);
    log(out.agent, out.status);
    res.json(out);
  } catch (e) {
    log("Career Coach Agent", "failed", { error: e.message });
    res.status(503).json({ error: e.message, configured: false });
  }
});

app.get("/api/agents/activity", (req, res) => res.json({ data: runs }));

app.post("/api/verify-records", async (req, res) => {
  try {
    const out = await verificationAgent(req.body.records || []);
    res.json({
      ...out,
      records: out.records.map(record => ({
        ...record,
        fingerprint: fingerprint(record)
      }))
    });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.resolve(__dirname, "../dist");

app.use(express.static(distDir));

app.use((req, res, next) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ error: "API route not found" });
  }

  if (req.method === "GET") {
    return res.sendFile(path.join(distDir, "index.html"), error => {
      if (error) next();
    });
  }

  next();
});

app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

app.listen(port, () => console.log(`LegalPath API + web app running on port ${port}`));
