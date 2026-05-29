import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Server, Cloud, Bot, CheckCircle2, XCircle, Loader2,
  RefreshCw, Eye, EyeOff, Save, AlertTriangle, Zap,
  ChevronDown, ChevronUp, ExternalLink,
} from 'lucide-react';
import { getHealth, getConfig, saveConfig, getProviders, testProvider } from '../api';

// ─── Provider meta ────────────────────────────────────────────────────────────
const PROVIDER_META = {
  gemini:      { label:'Google Gemini',          emoji:'🔵', free:true,  color:'text-blue-600',    bg:'bg-blue-50',    activeBg:'bg-blue-600',    docsUrl:'https://aistudio.google.com/app/apikey',         desc:'Free tier via AI Studio. Overall best free option.' },
  groq:        { label:'Groq',                   emoji:'⚡', free:true,  color:'text-red-600',     bg:'bg-red-50',     activeBg:'bg-red-600',     docsUrl:'https://console.groq.com/keys',                  desc:'Ultra-fast LPU inference. Generous free tier.' },
  openrouter:  { label:'OpenRouter',             emoji:'🔀', free:true,  color:'text-violet-600',  bg:'bg-violet-50',  activeBg:'bg-violet-600',  docsUrl:'https://openrouter.ai/keys',                     desc:'Access many free models (Llama, Mistral, Phi) via one API.' },
  huggingface: { label:'Hugging Face',           emoji:'🤗', free:true,  color:'text-yellow-600',  bg:'bg-yellow-50',  activeBg:'bg-yellow-600',  docsUrl:'https://huggingface.co/settings/tokens',         desc:'Open-source models. Free inference API.' },
  mistral:     { label:'Mistral AI',             emoji:'💨', free:true,  color:'text-cyan-600',    bg:'bg-cyan-50',    activeBg:'bg-cyan-600',    docsUrl:'https://console.mistral.ai/api-keys',            desc:'Best for coding and reasoning. Free tier available.' },
  nvidia:      { label:'NVIDIA NIM',             emoji:'🟩', free:true,  color:'text-green-700',   bg:'bg-green-50',   activeBg:'bg-green-700',   docsUrl:'https://build.nvidia.com',                       desc:'Strong open models on NVIDIA hardware. Free tier.' },
  cohere:      { label:'Cohere',                 emoji:'🔷', free:true,  color:'text-sky-600',     bg:'bg-sky-50',     activeBg:'bg-sky-600',     docsUrl:'https://dashboard.cohere.com/api-keys',          desc:'Great for embeddings and RAG. Free tier.' },
  cloudflare:  { label:'Cloudflare Workers AI',  emoji:'🌥️', free:true,  color:'text-orange-600',  bg:'bg-orange-50',  activeBg:'bg-orange-600',  docsUrl:'https://dash.cloudflare.com',                    desc:'Serverless AI on Cloudflare edge. Free tier.' },
  openai:      { label:'OpenAI (ChatGPT)',        emoji:'🟢', free:false, color:'text-emerald-600', bg:'bg-emerald-50', activeBg:'bg-emerald-600', docsUrl:'https://platform.openai.com/api-keys',           desc:'GPT-4o and GPT-4o-mini. Pay-as-you-go.' },
  anthropic:   { label:'Anthropic Claude',        emoji:'🟠', free:false, color:'text-orange-600',  bg:'bg-orange-50',  activeBg:'bg-orange-600',  docsUrl:'https://console.anthropic.com/settings/keys',   desc:'Claude Haiku, Sonnet, Opus. Excellent reasoning.' },
  ollama:      { label:'Ollama (Local)',           emoji:'🟣', free:true,  color:'text-purple-600',  bg:'bg-purple-50',  activeBg:'bg-purple-600',  docsUrl:'https://ollama.com',                             desc:'Free forever, runs locally. No key needed. Privacy-first.' },
};

const CPI_FIELDS = [
  { key:'CPI_BASE_URL',    label:'CPI Base URL',     type:'text',     placeholder:'https://your-tenant.cfapps.us10-001.hana.ondemand.com', hint:'Your SAP BTP CPI tenant URL' },
  { key:'CPI_USERNAME',    label:'CPI Username',     type:'text',     placeholder:'admin@company.com', hint:'SAP CPI service user email' },
  { key:'CPI_PASSWORD',    label:'CPI Password',     type:'password', placeholder:'Enter password',     hint:'SAP CPI service user password' },
  { key:'PORT',            label:'Backend Port',     type:'text',     placeholder:'8081',               hint:'Restart required after changing' },
  { key:'ALLOWED_ORIGINS', label:'Allowed Origins',  type:'text',     placeholder:'http://localhost:5174', hint:'Comma-separated CORS origins' },
];

