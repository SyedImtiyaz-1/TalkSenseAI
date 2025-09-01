// API configuration utility
const getApiBaseUrl = () => {
  const envUrl = import.meta.env.VITE_BACKEND_HOST;
  if (envUrl) {
    return envUrl.endsWith('/') ? envUrl.slice(0, -1) : envUrl;
  }
  return 'http://localhost:8000';
};

const getWsBaseUrl = () => {
  const envWsUrl = import.meta.env.VITE_WS_HOST;
  if (envWsUrl) {
    return envWsUrl.endsWith('/') ? envWsUrl.slice(0, -1) : envWsUrl;
  }
  
  // Auto-convert HTTP to WS and HTTPS to WSS if only backend host is provided
  const backendUrl = getApiBaseUrl();
  if (backendUrl.startsWith('https://')) {
    return backendUrl.replace('https://', 'wss://');
  } else if (backendUrl.startsWith('http://')) {
    return backendUrl.replace('http://', 'ws://');
  }
  
  return 'ws://localhost:8000';
};

// Helper function to create full API URLs
const createApiUrl = (endpoint) => {
  // In development, use relative paths (handled by Vite proxy)
  // In production, use the full backend URL
  if (import.meta.env.DEV) {
    return endpoint;
  }
  return `${getApiBaseUrl()}${endpoint}`;
};

export { getApiBaseUrl, getWsBaseUrl, createApiUrl };
