import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import NodeCache from 'node-cache';
import axios from 'axios';
import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENV_PATH = path.join(__dirname, '.env');

function parseEnv(content) {
  const obj = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    let val = trimmed.slice(idx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    obj[key] = val;
  }
  return obj;
}

function serializeEnv(obj) {
  return Object.entries(obj).map(([k, v]) => `${k}=${v}`).join('\n') + '\n';
}

const app = express();
const PORT = process.env.PORT || 8080;

app.use(helmet({ contentSecurityPolicy: false }));

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : ['*'];

app.use(cors({
  origin: allowedOrigins.includes('*')
    ? '*'
    : (origin, cb) => {
        if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
        cb(new Error('Not allowed by CORS'));
      },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '1mb' }));
app.use(morgan('dev'));

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests, please try again later.' },
});

const aiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'AI rate limit exceeded. Please wait a moment.' },
});

app.use('/api/', generalLimiter);
app.use('/api/ai/', aiLimiter);

const cache = new NodeCache({ stdTTL: 60 });

let cpiClient = buildCpiClient();
let model = buildModel();

function buildCpiClient() {
  return axios.create({
    baseURL: process.env.CPI_BASE_URL || '',
    auth: {
      username: process.env.CPI_USERNAME || '',
      password: process.env.CPI_PASSWORD || '',
    },
    timeout: 15000,
    headers: { Accept: 'application/json' },
  });
}

function buildModel() {
  const key = process.env.GEMINI_API_KEY || '';
  if (!key) return null;
  const modelName = process.env.GEMINI_MODEL || 'gemini-2.0-flash-lite';
  return new GoogleGenerativeAI(key, { apiVersion: 'v1' }).getGenerativeModel({ model: modelName });
}

function reloadClients() {
  cpiClient = buildCpiClient();
  model = buildModel();
  cache.flushAll();
}

async function cachedGet(cacheKey, url) {
  const cached = cache.get(cacheKey);
  if (cached !== undefined) return cached;
  const { data } = await cpiClient.get(url);
  cache.set(cacheKey, data);
  return data;
}

function handleError(res, error, context) {
  console.error('[Error] ' + (context || '') + ':', error.message);
  const status = error.response?.status || 500;
  const message = error.response?.data?.error?.message?.value
    || error.response?.data?.message
    || error.message
    || 'An unexpected error occurred';
  return res.status(status).json({ success: false, error: message });
}

app.get('/', (req, res) => {
  res.json({ status: 'ok', version: '2.0.0', timestamp: new Date().toISOString() });
});

