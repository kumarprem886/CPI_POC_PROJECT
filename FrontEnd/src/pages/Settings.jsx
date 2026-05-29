import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Server, Cloud, Bot, CheckCircle2, XCircle, Loader2,
  RefreshCw, Eye, EyeOff, Save, AlertTriangle,
} from 'lucide-react';
import { getHealth, getConfig, saveConfig } from '../api';

const FIELDS = [
  {
    key: 'CPI_BASE_URL',
    label: 'CPI Base URL',
    placeholder: 'https://your-tenant.cfapps.us10-001.hana.ondemand.com',
    type: 'text',
    hint: 'Your SAP BTP CPI tenant URL (no trailing slash)',
    icon: Cloud,
  },
  {
    key: 'CPI_USERNAME',
    label: 'CPI Username',
    placeholder: 'admin@company.com',
    type: 'text',
    hint: 'SAP CPI service user email address',
    icon: Server,
  },
  {
    key: 'CPI_PASSWORD',
    label: 'CPI Password',
    placeholder: 'Enter password',
    type: 'password',
    hint: 'SAP CPI service user password',
    icon: Server,
  },
  {
    key: 'GEMINI_API_KEY',
    label: 'Gemini API Key',
    placeholder: 'AIzaSy...',
    type: 'password',
    hint: 'Get yours at aistudio.google.com/app/apikey',
    icon: Bot,
  },
  {
    key: 'PORT',
    label: 'Backend Port',
    placeholder: '8080',
    type: 'text',
    hint: 'Port the Express backend runs on (restart required after change)',
    icon: Server,
  },
  {
    key: 'ALLOWED_ORIGINS',
    label: 'Allowed Origins (CORS)',
    placeholder: 'http://localhost:5173',
    type: 'text',
    hint: 'Comma-separated list of allowed frontend origins',
    icon: Server,
  },
];

function StatusBadge({ status }) {
  if (status === 'connected')
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
        <CheckCircle2 size={11} /> Connected
      </span>
    );
  if (status === 'checking')
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-600 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
        <Loader2 size={11} className="animate-spin" /> Checking
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-600 bg-red-50 border border-red-200 px-2.5 py-1 rounded-full">
      <XCircle size={11} /> Disconnected
    </span>
  );
}

