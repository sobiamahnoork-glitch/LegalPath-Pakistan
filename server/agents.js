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

    const explicitMatch = explicitSkills.some(s => s.includes(normalize(skillName)) || normalize(skillName).includes(s));
    const evidenceRow = studentSkillEvidence.find(x => normalize(x.name || x.skill_name) === normalize(skillName));
    const proficiency = Number(evidenceRow?.proficiency);
    const evidenceMatch = Number.isFinite(proficiency) && proficiency >= 1;
    const textMatch = text.includes(normalize(skillName));

    if (explicitMatch || evidenceMatch || textMatch) {
      const proficiencyFactor = evidenceMatch ? Math.min(1, proficiency / 5) : 1;
      score += weight * proficiencyFactor;
      matchedSkills.push(skillName);
      evidence.push({
        type: "skill",
        label: "Pathway Skill Match",
        summary: `${skillName} (core skill confirmed from profile)`
      });
    } else {
      missingSkills.push(skillName);
    }
  }

  // Academic stage signal
  if (profile.year) {
    evidence.push({
      type: "stage",
      label: "Academic Stage",
      summary: `${profile.year} student profile`
    });
  }

  // Domain signals with clean human-readable summaries
  const pathwayName = normalize(pathway.name);
  if (profile.interests) {
    const interestText = String(profile.interests).toLowerCase();
    const matchesDomain =
      (pathwayName.includes("human rights") && /human rights|public interest|legal aid|constitutional|justice|equality|ngo/.test(interestText)) ||
      (pathwayName.includes("arbitration") && /arbitration|adr|mediation|negotiation|dispute/.test(interestText)) ||
      (pathwayName.includes("corporate") && /corporate|commercial|business|company|contract|m&a|merger|transaction/.test(interestText)) ||
      (pathwayName.includes("litigation") && /litigation|advocacy|court|trial|pleading|chamber/.test(interestText)) ||
      (pathwayName.includes("judiciary") && /judiciary|judicial|judge|magistrate|bench/.test(interestText)) ||
      (pathwayName.includes("government") && /government|legislat|policy|public sector|civil service/.test(interestText)) ||
      (pathwayName.includes("international") && /international|diploma|treaty|un|global/.test(interestText)) ||
      (pathwayName.includes("tax") && /tax|banking|finance|fiscal|compliance/.test(interestText)) ||
      (pathwayName.includes("criminal") && /criminal|prosecution|investigat|penal/.test(interestText)) ||
      (pathwayName.includes("academia") && /academia|research|technology|teaching|scholar/.test(interestText));

    if (matchesDomain) {
      score += 4;
      evidence.push({
        type: "interests",
        label: "Legal Interest Alignment",
        summary: `Expressed strong alignment with ${pathway.name}`
      });
    }
  }

  if (profile.environment) {
    const envText = String(profile.environment).toLowerCase();
    const envMatch =
      (pathwayName.includes("human rights") && /ngo|clinic|legal aid|society|public/.test(envText)) ||
      (pathwayName.includes("corporate") && /corporate|firm|in-house|office|consulting/.test(envText)) ||
      (pathwayName.includes("litigation") && /court|chamber|bar|trial/.test(envText)) ||
      (pathwayName.includes("judiciary") && /court|judicial|bench/.test(envText)) ||
      (pathwayName.includes("government") && /public|ministry|secretariat|department/.test(envText)) ||
      (pathwayName.includes("arbitration") && /tribunal|centre|adr|mediation/.test(envText));

    if (envMatch) {
      score += 2;
      evidence.push({
        type: "environment",
        label: "Preferred Work Environment",
        summary: `Environment preference aligns with ${pathway.name}`
      });
    }
  }

  if (profile.activities) {
    const actText = String(profile.activities).toLowerCase();
    const actMatch =
      (pathwayName.includes("human rights") && /clinic|human rights|volunt|aid|pro bono|community/.test(actText)) ||
      (pathwayName.includes("litigation") && /moot|mock trial|court|debate|intern/.test(actText)) ||
      (pathwayName.includes("arbitration") && /vis moot|adr|negotiation|mediation|arbitration/.test(actText)) ||
      (pathwayName.includes("international") && /jessup|mun|international|treaty/.test(actText)) ||
      (pathwayName.includes("academia") && /research|journal|publication|editorial|writing/.test(actText));

    if (actMatch) {
      score += 3;
      evidence.push({
        type: "activities",
        label: "Practical Activity Evidence",
        summary: `Relevant student activity recorded in profile`
      });
    }
  }

  // Self-rated numeric confidence signals
  const numericMap = [
    { key: "research", label: "Legal Research", match: /judiciary|government|international|academia|human rights/ },
    { key: "advocacy", label: "Advocacy", match: /litigation|criminal|human rights|arbitration/ },
    { key: "negotiation", label: "Negotiation", match: /corporate|arbitration|tax/ },
    { key: "publicSpeaking", label: "Public Speaking", match: /litigation|human rights|international/ }
  ];

  for (const { key, label, match } of numericMap) {
    const val = Number(profile[key]);
    if (Number.isFinite(val) && val >= 3 && match.test(pathwayName)) {
      score += val - 2;
      evidence.push({
        type: "confidence",
        label: "Capability Confidence",
        summary: `${label} self-rated at ${val}/5`
      });
    }
  }

  const skillMatchScore = maxScore ? Math.round((score / maxScore) * 70) : 0;
  const totalScore = Math.min(100, Math.round(skillMatchScore + Math.min(30, score)));

  return {
    ...pathway,
    match_score: totalScore,
    skill_match_score: skillMatchScore,
    matched_skills: matchedSkills,
    skill_gaps: missingSkills,
    evidence
  };
}