app.get('/api/health', async (req, res) => {
  try {
    await cpiClient.get('/api/v1/IntegrationPackages?$top=1');
    res.json({ success: true, cpi: 'connected', ai: !!process.env.GEMINI_API_KEY, timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(503).json({ success: false, cpi: 'disconnected', ai: !!process.env.GEMINI_API_KEY, error: error.message, timestamp: new Date().toISOString() });
  }
});

app.get('/api/packages', async (req, res) => {
  try {
    const { search, top = 50 } = req.query;
    const data = await cachedGet('packages', '/api/v1/IntegrationPackages');
    let results = data?.d?.results || [];
    if (search) {
      const s = search.toLowerCase();
      results = results.filter(p =>
        (p.Name && p.Name.toLowerCase().includes(s)) ||
        (p.Id && p.Id.toLowerCase().includes(s))
      );
    }
    results = results.slice(0, parseInt(top));
    res.json({ success: true, count: results.length, results });
  } catch (error) { handleError(res, error, 'GET /api/packages'); }
});

app.get('/api/packages/:packageId/iflows', async (req, res) => {
  try {
    const { packageId } = req.params;
    const cacheKey = 'iflows_' + packageId;
    const url = "/api/v1/IntegrationPackages('" + packageId + "')/IntegrationDesigntimeArtifacts";
    const data = await cachedGet(cacheKey, url);
    const results = data?.d?.results || [];
    res.json({ success: true, count: results.length, packageId, results });
  } catch (error) { handleError(res, error, 'GET /api/packages/:id/iflows'); }
});

app.get('/api/runtime-artifacts', async (req, res) => {
  try {
    const data = await cachedGet('runtime', '/api/v1/IntegrationRuntimeArtifacts');
    const results = data?.d?.results || [];
    res.json({ success: true, count: results.length, results });
  } catch (error) { handleError(res, error, 'GET /api/runtime-artifacts'); }
});

app.get('/api/messages', async (req, res) => {
  try {
    const { top = 20, status, integrationFlowName } = req.query;
    const filters = [];
    if (status) filters.push("Status eq '" + status + "'");
    if (integrationFlowName) filters.push("IntegrationFlowName eq '" + integrationFlowName + "'");
    const filterStr = filters.length ? '&$filter=' + filters.join(' and ') : '';
    const cacheKey = 'messages_' + top + '_' + (status || '') + '_' + (integrationFlowName || '');
    const url = '/api/v1/MessageProcessingLogs?$top=' + top + '&$orderby=LogStart desc' + filterStr;
    const data = await cachedGet(cacheKey, url);
    const results = data?.d?.results || [];
    res.json({ success: true, count: results.length, results });
  } catch (error) { handleError(res, error, 'GET /api/messages'); }
});

app.get('/api/credentials', async (req, res) => {
  try {
    const data = await cachedGet('credentials', '/api/v1/UserCredentials');
    const results = data?.d?.results || [];
    res.json({ success: true, count: results.length, results });
  } catch (error) { handleError(res, error, 'GET /api/credentials'); }
});

app.get('/api/keystore', async (req, res) => {
  try {
    const data = await cachedGet('keystore', '/api/v1/KeystoreEntries');
    const results = data?.d?.results || [];
    res.json({ success: true, count: results.length, results });
  } catch (error) { handleError(res, error, 'GET /api/keystore'); }
});

app.get('/api/dashboard-stats', async (req, res) => {
  try {
    const [pkgRes, rtRes, msgRes] = await Promise.allSettled([
      cachedGet('packages', '/api/v1/IntegrationPackages'),
      cachedGet('runtime', '/api/v1/IntegrationRuntimeArtifacts'),
      cachedGet('messages_100__', '/api/v1/MessageProcessingLogs?$top=100&$orderby=LogStart desc'),
    ]);
    const packages = pkgRes.status === 'fulfilled' ? (pkgRes.value?.d?.results || []) : [];
    const runtime  = rtRes.status  === 'fulfilled' ? (rtRes.value?.d?.results  || []) : [];
    const messages = msgRes.status === 'fulfilled' ? (msgRes.value?.d?.results || []) : [];
    const completedMessages = messages.filter(m => m.Status === 'COMPLETED').length;
    const failedMessages    = messages.filter(m => m.Status === 'FAILED').length;
    res.json({
      success: true,
      totalPackages: packages.length,
      totalIflows:   runtime.length,
      activeFlows:   runtime.filter(r => r.Status === 'STARTED').length,
      successRate:   messages.length > 0 ? Math.round((completedMessages / messages.length) * 100) : 0,
      messagesToday: messages.length,
      failedMessages,
      activeAlerts:  failedMessages,
      runtimeStatus: {
        STARTED:   runtime.filter(r => r.Status === 'STARTED').length,
        COMPLETED: runtime.filter(r => r.Status === 'COMPLETED').length,
        FAILED:    runtime.filter(r => r.Status === 'FAILED').length,
        STOPPED:   runtime.filter(r => r.Status === 'STOPPED').length,
      },
    });
  } catch (error) { handleError(res, error, 'GET /api/dashboard-stats'); }
});

// ── AI helpers ──────────────────────────────────────────────────────────────
function noModel(res) {
  return res.status(503).json({ success: false, error: 'Gemini AI not configured. Add GEMINI_API_KEY in Settings.' });
}

function handleAiError(res, error) {
  const raw = error.message || '';
  if (raw.includes('429') || raw.includes('quota') || raw.includes('Quota')) {
    const retryMatch = raw.match(/retryDelay.*?(\d+)s/);
    const retrySec   = retryMatch ? retryMatch[1] : null;
    const model      = process.env.GEMINI_MODEL || 'gemini-2.0-flash-lite';
    return res.status(429).json({
      success: false,
      quotaError: true,
      model,
      error: `Gemini API quota exhausted for model "${model}" on this project's free tier (limit = 0). ` +
             `This means the Google Cloud project linked to your API key has used up its daily free quota. ` +
             (retrySec ? `Retry in ${retrySec}s, or ` : '') +
             `fix: create a fresh API key at https://aistudio.google.com/app/apikey (AI Studio keys get their own free quota).`,
      fix: 'Go to https://aistudio.google.com/app/apikey → Create API Key → paste it in Settings.',
      retryAfterSeconds: retrySec ? parseInt(retrySec) : null,
    });
  }
  console.error('[AI Error]', raw.slice(0, 200));
  return res.status(500).json({ success: false, error: 'AI request failed: ' + raw.slice(0, 300) });
}

app.post('/api/ai/generate', async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ success: false, error: 'prompt is required' });
    if (!model)  return noModel(res);
    const p = 'You are a senior SAP CPI architect with 10+ years of experience.\n\nUser Request: ' + prompt
      + '\n\n## 1. iFlow Architecture Overview\nDescribe the overall architecture and data flow.'
      + '\n\n## 2. Sender & Receiver Configuration\nDetail the sender and receiver adapter type, channel, and connection settings.'
      + '\n\n## 3. Adapter Configuration Details\nProvide specific adapter settings and connection properties.'
      + '\n\n## 4. Message Processing Steps\nList all required steps: content modifier, mapping, routing, splitter, aggregator, etc.'
      + '\n\n## 5. Security Configuration\nSpecify authentication, encryption, certificates, and credential aliases.'
      + '\n\n## 6. Error Handling & Exception Subprocess\nDefine error handling, dead-letter queues, alerting, and retry policies.'
      + '\n\n## 7. Deployment Checklist\nStep-by-step guide with pre-deployment validation.'
      + '\n\n## 8. Best Practices & Recommendations\nPerformance optimizations and pitfalls to avoid.';
    const result = await model.generateContent(p);
    res.json({ success: true, response: result.response.text() });
  } catch (error) { handleAiError(res, error); }
});

