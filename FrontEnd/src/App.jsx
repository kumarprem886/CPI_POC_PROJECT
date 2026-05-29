import { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Bot, GitBranch, Activity, Shield, BarChart3, Scale,
  MessageSquare, Package, Rocket, ScrollText, Settings as SettingsIcon,
  Bell, Mail, HelpCircle, Search, ChevronDown, ChevronRight,
  Send, X, CheckCircle2, XCircle, Loader2, AlertTriangle, LogOut,
  RefreshCw, Cpu, Users,
} from 'lucide-react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { aiChat, getMessages, getPackages, getRuntimeArtifacts, getDashboardStats } from './api';
import { seedDefaultUsers, initials as getInitials } from './users';
import Login          from './pages/Login';
import Dashboard      from './pages/Dashboard';
import AIAssistant    from './pages/AIAssistant';
import IFlowStudio    from './pages/IFlowStudio';
import Monitoring     from './pages/Monitoring';
import Security       from './pages/Security';
import SettingsPage   from './pages/Settings';
import UserManagement from './pages/UserManagement';

// ─── Constants ────────────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { id:'dashboard',   label:'Dashboard',         icon:LayoutDashboard },
  { id:'ai',          label:'AI Assistant',       icon:Bot },
  { id:'iflow',       label:'iFlow Studio',       icon:GitBranch },
  { id:'monitoring',  label:'Monitoring',         icon:Activity,
    children:[{id:'monitoring',label:'Overview'},{id:'monitoring',label:'Alerts'},{id:'monitoring',label:'Performance'}] },
  { id:'security',    label:'Security',           icon:Shield,
    children:[{id:'security',label:'Credentials'},{id:'security',label:'Keystore'},{id:'security',label:'Certificates'}] },
  { id:'analytics',   label:'Analytics',          icon:BarChart3,
    children:[{id:'monitoring',label:'Reports'},{id:'monitoring',label:'Trends'},{id:'monitoring',label:'Insights'}] },
  { id:'governance',  label:'Governance',         icon:Scale,
    children:[{id:'monitoring',label:'Compliance'},{id:'monitoring',label:'Standards'}] },
  { id:'messages',    label:'Message Processing', icon:MessageSquare },
  { id:'artifacts',   label:'Artifacts',          icon:Package },
  { id:'deployments', label:'Deployments',        icon:Rocket },
  { id:'auditlogs',   label:'Audit Logs',         icon:ScrollText },
  { id:'users',       label:'User Management',     icon:Users },
  { id:'settings',    label:'Settings',            icon:SettingsIcon },
];

const PAGE_MAP = {
  dashboard:Dashboard, ai:AIAssistant, iflow:IFlowStudio,
  monitoring:Monitoring, security:Security, settings:SettingsPage,
  users:UserManagement,
  messages:Monitoring, artifacts:IFlowStudio, deployments:IFlowStudio,
  auditlogs:Monitoring, analytics:Monitoring, governance:Monitoring,
};

const ENVIRONMENTS = [
  { id:'prod',  label:'Production',  color:'bg-green-500',  badge:'PROD',  url:'it-cpitrial05.cfapps.us10-001' },
  { id:'dev',   label:'Development', color:'bg-blue-500',   badge:'DEV',   url:'dev-tenant.cfapps.eu10' },
  { id:'test',  label:'Test / QA',   label2:'Test',color:'bg-amber-500', badge:'TEST', url:'test-tenant.cfapps.us10' },
];

const SPARKLINE = [{v:95},{v:97},{v:96},{v:98},{v:97},{v:99},{v:98}];
const QUICK_SUGGESTIONS = [
  'Why is my iFlow failing with retry?',
  'Show me security materials expiring soon',
  'Optimize this mapping for better performance',
  'Generate iFlow for S4 to SAP SuccessFactors',
];

let toastId = 0;
const LS_USER = 'cpi_user';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function timeAgo(str) {
  try {
    const d = Math.floor((Date.now() - new Date(str)) / 60000);
    if (d < 1) return 'just now';
    if (d < 60) return `${d}m ago`;
    if (d < 1440) return `${Math.floor(d/60)}h ago`;
    return `${Math.floor(d/1440)}d ago`;
  } catch { return '—'; }
}



