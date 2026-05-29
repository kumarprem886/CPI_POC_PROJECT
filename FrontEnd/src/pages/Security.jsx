import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Shield, Lock, Key, AlertTriangle, RefreshCw,
  Loader2, Eye, EyeOff, User
} from 'lucide-react';
import { getCredentials, getKeystore } from '../api';

const TABS = [
  { id: 'credentials', label: 'User Credentials', icon: User },
  { id: 'keystore',    label: 'Keystore Entries', icon: Lock },
];

function MaskedValue() {
  const [show, setShow] = useState(false);
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-xs text-slate-500">
      {show ? 'p@ssw0rd••••' : '••••••••••••'}
      <button onClick={() => setShow(v => !v)} className="text-slate-300 hover:text-slate-500">
        {show ? <EyeOff size={11} /> : <Eye size={11} />}
      </button>
    </span>
  );
}

function TableSkeleton({ cols }) {
  return (
    <div className="space-y-2 p-4">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="grid gap-4 animate-pulse" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
          {[...Array(cols)].map((__, j) => (
            <div key={j} className="h-8 bg-slate-200 rounded-lg" />
          ))}
        </div>
      ))}
    </div>
  );
}

export default function Security({ addToast }) {
  const [activeTab, setActiveTab] = useState('credentials');
  const [credentials, setCredentials] = useState([]);
  const [keystore, setKeystore] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [credRes, ksRes] = await Promise.all([
        getCredentials(),
        getKeystore(),
      ]);
      setCredentials(credRes.data.results || []);
      setKeystore(ksRes.data.results || []);
    } catch (err) {
      const msg = err.response?.data?.error || err.message;
      setError(msg);
      addToast('Failed to load security data: ' + msg, 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Security</h1>
          <p className="text-slate-500 mt-1">Credentials and keystore management</p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 hover:border-slate-300 px-4 py-2 rounded-xl"
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      {/* Warning banner */}
      <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
        <AlertTriangle size={16} className="flex-shrink-0 mt-0.5 text-amber-500" />
        <div>
          <strong>Read-only view.</strong> Security materials are displayed for reference only.
          Passwords and private key material are never exposed through this dashboard.
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          <AlertTriangle size={16} className="flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-all
              ${activeTab === id
                ? 'bg-indigo-600 text-white border-transparent shadow-sm'
                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {/* Credentials table */}
      {activeTab === 'credentials' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-6 py-4 border-b border-slate-100">
            <User size={16} className="text-indigo-500" />
            <h2 className="text-base font-semibold text-slate-700">User Credentials</h2>
            <span className="ml-auto text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
              {credentials.length} entries
            </span>
          </div>
          {loading ? (
            <TableSkeleton cols={4} />
          ) : credentials.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Key size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">No user credentials found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wide">Name</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wide">Kind</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wide">Description</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wide">Password</th>
                  </tr>
                </thead>
                <tbody>
                  {credentials.map((cred, i) => (
                    <tr key={cred.Name || i} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="py-3 px-4 font-medium text-slate-800 flex items-center gap-2">
                        <Shield size={13} className="text-indigo-400 flex-shrink-0" />
                        {cred.Name || '—'}
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-600 font-medium">
                          {cred.Kind || cred.Type || 'Credential'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-500">{cred.Description || '—'}</td>
                      <td className="py-3 px-4"><MaskedValue /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Keystore table */}
      {activeTab === 'keystore' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-6 py-4 border-b border-slate-100">
            <Lock size={16} className="text-indigo-500" />
            <h2 className="text-base font-semibold text-slate-700">Keystore Entries</h2>
            <span className="ml-auto text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
              {keystore.length} entries
            </span>
          </div>
          {loading ? (
            <TableSkeleton cols={4} />
          ) : keystore.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Lock size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">No keystore entries found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wide">Alias</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wide">Type</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wide">Valid Until</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wide">Owner</th>
                  </tr>
                </thead>
                <tbody>
                  {keystore.map((entry, i) => {
                    const validUntil = entry.ValidNotAfter || entry.ValidUntil;
                    const expired = validUntil && new Date(validUntil) < new Date();
                    return (
                      <tr key={entry.Alias || i} className="border-b border-slate-50 hover:bg-slate-50">
                        <td className="py-3 px-4 font-medium text-slate-800 flex items-center gap-2">
                          <Lock size={13} className="text-indigo-400 flex-shrink-0" />
                          {entry.Alias || '—'}
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
                            {entry.Type || entry.KeyType || '—'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          {validUntil ? (
                            <span className={`text-xs font-medium ${expired ? 'text-red-600' : 'text-emerald-600'}`}>
                              {expired ? '⚠ ' : ''}{new Date(validUntil).toLocaleDateString()}
                            </span>
                          ) : <span className="text-slate-400 text-xs">—</span>}
                        </td>
                        <td className="py-3 px-4 text-slate-500">{entry.Owner || entry.Subject || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}
