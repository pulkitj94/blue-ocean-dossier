# Blue Ocean Dossier System — Project Context

## Project Overview
A modular workshop dossier platform for YPO Blue Ocean ("The Art of the Impossible") event. Full-stack Node.js + Express + PostgreSQL app deployed on Vercel.

**Live URL:** `https://blue-ocean-dossier.vercel.app`
**Admin Panel:** `https://blue-ocean-dossier.vercel.app/admin`
**Local Project Path:** `~/GLT C14 WIP Builds/blue-ocean-dossier`

---

## Tech Stack
- **Backend:** Node.js + Express + EJS templates
- **Database:** PostgreSQL on Neon (Singapore region)
- **Email:** Resend (API key: `re_DViscm9u_8wFP3ibC9D6pKhvj57KVY8Mx`, sender: `onboarding@resend.dev`)
- **Auth:** bcryptjs + jsonwebtoken + cookie-parser
- **Deployment:** Vercel (connected to GitHub repo)
- **Fonts:** Cormorant Garamond, Inter, JetBrains Mono

---

## Credentials
- **Admin:** `admin` / `BlueOcean2026!`
- **Demo respondent:** `BO-018-2026` / `204815` (Amit Demo, Northstar Industries)
- **Resend API Key:** `re_DViscm9u_8wFP3ibC9D6pKhvj57KVY8Mx`

---

## Database Connection
- **POSTGRES_URL:** `postgresql://neondb_owner:npg_sgnQZwuJ3o7h@ep-wispy-smoke-aod74r40.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require`

---

## Vercel Environment Variables
- POSTGRES_URL
- JWT_SECRET
- ADMIN_PASSWORD
- SESSION_DURATION_HOURS
- RESEND_API_KEY
- VERCEL=1

---

## Project Structure
```
blue-ocean-dossier/
├── server.js                 ← Express server (Vercel-compatible)
├── vercel.json               ← Routes all to server.js
├── .env                      ← Local env vars
├── package.json              ← Dependencies
├── db/
│   ├── database.js           ← PostgreSQL wrapper
│   ├── seed.js               ← Creates admin, modules, questions
│   ├── update-questions.js   ← Adds tooltips (v1)
│   └── update-questions-v2.js ← Adds tooltips + scale_labels (v2)
├── middleware/auth.js         ← requireAuth, requireAdmin
├── routes/
│   ├── auth.js               ← Login/logout
│   ├── dashboard.js          ← Dashboard, modules, assessment submit
│   └── admin.js              ← Admin CRUD, Resend email invites, question reorder
├── views/
│   ├── login.ejs             ← Dark tech gradient left + light right split
│   ├── dashboard.ejs         ← Module grid, org/table/cohort meta
│   ├── assessment.ejs        ← Draggable slider, tooltips, pills, review summary, thank you
│   ├── report.ejs            ← Module 2 PDF download
│   ├── responses.ejs         ← Read-only response view
│   ├── error.ejs
│   └── admin/
│       ├── login.ejs
│       ├── dashboard.ejs
│       ├── users.ejs          ← User CRUD, send invite, reset passcode
│       ├── questions.ejs      ← Edit questions, tooltips, scale labels, reorder, module filter
│       ├── modules.ejs
│       └── responses.ejs
├── public/
│   ├── css/main.css           ← All respondent-facing styles
│   ├── css/admin.css          ← Admin panel styles
│   ├── images/
│   │   ├── YPO-SA-Blue-Ocean-Regional_Horizontal_White.png  ← White YPO logo
│   │   ├── blueocean-logo-white.png                         ← White Blue Ocean logo
│   │   └── blueocean-logo-blue.png                          ← Blue Blue Ocean logo
│   └── reports/               ← Place sample-report.pdf here for Module 2
```

---

## Database Tables
- **users** — id, username, password_hash, first_name, last_name, designation, organization, email, cohort, table_number, custom_fields, role, created_at, last_login
- **modules** — id, module_number, title, subtitle, description, module_type, is_default_unlocked, sort_order
- **user_module_status** — id, user_id, module_id, status, completed_at
- **questions** — id, module_id, question_number, pillar, question_text, response_type, options, scoring_logic, sort_order, is_active, tooltip, scale_labels
- **responses** — id, user_id, question_id, module_id, answer, score, submitted_at
- **module_unlock_rules** — id, module_id, rule_type, depends_on_module_id, unlock_date, is_active

---

## Key Features Implemented

### Authentication
- JWT-based with httpOnly cookies
- Separate respondent/admin auth
- Auto-generated User IDs (BO-XXX-2026)
- 6-digit passcode auto-generation

