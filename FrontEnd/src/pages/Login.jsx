import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Loader2, Cpu, Shield, Zap, BarChart3 } from 'lucide-react';
import { validateLogin, getUsers, initials } from '../users';

export default function Login({ onLogin }) {
  const [form, setForm]       = useState({ email: '', password: '' });
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [users, setUsers]     = useState([]);

  useEffect(() => { setUsers(getUsers()); }, []);

  const set = (k, v) => { setForm(p => ({ ...p, [k]: v })); setError(''); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.email.trim() || !form.password.trim()) { setError('Please enter your email and password.'); return; }
    setLoading(true);
    await new Promise(r => setTimeout(r, 700));
    const result = validateLogin(form.email.trim(), form.password);
    setLoading(false);
    if (!result.ok) { setError(result.error); return; }
    onLogin(result.user);
  };

  const quickLogin = (user) => {
    setForm({ email: user.email, password: user.password });
    setError('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center p-4">
      <div className="absolute inset-0 opacity-10"
        style={{ backgroundImage:'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize:'32px 32px' }} />

      <div className="relative w-full max-w-4xl flex rounded-3xl overflow-hidden shadow-2xl">
        {/* Left — branding */}
        <div className="hidden md:flex flex-col justify-between w-5/12 bg-gradient-to-br from-indigo-600 to-violet-700 p-10 text-white">
          <div>
            <div className="flex items-center gap-3 mb-10">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                <Cpu size={22} className="text-white" />
              </div>
              <div>
                <div className="font-bold text-lg">SAP CPI</div>
                <div className="text-xs text-white/70">AI Control Center</div>
              </div>
            </div>
            <h1 className="text-3xl font-extrabold leading-tight mb-4">
              Enterprise Integration<br />at Your Fingertips
            </h1>
            <p className="text-white/70 text-sm leading-relaxed">
              Monitor, manage, and AI-generate SAP CPI integrations — all from one intelligent dashboard.
            </p>
          </div>

          <div className="space-y-4">
            {[
              { icon:Zap,       title:'AI-Powered',    desc:'Generate iFlows with Gemini AI'    },
              { icon:BarChart3, title:'Live Analytics', desc:'Real-time CPI message monitoring'  },
              { icon:Shield,    title:'Secure',        desc:'Credential & keystore management'  },
            ].map(({ icon:Icon, title, desc }) => (
              <div key={title} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center flex-shrink-0">
                  <Icon size={15} className="text-white" />
                </div>
                <div>
                  <div className="text-sm font-semibold">{title}</div>
                  <div className="text-xs text-white/60">{desc}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Registered users quick-pick */}
          {users.length > 0 && (
            <div className="mt-6">
              <div className="text-xs text-white/50 mb-2 font-medium uppercase tracking-wider">Registered Users</div>
              <div className="flex flex-wrap gap-2">
                {users.map(u => (
                  <button key={u.id} onClick={() => quickLogin(u)}
                    title={`Sign in as ${u.name}`}
                    className="flex items-center gap-2 bg-white/10 hover:bg-white/20 rounded-xl px-3 py-1.5 transition-colors">
                    <div className={`w-6 h-6 rounded-full bg-gradient-to-br ${u.color} flex items-center justify-center text-white text-[10px] font-bold`}>
                      {initials(u.name)}
                    </div>
                    <span className="text-xs text-white/90 font-medium">{u.name.split(' ')[0]}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right — form */}
        <motion.div initial={{ opacity:0, x:30 }} animate={{ opacity:1, x:0 }} transition={{ duration:0.4 }}
          className="flex-1 bg-white flex flex-col justify-center p-10">

          <div className="flex items-center gap-2 mb-8 md:hidden">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
              <Cpu size={16} className="text-white" />
            </div>
            <span className="font-bold text-slate-800">SAP CPI AI Control Center</span>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-extrabold text-slate-800">Welcome back</h2>
            <p className="text-slate-500 mt-1 text-sm">Sign in to your control center</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email address</label>
              <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
                placeholder="you@company.com" autoComplete="email"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent" />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Password</label>
              <div className="relative">
                <input type={showPwd ? 'text' : 'password'} value={form.password}
                  onChange={e => set('password', e.target.value)}
                  placeholder="Enter your password" autoComplete="current-password"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 pr-11 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent" />
                <button type="button" onClick={() => setShowPwd(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <motion.div initial={{ opacity:0, y:-4 }} animate={{ opacity:1, y:0 }}
                className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">
                {error}
              </motion.div>
            )}

            <button type="submit" disabled={loading}
              className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:opacity-90 disabled:opacity-60 text-white font-semibold rounded-xl py-3 flex items-center justify-center gap-2 transition-opacity mt-2">
              {loading ? <><Loader2 size={16} className="animate-spin" />Signing in…</> : 'Sign in'}
            </button>
          </form>

          {users.length === 0 && (
            <p className="text-xs text-slate-400 mt-4 text-center bg-slate-50 rounded-xl p-3 border border-slate-200">
              No users yet — enter any email & password to create the first admin account.
            </p>
          )}

          <p className="text-xs text-slate-400 mt-8 text-center">
            SAP CPI AI Control Center · Enterprise Edition
          </p>
        </motion.div>
      </div>
    </div>
  );
}