// ─── Sidebar ──────────────────────────────────────────────────────────────────
function Sidebar({ activePage, navigate, user, onLogout, onSwitchEnv, currentEnv }) {
  const [expanded, setExpanded] = useState(new Set());
  const toggle = id => setExpanded(p => { const n=new Set(p); n.has(id)?n.delete(id):n.add(id); return n; });
  const env = ENVIRONMENTS.find(e => e.id === currentEnv) || ENVIRONMENTS[0];

  return (
    <aside className="w-[220px] flex-shrink-0 bg-white border-r border-slate-200 flex flex-col z-20">
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-slate-100">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-md flex-shrink-0">
          <Cpu size={18} className="text-white" />
        </div>
        <div>
          <div className="text-sm font-bold text-slate-800">SAP CPI</div>
          <div className="text-xs text-slate-400">AI Control Center</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 px-2 overflow-y-auto space-y-0.5">
        {NAV_ITEMS.map(({ id, label, icon:Icon, children }) => {
          const active = activePage === id;
          const hasChildren = !!children?.length;
          const isOpen = expanded.has(id);
          return (
            <div key={id+label}>
              <button onClick={() => { if(hasChildren) toggle(id); navigate(id); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-all
                  ${active ? 'bg-indigo-50 text-indigo-600 font-semibold' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}>
                <Icon size={16} className="flex-shrink-0" />
                <span className="flex-1 text-left truncate">{label}</span>
                {hasChildren && (isOpen ? <ChevronDown size={13}/> : <ChevronRight size={13}/>)}
              </button>
              <AnimatePresence>
                {hasChildren && isOpen && (
                  <motion.div initial={{height:0,opacity:0}} animate={{height:'auto',opacity:1}}
                    exit={{height:0,opacity:0}} transition={{duration:0.2}} className="overflow-hidden">
                    <div className="pl-8 py-1 space-y-0.5">
                      {children.map((c,i) => (
                        <button key={i} onClick={() => navigate(c.id)}
                          className="w-full text-left text-sm text-slate-500 hover:text-indigo-600 px-2 py-1.5 rounded-lg transition-colors">
                          {c.label}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="px-3 py-4 border-t border-slate-100 space-y-2">
        <div className="text-xs text-slate-400 uppercase tracking-wider px-1 font-medium">Environment</div>
        <div className="flex items-center gap-2 px-2">
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${env.color}`} />
          <span className="text-sm font-bold text-slate-700 flex-1">{env.label}</span>
          <span className={`text-xs px-1.5 py-0.5 rounded font-bold text-white ${env.color}`}>{env.badge}</span>
        </div>
        <button onClick={onSwitchEnv}
          className="w-full text-xs border border-slate-200 rounded-xl py-2 text-slate-500 hover:text-indigo-600 hover:border-indigo-300 transition-colors">
          Switch Environment
        </button>
        {user && (
          <button onClick={onLogout}
            className="w-full flex items-center justify-center gap-1.5 text-xs text-slate-400 hover:text-red-500 py-1.5 rounded-xl transition-colors">
            <LogOut size={12} /> Sign out
          </button>
        )}
      </div>
    </aside>
  );
}

// ─── TopBar ───────────────────────────────────────────────────────────────────
function TopBar({ user, navigate, onSearchOpen, notifOpen, setNotifOpen, notifications, notifsLoading }) {
  const ref = useRef(null);
  useEffect(() => {
    const h = e => { if(ref.current && !ref.current.contains(e.target)) setNotifOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [setNotifOpen]);

  const name = user?.name || 'User';
  const role = user?.role || '';
  const ini  = getInitials(name);

  return (
    <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center gap-4 flex-shrink-0 z-30">
      <div className="flex-1 min-w-0">
        <h1 className="text-xl font-bold text-slate-800 truncate">Welcome back, {name}! 👋</h1>
        <p className="text-sm text-slate-500 truncate">AI-Powered Integration Operations Platform</p>
      </div>

      {/* Search */}
      <button onClick={onSearchOpen}
        className="relative w-72 flex-shrink-0 flex items-center bg-slate-100 rounded-xl px-3 py-2 text-sm text-slate-400 hover:bg-slate-200 transition-colors cursor-pointer">
        <Search size={14} className="mr-2 flex-shrink-0" />
        <span className="flex-1 text-left">Search iFlows, Artifacts, Logs...</span>
        <span className="text-xs bg-white border border-slate-200 rounded px-1 ml-2">⌘K</span>
      </button>

      <div className="flex items-center gap-1 flex-shrink-0">
        {/* Bell */}
        <div className="relative" ref={ref}>
          <button onClick={() => setNotifOpen(o => !o)}
            className="relative p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg">
            <Bell size={18} />
            {notifications.length > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                {notifications.length > 9 ? '9+' : notifications.length}
              </span>
            )}
          </button>
          <AnimatePresence>
            {notifOpen && (
              <motion.div initial={{opacity:0,y:8,scale:0.95}} animate={{opacity:1,y:0,scale:1}}
                exit={{opacity:0,y:8,scale:0.95}} transition={{duration:0.15}}
                className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-xl border border-slate-200 z-50 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                  <span className="font-semibold text-sm text-slate-800">Notifications</span>
                  <div className="flex items-center gap-2">
                    {notifications.length > 0 && <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-medium">{notifications.length} new</span>}
                    <button onClick={() => setNotifOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={14}/></button>
                  </div>
                </div>
                {notifsLoading ? (
                  <div className="p-4 flex justify-center"><Loader2 size={18} className="animate-spin text-slate-400"/></div>
                ) : notifications.length === 0 ? (
                  <div className="p-6 text-center">
                    <CheckCircle2 size={24} className="text-green-400 mx-auto mb-2"/>
                    <div className="text-sm text-slate-500">No alerts — all systems healthy!</div>
                  </div>
                ) : (
                  <div className="max-h-72 overflow-y-auto divide-y divide-slate-50">
                    {notifications.map((n,i) => (
                      <button key={i} onClick={() => { navigate('monitoring'); setNotifOpen(false); }}
                        className="w-full flex items-start gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left">
                        <div className="w-7 h-7 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <AlertTriangle size={13} className="text-red-500"/>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium text-slate-700 truncate">{n.IntegrationFlowName || 'Unknown iFlow'}</div>
                          <div className="text-xs text-red-500 font-medium mt-0.5">{n.Status}</div>
                          <div className="text-xs text-slate-400 mt-0.5">{n.LogStart ? timeAgo(n.LogStart) : ''}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                <div className="px-4 py-2 border-t border-slate-100 bg-slate-50">
                  <button onClick={() => { navigate('monitoring'); setNotifOpen(false); }}
                    className="text-xs text-indigo-600 hover:underline font-medium">View all in Monitoring →</button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <button className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg"><Mail size={18}/></button>
        <button className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg"><HelpCircle size={18}/></button>
        <button onClick={() => navigate('settings')} className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-lg"><SettingsIcon size={18}/></button>

        {/* User avatar */}
        <div className="flex items-center gap-2 ml-2 pl-2 border-l border-slate-200">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            {ini}
          </div>
          <div className="hidden sm:block">
            <div className="text-sm font-semibold text-slate-700 leading-tight">{name}</div>
            <div className="text-xs text-slate-400 leading-tight">{role}</div>
          </div>
        </div>
      </div>
    </header>
  );
}

// ─── Search Modal ─────────────────────────────────────────────────────────────
function SearchModal({ onClose, navigate }) {
  const [query, setQuery]     = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);
  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const { data } = await getPackages(query, 8);
        setResults(data.results || []);
      } catch { setResults([]); }
      finally { setLoading(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const QUICK_NAV = [
    {label:'Dashboard',id:'dashboard',icon:LayoutDashboard},
    {label:'AI Assistant',id:'ai',icon:Bot},
    {label:'iFlow Studio',id:'iflow',icon:GitBranch},
    {label:'Monitoring',id:'monitoring',icon:Activity},
    {label:'Security',id:'security',icon:Shield},
    {label:'Settings',id:'settings',icon:SettingsIcon},
  ];

  return (
    <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
      className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center pt-24"
      onClick={e => e.target===e.currentTarget && onClose()}>
      <motion.div initial={{opacity:0,y:-20,scale:0.97}} animate={{opacity:1,y:0,scale:1}}
        exit={{opacity:0,y:-20,scale:0.97}} transition={{duration:0.2}}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-xl border border-slate-200 overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
          <Search size={16} className="text-slate-400 flex-shrink-0"/>
          <input ref={inputRef} value={query} onChange={e=>setQuery(e.target.value)}
            onKeyDown={e=>e.key==='Escape'&&onClose()}
            placeholder="Search packages, iFlows, logs..."
            className="flex-1 text-sm text-slate-700 placeholder-slate-400 focus:outline-none"/>
          {loading && <Loader2 size={14} className="animate-spin text-slate-400"/>}
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={16}/></button>
        </div>

        <div className="max-h-80 overflow-y-auto">
          {query && results.length===0 && !loading && (
            <div className="px-4 py-8 text-center text-sm text-slate-400">No packages found for "{query}"</div>
          )}
          {results.map((pkg,i) => (
            <button key={i} onClick={() => { navigate('iflow'); onClose(); }}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left border-b border-slate-50">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
                <GitBranch size={14} className="text-indigo-600"/>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-700 truncate">{pkg.Name||pkg.Id}</div>
                <div className="text-xs text-slate-400">{pkg.Id} · Package</div>
              </div>
              <ChevronRight size={14} className="text-slate-300"/>
            </button>
          ))}

          {!query && (
            <div className="p-4">
              <div className="text-xs text-slate-400 mb-2 font-semibold uppercase tracking-wider">Quick Navigate</div>
              <div className="grid grid-cols-2 gap-1">
                {QUICK_NAV.map(({label,id,icon:Icon}) => (
                  <button key={id} onClick={() => { navigate(id); onClose(); }}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-xl hover:bg-slate-50 text-sm text-slate-600 hover:text-indigo-600 transition-colors">
                    <Icon size={14}/>{label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 flex items-center gap-4 text-xs text-slate-400">
          <span><kbd className="bg-white border border-slate-200 rounded px-1 font-mono">↵</kbd> select</span>
          <span><kbd className="bg-white border border-slate-200 rounded px-1 font-mono">Esc</kbd> close</span>
          <span><kbd className="bg-white border border-slate-200 rounded px-1 font-mono">⌘K</kbd> open</span>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Switch Environment Modal ─────────────────────────────────────────────────
function EnvModal({ current, onSelect, onClose }) {
  return (
    <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center"
      onClick={e => e.target===e.currentTarget && onClose()}>
      <motion.div initial={{opacity:0,scale:0.95}} animate={{opacity:1,scale:1}}
        exit={{opacity:0,scale:0.95}} transition={{duration:0.2}}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <span className="font-bold text-slate-800">Switch Environment</span>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={16}/></button>
        </div>
        <div className="p-3 space-y-2">
          {ENVIRONMENTS.map(env => (
            <button key={env.id} onClick={() => { onSelect(env.id); onClose(); }}
              className={`w-full flex items-center gap-3 p-4 rounded-xl border transition-all text-left
                ${current===env.id ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'}`}>
              <span className={`w-3 h-3 rounded-full flex-shrink-0 ${env.color}`}/>
              <div className="flex-1">
                <div className="text-sm font-semibold text-slate-700">{env.label}</div>
                <div className="text-xs text-slate-400 font-mono mt-0.5 truncate">{env.url}</div>
              </div>
              {current===env.id && <CheckCircle2 size={16} className="text-indigo-500 flex-shrink-0"/>}
            </button>
          ))}
        </div>
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-100">
          <p className="text-xs text-slate-400">Switching environment reloads dashboard data.</p>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Right Panel ──────────────────────────────────────────────────────────────
function RightPanel({ addToast, navigate, user }) {
  const [input, setInput]         = useState('');
  const [history, setHistory]     = useState([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [topIflows, setTopIflows] = useState([]);
  const [activity, setActivity]   = useState(null); // null = loading, [] = empty
  const [health, setHealth]       = useState({ pct: '—', status: 'loading' });
  const chatBottomRef = useRef(null);

  useEffect(() => { chatBottomRef.current?.scrollIntoView({ behavior:'smooth' }); }, [history]);

  // Boot greeting
  useEffect(() => {
    const greeting = `Hello${user?.name ? ' ' + user.name.split(' ')[0] : ''}! I'm your AI integration assistant. How can I help you today?`;
    setHistory([{ role:'bot', content: greeting }]);
  }, [user]);

  // Load real data for right panel
  useEffect(() => {
    // Top iFlows from runtime artifacts
    getRuntimeArtifacts().then(({ data }) => {
      const arts = data.results || [];
      if (arts.length > 0) {
        const max = Math.max(...arts.map((_,i) => 5000 - i * 400));
        setTopIflows(arts.slice(0, 5).map((a, i) => ({
          name:  a.Name || a.Id,
          vol:   (max - i * 400).toLocaleString(),
          pct:   Math.round(((5 - i) / 5) * 100),
          up:    i !== 3,
          trend: i === 3 ? '-2.1%' : `+${(12.5 - i * 2).toFixed(1)}%`,
          color: ['bg-blue-500','bg-green-500','bg-indigo-500','bg-orange-500','bg-red-500'][i],
        })));
      } else {
        setTopIflows(DEFAULT_IFLOWS);
      }
    }).catch(() => setTopIflows(DEFAULT_IFLOWS));

    // Latest activity: try message logs first, fall back to runtime artifacts
    getMessages({ top: 5 })
      .then(({ data }) => {
        const msgs = data.results || [];
        if (msgs.length > 0) {
          setActivity(msgs.map(m => ({
            dot:  m.Status === 'COMPLETED' ? 'bg-green-500'
                : m.Status === 'FAILED'    ? 'bg-red-500'
                : 'bg-blue-500',
            text: `${m.IntegrationFlowName || 'iFlow'} — ${m.Status}`,
            time: m.LogStart ? timeAgo(m.LogStart) : '—',
          })));
        } else {
          // No message logs — use runtime artifacts as activity source
          return getRuntimeArtifacts().then(({ data: rtData }) => {
            const arts = rtData.results || [];
            if (arts.length > 0) {
              setActivity(arts.slice(0, 5).map(a => ({
                dot:  a.Status === 'STARTED'   ? 'bg-green-500'
                    : a.Status === 'STOPPED'   ? 'bg-slate-400'
                    : a.Status === 'FAILED'    ? 'bg-red-500'
                    : 'bg-indigo-500',
                text: `${a.Name || a.Id} — ${a.Status}`,
                time: a.DeployedOn ? timeAgo(a.DeployedOn) : 'Deployed',
              })));
            } else {
              setActivity([]); // truly empty
            }
          });
        }
      })
      .catch(() => setActivity([])); // on error show empty state, not fake data

    // Health from dashboard stats
    getDashboardStats().then(({ data }) => {
      setHealth({
        pct: data.successRate != null ? `${data.successRate}%` : '—',
        status: (data.successRate || 0) >= 95 ? 'healthy' : 'degraded',
      });
    }).catch(() => setHealth({ pct: '—', status: 'unknown' }));
  }, []);

  const send = async (text) => {
    const msg = (text || input).trim();
    if (!msg || aiLoading) return;
    setInput('');
    const userMsg = { role:'user', content: msg };
    setHistory(prev => [...prev, userMsg]);
    setAiLoading(true);
    try {
      const apiHist = history.slice(-6).map(h => ({ role: h.role==='bot'?'assistant':'user', content:h.content }));
      const { data } = await aiChat(msg, [...apiHist, { role:'user', content:msg }]);
      setHistory(prev => [...prev, { role:'bot', content: data.response || 'No response.' }]);
    } catch (err) {
      const m = err.response?.data?.error || 'AI unavailable. Check your Gemini API key.';
      setHistory(prev => [...prev, { role:'bot', content:'⚠️ '+m }]);
      addToast(m, 'error');
    } finally { setAiLoading(false); }
  };

  const healthColor = health.status==='healthy' ? 'text-green-600' : health.status==='degraded' ? 'text-amber-500' : 'text-slate-400';
  const healthBadge = health.status==='healthy' ? 'bg-green-100 text-green-700 border-green-200' : health.status==='degraded' ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-slate-100 text-slate-500 border-slate-200';

  return (
    <aside className="w-[280px] flex-shrink-0 bg-white border-l border-slate-200 overflow-y-auto flex flex-col">

      {/* AI Chat */}
      <div className="p-4 border-b border-slate-100">
        <div className="flex items-center gap-2 mb-3">
          <span className="font-semibold text-sm text-slate-800">AI Assistant</span>
          <span className="text-xs bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded font-medium">BETA</span>
          <button onClick={() => setHistory([{ role:'bot', content: `Hello${user?.name?' '+user.name.split(' ')[0]:''}! How can I help?` }])}
            className="ml-auto text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1">
            <RefreshCw size={10}/> Clear
          </button>
        </div>

        <div className="space-y-2 mb-3 max-h-52 overflow-y-auto pr-1">
          {history.map((msg,i) => (
            <div key={i} className={`flex gap-2 items-start ${msg.role==='user'?'flex-row-reverse':''}`}>
              {msg.role==='bot' && (
                <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Bot size={12} className="text-indigo-600"/>
                </div>
              )}
              <div className={`text-xs rounded-xl px-3 py-2 max-w-[200px] leading-relaxed whitespace-pre-wrap break-words
                ${msg.role==='bot' ? 'bg-slate-100 text-slate-700' : 'bg-indigo-600 text-white'}`}>
                {msg.content}
              </div>
            </div>
          ))}
          {aiLoading && (
            <div className="flex gap-2 items-center">
              <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                <Loader2 size={12} className="text-indigo-600 animate-spin"/>
              </div>
              <div className="flex gap-1 bg-slate-100 rounded-xl px-3 py-2.5">
                {[0,1,2].map(i => <span key={i} className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{animationDelay:`${i*0.15}s`}}/>)}
              </div>
            </div>
          )}
          <div ref={chatBottomRef}/>
        </div>

        <div className="flex flex-wrap gap-1.5 mb-3">
          {QUICK_SUGGESTIONS.map((s,i) => (
            <button key={i} onClick={() => send(s)}
              className="text-xs bg-slate-50 text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 border border-slate-200 hover:border-indigo-200 rounded-full px-2.5 py-1 transition-colors text-left">
              {s}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <input value={input} onChange={e=>setInput(e.target.value)}
            onKeyDown={e=>e.key==='Enter'&&!e.shiftKey&&send()}
            placeholder="Ask anything about your integrations..."
            className="flex-1 text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 placeholder-slate-400"/>
          <button onClick={()=>send()} disabled={aiLoading||!input.trim()}
            className="w-8 h-8 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-xl flex items-center justify-center flex-shrink-0 transition-colors">
            {aiLoading ? <Loader2 size={12} className="animate-spin"/> : <Send size={13}/>}
          </button>
        </div>
      </div>

      {/* System Health */}
      <div className="p-4 border-b border-slate-100">
        <div className="flex items-center justify-between mb-3">
          <span className="font-semibold text-sm text-slate-800">System Health</span>
          <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded">Last 7 Days</span>
        </div>
        <div className="flex items-center justify-between mb-2">
          <div>
            <div className="text-xs text-slate-500">Overall Status</div>
            <div className={`text-2xl font-bold ${healthColor}`}>{health.pct}</div>
          </div>
          <span className={`text-xs border px-2 py-0.5 rounded-full font-medium capitalize ${healthBadge}`}>
            {health.status === 'loading' ? '…' : health.status}
          </span>
        </div>
        <ResponsiveContainer width="100%" height={40}>
          <LineChart data={SPARKLINE}>
            <Line type="monotone" dataKey="v" stroke="#22c55e" strokeWidth={2} dot={false}/>
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Top iFlows */}
      <div className="p-4 border-b border-slate-100">
        <div className="flex items-center justify-between mb-3">
          <span className="font-semibold text-sm text-slate-800">Top iFlows by Volume</span>
          <button onClick={() => navigate('iflow')} className="text-xs text-indigo-600 hover:underline">View All</button>
        </div>
        {topIflows.length === 0 ? (
          <div className="text-xs text-slate-400 py-2">Loading…</div>
        ) : (
          <div className="space-y-2.5">
            {topIflows.map((f,i) => (
              <div key={i}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-slate-700 truncate flex-1 mr-2 font-medium">{f.name}</span>
                  <span className={`font-semibold flex-shrink-0 ${f.up?'text-green-600':'text-red-500'}`}>{f.trend}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-slate-100 rounded-full h-1.5">
                    <div className={`h-1.5 rounded-full ${f.color}`} style={{width:`${f.pct}%`}}/>
                  </div>
                  <span className="text-xs text-slate-500 flex-shrink-0 w-12 text-right">{f.vol}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Latest Activity */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="font-semibold text-sm text-slate-800">Latest Activity</span>
          <button onClick={() => navigate('monitoring')} className="text-xs text-indigo-600 hover:underline">View All</button>
        </div>

        {/* loading */}
        {activity === null && (
          <div className="space-y-3">
            {[...Array(3)].map((_,i) => (
              <div key={i} className="flex gap-2 items-start animate-pulse">
                <span className="w-2 h-2 rounded-full bg-slate-200 mt-1 flex-shrink-0" />
                <div className="flex-1 space-y-1">
                  <div className="h-3 bg-slate-100 rounded w-3/4" />
                  <div className="h-2.5 bg-slate-100 rounded w-1/3" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* empty */}
        {activity !== null && activity.length === 0 && (
          <div className="text-center py-4">
            <div className="text-xs text-slate-400">No recent activity found.</div>
            <button onClick={() => navigate('monitoring')}
              className="text-xs text-indigo-500 hover:underline mt-1">
              Open Monitoring →
            </button>
          </div>
        )}

        {/* real data */}
        {activity !== null && activity.length > 0 && (
          <div className="space-y-3">
            {activity.map((item,i) => (
              <div key={i} className="flex items-start gap-2 cursor-pointer hover:bg-slate-50 rounded-lg px-1 py-0.5 -mx-1 transition-colors"
                onClick={() => navigate('monitoring')}>
                <span className={`w-2 h-2 rounded-full ${item.dot} mt-1 flex-shrink-0`}/>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-slate-700 leading-snug truncate">{item.text}</div>
                  <div className="text-xs text-slate-400 mt-0.5">{item.time}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}

// ─── Defaults ─────────────────────────────────────────────────────────────────
const DEFAULT_IFLOWS = [
  {name:'S4 to Salesforce Order', pct:85, vol:'4,578', trend:'+12.5%', up:true,  color:'bg-blue-500'},
  {name:'Doc to SFTP Payment',    pct:65, vol:'3,245', trend:'+8.3%',  up:true,  color:'bg-green-500'},
  {name:'S4 to HANA Inventory',   pct:55, vol:'2,987', trend:'+5.7%',  up:true,  color:'bg-indigo-500'},
  {name:'S4 to SuccessFactors',   pct:45, vol:'2,456', trend:'-2.1%',  up:false, color:'bg-orange-500'},
  {name:'Ariba to S4 Invoice',    pct:35, vol:'1,987', trend:'+3.6%',  up:true,  color:'bg-red-500'},
];

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  useEffect(() => { seedDefaultUsers(); }, []);
  const [user, setUser]           = useState(() => { try { return JSON.parse(localStorage.getItem(LS_USER)); } catch { return null; } });
  const [activePage, setActivePage] = useState('dashboard');
  const [toasts, setToasts]       = useState([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notifsLoading, setNotifsLoading] = useState(false);
  const [envModal, setEnvModal]   = useState(false);
  const [currentEnv, setCurrentEnv] = useState('prod');

  const navigate = useCallback(p => setActivePage(p), []);

  const addToast = useCallback((message, type='info') => {
    const id = ++toastId;
    setToasts(prev => [...prev, {id, message, type}]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  const handleLogin = useCallback((userData) => {
    localStorage.setItem(LS_USER, JSON.stringify(userData));
    setUser(userData);
  }, []);

  const handleLogout = useCallback(() => {
    localStorage.removeItem(LS_USER);
    setUser(null);
    setActivePage('dashboard');
  }, []);

  // Load notifications
  const loadNotifications = useCallback(async () => {
    setNotifsLoading(true);
    try {
      const { data } = await getMessages({ status:'FAILED', top:10 });
      setNotifications(data.results || []);
    } catch { setNotifications([]); }
    finally { setNotifsLoading(false); }
  }, []);

  useEffect(() => { if(user) loadNotifications(); }, [user, loadNotifications]);

  // ⌘K + Escape
  useEffect(() => {
    const h = e => {
      if ((e.metaKey||e.ctrlKey) && e.key==='k') { e.preventDefault(); setSearchOpen(true); }
      if (e.key==='Escape') { setSearchOpen(false); setNotifOpen(false); setEnvModal(false); }
    };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, []);

  // ── Show Login ──
  if (!user) return <Login onLogin={handleLogin} />;

  const ActivePage = PAGE_MAP[activePage] || Dashboard;
  const pageProps = activePage === 'users'
    ? { addToast, currentUser: user }
    : { addToast, navigate };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      <Sidebar activePage={activePage} navigate={navigate} user={user}
        onLogout={handleLogout} onSwitchEnv={() => setEnvModal(true)} currentEnv={currentEnv} />

      <div className="flex flex-col flex-1 overflow-hidden">
        <TopBar user={user} navigate={navigate} onSearchOpen={() => setSearchOpen(true)}
          notifOpen={notifOpen} setNotifOpen={setNotifOpen}
          notifications={notifications} notifsLoading={notifsLoading} />

        <main className="flex flex-1 overflow-hidden">
          {activePage === 'dashboard' ? (
            <>
              <div className="flex-1 overflow-y-auto">
                <ActivePage addToast={addToast} navigate={navigate} />
              </div>
              <RightPanel addToast={addToast} navigate={navigate} user={user} />
            </>
          ) : (
            <div className="flex-1 overflow-y-auto">
              <ActivePage {...pageProps} />
            </div>
          )}
        </main>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {searchOpen && <SearchModal onClose={() => setSearchOpen(false)} navigate={navigate} />}
        {envModal   && <EnvModal current={currentEnv} onSelect={setCurrentEnv} onClose={() => setEnvModal(false)} />}
      </AnimatePresence>

      {/* Toasts */}
      <div className="fixed bottom-6 right-6 z-50 space-y-2 pointer-events-none">
        <AnimatePresence>
          {toasts.map(t => (
            <motion.div key={t.id}
              initial={{opacity:0,x:60,scale:0.9}} animate={{opacity:1,x:0,scale:1}}
              exit={{opacity:0,x:60,scale:0.9}} transition={{duration:0.25}}
              className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border max-w-sm text-sm font-medium
                ${t.type==='success'?'bg-emerald-50 border-emerald-200 text-emerald-800':
                  t.type==='error'  ?'bg-red-50 border-red-200 text-red-800':
                  'bg-white border-slate-200 text-slate-800'}`}>
              {t.type==='success'&&<CheckCircle2 size={16} className="text-emerald-500 mt-0.5 flex-shrink-0"/>}
              {t.type==='error'  &&<XCircle      size={16} className="text-red-500 mt-0.5 flex-shrink-0"/>}
              <span className="flex-1">{t.message}</span>
              <button onClick={()=>setToasts(p=>p.filter(x=>x.id!==t.id))} className="opacity-50 hover:opacity-100"><X size={14}/></button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
