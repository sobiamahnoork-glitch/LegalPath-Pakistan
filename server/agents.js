import crypto from "node:crypto";

const clean = value => String(value ?? "").trim();
const normalize = value => clean(value).toLowerCase();
const asArray = value => Array.isArray(value) ? value : value ? [value] : [];

const validUrl = value => {
  try {
    const u = new URL(value);
    return ["http:", "https:"].includes(u.protocol);
  } catch {
    return false;
  }
};

const profileText = profile =>
  Object.entries(profile || {})
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    .map(([key, value]) => key + ": " + (Array.isArray(value) ? value.join(", ") : value))
    .join(" ")
    .toLowerCase();

export async function researchAgent(input = {}) {
  const records = asArray(input.records).map(record => ({
    ...record,
    title: clean(record.title),
    organisation: clean(record.organisation || record.organization),
    source_url: clean(record.source_url || record.application_url || record.url),
    opportunity_type: clean(record.opportunity_type || record.type || "other"),
    description: clean(record.description),
    location: clean(record.location),
    eligibility: clean(record.eligibility),
    deadline: record.deadline || null,
    discovered_at: new Date().toISOString()
  }));

  return {
    agent: "Research Agent",
    status: "completed",
    records,
    count: records.length,
    source_first: true,
    timestamp: new Date().toISOString()
  };
}

export async function verificationAgent(records = []) {
  const now = Date.now();
  const checked = asArray(records).map(record => {
    const issues = [];
    const sourceUrl = record.source_url || record.application_url || record.url;

    if (!record.title) issues.push("missing title");
    if (!record.organisation && !record.organization) issues.push("missing organisation");
    if (!sourceUrl) issues.push("missing source URL");
    else if (!validUrl(sourceUrl)) issues.push("invalid source URL");

    if (record.deadline && Number.isNaN(Date.parse(record.deadline))) {
      issues.push("invalid deadline");
    }

    const deadlineMs = record.deadline ? Date.parse(record.deadline) : null;
    const expired = Number.isFinite(deadlineMs) && deadlineMs < now;
    if (expired) issues.push("deadline has passed");

    const verified = issues.length === 0;

    return {
      ...record,
      source_url: sourceUrl || null,
      verification_status: verified ? "verified" : "rejected",
      verification_issues: issues,
      verified_at: verified ? new Date().toISOString() : null,
      last_verified_at: new Date().toISOString(),
      is_active: verified && !expired
    };
  });

  return {
    agent: "Verification Agent",
    status: "completed",
    records: checked,
    verified: checked.filter(x => x.verification_status === "verified").length,
    rejected: checked.filter(x => x.verification_status === "rejected").length,
    active: checked.filter(x => x.is_active).length
  };
}

