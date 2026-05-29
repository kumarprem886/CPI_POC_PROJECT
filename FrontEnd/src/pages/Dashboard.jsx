import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DatabaseZap, ShieldCheck, Mail, Bell, Sparkles,
  Brain, Rocket, Activity, Wrench, ArrowRight,
  Workflow, Map, TrendingUp, FilePlus, Upload,
  KeyRound, ScrollText, X, Loader2, Copy, Check,
  RefreshCw,
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import { getDashboardStats, getMessages, aiGenerate, aiAnalyze } from '../api';

const LINE_DATA = [
  { day:'May 13', success:12400, failed:820,  retry:340 },
  { day:'May 14', success:15200, failed:1100, retry:560 },
  { day:'May 15', success:13800, failed:690,  retry:420 },
  { day:'May 16', success:18600, failed:1400, retry:780 },
  { day:'May 17', success:20100, failed:960,  retry:510 },
  { day:'May 18', success:17400, failed:1250, retry:640 },
  { day:'May 19', success:22500, failed:1050, retry:490 },
];

const STATUS_COLORS = { Running:'#4f46e5', Success:'#22c55e', Failed:'#ef4444', Deployed:'#64748b', STARTED:'#4f46e5', COMPLETED:'#22c55e', FAILED:'#ef4444', STOPPED:'#64748b' };

const SEVERITY_BADGE = { Critical:'bg-red-100 text-red-700 border border-red-200', Warning:'bg-amber-100 text-amber-700 border border-amber-200', Info:'bg-blue-100 text-blue-700 border border-blue-200' };
const SEVERITY_DOT   = { Critical:'bg-red-500', Warning:'bg-amber-500', Info:'bg-blue-500' };

const FEATURE_CARDS = [
  { title:'AI Mapping Generator',        desc:'Generate intelligent mappings using AI',   icon:Brain,      bg:'bg-purple-50', iconColor:'text-purple-600', page:'ai',         aiMode:'optimize' },
  { title:'AI iFlow Deployment',         desc:'Deploy iFlows with AI assistance',          icon:Rocket,     bg:'bg-blue-50',   iconColor:'text-blue-600',   page:'iflow',      aiMode:null       },
  { title:'Security Material Analyzer',  desc:'Analyze security materials usage',          icon:ShieldCheck,bg:'bg-green-50',  iconColor:'text-green-600',  page:'security',   aiMode:null       },
  { title:'Runtime Monitoring',          desc:'Real-time integration monitoring & alerts', icon:Activity,   bg:'bg-orange-50', iconColor:'text-orange-600', page:'monitoring', aiMode:null       },
  { title:'Error Analysis & Auto Fix',   desc:'AI-powered error analysis and resolution',  icon:Wrench,     bg:'bg-red-50',    iconColor:'text-red-600',    page:'ai',         aiMode:'analyze'  },
];

const QUICK_ACTIONS = [
  { icon:FilePlus,   label:'Create iFlow',             sub:'From Template',  page:'iflow'     },
  { icon:Upload,     label:'Import iFlow',             sub:'Upload XML',     page:'iflow'     },
  { icon:Rocket,     label:'Deploy Flow',              sub:'To Environment', page:'iflow'     },
  { icon:KeyRound,   label:'Create Security Material', sub:'New Credential', page:'security'  },
  { icon:ScrollText, label:'View MPL Logs',            sub:'Message Logs',   page:'monitoring'},
];

// AI chip → prompt template
const AI_CHIPS = [
  { label:'Create iFlow',         icon:Workflow,    prompt:'Create a production-ready SAP CPI iFlow for enterprise integration with full security and error handling.' },
  { label:'Fix Error',            icon:Wrench,      prompt:'',   mode:'analyze' },
  { label:'Generate Mapping',     icon:Map,         prompt:'Generate an XSLT or Groovy mapping script for SAP CPI with proper field transformations and namespace handling.' },
  { label:'Security Check',       icon:ShieldCheck, prompt:'Analyze and recommend security best practices for SAP CPI: OAuth2, certificate management, and credential stores.' },
  { label:'Performance Analysis', icon:TrendingUp,  prompt:'Analyze and optimize SAP CPI iFlow performance: message processing, splitter settings, and adapter tuning.' },
];