export function careerIntelligenceAgent(profile = {}, suppliedPathways = null) {
  const pathways = asArray(suppliedPathways ?? globalThis.__LEGALPATH_PATHWAYS__);
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

export function assessmentAgent(profile = {}, suppliedPathways = null) {
  const pathways = asArray(suppliedPathways ?? globalThis.__LEGALPATH_PATHWAYS__);
  const ranked = pathways
    .map(pathway => scorePathway(pathway, profile))
    .sort((a, b) => b.match_score - a.match_score);

  return {
    agent: "Career Intelligence Agent",
    status: "completed",
    mode: "exploration",
    note: "These are career-fit hypotheses based on profile evidence and database pathway definitions.",
    pathways: ranked.slice(0, 5).map((p, index) => ({
      pathway: p.name,
      pathway_id: p.id,
      match_score: p.match_score,
      evidence: p.evidence,
      matched_skills: p.matched_skills,
      skill_gaps: p.skill_gaps,
      hypothesis: p.matched_skills.length > 0
        ? `Demonstrated alignment in ${p.matched_skills.slice(0, 3).join(", ")}${p.matched_skills.length > 3 ? ` and ${p.matched_skills.length - 3} other pathway skills` : ""} with relevant ${profile.year || "academic"} profile evidence.`
        : `Exploration signal based on expressed interests and capabilities, with key pathway skills identified for development.`,
      rank: index + 1
    }))
  };
}

export function matchingAgent(profile = {}, opportunities = [], selectedPathway = null) {
  const normSelected = selectedPathway ? normalize(selectedPathway) : null;
  const verifiedActive = asArray(opportunities).filter(o => o.verification_status === "verified" && o.is_active !== false);

  // Filter strictly by selected pathway relevance
  const relevant = verifiedActive.filter(o => {
    if (!normSelected) return true;
    const oppPathways = asArray(o.pathways).map(normalize);
    return oppPathways.some(p => p.includes(normSelected) || normSelected.includes(p));
  });

  const text = profileText(profile);
  const userSkills = new Set([
    ...asArray(profile.skills).map(normalize),
    ...text.split(/[,;\n]+/).map(normalize)
  ].filter(Boolean));

  const matches = relevant.map(o => {
    const required = asArray(o.skills || o.required_skills);
    const matched = required.filter(skill => userSkills.has(normalize(skill)) || text.includes(normalize(skill)));
    const matchScore = required.length ? Math.round((matched.length / required.length) * 100) : 50;

    return {
      id: o.id,
      title: o.title,
      organisation: o.organisation || o.organization,
      opportunity_type: o.opportunity_type || o.type,
      location: o.location || "Pakistan",
      deadline: o.deadline || null,
      source_url: o.source_url || o.application_url || null,
      verification_status: o.verification_status,
      pathways: o.pathways || [],
      matched_skills: matched,
      missing_skills: required.filter(s => !matched.includes(s)),
      match_score: matchScore
    };
  }).sort((a, b) => b.match_score - a.match_score);

  return {
    agent: "Opportunity Matching Agent",
    status: "completed",
    selected_pathway: selectedPathway || "all",
    matches,
    count: matches.length,
    note: matches.length > 0
      ? `Found ${matches.length} verified opportunit${matches.length === 1 ? "y" : "ies"} directly mapped to ${selectedPathway || "profile"}.`
      : `No directly matched verified opportunities are currently available for ${selectedPathway || "this pathway"}.`
  };
}

export function filterRelevantSources(sources = [], pathwayName = "", pathwayDetails = {}) {
  const allSources = asArray(sources);
  const normName = normalize(pathwayName);

  const pathwaySourceMap = {
    "human rights": ["Human Rights Commission of Pakistan", "HRCP", "OHCHR", "Pakistan Code", "Pakistan Bar Council"],
    "arbitration": ["Vis Moot", "Pakistan Code", "Pakistan Bar Council"],
    "corporate": ["SECP", "Competition Commission of Pakistan", "State Bank of Pakistan"],
    "litigation": ["Islamabad High Court", "Pakistan Bar Council", "Pakistan Code"],
    "judiciary": ["Islamabad High Court", "Pakistan Code", "Pakistan Bar Council"],
    "government": ["National Assembly of Pakistan", "Pakistan Code", "PIDE"],
    "international": ["Research Society of International Law", "ILSA Jessup", "United Nations Careers", "ICRC"],
    "tax": ["Federal Board of Revenue", "State Bank of Pakistan", "SECP"],
    "criminal": ["National Forensics Agency", "Islamabad High Court", "Pakistan Code"],
    "academia": ["Higher Education Commission Pakistan", "PIDE", "ISSI", "Research Society of International Law"]
  };

  let targetNames = [];
  for (const [key, names] of Object.entries(pathwaySourceMap)) {
    if (normName.includes(key)) {
      targetNames = names;
      break;
    }
  }

  let filtered = allSources.filter(s => targetNames.some(t => normalize(s.name).includes(normalize(t))));

  // Fallback to high-tier sources if none matched
  if (filtered.length === 0) {
    filtered = allSources.filter(s => s.authority_tier === 1).slice(0, 3);
  }

  // Deduplicate and cap at 4 sources max
  const seen = new Set();
  const result = [];
  for (const s of filtered) {
    if (!seen.has(s.name)) {
      seen.add(s.name);
      result.push({
        id: s.id,
        name: s.name,
        url: s.url,
        source_type: s.source_type,
        authority_tier: s.authority_tier
      });
      if (result.length >= 4) break;
    }
  }

  return result;
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
  const pathwaySkills = asArray(selected?.skills);
  const text = profileText(profile);
  const explicitSkills = asArray(profile.skills).map(normalize);

  // Divide into Current Strengths vs Priority Development Skills (STRICTLY MUTUALLY EXCLUSIVE)
  const currentStrengths = [];
  const priorityDevelopment = [];

  for (const skill of pathwaySkills) {
    const norm = normalize(skill);
    const hasExplicit = explicitSkills.some(s => s.includes(norm) || norm.includes(s));
    const hasText = text.includes(norm);
    const isAdvocacy = norm.includes("advocacy") && Number(profile.advocacy) >= 3;
    const isResearch = (norm.includes("research") || norm.includes("writing")) && Number(profile.research) >= 3;
    const isNegotiation = (norm.includes("negotiation") || norm.includes("arbitration")) && Number(profile.negotiation) >= 3;
    const isSpeaking = (norm.includes("communication") || norm.includes("speaking")) && Number(profile.publicSpeaking) >= 3;

    if (hasExplicit || isAdvocacy || isResearch || isNegotiation || isSpeaking || hasText) {
      currentStrengths.push(skill);
    } else {
      priorityDevelopment.push(skill);
    }
  }

  const strengths = [...new Set(currentStrengths)];
  const development = [...new Set(priorityDevelopment)].filter(s => !strengths.includes(s));
  const name = normalize(selected?.name || pathway);

  const plans = [
    {
      match: /litigation/,
      goal: "Build courtroom-readiness through a small litigation file: identify the issue, research the applicable law, draft a structured pleading and explain the evidence needed.",
      actions: [
        `Days 1–30: Focus on ${development[0] || "Pleading Drafting"}: analyse the structure of real court documents and verify applicable procedural rules from approved legal sources.`,
        `Days 31–60: Build an exercise file: issue-spotting, authorities, pleading outline, and evidence plan applying ${development[1] || "Evidence Law"}.`,
        "Days 61–90: Complete a clean portfolio writing sample demonstrating research and pleading technique, recording feedback on areas for refinement."
      ]
    },
    {
      match: /judiciary/,
      goal: "Build judicial-reasoning evidence through structured legal research, statutory interpretation and judgment-style writing.",
      actions: [
        `Days 1–30: Practise statutory interpretation and issue analysis focusing on ${development[0] || "Constitutional and Civil Law"} using verified legal sources.`,
        "Days 31–60: Draft a short judgment-style analysis for a defined legal problem, clearly separating facts, issues, law, reasoning, and conclusions.",
        "Days 61–90: Revise the analysis using academic or mentor feedback and preserve the research trail and final draft in your career portfolio."
      ]
    },
    {
      match: /corporate/,
      goal: "Build commercial-law evidence by moving from contract reading to drafting, negotiation and risk identification.",
      actions: [
        `Days 1–30: Analyse commercial agreement clauses focusing on ${development[0] || "Contract Drafting"} and regulatory compliance obligations.`,
        `Days 31–60: Draft standard commercial clauses and prepare a concise risk memo highlighting ${development[1] || "Regulatory Compliance"} and negotiation positions.`,
        "Days 61–90: Refine the drafting into a professional work sample showing commercial reasoning and contractual risk management."
      ]
    },
    {
      match: /government|legislative|regulatory/,
      goal: "Build public-law and policy evidence by connecting legal research with legislation, regulation and practical policy analysis.",
      actions: [
        `Days 1–30: Select a defined Pakistani public-law issue and map the statutory and regulatory framework focusing on ${development[0] || "Policy Analysis"}.`,
        `Days 31–60: Draft a concise legislative or policy brief identifying legal challenges, policy options, and ${development[1] || "Legislative Drafting"} implications.`,
        "Days 61–90: Revise the brief incorporating supervisor or peer critique, archiving a professional policy paper in your portfolio."
      ]
    },
    {
      match: /human rights|public interest/,
      goal: "Build rights-based research and advocacy evidence around a clearly defined Pakistani human-rights or access-to-justice issue.",
      actions: [
        `Days 1–30: Build a verified research dossier on a defined fundamental rights issue, strengthening ${development[0] || "Policy Analysis"} and statutory mapping.`,
        `Days 31–60: Draft a structured legal research brief or clinic submission focusing on ${development[1] || "Communication"} and access-to-justice remedies.`,
        "Days 61–90: Seek clinic, academic, or society review of the brief and preserve the sourced submission as verifiable portfolio evidence."
      ]
    },
    {
      match: /international/,
      goal: "Build international-law research evidence by connecting a defined issue to treaties, international rules and the relevant Pakistani legal context.",
      actions: [
        `Days 1–30: Map applicable international conventions and domestic implementing statutes focusing on ${development[0] || "International Law"}.`,
        "Days 31–60: Prepare a comparative legal memo examining international obligations and Pakistani jurisprudence on the selected topic.",
        "Days 61–90: Edit the memo into an academic publication sample or competition brief, documenting all sources and methodology."
      ]
    },
    {
      match: /arbitration|alternative dispute/,
      goal: "Build dispute-resolution evidence by learning to analyse a dispute, interpret agreement terms and design negotiation, mediation or arbitration strategies.",
      actions: [
        `Days 1–30: Study a defined dispute scenario focusing on ${development[0] || "Arbitration"}, dispute resolution clauses, and procedural rules.`,
        `Days 31–60: Prepare a simulated arbitration brief and negotiation strategy document focusing on ${development[1] || "Mediation"} principles.`,
        "Days 61–90: Consolidate the scenario analysis and negotiation outline into a verified ADR portfolio work sample."
      ]
    },
    {
      match: /criminal/,
      goal: "Build criminal-justice evidence through structured analysis of offences, procedure, evidence and investigative issues.",
      actions: [
        `Days 1–30: Map the statutory elements and evidentiary framework for a defined criminal law issue focusing on ${development[0] || "Criminal Procedure"}.`,
        "Days 31–60: Complete a supervised case-analysis brief detailing procedural timelines, admissibility issues, and defence/prosecution arguments.",
        "Days 61–90: Review the brief against leading judicial precedents and archive the finished analysis in your portfolio."
      ]
    },
    {
      match: /tax|banking|finance|compliance/,
      goal: "Build regulatory and financial-law evidence by connecting a defined transaction or compliance problem to the applicable legal framework.",
      actions: [
        `Days 1–30: Examine a specific regulatory compliance issue focusing on ${development[0] || "Tax Law"} and statutory reporting duties.`,
        `Days 31–60: Draft a compliance memo and risk assessment matrix focusing on ${development[1] || "Banking Law"} regulatory guidelines.`,
        "Days 61–90: Consolidate the memo with relevant statutory citations into a professional compliance work sample."
      ]
    },
    {
      match: /academia|research|legal technology/,
      goal: "Build research and legal-technology evidence through a rigorous legal research project and a practical technology-supported output.",
      actions: [
        `Days 1–30: Formulate a novel research hypothesis and construct an authoritative source matrix focusing on ${development[0] || "Research Methodology"}.`,
        `Days 31–60: Draft a substantive research paper incorporating ${development[1] || "Legal Technology"} tools for legal analysis and citation verification.`,
        "Days 61–90: Finalize the paper for journal submission or academic presentation, documenting the verification workflow."
      ]
    }
  ];

  const plan = plans.find(x => x.match.test(name));
  const goal = plan?.goal || "Build demonstrable evidence for the selected pathway through a focused practical project.";
  const actions = plan?.actions || [
    `Days 1–30: Develop foundational knowledge in ${development[0] || "core pathway skills"} using verified legal and institutional sources.`,
    `Days 31–60: Complete a practical drafting or research exercise addressing ${development[1] || "priority skill applications"}.`,
    "Days 61–90: Refine the output with mentor feedback and preserve the final evidence in your professional career portfolio."
  ];

  return {
    agent: "Career Coach Agent",
    status: "completed",
    pathway: selected?.name || pathway,
    pathway_id: selected?.id || null,
    stage,
    experiment_goal: goal,
    current_strengths: strengths,
    priority_development_skills: development,
    priority_skills: development.slice(0, 4),
    skill_gaps: development,
    next_90_days: actions,
    success_indicators: [
      `One completed work sample demonstrating ${development[0] || "pathway"} capability`,
      `Documented evidence of proficiency growth in ${development.slice(0, 2).join(" and ") || "core pathway skills"}`,
      "Structured self-evaluation and recorded mentor or peer feedback",
      "Archived work sample and source log in your career portfolio"
    ],
    principle: "The experiment is an evidence-building roadmap; it should be updated as the student's evidence and achievements grow."
  };
}