function scorePathway(pathway, profile) {
  const text = profileText(profile);
  const pathwaySkills = asArray(pathway.skills);
  const skillDetails = asArray(pathway.skill_details);
  const evidence = [];

  let score = 0;
  const matchedSkills = [];
  const missingSkills = [];

  for (const skill of pathwaySkills) {
    const skillName = clean(skill);
    if (!skillName) continue;

    if (text.includes(normalize(skillName))) {
      const detail = skillDetails.find(x => normalize(x.name) === normalize(skillName));
      const weight = detail?.importance === "core" ? 3 : detail?.importance === "supporting" ? 2 : 1;
      score += weight;
      matchedSkills.push(skillName);
      evidence.push({ type: "skill", value: skillName, weight });
    } else {
      missingSkills.push(skillName);
    }
  }

  const signals = {
    research: ["research", "writing", "analysis", "judgment"],
    advocacy: ["advocacy", "court", "litigation", "argument", "moot"],
    negotiation: ["negotiation", "mediation", "arbitration", "dispute"],
    publicSpeaking: ["public speaking", "presentation", "debate", "speaking"],
    environment: [profile.environment],
    interests: [profile.interests],
    activities: [profile.activities]
  };

  for (const [field, values] of Object.entries(signals)) {
    const value = values.filter(Boolean).join(" ").toLowerCase();
    if (!value) continue;

    const pathwayName = normalize(pathway.name);
    const targeted =
      (pathwayName.includes("litigation") && ["advocacy", "court", "litigation", "argument", "moot"].some(x => value.includes(x))) ||
      (pathwayName.includes("judiciary") && ["judiciary", "judicial", "reasoning", "judgment"].some(x => value.includes(x))) ||
      (pathwayName.includes("corporate") && ["business", "corporate", "commercial", "contract", "finance", "compliance"].some(x => value.includes(x))) ||
      (pathwayName.includes("government") && ["government", "policy", "legislation", "regulation", "public sector"].some(x => value.includes(x))) ||
      (pathwayName.includes("human rights") && ["human rights", "social justice", "legal aid", "public interest"].some(x => value.includes(x))) ||
      (pathwayName.includes("international") && ["international", "global", "foreign affairs", "diplomacy", "humanitarian"].some(x => value.includes(x))) ||
      (pathwayName.includes("arbitration") && ["arbitration", "adr", "negotiation", "mediation", "dispute"].some(x => value.includes(x))) ||
      (pathwayName.includes("criminal") && ["criminal", "prosecution", "investigation", "evidence", "forensic"].some(x => value.includes(x))) ||
      (pathwayName.includes("tax") && ["tax", "banking", "finance", "aml", "compliance"].some(x => value.includes(x))) ||
      (pathwayName.includes("academia") && ["research", "writing", "academia", "teaching", "technology", "legal tech", "ai"].some(x => value.includes(x)));

    if (targeted) {
      score += field === "environment" || field === "interests" ? 3 : 2;
      evidence.push({ type: field, value: value.slice(0, 160) });
    }
  }

  const numericFields = ["research", "advocacy", "negotiation", "publicSpeaking"];
  for (const field of numericFields) {
    const level = Number(profile[field]);
    if (!Number.isFinite(level)) continue;

    const relevant =
      (field === "advocacy" && /litigation|criminal|human rights/.test(normalize(pathway.name))) ||
      (field === "research" && /judiciary|government|international|academia|human rights/.test(normalize(pathway.name))) ||
      (field === "negotiation" && /corporate|arbitration|tax/.test(normalize(pathway.name))) ||
      (field === "publicSpeaking" && /litigation|human rights|international/.test(normalize(pathway.name)));

    if (relevant) {
      score += Math.max(0, level - 2);
      evidence.push({ type: field, value: level });
    }
  }

  return {
    ...pathway,
    match_score: score,
    matched_skills: matchedSkills,
    skill_gaps: missingSkills.slice(0, 6),
    evidence
  };
}

export function careerIntelligenceAgent(profile = {}) {
  const pathways = asArray(globalThis.__LEGALPATH_PATHWAYS__);
  const recommendations = pathways
    .map(pathway => scorePathway(pathway, profile))
    .sort((a, b) => b.match_score - a.match_score);

  return {
    agent: "Career Intelligence Agent",
    status: "completed",
    mode: "exploration",
    recommendations,
    note: "Scores are evidence-based exploration signals, not deterministic career decisions.",
    profile_fields_used: Object.keys(profile || {})
  };
}

export function assessmentAgent(profile = {}) {
  const pathways = asArray(globalThis.__LEGALPATH_PATHWAYS__);
  const ranked = pathways
    .map(pathway => scorePathway(pathway, profile))
    .sort((a, b) => b.match_score - a.match_score);

  return {
    agent: "Career Intelligence Agent",
    status: "completed",
    mode: "exploration",
    note: "These are career-fit hypotheses, not deterministic career decisions. They should be updated as the student's evidence changes.",
    pathways: ranked.slice(0, 5).map((p, index) => ({
      pathway: p.name,
      match_score: p.match_score,
      evidence: p.evidence,
      matched_skills: p.matched_skills,
      skill_gaps: p.skill_gaps,
      hypothesis: p.match_score
        ? `This pathway is worth exploring because the profile contains ${p.evidence.length} supporting signals and ${p.matched_skills.length} pathway skill matches.`
        : "There is not enough evidence yet; try a small career experiment before drawing a conclusion.",
      rank: index + 1
    }))
  };
}

