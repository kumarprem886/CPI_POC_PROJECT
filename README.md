# SAP CPI AI Control Center v2.0

A full-stack AI-powered dashboard to manage, monitor, and generate SAP CPI integrations — built with React, Node.js, and multi-provider AI (Gemini, OpenAI, Claude, Ollama).

---

## ⚡ After Cloning — First Thing To Do

> The `.env` file is **not included** in the repo (it contains credentials). You must create it before starting the app.

### Step 1 — Create your `.env` file

```bash
cd BackEnd
copy .env.example .env        # Windows
# or
cp .env.example .env           # Mac/Linux
```

### Step 2 — Open `BackEnd/.env` and fill in your details

```env
PORT=8081

# ── SAP CPI Tenant ─────────────────────────────────────────────────
CPI_BASE_URL=https://your-tenant.it-cpitrial05.cfapps.us10-001.hana.ondemand.com
CPI_USERNAME=your_email@company.com
CPI_PASSWORD=your_password_here

# ── AI Provider (pick one: gemini / openai / anthropic / ollama) ───
AI_PROVIDER=gemini

# Google Gemini (free tier — get key at aistudio.google.com/app/apikey)
GEMINI_API_KEY=AIzaSy...
GEMINI_MODEL=gemini-2.0-flash-lite

# OpenAI — optional (get key at platform.openai.com/api-keys)
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini

# Anthropic Claude — optional (get key at console.anthropic.com)
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-haiku-4-5

# Ollama local — optional (no key needed, run: ollama serve)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2

# ── CORS ───────────────────────────────────────────────────────────
ALLOWED_ORIGINS=http://localhost:5174
```

### Step 3 — Install & run

**Terminal 1 — Backend:**
```bash
cd BackEnd
npm install
node server.js
# ✅ SAP CPI AI Backend running on port 8081
```

**Terminal 2 — Frontend:**
```bash
cd FrontEnd
npm install
npm run dev
# ➜  http://localhost:5174
```

Open **http://localhost:5174** in your browser.

---

## 🔧 Updating Connection Details Later (Two Ways)

### Option A — Settings UI (recommended, no restart needed)

1. Open the app → click **Settings** in the sidebar
2. Edit any field (CPI URL, username, password, AI keys)
3. Click **Save & Reload** — changes apply instantly without restarting the server

### Option B — Edit the `.env` file directly

1. Open `BackEnd/.env` in any text editor
2. Update the values
3. **Restart the backend**: `Ctrl+C` → `node server.js`

---

## 🌐 Ports

| Service  | Default Port | How to change |
|----------|-------------|---------------|
| Frontend | **5174**    | Edit `server.port` in `FrontEnd/vite.config.js` |
| Backend  | **8081**    | Edit `PORT` in `BackEnd/.env` + update proxy target in `vite.config.js` |

If port 5174 or 8081 is already taken, change both values and restart.

---

## 🤖 AI Providers — 11 Supported

Switch between any provider from **Settings → AI Providers** without restarting. All free providers are marked ✅.

