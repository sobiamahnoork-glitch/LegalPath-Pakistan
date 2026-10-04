import React,{useEffect,useMemo,useRef,useState}from"react";
import{createRoot}from"react-dom/client";
import{LayoutDashboard,Map,Briefcase,MessageSquare,Activity,ChevronRight,Scale,Sparkles,Search,CheckCircle2,Clock3,ArrowUpRight,Menu,X,Target,BookOpen,ShieldCheck,Users,TrendingUp,ExternalLink,Filter,Send,UserRound,GraduationCap,Building2,CalendarDays,MapPin,Lightbulb,ChevronDown}from"lucide-react";
import"./styles.css";

const API="/api";

async function api(path,options={}){const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),20000);try{const res=await fetch(API+path,{headers:{"Content-Type":"application/json",...(options.headers||{})},...options,signal:controller.signal});const data=await res.json().catch(()=>({}));if(!res.ok)throw new Error(data.error||`Request failed (${res.status})`);return data}catch(error){if(error.name==="AbortError")throw new Error("The request took too long. Please try again.");throw error?.message?error:new Error("Unable to reach the LegalPath server. Please retry.");}finally{clearTimeout(timeout)}}

function safeExternalUrl(value){
 const raw=String(value||"").trim();
 try{
  const url=new URL(raw);
  return url.protocol==="http:"||url.protocol==="https:"?url.toString():"";
 }catch{return ""}
}

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
 const[result,setResult]=useState(null),[roadmap,setRoadmap]=useState(null),[buildingPath,setBuildingPath]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const roadmapRef=useRef(null);
 useEffect(()=>{if(!roadmap)return;const t=setTimeout(()=>roadmapRef.current?.scrollIntoView({behavior:"smooth",block:"start"}),120);return()=>clearTimeout(t)},[roadmap]);
 const set=(k,v)=>setProfile(p=>({...p,[k]:v}));
 const submit=async()=>{setError("");setRoadmap(null);setResult(null);const required=[["year","Current year / stage"],["interests","Legal interests"],["skills","Current skills"],["activities","Activities / experience"],["environment","Preferred working environment"],["geography","Geographic preference"]];const missing=required.filter(([k])=>!String(profile[k]||"").trim());if(missing.length){setError("Please complete the required profile fields before running the assessment: "+missing.map(x=>x[1]).join(", ")+".");return}setBusy(true);try{const r=await api("/agents/assessment",{method:"POST",body:JSON.stringify({profile})});const normalized={...r,pathways:Array.isArray(r.pathways)?r.pathways:(Array.isArray(r.assessment?.pathways)?r.assessment.pathways:[])};setResult(normalized);if(!normalized.pathways.length){setError("Assessment completed, but no pathway hypotheses were returned. Please try the assessment again.");return}if(normalized.roadmap){setRoadmap(normalized.roadmap)}else{const firstPathway=normalized.pathways[0]?.pathway;if(firstPathway){try{const coach=await api("/agents/roadmap",{method:"POST",body:JSON.stringify({profile,pathway:firstPathway})});setRoadmap(coach)}catch(coachError){setError("Assessment completed, but the Career Coach could not prepare the first experiment yet: "+coachError.message)}}}}catch(e){setError(e.message)}finally{setBusy(false)}};
 const build=async(pathway)=>{setBusy(true);setBuildingPath(pathway);setError("");setRoadmap(null);try{const r=await api("/agents/roadmap",{method:"POST",body:JSON.stringify({profile,pathway})});setRoadmap(r)}catch(e){setError(e.message)}finally{setBusy(false);setBuildingPath("")}};
 const pipeline=[["01","Research Agent","Source discovery","Reads approved opportunity records when available"],["02","Verification Agent","Trust layer","Checks source, deadline and record validity"],["03","Career Intelligence Agent","Career mapping","Maps your evidence to pathways and skill gaps"],["04","Opportunity Matching Agent","Personalisation","Matches your profile against verified opportunities"],["05","Legal Career Coach Agent","Action planning","Builds a grounded 90-day experiment for your selected pathway"]];
 const agentProgress=result?roadmap?"All 5 agents completed — Career Coach result ready.":"Agents 01–04 completed — Legal Career Coach is preparing your result…":"Five agents will run in sequence when you start the assessment.";
 return <section className="content">
  <div className="pageIntro assessmentIntro"><div><span className="eyebrow">STEP 01 · DISCOVER</span><h2>Find the legal career paths worth exploring.</h2><p>Tell LegalPath about your interests, experience and current capabilities. The system compares your evidence with structured Pakistani legal career pathways.</p></div><div className="journey"><span className="journeyActive">Discover</span><span>Choose</span><span>Prepare</span></div></div>
  <div className="agentStrip"><div className="agentStripHead"><div><span className="eyebrow">AI CAREER ENGINE</span><h3>Five specialised agents, one career workflow</h3><div className="agentProgress" aria-live="polite"><Activity size={12}/><span>{agentProgress}</span></div></div><span className="agentCount"><Activity size={14}/> {roadmap?"5 agents completed":result?"4 agents completed · Coach preparing":"Ready to analyse"}</span></div><div className="agentPipeline">{pipeline.map(([n,name,role,desc],i)=><div className={result&&i<4||roadmap&&i===4?"pipelineAgent done":"pipelineAgent"} key={name}><span className="pipelineNo">{n}</span><div><b>{name}</b><small>{role}</small><span>{desc}</span></div>{result&&i<4||roadmap&&i===4?<CheckCircle2 size={16}/>:<Clock3 size={15}/>}</div>)}</div><div className="agentFoot"><ShieldCheck size={14}/> Source-first: the system never invents vacancies, deadlines or verification status.</div></div>
  <div className="assessmentGrid">
   <div className="assessmentForm">
    <div className="formSection"><span>01</span><div><b>Academic stage</b><small>Your current position in legal education.</small></div></div>
    <label>Current year / stage <em className="requiredMark">Required</em></label><select value={profile.year} onChange={e=>set("year",e.target.value)}><option value="">Select your stage</option><option>1st year</option><option>2nd year</option><option>3rd year</option><option>4th year</option><option>5th year</option><option>Graduate</option></select>
    <div className="formSection"><span>02</span><div><b>Interests & evidence</b><small>Use real interests, activities and experience—not ideal answers.</small></div></div>
    <label>Legal interests <em className="requiredMark">Required</em></label><textarea value={profile.interests} onChange={e=>set("interests",e.target.value)} placeholder="Human rights, constitutional law, corporate work, criminal justice, technology..."/>
    <label>Current skills <em className="requiredMark">Required</em></label><textarea value={profile.skills} onChange={e=>set("skills",e.target.value)} placeholder="Legal research, drafting, advocacy, communication, negotiation..."/>
    <label>Activities / experience <em className="requiredMark">Required</em></label><textarea value={profile.activities} onChange={e=>set("activities",e.target.value)} placeholder="Moot court, debate, internship, research, society, volunteering..."/>
    <label>Preferred working environment <em className="requiredMark">Required</em></label><input value={profile.environment} onChange={e=>set("environment",e.target.value)} placeholder="Courtroom, corporate, public sector, research, NGO..."/>
    <label>Geographic preference <em className="requiredMark">Required</em></label><input value={profile.geography} onChange={e=>set("geography",e.target.value)} placeholder="City, province or Pakistan-wide"/>
    <div className="formSection"><span>03</span><div><b>Capability signals</b><small>Self-rate your present confidence. This is evidence, not a verdict.</small></div></div>
    <div className="rangeGrid">{[["research","Legal research"],["advocacy","Advocacy"],["negotiation","Negotiation"],["publicSpeaking","Public speaking"]].map(([k,label])=><label key={k}>{label}<div className="rangeValue"><input type="range" min="1" max="5" value={profile[k]} onChange={e=>set(k,e.target.value)}/><b>{profile[k]}/5</b></div></label>)}</div>
    <button className="primary full" disabled={busy} onClick={submit}><Target size={16}/>{busy?"Analysing your profile…":"Run career assessment"}</button>
    {error&&<div className="saved errorBox"><Clock3 size={16}/>{error}</div>}
   </div>
   <div className="assessmentResult">
    <div className="resultHeader"><div><span className="eyebrow">STEP 02 · EXPLORE</span><h3>{result?"Your pathway signals":"Your career exploration map"}</h3></div>{result&&<span className="liveBadge"><CheckCircle2 size={13}/> Live analysis</span>}</div>
    <p className="resultLead">{result?"These are exploration hypotheses based on the evidence you provided. They can change as your skills and experience develop.":"Complete the assessment to see the pathways your current evidence makes worth exploring."}</p>
    {result&&<div className="resultStatus"><CheckCircle2 size={16}/><div><b>5-agent assessment complete</b><span>{result.pathways?.length||0} pathways surfaced; select any pathway to build its own experiment.</span></div></div>}
    {result?.pathways?.map((p,i)=><button className={buildingPath===p.pathway?"hypothesis building":"hypothesis"} key={p.pathway} onClick={()=>build(p.pathway)} disabled={busy} aria-busy={buildingPath===p.pathway}>
      <div className="hypothesisBody">
       <div className="hypothesisTop"><span className="rank">{String(i+1).padStart(2,"0")}</span><b>{p.pathway}</b><span className="signalBadge">{p.matched_skills?.length||0} skill matches</span></div>
       <p>{p.hypothesis}</p>
       <div className="signalGrid">
        {p.matched_skills?.length>0&&<div><small>MATCHED SKILLS</small><span>{p.matched_skills.join(" · ")}</span></div>}
        {p.skill_gaps?.length>0&&<div><small>SKILLS TO BUILD</small><span>{p.skill_gaps.join(" · ")}</span></div>}
       </div>
       {p.evidence?.length>0&&<div className="evidence"><Lightbulb size={13}/><span><b>Why it appeared:</b> {p.evidence.slice(0,5).map(e=>typeof e==="string"?e:(e.value||e.type||"signal")).join(" · ")}</span></div>}<span className="hypothesisAction">{buildingPath===p.pathway?"Building experiment…":"Build 90-day experiment"} <ArrowUpRight size={13}/></span>
      </div><ChevronRight size={18}/>
    </button>)}
    {result?.pathways?.length>0&&!roadmap&&!buildingPath&&<div className="resultScrollCue"><Clock3 size={14}/> Your strongest pathway experiment is ready to build below. You can also choose any other pathway above.</div>}{buildingPath&&<div className="resultScrollCue"><Clock3 size={14}/> Career Coach is building a new 90-day experiment for {buildingPath}…</div>}{!result&&<div className="resultEmpty"><Target size={24}/><b>Your results will appear here</b><span>You'll get pathway signals, matched skills, skill gaps and a next-step experiment.</span></div>}
    {roadmap&&<div ref={roadmapRef} className="roadmapBox"><div className="roadmapHead"><div><span className="eyebrow">STEP 03 · PREPARE</span><h4><Sparkles size={15}/> Legal Career Coach Agent</h4><p>90-day experiment · {roadmap.pathway}</p><span className="coachLive"><CheckCircle2 size={12}/> Agent completed</span></div><span>{roadmap.stage}</span></div><div className="coachRole"><ShieldCheck size={14}/><span>Role: turn the selected pathway into a practical, evidence-building career experiment.</span></div><div className="experimentGoal"><small>EXPERIMENT GOAL</small><b>{roadmap.experiment_goal||"Build evidence for the selected pathway through a focused practical project."}</b></div>{roadmap.priority_skills?.length>0&&<p><b>Priority skills</b><br/>{roadmap.priority_skills.join(" · ")}</p>}<div className="roadSteps">{roadmap.next_90_days.map((x,i)=><div className="roadStep" key={x}><span>{String(i+1).padStart(2,"0")}</span><div><small>90-DAY ACTION</small>{x}</div></div>)}</div>{roadmap.success_indicators?.length>0&&<div className="successBox"><small>SUCCESS INDICATORS</small>{roadmap.success_indicators.map(x=><span key={x}><CheckCircle2 size={12}/>{x}</span>)}</div>}{roadmap.coach?.answer&&<div className="aiCoachBox"><small>AI COACH INSIGHT · {roadmap.pathway}</small><p>{roadmap.coach.answer}</p></div>}{!roadmap.coach?.answer&&result?.coach?.answer&&result?.pathways?.[0]?.pathway===roadmap.pathway&&<div className="aiCoachBox"><small>AI COACH INSIGHT · {roadmap.pathway}</small><p>{result.coach.answer}</p></div>}</div>}
   </div>
  </div>
 </section>
}