export default function Settings({ addToast }) {
  const [form, setForm] = useState({
    CPI_BASE_URL: '', CPI_USERNAME: '', CPI_PASSWORD: '',
    GEMINI_API_KEY: '', PORT: '8080', ALLOWED_ORIGINS: '',
  });
  const [showSecret, setShowSecret] = useState({ CPI_PASSWORD: false, GEMINI_API_KEY: false });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    getConfig()
      .then(({ data }) => {
        if (data.success) setForm(prev => ({ ...prev, ...data.config }));
      })
      .catch(() => addToast('Could not load config from backend', 'error'))
      .finally(() => setLoading(false));
  }, []);

  const handleChange = (key, value) => {
    setForm(prev => ({ ...prev, [key]: value }));
    setDirty(true);
    setTestResult(null);
  };

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const { data } = await saveConfig(form);
      if (data.success) {
        addToast('Configuration saved and reloaded!', 'success');
        setDirty(false);
      } else {
        addToast(data.error || 'Save failed', 'error');
      }
    } catch (err) {
      addToast(err.response?.data?.error || 'Failed to save configuration', 'error');
    } finally {
      setSaving(false);
    }
  }, [form, addToast]);

  const handleTest = useCallback(async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const { data } = await getHealth();
      setTestResult({ success: data.success, data });
      addToast(data.success ? 'Connection successful!' : 'CPI disconnected', data.success ? 'success' : 'error');
    } catch (err) {
      const msg = err.response?.data?.error || err.message;
      setTestResult({ success: false, error: msg });
      addToast('Connection test failed: ' + msg, 'error');
    } finally {
      setTesting(false);
    }
  }, [addToast]);

  const toggleSecret = (key) =>
    setShowSecret(prev => ({ ...prev, [key]: !prev[key] }));

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-6 max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Settings</h1>
          <p className="text-slate-500 mt-1">Update your CPI tenant, credentials, and API keys live — no server restart needed.</p>
        </div>
        {dirty && (
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 border border-amber-200 px-3 py-2 rounded-xl">
            <AlertTriangle size={13} /> Unsaved changes
          </motion.div>
        )}
      </div>

      {/* Config Form */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm divide-y divide-slate-100">
        {loading ? (
          <div className="p-6 space-y-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-3 bg-slate-100 rounded w-24 mb-2" />
                <div className="h-10 bg-slate-100 rounded-xl" />
              </div>
            ))}
          </div>
        ) : (
          FIELDS.map(({ key, label, placeholder, type, hint }) => {
            const isSecret = type === 'password';
            const revealed = showSecret[key];
            return (
              <div key={key} className="px-6 py-4">
                <label className="block text-sm font-semibold text-slate-700 mb-1">{label}</label>
                <div className="relative">
                  <input
                    type={isSecret && !revealed ? 'password' : 'text'}
                    value={form[key] || ''}
                    onChange={e => handleChange(key, e.target.value)}
                    placeholder={placeholder}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 pr-10 font-mono"
                  />
                  {isSecret && (
                    <button
                      type="button"
                      onClick={() => toggleSecret(key)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {revealed ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-1">{hint}</p>
              </div>
            );
          })
        )}

        {/* Save button */}
        <div className="px-6 py-4 bg-slate-50 rounded-b-2xl flex items-center justify-between">
          <p className="text-xs text-slate-400">Changes are written to <code className="bg-slate-200 px-1 py-0.5 rounded font-mono">BackEnd/.env</code> and hot-reloaded instantly.</p>
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className={`flex items-center gap-2 text-sm font-semibold text-white px-6 py-2.5 rounded-xl shadow-sm transition-all
              ${saving || loading ? 'bg-slate-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'}`}
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            {saving ? 'Saving…' : 'Save & Reload'}
          </button>
        </div>
      </div>

      {/* Connection Test */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-700 flex items-center gap-2">
            <RefreshCw size={16} className="text-indigo-500" />
            Test Connection
          </h2>
          <button
            onClick={handleTest}
            disabled={testing}
            className={`flex items-center gap-2 text-sm font-medium text-white px-5 py-2 rounded-xl shadow-sm transition-all
              ${testing ? 'bg-slate-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'}`}
          >
            {testing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            {testing ? 'Testing…' : 'Test Connection'}
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Backend', status: testResult ? 'connected' : 'checking', sub: 'Port ' + (form.PORT || '8080') },
            { label: 'SAP CPI Tenant', status: testResult ? (testResult.data?.cpi === 'connected' ? 'connected' : 'disconnected') : 'checking', sub: 'Cloud Integration' },
            { label: 'Gemini AI', status: testResult ? (testResult.data?.ai ? 'connected' : 'disconnected') : 'checking', sub: 'gemini-2.0-flash' },
          ].map(({ label, status, sub }) => (
            <div key={label} className="border border-slate-100 rounded-xl p-4 text-center">
              <div className="text-sm font-semibold text-slate-700 mb-2">{label}</div>
              <StatusBadge status={testResult ? status : 'checking'} />
              <div className="text-xs text-slate-400 mt-2">{sub}</div>
            </div>
          ))}
        </div>

        {testResult && !testResult.success && (
          <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-xl p-4 bg-red-50 border border-red-200 text-sm text-red-700 flex items-start gap-2">
            <XCircle size={15} className="mt-0.5 flex-shrink-0 text-red-500" />
            <div><strong>Connection failed:</strong> {testResult.error}</div>
          </motion.div>
        )}

        {testResult?.success && (
          <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-xl p-4 bg-emerald-50 border border-emerald-200 text-sm text-emerald-700 flex items-center gap-2">
            <CheckCircle2 size={15} className="text-emerald-500" />
            <span>All systems connected — CPI tenant reachable, AI configured.</span>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