### Login Page
- Dark tech gradient left panel (deep blue/teal, matching PDF aesthetic)
- Light right panel with form
- YPO logo top-left (white, ~90-100px)
- Blue Ocean logo top-right (blue version, ~55px)
- "The Art of the Impossible" in italic with teal accent

### Dashboard
- Sticky header with both logos
- User ID + Sign out on right
- "Good morning, [Name]" greeting with org/table/cohort meta
- 12-column module grid: Module 1 spans 8 cols (dark featured), others 4 cols
- Module unlock system (Module 2 unlocks after Module 1 complete)

### Assessment (Module 1)
- 25 questions across pillars: Strategy, Use Cases, Data, Technology, People, Governance, Change Management, Vendor, Investment, Outcomes, Barriers, Future Intent
- **Draggable Likert slider** with dot milestones for scale 1-5 questions
- Scale labels from database displayed below dots (e.g. "No plan" → "Fully integrated")
- **Gold tooltip icon (ℹ)** inline after question text with hover popup
- Instruction text (e.g. "Select all applicable") on separate line
- Q# inline with question text
- **Centered rounded pills** for single/multi-select options
- Multi-select limit enforcement (Q24: max 3)
- Auto-scroll to next question after answering
- **3-phase flow:** Questions → Review Summary → Thank You screen
- Review shows all answers grouped by pillar
- Thank you screen with 5-second countdown redirect to dashboard

### Admin Panel
- User management: create (auto User ID), edit, delete, reset passcode, send invite email
- Question management: add, edit (question text, tooltip, scale labels, options, scoring), toggle active, delete, reorder (↑↓), module filter dropdown
- Module unlock rules configuration
- Response viewer with modal
- Dashboard shows respondent count, module count, completed assessments

### Email Invites
- Sent via Resend API
- Branded HTML template with YPO Blue Ocean header
- Contains: User ID, new passcode, app link, video placeholder
- Warning shown before sending that passcode will be reset
- From: "YPO Blue Ocean <onboarding@resend.dev>"
- Subject: "Your private dossier for 18 July"

---

## Design System (Current)
- **Colors:** Dark navy (#0a1628, #0d2137) for headers/login, cream (#fdfbf6) for content, teal (#5DCAA5, #1D9E75) for accents, oxblood (#6b1f1f) for pillar labels, gold (#b8924a) for tooltips
- **Fonts:** Cormorant Garamond (headings), Inter (body), JetBrains Mono (labels/mono)
- **CSS Variables:** --ink, --ivory, --paper, --accent, --gold, --rule, --success etc.

---

## Pending / In-Progress Items

### UI/UX
- [ ] **Slider labels alignment** — labels still not perfectly aligned under dots on some questions. Position-absolute approach applied but needs fine-tuning
- [ ] **Header logo sizes** — YPO logo just increased to 90px, Blue Ocean at 50-65px, may need final tuning after deploy
- [ ] **Sticky header** — CSS added but not yet verified live

### Features
- [ ] **PDF report for Module 2** — user has Canva template, needs to place as `public/reports/sample-report.pdf`. Future: dynamic PDF generation
- [ ] **Bulk user upload** — CSV/Excel template upload to create multiple users at once
- [ ] **Modules 3-6 content pages** — only unlock logic works, no actual content
- [ ] **Scoring engine** — basic score storage exists but no weighted scoring or cohort benchmarking
- [ ] **Custom domain** — currently on Vercel subdomain
- [ ] **Production email sender** — needs verified domain on Resend

### Copy/Content
- [ ] Some tooltip text starts with "e.g." — needs standardizing (approved list exists)
- [ ] Q25 tooltip: "Think about whether your leadership is planning to allocate more budget specifically for AI tools, AI talent, or AI projects in the coming year."
- [ ] Module 1 description updated to: "You may discuss this with your CTO, CIO, or the most relevant person in your organisation before completing it."

---

## Deployment Notes
- Vercel deployments sometimes get stuck on "Initializing" — use `npx vercel --prod` as fallback
- All route handlers wrapped with `asyncHandler` for proper error catching
- `res.redirect(303, '/dashboard')` used for POST→GET redirects
- DNS set to Google (8.8.8.8) to resolve Neon hostnames from local network

---

## Reference Files
- **Original HTML prototype:** `/Users/pulkitjain/Desktop/YPO content master/02_Web_App.html`
- **Event agenda PDF:** Uploaded in chat (17-18 July 2026, Hotel Trident, Gurgaon)
- **Transcript:** `/mnt/transcripts/2026-05-05-13-23-00-blue-ocean-dossier-full-build.txt`