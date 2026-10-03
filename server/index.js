import "dotenv/config";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";
import { careerPathways, skills, opportunities } from "./data.js";
import { getCareerPathwaysFromDb, getSkillsFromDb, getApprovedSourcesFromDb, getVerifiedOpportunitiesFromDb, getResearchCandidatesFromDb, supabaseConfigured } from "./supabase.js";
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

async function loadPathways() {
  const data = await getCareerPathwaysFromDb();
  globalThis.__LEGALPATH_PATHWAYS__ = data;
  return data;
}

async function loadOpportunities() {
  return supabaseConfigured ? getVerifiedOpportunitiesFromDb() : opportunities;
}

async function loadResearchCandidates() {
  return supabaseConfigured ? getResearchCandidatesFromDb() : opportunities;
}

app.get("/api/health", (req, res) =>
  res.json({
    ok: true,
    service: "LegalPath Pakistan API",
    database: supabaseConfigured ? "configured" : "not configured",
    ai: !!process.env.GEMINI_API_KEY,
    version: "0.5.0"
  })
);

app.get("/api/career-pathways", async (req, res) => {
  try {
    const data = await loadPathways();
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

app.get("/api/opportunities", async (req, res) => {
  try {
    const data = await loadOpportunities();
    res.json({ data, source: supabaseConfigured ? "supabase" : "static" });
  } catch (e) {
    res.status(503).json({ error: e.message });
  }
});

app.post("/api/agents/workflow", async (req, res) => {
  const profile = req.body.profile || {};
  try {
    // Opportunities are intentionally empty until verified live data is available.
    // The career assessment workflow must still run without querying the opportunities table.
    const suppliedRecords = Array.isArray(req.body.records) ? req.body.records : null;
    const candidateRecords = suppliedRecords || [];

    const research = await researchAgent({ records: candidateRecords });
    log(research.agent, research.status, { count: research.count });

    const verification = await verificationAgent(research.records);
    log(verification.agent, verification.status, {
      verified: verification.verified,
      rejected: verification.rejected,
      active: verification.active
    });

    await loadPathways();

    const intelligence = careerIntelligenceAgent(profile);
    log(intelligence.agent, intelligence.status, {
      recommendations: intelligence.recommendations.length
    });

    const assessment = assessmentAgent(profile);
    log("Assessment / Career Intelligence", assessment.status, {
      hypotheses: assessment.pathways.length
    });

    const verified = verification.records.filter(r => r.verification_status === "verified" && r.is_active);
    const matching = matchingAgent(profile, verified);
    log(matching.agent, matching.status, { count: matching.matches.length });

    const selectedPathway = req.body.pathway || assessment.pathways[0]?.pathway || "";
    const roadmap = roadmapAgent(profile, selectedPathway);
    log(roadmap.agent, roadmap.status, { pathway: roadmap.pathway });

    let coach;
    try {
      coach = await careerCoach({
        profile,
        question: req.body.question || "Create a practical 90-day career roadmap from this profile.",
        context: {
          career_pathways: globalThis.__LEGALPATH_PATHWAYS__ || [],
          assessment: assessment.pathways,
          verified_opportunities: matching.matches
        }
      });
      log(coach.agent, coach.status);
    } catch (coachError) {
      coach = {
        agent: "Career Coach Agent",
        status: "failed",
        error: coachError.message,
        grounded: false
      };
      log(coach.agent, coach.status, { error: coachError.message });
    }

    res.json({
      workflow: "research -> verification -> career intelligence -> opportunity matching -> career coach",
      research,
      verification,
      intelligence,
      assessment,
      matching,
      roadmap,
      coach
    });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.post("/api/agents/assessment", async (req, res) => {
  const profile = req.body.profile || {};
  const requiredFields = {
    year: "Current year / stage",
    interests: "Legal interests",
    skills: "Current skills",
    activities: "Activities / experience",
    environment: "Preferred working environment",
    geography: "Geographic preference"
  };
  const missingFields = Object.entries(requiredFields)
    .filter(([key]) => !String(profile[key] ?? "").trim())
    .map(([, label]) => label);
  if (missingFields.length) {
    return res.status(400).json({
      error: "Please complete the required profile fields before running the assessment: " + missingFields.join(", ") + "."
    });
  }

  try {
    const research = await researchAgent({ records: [] });
    log("Research Agent", research.status, { count: research.count });

    const verification = await verificationAgent(research.records);
    log("Verification Agent", verification.status, {
      verified: verification.verified,
      rejected: verification.rejected,
      active: verification.active
    });

    await loadPathways();

    const intelligence = careerIntelligenceAgent(profile);
    log("Career Intelligence Agent", intelligence.status, {
      recommendations: intelligence.recommendations.length
    });

    const assessment = assessmentAgent(profile);
    log("Career Intelligence Agent", assessment.status, {
      hypotheses: assessment.pathways.length
    });

    const matching = matchingAgent(profile, []);
    log("Opportunity Matching Agent", matching.status, { count: matching.matches.length });

    res.json({
      ...assessment,
      workflow: {
        agents_run: [
          "Research Agent",
          "Verification Agent",
          "Career Intelligence Agent",
          "Opportunity Matching Agent"
        ],
        agents_pending: ["Career Coach Agent"],
        note: "Career Coach Agent runs when a pathway is selected for a 90-day experiment."
      },
      intelligence: intelligence.recommendations
    });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.post("/api/agents/roadmap", async (req, res) => {
  try {
    await loadPathways();
    const out = roadmapAgent(req.body.profile || {}, req.body.pathway || "");
    log(out.agent, out.status, {
      pathway: out.pathway
    });
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
    log(out.agent, out.status, {
      verified: out.verified,
      rejected: out.rejected,
      active: out.active
    });
    res.json(out);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.post("/api/agents/career-intelligence", async (req, res) => {
  try {
    await loadPathways();
    const out = careerIntelligenceAgent(req.body.profile || {});
    log(out.agent, out.status);
    res.json(out);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.post("/api/agents/match", async (req, res) => {
  try {
    const live = await loadOpportunities();
    const supplied = Array.isArray(req.body.opportunities) ? req.body.opportunities : null;
    const source = supplied || live;
    const out = matchingAgent(req.body.profile || {}, source);
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