| # | Provider | Free Forever | Key | Best For | Get Key |
|---|---|---|---|---|---|
| 1 | 🔵 **Google Gemini** | ✅ 1500 req/day | Yes | Overall best | [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey) |
| 2 | ⚡ **Groq** | ✅ Generous | Yes | Ultra-fast inference | [console.groq.com/keys](https://console.groq.com/keys) |
| 3 | 🔀 **OpenRouter** | ✅ Free models | Yes | Many models one API | [openrouter.ai/keys](https://openrouter.ai/keys) |
| 4 | 🤗 **Hugging Face** | ✅ Yes | Yes | Open-source models | [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens) |
| 5 | 💨 **Mistral AI** | ✅ Yes | Yes | Coding + reasoning | [console.mistral.ai/api-keys](https://console.mistral.ai/api-keys) |
| 6 | 🟩 **NVIDIA NIM** | ✅ Yes | Yes | Strong open models | [build.nvidia.com](https://build.nvidia.com) |
| 7 | 🔷 **Cohere** | ✅ Yes | Yes | Embeddings + RAG | [dashboard.cohere.com/api-keys](https://dashboard.cohere.com/api-keys) |
| 8 | 🌥️ **Cloudflare Workers AI** | ✅ Yes | Yes + Account ID | Serverless apps | [dash.cloudflare.com](https://dash.cloudflare.com) |
| 9 | 🟣 **Ollama (Local)** | ✅ Free forever | ❌ No key | Privacy, offline | [ollama.com](https://ollama.com) |
| 10 | 🟢 **OpenAI** | ❌ Pay-as-you-go | Yes | GPT-4o quality | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) |
| 11 | 🟠 **Anthropic Claude** | ❌ Pay-as-you-go | Yes | Excellent reasoning | [console.anthropic.com](https://console.anthropic.com/settings/keys) |

> 💡 **Recommended free stack:** Start with **Groq** (fastest) or **Google Gemini** (most reliable free tier). Use **OpenRouter** to access many models with one key.

> **Gemini tip:** If you get a quota error, create a key in a **new project** at AI Studio — each project gets its own free quota.

---

## 📁 Project Structure

```
CPI_POC_PRO/
├── BackEnd/
│   ├── server.js          ← Express API + multi-AI router
│   ├── package.json
│   ├── .env               ← YOUR credentials (not in repo, create from .env.example)
│   └── .env.example       ← Template — safe to commit
└── FrontEnd/
    ├── vite.config.js     ← Port + proxy config
    ├── src/
    │   ├── App.jsx            ← Layout, sidebar, login guard, toasts
    │   ├── api.js             ← All API calls
    │   ├── users.js           ← localStorage user store
    │   └── pages/
    │       ├── Login.jsx          ← Login screen
    │       ├── Dashboard.jsx      ← KPIs, charts, AI command center
    │       ├── AIAssistant.jsx    ← Generate / Analyze / Optimize / Chat
    │       ├── IFlowStudio.jsx    ← Browse packages & iFlows
    │       ├── Monitoring.jsx     ← Message processing logs
    │       ├── Security.jsx       ← Credentials & keystore
    │       ├── Settings.jsx       ← CPI config + AI provider switcher
    │       └── UserManagement.jsx ← Add / edit / delete users
```

---

## 🔑 Login

Default admin credentials (created on first run):

| Field | Value |
|---|---|
| Email | `prem.am.kumar@accenture.com` |
| Password | `Admin@123` |

Change or add users at **Settings → User Management**.

---

## 📋 All Commands

### Backend
```bash
cd BackEnd
npm install              # Install dependencies
node server.js           # Start server
node --watch server.js   # Start with auto-restart on save
```

### Frontend
```bash
cd FrontEnd
npm install              # Install dependencies
npm run dev              # Start dev server → http://localhost:5174
npm run build            # Build for production
npm run preview          # Preview production build
```

---

## 🌍 API Endpoints

| Method | Route | Description |
|---|---|---|
| GET | `/api/health` | Backend + CPI + AI status |
| GET | `/api/config` | Read current `.env` config |
| POST | `/api/config` | Update config + hot-reload |
| GET | `/api/dashboard-stats` | KPI summary |
| GET | `/api/packages` | Integration packages |
| GET | `/api/packages/:id/iflows` | iFlows in a package |
| GET | `/api/runtime-artifacts` | Deployed runtime artifacts |
| GET | `/api/messages` | Message processing logs |
| GET | `/api/credentials` | User credentials |
| GET | `/api/keystore` | Keystore entries |
| GET | `/api/ai/providers` | List AI providers + status |
| POST | `/api/ai/test-provider` | Test a specific AI provider |
| POST | `/api/ai/generate` | Generate iFlow with AI |
| POST | `/api/ai/analyze` | Analyze error with AI |
| POST | `/api/ai/optimize` | Optimize code with AI |
| POST | `/api/ai/chat` | Conversational AI |

---

## 🚀 Pages

| Page | What it does |
|---|---|
| **Dashboard** | KPIs, AI Command Center, charts, alerts, quick actions |
| **AI Assistant** | Generate iFlow / Analyze Error / Optimize Code / Chat |
| **iFlow Studio** | Browse packages, search, expand iFlows with status |
| **Monitoring** | Live message logs, filter by status, auto-refresh |
| **Security** | User credentials + keystore entries (read-only) |
| **Settings** | CPI config + AI provider switcher (Gemini/OpenAI/Claude/Ollama) |
| **User Management** | Add, edit, delete users with role-based access |

---

## 🛠 Troubleshooting

**"CPI Disconnected" on dashboard:**
- Check `CPI_BASE_URL`, `CPI_USERNAME`, `CPI_PASSWORD` in `BackEnd/.env`
- Are you on VPN? Some tenants require it
- Test: open `http://localhost:8081/api/health` in browser

**AI quota error:**
- Go to [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
- Create a key in a **new project** (each project gets free quota)
- Paste the new key in **Settings → AI Providers → Gemini**
- Or switch to Ollama (free, local, no quota)

**Port already in use:**
```bash
# Change backend port in BackEnd/.env
PORT=8082

# Change frontend port in FrontEnd/vite.config.js
server: { port: 5175, ... target: 'http://localhost:8082' }
```

**node_modules missing / install errors:**
```bash
cd BackEnd  && rm -rf node_modules && npm install
cd FrontEnd && rm -rf node_modules && npm install
```

---

## 🔒 Security Notes

- `BackEnd/.env` is in `.gitignore` — your credentials are **never pushed to GitHub**
- `BackEnd/.env.example` has no real credentials — safe to commit
- All CPI credentials are used server-side only — never sent to the browser
- User passwords are stored in browser `localStorage` — for local/team use only
