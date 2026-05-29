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

// ── Multi-provider AI layer ───────────────────────────────────────────────────
const AI_PROVIDERS = {
  gemini: {
    label: 'Google Gemini', free: true,
    models: ['gemini-2.0-flash-lite', 'gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-2.5-pro'],
    keyEnv: 'GEMINI_API_KEY', modelEnv: 'GEMINI_MODEL', defaultModel: 'gemini-2.0-flash-lite',
    keyHint: 'aistudio.google.com/app/apikey',
  },
  groq: {
    label: 'Groq', free: true,
    models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768', 'gemma2-9b-it'],
    keyEnv: 'GROQ_API_KEY', modelEnv: 'GROQ_MODEL', defaultModel: 'llama-3.3-70b-versatile',
    keyHint: 'console.groq.com/keys',
  },
  openrouter: {
    label: 'OpenRouter', free: true,
    models: ['meta-llama/llama-3.2-3b-instruct:free', 'mistralai/mistral-7b-instruct:free', 'microsoft/phi-3-mini-128k-instruct:free', 'google/gemma-2-9b-it:free', 'qwen/qwen-2-7b-instruct:free'],
    keyEnv: 'OPENROUTER_API_KEY', modelEnv: 'OPENROUTER_MODEL', defaultModel: 'meta-llama/llama-3.2-3b-instruct:free',
    keyHint: 'openrouter.ai/keys',
  },
  huggingface: {
    label: 'Hugging Face', free: true,
    models: ['meta-llama/Llama-3.2-3B-Instruct', 'mistralai/Mistral-7B-Instruct-v0.3', 'HuggingFaceH4/zephyr-7b-beta', 'microsoft/Phi-3-mini-4k-instruct'],
    keyEnv: 'HUGGINGFACE_API_KEY', modelEnv: 'HUGGINGFACE_MODEL', defaultModel: 'meta-llama/Llama-3.2-3B-Instruct',
    keyHint: 'huggingface.co/settings/tokens',
  },
  mistral: {
    label: 'Mistral AI', free: true,
    models: ['mistral-small-latest', 'open-mistral-7b', 'open-mixtral-8x7b', 'open-mistral-nemo'],
    keyEnv: 'MISTRAL_API_KEY', modelEnv: 'MISTRAL_MODEL', defaultModel: 'open-mistral-nemo',
    keyHint: 'console.mistral.ai/api-keys',
  },
  nvidia: {
    label: 'NVIDIA NIM', free: true,
    models: ['meta/llama-3.1-8b-instruct', 'meta/llama-3.3-70b-instruct', 'mistralai/mistral-7b-instruct-v0.3', 'microsoft/phi-3-mini-4k-instruct'],
    keyEnv: 'NVIDIA_API_KEY', modelEnv: 'NVIDIA_MODEL', defaultModel: 'meta/llama-3.1-8b-instruct',
    keyHint: 'build.nvidia.com — sign in → Get API Key',
  },
  cohere: {
    label: 'Cohere', free: true,
    models: ['command-r', 'command-r-plus', 'command-light', 'command'],
    keyEnv: 'COHERE_API_KEY', modelEnv: 'COHERE_MODEL', defaultModel: 'command-r',
    keyHint: 'dashboard.cohere.com/api-keys',
  },
  cloudflare: {
    label: 'Cloudflare Workers AI', free: true,
    models: ['@cf/meta/llama-3.1-8b-instruct', '@cf/mistral/mistral-7b-instruct-v0.1', '@cf/google/gemma-7b-it', '@cf/microsoft/phi-2'],
    keyEnv: 'CLOUDFLARE_API_KEY', modelEnv: 'CLOUDFLARE_MODEL', defaultModel: '@cf/meta/llama-3.1-8b-instruct',
    keyHint: 'dash.cloudflare.com → My Profile → API Tokens (also needs CLOUDFLARE_ACCOUNT_ID)',
    extraEnv: 'CLOUDFLARE_ACCOUNT_ID',
  },
  openai: {
    label: 'OpenAI (ChatGPT)', free: false,
    models: ['gpt-4o-mini', 'gpt-4o', 'gpt-3.5-turbo', 'gpt-4-turbo'],
    keyEnv: 'OPENAI_API_KEY', modelEnv: 'OPENAI_MODEL', defaultModel: 'gpt-4o-mini',
    keyHint: 'platform.openai.com/api-keys',
  },
  anthropic: {
    label: 'Anthropic Claude', free: false,
    models: ['claude-haiku-4-5', 'claude-sonnet-4-5', 'claude-opus-4-5'],
    keyEnv: 'ANTHROPIC_API_KEY', modelEnv: 'ANTHROPIC_MODEL', defaultModel: 'claude-haiku-4-5',
    keyHint: 'console.anthropic.com/settings/keys',
  },
  ollama: {
    label: 'Ollama (Local)', free: true,
    models: ['llama3.2', 'llama3.1', 'mistral', 'codellama', 'phi3', 'gemma2'],
    keyEnv: null, modelEnv: 'OLLAMA_MODEL', defaultModel: 'llama3.2',
    keyHint: 'No key needed — run: ollama serve',
  },
};

