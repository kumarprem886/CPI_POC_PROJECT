// User store backed by localStorage

const KEY = 'cpi_users';

const AVATAR_COLORS = [
  'from-indigo-500 to-purple-600',
  'from-blue-500 to-cyan-500',
  'from-green-500 to-emerald-600',
  'from-orange-500 to-red-500',
  'from-pink-500 to-rose-600',
  'from-violet-500 to-indigo-600',
];

function rand(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

export function getUsers() {
  try { return JSON.parse(localStorage.getItem(KEY)) || []; }
  catch { return []; }
}

function saveUsers(users) {
  localStorage.setItem(KEY, JSON.stringify(users));
}

export function seedDefaultUsers() {
  if (getUsers().length > 0) return;
  saveUsers([
    {
      id: '1',
      name: 'Prem Kumar',
      email: 'prem.am.kumar@accenture.com',
      role: 'Integration Architect',
      password: 'Admin@123',
      isAdmin: true,
      color: AVATAR_COLORS[0],
      createdAt: new Date().toISOString(),
    },
  ]);
}

export function validateLogin(email, password) {
  const users = getUsers();
  if (users.length === 0) {
    // First-run: allow any credentials, create the user
    const name = email.split('@')[0].replace(/[._-]/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
    const newUser = {
      id: Date.now().toString(),
      name, email, role: 'Integration Consultant', password,
      isAdmin: true, color: AVATAR_COLORS[0],
      createdAt: new Date().toISOString(),
    };
    saveUsers([newUser]);
    return { ok: true, user: newUser };
  }
  const found = users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (!found) return { ok: false, error: 'No account found with that email.' };
  if (found.password !== password) return { ok: false, error: 'Incorrect password.' };
  return { ok: true, user: found };
}

export function addUser({ name, email, role, password, isAdmin = false }) {
  const users = getUsers();
  if (users.find(u => u.email.toLowerCase() === email.toLowerCase()))
    throw new Error('A user with that email already exists.');
  const newUser = {
    id: Date.now().toString(),
    name, email, role, password, isAdmin,
    color: rand(AVATAR_COLORS),
    createdAt: new Date().toISOString(),
  };
  saveUsers([...users, newUser]);
  return newUser;
}

export function updateUser(id, updates) {
  const users = getUsers().map(u => u.id === id ? { ...u, ...updates } : u);
  saveUsers(users);
  return users.find(u => u.id === id);
}

export function deleteUser(id) {
  saveUsers(getUsers().filter(u => u.id !== id));
}

export function initials(name = '') {
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?';
}
