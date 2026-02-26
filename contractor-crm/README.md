# ContractorCRM — Deployment Guide

A full-stack Contractor CRM built with React + Vite + Supabase, deployed on Vercel.

---

## Prerequisites

- Node.js 18+ installed ([nodejs.org](https://nodejs.org))
- A Supabase project (you already have one ✓)
- A Vercel account ([vercel.com](https://vercel.com))
- Git installed

---

## Step 1 — Set Up the Database (Supabase)

1. Go to your **Supabase Dashboard** → select your project
2. Click **SQL Editor** in the left sidebar → **New Query**
3. Copy the entire contents of `supabase-schema.sql` and paste it in
4. Click **Run**

You should see: `Success. No rows returned.`

That's it — your tables and security rules are live.

---

## Step 2 — Get Your Supabase Credentials

1. In Supabase Dashboard → **Project Settings** → **API**
2. Copy these two values:
   - **Project URL** → looks like `https://abcdefgh.supabase.co`
   - **anon / public key** → long string starting with `eyJ...`

---

## Step 3 — Configure Local Environment

In the project folder, create a file called `.env.local`:

```
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

Replace the values with what you copied in Step 2.

---

## Step 4 — Run Locally (optional but recommended)

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). Sign up for an account and test it out.

---

## Step 5 — Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
```

Then create a new repo on [github.com](https://github.com/new) and push:

```bash
git remote add origin https://github.com/YOUR_USERNAME/contractor-crm.git
git branch -M main
git push -u origin main
```

---

## Step 6 — Deploy to Vercel

1. Go to [vercel.com](https://vercel.com) → **Add New Project**
2. Click **Import** next to your `contractor-crm` GitHub repo
3. Vercel will auto-detect it as a Vite project — no build settings needed
4. Before clicking Deploy, expand **Environment Variables** and add:

   | Name | Value |
   |------|-------|
   | `VITE_SUPABASE_URL` | `https://your-project-id.supabase.co` |
   | `VITE_SUPABASE_ANON_KEY` | `your-anon-key-here` |

5. Click **Deploy** 🚀

Your CRM will be live at `https://contractor-crm-xxxx.vercel.app` in ~60 seconds.

---

## Step 7 — Configure Auth Email (optional)

By default Supabase sends a confirmation email on signup. To customize:

1. Supabase Dashboard → **Authentication** → **Email Templates**
2. Edit the "Confirm signup" template if desired

To **disable** email confirmation (simpler for personal use):

1. Supabase Dashboard → **Authentication** → **Providers** → **Email**
2. Turn off **"Confirm email"**

---

## Future Deployments

Every time you `git push` to `main`, Vercel auto-redeploys. That's it.

---

## Project Structure

```
contractor-crm/
├── src/
│   ├── main.jsx          # React entry point
│   ├── App.jsx           # Main CRM app
│   ├── AuthPage.jsx      # Login / signup / reset
│   └── supabase.js       # Supabase client
├── supabase-schema.sql   # Run once in Supabase SQL Editor
├── index.html
├── vite.config.js
├── package.json
├── .env.example          # Template — copy to .env.local
└── .gitignore
```

---

## Adding More Users

Since you have auth enabled, anyone with your app URL can sign up. If you want to restrict to just yourself:

1. Supabase Dashboard → **Authentication** → **Settings**
2. Set **"Disable sign ups"** to ON after you create your account

This lets you log in but prevents others from registering.
