import { apiGet, apiPost, apiPatch, apiDelete, withQuery } from '@/lib/apiClient';

export const listCustomers = (params) => apiGet(withQuery('/customers', params));
export const getCustomer = (id) => apiGet(`/customers/${id}`);
export const createCustomer = (data) => apiPost('/customers', data);
export const updateCustomer = (id, data) => apiPatch(`/customers/${id}`, data);
export const deleteCustomer = (id) => apiDelete(`/customers/${id}`);
export const setCustomerOpeningBalance = (id, data) => apiPatch(`/customers/${id}/opening-balance`, data);