export async function careerCoach({ profile, question, context }) {
  const key = process.env.GEMINI_API_KEY;
  const selectedPathway = context?.selected_pathway || "Legal Career Exploration";
  const pathwayDetails = context?.pathway_details || {};
  const structuredRoadmap = context?.structured_roadmap || {};
  const currentStrengths = Array.isArray(structuredRoadmap?.current_strengths) ? structuredRoadmap.current_strengths : [];
  const priorityDevelopment = Array.isArray(structuredRoadmap?.priority_development_skills)
    ? structuredRoadmap.priority_development_skills
    : (structuredRoadmap?.skill_gaps || []);
  const verifiedOpportunities = Array.isArray(context?.verified_opportunities) ? context.verified_opportunities : [];
  const approvedSources = Array.isArray(context?.approved_sources) ? context.approved_sources : [];

  if (!key) {
    return {
      agent: "Career Coach Agent",
      status: "completed",
      grounded: true,
      answer: buildDeterministicGroundedCoaching({ profile, selectedPathway, pathwayDetails, structuredRoadmap, currentStrengths, priorityDevelopment, verifiedOpportunities, approvedSources })
    };
  }

  const prompt = `You are LegalPath Pakistan's grounded legal career coach reasoning layer.
Your role: Reason over verified facts supplied from the student profile and the system database.

SELECTED PATHWAY (MUST REMAIN STRICTLY ON THIS PATHWAY):
"${selectedPathway}"

STUDENT PROFILE:
${JSON.stringify(profile || {}, null, 2)}

DATABASE PATHWAY DETAILS:
${JSON.stringify({
  name: pathwayDetails.name || selectedPathway,
  description: pathwayDetails.description || "",
  typical_roles: pathwayDetails.roles || [],
  core_skills: pathwayDetails.skills || [],
  qualification_note: pathwayDetails.qualification || "Verified qualification requirements are not currently recorded in the database.",
  source_url: pathwayDetails.source_url || null
}, null, 2)}

STUDENT SKILLS BREAKDOWN (MUTUALLY EXCLUSIVE — NEVER DUPLICATE):
- Current Strengths (demonstrated): ${currentStrengths.join(", ") || "Foundational legal education skills"}
- Priority Development Skills (gaps to build): ${priorityDevelopment.join(", ") || "Core pathway competency"}

STRUCTURED 90-DAY EXPERIMENT (DETERMINISTIC LAYER):
${JSON.stringify(structuredRoadmap, null, 2)}

RELEVANT VERIFIED OPPORTUNITIES (ONLY THESE MAY BE MENTIONED):
${JSON.stringify(verifiedOpportunities, null, 2)}

RELEVANT APPROVED DATABASE SOURCES (ONLY THESE MAY BE CITED):
${JSON.stringify(approvedSources, null, 2)}

STRICT GROUNDING RULES:
1. STAY STRICTLY ON "${selectedPathway}". Never switch to another pathway.
2. DO NOT INVENT or assume Pakistani statutes, legal codes (CPC, CrPC, Qanun-e-Shahadat), judicial exams, Law-GAT, pupillage, bar admissions, courts, employers, vacancies, application deadlines, or eligibility requirements unless explicitly provided in the supplied context above.
3. If specific external eligibility, licensing, or qualification requirements are not present in the supplied database context, explicitly state: "Verified external requirements for this pathway are currently unavailable in the system database."
4. Opportunities: ONLY reference items from the relevant verified opportunities list above. If empty, you MUST state: "No directly matched verified opportunities are currently available for this pathway." Do NOT mention Vis Moot, Jessup, or Parliamentary Internship unless they are in the list above!
5. Sources: ONLY cite sources from the relevant approved sources list above.
6. Skills Partitioning: NEVER put the same skill in both Current Strengths and Priority Development Skills.
7. Personalization: Reason directly over the student's self-reported stage (${profile?.year || "not specified"}), skills, interests (${profile?.interests || "not specified"}), capability ratings, and identified skill gaps.

REQUIRED OUTPUT FORMAT (use markdown headers exactly as shown):
## Selected Pathway
${selectedPathway}

## Why This Pathway
[2–4 concise sentences based only on the student's actual evidence and pathway data]

## Current Strengths
[Bullet list of skills from Current Strengths where student already has evidence]

## Priority Development Skills
[Bullet list of skills from Priority Development Skills that the student needs to develop for this pathway]

## 90-Day Evidence Experiment
**Goal**: ${structuredRoadmap.experiment_goal || "Build demonstrable evidence through a focused practical project."}

### Days 1–30
[Action focused on foundational skill development using verified sources]

### Days 31–60
[Action producing a tangible work sample or simulated case study]

### Days 61–90
[Action refining the work sample, seeking feedback, and preserving portfolio evidence]

## Success Indicators
[List 3–4 measurable, concrete milestones tied to the skills and work sample]

## Relevant Verified Opportunities
[List only the relevant verified opportunities provided above. If none, write: "No directly matched verified opportunities are currently available for this pathway."]

## Relevant Approved Sources
[List only the approved sources provided above with their names and URLs]

## Evidence Gaps
[State what data is not currently recorded in the database, reminding the student that this experiment builds self-evidence and that official eligibility should always be verified directly from official gazettes or regulatory bodies.]`;

  const models = ["gemini-flash-latest", "gemini-3.8-flash"];
  let lastError = null;

  for (const model of models) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        signal: controller.signal
      });

      if (res.ok) {
        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text && text.trim()) {
          clearTimeout(timeout);
          return {
            agent: "Career Coach Agent",
            status: "completed",
            model,
            answer: text.trim(),
            grounded: true
          };
        }
      } else {
        const errText = await res.text().catch(() => "");
        lastError = new Error(`Gemini ${model} failed (${res.status}): ${errText}`);
      }
    } catch (err) {
      lastError = err;
    } finally {
      clearTimeout(timeout);
    }
  }

  // Graceful grounded fallback if both models fail or timeout
  return {
    agent: "Career Coach Agent",
    status: "completed",
    grounded: true,
    warning: lastError?.message || "AI model transiently unavailable; using deterministic database grounding.",
    answer: buildDeterministicGroundedCoaching({ profile, selectedPathway, pathwayDetails, structuredRoadmap, currentStrengths, priorityDevelopment, verifiedOpportunities, approvedSources })
  };
}

