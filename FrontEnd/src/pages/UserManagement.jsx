import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  UserPlus, Trash2, Edit2, Shield, ShieldOff,
  Eye, EyeOff, X, Save, Loader2, Users, Check,
} from 'lucide-react';
import { getUsers, addUser, updateUser, deleteUser, initials } from '../users';

const ROLES = [
  'Integration Consultant',
  'Integration Architect',
  'SAP BTP Developer',
  'Platform Engineer',
  'IT Administrator',
];

const ROLE_COLOR = {
  'Integration Architect': 'bg-purple-100 text-purple-700',
  'Integration Consultant': 'bg-indigo-100 text-indigo-700',
  'SAP BTP Developer': 'bg-blue-100 text-blue-700',
  'Platform Engineer': 'bg-green-100 text-green-700',
  'IT Administrator': 'bg-red-100 text-red-700',
};

function Modal({ title, onClose, children }) {
  return (
    <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <motion.div initial={{ opacity:0, scale:0.96, y:12 }} animate={{ opacity:1, scale:1, y:0 }}
        exit={{ opacity:0, scale:0.96, y:12 }} transition={{ duration:0.2 }}
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <span className="font-bold text-slate-800">{title}</span>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        {children}
      </motion.div>
    </motion.div>
  );
}

function UserForm({ initial = {}, onSave, onCancel, saving }) {
  const [form, setForm] = useState({
    name: initial.name || '',
    email: initial.email || '',
    role: initial.role || ROLES[0],
    password: initial.password || '',
    isAdmin: initial.isAdmin || false,
  });
  const [showPwd, setShowPwd] = useState(false);
  const [err, setErr] = useState('');
  const isEdit = !!initial.id;

  const set = (k, v) => { setForm(p => ({ ...p, [k]: v })); setErr(''); };

  const submit = (e) => {
    e.preventDefault();
    if (!form.name.trim())  { setErr('Name is required.'); return; }
    if (!form.email.trim()) { setErr('Email is required.'); return; }
    if (!isEdit && !form.password.trim()) { setErr('Password is required.'); return; }
    onSave(form);
  };

  return (
    <form onSubmit={submit}>
      <div className="px-6 py-5 space-y-4">
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">Full Name</label>
          <input value={form.name} onChange={e => set('name', e.target.value)}
            placeholder="Jane Smith"
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email</label>
          <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
            placeholder="jane@company.com" disabled={isEdit}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:opacity-50" />
          {isEdit && <p className="text-xs text-slate-400 mt-1">Email cannot be changed after creation.</p>}
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">Role</label>
          <select value={form.role} onChange={e => set('role', e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400">
            {ROLES.map(r => <option key={r}>{r}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">
            {isEdit ? 'New Password (leave blank to keep current)' : 'Password'}
          </label>
          <div className="relative">
            <input type={showPwd ? 'text' : 'password'} value={form.password}
              onChange={e => set('password', e.target.value)}
              placeholder={isEdit ? 'Leave blank to keep current' : 'Min 6 characters'}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            <button type="button" onClick={() => setShowPwd(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </div>
        <label className="flex items-center gap-3 cursor-pointer select-none">
          <div onClick={() => set('isAdmin', !form.isAdmin)}
            className={`w-10 h-5 rounded-full transition-colors flex items-center ${form.isAdmin ? 'bg-indigo-600' : 'bg-slate-300'}`}>
            <span className={`w-4 h-4 bg-white rounded-full shadow transition-transform mx-0.5 ${form.isAdmin ? 'translate-x-5' : 'translate-x-0'}`} />
          </div>
          <span className="text-sm font-medium text-slate-700">Administrator</span>
          <span className="text-xs text-slate-400">(can manage users)</span>
        </label>
        {err && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">{err}</div>
        )}
      </div>
      <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex gap-3 justify-end">
        <button type="button" onClick={onCancel}
          className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 border border-slate-200 rounded-xl hover:bg-white transition-colors">
          Cancel
        </button>
        <button type="submit" disabled={saving}
          className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors disabled:opacity-50">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add User'}
        </button>
      </div>
    </form>
  );
}

export default function UserManagement({ addToast, currentUser }) {
  const [users, setUsers]       = useState([]);
  const [showAdd, setShowAdd]   = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [saving, setSaving]     = useState(false);

  const reload = () => setUsers(getUsers());
  useEffect(() => { reload(); }, []);

  const handleAdd = (form) => {
    setSaving(true);
    try {
      addUser(form);
      reload();
      setShowAdd(false);
      addToast(`User ${form.name} added successfully!`, 'success');
    } catch (e) {
      addToast(e.message, 'error');
    } finally { setSaving(false); }
  };

  const handleEdit = (form) => {
    setSaving(true);
    const updates = { name: form.name, role: form.role, isAdmin: form.isAdmin };
    if (form.password.trim()) updates.password = form.password;
    updateUser(editUser.id, updates);
    reload();
    setEditUser(null);
    setSaving(false);
    addToast('User updated successfully!', 'success');
  };

  const handleDelete = (user) => {
    if (user.id === currentUser?.id) { addToast('You cannot delete your own account.', 'error'); return; }
    deleteUser(user.id);
    reload();
    setDeleteConfirm(null);
    addToast(`User ${user.name} removed.`, 'success');
  };

  return (
    <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} className="p-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
            <Users size={28} className="text-indigo-500" />
            User Management
          </h1>
          <p className="text-slate-500 mt-1">{users.length} registered {users.length === 1 ? 'user' : 'users'}</p>
        </div>
        {currentUser?.isAdmin && (
          <button onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl shadow-sm transition-colors">
            <UserPlus size={16} /> Add User
          </button>
        )}
      </div>

      {/* User list */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="grid grid-cols-[auto_1fr_1fr_auto_auto] gap-0 text-xs font-semibold text-slate-400 uppercase tracking-wider px-6 py-3 border-b border-slate-100 bg-slate-50">
          <span className="w-10" />
          <span>Name / Email</span>
          <span>Role</span>
          <span className="w-20 text-center">Admin</span>
          {currentUser?.isAdmin && <span className="w-20 text-center">Actions</span>}
        </div>

        {users.length === 0 && (
          <div className="px-6 py-12 text-center text-slate-400">
            No users yet. Add the first user to get started.
          </div>
        )}

        {users.map((user, i) => (
          <motion.div key={user.id}
            initial={{ opacity:0, x:-10 }} animate={{ opacity:1, x:0 }} transition={{ delay: i * 0.05 }}
            className={`grid grid-cols-[auto_1fr_1fr_auto_auto] gap-0 items-center px-6 py-4 border-b border-slate-50 hover:bg-slate-50 transition-colors
              ${user.id === currentUser?.id ? 'bg-indigo-50/40' : ''}`}>

            {/* Avatar */}
            <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${user.color} flex items-center justify-center text-white text-xs font-bold mr-4 flex-shrink-0`}>
              {initials(user.name)}
            </div>

            {/* Name / Email */}
            <div className="min-w-0 pr-4">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-800">{user.name}</span>
                {user.id === currentUser?.id && (
                  <span className="text-xs bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full font-medium">You</span>
                )}
              </div>
              <div className="text-xs text-slate-400 truncate">{user.email}</div>
            </div>

            {/* Role */}
            <div className="pr-4">
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${ROLE_COLOR[user.role] || 'bg-slate-100 text-slate-600'}`}>
                {user.role}
              </span>
            </div>

            {/* Admin badge */}
            <div className="w-20 flex justify-center">
              {user.isAdmin
                ? <Shield size={16} className="text-indigo-500" title="Administrator" />
                : <ShieldOff size={16} className="text-slate-300" title="Standard user" />}
            </div>

            {/* Actions */}
            {currentUser?.isAdmin && (
              <div className="w-20 flex items-center justify-center gap-1">
                <button onClick={() => setEditUser(user)}
                  className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Edit">
                  <Edit2 size={14} />
                </button>
                <button onClick={() => setDeleteConfirm(user)}
                  disabled={user.id === currentUser?.id}
                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed" title="Delete">
                  <Trash2 size={14} />
                </button>
              </div>
            )}
          </motion.div>
        ))}
      </div>

      {/* Note for non-admins */}
      {!currentUser?.isAdmin && (
        <p className="text-sm text-slate-400 mt-4 flex items-center gap-2">
          <Shield size={14} /> Only administrators can add or edit users.
        </p>
      )}

      {/* Add modal */}
      <AnimatePresence>
        {showAdd && (
          <Modal title="Add New User" onClose={() => setShowAdd(false)}>
            <UserForm onSave={handleAdd} onCancel={() => setShowAdd(false)} saving={saving} />
          </Modal>
        )}
        {editUser && (
          <Modal title={`Edit — ${editUser.name}`} onClose={() => setEditUser(null)}>
            <UserForm initial={editUser} onSave={handleEdit} onCancel={() => setEditUser(null)} saving={saving} />
          </Modal>
        )}
        {deleteConfirm && (
          <Modal title="Remove User" onClose={() => setDeleteConfirm(null)}>
            <div className="px-6 py-5">
              <p className="text-sm text-slate-700">
                Are you sure you want to remove <strong>{deleteConfirm.name}</strong>?
                They will no longer be able to sign in.
              </p>
              <div className="flex gap-3 mt-5 justify-end">
                <button onClick={() => setDeleteConfirm(null)}
                  className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50">Cancel</button>
                <button onClick={() => handleDelete(deleteConfirm)}
                  className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors">
                  <Trash2 size={14} /> Remove User
                </button>
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
