import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

export const getHealth = () => api.get('/health');
export const getDashboardStats = () => api.get('/dashboard-stats');
export const getPackages = (search = '', top = 50) =>
  api.get('/packages', { params: { search, top } });
export const getPackageIflows = (packageId) => api.get(`/packages/${packageId}/iflows`);
export const getRuntimeArtifacts = () => api.get('/runtime-artifacts');
export const getMessages = (params = {}) => api.get('/messages', { params });
export const getCredentials = () => api.get('/credentials');
export const getKeystore = () => api.get('/keystore');

export const getConfig = () => api.get('/config');
export const saveConfig = (data) => api.post('/config', data);

export const aiGenerate = (prompt) => api.post('/ai/generate', { prompt });
export const aiAnalyze = (error) => api.post('/ai/analyze', { error });
export const aiOptimize = (code) => api.post('/ai/optimize', { code });
export const aiChat = (message, history = []) => api.post('/ai/chat', { message, history });

export default api;
