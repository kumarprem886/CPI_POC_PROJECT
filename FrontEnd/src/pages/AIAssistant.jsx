import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles, AlertCircle, Zap, MessageSquare,
  Copy, Check, Send, Trash2, Loader2, Bot, User
} from 'lucide-react';
import { aiGenerate, aiAnalyze, aiOptimize, aiChat } from '../api';

const MODES = [
  { id: 'generate', label: 'Generate iFlow', icon: Sparkles,      color: 'indigo' },
  { id: 'analyze',  label: 'Analyze Error',  icon: AlertCircle,   color: 'red'    },
  { id: 'optimize', label: 'Optimize Code',  icon: Zap,           color: 'amber'  },
  { id: 'chat',     label: 'AI Chat',        icon: MessageSquare, color: 'emerald'},
];

const SUGGESTIONS = {
  generate: [
    'S4HANA to Salesforce real-time sync',
    'File to SFTP with PGP encryption',
    'REST to SOAP with fault handling',
    'Ariba to S4 purchase order',
    'Email notification with Gmail adapter',
  ],
  analyze: [
    'com.sap.aii.af.sdk.facade.exception.MessagingException',
    'HTTP 401 Unauthorized on receiver adapter',
    'MessageTransformationException in XSLT mapping',
    'Duplicate message detection failure',
    'Certificate expired SSL handshake error',
  ],
  optimize: [
    'Groovy script reading body as stream',
    'XSLT with repeated XPath evaluations',
    'JavaScript with synchronous loops',
    'Groovy with unclosed resources',
    'Inefficient XML parsing in script',
  ],
};

const CHAT_RECENT_TOPICS = [
  'iFlow error handling best practices',
  'OData adapter configuration',
  'XSLT mapping optimization',
  'Certificate renewal process',
  'Message retry strategies',
];

const PLACEHOLDERS = {
  generate: 'Describe the integration scenario (e.g. "Sync purchase orders from SAP S/4HANA to Salesforce every 30 minutes using OData and REST adapters")…',
  analyze:  'Paste the error message or stack trace from SAP CPI message processing logs…',
  optimize: 'Paste your Groovy, XSLT, or JavaScript code from the iFlow script step…',
};

const MODE_COLORS = {
  indigo:  { pill: 'bg-indigo-600 text-white', btn: 'bg-indigo-600 hover:bg-indigo-700' },
  red:     { pill: 'bg-red-500 text-white',    btn: 'bg-red-500 hover:bg-red-600'       },
  amber:   { pill: 'bg-amber-500 text-white',  btn: 'bg-amber-500 hover:bg-amber-600'   },
  emerald: { pill: 'bg-emerald-500 text-white',btn: 'bg-emerald-500 hover:bg-emerald-600'},
};

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-3 py-2">
      {[0, 1, 2].map(i => (
        <motion.span
          key={i}
          className="w-2 h-2 rounded-full bg-slate-400"
          animate={{ y: [0, -5, 0] }}
          transition={{ repeat: Infinity, duration: 0.8, delay: i * 0.15 }}
        />
      ))}
    </div>
  );
}

