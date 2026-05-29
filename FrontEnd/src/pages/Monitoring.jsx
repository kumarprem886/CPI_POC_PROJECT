import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity, RefreshCw, Loader2, AlertTriangle,
  ChevronDown, ChevronUp, Clock, ToggleLeft, ToggleRight
} from 'lucide-react';
import { getMessages } from '../api';

const STATUS_FILTERS = ['ALL', 'COMPLETED', 'FAILED', 'PROCESSING', 'ESCALATED'];

const STATUS_STYLES = {
  COMPLETED:  { badge: 'bg-green-100 text-green-700 border border-green-200',    dot: 'bg-green-500'   },
  FAILED:     { badge: 'bg-red-100 text-red-700 border border-red-200',          dot: 'bg-red-500'     },
  PROCESSING: { badge: 'bg-blue-100 text-blue-700 border border-blue-200',       dot: 'bg-blue-500 animate-pulse' },
  ESCALATED:  { badge: 'bg-orange-100 text-orange-700 border border-orange-200', dot: 'bg-orange-500'  },
  STARTED:    { badge: 'bg-indigo-100 text-indigo-700 border border-indigo-200', dot: 'bg-indigo-500'  },
};

function StatusBadge({ status }) {
  const s = STATUS_STYLES[status] || { badge: 'bg-slate-100 text-slate-500 border border-slate-200', dot: 'bg-slate-400' };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${s.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {status || 'UNKNOWN'}
    </span>
  );
}

function ExpandedRow({ msg }) {
  const fields = [
    ['Message GUID',            msg.MessageGuid],
    ['Status',                  msg.Status],
    ['Integration Flow',        msg.IntegrationFlowName],
    ['Sender',                  msg.Sender],
    ['Receiver',                msg.Receiver],
    ['Start Time',              msg.LogStart ? new Date(msg.LogStart).toLocaleString() : null],
    ['End Time',                msg.LogEnd   ? new Date(msg.LogEnd).toLocaleString()   : null],
    ['Correlation ID',          msg.CorrelationId],
    ['Application Message ID',  msg.ApplicationMessageId],
    ['Transaction ID',          msg.TransactionId],
  ].filter(([, v]) => v);

  return (
    <motion.tr
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <td colSpan={7} className="px-5 py-4 bg-indigo-50/50 border-b border-slate-100">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {fields.map(([label, value]) => (
            <div key={label}>
              <div className="text-xs text-slate-400 font-medium mb-0.5">{label}</div>
              <div className="text-xs text-slate-700 break-all font-mono bg-white border border-slate-100 rounded-lg px-2 py-1">{value}</div>
            </div>
          ))}
        </div>
      </td>
    </motion.tr>
  );
}