const MODEL_KEYS = {
  gemini:'GEMINI_MODEL', openai:'OPENAI_MODEL', anthropic:'ANTHROPIC_MODEL',
  groq:'GROQ_MODEL', openrouter:'OPENROUTER_MODEL', huggingface:'HUGGINGFACE_MODEL',
  mistral:'MISTRAL_MODEL', nvidia:'NVIDIA_MODEL', cohere:'COHERE_MODEL',
  cloudflare:'CLOUDFLARE_MODEL', ollama:'OLLAMA_MODEL',
};
const KEY_KEYS = {
  gemini:'GEMINI_API_KEY', openai:'OPENAI_API_KEY', anthropic:'ANTHROPIC_API_KEY',
  groq:'GROQ_API_KEY', openrouter:'OPENROUTER_API_KEY', huggingface:'HUGGINGFACE_API_KEY',
  mistral:'MISTRAL_API_KEY', nvidia:'NVIDIA_API_KEY', cohere:'COHERE_API_KEY',
  cloudflare:'CLOUDFLARE_API_KEY',
};

function StatusBadge({ ok, label }) {
  if (ok === null) return <span className="inline-flex items-center gap-1 text-xs text-slate-400"><Loader2 size={11} className="animate-spin" />Checking</span>;
  return ok
    ? <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full"><CheckCircle2 size={11}/>{label || 'Connected'}</span>
    : <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full"><XCircle size={11}/>{label || 'Disconnected'}</span>;
}