function CareerMap({openPath}){
 const[query,setQuery]=useState(""),[paths,setPaths]=useState([]),[loading,setLoading]=useState(true);
 useEffect(()=>{api("/career-pathways").then(r=>setPaths(r.data||[])).catch(()=>setPaths([])).finally(()=>setLoading(false))},[]);
 const filtered=paths.filter(p=>(p.name+" "+(p.description||"")+" "+(p.skills||[]).join(" ")).toLowerCase().includes(query.toLowerCase()));
 return <section className="content"><div className="pageIntro"><span className="eyebrow">STEP 02 · EXPLORE</span><h2>Explore the legal career landscape.</h2><p>Compare structured career pathways, their core skills and typical role directions. Select a pathway to inspect it before returning to your assessment.</p></div><div className="mapTools"><div className="search"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search career pathways..."/></div><div className="toolNote"><ShieldCheck size={16}/> Structured from the LegalPath career database</div></div>{loading?<div className="emptyState"><Clock3 size={22}/><b>Loading career pathways…</b><span>Reading the active pathway library.</span></div>:filtered.length===0?<div className="emptyState"><Search size={22}/><b>No pathway found</b><span>Try another search term.</span></div>:<div className="bigGrid">{filtered.map((p,i)=><article className="bigCard" key={p.id||p.name}><div className="cardTop"><span className="num">{String(i+1).padStart(2,"0")}</span><span className="pathIcon"><Scale size={16}/></span></div><h3>{p.name}</h3><p>{p.description||"Structured legal career pathway."}</p><div className="chips">{(p.skills||[]).slice(0,4).map(s=><span key={s.id||s.name}>{s.name||s}</span>)}</div><div className="line"/><button className="outlineBtn" onClick={()=>openPath({...p,roles:p.roles||[],skills:(p.skills||[]).map(s=>s.name||s),qual:p.qualification||"Eligibility varies by role and jurisdiction.",source:p.source_url||"",verified:p.verification_date||""})}>Explore pathway <ChevronRight size={15}/></button></article>)}</div>}</section>
}