// ── Shared OpenAI-compatible helper ──────────────────────────────────────────
async function callOpenAICompatible(url, key, model, prompt, extraHeaders = {}) {
  const { data } = await axios.post(url, {
    model, messages: [{ role: 'user', content: prompt }], max_tokens: 4096, temperature: 0.7,
  }, { headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...extraHeaders }, timeout: 30000 });
  return data.choices[0].message.content;
}

async function callGemini(prompt) {
  if (!model) throw new Error('Gemini not configured. Set GEMINI_API_KEY in Settings.');
  const result = await model.generateContent(prompt);
  return result.response.text();
}

async function callOpenAI(prompt) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OpenAI not configured. Set OPENAI_API_KEY in Settings.');
  return callOpenAICompatible('https://api.openai.com/v1/chat/completions', key, process.env.OPENAI_MODEL || 'gpt-4o-mini', prompt);
}

async function callAnthropic(prompt) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('Anthropic not configured. Set ANTHROPIC_API_KEY in Settings.');
  const { data } = await axios.post('https://api.anthropic.com/v1/messages', {
    model: process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5', max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  }, { headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' }, timeout: 30000 });
  return data.content[0].text;
}

async function callGroq(prompt) {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error('Groq not configured. Set GROQ_API_KEY in Settings.');
  return callOpenAICompatible('https://api.groq.com/openai/v1/chat/completions', key, process.env.GROQ_MODEL || 'llama-3.3-70b-versatile', prompt);
}

async function callOpenRouter(prompt) {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error('OpenRouter not configured. Set OPENROUTER_API_KEY in Settings.');
  return callOpenAICompatible('https://openrouter.ai/api/v1/chat/completions', key, process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.2-3b-instruct:free', prompt, {
    'HTTP-Referer': 'https://sap-cpi-dashboard', 'X-Title': 'SAP CPI AI Control Center',
  });
}

async function callHuggingFace(prompt) {
  const key = process.env.HUGGINGFACE_API_KEY;
  if (!key) throw new Error('Hugging Face not configured. Set HUGGINGFACE_API_KEY in Settings.');
  return callOpenAICompatible('https://api-inference.huggingface.co/v1/chat/completions', key, process.env.HUGGINGFACE_MODEL || 'meta-llama/Llama-3.2-3B-Instruct', prompt);
}

async function callMistral(prompt) {
  const key = process.env.MISTRAL_API_KEY;
  if (!key) throw new Error('Mistral not configured. Set MISTRAL_API_KEY in Settings.');
  return callOpenAICompatible('https://api.mistral.ai/v1/chat/completions', key, process.env.MISTRAL_MODEL || 'open-mistral-nemo', prompt);
}

async function callNvidia(prompt) {
  const key = process.env.NVIDIA_API_KEY;
  if (!key) throw new Error('NVIDIA NIM not configured. Set NVIDIA_API_KEY in Settings.');
  return callOpenAICompatible('https://integrate.api.nvidia.com/v1/chat/completions', key, process.env.NVIDIA_MODEL || 'meta/llama-3.1-8b-instruct', prompt);
}