export default function Monitoring({ addToast }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [expandedRow, setExpandedRow] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [error, setError] = useState('');
  const intervalRef = useRef(null);

  const fetchMessages = useCallback(async (filter = statusFilter) => {
    setLoading(true);
    setError('');
    try {
      const params = { top: 50 };
      if (filter !== 'ALL') params.status = filter;
      const res = await getMessages(params);
      setMessages(res.data.results || []);
    } catch (err) {
      const msg = err.response?.data?.error || err.message;
      setError(msg);
      addToast?.('Failed to load messages: ' + msg, 'error');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, addToast]);

  useEffect(() => { fetchMessages(statusFilter); }, [statusFilter]);

  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(() => fetchMessages(statusFilter), 30000);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [autoRefresh, statusFilter, fetchMessages]);

  const completed = messages.filter(m => m.Status === 'COMPLETED').length;
  const failed    = messages.filter(m => m.Status === 'FAILED').length;
  const toggleRow = (id) => setExpandedRow(prev => prev === id ? null : id);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col h-full">
      {/* Gradient header */}
      <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold text-white">Monitoring</h1>
            <p className="text-indigo-200 text-sm mt-0.5">Message processing logs & runtime status</p>
          </div>
          <div className="flex items-center gap-3">
            {autoRefresh && (
              <div className="flex items-center gap-1.5 text-xs text-indigo-200 bg-white/10 border border-white/20 px-3 py-1.5 rounded-xl">
                <Clock size={11} />
                Auto-refreshing every 30s
              </div>
            )}
            <button
              onClick={() => setAutoRefresh(v => !v)}
              className={`flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-xl border transition-all
                ${autoRefresh
                  ? 'bg-white text-indigo-600 border-white'
                  : 'bg-white/10 border-white/20 text-indigo-100 hover:bg-white/20'}`}
            >
              {autoRefresh ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
              Auto-refresh
            </button>
            <button
              onClick={() => fetchMessages(statusFilter)}
              className="flex items-center gap-2 text-sm font-medium bg-white text-indigo-700 hover:bg-indigo-50 px-4 py-2 rounded-xl shadow-sm transition-colors"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </div>

        {/* Filter tabs inside header */}
        <div className="flex gap-2 flex-wrap mt-4">
          {STATUS_FILTERS.map(f => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all
                ${statusFilter === f
                  ? 'bg-white text-indigo-700 border-white shadow-sm'
                  : 'bg-white/10 text-indigo-100 border-white/20 hover:bg-white/20'}`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {/* Summary pills */}
        <div className="flex flex-wrap gap-3">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-2.5 flex items-center gap-2.5">
            <Activity size={14} className="text-slate-400" />
            <span className="text-sm text-slate-500">Total:</span>
            <span className="text-sm font-bold text-slate-800">{messages.length}</span>
          </div>
          <div className="bg-green-50 rounded-xl border border-green-200 px-4 py-2.5 flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-sm text-green-700 font-medium">Completed: {completed}</span>
          </div>
          <div className="bg-red-50 rounded-xl border border-red-200 px-4 py-2.5 flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            <span className="text-sm text-red-700 font-medium">Failed: {failed}</span>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            <AlertTriangle size={16} className="flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16 gap-3 text-slate-400">
              <Loader2 size={24} className="animate-spin" />
              <span className="text-sm">Loading messages…</span>
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <Activity size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">No messages found for this filter</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="text-left py-3 px-5 text-xs font-semibold text-slate-400 uppercase tracking-wide w-10">#</th>
                    <th className="text-left py-3 px-5 text-xs font-semibold text-slate-400 uppercase tracking-wide">Status</th>
                    <th className="text-left py-3 px-5 text-xs font-semibold text-slate-400 uppercase tracking-wide">Integration Flow</th>
                    <th className="text-left py-3 px-5 text-xs font-semibold text-slate-400 uppercase tracking-wide">Sender</th>
                    <th className="text-left py-3 px-5 text-xs font-semibold text-slate-400 uppercase tracking-wide">Start Time</th>
                    <th className="text-left py-3 px-5 text-xs font-semibold text-slate-400 uppercase tracking-wide">Message GUID</th>
                    <th className="py-3 px-5 w-8" />
                  </tr>
                </thead>
                <tbody>
                  {messages.map((msg, i) => {
                    const rowId = msg.MessageGuid || i;
                    const isExpanded = expandedRow === rowId;
                    return (
                      <>
                        <tr
                          key={rowId}
                          className={`border-b border-slate-50 cursor-pointer transition-colors
                            ${isExpanded ? 'bg-indigo-50' : i % 2 === 0 ? 'hover:bg-slate-50' : 'bg-slate-50/50 hover:bg-slate-100/70'}`}
                          onClick={() => toggleRow(rowId)}
                        >
                          <td className="py-3 px-5 text-slate-400 text-xs">{i + 1}</td>
                          <td className="py-3 px-5"><StatusBadge status={msg.Status} /></td>
                          <td className="py-3 px-5 text-slate-700 max-w-[180px] truncate font-medium">{msg.IntegrationFlowName || '—'}</td>
                          <td className="py-3 px-5 text-slate-500">{msg.Sender || '—'}</td>
                          <td className="py-3 px-5 text-slate-400 text-xs whitespace-nowrap">
                            {msg.LogStart ? new Date(msg.LogStart).toLocaleString() : '—'}
                          </td>
                          <td className="py-3 px-5 font-mono text-xs text-slate-400" title={msg.MessageGuid}>
                            {msg.MessageGuid ? msg.MessageGuid.slice(0, 14) + '…' : '—'}
                          </td>
                          <td className="py-3 px-5 text-slate-400">
                            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </td>
                        </tr>
                        <AnimatePresence>
                          {isExpanded && <ExpandedRow key={rowId + '_exp'} msg={msg} />}
                        </AnimatePresence>
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
