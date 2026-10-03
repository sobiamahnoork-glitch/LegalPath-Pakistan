import React,{useEffect,useMemo,useState}from"react";
import{createRoot}from"react-dom/client";
import{LayoutDashboard,Map,Briefcase,MessageSquare,Activity,ChevronRight,Scale,Sparkles,Search,CheckCircle2,Clock3,ArrowUpRight,Menu,X,Target,BookOpen,ShieldCheck,Users,TrendingUp,ExternalLink,Filter,Send,UserRound,GraduationCap,Building2,CalendarDays,MapPin,Lightbulb,ChevronDown}from"lucide-react";
import"./styles.css";

const paths=[
{name:"Litigation & Advocacy",desc:"Courtroom and dispute work involving pleadings, evidence, hearings, appeals and client representation before Pakistani courts.",roles:["Advocate","Junior Associate","Legal Researcher","Law Clerk"],skills:["Legal Research","Pleading Drafting","Advocacy","Evidence Law"],qual:"LLB/BA-LLB; enrolment and bar requirements apply to practising advocates"},
{name:"Judiciary & Judicial Services",desc:"A court-focused route covering judicial research, legal reasoning, judgment writing and the institutional work of the Pakistani judiciary.",roles:["Law Clerk","Judicial Researcher","Civil Judge-cum-Magistrate","Judicial Officer"],skills:["Legal Research","Statutory Interpretation","Judgment Writing","Constitutional Law"],qual:"LLB/BA-LLB; judicial-service eligibility varies by jurisdiction"},
{name:"Corporate & Commercial Law",desc:"Advising companies and businesses on contracts, incorporation, governance, transactions, disputes and regulatory compliance.",roles:["Corporate Associate","In-house Counsel","Company Secretary","Transaction Lawyer"],skills:["Contract Drafting","Commercial Law","Negotiation","Legal Opinion Writing"],qual:"LLB/BA-LLB; corporate-law specialisation is useful"},
{name:"Government, Legislative & Regulatory Practice",desc:"Working with Parliament, ministries, regulators and public bodies on legislation, policy, regulation, legal opinions and administration.",roles:["Legislative Researcher","Legal Officer","Policy Associate","Regulatory Counsel"],skills:["Legal Research","Legislative Drafting","Policy Analysis","Constitutional Law"],qual:"LLB/BA-LLB; public-sector posts may impose additional criteria"},
{name:"Human Rights & Public Interest Law",desc:"Using law, research and advocacy to address constitutional rights, access to justice, discrimination and protection of vulnerable groups.",roles:["Human Rights Lawyer","Legal Aid Lawyer","Policy Advocate","Programme Officer"],skills:["Human Rights Law","Legal Research","Advocacy","Policy Analysis"],qual:"LLB/BA-LLB; research and advocacy experience is valuable"},
{name:"International Law & International Organisations",desc:"Applying public international law, human-rights law, humanitarian law and international institutional rules.",roles:["International Law Researcher","Legal Officer","Human Rights Officer","Policy Researcher"],skills:["International Law","Human Rights Law","Legal Research","Legal Writing"],qual:"LLB/BA-LLB; strong legal writing and English are important"},
{name:"Alternative Dispute Resolution & Arbitration",desc:"Resolving commercial and civil disputes through arbitration, mediation and related mechanisms.",roles:["Arbitration Associate","Legal Counsel","Mediator","Dispute Resolution Specialist"],skills:["Arbitration","Mediation","Negotiation","Contract Interpretation"],qual:"LLB/BA-LLB; arbitration training or experience is useful"},
{name:"Criminal Justice, Prosecution & Legal Investigation",desc:"Working across criminal litigation, prosecution, investigation, evidence and criminal-justice policy.",roles:["Criminal Lawyer","Prosecutor","Legal Investigator","Criminal Justice Researcher"],skills:["Criminal Law","Criminal Procedure","Evidence Law","Legal Research"],qual:"LLB/BA-LLB; public-sector posts have separate eligibility rules"},
{name:"Tax, Banking, Finance & Compliance",desc:"Advising financial institutions and businesses on taxation, banking regulation, securities, anti-money laundering, compliance and financial transactions.",roles:["Tax Lawyer","Banking Counsel","Compliance Officer","Financial Regulatory Lawyer"],skills:["Tax Law","Banking Law","Financial Regulation","Compliance"],qual:"LLB/BA-LLB; tax/finance specialisation is useful"},
{name:"Legal Academia, Research & Legal Technology",desc:"A research-oriented route combining teaching, legal scholarship, policy research, legal information systems and technology.",roles:["Research Assistant","Lecturer","Legal-Tech Analyst","Policy Researcher"],skills:["Legal Research","Legal Writing","Critical Thinking","Legal Technology"],qual:"LLB/BA-LLB; postgraduate study may be required for many academic roles"}]

