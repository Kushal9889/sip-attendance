# SIP Attendance Tracker 📚

A premium mobile-first attendance management app for SIP Abacus teachers.

---

## 🚀 Setup in 5 Minutes

### Step 1 — Create Supabase Account & Project

1. Go to [supabase.com](https://supabase.com) → Sign up (free)
2. Click **"New Project"**
3. Choose:
   - **Region:** South Asia (Mumbai) — lowest latency from India
   - **Database Password:** Choose any password and save it
4. Wait ~2 minutes for the project to start

### Step 2 — Set Up the Database

1. In Supabase, click **SQL Editor** in the left sidebar
2. Click **"New query"**
3. Open the file `supabase-setup.sql` from this folder
4. Copy the entire content and paste it into the SQL editor
5. Click **"Run"** — you should see "Success. No rows returned"

### Step 3 — Get Your API Keys

1. In Supabase, click **Project Settings** (gear icon) → **API**
2. Copy:
   - **Project URL** (looks like `https://xxxxx.supabase.co`)
   - **anon public** key (long text starting with `eyJ...`)

### Step 4 — Configure the App

1. In this folder, copy `.env.example` to a new file called `.env`
2. Open `.env` and fill in:
   ```
   VITE_SUPABASE_URL=https://your-project-ref.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJyour-anon-key-here
   ```

### Step 5 — Run Locally (for testing)

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Step 6 — Deploy to Vercel (for the live link)

1. Go to [vercel.com](https://vercel.com) → Sign up (free)
2. Click **"New Project"** → Import this folder from GitHub
   - Or: `npm install -g vercel && vercel` in your terminal
3. Add your environment variables:
   - `VITE_SUPABASE_URL` = your Supabase URL
   - `VITE_SUPABASE_ANON_KEY` = your anon key
4. Deploy! You'll get a link like `https://your-app.vercel.app`

---

## 📱 How to Use

### First Time
1. Open the app link on your phone
2. Tap **"First time? Create an account"**
3. Enter your email and a password → Sign up
4. Sign in with the same email and password

### Create a Batch
1. Tap the **+** button on the home screen
2. Enter batch name (e.g. "Batch A — Level 1")
3. Enter schedule (optional, e.g. "Mon/Wed/Fri 4:00 PM")
4. Tap **Create Batch**

### Add Students
1. Tap **👥 Students** on any batch card
2. Tap the **+** button
3. Enter student name and optional parent phone
4. Repeat for all students

### Mark Attendance (Daily)
1. Open the app → Home screen shows today's batches
2. Tap **📝 Mark Attendance** on the batch you want
3. Students load automatically — all start as Absent
4. Change each student to **Present** as needed
5. Or tap **✅ All Present** to mark everyone at once
6. Changes **auto-save** instantly — no Save button needed!

### View Calendar
1. Tap **📅** in the bottom navigation
2. Green dots = all present, Orange = some absent, Red = all absent
3. Tap any past day to view/edit that day's attendance

### View Reports
1. Tap **📊** in the bottom navigation
2. See monthly attendance % for every student in every batch
3. Use ← Prev to see previous months

---

## 💡 Tips

- **Add to Home Screen**: In Chrome on Android, tap the 3-dot menu → "Add to Home Screen" for an app-like experience
- **Shifting schedules**: Just tap "Mark Attendance" on any day — the calendar tracks when attendance was actually taken, not scheduled days
- **Undo a mistake**: Just change the dropdown back — it saves immediately

---

## 🛡️ Privacy & Security

- Your data belongs only to you
- Protected by Supabase Row Level Security — no one else can see your records even with the same app
- Hosted on Vercel's global CDN for fast loading anywhere in India
