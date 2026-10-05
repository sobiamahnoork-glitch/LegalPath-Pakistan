import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { marked } from "marked";
import {
  Scale,
  Sparkles,
  Target,
  Map,
  Briefcase,
  ShieldCheck,
  CheckCircle2,
  Clock3,
  ArrowUpRight,
  Menu,
  X,
  Search,
  BookOpen,
  ExternalLink,
  Building2,
  CalendarDays,
  MapPin,
  Lightbulb,
  ChevronRight,
  Activity,
  Copy,
  Check,
  Terminal,
  FileText,
  Filter,
  UserCheck
} from "lucide-react";
import "./styles.css";

const API = "/api";

function renderInlineTokens(inlineTokens, keyPrefix = "") {
  if (!inlineTokens || !Array.isArray(inlineTokens)) return null;
  return inlineTokens.map((t, i) => {
    const key = `${keyPrefix}-${i}`;
    switch (t.type) {
      case "strong":
        return <strong key={key} className="coachStrong">{renderInlineTokens(t.tokens, `${key}-s`) || t.text}</strong>;
      case "em":
        return <em key={key} className="coachEm">{renderInlineTokens(t.tokens, `${key}-e`) || t.text}</em>;
      case "codespan":
        return <code key={key} className="coachCode">{t.text}</code>;
      case "link":
        return (
          <a key={key} href={t.href} target="_blank" rel="noopener noreferrer" className="coachLink">
            {renderInlineTokens(t.tokens, `${key}-l`) || t.text}
          </a>
        );
      case "text":
        if (t.tokens && t.tokens.length > 0) {
          return <span key={key}>{renderInlineTokens(t.tokens, `${key}-txt`)}</span>;
        }
        return <span key={key}>{t.text}</span>;
      default:
        if (t.tokens && t.tokens.length > 0) {
          return <span key={key}>{renderInlineTokens(t.tokens, `${key}-def`)}</span>;
        }
        return <span key={key}>{t.text || ""}</span>;
    }
  });
}

function MarkdownContent({ content }) {
  if (!content) return null;
  const tokens = useMemo(() => {
    try {
      return marked.lexer(String(content));
    } catch {
      return [];
    }
  }, [content]);

  return (
    <div className="coachMarkdown">
      {tokens.map((token, idx) => {
        const key = `block-${idx}`;
        switch (token.type) {
          case "heading": {
            const children = renderInlineTokens(token.tokens, `${key}-h`);
            if (token.depth === 1) return <h2 key={key} className="coachH1">{children}</h2>;
            if (token.depth === 2) return <h3 key={key} className="coachH2">{children}</h3>;
            return <h4 key={key} className="coachH3">{children}</h4>;
          }
          case "paragraph":
            return <p key={key} className="coachP">{renderInlineTokens(token.tokens, `${key}-p`)}</p>;
          case "list": {
            const ListTag = token.ordered ? "ol" : "ul";
            return (
              <ListTag key={key} className={token.ordered ? "coachOl" : "coachUl"}>
                {token.items?.map((item, itemIdx) => {
                  const itemKey = `${key}-li-${itemIdx}`;
                  return (
                    <li key={itemKey} className="coachLi">
                      {renderInlineTokens(item.tokens, itemKey) || item.text}
                    </li>
                  );
                })}
              </ListTag>
            );
          }
          case "blockquote":
            return (
              <blockquote key={key} className="coachBlockquote">
                {renderInlineTokens(token.tokens, `${key}-bq`)}
              </blockquote>
            );
          case "space":
            return null;
          default:
            return token.text ? <p key={key} className="coachP">{token.text}</p> : null;
        }
      })}
    </div>
  );
}

async function api(path, options = {}) {
  const res = await fetch(API + path, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data.stage
      ? `Assessment failed at stage [${data.stage}]: ${data.error || "Request failed"}`
      : (data.error || "Request failed");
    const err = new Error(msg);
    err.stage = data.stage;
    err.details = data.details;
    throw err;
  }
  return data;
}

