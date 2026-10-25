# TAD Logistics Recruitment Agent – Dashboard

Next.js 16 dashboard for the recruitment agent. It covers jobs, CV import, the ranked candidate list and candidate assessments. For full local setup (database, backend, this dashboard), see the backend's `docs/local_setup.md`.

```bash
npm install
cp .env.local.example .env.local   # NEXT_PUBLIC_API_BASE_URL points at the backend
npm run dev                        # http://localhost:3000
npm run lint && npm run build      # checks
```

Key files:

| File | Purpose |
|---|---|
| `src/lib/api.ts` | All backend calls (Axios, bearer token, redirect to login on 401) |
| `src/lib/utils.ts` | `cn()` class helper, branding and feature flags, API error formatting |
| `src/app/dashboard/jobs/page.tsx` | Job list, create and edit job |
| `src/app/dashboard/jobs/[id]/page.tsx` | Job page: CV import and ranked candidates |
| `src/app/dashboard/candidates/[id]/page.tsx` | Extracted profile, match assessment, original CV, retry / re-assess / shortlist |
| `src/components/CVImport.tsx` | Multi-file / ZIP upload with per-file results |
| `src/components/JobModal.tsx` | Create / edit job form |
