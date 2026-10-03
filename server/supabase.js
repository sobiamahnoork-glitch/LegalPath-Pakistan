import { careerPathways as fallbackPathways, skills as fallbackSkills } from "./data.js";

const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
const key = process.env.SUPABASE_ANON_KEY;

export const supabaseConfigured = Boolean(url && key);

async function request(path) {
  if (!supabaseConfigured) {
    throw new Error("SUPABASE_URL and SUPABASE_ANON_KEY are not configured");
  }

  const response = await fetch(url + "/rest/v1/" + path, {
    headers: {
      apikey: key,
      Authorization: "Bearer " + key,
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error("Supabase request failed (" + response.status + "): " + body);
  }

  return response.json();
}

export async function getCareerPathwaysFromDb() {
  if (!supabaseConfigured) return fallbackPathways;

  const [pathways, dbSkills, mappings] = await Promise.all([
    request("career_pathways?select=*&is_active=eq.true&order=name.asc"),
    request("skills?select=id,name,description,category&order=name.asc"),
    request("career_pathway_skills?select=pathway_id,skill_id,importance")
  ]);

  const skillsById = new Map(dbSkills.map(skill => [skill.id, skill]));

  return pathways.map(pathway => {
    const pathwayMappings = mappings
      .filter(mapping => mapping.pathway_id === pathway.id)
      .sort((a, b) => {
        const order = { core: 0, supporting: 1, advanced: 2 };
        return (order[a.importance] ?? 99) - (order[b.importance] ?? 99);
      });

    return {
      id: pathway.slug,
      db_id: pathway.id,
      name: pathway.name,
      description: pathway.description || "",
      roles: pathway.typical_roles || [],
      qualification: pathway.required_qualification || "",
      skills: pathwayMappings.map(mapping => skillsById.get(mapping.skill_id)?.name).filter(Boolean),
      skill_details: pathwayMappings.map(mapping => {
        const skill = skillsById.get(mapping.skill_id);
        return skill
          ? {
              id: skill.id,
              name: skill.name,
              description: skill.description || "",
              category: skill.category || null,
              importance: mapping.importance || "core"
            }
          : null;
      }).filter(Boolean),
      source_url: pathway.source_url || "",
      verification_date: pathway.verification_date || null
    };
  });
}

export async function getSkillsFromDb() {
  if (!supabaseConfigured) return fallbackSkills;
  const rows = await request("skills?select=name&order=name.asc");
  return rows.map(row => row.name);
}

export async function getApprovedSourcesFromDb() {
  if (!supabaseConfigured) return [];
  return request(
    "sources?select=id,name,url,source_type,authority_tier,is_approved,last_checked_at,last_successful_fetch_at&is_approved=eq.true&order=name.asc"
  );
}

export async function getVerifiedOpportunitiesFromDb() {
  if (!supabaseConfigured) return [];

  const rows = await request(
    "opportunities?select=id,title,organisation,opportunity_type,description,location,remote_allowed,application_url,source_id,deadline,eligibility,verification_status,verified_at,last_verified_at,fingerprint,is_active&verification_status=eq.verified&is_active=eq.true&order=deadline.asc.nullslast"
  );

  return rows.map(row => ({
    ...row,
    type: row.opportunity_type,
    source_url: row.application_url || null
  }));
}