async function callCohere(prompt) {
  const key = process.env.COHERE_API_KEY;
  if (!key) throw new Error('Cohere not configured. Set COHERE_API_KEY in Settings.');
  const { data } = await axios.post('https://api.cohere.com/v2/chat', {
    model: process.env.COHERE_MODEL || 'command-r',
    messages: [{ role: 'user', content: prompt }],
  }, { headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, timeout: 30000 });
  return data.message?.content?.[0]?.text || data.text || '';
}

async function callCloudflare(prompt) {
  const key       = process.env.CLOUDFLARE_API_KEY;
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  if (!key || !accountId) throw new Error('Cloudflare not configured. Set CLOUDFLARE_API_KEY and CLOUDFLARE_ACCOUNT_ID in Settings.');
  const mdl = process.env.CLOUDFLARE_MODEL || '@cf/meta/llama-3.1-8b-instruct';
  const { data } = await axios.post(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${mdl}`, {
    messages: [{ role: 'user', content: prompt }],
  }, { headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, timeout: 30000 });
  return data.result?.response || '';
}

async function callOllama(prompt) {
  const base = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
  const { data } = await axios.post(`${base}/api/generate`, {
    model: process.env.OLLAMA_MODEL || 'llama3.2', prompt, stream: false,
  }, { timeout: 60000 });
  return data.response;
}

async function callAI(prompt) {
  const p = process.env.AI_PROVIDER || 'gemini';
  switch (p) {
    case 'gemini':      return callGemini(prompt);
    case 'openai':      return callOpenAI(prompt);
    case 'anthropic':   return callAnthropic(prompt);
    case 'groq':        return callGroq(prompt);
    case 'openrouter':  return callOpenRouter(prompt);
    case 'huggingface': return callHuggingFace(prompt);
    case 'mistral':     return callMistral(prompt);
    case 'nvidia':      return callNvidia(prompt);
    case 'cohere':      return callCohere(prompt);
    case 'cloudflare':  return callCloudflare(prompt);
    case 'ollama':      return callOllama(prompt);
    default: throw new Error(`Unknown provider: "${p}". Valid: gemini, groq, openrouter, huggingface, mistral, nvidia, cohere, cloudflare, openai, anthropic, ollama`);
  }
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

// ── AI helpers ────────────────────────────────────────────────────────────────
function handleAiError(res, error) {
  const raw   = error.message || '';
  const provider = process.env.AI_PROVIDER || 'gemini';
  if (raw.includes('429') || raw.includes('quota') || raw.includes('Quota')) {
    const retrySec = (raw.match(/retryDelay.*?(\d+)s/) || [])[1] || null;
    return res.status(429).json({
      success: false, quotaError: true, provider,
      error: `${AI_PROVIDERS[provider]?.label || provider} quota exhausted. ` +
             (retrySec ? `Retry in ${retrySec}s, or ` : '') +
             `switch to a different AI provider in Settings.`,
      retryAfterSeconds: retrySec ? parseInt(retrySec) : null,
    });
  }
  if (raw.includes('401') || raw.includes('Unauthorized') || raw.includes('invalid_api_key') || raw.includes('authentication')) {
    return res.status(401).json({ success: false, authError: true, provider,
      error: `Invalid API key for ${AI_PROVIDERS[provider]?.label || provider}. Check your key in Settings.` });
  }
  if (raw.includes('ECONNREFUSED') || raw.includes('ENOTFOUND')) {
    return res.status(503).json({ success: false, connectionError: true, provider,
      error: provider === 'ollama'
        ? 'Ollama is not running. Start it with: ollama serve'
        : `Cannot reach ${AI_PROVIDERS[provider]?.label || provider} API.` });
  }
  console.error('[AI Error]', raw.slice(0, 300));
  return res.status(500).json({ success: false, provider, error: raw.slice(0, 400) });
}

// GET /api/ai/providers — list all providers with status
app.get('/api/ai/providers', (req, res) => {
  const active = process.env.AI_PROVIDER || 'gemini';
  const result = Object.entries(AI_PROVIDERS).map(([id, p]) => {
    const keyConfigured = p.keyEnv ? !!process.env[p.keyEnv] : true; // ollama needs no key
    const activeModel   = process.env[p.modelEnv] || p.defaultModel;
    return { id, label: p.label, models: p.models, defaultModel: p.defaultModel,
             activeModel, keyHint: p.keyHint, keyConfigured, isActive: id === active };
  });
  res.json({ success: true, active, providers: result });
});

// POST /api/ai/test-provider — quick test of a specific provider
app.post('/api/ai/test-provider', async (req, res) => {
  const { provider } = req.body;
  if (!AI_PROVIDERS[provider]) return res.status(400).json({ success: false, error: 'Unknown provider' });
  const prev = process.env.AI_PROVIDER;
  process.env.AI_PROVIDER = provider;
  try {
    const response = await callAI('Reply with exactly: "SAP CPI AI Control Center connected."');
    process.env.AI_PROVIDER = prev;
    res.json({ success: true, provider, response: response.trim() });
  } catch (err) {
    process.env.AI_PROVIDER = prev;
    handleAiError(res, err);
  }
});

const PROMPTS = {
  generate: (p) => `You are a senior SAP CPI architect.\n\nRequest: ${p}\n\n## 1. iFlow Architecture\n## 2. Sender & Receiver\n## 3. Adapter Config\n## 4. Message Processing Steps\n## 5. Security\n## 6. Error Handling\n## 7. Deployment Checklist\n## 8. Best Practices`,
  analyze:  (e) => `You are a SAP CPI error analysis expert.\n\nError:\n${e}\n\n## 1. Root Cause\n## 2. Step-by-Step Fix\n## 3. Prevention\n## 4. SAP Notes & KBAs`,
  optimize: (c) => `You are a SAP CPI performance expert.\n\nCode:\n${c}\n\n## 1. Issues Found\n## 2. Optimized Solution\n## 3. Performance Gain\n## 4. Best Practices Applied`,
  chat:     (sys, hist, msg) => `${sys}\n\n${hist ? 'Conversation so far:\n' + hist + '\n\n' : ''}User: ${msg}\n\nAssistant:`,
};

const SYS_CHAT = 'You are an expert SAP CPI assistant. Help with iFlow design, adapters, troubleshooting, mappings, security, and BTP best practices. Be concise and practical.';

app.post('/api/ai/generate', async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ success: false, error: 'prompt is required' });
    const response = await callAI(PROMPTS.generate(prompt));
    res.json({ success: true, response, provider: process.env.AI_PROVIDER || 'gemini' });
  } catch (err) { handleAiError(res, err); }
});