const PRESET_PROFILES = [
  {
    name: "Litigation & Advocacy",
    tag: "3rd Year · Lahore",
    profile: {
      year: "3rd year",
      interests: "Constitutional litigation, civil liberties, trial advocacy, High Court practice",
      skills: "Legal research, drafting pleadings, case-briefing, statutory analysis",
      activities: "National Moot Court finalist, Legal Aid Society volunteer, High Court chamber shadowing",
      environment: "Litigation Chambers / High Court Bar",
      geography: "Lahore / Punjab",
      research: "4",
      advocacy: "5",
      negotiation: "3",
      publicSpeaking: "4"
    }
  },
  {
    name: "Corporate & Commercial M&A",
    tag: "4th Year · Karachi",
    profile: {
      year: "4th year",
      interests: "Mergers and acquisitions, corporate governance, SECP compliance, transactional contracts",
      skills: "Contract review, legal due diligence, commercial drafting, regulatory research",
      activities: "Corporate law society president, legal internship at corporate advisory boutique",
      environment: "Corporate Law Firm / In-house Legal Counsel",
      geography: "Karachi / Sindh",
      research: "4",
      advocacy: "3",
      negotiation: "4",
      publicSpeaking: "3"
    }
  },
  {
    name: "Human Rights & Public Interest",
    tag: "2nd Year · Islamabad",
    profile: {
      year: "2nd year",
      interests: "Fundamental rights enforcement, public interest litigation, minority rights, legal aid",
      skills: "Legal research, human rights advocacy, factual investigation, policy briefs",
      activities: "Pro bono legal clinic volunteer, human rights youth delegate, university law review editor",
      environment: "Public Interest NGO / Legal Aid Foundation",
      geography: "Islamabad / Rawalpindi",
      research: "4",
      advocacy: "4",
      negotiation: "3",
      publicSpeaking: "4"
    }
  },
  {
    name: "Arbitration & ADR",
    tag: "5th Year · Peshawar",
    profile: {
      year: "5th year",
      interests: "International commercial arbitration, bilateral investment treaties, mediation, ADR",
      skills: "Dispute resolution strategy, contract interpretation, cross-border legal research, negotiation",
      activities: "Vis Moot team participant, dispute resolution research paper, chamber clerkship",
      environment: "Arbitration Chambers / Dispute Resolution Practice",
      geography: "Pakistan-wide / Cross-border",
      research: "5",
      advocacy: "4",
      negotiation: "5",
      publicSpeaking: "4"
    }
  }
];

function App() {
  const [page, setPage] = useState("Career Assessment");
  const [open, setOpen] = useState(false);
  const [selectedPath, setSelectedPath] = useState(null);

  const go = (p) => {
    setPage(p);
    setOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="app">
      <aside className={open ? "side open" : "side"}>
        <div className="brand">
          <span className="mark">
            <Scale size={20} />
          </span>
          <div>
            <b>LegalPath</b>
            <small>PAKISTAN</small>
          </div>
        </div>

        <div className="navLabel">CAREER WORKSPACE</div>
        <nav>
          <button
            className={page === "Career Assessment" ? "nav active" : "nav"}
            onClick={() => go("Career Assessment")}
          >
            <Target size={17} />
            Career Assessment
          </button>
          <button
            className={page === "Career Map" ? "nav active" : "nav"}
            onClick={() => go("Career Map")}
          >
            <Map size={17} />
            Career Map
          </button>
          <button
            className={page === "Verified Opportunities" ? "nav active" : "nav"}
            onClick={() => go("Verified Opportunities")}
          >
            <Briefcase size={17} />
            Verified Opportunities
          </button>
          <button
            className={page === "Agent Telemetry" ? "nav active" : "nav"}
            onClick={() => go("Agent Telemetry")}
          >
            <Terminal size={17} />
            Agent Telemetry
          </button>
        </nav>

        <div className="sideCard">
          <Sparkles size={16} />
          <b>5-Agent Career Engine</b>
          <span>
            Database-grounded career intelligence for Pakistani law students. AI reasons over verified facts without inventing data.
          </span>
        </div>

        <div className="sideFoot">
          <span>LEGALPATH PAKISTAN · PRODUCTION</span>
          <small>Verified Pathways · Official Opportunities · Sourced Guidance</small>
        </div>
      </aside>

      <main>
        <header>
          <div className="headerLeft">
            <button className="hamb" onClick={() => setOpen(!open)} aria-label="Toggle Navigation">
              {open ? <X size={20} /> : <Menu size={20} />}
            </button>
            <div>
              <span className="eyebrow">LEGAL CAREER OPERATING SYSTEM</span>
              <h1>{page}</h1>
            </div>
          </div>
          <div className="headerStatus">
            <span className="statusDot" />
            <span>Database Grounded · 5 AI Agents Active</span>
          </div>
        </header>

        {page === "Career Assessment" && <Assessment go={go} />}
        {page === "Career Map" && <CareerMap openPath={setSelectedPath} />}
        {page === "Verified Opportunities" && <OpportunitiesView />}
        {page === "Agent Telemetry" && <TelemetryView />}
      </main>

      {selectedPath && <PathModal path={selectedPath} close={() => setSelectedPath(null)} go={go} />}
    </div>
  );
}