export function matchingAgent(profile = {}, opportunities = []) {
  const text = profileText(profile);
  const userSkills = new Set([
    ...asArray(profile.skills).map(normalize),
    ...text.split(/[,;\n]+/).map(normalize)
  ].filter(Boolean));

  const matches = asArray(opportunities)
    .filter(o => o.verification_status === "verified" && o.is_active !== false)
    .map(o => {
      const required = asArray(o.skills || o.required_skills);
      const matched = required.filter(skill => userSkills.has(normalize(skill)) || text.includes(normalize(skill)));
      const skillScore = required.length ? Math.round((matched.length / required.length) * 100) : 0;
      const pathwayText = asArray(o.pathways || o.pathway).join(" ").toLowerCase();
      const interestScore = pathwayText && text ? (text.split(/[,;\n]+/).some(x => x && pathwayText.includes(x)) ? 20 : 0) : 0;

      return {
        ...o,
        matched_skills: matched,
        missing_skills: required.filter(skill => !matched.includes(skill)),
        match_score: Math.min(100, skillScore + interestScore)
      };
    })
    .filter(x => x.match_score > 0)
    .sort((a, b) => b.match_score - a.match_score);

  return {
    agent: "Opportunity Matching Agent",
    status: "completed",
    matches,
    note: "Only verified active opportunity records are eligible for matching."
  };
}

export function fingerprint(record) {
  return crypto.createHash("sha256").update(JSON.stringify(record)).digest("hex");
}

export function roadmapAgent(profile = {}, pathway = "") {
  const year = String(profile.year || profile.semester || "").toLowerCase();
  const stage = year.includes("1") || year.includes("2")
    ? "Explore"
    : year.includes("3")
      ? "Build"
      : year.includes("4") || year.includes("5") || year.includes("graduate")
        ? "Convert"
        : "Explore";

  const normalizedPathway = normalize(pathway);
  const pathways = asArray(globalThis.__LEGALPATH_PATHWAYS__);
  const selected = pathways.find(p => normalize(p.name) === normalizedPathway || normalize(p.id) === normalizedPathway);
  const gaps = selected ? scorePathway(selected, profile).skill_gaps : [];

  const base = {
    Explore: [
      "Compare 2–3 pathways using their roles, skills and official-source context",
      "Complete one small pathway-specific research or practical task",
      "Attend one relevant academic, moot, clinic or professional activity",
      "Start a focused CV/portfolio section with evidence from the experiment"
    ],
    Build: [
      "Complete a pathway-specific research or practical project",
      "Target a relevant internship, clerkship, research role or competition",
      "Build one demonstrable skill and save evidence of the work",
      "Review feedback and update the career hypothesis"
    ],
    Convert: [
      "Target verified internships, junior roles, research positions or relevant postgraduate routes",
      "Tailor the CV and applications to the selected pathway",
      "Complete one portfolio-quality work sample",
      "Track applications, feedback and evidence for the next iteration"
    ]
  };

  const gapStep = gaps.length
    ? `Prioritise these skill gaps: ${gaps.slice(0, 3).join(", ")}`
    : "Record evidence for the skills you already use and identify the next skill to strengthen";

  return {
    agent: "Career Coach Agent",
    status: "completed",
    pathway: selected?.name || pathway,
    stage,
    skill_gaps: gaps,
    next_90_days: [gapStep, ...(base[stage] || base.Explore).slice(0, 3)],
    principle: "The roadmap is a practical experiment plan; it should be updated as the student's evidence and interests change."
  };
}
