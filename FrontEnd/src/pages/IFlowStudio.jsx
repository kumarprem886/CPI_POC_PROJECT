import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Package, GitBranch, ChevronRight,
  Loader2, AlertTriangle, RefreshCw, X, Plus
} from 'lucide-react';
import { getPackages, getPackageIflows } from '../api';

const STATUS_STYLES = {
  STARTED:   'bg-emerald-100 text-emerald-700 border border-emerald-200',
  STOPPED:   'bg-slate-100 text-slate-600 border border-slate-200',
  ERROR:     'bg-red-100 text-red-700 border border-red-200',
  FAILED:    'bg-red-100 text-red-700 border border-red-200',
  STARTING:  'bg-amber-100 text-amber-700 border border-amber-200',
  DEPLOYING: 'bg-blue-100 text-blue-700 border border-blue-200',
};

function StatusPill({ status }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[status] || 'bg-slate-100 text-slate-500 border border-slate-200'}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${status === 'STARTED' ? 'bg-emerald-500' : status === 'FAILED' || status === 'ERROR' ? 'bg-red-500' : 'bg-slate-400'}`} />
      {status || 'UNKNOWN'}
    </span>
  );
}

function TypeBadge({ type }) {
  if (!type) return <span className="text-slate-400 text-xs">—</span>;
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-50 text-indigo-600 border border-indigo-100">
      {type}
    </span>
  );
}

function PackageSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="h-36 bg-slate-100 rounded-2xl animate-pulse" />
      ))}
    </div>
  );
}

export default function IFlowStudio({ addToast }) {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [iflows, setIflows] = useState([]);
  const [iflowsLoading, setIflowsLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchPackages = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await getPackages('', 100);
      setPackages(res.data.results || []);
    } catch (err) {
      const msg = err.response?.data?.error || err.message;
      setError(msg);
      addToast?.('Failed to load packages: ' + msg, 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => { fetchPackages(); }, [fetchPackages]);

  const selectPackage = async (pkg) => {
    setSelectedPackage(pkg);
    setIflows([]);
    setIflowsLoading(true);
    try {
      const res = await getPackageIflows(pkg.Id);
      setIflows(res.data.results || []);
    } catch (err) {
      addToast?.('Failed to load iFlows: ' + (err.response?.data?.error || err.message), 'error');
    } finally {
      setIflowsLoading(false);
    }
  };

  const filtered = packages.filter(p =>
    !search ||
    p.Name?.toLowerCase().includes(search.toLowerCase()) ||
    p.Id?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col h-full">
      {/* Gradient header bar */}
      <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-white">iFlow Studio</h1>
            <p className="text-indigo-200 text-sm mt-0.5">Browse integration packages and iFlows</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Search inside header */}
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-300" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search packages…"
                className="w-64 bg-white/10 text-white placeholder-indigo-300 border border-white/20 rounded-xl pl-9 pr-4 py-2 text-sm focus:outline-none focus:bg-white/20"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-indigo-300 hover:text-white">
                  <X size={13} />
                </button>
              )}
            </div>
            <button
              onClick={fetchPackages}
              className="flex items-center gap-2 text-sm font-medium text-indigo-100 bg-white/10 hover:bg-white/20 border border-white/20 px-4 py-2 rounded-xl transition-colors"
            >
              <RefreshCw size={14} />
              Refresh
            </button>
            <button className="flex items-center gap-2 text-sm font-medium text-indigo-700 bg-white hover:bg-indigo-50 px-4 py-2 rounded-xl shadow-sm transition-colors">
              <Plus size={14} />
              New iFlow
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Error */}
        {error && (
          <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            <AlertTriangle size={16} className="flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Packages grid */}
        {loading ? (
          <PackageSkeleton />
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <Package size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">{search ? 'No packages match your search' : 'No packages found'}</p>
          </div>
        ) : (
          <div>
            <p className="text-sm text-slate-500 mb-3">{filtered.length} package{filtered.length !== 1 ? 's' : ''} found</p>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map(pkg => (
                <motion.button
                  key={pkg.Id}
                  onClick={() => selectPackage(pkg)}
                  whileHover={{ y: -3 }}
                  className={`text-left bg-white rounded-2xl border p-5 shadow-sm transition-all
                    ${selectedPackage?.Id === pkg.Id
                      ? 'border-indigo-400 ring-2 ring-indigo-100'
                      : 'border-slate-200 hover:border-indigo-300'}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
                      <Package size={18} className="text-indigo-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="font-semibold text-slate-800 text-sm truncate">{pkg.Name || pkg.Id}</div>
                        {pkg.Version && (
                          <span className="text-xs bg-slate-100 text-slate-500 border border-slate-200 px-1.5 py-0.5 rounded font-medium flex-shrink-0">
                            v{pkg.Version}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5 truncate">ID: {pkg.Id}</div>
                      {pkg.Description && (
                        <div className="text-xs text-slate-500 mt-1.5 line-clamp-2 leading-snug">{pkg.Description}</div>
                      )}
                    </div>
                    <ChevronRight size={14} className={`flex-shrink-0 mt-0.5 ${selectedPackage?.Id === pkg.Id ? 'text-indigo-500' : 'text-slate-300'}`} />
                  </div>
                </motion.button>
              ))}
            </div>
          </div>
        )}

        {/* iFlows panel */}
        <AnimatePresence>
          {selectedPackage && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
                <div className="flex items-center gap-2">
                  <GitBranch size={16} className="text-indigo-500" />
                  <h2 className="text-base font-semibold text-slate-700">
                    {selectedPackage.Name} — iFlows
                  </h2>
                </div>
                <button
                  onClick={() => setSelectedPackage(null)}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100"
                >
                  <X size={16} />
                </button>
              </div>

              {iflowsLoading ? (
                <div className="flex items-center justify-center py-12 gap-3 text-slate-400">
                  <Loader2 size={20} className="animate-spin" />
                  <span className="text-sm">Loading iFlows…</span>
                </div>
              ) : iflows.length === 0 ? (
                <div className="text-center py-10 text-slate-400">
                  <GitBranch size={32} className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No iFlows found in this package</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-100">
                      <tr>
                        <th className="text-left py-3 px-5 text-xs font-semibold text-slate-400 uppercase tracking-wide">Name</th>
                        <th className="text-left py-3 px-5 text-xs font-semibold text-slate-400 uppercase tracking-wide">Status</th>
                        <th className="text-left py-3 px-5 text-xs font-semibold text-slate-400 uppercase tracking-wide">Version</th>
                        <th className="text-left py-3 px-5 text-xs font-semibold text-slate-400 uppercase tracking-wide">Type</th>
                        <th className="py-3 px-5 text-xs font-semibold text-slate-400 uppercase tracking-wide text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {iflows.map((iflow, i) => (
                        <tr key={iflow.Id || i} className={`border-b border-slate-50 hover:bg-slate-50 transition-colors ${i % 2 === 0 ? '' : 'bg-slate-50/40'}`}>
                          <td className="py-3 px-5 font-medium text-slate-700">{iflow.Name || iflow.Id}</td>
                          <td className="py-3 px-5">
                            {iflow.Status ? <StatusPill status={iflow.Status} /> : <span className="text-slate-300 text-xs">—</span>}
                          </td>
                          <td className="py-3 px-5 text-slate-500 text-xs">{iflow.Version || '—'}</td>
                          <td className="py-3 px-5">
                            <TypeBadge type={iflow.ArtifactType || iflow.Type} />
                          </td>
                          <td className="py-3 px-5 text-right">
                            <button className="text-xs text-indigo-600 hover:text-indigo-800 font-medium bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors">
                              Deploy
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
