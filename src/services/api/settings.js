import { apiGet, apiPatch } from '@/lib/apiClient';

export const getSettings = () => apiGet('/settings');
export const updateSettings = (data) => apiPatch('/settings', data);
