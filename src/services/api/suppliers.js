import { apiGet, apiPost, apiPatch, apiDelete, withQuery } from '@/lib/apiClient';

export const listSuppliers = (params) => apiGet(withQuery('/suppliers', params));
export const getSupplier = (id) => apiGet(`/suppliers/${id}`);
export const createSupplier = (data) => apiPost('/suppliers', data);
export const updateSupplier = (id, data) => apiPatch(`/suppliers/${id}`, data);
export const deleteSupplier = (id) => apiDelete(`/suppliers/${id}`);