app.post('/api/ai/analyze', async (req, res) => {
  try {
    const { error: errorText } = req.body;
    if (!errorText) return res.status(400).json({ success: false, error: 'error field is required' });
    if (!model)    return noModel(res);
    const p = 'You are a SAP CPI expert specializing in error analysis.\n\nError:\n' + errorText
      + '\n\n## 1. Root Cause Analysis\nIdentify the exact root cause in the SAP CPI context.'
      + '\n\n## 2. Step-by-Step Fix\nNumbered actionable steps to resolve this error.'
      + '\n\n## 3. Prevention Strategy\nHow to prevent this in future iFlow designs.'
      + '\n\n## 4. Relevant SAP Notes & KBAs\nList relevant SAP Notes, KBAs, or documentation links.';
    const result = await model.generateContent(p);
    res.json({ success: true, response: result.response.text() });
  } catch (error) { handleAiError(res, error); }
});

app.post('/api/ai/optimize', async (req, res) => {
  try {
    const { code } = req.body;
    if (!code)   return res.status(400).json({ success: false, error: 'code field is required' });
    if (!model)  return noModel(res);
    const p = 'You are a SAP CPI performance expert.\n\nCode to Optimize:\n' + code
      + '\n\n## 1. Issues Found\nList all performance issues, anti-patterns, and bugs.'
      + '\n\n## 2. Optimized Solution\nProvide fully optimized production-ready code.'
      + '\n\n## 3. Performance Gain Analysis\nExplain expected improvements.'
      + '\n\n## 4. SAP CPI Best Practices Applied\nList each best practice applied.';
    const result = await model.generateContent(p);
    res.json({ success: true, response: result.response.text() });
  } catch (error) { handleAiError(res, error); }
});

app.post('/api/ai/chat', async (req, res) => {
  try {
    const { message, history = [] } = req.body;
    if (!message) return res.status(400).json({ success: false, error: 'message is required' });
    if (!model)   return noModel(res);
    const sys = 'You are an expert SAP CPI assistant helping integration developers and architects with iFlow design, adapter configuration, troubleshooting, mappings, security, and BTP ecosystem best practices. Be concise, practical, and always use SAP CPI terminology.';
    const hist = history.slice(-10).map(h => (h.role === 'user' ? 'User' : 'Assistant') + ': ' + h.content).join('\n\n');
    const full = sys + '\n\n' + (hist ? 'Previous conversation:\n' + hist + '\n\n' : '') + 'User: ' + message + '\n\nAssistant:';
    const result = await model.generateContent(full);
    res.json({ success: true, response: result.response.text() });
  } catch (error) { handleAiError(res, error); }
});

// ── Config read/write ────────────────────────────────────────────────────────
const ALLOWED_CONFIG_KEYS = ['CPI_BASE_URL', 'CPI_USERNAME', 'CPI_PASSWORD', 'GEMINI_API_KEY', 'GEMINI_MODEL', 'PORT', 'ALLOWED_ORIGINS'];

app.get('/api/config', (req, res) => {
  try {
    const raw = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, 'utf-8') : '';
    const parsed = parseEnv(raw);
    res.json({
      success: true,
      config: {
        CPI_BASE_URL:     parsed.CPI_BASE_URL     || process.env.CPI_BASE_URL     || '',
        CPI_USERNAME:     parsed.CPI_USERNAME     || process.env.CPI_USERNAME     || '',
        CPI_PASSWORD:     parsed.CPI_PASSWORD     || process.env.CPI_PASSWORD     || '',
        GEMINI_API_KEY:   parsed.GEMINI_API_KEY   || process.env.GEMINI_API_KEY   || '',
        GEMINI_MODEL:     parsed.GEMINI_MODEL     || process.env.GEMINI_MODEL     || 'gemini-1.5-flash',
        PORT:             parsed.PORT             || process.env.PORT             || '8080',
        ALLOWED_ORIGINS:  parsed.ALLOWED_ORIGINS  || process.env.ALLOWED_ORIGINS  || '',
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to read config: ' + err.message });
  }
});

app.post('/api/config', (req, res) => {
  try {
    const updates = req.body || {};
    const invalid = Object.keys(updates).filter(k => !ALLOWED_CONFIG_KEYS.includes(k));
    if (invalid.length) return res.status(400).json({ success: false, error: 'Unknown keys: ' + invalid.join(', ') });

    const raw = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, 'utf-8') : '';
    const current = parseEnv(raw);

    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined && value !== null) {
        current[key] = String(value);
        process.env[key] = String(value);
      }
    }

    fs.writeFileSync(ENV_PATH, serializeEnv(current), 'utf-8');
    reloadClients();

    res.json({ success: true, message: 'Configuration saved and reloaded.' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to save config: ' + err.message });
  }
});

app.use((req, res) => res.status(404).json({ success: false, error: 'Route not found' }));

app.use((err, req, res, _next) => {
  console.error('[Global Error]', err.stack);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

app.listen(PORT, () => console.log('checkmark SAP CPI AI Backend running on port ' + PORT));