const opps=[];

const API="/api";

async function api(path,options={}){const res=await fetch(API+path,{headers:{"Content-Type":"application/json",...(options.headers||{})},...options});const data=await res.json().catch(()=>({}));if(!res.ok)throw new Error(data.error||"Request failed");return data}

const agents=[
["Research Agent","Collects candidate records from approved sources","Source discovery"],
["Verification Agent","Checks source, deadline, eligibility and freshness","Trust layer"],
["Career Intelligence Agent","Maps profiles to pathways and skill gaps","Career mapping"],
["Opportunity Matching Agent","Matches verified opportunities to student profiles","Personalisation"],
["Career Coach Agent","Creates grounded roadmaps and weekly actions","Action planning"]];

function App(){
 const[page,setPage]=useState("Career Assessment"),[open,setOpen]=useState(false),[selectedPath,setSelectedPath]=useState(null);
 const go=p=>{setPage(p);setOpen(false);window.scrollTo({top:0,behavior:"smooth"})};
 return <div className="app">
  <aside className={open?"side open":"side"}>
   <div className="brand"><span className="mark"><Scale size={20}/></span><div><b>LegalPath</b><small>PAKISTAN</small></div></div>
   <div className="navLabel">CAREER WORKSPACE</div>
   <nav>
    <button className={page==="Career Assessment"?"nav active":"nav"} onClick={()=>go("Career Assessment")}><Target size={18}/>Career Assessment</button>
    <button className={page==="Career Map"?"nav active":"nav"} onClick={()=>go("Career Map")}><Map size={18}/>Career Map</button>
   </nav>
   <div className="sideCard"><Sparkles size={16}/><b>Legal Career Intelligence</b><span>Discover pathways, identify skill gaps and turn evidence into your next career experiment.</span></div>
   <div className="sideFoot"><span>LEGALPATH PAKISTAN</span><small>Career operating system for Pakistani law students</small></div>
  </aside>
  <main>
   <header><div className="headerLeft"><button className="hamb" onClick={()=>setOpen(!open)}>{open?<X/>:<Menu/>}</button><div><span className="eyebrow">LEGAL CAREER INTELLIGENCE</span><h1>{page}</h1></div></div><div className="headerStatus"><span className="statusDot"/>AI system online</div></header>
   {page==="Career Assessment"&&<Assessment go={go}/>}
   {page==="Career Map"&&<CareerMap openPath={setSelectedPath}/>}
  </main>
  {selectedPath&&<PathModal path={selectedPath} close={()=>setSelectedPath(null)} go={go}/>}
 </div>
}

