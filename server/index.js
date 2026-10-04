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

const isLocalDevServer = process.env.npm_lifecycle_event === "server" || process.env.LEGALPATH_DEV === "1";
const port = process.env.API_PORT || (isLocalDevServer ? 8787 : (process.env.PORT || 8787));
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
  try {
    const data = await getCareerPathwaysFromDb();
    if (!Array.isArray(data) || data.length === 0) throw new Error("No active career pathways returned from database");
    globalThis.__LEGALPATH_PATHWAYS__ = data;
    return data;
  } catch (error) {
    console.error("[pathways] database read failed:", error.message);
    globalThis.__LEGALPATH_PATHWAYS__ = careerPathways;
    return careerPathways;
  }
}

async function loadOpportunities() {
  if (!supabaseConfigured) return opportunities;
  try {
    const data = await getVerifiedOpportunitiesFromDb();
    return Array.isArray(data) && data.length ? data : opportunities;
  } catch (error) {
    console.error("[opportunities] database read failed:", error.message);
    return opportunities;
  }
}

async function loadResearchCandidates() {
  if (!supabaseConfigured) return opportunities;
  try {
    const data = await getResearchCandidatesFromDb();
    return Array.isArray(data) && data.length ? data : opportunities;
  } catch (error) {
    console.error("[research] database read failed:", error.message);
    return opportunities;
  }
}

async function loadApprovedSources() {
  if (!supabaseConfigured) return [];
  try {
    const data = await getApprovedSourcesFromDb();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error("[sources] database read failed:", error.message);
    return [];
  }
}

app.get("/api/health", async (req, res) => {
  const health = {
    ok: true,
    service: "LegalPath Pakistan API",
    database: supabaseConfigured ? "configured" : "not configured",
    ai: !!process.env.GEMINI_API_KEY,
    version: "0.6.0"
  };

  if (supabaseConfigured) {
    try {
      await getApprovedSourcesFromDb();
      health.database_reachable = true;
    } catch (error) {
      health.ok = false;
      health.database_reachable = false;
      health.database_error = error.message;
    }
  } else {
    health.database_reachable = false;
  }

  res.status(health.ok ? 200 : 503).json(health);
});

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
    // Assessment/workflow uses database-backed opportunity candidates by default.
    // Client-supplied records are not treated as authoritative career data.
    const candidateRecords = await loadResearchCandidates();

    const research = await researchAgent({ records: candidateRecords });
    log(research.agent, research.status, { count: research.count });

    const verification = await verificationAgent(research.records);
    log(verification.agent, verification.status, {
      verified: verification.verified,
      rejected: verification.rejected,
      active: verification.active
    });

    const loadedPathways = await loadPathways();
    if (!Array.isArray(loadedPathways) || loadedPathways.length === 0) throw new Error("No career pathways loaded");

    const intelligence = careerIntelligenceAgent(profile, loadedPathways);
    log(intelligence.agent, intelligence.status, {
      recommendations: intelligence.recommendations.length
    });

    const assessment = assessmentAgent(profile, loadedPathways);
    log("Assessment / Career Intelligence", assessment.status, {
      hypotheses: assessment.pathways.length
    });

    const verified = verification.records.filter(r => r.verification_status === "verified" && r.is_active);
    const matching = matchingAgent(profile, verified);
    const approvedSources = await loadApprovedSources();
    log(matching.agent, matching.status, { count: matching.matches.length });

    const selectedPathway = req.body.pathway || assessment.pathways[0]?.pathway || "";
    const roadmap = roadmapAgent(profile, selectedPathway, loadedPathways);
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
    console.error("[workflow] failed:", e);
    res.status(503).json({
      error: e.message || "Workflow service failed",
      code: "WORKFLOW_BACKEND_ERROR"
    });
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
    // Research Agent starts from approved database candidates instead of an empty list.
    const researchCandidates = await loadResearchCandidates();
    const research = await researchAgent({ records: researchCandidates });
    log("Research Agent", research.status, { count: research.count });

    const verification = await verificationAgent(research.records);
    log("Verification Agent", verification.status, {
      verified: verification.verified,
      rejected: verification.rejected,
      active: verification.active
    });

    const loadedPathways = await loadPathways();

    const intelligence = careerIntelligenceAgent(profile, loadedPathways);
    log("Career Intelligence Agent", intelligence.status, {
      recommendations: intelligence.recommendations.length
    });

    const assessment = assessmentAgent(profile, loadedPathways);
    log("Career Intelligence Agent", assessment.status, {
      hypotheses: assessment.pathways.length
    });

    // Match only opportunities that passed the verification step.
    const verified = verification.records.filter(r => r.verification_status === "verified" && r.is_active);
    const matching = matchingAgent(profile, verified);
    const approvedSources = await getApprovedSourcesFromDb();
    log("Opportunity Matching Agent", matching.status, { count: matching.matches.length });

    // The fifth agent now runs as part of the assessment itself.
    // It uses the strongest exploration hypothesis as the initial experiment,
    // while the UI can still rebuild the experiment when another pathway is selected.
    const selectedPathway = assessment.pathways[0]?.pathway || "";
    const roadmap = roadmapAgent(profile, selectedPathway, loadedPathways);

    // Keep the structured roadmap as the deterministic layer and add
    // grounded Gemini coaching from the same supplied career context.
    let coach;
    try {
      coach = await careerCoach({
        profile,
        question: "Turn the strongest pathway signal into concise, practical career guidance for the next 90 days.",
        context: {
          career_pathways: globalThis.__LEGALPATH_PATHWAYS__ || [],
          selected_pathway: selectedPathway,
          assessment: assessment.pathways,
          structured_roadmap: roadmap,
          approved_sources: approvedSources,
          verified_opportunities: matching.matches
        }
      });
      log("Career Coach Agent", coach.status, { pathway: roadmap.pathway, grounded: true });
    } catch (coachError) {
      coach = {
        agent: "Career Coach Agent",
        status: "fallback",
        error: coachError.message,
        grounded: false,
        answer: "The structured 90-day experiment is ready. AI narrative coaching will appear when the Gemini service is configured."
      };
      log("Career Coach Agent", coach.status, { pathway: roadmap.pathway, grounded: false });
    }

    const pathwayHypotheses = Array.isArray(assessment.pathways) ? assessment.pathways : [];
    if (!pathwayHypotheses.length) throw new Error("Assessment produced no pathway hypotheses");

    res.json({
      ...assessment,
      pathways: pathwayHypotheses,
      pathway_count: pathwayHypotheses.length,
      workflow: {
        agents_run: [
          "Research Agent",
          "Verification Agent",
          "Career Intelligence Agent",
          "Opportunity Matching Agent",
          "Career Coach Agent"
        ],
        agents_pending: [],
        note: "The Career Coach Agent combines a structured pathway experiment with grounded AI coaching. Selecting another pathway rebuilds the experiment for that pathway."
      },
      intelligence: intelligence.recommendations,
      roadmap,
      coach
    });
  } catch (e) {
    console.error("[assessment] failed:", e);
    res.status(503).json({
      error: e.message || "Assessment service failed",
      code: "ASSESSMENT_BACKEND_ERROR"
    });
  }
});

