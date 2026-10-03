# LegalPath Pakistan Backend

The backend is an Express API with a real multi-agent service boundary. It intentionally has no database dependency yet.

## Run

npm install
npm run server

## API

GET /api/health
GET /api/career-pathways
GET /api/skills
GET /api/opportunities
GET /api/agents/activity

POST /api/agents/research
POST /api/agents/verify
POST /api/agents/career-intelligence
POST /api/agents/match
POST /api/agents/coach

The Career Coach calls Gemini only when GEMINI_API_KEY is configured. It is grounded on the profile/context sent by the application and is instructed not to invent vacancies, deadlines, organisations, laws or qualifications.

The current records are seed data only. The final Supabase/PostgreSQL layer will replace the in-memory data without changing the agent API contract.