function PathModal({path,close,go}){return <div className="modalBack" onClick={close}><div className="modal" onClick={e=>e.stopPropagation()}><button className="close" onClick={close}><X/></button><span className="eyebrow">PATHWAY PROFILE</span><h2>{path.name}</h2><p>{path.description||path.desc}</p>{path.roles?.length>0&&<div className="modalSection"><b>Typical role directions</b><div className="roleList">{path.roles.map(r=><span key={r}><Briefcase size={14}/>{r}</span>)}</div></div>}<div className="modalSection"><b>Core skills</b><div className="chips">{(path.skills||[]).map(s=><span key={s}>{s}</span>)}</div></div><div className="modalSection"><b>Typical qualification</b><p className="modalMeta">{path.qual||"Eligibility varies by role and jurisdiction."}</p></div>{safeExternalUrl(path.source)&&<a className="sourceRow" href={safeExternalUrl(path.source)} target="_blank" rel="noreferrer noopener"><ShieldCheck size={15}/><div><b>Verified pathway source</b><span>{path.source}</span>{path.verified&&<small>Last verified {path.verified}</small>}</div><ExternalLink size={14}/></a>}<div className="notice"><ShieldCheck size={16}/><span>Use the relevant official source to confirm current eligibility requirements for any specific role or public-sector route.</span></div><button className="primary" onClick={()=>{close();go("Career Assessment")}}>Use in my assessment <ArrowUpRight size={16}/></button></div></div>}

createRoot(document.getElementById("root")).render(<App/>);