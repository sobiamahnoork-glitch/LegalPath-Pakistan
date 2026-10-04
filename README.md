# LegalPath Pakistan

AI career operating system and career intelligence platform designed for Pakistani law students.

LegalPath Pakistan brings career pathways, skills development, verified legal opportunities, multi-agent workflows, and evidence-based career roadmaps into a unified workspace.

## Features

- **Career Pathways**: Explore 5 key legal career tracks in Pakistan (Litigation & Advocacy, Judicial Service, Government Legal Service, Corporate / In-House Legal, Legal Research & Academia).
- **Career Assessment & Discovery**: Evidence-based career exploration matching student profiles, skills, and extracurriculars to legal pathways.
- **Opportunity Intelligence**: Source-first legal opportunities pipeline requiring verified provenance, deadlines, and eligibility before publication.
- **AI Career Coach**: Grounded legal career coaching adhering strictly to verified Pakistani legal frameworks, bar requirements, and exam pathways.
- **Multi-Agent Architecture**: Discrete agent pipeline (Research → Verification → Career Intelligence → Opportunity Matching → Career Coach).

## Quick Start

```bash
# Install dependencies
npm install

# Build & run
npm run build
npm run server
```

## API Endpoints

- `GET /api/health` - Service health status
- `GET /api/career-pathways` - Pakistani legal career pathways
- `GET /api/skills` - Catalog of 25+ essential legal skills
- `GET /api/opportunities` - Verified opportunities
- `GET /api/agents/activity` - Multi-agent audit and activity log
- `POST /api/agents/assessment` - Evidence-based pathway exploration
- `POST /api/agents/roadmap` - 90-day actionable student roadmap
- `POST /api/agents/coach` - Grounded AI career coach
- `POST /api/agents/workflow` - End-to-end multi-agent execution pipeline
