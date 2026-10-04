import "dotenv/config";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";
import { careerPathways, skills, opportunities } from "./data.js";
import { getCareerPathwaysFromDb, getSkillsFromDb, getApprovedSourcesFromDb, getVerifiedOpportunitiesFromDb, getResearchCandidatesFromDb, supabaseConfigured } from "./supabase.js";
import { researchAgent, verificationAgent, careerIntelligenceAgent, matchingAgent, fingerprint, assessmentAgent, roadmapAgent, filterRelevantSources } from "./agents.js";
import { careerCoach } from "./ai.js";

globalThis.__LEGALPATH_PATHWAYS__ = careerPathways;

export const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

const port = Number(process.env.SERVER_PORT || process.env.PORT || 8787);
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
    const approvedSources = await getApprovedSourcesFromDb();
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
  let currentStage = "validation";
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
      error: "Please complete the required profile fields before running the assessment: " + missingFields.join(", ") + ".",
      stage: currentStage
    });
  }

  try {
    currentStage = "research_agent";
    const researchCandidates = await loadResearchCandidates();
    const research = await researchAgent({ records: researchCandidates });
    log("Research Agent", research.status, { count: research.count });

    currentStage = "verification_agent";
    const verification = await verificationAgent(research.records);
    log("Verification Agent", verification.status, {
      verified: verification.verified,
      rejected: verification.rejected,
      active: verification.active
    });

    currentStage = "career_intelligence_agent";
    const loadedPathways = await loadPathways();
    const intelligence = careerIntelligenceAgent(profile, loadedPathways);
    log("Career Intelligence Agent", intelligence.status, {
      recommendations: intelligence.recommendations.length
    });

    currentStage = "assessment_agent";
    const assessment = assessmentAgent(profile, loadedPathways);
    log("Career Intelligence Agent", assessment.status, {
      hypotheses: assessment.pathways.length
    });

    res.json({
      pathways: assessment.pathways,
      mode: assessment.mode,
      note: assessment.note,
      workflow: {
        agents_run: [
          "Research Agent",
          "Verification Agent",
          "Career Intelligence Agent"
        ],
        agents_pending: [
          "Opportunity Matching Agent",
          "Legal Career Coach Agent"
        ],
        note: "Pathway exploration signals ready. Select any pathway and click 'Build 90-day experiment' to generate your personalized action plan."
      },
      intelligence: intelligence.recommendations
    });
  } catch (e) {
    res.status(400).json({
      error: e.message,
      stage: currentStage,
      details: e.stack
    });
  }
});

app.post("/api/agents/roadmap", async (req, res) => {
  let currentStage = "roadmap_agent";
  try {
    const loadedPathways = await loadPathways();
    const profile = req.body.profile || {};
    const pathway = req.body.pathway || "";
    if (!pathway) {
      return res.status(400).json({ error: "Pathway is required to build a 90-day experiment.", stage: "validation" });
    }
    const out = roadmapAgent(profile, pathway);
    const verifiedOpportunities = await loadOpportunities();
    const allApprovedSources = await getApprovedSourcesFromDb();
    const pathwayDetails = loadedPathways.find(p => p.name === out.pathway || p.id === out.pathway) || {};

    // Filter verified opportunities and approved sources strictly for this pathway
    currentStage = "opportunity_matching_agent";
    const matching = matchingAgent(profile, verifiedOpportunities, out.pathway);
    const relevantSources = filterRelevantSources(allApprovedSources, out.pathway, pathwayDetails);

    currentStage = "career_coach_grounding";
    let coach;
    try {
      coach = await careerCoach({
        profile,
        question: `Turn this selected legal career pathway (${out.pathway}) into concise, practical guidance. Stay grounded in the supplied context.`,
        context: {
          career_pathways: loadedPathways,
          selected_pathway: out.pathway,
          pathway_details: pathwayDetails,
          structured_roadmap: out,
          approved_sources: relevantSources,
          verified_opportunities: matching.matches
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
      log("Career Coach Agent", coach.status, { pathway: out.pathway, grounded: false, error: coachError.message });
    }

    log(out.agent, out.status, {
      pathway: out.pathway,
      coach: coach.status
    });
    res.json({
      ...out,
      pathway_details: pathwayDetails,
      matching: matching.matches,
      matching_note: matching.note,
      sources: relevantSources,
      coach,
      workflow: {
        agents_run: [
          "Research Agent",
          "Verification Agent",
          "Career Intelligence Agent",
          "Opportunity Matching Agent",
          "Legal Career Coach Agent"
        ],
        agents_pending: [],
        note: `90-day experiment and grounded coaching prepared for ${out.pathway}.`
      }
    });
  } catch (e) {
    res.status(400).json({
      error: e.message,
      stage: currentStage,
      details: e.stack
    });
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

app.listen(port, "0.0.0.0", () => console.log(`LegalPath API + web app running on port ${port}`));
