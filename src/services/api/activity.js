import { apiGet, withQuery } from '@/lib/apiClient';

export const listActivity = (params) => apiGet(withQuery('/activity', params));