function KpiCard({ title, value, icon: Icon, iconBg, iconColor, trend, trendColor, delay }) {
  return (
    <motion.div initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} transition={{ delay, duration:0.35 }}
      whileHover={{ y:-3 }} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs text-slate-500 font-medium mb-1">{title}</div>
          <div className="text-2xl font-bold text-slate-800">{value ?? '—'}</div>
          {trend && <div className={`text-xs mt-1.5 font-medium ${trendColor}`}>{trend}</div>}
        </div>
        <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center flex-shrink-0`}>
          <Icon size={20} className={iconColor} />
        </div>
      </div>
    </motion.div>
  );
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };
  return (
    <button onClick={copy} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors">
      {copied ? <Check size={13} className="text-green-500" /> : <Copy size={13} />}
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}

export default function Dashboard({ addToast, navigate }) {
  const [stats, setStats]               = useState(null);
  const [loading, setLoading]           = useState(true);
  const [pieData, setPieData]           = useState([]);
  const [alerts, setAlerts]             = useState([]);
  const [alertsLoading, setAlertsLoading] = useState(true);
  const [aiPrompt, setAiPrompt]         = useState('');
  const [aiMode, setAiMode]             = useState('generate'); // 'generate' | 'analyze'
  const [aiResult, setAiResult]         = useState('');
  const [aiLoading, setAiLoading]       = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(true);
  const aiResultRef = useRef(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await getDashboardStats();
      setStats(data);
      const rs = data?.runtimeStatus || {};
      const pie = Object.entries(rs).filter(([,v]) => v > 0).map(([name, value]) => ({ name, value }));
      setPieData(pie.length > 0 ? pie : [
        { name:'Running', value:12 }, { name:'Success', value:45 },
        { name:'Failed',  value:5  }, { name:'Deployed', value:8 },
      ]);
    } catch (err) {
      addToast?.('Failed to load stats: ' + (err.response?.data?.error || err.message), 'error');
      setPieData([{ name:'Running',value:12 },{ name:'Success',value:45 },{ name:'Failed',value:5 },{ name:'Deployed',value:8 }]);
    } finally { setLoading(false); }
  }, [addToast]);

  const fetchAlerts = useCallback(async () => {
    setAlertsLoading(true);
    try {
      const { data } = await getMessages({ status: 'FAILED', top: 4 });
      if (data.results?.length > 0) {
        setAlerts(data.results.map(m => ({
          iflow: m.IntegrationFlowName || 'Unknown iFlow',
          time: m.LogStart ? timeAgo(m.LogStart) : '—',
          severity: 'Critical',
        })));
      } else {
        setAlerts(STATIC_ALERTS);
      }
    } catch {
      setAlerts(STATIC_ALERTS);
    } finally { setAlertsLoading(false); }
  }, []);

  useEffect(() => { fetchStats(); fetchAlerts(); }, [fetchStats, fetchAlerts]);

  const handleGenerate = useCallback(async () => {
    if (!aiPrompt.trim()) { addToast?.('Please enter a prompt first', 'error'); return; }
    setAiLoading(true);
    setAiResult('');
    try {
      const { data } = aiMode === 'analyze'
        ? await aiAnalyze(aiPrompt)
        : await aiGenerate(aiPrompt);
      setAiResult(data.response || 'No response.');
      setTimeout(() => aiResultRef.current?.scrollIntoView({ behavior:'smooth', block:'nearest' }), 100);
    } catch (err) {
      const data = err.response?.data;
      if (data?.quotaError) {
        setAiResult(
          `⚠️ Gemini API Quota Exhausted\n\n` +
          `The Google Cloud project behind your API key has used up its free tier quota (limit = 0) for all models.\n\n` +
          `Fix:\n` +
          `1. Go to https://aistudio.google.com/app/apikey\n` +
          `2. Click "Create API Key" (pick or create a NEW project)\n` +
          `3. Copy the key\n` +
          `4. Open Settings → paste it in "Gemini API Key" → Save & Reload\n\n` +
          (data.retryAfterSeconds ? `Or wait ${data.retryAfterSeconds}s for the per-minute limit to reset.\n` : '')
        );
        addToast?.('Gemini quota exhausted — see AI panel for fix steps', 'error');
      } else {
        const msg = data?.error || 'AI request failed';
        setAiResult('⚠️ ' + msg);
        addToast?.(msg, 'error');
      }
    } finally { setAiLoading(false); }
  }, [aiPrompt, aiMode, addToast]);

  const handleChipClick = (chip) => {
    if (chip.mode === 'analyze') {
      setAiMode('analyze');
      setAiPrompt('');
    } else {
      setAiMode('generate');
      setAiPrompt(chip.prompt);
    }
  };

  const handleFeatureCard = (card) => {
    navigate?.(card.page);
  };

  const totalPie = pieData.reduce((acc, d) => acc + d.value, 0);

  return (
    <div className="p-6 space-y-6">

      {/* KPI Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard title="Total iFlows"    value={loading ? '…' : stats?.totalIflows   ?? '—'} icon={DatabaseZap} iconBg="bg-indigo-50" iconColor="text-indigo-600" trend="↑ 12.5% vs last 30 days" trendColor="text-green-600" delay={0}    />
        <KpiCard title="Success Rate"    value={loading ? '…' : stats?.successRate != null ? `${stats.successRate}%` : '—'} icon={ShieldCheck} iconBg="bg-green-50" iconColor="text-green-600" trend="↑ 2.3% vs last 30 days" trendColor="text-green-600" delay={0.05} />
        <KpiCard title="Messages Today"  value={loading ? '…' : stats?.messagesToday ?? '—'} icon={Mail}        iconBg="bg-blue-50"   iconColor="text-blue-600"   trend="↑ 18.2% vs yesterday"   trendColor="text-green-600" delay={0.1}  />
        <KpiCard title="Active Alerts"   value={loading ? '…' : stats?.activeAlerts  ?? '—'} icon={Bell}        iconBg="bg-red-50"    iconColor="text-red-600"    trend="↓ 3 vs yesterday"       trendColor="text-red-500"   delay={0.15} />
      </div>

      {/* AI Command Center */}
      <motion.div initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.2 }}
        className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-start gap-6">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles size={20} className="text-indigo-600" />
              <span className="text-xl font-bold text-slate-800">AI Command Center</span>
              {aiMode === 'analyze' && (
                <span className="text-xs bg-amber-100 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-medium">Analyze Mode</span>
              )}
            </div>
            <p className="text-sm text-slate-500 mb-4">
              {aiMode === 'analyze' ? 'Paste an error message to get root cause analysis and fix steps' : 'Describe your integration requirement in natural language'}
            </p>
            <div className="flex gap-3">
              <textarea
                value={aiPrompt}
                onChange={e => setAiPrompt(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && e.ctrlKey && handleGenerate()}
                placeholder={aiMode === 'analyze'
                  ? 'Paste your error message or stack trace here...'
                  : 'e.g. Create an iFlow to sync S/4HANA sales orders to Salesforce in real-time using OAuth2...'}
                rows={2}
                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
              />
              <button onClick={handleGenerate} disabled={aiLoading || !aiPrompt.trim()}
                className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 text-white px-6 py-3 rounded-xl text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity flex-shrink-0 self-start">
                {aiLoading ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
                {aiLoading ? 'Generating…' : 'Generate'}
              </button>
            </div>
            <div className="text-xs text-slate-400 mt-1.5">Tip: Press Ctrl+Enter to generate</div>
            <div className="flex gap-2 flex-wrap mt-3">
              {AI_CHIPS.map(chip => (
                <button key={chip.label} onClick={() => handleChipClick(chip)}
                  className="flex items-center gap-1.5 rounded-full bg-indigo-50 text-indigo-600 text-xs px-3 py-1.5 hover:bg-indigo-100 border border-indigo-100 transition-colors">
                  <chip.icon size={11} />{chip.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-shrink-0 flex items-center justify-center">
            <motion.div animate={{ y:[0,-12,0] }} transition={{ repeat:Infinity, duration:3, ease:'easeInOut' }}
              className="w-32 h-32 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center">
              <Brain size={60} className="text-indigo-500" />
            </motion.div>
          </div>
        </div>

        {/* AI Result panel */}
        <AnimatePresence>
          {(aiResult || aiLoading) && (
            <motion.div ref={aiResultRef}
              initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:'auto' }}
              exit={{ opacity:0, height:0 }} transition={{ duration:0.3 }}
              className="mt-5 border-t border-slate-100 pt-5 overflow-hidden">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                  <span className="text-sm font-semibold text-slate-700">AI Response</span>
                </div>
                <div className="flex items-center gap-3">
                  {aiResult && <CopyButton text={aiResult} />}
                  <button onClick={() => setAiResult('')} className="text-slate-400 hover:text-slate-600"><X size={14} /></button>
                </div>
              </div>
              {aiLoading ? (
                <div className="flex items-center gap-3 text-slate-500 text-sm">
                  <Loader2 size={16} className="animate-spin text-indigo-500" />
                  Generating response with Gemini AI…
                </div>
              ) : (
                <div className="bg-slate-50 rounded-xl p-4 text-sm text-slate-700 whitespace-pre-wrap leading-relaxed max-h-80 overflow-y-auto font-mono border border-slate-200">
                  {aiResult}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Feature Cards */}
      <motion.div initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.25 }}
        className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        {FEATURE_CARDS.map(card => (
          <motion.div key={card.title} whileHover={{ y:-3, scale:1.01 }}
            onClick={() => handleFeatureCard(card)}
            className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 cursor-pointer group">
            <div className={`w-10 h-10 rounded-xl ${card.bg} flex items-center justify-center`}>
              <card.icon size={20} className={card.iconColor} />
            </div>
            <div className="font-semibold text-sm text-slate-800 mt-3">{card.title}</div>
            <div className="text-xs text-slate-500 mt-1 leading-snug">{card.desc}</div>
            <div className="mt-4 w-7 h-7 bg-indigo-600 group-hover:bg-indigo-700 rounded-full text-white flex items-center justify-center transition-colors">
              <ArrowRight size={12} />
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <motion.div initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.3 }}
          className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-slate-800">Message Processing Trend</h2>
            <span className="text-xs bg-slate-100 text-slate-500 rounded-lg px-2 py-1">Last 7 Days</span>
          </div>
          <div className="flex items-center gap-4 mb-3">
            {[['#4f46e5','Success'],['#ef4444','Failed'],['#f59e0b','Retry']].map(([c,l]) => (
              <div key={l} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor:c }} />
                <span className="text-xs text-slate-500">{l}</span>
              </div>
            ))}
          </div>
          <ResponsiveContainer width="100%" height={208}>
            <LineChart data={LINE_DATA}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="day" tick={{ fontSize:11, fill:'#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize:11, fill:'#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius:'12px', border:'1px solid #e2e8f0', fontSize:12 }} />
              <Line type="monotone" dataKey="success" stroke="#4f46e5" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="failed"  stroke="#ef4444" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="retry"   stroke="#f59e0b" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </motion.div>

        <motion.div initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.35 }}
          className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-slate-800">iFlows by Status</h2>
            <button onClick={() => navigate?.('monitoring')} className="text-xs text-indigo-600 hover:underline">View Details</button>
          </div>
          <div className="relative">
            <ResponsiveContainer width="100%" height={208}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                  {pieData.map(entry => (
                    <Cell key={entry.name} fill={STATUS_COLORS[entry.name] || '#6366f1'} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius:'12px', border:'1px solid #e2e8f0', fontSize:12 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <div className="text-2xl font-bold text-slate-800">{stats?.totalIflows ?? totalPie}</div>
              <div className="text-xs text-slate-400">Total</div>
            </div>
          </div>
          <div className="flex flex-wrap gap-3 mt-2">
            {pieData.map(d => {
              const pct = totalPie > 0 ? Math.round((d.value / totalPie) * 100) : 0;
              return (
                <div key={d.name} className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: STATUS_COLORS[d.name] || '#6366f1' }} />
                  <span className="text-xs text-slate-500">{d.name}</span>
                  <span className="text-xs font-semibold text-slate-700">{d.value}</span>
                  <span className="text-xs text-slate-400">({pct}%)</span>
                </div>
              );
            })}
          </div>
        </motion.div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Alerts */}
        <motion.div initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.4 }}
          className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-slate-800">Recent Alerts</h2>
            <div className="flex items-center gap-2">
              <button onClick={fetchAlerts} className="text-slate-400 hover:text-slate-600 transition-colors">
                <RefreshCw size={13} className={alertsLoading ? 'animate-spin' : ''} />
              </button>
              <button onClick={() => navigate?.('monitoring')} className="text-xs text-indigo-600 hover:underline">View All</button>
            </div>
          </div>
          {alertsLoading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_,i) => <div key={i} className="h-10 bg-slate-100 rounded-xl animate-pulse" />)}
            </div>
          ) : (
            <div className="space-y-3">
              {alerts.map((alert, i) => (
                <div key={i} className="flex items-center gap-3 cursor-pointer hover:bg-slate-50 rounded-xl px-2 py-1 -mx-2 transition-colors"
                  onClick={() => navigate?.('monitoring')}>
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${SEVERITY_DOT[alert.severity]}`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-slate-700 truncate">{alert.iflow}</div>
                    <div className="text-xs text-slate-400">{alert.time}</div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${SEVERITY_BADGE[alert.severity]}`}>
                    {alert.severity}
                  </span>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Quick Actions */}
        <AnimatePresence>
          {showQuickActions && (
            <motion.div initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }}
              exit={{ opacity:0, scale:0.95 }} transition={{ delay:0.4 }}
              className="bg-gradient-to-r from-indigo-600 to-violet-600 rounded-2xl p-5 text-white">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold">Quick Actions</h2>
                <button onClick={() => setShowQuickActions(false)} className="text-white/70 hover:text-white transition-colors">
                  <X size={16} />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {QUICK_ACTIONS.map(({ icon:Icon, label, sub, page }) => (
                  <button key={label} onClick={() => navigate?.(page)}
                    className="bg-white/10 hover:bg-white/20 rounded-xl p-3 flex items-center gap-2 cursor-pointer text-left transition-colors">
                    <Icon size={16} className="flex-shrink-0" />
                    <div>
                      <div className="text-sm font-medium">{label}</div>
                      <div className="text-xs opacity-70">{sub}</div>
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const STATIC_ALERTS = [
  { iflow:'High error rate in iFlow S4 to ECC Invoice', time:'5m ago',  severity:'Critical' },
  { iflow:'Retry limit exceeded in Doc to SFTP',        time:'15m ago', severity:'Warning'  },
  { iflow:'Security material expiring in 7 days',       time:'1h ago',  severity:'Info'     },
  { iflow:'Mapping performance degradation detected',   time:'2h ago',  severity:'Info'     },
];

function timeAgo(dateStr) {
  try {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1)  return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)  return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  } catch { return '—'; }
}
