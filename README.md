# dmless — Hiring Automation MVP

A self-screening hiring tool. Recruiters create links with 5 knockout MCQs. Candidates screen themselves. Only the best reach the inbox.

---

## 🚀 Running Locally

```bash
npm install
npm run dev
```

Visit `http://localhost:3000`

---

## ☁️ Deploying to Vercel

### Step 1: Push to GitHub

```bash
git init
git add .
git commit -m "dmless MVP"
git remote add origin https://github.com/YOUR_USER/dmless.git
git push -u origin main
```

### Step 2: Import on Vercel

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your GitHub repository
3. Framework: **Next.js** (auto-detected)
4. Click **Deploy**

### ⚠️ Vercel Data Persistence Note

Vercel serverless functions use **ephemeral filesystems** — `/tmp` is writable but resets on every cold start. This means data does not persist across deployments or cold starts on Vercel's free tier.

**For persistent data on Vercel, choose one:**

#### Option A: Vercel KV (Recommended — free tier available)
1. In your Vercel project → Storage → Create KV Database
2. Vercel auto-injects `KV_URL`, `KV_REST_API_URL`, `KV_REST_API_TOKEN` env vars
3. Replace `src/lib/db.ts` file operations with `@vercel/kv` calls

#### Option B: PlanetScale / Neon (Postgres/MySQL)
1. Create free DB at planetscale.com or neon.tech
2. Add `DATABASE_URL` env var in Vercel project settings
3. Add `drizzle-orm` and swap out `db.ts` internals

#### Option C: Local dev only
For demo/testing purposes, data persists fine during `npm run dev` — it writes to `data/db.json` in your project folder.

---

## 📁 Architecture

```
src/
  app/
    page.tsx                          Landing page
    signup/ login/                    Auth pages
    dashboard/
      page.tsx                        Recruiter dashboard
      job/[id]/candidates/page.tsx    ← NEW: Shortlisted candidates view
    create-job/ edit-job/[id]/        Job management
    job/[id]/                         Candidate screening flow
    api/
      auth/signup|login|me/           Authentication
      jobs/
        route.ts                      List/create jobs
        [id]/route.ts                 Get/edit/toggle job
        [id]/candidates/route.ts      ← NEW: GET shortlisted candidates
      candidates/
        job/[id]/                     Public job info (no auth)
        check/                        Attempt limit check
        submit/                       MCQ submission
        submit-check/                 Per-question knockout check
        upload/                       Resume upload
        [id]/decision/route.ts        ← NEW: PATCH hire/reject decision
  lib/
    db.ts                             File-based JSON persistence
    auth.ts                           Session cookie helpers
data/
  db.json                             Local database (gitignored)
```

---

## ✨ Features

- **Knockout MCQs** — wrong answer = instant rejection, no retries by default
- **Timer** — recruiter can set time limit per test
- **Attempt limits** — recruiter controls max attempts per candidate
- **Analytics** — funnel chart, MCQ failure rates, pass rate
- **Edit jobs** — change MCQs, description, timer, attempt limit
- **Candidates view** — review shortlisted candidates, hire or reject
- **Persistent DB** — JSON file survives dev server restarts