function Assessment({go}){
 const[profile,setProfile]=useState({year:"",interests:"",skills:"",activities:"",environment:"",geography:"",research:"3",advocacy:"3",negotiation:"3",publicSpeaking:"3"});
 const[result,setResult]=useState(null),[roadmap,setRoadmap]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const set=(k,v)=>setProfile(p=>({...p,[k]:v}));
 const submit=async()=>{setError("");setRoadmap(null);setResult(null);const required=[["year","Current year / stage"],["interests","Legal interests"],["skills","Current skills"],["activities","Activities / experience"],["environment","Preferred working environment"],["geography","Geographic preference"]];const missing=required.filter(([k])=>!String(profile[k]||"").trim());if(missing.length){setError("Please complete the required profile fields before running the assessment: "+missing.map(x=>x[1]).join(", ")+".");return}setBusy(true);try{const r=await api("/agents/assessment",{method:"POST",body:JSON.stringify({profile})});setResult(r);if(!r.pathways?.length)setError("Assessment completed, but no pathway results were returned.")}catch(e){setError(e.message)}finally{setBusy(false)}};
 const build=async(pathway)=>{setBusy(true);setError("");try{const r=await api("/agents/roadmap",{method:"POST",body:JSON.stringify({profile,pathway})});setRoadmap(r)}catch(e){setError(e.message)}finally{setBusy(false)}};
 const pipeline=[["01","Research Agent","Source discovery","Reads approved opportunity records when available"],["02","Verification Agent","Trust layer","Checks source, deadline and record validity"],["03","Career Intelligence Agent","Career mapping","Maps your evidence to pathways and skill gaps"],["04","Opportunity Matching Agent","Personalisation","Matches your profile against verified opportunities"],["05","Legal Career Coach Agent","Action planning","Builds a grounded 90-day experiment for your selected pathway"]];
 return <section className="content">
  <div className="pageIntro assessmentIntro"><div><span className="eyebrow">STEP 01 · DISCOVER</span><h2>Find the legal career paths worth exploring.</h2><p>Tell LegalPath about your interests, experience and current capabilities. The system compares your evidence with structured Pakistani legal career pathways.</p></div><div className="journey"><span className="journeyActive">Discover</span><span>Choose</span><span>Prepare</span></div></div>
  <div className="agentStrip"><div className="agentStripHead"><div><span className="eyebrow">AI CAREER ENGINE</span><h3>Five specialised agents, one career workflow</h3></div><span className="agentCount"><Activity size={14}/> {result?"4 agents completed":"Ready to analyse"}</span></div><div className="agentPipeline">{pipeline.map(([n,name,role,desc],i)=><div className={result&&i<4?"pipelineAgent done":"pipelineAgent"} key={name}><span className="pipelineNo">{n}</span><div><b>{name}</b><small>{role}</small><span>{desc}</span></div>{result&&i<4?<CheckCircle2 size={16}/>:<Clock3 size={15}/>}</div>)}</div><div className="agentFoot"><ShieldCheck size={14}/> Source-first: the system never invents vacancies, deadlines or verification status.</div></div>
  <div className="assessmentGrid">
   <div className="assessmentForm">
    <div className="formSection"><span>01</span><div><b>Academic stage</b><small>Your current position in legal education.</small></div></div>
    <label>Current year / stage</label><select value={profile.year} onChange={e=>set("year",e.target.value)}><option value="">Select your stage</option><option>1st year</option><option>2nd year</option><option>3rd year</option><option>4th year</option><option>5th year</option><option>Graduate</option></select>
    <div className="formSection"><span>02</span><div><b>Interests & evidence</b><small>Use real interests, activities and experience—not ideal answers.</small></div></div>
    <label>Legal interests</label><textarea value={profile.interests} onChange={e=>set("interests",e.target.value)} placeholder="Human rights, constitutional law, corporate work, criminal justice, technology..."/>
    <label>Current skills</label><textarea value={profile.skills} onChange={e=>set("skills",e.target.value)} placeholder="Legal research, drafting, advocacy, communication, negotiation..."/>
    <label>Activities / experience</label><textarea value={profile.activities} onChange={e=>set("activities",e.target.value)} placeholder="Moot court, debate, internship, research, society, volunteering..."/>
    <label>Preferred working environment</label><input value={profile.environment} onChange={e=>set("environment",e.target.value)} placeholder="Courtroom, corporate, public sector, research, NGO..."/>
    <label>Geographic preference</label><input value={profile.geography} onChange={e=>set("geography",e.target.value)} placeholder="City, province or Pakistan-wide"/>
    <div className="formSection"><span>03</span><div><b>Capability signals</b><small>Self-rate your present confidence. This is evidence, not a verdict.</small></div></div>
    <div className="rangeGrid">{[["research","Legal research"],["advocacy","Advocacy"],["negotiation","Negotiation"],["publicSpeaking","Public speaking"]].map(([k,label])=><label key={k}>{label}<div className="rangeValue"><input type="range" min="1" max="5" value={profile[k]} onChange={e=>set(k,e.target.value)}/><b>{profile[k]}/5</b></div></label>)}</div>
    <button className="primary full" disabled={busy} onClick={submit}><Target size={16}/>{busy?"Analysing your profile…":"Run career assessment"}</button>
    {error&&<div className="saved errorBox"><Clock3 size={16}/>{error}</div>}
   </div>
   <div className="assessmentResult">
    <div className="resultHeader"><div><span className="eyebrow">STEP 02 · EXPLORE</span><h3>{result?"Your pathway signals":"Your career exploration map"}</h3></div>{result&&<span className="liveBadge"><CheckCircle2 size={13}/> Live analysis</span>}</div>
    <p className="resultLead">{result?"These are exploration hypotheses based on the evidence you provided. They can change as your skills and experience develop.":"Complete the assessment to see the pathways your current evidence makes worth exploring."}</p>
    {result&&<div className="resultStatus"><CheckCircle2 size={16}/><div><b>Career Intelligence complete</b><span>{result.pathways?.length||0} pathways surfaced from your profile.</span></div></div>}
    {result?.pathways?.map((p,i)=><button className="hypothesis" key={p.pathway} onClick={()=>build(p.pathway)}>
      <div className="hypothesisBody">
       <div className="hypothesisTop"><span className="rank">{String(i+1).padStart(2,"0")}</span><b>{p.pathway}</b><span className="signalBadge">{p.matched_skills?.length||0} skill matches</span></div>
       <p>{p.hypothesis}</p>
       <div className="signalGrid">
        {p.matched_skills?.length>0&&<div><small>MATCHED SKILLS</small><span>{p.matched_skills.join(" · ")}</span></div>}
        {p.skill_gaps?.length>0&&<div><small>SKILLS TO BUILD</small><span>{p.skill_gaps.join(" · ")}</span></div>}
       </div>
       {p.evidence?.length>0&&<div className="evidence"><Lightbulb size={13}/><span><b>Why it appeared:</b> {p.evidence.slice(0,5).map(e=>typeof e==="string"?e:(e.value||e.type||"signal")).join(" · ")}</span></div>}
      </div><ChevronRight size={18}/>
    </button>)}
    {result?.pathways?.length>0&&!roadmap&&<div className="resultScrollCue"><ChevronDown size={14}/> Select a pathway above to open the Legal Career Coach 90-day experiment.</div>}{!result&&<div className="resultEmpty"><Target size={24}/><b>Your results will appear here</b><span>You'll get pathway signals, matched skills, skill gaps and a next-step experiment.</span></div>}
    {roadmap&&<div className="roadmapBox"><div className="roadmapHead"><div><span className="eyebrow">STEP 03 · PREPARE</span><h4><Sparkles size={15}/> Legal Career Coach Agent</h4><p>90-day experiment · {roadmap.pathway}</p></div><span>{roadmap.stage}</span></div><div className="coachRole"><ShieldCheck size={14}/><span>Role: turn the selected pathway into a practical, evidence-building career experiment.</span></div>{roadmap.skill_gaps?.length>0&&<p><b>Priority skill gaps</b><br/>{roadmap.skill_gaps.join(" · ")}</p>}<div className="roadSteps">{roadmap.next_90_days.map((x,i)=><div className="roadStep" key={x}><span>{String(i+1).padStart(2,"0")}</span><div><small>90-DAY ACTION</small>{x}</div></div>)}</div></div>}
   </div>
  </div>
 </section>
}

function CareerMap({openPath}){
 const[query,setQuery]=useState(""),[paths,setPaths]=useState([]),[loading,setLoading]=useState(true);
 useEffect(()=>{api("/career-pathways").then(r=>setPaths(r.data||[])).catch(()=>setPaths([])).finally(()=>setLoading(false))},[]);
 const filtered=paths.filter(p=>(p.name+" "+(p.description||"")+" "+(p.skills||[]).join(" ")).toLowerCase().includes(query.toLowerCase()));
 return <section className="content"><div className="pageIntro"><span className="eyebrow">STEP 02 · EXPLORE</span><h2>Explore the legal career landscape.</h2><p>Compare structured career pathways, their core skills and typical role directions. Select a pathway to inspect it before returning to your assessment.</p></div><div className="mapTools"><div className="search"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search career pathways..."/></div><div className="toolNote"><ShieldCheck size={16}/> Structured from the LegalPath career database</div></div>{loading?<div className="emptyState"><Clock3 size={22}/><b>Loading career pathways…</b><span>Reading the active pathway library.</span></div>:filtered.length===0?<div className="emptyState"><Search size={22}/><b>No pathway found</b><span>Try another search term.</span></div>:<div className="bigGrid">{filtered.map((p,i)=><article className="bigCard" key={p.id||p.name}><div className="cardTop"><span className="num">{String(i+1).padStart(2,"0")}</span><span className="pathIcon"><Scale size={16}/></span></div><h3>{p.name}</h3><p>{p.description||"Structured legal career pathway."}</p><div className="chips">{(p.skills||[]).slice(0,4).map(s=><span key={s.id||s.name}>{s.name||s}</span>)}</div><div className="line"/><button className="outlineBtn" onClick={()=>openPath({...p,roles:p.roles||[],skills:(p.skills||[]).map(s=>s.name||s),qual:p.qual||"Eligibility varies by role and jurisdiction."})}>Explore pathway <ChevronRight size={15}/></button></article>)}</div>}</section>
}

function PathModal({path,close,go}){return <div className="modalBack" onClick={close}><div className="modal" onClick={e=>e.stopPropagation()}><button className="close" onClick={close}><X/></button><span className="eyebrow">PATHWAY PROFILE</span><h2>{path.name}</h2><p>{path.description||path.desc}</p>{path.roles?.length>0&&<div className="modalSection"><b>Typical role directions</b><div className="roleList">{path.roles.map(r=><span key={r}><Briefcase size={14}/>{r}</span>)}</div></div>}<div className="modalSection"><b>Core skills</b><div className="chips">{(path.skills||[]).map(s=><span key={s}>{s}</span>)}</div></div><div className="notice"><ShieldCheck size={16}/><span>Use the relevant official source to confirm current eligibility requirements for any specific role or public-sector route.</span></div><button className="primary" onClick={()=>{close();go("Career Assessment")}}>Use in my assessment <ArrowUpRight size={16}/></button></div></div>}

createRoot(document.getElementById("root")).render(<App/>);