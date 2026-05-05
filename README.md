# 🌊 Blue Ocean Dossier System

**The Art of the Impossible** — Workshop dossier platform with AI maturity assessment, modular unlock system, and admin panel.

---

## DEPLOYMENT TO VERCEL (Step-by-Step)

### Step 1: Create a GitHub repo

1. Go to [github.com/new](https://github.com/new)
2. Name it `blue-ocean-dossier`, keep it **Private**
3. In your terminal:
```bash
cd blue-ocean-dossier
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/blue-ocean-dossier.git
git push -u origin main
```

### Step 2: Create Vercel Postgres database

1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Click **Storage** in the top navigation
3. Click **Create Database** → choose **Postgres (Powered by Neon)**
4. Pick a name like `blue-ocean-db`, choose a region close to your users
5. Click **Create**
6. After creation, go to the **Quickstart** tab
7. Copy the `POSTGRES_URL` connection string — you'll need this

### Step 3: Deploy to Vercel

1. Go to [vercel.com/new](https://vercel.com/new)
2. Click **Import** next to your `blue-ocean-dossier` repo
3. Under **Environment Variables**, add these:

| Key | Value |
|-----|-------|
| `POSTGRES_URL` | *(paste from Step 2)* |
| `JWT_SECRET` | `blue-ocean-2026-your-random-secret-here` |
| `ADMIN_PASSWORD` | `BlueOcean2026!` |
| `SESSION_DURATION_HOURS` | `24` |
| `VERCEL` | `1` |

4. Click **Deploy**

### Step 4: Seed the database

After deployment, you need to run the seed script once to create tables and initial data.

**Option A — From your local machine:**
```bash
# In your project folder, create a local .env with the Vercel POSTGRES_URL
# Then run:
npm run seed
```

**Option B — From Vercel dashboard:**
1. Go to your project → **Settings** → **Functions**
2. Or use the Vercel CLI:
```bash
npx vercel env pull .env.local
npm run seed
```

### Step 5: Test it!

Your app is now live at: `https://your-project-name.vercel.app`

- **Login page:** `https://your-project-name.vercel.app/login`
- **Admin panel:** `https://your-project-name.vercel.app/admin`

---

## Login Credentials

| Role | Username | Password |
|------|----------|----------|
| **Admin** | `admin` | `BlueOcean2026!` |

Create respondent accounts from the **Admin Panel → Users → Create User**.
The system auto-generates a random 6-digit passcode for each user.

---

## Module 2: PDF Report

For the demo, Module 2 shows a "Download PDF" button.

**To add your PDF:**
1. Place your report PDF at `public/reports/sample-report.pdf`
2. Commit and push — Vercel auto-deploys

**Future:** We'll build dynamic PDF generation from the assessment responses.

---

## File Structure

```
blue-ocean-dossier/
├── server.js              ← Express server (Vercel-compatible)
├── vercel.json            ← Vercel routing config
├── .env                   ← Local secrets (never committed)
├── package.json           ← Dependencies
│
├── db/
│   ├── database.js        ← PostgreSQL connection + query wrapper
│   └── seed.js            ← Initial data (run once)
│
├── middleware/auth.js      ← JWT authentication
│
├── routes/
│   ├── auth.js            ← Login/logout
│   ├── dashboard.js       ← Respondent experience + Module 2 PDF
│   └── admin.js           ← Admin panel CRUD
│
├── views/                 ← EJS templates
│   ├── login.ejs          ← Blue Ocean branded login
│   ├── dashboard.ejs      ← 6 module cards
│   ├── assessment.ejs     ← 25-question form with progress bar
│   ├── report.ejs         ← Module 2 PDF download page
│   ├── responses.ejs      ← View completed answers
│   └── admin/             ← Admin panel views
│
└── public/
    ├── css/               ← Styling (Blue Ocean branding)
    └── reports/           ← Place your PDF report here
```

---

## Local Development

```bash
# 1. Set your POSTGRES_URL in .env
# 2. Install & seed
npm install
npm run seed

# 3. Run
npm start
# → http://localhost:3000
```
