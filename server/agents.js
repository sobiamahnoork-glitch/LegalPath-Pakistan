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
  const explicitSkills = asArray(profile.skills)
    .map(normalize)
    .filter(Boolean);
  const studentSkillEvidence = asArray(profile.student_skills);
  const evidence = [];

  let score = 0;
  let maxScore = 0;
  const matchedSkills = [];
  const missingSkills = [];

  for (const skill of pathwaySkills) {
    const skillName = clean(skill);
    if (!skillName) continue;

    const detail = skillDetails.find(x => normalize(x.name) === normalize(skillName));
    const importance = detail?.importance || "core";
    const weight = importance === "core" ? 3 : importance === "supporting" ? 2 : 1;
    maxScore += weight;

    const explicitMatch = explicitSkills.includes(normalize(skillName));
    const evidenceRow = studentSkillEvidence.find(x => normalize(x.name || x.skill_name) === normalize(skillName));
    const proficiency = Number(evidenceRow?.proficiency);
    const evidenceMatch = Number.isFinite(proficiency) && proficiency >= 1;

    if (explicitMatch || evidenceMatch || text.includes(normalize(skillName))) {
      const proficiencyFactor = evidenceMatch ? Math.min(1, proficiency / 5) : 1;
      score += weight * proficiencyFactor;
      matchedSkills.push(skillName);
      evidence.push({
        type: "skill",
        value: skillName,
        importance,
        weight,
        proficiency: evidenceMatch ? proficiency : null,
        source: evidenceRow?.source || null,
        evidence: evidenceRow?.evidence || null
      });
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

  const skillMatchScore = maxScore ? Math.round((score / maxScore) * 70) : 0;

  return {
    ...pathway,
    match_score: Math.min(100, skillMatchScore + Math.min(30, score)),
    skill_match_score: skillMatchScore,
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
  const name = normalize(selected?.name || pathway);

  const plans = [
    {
      match: /litigation/,
      goal: "Build courtroom-readiness through a small litigation file: identify the issue, research the applicable law, draft a structured pleading and explain the evidence needed.",
      actions: [
        "Days 1–30: strengthen Pleading Drafting and Evidence Law by analysing the structure of a real, verified court document or approved legal source.",
        "Days 31–60: complete a supervised or academic litigation exercise: issue-spotting, authorities, pleading outline and evidence plan.",
        "Days 61–90: turn the work into a clean portfolio sample and record feedback on research, drafting and advocacy."
      ]
    },
    {
      match: /judiciary/,
      goal: "Build judicial-reasoning evidence through structured legal research, statutory interpretation and judgment-style writing.",
      actions: [
        "Days 1–30: practise identifying issues, relevant provisions and authorities from verified legal materials.",
        "Days 31–60: write a short judgment-style analysis for a defined legal problem, separating facts, issues, law, reasoning and conclusion.",
        "Days 61–90: revise the work using feedback and preserve the research trail and final writing sample in your portfolio."
      ]
    },
    {
      match: /corporate/,
      goal: "Build commercial-law evidence by moving from contract reading to drafting, negotiation and risk identification.",
      actions: [
        "Days 1–30: analyse a contract structure and identify commercial, regulatory and drafting risks.",
        "Days 31–60: produce a supervised or academic contract clause exercise plus a short risk memo and negotiation points.",
        "Days 61–90: refine the work into a portfolio sample showing contract interpretation, drafting and commercial reasoning."
      ]
    },
    {
      match: /government|legislative|regulatory/,
      goal: "Build public-law and policy evidence by connecting legal research with legislation, regulation and practical policy analysis.",
      actions: [
        "Days 1–30: select a defined Pakistani public-law issue and map the relevant constitutional, statutory and regulatory sources.",
        "Days 31–60: produce a short legislative or policy analysis identifying the problem, legal framework, options and implications.",
        "Days 61–90: revise the work with feedback and preserve a concise policy/legal writing sample for your portfolio."
      ]
    },
    {
      match: /human rights|public interest/,
      goal: "Build rights-based research and advocacy evidence around a clearly defined Pakistani human-rights or access-to-justice issue.",
      actions: [
        "Days 1–30: choose one issue and build a verified-source research file covering the applicable constitutional and legal framework.",
        "Days 31–60: turn the research into a concise legal research note or policy brief with clearly sourced claims.",
        "Days 61–90: seek supervised academic, clinic, competition or research feedback where genuinely available and preserve the final evidence."
      ]
    },
    {
      match: /international/,
      goal: "Build international-law research evidence by connecting a defined issue to treaties, international rules and the relevant Pakistani legal context.",
      actions: [
        "Days 1–30: select one issue and map the applicable international instruments and verified Pakistani sources.",
        "Days 31–60: prepare a structured comparative research note explaining the legal framework and its practical implications.",
        "Days 61–90: edit the note into a professional writing sample and document the sources, reasoning and feedback."
      ]
    },
    {
      match: /arbitration|alternative dispute/,
      goal: "Build dispute-resolution evidence by learning to analyse a dispute, interpret agreement terms and design negotiation, mediation or arbitration strategies.",
      actions: [
        "Days 1–30: study a defined dispute scenario and identify the dispute, relevant contract terms, procedural route and evidence needed.",
        "Days 31–60: complete a negotiation/mediation or arbitration exercise with a written strategy and outcome analysis.",
        "Days 61–90: consolidate the exercise into a portfolio sample showing dispute analysis, communication and ADR reasoning."
      ]
    },
    {
      match: /criminal/,
      goal: "Build criminal-justice evidence through structured analysis of offences, procedure, evidence and investigative issues.",
      actions: [
        "Days 1–30: choose a defined criminal-law problem and map the applicable offence, procedure and evidentiary framework from verified sources.",
        "Days 31–60: complete a supervised or academic case-analysis exercise covering issues, evidence and procedural steps.",
        "Days 61–90: refine the analysis into a portfolio sample and record feedback on research and criminal-procedure reasoning."
      ]
    },
    {
      match: /tax|banking|finance|compliance/,
      goal: "Build regulatory and financial-law evidence by connecting a defined transaction or compliance problem to the applicable legal framework.",
      actions: [
        "Days 1–30: choose one tax, banking, finance or compliance issue and map the relevant verified legal/regulatory sources.",
        "Days 31–60: prepare a short risk or compliance memo explaining the issue, obligations and practical controls.",
        "Days 61–90: refine the memo into a professional work sample and document the legal sources and feedback."
      ]
    },
    {
      match: /academia|research|legal technology/,
      goal: "Build research and legal-technology evidence through a rigorous legal research project and a practical technology-supported output.",
      actions: [
        "Days 1–30: define a focused research question and build a source map using verified legal materials.",
        "Days 31–60: produce a structured research note and use an appropriate legal-technology workflow to organise, analyse or present the evidence.",
        "Days 61–90: revise the output, document methodology and preserve the final research/technology sample in your portfolio."
      ]
    }
  ];

  const plan = plans.find(x => x.match.test(name));
  const goal = plan?.goal || "Build evidence for the selected pathway through a focused research or practical project tied to its core skills.";
  const actions = plan?.actions || [
    "Days 1–30: define a focused pathway question and strengthen the highest-priority skill gap using verified learning and legal sources.",
    "Days 31–60: complete a practical or academic project that demonstrates the selected pathway skills.",
    "Days 61–90: refine the work with feedback and preserve a professional evidence sample in your portfolio."
  ];

  const priority = gaps.length ? gaps.slice(0, 4) : (selected?.skills || []).slice(0, 4);

  return {
    agent: "Career Coach Agent",
    status: "completed",
    pathway: selected?.name || pathway,
    stage,
    experiment_goal: goal,
    skill_gaps: gaps,
    priority_skills: priority,
    next_90_days: actions,
    success_indicators: [
      "One completed pathway-specific work sample",
      "Clear evidence of at least one strengthened priority skill",
      "Documented feedback or reflection on what changed",
      "A portfolio-ready record of the experiment"
    ],
    principle: "The roadmap is a practical experiment plan; it should be updated as the student's evidence and interests change."
  };
}