app.post("/api/agents/roadmap", async (req, res) => {
  try {
    await loadPathways();
    const profile = req.body.profile || {};
    const pathway = req.body.pathway || "";
    const out = roadmapAgent(profile, pathway, globalThis.__LEGALPATH_PATHWAYS__ || []);
    const verifiedOpportunities = await loadOpportunities();
    const approvedSources = await getApprovedSourcesFromDb();

    let coach;
    try {
      coach = await careerCoach({
        profile,
        question: "Turn this selected legal career pathway and its 90-day experiment into concise, practical guidance. Stay grounded in the supplied context.",
        context: {
          career_pathways: globalThis.__LEGALPATH_PATHWAYS__ || [],
          selected_pathway: out.pathway,
          structured_roadmap: out,
          approved_sources: approvedSources,
          verified_opportunities: verifiedOpportunities
        }
      });
      log("Career Coach Agent", coach.status, { pathway: out.pathway, grounded: true });
    } catch (coachError) {
      coach = {
        agent: "Career Coach Agent",
        status: "fallback",
        error: coachError.message,
        grounded: false,
        answer: "The structured 90-day experiment is ready. AI narrative coaching will appear when the Gemini service is configured."
      };
      log("Career Coach Agent", coach.status, { pathway: out.pathway, grounded: false });
    }

    log(out.agent, out.status, {
      pathway: out.pathway,
      coach: coach.status
    });
    res.json({ ...out, coach });
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
    const loadedPathways = await loadPathways();
    const out = careerIntelligenceAgent(req.body.profile || {}, loadedPathways);
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

export { app };

// Vercel imports the Express app as a serverless handler.
// Local/Deplexo deployments start the HTTP listener below.
// On Vercel, api/[...path].js imports the app as a serverless function.
if (process.env.VERCEL !== "1") {
  app.listen(port, "0.0.0.0", () => console.log(`LegalPath API + web app running on port ${port}`));
}
