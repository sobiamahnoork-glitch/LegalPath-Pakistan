import crypto from"node:crypto";
const validUrl=v=>{try{const u=new URL(v);return["http:","https:"].includes(u.protocol)}catch{return false}};
export async function researchAgent(input={}){return{agent:"Research Agent",status:"completed",records:Array.isArray(input.records)?input.records:[],count:Array.isArray(input.records)?input.records.length:0,timestamp:new Date().toISOString()};}
export async function verificationAgent(records=[]){
const checked=records.map(r=>{const issues=[];if(!r.title)issues.push("missing title");if(!r.organisation)issues.push("missing organisation");if(!r.source_url)issues.push("missing official source URL");else if(!validUrl(r.source_url))issues.push("invalid source URL");if(r.deadline&&Number.isNaN(Date.parse(r.deadline)))issues.push("invalid deadline");return{...r,verification_status:issues.length?"rejected":"verified",verification_issues:issues,verified_at:issues.length?null:new Date().toISOString()};});
return{agent:"Verification Agent",status:"completed",records:checked,verified:checked.filter(x=>x.verification_status==="verified").length,rejected:checked.filter(x=>x.verification_status==="rejected").length};}
export function careerIntelligenceAgent(profile={}){const text=[profile.interests,profile.skills,profile.experience,profile.target].filter(Boolean).join(" ").toLowerCase();const scores=[];for(const p of globalThis.__LEGALPATH_PATHWAYS__||[]){const score=p.skills.reduce((n,s)=>n+(text.includes(s.toLowerCase())?1:0),0);scores.push({pathway:p,score});}scores.sort((a,b)=>b.score-a.score);return{agent:"Career Intelligence Agent",status:"completed",recommendations:scores.map(x=>({...x.pathway,match_score:x.score})),note:"Match is based only on supplied profile text and configured pathway skills."};}
export function matchingAgent(profile={},opportunities=[]){const userSkills=new Set((profile.skills||[]).map(x=>x.toLowerCase()));const matches=opportunities.map(o=>{const required=o.skills||[];const matched=required.filter(s=>userSkills.has(String(s).toLowerCase()));return{...o,matched_skills:matched,match_score:required.length?Math.round(matched.length/required.length*100):0};}).filter(x=>x.match_score>0).sort((a,b)=>b.match_score-a.match_score);return{agent:"Opportunity Matching Agent",status:"completed",matches};}
export function fingerprint(record){return crypto.createHash("sha256").update(JSON.stringify(record)).digest("hex");}

const assessmentSignals={
  "Litigation & Advocacy":["advocacy","courtroom","public speaking","argument","criminal","civil","litigation"],
  "Judiciary & Judicial Services":["judiciary","judicial","reasoning","judgment","procedure","current affairs"],
  "Corporate & Commercial Law":["business","corporate","commercial","contracts","finance","compliance","transactions"],
  "Government, Legislative & Regulatory Practice":["government","public policy","public law","policy","constitution","regulation","legislation"],
  "Human Rights & Public Interest Law":["human rights","social justice","gender","child rights","legal aid","ngo","public interest"],
  "International Law & International Organisations":["international","global","foreign affairs","treaty","human rights","diplomacy","humanitarian"],
  "Alternative Dispute Resolution & Arbitration":["arbitration","adr","negotiation","mediation","commercial","dispute resolution"],
  "Criminal Justice, Prosecution & Legal Investigation":["criminal","prosecution","investigation","evidence","forensic","criminal justice"],
  "Tax, Banking, Finance & Compliance":["banking","finance","tax","competition","economics","business","compliance","aml"],
  "Legal Academia, Research & Legal Technology":["research","writing","academia","teaching","technology","legal tech","ai","policy"]
}
export function assessmentAgent(profile={}){
  const values=[];
  for(const key of Object.keys(assessmentSignals)){
    const signals=assessmentSignals[key];
    const text=JSON.stringify(profile).toLowerCase();
    const matched=signals.filter(s=>text.includes(s));
    values.push({
      pathway:key,
      evidence:matched,
      match_count:matched.length,
      hypothesis:matched.length
        ? `This pathway is worth exploring based on ${matched.length} matching signals in your profile.`
        : "There is not enough evidence yet; try activities before drawing a conclusion."
    });
  }
  values.sort((a,b)=>b.match_count-a.match_count);
  return {
    agent:"Career Intelligence Agent",
    status:"completed",
    mode:"exploration",
    note:"These are career-fit hypotheses, not deterministic career decisions.",
    pathways:values.slice(0,5)
  };
}

export function roadmapAgent(profile={},pathway=""){
  const year=String(profile.year||profile.semester||"").toLowerCase();
  const stage=year.includes("1")?"Explore":year.includes("2")?"Explore":year.includes("3")?"Build":year.includes("4")||year.includes("5")?"Convert":"Explore";
  const generic={
    Explore:["Compare 2-3 pathways","Complete one introductory research task","Attend one relevant academic or professional activity","Start a focused CV/portfolio section"],
    Build:["Complete a pathway-specific research or practical project","Target a relevant internship or assistantship","Build one demonstrable skill","Add evidence to your portfolio"],
    Convert:["Target verified internships, junior roles or research positions","Tailor CV and applications to the pathway","Complete one portfolio-quality work sample","Track applications and feedback"]
  };
  return {
    agent:"Career Coach Agent",
    status:"completed",
    pathway,
    stage,
    next_90_days:generic[stage]||generic.Explore,
    principle:"The roadmap is a practical experiment plan; it should be updated as the student's evidence and interests change."
  };
}
