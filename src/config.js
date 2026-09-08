// Central place for environment/config values.
// Set VITE_API_BASE_URL in your .env (e.g. https://your-backend.vercel.app/api)
// to point at a real deployment; defaults to a local dev backend otherwise.
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';