function Assessment({ go }) {
  const [profile, setProfile] = useState({
    year: "",
    interests: "",
    skills: "",
    activities: "",
    environment: "",
    geography: "",
    research: "3",
    advocacy: "3",
    negotiation: "3",
    publicSpeaking: "3"
  });
  const [result, setResult] = useState(null);
  const [roadmap, setRoadmap] = useState(null);
  const [buildingPath, setBuildingPath] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const roadmapRef = useRef(null);

  useEffect(() => {
    if (!roadmap) return;
    const t = setTimeout(() => roadmapRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 140);
    return () => clearTimeout(t);
  }, [roadmap]);

  const set = (k, v) => setProfile(p => ({ ...p, [k]: v }));

  const applyPreset = (preset) => {
    setProfile({ ...preset.profile });
    setError("");
  };

  const submit = async () => {
    setError("");
    setRoadmap(null);
    setResult(null);
    const required = [
      ["year", "Current year / stage"],
      ["interests", "Legal interests"],
      ["skills", "Current skills"],
      ["activities", "Activities / experience"],
      ["environment", "Preferred working environment"],
      ["geography", "Geographic preference"]
    ];
    const missing = required.filter(([k]) => !String(profile[k] || "").trim());
    if (missing.length) {
      setError("Please complete the required profile fields before running the assessment: " + missing.map(x => x[1]).join(", ") + ".");
      return;
    }

    setBusy(true);
    try {
      const r = await api("/agents/assessment", {
        method: "POST",
        body: JSON.stringify({ profile })
      });
      const normalized = {
        ...r,
        pathways: Array.isArray(r.pathways) ? r.pathways : (Array.isArray(r.assessment?.pathways) ? r.assessment.pathways : [])
      };
      setResult(normalized);
      if (!normalized.pathways.length) {
        setError("Assessment completed, but Career Intelligence returned no pathway hypotheses. Please check your inputs.");
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const build = async (pathway) => {
    setBusy(true);
    setBuildingPath(pathway);
    setError("");
    setRoadmap(null);
    try {
      const r = await api("/agents/roadmap", {
        method: "POST",
        body: JSON.stringify({ profile, pathway })
      });
      setRoadmap(r);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
      setBuildingPath("");
    }
  };

  const copyPlan = () => {
    if (!roadmap) return;
    const summary = [
      `LEGALPATH PAKISTAN — CAREER ACTION PLAN`,
      `Selected Pathway: ${roadmap.pathway}`,
      `Stage: ${roadmap.stage}`,
      `Goal: ${roadmap.experiment_goal || "Build verifiable skills."}`,
      ``,
      `Current Strengths: ${(roadmap.current_strengths || []).join(", ")}`,
      `Priority Development Skills: ${(roadmap.priority_development_skills || []).join(", ")}`,
      ``,
      `90-DAY EVIDENCE EXPERIMENT:`,
      ...(roadmap.next_90_days || []).map(a => `- ${a}`),
      ``,
      `SUCCESS INDICATORS:`,
      ...(roadmap.success_indicators || []).map(s => `[ ] ${s}`)
    ].join("\n");

    navigator.clipboard?.writeText?.(summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };

  const pipeline = [
    ["01", "Research Agent", "Source Discovery", "Scans active verified repository & official sources"],
    ["02", "Verification Agent", "Trust Layer", "Cryptographic fingerprint & authority verification"],
    ["03", "Career Intelligence Agent", "Hypothesis Mapping", "Matches evidence to database career pathways"],
    ["04", "Opportunity Matching Agent", "Relationship Filter", "Strictly filters opportunities mapped to pathway"],
    ["05", "Legal Career Coach Agent", "Action Synthesis", "Builds grounded 90-day practical experiment"]
  ];

  const agentProgress = roadmap
    ? `All 5 agents completed — Career Coach result ready for ${roadmap.pathway}.`
    : buildingPath
      ? `Opportunity Matching & Legal Career Coach are building an experiment for ${buildingPath}…`
      : result
        ? "Agents 01–03 completed — Select a pathway below and click 'Build 90-day experiment' to proceed."
        : "Five specialized agents will orchestrate your career guidance workflow.";

  const agentCount = roadmap
    ? "5 agents completed · Coach ready"
    : buildingPath
      ? "Agents 04 & 05 running…"
      : result
        ? "3 agents completed · Choose pathway"
        : "Engine Standby";

  return (
    <section className="content">
      <div className="pageIntro assessmentIntro">
        <div>
          <span className="eyebrow">STEP 01 · DISCOVER</span>
          <h2>Find the legal career paths worth exploring.</h2>
          <p>
            Tell LegalPath about your interests, experience and current capabilities. The multi-agent engine reasons over verified Pakistani legal pathways.
          </p>
        </div>
        <div className="journey">
          <span className="journeyActive">01 Discover</span>
          <span className={result ? "journeyActive" : ""}>02 Explore</span>
          <span className={roadmap ? "journeyActive" : ""}>03 Prepare</span>
        </div>
      </div>

      <div className="agentStrip">
        <div className="agentStripHead">
          <div>
            <span className="eyebrow">AI MULTI-AGENT ENGINE</span>
            <h3>Five specialised agents, one career workflow</h3>
            <div className="agentProgress" aria-live="polite">
              <Activity size={12} className={buildingPath ? "spinIcon" : ""} />
              <span>{agentProgress}</span>
            </div>
          </div>
          <span className="agentCount">
            <Activity size={14} /> {agentCount}
          </span>
        </div>

        <div className="agentPipeline">
          {pipeline.map(([n, name, role, desc], i) => {
            const isDone = (result || roadmap) && i < 3 || roadmap && i >= 3;
            const isRunning = buildingPath && i >= 3;
            return (
              <div
                className={isDone ? "pipelineAgent done" : isRunning ? "pipelineAgent active" : "pipelineAgent"}
                key={name}
              >
                <span className="pipelineNo">{n}</span>
                <div>
                  <b>{name}</b>
                  <small>{role}</small>
                  <span>{desc}</span>
                </div>
                {isDone ? (
                  <CheckCircle2 size={16} />
                ) : isRunning ? (
                  <Activity size={15} className="spinIcon" />
                ) : (
                  <Clock3 size={15} />
                )}
              </div>
            );
          })}
        </div>
        <div className="agentFoot">
          <ShieldCheck size={14} /> Source-first: the system never invents vacancies, deadlines, or official verification status.
        </div>
      </div>

      <div className="assessmentGrid">
        <div className="assessmentForm">
          <div className="presetSection">
            <div className="presetHeader">
              <UserCheck size={14} />
              <span>Sample Student Profiles (1-Click Test)</span>
            </div>
            <div className="presetButtons">
              {PRESET_PROFILES.map(pr => (
                <button
                  type="button"
                  key={pr.name}
                  className="presetBtn"
                  onClick={() => applyPreset(pr)}
                  title={`Load ${pr.name} profile`}
                >
                  <strong>{pr.name}</strong>
                  <small>{pr.tag}</small>
                </button>
              ))}
            </div>
          </div>

          <div className="formSection">
            <span>01</span>
            <div>
              <b>Academic stage</b>
              <small>Your current position in legal education.</small>
            </div>
          </div>
          <label>
            Current year / stage <em className="requiredMark">Required</em>
          </label>
          <select value={profile.year} onChange={e => set("year", e.target.value)}>
            <option value="">Select your stage</option>
            <option>1st year</option>
            <option>2nd year</option>
            <option>3rd year</option>
            <option>4th year</option>
            <option>5th year</option>
            <option>Graduate</option>
          </select>

          <div className="formSection">
            <span>02</span>
            <div>
              <b>Interests & evidence</b>
              <small>Use real interests, activities and experience—not ideal answers.</small>
            </div>
          </div>
          <label>
            Legal interests <em className="requiredMark">Required</em>
          </label>
          <textarea
            value={profile.interests}
            onChange={e => set("interests", e.target.value)}
            placeholder="Human rights, constitutional law, corporate work, criminal justice, technology..."
          />

          <label>
            Current skills <em className="requiredMark">Required</em>
          </label>
          <textarea
            value={profile.skills}
            onChange={e => set("skills", e.target.value)}
            placeholder="Legal research, drafting, advocacy, communication, negotiation..."
          />

          <label>
            Activities / experience <em className="requiredMark">Required</em>
          </label>
          <textarea
            value={profile.activities}
            onChange={e => set("activities", e.target.value)}
            placeholder="Moot court, debate, internship, research, society, volunteering..."
          />

          <label>
            Preferred working environment <em className="requiredMark">Required</em>
          </label>
          <input
            value={profile.environment}
            onChange={e => set("environment", e.target.value)}
            placeholder="Courtroom, corporate, public sector, research, NGO..."
          />

          <label>
            Geographic preference <em className="requiredMark">Required</em>
          </label>
          <input
            value={profile.geography}
            onChange={e => set("geography", e.target.value)}
            placeholder="City, province or Pakistan-wide"
          />

          <div className="formSection">
            <span>03</span>
            <div>
              <b>Capability signals</b>
              <small>Self-rate your present confidence. This is evidence, not a verdict.</small>
            </div>
          </div>
          <div className="rangeGrid">
            {[
              ["research", "Legal research"],
              ["advocacy", "Advocacy"],
              ["negotiation", "Negotiation"],
              ["publicSpeaking", "Public speaking"]
            ].map(([k, label]) => (
              <label key={k}>
                {label}
                <div className="rangeValue">
                  <input
                    type="range"
                    min="1"
                    max="5"
                    value={profile[k]}
                    onChange={e => set(k, e.target.value)}
                  />
                  <b>{profile[k]}/5</b>
                </div>
              </label>
            ))}
          </div>

          <button className="primary full" disabled={busy} onClick={submit}>
            <Target size={16} />
            {busy ? "Analyzing profile & scoring pathways…" : "Run Career Assessment (Agents 01–03)"}
          </button>
          {error && <div className="saved errorBox"><Clock3 size={16} />{error}</div>}
        </div>

        <div className="assessmentResult">
          <div className="resultHeader">
            <div>
              <span className="eyebrow">STEP 02 · EXPLORE</span>
              <h3>{result ? "Pathway Exploration Hypotheses" : "Your Career Exploration Map"}</h3>
            </div>
            {result && <span className="liveBadge"><CheckCircle2 size={13} /> Live Database Analysis</span>}
          </div>
          <p className="resultLead">
            {result
              ? "These are evidence-based exploration hypotheses from the Pakistani legal career library. Choose any pathway to build its verified 90-day experiment."
              : "Complete the assessment on the left to see the pathways your current evidence makes worth exploring."}
          </p>

          {result && (
            <div className="resultStatus">
              <CheckCircle2 size={16} />
              <div>
                <b>Step 01 complete — 3 Agents executed</b>
                <span>{result.pathways?.length || 0} pathway hypotheses surfaced. Select a pathway below and click "Build 90-day experiment".</span>
              </div>
            </div>
          )}

          {result?.pathways?.map((p, i) => {
            const isBuilding = buildingPath === p.pathway;
            const isActive = roadmap?.pathway === p.pathway;
            return (
              <button
                className={isBuilding ? "hypothesis building" : isActive ? "hypothesis active" : "hypothesis"}
                key={p.pathway}
                onClick={() => build(p.pathway)}
                disabled={busy}
                aria-busy={isBuilding}
              >
                <div className="hypothesisBody">
                  <div className="hypothesisTop">
                    <span className="rank">{String(i + 1).padStart(2, "0")}</span>
                    <b>{p.pathway}</b>
                    <span className="signalBadge">{p.matched_skills?.length || 0} skill matches</span>
                  </div>
                  <p>{p.hypothesis}</p>
                  <div className="signalGrid">
                    {p.matched_skills?.length > 0 && (
                      <div>
                        <small>MATCHED SKILLS</small>
                        <span>{p.matched_skills.join(" · ")}</span>
                      </div>
                    )}
                    {p.skill_gaps?.length > 0 && (
                      <div>
                        <small>SKILLS TO BUILD</small>
                        <span>{p.skill_gaps.join(" · ")}</span>
                      </div>
                    )}
                  </div>
                  {p.evidence?.length > 0 && (
                    <div className="evidence">
                      <Lightbulb size={13} />
                      <span>
                        <b>Evidence signals:</b> {p.evidence.slice(0, 4).map(e => typeof e === "string" ? e : (e.summary || e.label || e.value)).filter(Boolean).join(" · ")}
                      </span>
                    </div>
                  )}
                  <span className="hypothesisAction">
                    {isBuilding ? "Building experiment…" : isActive ? "Active Experiment (Click to rebuild)" : "Build 90-day experiment"} <ArrowUpRight size={13} />
                  </span>
                </div>
                <ChevronRight size={18} />
              </button>
            );
          })}

          {result?.pathways?.length > 0 && !roadmap && !buildingPath && (
            <div className="resultScrollCue">
              <Clock3 size={14} /> Select any pathway above and click "Build 90-day experiment" to open Step 03.
            </div>
          )}

          {buildingPath && (
            <div className="resultScrollCue">
              <Activity size={14} className="spinIcon" /> Opportunity Matching & Legal Career Coach are generating your experiment for {buildingPath}…
            </div>
          )}

          {!result && (
            <div className="resultEmpty">
              <Target size={26} />
              <b>Your results will appear here</b>
              <span>You'll get pathway signals, matched skills, skill gaps and a next-step 90-day experiment.</span>
            </div>
          )}

          {roadmap && (
            <div ref={roadmapRef} className="roadmapBox">
              <div className="roadmapHead">
                <div>
                  <span className="eyebrow">STEP 03 · PREPARE</span>
                  <h4><Sparkles size={16} /> Legal Career Coach Agent</h4>
                  <p>90-day experiment · {roadmap.pathway}</p>
                  <span className="coachLive"><CheckCircle2 size={12} /> Agent completed</span>
                </div>
                <div className="roadmapHeadActions">
                  <span className="stageBadge">{roadmap.stage}</span>
                  <button className="copyBtn" onClick={copyPlan} title="Copy plan summary to clipboard">
                    {copied ? <Check size={13} /> : <Copy size={13} />}
                    {copied ? "Copied" : "Copy Plan"}
                  </button>
                </div>
              </div>

              <div className="coachRole">
                <ShieldCheck size={14} />
                <span>Role: turn the selected pathway into a practical, evidence-building career experiment.</span>
              </div>

              <div className="coachSectionTitle"><Scale size={14} /> Selected Pathway</div>
              <div className="coachPathwayBanner">
                <div className="coachPathwayHead">
                  <b>{roadmap.pathway}</b>
                  {roadmap.pathway_details?.source_url && (
                    <a
                      href={roadmap.pathway_details.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="coachPathwaySourceLink"
                      title="Open verified authority source"
                    >
                      <ShieldCheck size={13} />
                      <span>Verified Authority Portal</span>
                      <ExternalLink size={12} />
                    </a>
                  )}
                </div>
                <p>{roadmap.pathway_details?.description || "Structured Pakistani legal career pathway with core skills and professional trajectories."}</p>
              </div>

              <div className="coachSectionTitle"><Lightbulb size={14} /> Why This Pathway</div>
              <div className="coachWhyCard">
                {(() => {
                  const match = result?.pathways?.find(p => p.pathway === roadmap.pathway);
                  if (match?.hypothesis) return match.hypothesis;
                  return `Your profile demonstrates interest in ${profile.interests || roadmap.pathway} at the ${profile.year || "law student"} stage. Based on verified database pathway mapping, this pathway aligns with your current evidence and presents a structured exploration direction.`;
                })()}
              </div>

              <div className="coachSkillsCols">
                <div className="coachSkillCol">
                  <div className="coachSkillColHead strengths"><CheckCircle2 size={13} /> Current Strengths</div>
                  <div className="coachSkillList">
                    {roadmap.current_strengths?.length > 0 ? (
                      roadmap.current_strengths.map(s => (
                        <div key={s} className="coachSkillItem">
                          <CheckCircle2 size={12} color="#3f624d" />
                          <div>
                            <strong>{s}</strong>
                            <br />
                            <small>Demonstrated skill from profile evidence</small>
                          </div>
                        </div>
                      ))
                    ) : (
                      <span className="fallbackSkillText">Foundational legal education skills</span>
                    )}
                  </div>
                </div>

                <div className="coachSkillCol">
                  <div className="coachSkillColHead development"><Target size={13} /> Priority Development Skills</div>
                  <div className="coachSkillList">
                    {roadmap.priority_development_skills?.length > 0 ? (
                      roadmap.priority_development_skills.map(s => (
                        <div key={s} className="coachSkillItem">
                          <Target size={12} color="#85642f" />
                          <div>
                            <strong>{s}</strong>
                            <br />
                            <small>Core skill targeted for 90-day development</small>
                          </div>
                        </div>
                      ))
                    ) : (
                      <span className="fallbackSkillText">Deepen existing core pathway capabilities</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="coachSectionTitle"><CalendarDays size={14} /> 90-Day Evidence Experiment</div>
              <div className="experimentGoal">
                <small>EXPERIMENT GOAL</small>
                <b>{roadmap.experiment_goal || "Build demonstrable evidence through a focused practical project."}</b>
              </div>
              <div className="roadSteps">
                {roadmap.next_90_days?.map((action, i) => (
                  <div className="roadStep" key={action}>
                    <span>{String(i + 1).padStart(2, "0")}</span>
                    <div>
                      <small>{i === 0 ? "DAYS 1–30" : i === 1 ? "DAYS 31–60" : "DAYS 61–90"}</small>
                      {action}
                    </div>
                  </div>
                ))}
              </div>

              {roadmap.success_indicators?.length > 0 && (
                <div className="successBox">
                  <small>SUCCESS INDICATORS</small>
                  {roadmap.success_indicators.map(ind => (
                    <span key={ind}><CheckCircle2 size={12} />{ind}</span>
                  ))}
                </div>
              )}

              <div className="coachSectionTitle"><Briefcase size={14} /> Relevant Verified Opportunities</div>
              {roadmap.matching && roadmap.matching.length > 0 ? (
                <div className="coachOppList">
                  {roadmap.matching.map(opp => (
                    <div className="coachOppCard" key={opp.id || opp.title}>
                      <div className="coachOppTop">
                        <div>
                          <h5 className="coachOppTitle">{opp.title}</h5>
                          <div className="coachOppOrg">
                            <Building2 size={13} />
                            <span>{opp.organisation || "Official Organisation"}</span>
                          </div>
                        </div>
                        <span className="coachOppType">{opp.opportunity_type || "Opportunity"}</span>
                      </div>
                      <div className="coachOppMeta">
                        <span><MapPin size={12} />{opp.location || "Pakistan"}</span>
                        {opp.deadline && <span><CalendarDays size={12} />Deadline: {opp.deadline}</span>}
                        <span className="verifiedTag"><ShieldCheck size={12} />Verified</span>
                      </div>
                      {opp.matched_skills?.length > 0 && (
                        <div className="coachOppSkills">
                          <small>MATCHED SKILLS</small>
                          {opp.matched_skills.map(sk => <span key={sk}>{sk}</span>)}
                        </div>
                      )}
                      <div className="coachOppAction">
                        {opp.source_url ? (
                          <a href={opp.source_url} target="_blank" rel="noopener noreferrer" className="outlineBtn">
                            View Official Opportunity <ExternalLink size={13} />
                          </a>
                        ) : (
                          <span className="verifiedRecordNote">
                            <ShieldCheck size={12} color="#85642f" /> Verified opportunity record in database
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="coachEmptyNotice">
                  <ShieldCheck size={16} />
                  <span>No directly matched verified opportunities are currently available for this pathway.</span>
                </div>
              )}

              <div className="coachSectionTitle"><BookOpen size={14} /> Relevant Approved Sources</div>
              {roadmap.sources && roadmap.sources.length > 0 ? (
                <div className="coachSourceList">
                  {roadmap.sources.map(src => (
                    <div className="coachSourceCard" key={src.id || src.name}>
                      <div>
                        <b>{src.name}</b>
                        <small>{src.source_type || "Official Authority"}{src.authority_tier ? ` · Tier ${src.authority_tier} Verified Source` : ""}</small>
                      </div>
                      {src.url && (
                        <a href={src.url} target="_blank" rel="noopener noreferrer" className="coachSourceLink">
                          View Source <ExternalLink size={12} />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="coachEmptyNotice">
                  <ShieldCheck size={16} />
                  <span>Verified external source records are currently being updated in the database.</span>
                </div>
              )}

              <div className="coachSectionTitle"><ShieldCheck size={14} /> Evidence Gaps</div>
              <div className="coachGapsBox">
                <ShieldCheck size={16} />
                <div>
                  <strong>Verification Notice:</strong> Verified external eligibility, examination requirements, and regulatory details for this pathway are not assumed by the AI. Always consult official regulatory notices and bar council publications for formal licensing prerequisites.
                </div>
              </div>

              {roadmap.coach?.answer && (
                <div className="aiCoachBox">
                  <small>AI CAREER COACH GROUNDED ANALYSIS · {roadmap.pathway}</small>
                  <MarkdownContent content={roadmap.coach.answer} />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function CareerMap({ openPath }) {
  const [query, setQuery] = useState("");
  const [paths, setPaths] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api("/career-pathways")
      .then(r => setPaths(r.data || []))
      .catch(() => setPaths([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = paths.filter(p =>
    (p.name + " " + (p.description || "") + " " + (p.skills || []).join(" ")).toLowerCase().includes(query.toLowerCase())
  );

  return (
    <section className="content">
      <div className="pageIntro">
        <span className="eyebrow">STEP 02 · EXPLORE</span>
        <h2>Explore the Pakistani legal career landscape.</h2>
        <p>
          Compare structured career pathways, their core skills, and typical qualification benchmarks. Select any pathway to view detailed specifications.
        </p>
      </div>

      <div className="mapTools">
        <div className="search">
          <Search size={17} />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search pathways (e.g. Corporate, Human Rights, Judiciary)..."
          />
        </div>
        <div className="toolNote">
          <ShieldCheck size={16} /> Sourced directly from Supabase career database
        </div>
      </div>

      {loading ? (
        <div className="emptyState">
          <Clock3 size={24} />
          <b>Loading career pathways…</b>
          <span>Reading active database records.</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="emptyState">
          <Search size={24} />
          <b>No pathway found</b>
          <span>Try another search term.</span>
        </div>
      ) : (
        <div className="bigGrid">
          {filtered.map((p, i) => (
            <article className="bigCard" key={p.id || p.name || i}>
              <div className="cardTop">
                <span className="num">{String(i + 1).padStart(2, "0")}</span>
                <span className="pathIcon"><Scale size={16} /></span>
              </div>
              <h3>{p.name}</h3>
              <p>{p.description || "Structured legal career pathway."}</p>
              <div className="chips">
                {(p.skills || []).slice(0, 4).map((s, sIdx) => {
                  const skillName = typeof s === "string" ? s : (s.name || s.id || `Skill-${sIdx}`);
                  return <span key={`${p.id || p.name}-${skillName}-${sIdx}`}>{skillName}</span>;
                })}
              </div>
              <div className="line" />
              <button
                className="outlineBtn"
                onClick={() => openPath({
                  ...p,
                  roles: p.roles || [],
                  skills: (p.skills || []).map(s => typeof s === "string" ? s : s.name),
                  qual: p.qualification || "Eligibility varies by role and jurisdiction.",
                  source: p.source_url || "",
                  verified: p.verification_date || ""
                })}
              >
                Inspect Pathway <ChevronRight size={15} />
              </button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function OpportunitiesView() {
  const [opps, setOpps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    api("/opportunities")
      .then(r => setOpps(r.data || []))
      .catch(() => setOpps([]))
      .finally(() => setLoading(false));
  }, []);

  const types = useMemo(() => {
    const set = new Set(opps.map(o => o.opportunity_type || o.type).filter(Boolean));
    return ["all", ...Array.from(set)];
  }, [opps]);

  const filtered = opps.filter(o => {
    const t = o.opportunity_type || o.type || "";
    const matchesType = filterType === "all" || t.toLowerCase() === filterType.toLowerCase();
    const query = (o.title + " " + (o.organisation || "") + " " + (o.location || "")).toLowerCase();
    const matchesSearch = !search || query.includes(search.toLowerCase());
    return matchesType && matchesSearch;
  });

  return (
    <section className="content">
      <div className="pageIntro">
        <span className="eyebrow">VERIFIED OPPORTUNITIES</span>
        <h2>Active Legal Opportunities in Pakistan</h2>
        <p>
          Verified moots, internships, and fellowships vetted against official organizational portals. No fake or unverified vacancies.
        </p>
      </div>

      <div className="mapTools">
        <div className="search">
          <Search size={17} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by title, organisation or city..."
          />
        </div>
        <div className="typeFilters">
          {types.map(t => (
            <button
              key={t}
              className={filterType === t ? "filterBtn active" : "filterBtn"}
              onClick={() => setFilterType(t)}
            >
              {t === "all" ? "All Types" : t}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="emptyState">
          <Clock3 size={24} />
          <b>Loading verified opportunities…</b>
        </div>
      ) : filtered.length === 0 ? (
        <div className="emptyState">
          <Briefcase size={24} />
          <b>No opportunities found</b>
          <span>Try adjusting your filter or search query.</span>
        </div>
      ) : (
        <div className="bigGrid">
          {filtered.map((opp, idx) => (
            <div className="coachOppCard" key={opp.id || `${opp.title}-${idx}`}>
              <div className="coachOppTop">
                <div>
                  <h5 className="coachOppTitle">{opp.title}</h5>
                  <div className="coachOppOrg">
                    <Building2 size={13} />
                    <span>{opp.organisation || "Official Organisation"}</span>
                  </div>
                </div>
                <span className="coachOppType">{opp.opportunity_type || opp.type || "Opportunity"}</span>
              </div>
              <div className="coachOppMeta">
                <span><MapPin size={12} />{opp.location || "Pakistan"}</span>
                {opp.deadline && <span><CalendarDays size={12} />Deadline: {opp.deadline}</span>}
                <span className="verifiedTag"><ShieldCheck size={12} />Verified Active</span>
              </div>
              {opp.pathways?.length > 0 && (
                <div className="oppPathwaysRow">
                  <small>MAPPED PATHWAYS</small>
                  <span>{opp.pathways.join(" · ")}</span>
                </div>
              )}
              {opp.skills?.length > 0 && (
                <div className="coachOppSkills">
                  <small>SKILLS</small>
                  {opp.skills.map((sk, sIdx) => <span key={`${sk}-${sIdx}`}>{sk}</span>)}
                </div>
              )}
              <div className="coachOppAction">
                {opp.source_url ? (
                  <a href={opp.source_url} target="_blank" rel="noopener noreferrer" className="outlineBtn">
                    View Official Opportunity <ExternalLink size={13} />
                  </a>
                ) : (
                  <span className="verifiedRecordNote">
                    <ShieldCheck size={12} color="#85642f" /> Verified record in database
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function TelemetryView() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = () => {
    setLoading(true);
    api("/agents/activity")
      .then(r => setLogs(r.data || []))
      .catch(() => setLogs([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  return (
    <section className="content">
      <div className="pageIntro">
        <span className="eyebrow">AGENT TELEMETRY & AUDIT</span>
        <h2>Agent Execution Log & Grounding Proofs</h2>
        <p>
          Inspect the real-time execution chain of all five legal agents, tracking timestamps, verification status, and database grounding.
        </p>
      </div>

      <div className="telemetryToolbar">
        <button className="primary" onClick={fetchLogs}>
          <Activity size={14} /> Refresh Logs
        </button>
        <span className="telemetryBadge">
          <ShieldCheck size={14} /> Database Grounding: Enforced
        </span>
      </div>

      {loading ? (
        <div className="emptyState">
          <Clock3 size={24} />
          <b>Reading agent execution audit trail…</b>
        </div>
      ) : logs.length === 0 ? (
        <div className="emptyState">
          <Terminal size={24} />
          <b>No agent runs recorded in current session</b>
          <span>Run a Career Assessment to see real-time agent execution logs.</span>
        </div>
      ) : (
        <div className="logConsole">
          <div className="logConsoleHead">
            <Terminal size={14} />
            <span>EXECUTION TELEMETRY STREAM ({logs.length} operations)</span>
          </div>
          <div className="logStream">
            {logs.map((entry, idx) => (
              <div className="logEntry" key={entry.id || idx}>
                <span className="logTime">{new Date(entry.timestamp).toLocaleTimeString()}</span>
                <span className="logAgent">{entry.agent}</span>
                <span className={entry.status === "completed" ? "logStatus done" : "logStatus active"}>
                  {entry.status}
                </span>
                <span className="logMeta">
                  {Object.entries(entry)
                    .filter(([k]) => !["id", "agent", "status", "timestamp"].includes(k))
                    .map(([k, v]) => `${k}=${typeof v === "object" ? JSON.stringify(v) : v}`)
                    .join("  ")}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function PathModal({ path, close, go }) {
  return (
    <div className="modalBack" onClick={close}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <button className="close" onClick={close} aria-label="Close modal">
          <X size={18} />
        </button>
        <span className="eyebrow">PATHWAY SPECIFICATION</span>
        <h2>{path.name}</h2>
        <p>{path.description || path.desc}</p>

        {path.roles?.length > 0 && (
          <div className="modalSection">
            <b>Typical role directions</b>
            <div className="roleList">
              {path.roles.map(r => (
                <span key={r}>
                  <Briefcase size={14} />
                  {r}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="modalSection">
          <b>Core competencies</b>
          <div className="chips">
            {(path.skills || []).map((s, sIdx) => {
              const skillName = typeof s === "string" ? s : (s.name || s.id || `Skill-${sIdx}`);
              return <span key={`${path.name}-${skillName}-${sIdx}`}>{skillName}</span>;
            })}
          </div>
        </div>

        <div className="modalSection">
          <b>Typical qualification benchmark</b>
          <p className="modalMeta">{path.qual || "Eligibility varies by role and jurisdiction."}</p>
        </div>

        {path.source && (
          <a
            href={path.source}
            target="_blank"
            rel="noopener noreferrer"
            className="sourceRow sourceRowLink"
            title={`Open official verified source: ${path.source}`}
          >
            <ShieldCheck size={16} />
            <div>
              <b>Verified pathway source</b>
              <span className="sourceUrl">{path.source}</span>
              {path.verified && <small>Last verified {path.verified} · Click to open official portal</small>}
            </div>
            <ExternalLink size={15} />
          </a>
        )}

        <div className="notice">
          <ShieldCheck size={16} />
          <span>Use official regulatory and bar council gazettes to confirm licensing and exam prerequisites.</span>
        </div>

        <button
          className="primary"
          onClick={() => {
            close();
            go("Career Assessment");
          }}
        >
          Use in Career Assessment <ArrowUpRight size={16} />
        </button>
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