// ─── AI Provider Card ─────────────────────────────────────────────────────────
function ProviderCard({ id, providerData, config, onSave, addToast, isActive }) {
  const meta      = PROVIDER_META[id];
  const [open, setOpen]       = useState(false);
  const [apiKey, setApiKey]   = useState(config[KEY_KEYS[id]] || '');
  const [model, setModel]     = useState(config[MODEL_KEYS[id]] || providerData?.defaultModel || '');
  const [baseUrl, setBaseUrl] = useState(config.OLLAMA_BASE_URL || 'http://localhost:11434');
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [saving, setSaving]   = useState(false);

  const configured = id === 'ollama' ? true : !!apiKey;

  const [cfAccountId, setCfAccountId] = useState(config.CLOUDFLARE_ACCOUNT_ID || '');

  const buildUpdates = (withProvider = false) => {
    const updates = withProvider ? { AI_PROVIDER: id } : {};
    if (KEY_KEYS[id] && apiKey) updates[KEY_KEYS[id]] = apiKey;
    if (MODEL_KEYS[id] && model) updates[MODEL_KEYS[id]] = model;
    if (id === 'ollama' && baseUrl) updates.OLLAMA_BASE_URL = baseUrl;
    if (id === 'cloudflare' && cfAccountId) updates.CLOUDFLARE_ACCOUNT_ID = cfAccountId;
    return updates;
  };

  const handleSetActive = async () => {
    setSaving(true);
    await onSave(buildUpdates(true));
    setSaving(false);
  };

  const handleSaveKey = async () => {
    setSaving(true);
    await onSave(buildUpdates(false));
    setSaving(false);
    setTestResult(null);
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const { data } = await testProvider(id);
      setTestResult({ ok: true, msg: data.response });
      addToast(`${meta.label} is working!`, 'success');
    } catch (err) {
      const msg = err.response?.data?.error || err.message;
      setTestResult({ ok: false, msg });
      addToast(`${meta.label} test failed`, 'error');
    } finally { setTesting(false); }
  };

  return (
    <div className={`border rounded-2xl overflow-hidden transition-all ${isActive ? 'border-indigo-300 shadow-md' : 'border-slate-200'}`}>
      {/* Header */}
      <div className={`flex items-center gap-3 p-4 cursor-pointer hover:bg-slate-50 transition-colors ${isActive ? 'bg-indigo-50/50' : 'bg-white'}`}
        onClick={() => setOpen(o => !o)}>
        <div className={`w-10 h-10 rounded-xl ${meta.bg} flex items-center justify-center text-lg flex-shrink-0`}>
          {meta.emoji}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-sm font-bold ${meta.color}`}>{meta.label}</span>
            {isActive && <span className="text-xs bg-indigo-600 text-white px-2 py-0.5 rounded-full font-medium flex items-center gap-1"><Zap size={9}/> Active</span>}
            {meta.free && <span className="text-xs bg-green-100 text-green-700 border border-green-200 px-1.5 py-0.5 rounded font-semibold">FREE</span>}
            {configured && !isActive && <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">Configured</span>}
          </div>
          <div className="text-xs text-slate-400 mt-0.5 truncate">{meta.desc}</div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {!isActive && configured && (
            <button onClick={e => { e.stopPropagation(); handleSetActive(); }}
              disabled={saving}
              className="text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1">
              {saving ? <Loader2 size={11} className="animate-spin"/> : <Zap size={11}/>} Use this
            </button>
          )}
          {open ? <ChevronUp size={16} className="text-slate-400"/> : <ChevronDown size={16} className="text-slate-400"/>}
        </div>
      </div>

      {/* Expanded config */}
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height:0, opacity:0 }} animate={{ height:'auto', opacity:1 }}
            exit={{ height:0, opacity:0 }} transition={{ duration:0.2 }}
            className="overflow-hidden border-t border-slate-100 bg-slate-50/50">
            <div className="p-4 space-y-3">

              {/* API key (not Ollama) */}
              {id !== 'ollama' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                    API Key
                    <a href={meta.docsUrl} target="_blank" rel="noreferrer"
                      className="ml-2 text-indigo-500 hover:underline font-normal inline-flex items-center gap-0.5">
                      Get key <ExternalLink size={10}/>
                    </a>
                  </label>
                  <div className="relative">
                    <input type={showKey ? 'text' : 'password'} value={apiKey}
                      onChange={e => setApiKey(e.target.value)}
                      placeholder="Paste your API key here"
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 pr-9 text-xs font-mono text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                    <button type="button" onClick={() => setShowKey(v => !v)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      {showKey ? <EyeOff size={13}/> : <Eye size={13}/>}
                    </button>
                  </div>
                </div>
              )}

              {/* Cloudflare Account ID */}
              {id === 'cloudflare' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Account ID <span className="text-red-500">*</span></label>
                  <input value={cfAccountId} onChange={e => setCfAccountId(e.target.value)}
                    placeholder="e.g. abc123def456..."
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-mono text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                  <p className="text-xs text-slate-400 mt-1">Found at dash.cloudflare.com → select any domain → right sidebar</p>
                </div>
              )}

              {/* Ollama URL */}
              {id === 'ollama' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Ollama Base URL</label>
                  <input value={baseUrl} onChange={e => setBaseUrl(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-mono text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                  <p className="text-xs text-slate-400 mt-1">Start Ollama: <code className="bg-slate-200 px-1 rounded font-mono">ollama serve</code> · Pull model: <code className="bg-slate-200 px-1 rounded font-mono">ollama pull {model}</code></p>
                </div>
              )}

              {/* Model selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Model</label>
                <select value={model} onChange={e => setModel(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300">
                  {(providerData?.models || []).map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>

              {/* Test result */}
              {testResult && (
                <div className={`text-xs rounded-xl px-3 py-2.5 flex items-start gap-2 ${testResult.ok ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
                  {testResult.ok ? <CheckCircle2 size={13} className="mt-0.5 flex-shrink-0"/> : <XCircle size={13} className="mt-0.5 flex-shrink-0"/>}
                  <span className="leading-relaxed">{testResult.msg}</span>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-1">
                <button onClick={handleSaveKey} disabled={saving}
                  className="flex items-center gap-1.5 text-xs font-semibold text-white bg-slate-700 hover:bg-slate-800 px-3 py-2 rounded-xl transition-colors disabled:opacity-50">
                  {saving ? <Loader2 size={12} className="animate-spin"/> : <Save size={12}/>} Save
                </button>
                <button onClick={handleTest} disabled={testing}
                  className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-3 py-2 rounded-xl transition-colors disabled:opacity-50">
                  {testing ? <Loader2 size={12} className="animate-spin"/> : <RefreshCw size={12}/>} Test
                </button>
                {!isActive && (
                  <button onClick={handleSetActive} disabled={saving}
                    className={`flex items-center gap-1.5 text-xs font-semibold text-white ${meta.activeBg} hover:opacity-90 px-3 py-2 rounded-xl transition-colors disabled:opacity-50 ml-auto`}>
                    {saving ? <Loader2 size={12} className="animate-spin"/> : <Zap size={12}/>} Set as Active
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main Settings page ───────────────────────────────────────────────────────
export default function Settings({ addToast }) {
  const [cpiForm, setCpiForm]   = useState({ CPI_BASE_URL:'', CPI_USERNAME:'', CPI_PASSWORD:'', PORT:'8081', ALLOWED_ORIGINS:'' });
  const [showSecrets, setShowSecrets] = useState({});
  const [configLoading, setConfigLoading] = useState(true);
  const [cpiSaving, setCpiSaving] = useState(false);
  const [cpiDirty, setCpiDirty]   = useState(false);
  const [testing, setTesting]     = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [providers, setProviders] = useState([]);
  const [activeProvider, setActiveProvider] = useState('gemini');
  const [fullConfig, setFullConfig] = useState({});

  const loadAll = useCallback(async () => {
    setConfigLoading(true);
    try {
      const [cfgRes, prvRes] = await Promise.all([getConfig(), getProviders()]);
      const cfg = cfgRes.data.config;
      setFullConfig(cfg);
      setCpiForm({ CPI_BASE_URL: cfg.CPI_BASE_URL||'', CPI_USERNAME: cfg.CPI_USERNAME||'', CPI_PASSWORD: cfg.CPI_PASSWORD||'', PORT: cfg.PORT||'8081', ALLOWED_ORIGINS: cfg.ALLOWED_ORIGINS||'' });
      setProviders(prvRes.data.providers || []);
      setActiveProvider(prvRes.data.active || 'gemini');
    } catch { addToast('Failed to load settings', 'error'); }
    finally { setConfigLoading(false); }
  }, [addToast]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const handleCpiSave = async () => {
    setCpiSaving(true);
    try {
      await saveConfig(cpiForm);
      addToast('CPI settings saved!', 'success');
      setCpiDirty(false);
    } catch { addToast('Failed to save', 'error'); }
    finally { setCpiSaving(false); }
  };

  const handleProviderSave = async (updates) => {
    try {
      await saveConfig(updates);
      if (updates.AI_PROVIDER) setActiveProvider(updates.AI_PROVIDER);
      await loadAll();
      addToast('AI provider updated!', 'success');
    } catch { addToast('Failed to save provider', 'error'); }
  };

  const handleTest = async () => {
    setTesting(true); setTestResult(null);
    try {
      const { data } = await getHealth();
      setTestResult({ ok: data.success, data });
      addToast(data.success ? 'Connection successful!' : 'CPI disconnected', data.success ? 'success' : 'error');
    } catch (err) {
      setTestResult({ ok: false, error: err.response?.data?.error || err.message });
      addToast('Connection failed', 'error');
    } finally { setTesting(false); }
  };

  return (
    <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} className="p-6 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-3xl font-bold text-slate-800">Settings</h1>
        <p className="text-slate-500 mt-1">Configure CPI connection, AI providers, and system preferences.</p>
      </div>

      {/* ── AI Providers ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-slate-800 flex items-center gap-2"><Bot size={18} className="text-indigo-500"/> AI Providers</h2>
            <p className="text-xs text-slate-400 mt-0.5">Choose and configure which AI powers the assistant, iFlow generator, and analysis tools.</p>
          </div>
          {activeProvider && PROVIDER_META[activeProvider] && (
            <span className={`text-xs font-semibold px-3 py-1.5 rounded-full text-white ${PROVIDER_META[activeProvider].activeBg}`}>
              {PROVIDER_META[activeProvider].emoji} {PROVIDER_META[activeProvider].label}
            </span>
          )}
        </div>
        <div className="p-4 space-y-3">
          {configLoading ? (
            [...Array(4)].map((_,i) => <div key={i} className="h-16 bg-slate-100 rounded-2xl animate-pulse"/>)
          ) : (
            Object.keys(PROVIDER_META).map(id => (
              <ProviderCard key={id} id={id}
                providerData={providers.find(p => p.id === id)}
                config={fullConfig}
                onSave={handleProviderSave}
                addToast={addToast}
                isActive={activeProvider === id} />
            ))
          )}
        </div>
      </div>

      {/* ── CPI Connection ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-bold text-slate-800 flex items-center gap-2"><Cloud size={18} className="text-blue-500"/> SAP CPI Connection</h2>
          {cpiDirty && <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-1 rounded-full flex items-center gap-1"><AlertTriangle size={11}/> Unsaved</span>}
        </div>

        {configLoading ? (
          <div className="p-6 space-y-3">{[...Array(3)].map((_,i) => <div key={i} className="h-10 bg-slate-100 rounded-xl animate-pulse"/>)}</div>
        ) : (
          <>
            <div className="divide-y divide-slate-50">
              {CPI_FIELDS.map(({ key, label, type, placeholder, hint }) => {
                const isSecret = type === 'password';
                const shown = showSecrets[key];
                return (
                  <div key={key} className="px-6 py-4">
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">{label}</label>
                    <div className="relative">
                      <input type={isSecret && !shown ? 'password' : 'text'}
                        value={cpiForm[key] || ''} placeholder={placeholder}
                        onChange={e => { setCpiForm(p => ({ ...p, [key]: e.target.value })); setCpiDirty(true); setTestResult(null); }}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-mono text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 pr-10" />
                      {isSecret && (
                        <button type="button" onClick={() => setShowSecrets(p => ({ ...p, [key]: !p[key] }))}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                          {shown ? <EyeOff size={15}/> : <Eye size={15}/>}
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-1">{hint}</p>
                  </div>
                );
              })}
            </div>
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <p className="text-xs text-slate-400">Changes write to <code className="bg-slate-200 px-1 rounded font-mono">BackEnd/.env</code> and reload instantly.</p>
              <button onClick={handleCpiSave} disabled={cpiSaving}
                className="flex items-center gap-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 px-5 py-2.5 rounded-xl disabled:opacity-50 transition-colors">
                {cpiSaving ? <Loader2 size={14} className="animate-spin"/> : <Save size={14}/>}
                {cpiSaving ? 'Saving…' : 'Save & Reload'}
              </button>
            </div>
          </>
        )}
      </div>

      {/* ── Connection Test ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-slate-800 flex items-center gap-2"><RefreshCw size={16} className="text-indigo-500"/> Connection Test</h2>
          <button onClick={handleTest} disabled={testing}
            className={`flex items-center gap-2 text-sm font-medium text-white px-5 py-2 rounded-xl transition-colors ${testing ? 'bg-slate-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'}`}>
            {testing ? <Loader2 size={14} className="animate-spin"/> : <RefreshCw size={14}/>}
            {testing ? 'Testing…' : 'Test CPI Connection'}
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {[
            { label:'Backend API',    status: testResult ? 'connected' : null, sub:'Port ' + (cpiForm.PORT||'8081') },
            { label:'SAP CPI Tenant', status: testResult ? (testResult.ok && testResult.data?.cpi==='connected' ? 'connected' : 'error') : null, sub:'Cloud Integration' },
            { label:'AI Provider',    status: testResult ? (testResult.ok ? 'connected' : null) : null, sub: PROVIDER_META[activeProvider]?.label || activeProvider },
          ].map(({ label, status, sub }) => (
            <div key={label} className="border border-slate-100 rounded-xl p-4 text-center">
              <div className="text-xs font-semibold text-slate-700 mb-2">{label}</div>
              <StatusBadge ok={testResult ? status === 'connected' : null} />
              <div className="text-xs text-slate-400 mt-2">{sub}</div>
            </div>
          ))}
        </div>

        {testResult && !testResult.ok && (
          <motion.div initial={{ opacity:0, y:4 }} animate={{ opacity:1, y:0 }}
            className="rounded-xl p-4 bg-red-50 border border-red-200 text-sm text-red-700 flex items-start gap-2">
            <XCircle size={15} className="mt-0.5 flex-shrink-0 text-red-500"/>
            <span>{testResult.error || 'Connection failed'}</span>
          </motion.div>
        )}
        {testResult?.ok && (
          <motion.div initial={{ opacity:0, y:4 }} animate={{ opacity:1, y:0 }}
            className="rounded-xl p-4 bg-emerald-50 border border-emerald-200 text-sm text-emerald-700 flex items-center gap-2">
            <CheckCircle2 size={15} className="text-emerald-500"/>
            All systems connected.
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
