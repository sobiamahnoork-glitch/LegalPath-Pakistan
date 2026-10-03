import "dotenv/config";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";
import { careerPathways, skills, opportunities } from "./data.js";
import { getCareerPathwaysFromDb, getSkillsFromDb, getApprovedSourcesFromDb, supabaseConfigured } from "./supabase.js";
import { researchAgent, verificationAgent, careerIntelligenceAgent, matchingAgent, fingerprint, assessmentAgent, roadmapAgent } from "./agents.js";
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
    database: supabaseConfigured ? "configured" : "not configured",
    ai: !!process.env.GEMINI_API_KEY,
    version: "0.4.0"
  })
);

app.get("/api/career-pathways", async (req, res) => {
  try {
    const data = await getCareerPathwaysFromDb();
    globalThis.__LEGALPATH_PATHWAYS__ = data;
    res.json({ data, source: supabaseConfigured ? "supabase" : "fallback" });
  } catch (e) {
    res.status(503).json({ error: e.message });
  }
});

app.get("/api/skills", async (req, res) => {
  try {
    const data = await getSkillsFromDb();
    res.json({ data, source: supabaseConfigured ? "supabase" : "fallback" });
  } catch (e) {
    res.status(503).json({ error: e.message });
  }
});

app.get("/api/sources", async (req, res) => {
  try {
    const data = await getApprovedSourcesFromDb();
    res.json({ data, source: supabaseConfigured ? "supabase" : "fallback" });
  } catch (e) {
    res.status(503).json({ error: e.message });
  }
});

app.get("/api/opportunities", (req, res) => res.json({ data: opportunities, source: "static" }));


app.post("/api/agents/workflow", async (req, res) => {
  try {
    const records = Array.isArray(req.body.records) ? req.body.records : [];
    const profile = req.body.profile || {};
    const pathway = req.body.pathway || "";

    const research = await researchAgent({ records });
    log(research.agent, research.status, { count: research.count });

    const verification = await verificationAgent(research.records);
    log(verification.agent, verification.status, {
      verified: verification.verified,
      rejected: verification.rejected
    });

    const pathways = await getCareerPathwaysFromDb();
    globalThis.__LEGALPATH_PATHWAYS__ = pathways;
    const intelligence = assessmentAgent(profile);
    log(intelligence.agent, intelligence.status, {
      hypotheses: intelligence.pathways.length
    });

    const verified = verification.records.filter(r => r.verification_status === "verified");
    const matching = matchingAgent(profile, verified);
    log(matching.agent, matching.status, { count: matching.matches.length });

    const roadmap = roadmapAgent(profile, pathway || intelligence.pathways[0]?.pathway || "");
    log(roadmap.agent, roadmap.status);

    res.json({
      workflow: "research -> verification -> career intelligence -> matching -> career coach",
      research,
      verification,
      intelligence,
      matching,
      roadmap
    });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.post("/api/agents/assessment", async (req, res) => {
  try {
    globalThis.__LEGALPATH_PATHWAYS__ = await getCareerPathwaysFromDb();
    const out = assessmentAgent(req.body.profile || {});
    log(out.agent, out.status, { hypotheses: out.pathways.length });
    res.json(out);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.post("/api/agents/roadmap", (req, res) => {
  try {
    const out = roadmapAgent(req.body.profile || {}, req.body.pathway || "");
    log(out.agent, out.status, { pathway: out.pathway });
    res.json(out);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

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
    globalThis.__LEGALPATH_PATHWAYS__ = await getCareerPathwaysFromDb();
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
