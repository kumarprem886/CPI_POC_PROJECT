# SAP CPI AI Control Center v2.0

A full-stack AI-powered dashboard to manage, monitor, and generate SAP CPI integrations.

---

## Tech Stack

| Layer     | Technology                                      |
|-----------|-------------------------------------------------|
| Backend   | Node.js, Express, Axios, Helmet, Morgan         |
| AI        | Google Gemini 2.0 Flash                         |
| Frontend  | React 18, Vite 5, TailwindCSS 3, Framer Motion  |
| Charts    | Recharts                                        |
| Icons     | Lucide React                                    |

---

## Project Structure

```
CPI_POC_PRO/
├── BackEnd/
│   ├── server.js          ← Express API server
│   ├── package.json
│   ├── .env               ← Your credentials (never commit this)
│   └── .env.example       ← Template for new setups
└── FrontEnd/
    ├── index.html
    ├── package.json
    ├── vite.config.js
    ├── tailwind.config.js
    ├── postcss.config.js
    └── src/
        ├── App.jsx            ← Root layout + sidebar + toast system
        ├── api.js             ← All API functions (axios client)
        ├── main.jsx
        ├── index.css
        └── pages/
            ├── Dashboard.jsx      ← KPIs, charts, recent messages
            ├── AIAssistant.jsx    ← Generate / Analyze / Optimize / Chat
            ├── IFlowStudio.jsx    ← Browse packages and iFlows
            ├── Monitoring.jsx     ← Message processing logs
            ├── Security.jsx       ← Credentials and keystore
            └── Settings.jsx       ← Connection status and config
```

---

## Prerequisites

Make sure these are installed on your machine before starting.

| Tool      | Version  | Check command       | Download                     |
|-----------|----------|---------------------|------------------------------|
| Node.js   | 18+      | `node -v`           | https://nodejs.org           |
| npm       | 9+       | `npm -v`            | (comes with Node)            |
| VS Code   | any      | `code --version`    | https://code.visualstudio.com |

---

## First-Time Setup

### 1. Open the project in VS Code

```
File → Open Folder → select the CPI_POC_PRO folder
```

Or from terminal:
```bash
code "C:\path\to\CPI_POC_PRO"
```

---

### 2. Install Backend dependencies

Open a terminal in VS Code (`Ctrl + backtick`) and run:

```bash
cd BackEnd
npm install
```

Packages installed:
- `express` — web server
- `cors` — cross-origin requests
- `helmet` — security headers
- `morgan` — HTTP request logging
- `express-rate-limit` — rate limiting
- `node-cache` — in-memory caching (60s TTL)
- `axios` — HTTP client for CPI API calls
- `@google/generative-ai` — Gemini AI SDK
- `dotenv` — load .env variables

---

### 3. Configure environment variables

Your `.env` file is already set up. To update it:

```bash
# BackEnd/.env
PORT=8080
GEMINI_API_KEY=your_gemini_api_key_here
CPI_BASE_URL=https://your-tenant.it-cpitrial05.cfapps.us10-001.hana.ondemand.com
CPI_USERNAME=your_email@company.com
CPI_PASSWORD=your_password_here
ALLOWED_ORIGINS=http://localhost:5173
```

---

### 4. Install Frontend dependencies

Open a **second terminal** in VS Code (click the `+` icon in the terminal panel):

```bash
cd FrontEnd
npm install
```

Packages installed:
- `react` + `react-dom` — UI framework
- `axios` — API calls
- `framer-motion` — animations
- `lucide-react` — icons
- `recharts` — charts
- `vite` — build tool
- `tailwindcss` — utility CSS

---

## Running the App

You need **two terminals open at the same time**.

### Terminal 1 — Start Backend

```bash
cd BackEnd
node server.js
```

Expected output:
```
✅ SAP CPI AI Backend running on port 8080
```

**For auto-restart on file save (development):**
```bash
node --watch server.js
```

---

### Terminal 2 — Start Frontend

```bash
cd FrontEnd
npm run dev
```