function buildDeterministicGroundedCoaching({ profile, selectedPathway, pathwayDetails, structuredRoadmap, currentStrengths, priorityDevelopment, verifiedOpportunities, approvedSources }) {
  const actions = structuredRoadmap.next_90_days || [];
  const goal = structuredRoadmap.experiment_goal || "Build verifiable skills through a focused practical project.";

  const oppText = verifiedOpportunities.length > 0
    ? verifiedOpportunities.map(o => `- **${o.title}** at ${o.organisation || "Organisation"} (${o.location || "Pakistan"})${o.deadline ? ` · Deadline: ${o.deadline}` : ""}`).join("\n")
    : "No directly matched verified opportunities are currently available for this pathway.";

  const srcText = approvedSources.length > 0
    ? approvedSources.map(s => `- **${s.name}** (${s.source_type || "Official Authority"})${s.url ? `: [${s.url}](${s.url})` : ""}`).join("\n")
    : "Verified external source records are currently being updated in the database.";

  return `## Selected Pathway
${selectedPathway}

## Why This Pathway
Your profile indicates interest in ${profile?.interests || selectedPathway} at the ${profile?.year || "law student"} stage. Based on the LegalPath database, this pathway matches your current evidence profile and represents a structured exploration direction.

## Current Strengths
${currentStrengths.length > 0 ? currentStrengths.map(s => `- **${s}**: Confirmed competency signal from student profile.`).join("\n") : "- Foundational legal education and research interest."}

## Priority Development Skills
${priorityDevelopment.length > 0 ? priorityDevelopment.map(s => `- **${s}**: Target skill to build during the 90-day experiment.`).join("\n") : "- Deepen existing core pathway capabilities."}

## 90-Day Evidence Experiment
**Goal**: ${goal}

### Days 1–30
${actions[0] || "Develop foundational knowledge in core pathway skills using verified legal sources."}

### Days 31–60
${actions[1] || "Complete a practical drafting or research exercise demonstrating priority skill applications."}

### Days 61–90
${actions[2] || "Refine the output with mentor feedback and preserve the final evidence in your professional career portfolio."}

## Success Indicators
- One completed pathway-specific work sample
- Documented progress in priority skills: ${priorityDevelopment.slice(0, 2).join(" and ") || "core pathway capabilities"}
- Structured self-evaluation and recorded mentor or peer feedback
- Archived work sample and source log in your career portfolio

## Relevant Verified Opportunities
${oppText}

## Relevant Approved Sources
${srcText}

## Evidence Gaps
Verified external eligibility, examination requirements, and regulatory details for this pathway are not assumed by the AI. Always consult official regulatory notices and bar council publications for formal licensing prerequisites.`;
}