export default function AIAssistant({ addToast }) {
  const [mode, setMode] = useState('generate');
  const [input, setInput] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [chatHistory, setChatHistory] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, loading]);

  const handleSubmit = async () => {
    if (!input.trim() || loading) return;
    setLoading(true);
    setResponse('');
    try {
      let res;
      if (mode === 'generate') res = await aiGenerate(input);
      else if (mode === 'analyze') res = await aiAnalyze(input);
      else if (mode === 'optimize') res = await aiOptimize(input);
      setResponse(res.data.response || '');
      addToast?.('AI response generated', 'success');
    } catch (err) {
      const msg = err.response?.data?.error || err.message;
      addToast?.('AI request failed: ' + msg, 'error');
      setResponse('Error: ' + msg);
    } finally {
      setLoading(false);
    }
  };

  const handleChat = async () => {
    if (!chatInput.trim() || loading) return;
    const userMsg = chatInput.trim();
    setChatInput('');
    setChatHistory(h => [...h, { role: 'user', content: userMsg }]);
    setLoading(true);
    try {
      const res = await aiChat(userMsg, chatHistory);
      setChatHistory(h => [...h, { role: 'assistant', content: res.data.response }]);
    } catch (err) {
      const msg = err.response?.data?.error || err.message;
      addToast?.('Chat error: ' + msg, 'error');
      setChatHistory(h => [...h, { role: 'assistant', content: 'Error: ' + msg }]);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(response);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const activeMode = MODES.find(m => m.id === mode);
  const colors = MODE_COLORS[activeMode.color];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-6 space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">AI Assistant</h1>
        <p className="text-slate-500 mt-0.5 text-sm">Powered by Gemini 2.0 Flash — SAP CPI Expert</p>
      </div>

      {/* Mode tabs — pill style */}
      <div className="flex gap-2 flex-wrap">
        {MODES.map(({ id, label, icon: Icon, color }) => (
          <button
            key={id}
            onClick={() => { setMode(id); setInput(''); setResponse(''); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all
              ${mode === id
                ? MODE_COLORS[color].pill + ' shadow-sm'
                : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300'}`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* 2-column layout */}
      {mode !== 'chat' ? (
        <div className="flex gap-5">
          {/* Left col — input + response */}
          <div className="flex-1 space-y-4">
            {/* Input */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
              <h2 className="text-base font-semibold text-slate-700 flex items-center gap-2">
                <activeMode.icon size={16} className="text-indigo-500" />
                {activeMode.label}
              </h2>
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder={PLACEHOLDERS[mode]}
                rows={7}
                className="w-full text-sm text-slate-700 border border-slate-200 rounded-xl p-3 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 placeholder-slate-300"
              />
              <button
                onClick={handleSubmit}
                disabled={loading || !input.trim()}
                className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium text-white transition-all shadow-sm
                  ${loading || !input.trim() ? 'bg-slate-300 cursor-not-allowed' : colors.btn}`}
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                {loading ? 'Generating…' : 'Generate with AI'}
              </button>
            </div>

            {/* Response */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-slate-700">AI Response</h2>
                {response && (
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600"
                  >
                    {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                )}
              </div>
              {loading ? (
                <div className="flex flex-col items-center justify-center h-48 gap-3 text-slate-400">
                  <Loader2 size={28} className="animate-spin text-indigo-400" />
                  <p className="text-sm">Generating AI response…</p>
                </div>
              ) : response ? (
                <pre className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed font-mono bg-slate-50 rounded-xl p-4 overflow-auto max-h-96 border border-slate-100">
                  {response}
                </pre>
              ) : (
                <div className="flex flex-col items-center justify-center h-48 gap-3 text-slate-300">
                  <Bot size={36} />
                  <p className="text-sm">AI response will appear here</p>
                </div>
              )}
            </div>
          </div>

          {/* Right col — quick prompts */}
          <div className="w-72 flex-shrink-0">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sticky top-4">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Quick Prompts</h3>
              <div className="space-y-2">
                {(SUGGESTIONS[mode] || []).map(s => (
                  <button
                    key={s}
                    onClick={() => setInput(s)}
                    className="w-full text-left text-xs px-3 py-2.5 rounded-xl bg-slate-50 text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 border border-slate-100 hover:border-indigo-200 transition-colors leading-snug"
                  >
                    {s}
                  </button>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t border-slate-100">
                <div className="text-xs text-slate-400 mb-2">Tips</div>
                <ul className="text-xs text-slate-500 space-y-1.5">
                  <li>• Be specific about adapters and endpoints</li>
                  <li>• Include error codes when analyzing</li>
                  <li>• Paste full stack traces for best results</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Chat mode */
        <div className="flex gap-5">
          {/* Chat panel */}
          <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col" style={{ height: '68vh' }}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                  <Bot size={15} className="text-emerald-600" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-700">SAP CPI Expert</div>
                  <div className="text-xs text-emerald-500">Online</div>
                </div>
              </div>
              <button
                onClick={() => setChatHistory([])}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200 text-slate-500"
              >
                <Trash2 size={12} />
                Clear chat
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {chatHistory.length === 0 && (
                <div className="text-center py-12 text-slate-400">
                  <Bot size={36} className="mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Ask me anything about SAP CPI!</p>
                  <p className="text-xs mt-1 opacity-70">iFlow design, adapters, troubleshooting, best practices…</p>
                </div>
              )}
              <AnimatePresence>
                {chatHistory.map((msg, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex items-start gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                  >
                    <div className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-white
                      ${msg.role === 'user' ? 'bg-indigo-500' : 'bg-emerald-500'}`}>
                      {msg.role === 'user' ? <User size={13} /> : <Bot size={13} />}
                    </div>
                    <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed
                      ${msg.role === 'user'
                        ? 'bg-indigo-600 text-white rounded-tr-sm'
                        : 'bg-slate-100 text-slate-700 rounded-tl-sm'}`}>
                      <pre className="whitespace-pre-wrap font-sans text-sm">{msg.content}</pre>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              {loading && (
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center">
                    <Bot size={13} className="text-white" />
                  </div>
                  <div className="bg-slate-100 rounded-2xl rounded-tl-sm">
                    <TypingIndicator />
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            <div className="px-5 py-4 border-t border-slate-100">
              <div className="flex gap-3">
                <input
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleChat()}
                  placeholder="Ask about SAP CPI (Enter to send)…"
                  className="flex-1 text-sm border border-slate-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-400"
                />
                <button
                  onClick={handleChat}
                  disabled={loading || !chatInput.trim()}
                  className={`px-4 py-2.5 rounded-xl text-white font-medium flex items-center gap-2 text-sm
                    ${loading || !chatInput.trim() ? 'bg-slate-300 cursor-not-allowed' : 'bg-emerald-500 hover:bg-emerald-600'}`}
                >
                  {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                </button>
              </div>
            </div>
          </div>

          {/* Recent Topics panel */}
          <div className="w-72 flex-shrink-0">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Recent Topics</h3>
              <div className="space-y-2">
                {CHAT_RECENT_TOPICS.map((topic, i) => (
                  <button
                    key={i}
                    onClick={() => setChatInput(topic)}
                    className="w-full text-left text-xs px-3 py-2.5 rounded-xl bg-slate-50 text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 border border-slate-100 hover:border-emerald-200 transition-colors"
                  >
                    {topic}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
