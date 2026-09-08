import { apiGet, apiPost, apiPatch, apiDelete, withQuery } from '@/lib/apiClient';

export const listProducts = (params) => apiGet(withQuery('/products', params));
export const getProduct = (id) => apiGet(`/products/${id}`);
export const createProduct = (data) => apiPost('/products', data);
export const updateProduct = (id, data) => apiPatch(`/products/${id}`, data);
export const deleteProduct = (id) => apiDelete(`/products/${id}`);