app.post('/api/ai/analyze', async (req, res) => {
  try {
    const { error: e } = req.body;
    if (!e) return res.status(400).json({ success: false, error: 'error field is required' });
    const response = await callAI(PROMPTS.analyze(e));
    res.json({ success: true, response, provider: process.env.AI_PROVIDER || 'gemini' });
  } catch (err) { handleAiError(res, err); }
});

app.post('/api/ai/optimize', async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ success: false, error: 'code field is required' });
    const response = await callAI(PROMPTS.optimize(code));
    res.json({ success: true, response, provider: process.env.AI_PROVIDER || 'gemini' });
  } catch (err) { handleAiError(res, err); }
});

app.post('/api/ai/chat', async (req, res) => {
  try {
    const { message, history = [] } = req.body;
    if (!message) return res.status(400).json({ success: false, error: 'message is required' });
    const hist = history.slice(-10).map(h => `${h.role === 'user' ? 'User' : 'Assistant'}: ${h.content}`).join('\n\n');
    const response = await callAI(PROMPTS.chat(SYS_CHAT, hist, message));
    res.json({ success: true, response, provider: process.env.AI_PROVIDER || 'gemini' });
  } catch (err) { handleAiError(res, err); }
});

// ── Config read/write ────────────────────────────────────────────────────────
const ALLOWED_CONFIG_KEYS = [
  'CPI_BASE_URL', 'CPI_USERNAME', 'CPI_PASSWORD', 'PORT', 'ALLOWED_ORIGINS',
  'AI_PROVIDER',
  'GEMINI_API_KEY',      'GEMINI_MODEL',
  'OPENAI_API_KEY',      'OPENAI_MODEL',
  'ANTHROPIC_API_KEY',   'ANTHROPIC_MODEL',
  'GROQ_API_KEY',        'GROQ_MODEL',
  'OPENROUTER_API_KEY',  'OPENROUTER_MODEL',
  'HUGGINGFACE_API_KEY', 'HUGGINGFACE_MODEL',
  'MISTRAL_API_KEY',     'MISTRAL_MODEL',
  'NVIDIA_API_KEY',      'NVIDIA_MODEL',
  'COHERE_API_KEY',      'COHERE_MODEL',
  'CLOUDFLARE_API_KEY',  'CLOUDFLARE_ACCOUNT_ID', 'CLOUDFLARE_MODEL',
  'OLLAMA_BASE_URL',     'OLLAMA_MODEL',
];

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
        AI_PROVIDER:      parsed.AI_PROVIDER      || process.env.AI_PROVIDER      || 'gemini',
        GEMINI_API_KEY:   parsed.GEMINI_API_KEY   || process.env.GEMINI_API_KEY   || '',
        GEMINI_MODEL:     parsed.GEMINI_MODEL     || process.env.GEMINI_MODEL     || 'gemini-2.0-flash-lite',
        OPENAI_API_KEY:   parsed.OPENAI_API_KEY   || process.env.OPENAI_API_KEY   || '',
        OPENAI_MODEL:     parsed.OPENAI_MODEL     || process.env.OPENAI_MODEL     || 'gpt-4o-mini',
        ANTHROPIC_API_KEY:parsed.ANTHROPIC_API_KEY|| process.env.ANTHROPIC_API_KEY|| '',
        ANTHROPIC_MODEL:  parsed.ANTHROPIC_MODEL  || process.env.ANTHROPIC_MODEL  || 'claude-haiku-4-5',
        GROQ_API_KEY:          parsed.GROQ_API_KEY          || process.env.GROQ_API_KEY          || '',
        GROQ_MODEL:            parsed.GROQ_MODEL            || process.env.GROQ_MODEL            || 'llama-3.3-70b-versatile',
        OPENROUTER_API_KEY:    parsed.OPENROUTER_API_KEY    || process.env.OPENROUTER_API_KEY    || '',
        OPENROUTER_MODEL:      parsed.OPENROUTER_MODEL      || process.env.OPENROUTER_MODEL      || 'meta-llama/llama-3.2-3b-instruct:free',
        HUGGINGFACE_API_KEY:   parsed.HUGGINGFACE_API_KEY   || process.env.HUGGINGFACE_API_KEY   || '',
        HUGGINGFACE_MODEL:     parsed.HUGGINGFACE_MODEL     || process.env.HUGGINGFACE_MODEL     || 'meta-llama/Llama-3.2-3B-Instruct',
        MISTRAL_API_KEY:       parsed.MISTRAL_API_KEY       || process.env.MISTRAL_API_KEY       || '',
        MISTRAL_MODEL:         parsed.MISTRAL_MODEL         || process.env.MISTRAL_MODEL         || 'open-mistral-nemo',
        NVIDIA_API_KEY:        parsed.NVIDIA_API_KEY        || process.env.NVIDIA_API_KEY        || '',
        NVIDIA_MODEL:          parsed.NVIDIA_MODEL          || process.env.NVIDIA_MODEL          || 'meta/llama-3.1-8b-instruct',
        COHERE_API_KEY:        parsed.COHERE_API_KEY        || process.env.COHERE_API_KEY        || '',
        COHERE_MODEL:          parsed.COHERE_MODEL          || process.env.COHERE_MODEL          || 'command-r',
        CLOUDFLARE_API_KEY:    parsed.CLOUDFLARE_API_KEY    || process.env.CLOUDFLARE_API_KEY    || '',
        CLOUDFLARE_ACCOUNT_ID: parsed.CLOUDFLARE_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT_ID || '',
        CLOUDFLARE_MODEL:      parsed.CLOUDFLARE_MODEL      || process.env.CLOUDFLARE_MODEL      || '@cf/meta/llama-3.1-8b-instruct',
        OLLAMA_BASE_URL:  parsed.OLLAMA_BASE_URL  || process.env.OLLAMA_BASE_URL  || 'http://localhost:11434',
        OLLAMA_MODEL:     parsed.OLLAMA_MODEL     || process.env.OLLAMA_MODEL     || 'llama3.2',
        PORT:             parsed.PORT             || process.env.PORT             || '8081',
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