Expected output:
```
VITE v5.x  ready in xxxx ms
➜  Local:   http://localhost:5173/
```

Then open your browser at: **http://localhost:5173**

---

## All Console Commands Reference

### Backend

| Command                    | Description                             |
|----------------------------|-----------------------------------------|
| `npm install`              | Install all backend dependencies        |
| `node server.js`           | Start backend server (production)       |
| `node --watch server.js`   | Start with auto-restart on file change  |
| `npm start`                | Same as `node server.js`                |

### Frontend

| Command          | Description                                  |
|------------------|----------------------------------------------|
| `npm install`    | Install all frontend dependencies            |
| `npm run dev`    | Start dev server at http://localhost:5173    |
| `npm run build`  | Build for production (outputs to dist/)      |
| `npm run preview`| Preview the production build locally         |

### Verify both servers are running

```bash
# Test backend health
curl http://localhost:8080/api/health

# Or open in browser
start http://localhost:5173
```

---

## API Endpoints

| Method | Route                              | Description                        |
|--------|------------------------------------|------------------------------------|
| GET    | `/api/health`                      | CPI + AI connection status         |
| GET    | `/api/dashboard-stats`             | KPI summary (packages, iFlows, messages) |
| GET    | `/api/packages`                    | List all integration packages      |
| GET    | `/api/packages/:id/iflows`         | List iFlows in a package           |
| GET    | `/api/runtime-artifacts`           | Deployed runtime artifacts         |
| GET    | `/api/messages`                    | Message processing logs            |
| GET    | `/api/credentials`                 | User credentials list              |
| GET    | `/api/keystore`                    | Keystore entries                   |
| POST   | `/api/ai/generate`                 | Generate iFlow design with AI      |
| POST   | `/api/ai/analyze`                  | Analyze an error with AI           |
| POST   | `/api/ai/optimize`                 | Optimize code/mapping with AI      |
| POST   | `/api/ai/chat`                     | Conversational AI assistant        |

**Query params for `/api/messages`:**
```
?top=20          → number of results (default 20)
?status=FAILED   → filter by status (COMPLETED, FAILED, PROCESSING)
?integrationFlowName=MyFlow  → filter by iFlow name
```

**Query params for `/api/packages`:**
```
?search=salesforce   → filter packages by name/id
?top=50              → number of results (default 50)
```

---

## Rate Limits

| Endpoint      | Limit              |
|---------------|--------------------|
| `/api/*`      | 100 requests / 15 min |
| `/api/ai/*`   | 10 requests / 1 min   |

---

## Pages Overview

| Page          | What it does                                                   |
|---------------|----------------------------------------------------------------|
| Dashboard     | Live KPI cards, message trend chart, runtime status pie chart, recent logs |
| AI Assistant  | 4 modes: Generate iFlow, Analyze Error, Optimize Code, Chat    |
| iFlow Studio  | Browse packages, search, expand to see iFlows with status      |
| Monitoring    | Message processing logs with status filters and auto-refresh   |
| Security      | User credentials and keystore entries (read-only)              |
| Settings      | Connection health check, environment config reference          |

---

## Stopping the Servers

In each terminal press:
```
Ctrl + C
```

---

## Troubleshooting

**Backend won't start:**
```bash
# Check Node version (needs 18+)
node -v

# Re-install dependencies
cd BackEnd
rm -rf node_modules
npm install
```

**Frontend won't start:**
```bash
cd FrontEnd
rm -rf node_modules
npm install
npm run dev
```

**CPI connection shows "Disconnected":**
- Check `.env` values (URL, username, password)
- Make sure you're on VPN if your CPI tenant requires it
- Test manually: open `http://localhost:8080/api/health` in browser

**Gemini AI not responding:**
- Check `GEMINI_API_KEY` in `.env`
- Regenerate key at: https://aistudio.google.com/app/apikey
- AI is rate-limited to 10 requests/min

---

## Security Notes

- Never push `.env` to GitHub — add it to `.gitignore`
- The `.env.example` file is safe to commit (no real credentials)
- All CPI passwords are only used server-side — never exposed to the browser
