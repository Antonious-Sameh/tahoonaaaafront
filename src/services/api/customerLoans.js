import { apiGet, apiPost, apiDelete, withQuery } from '@/lib/apiClient';

export const listCustomerLoans = (params) => apiGet(withQuery('/customer-loans', params));
export const createCustomerLoan = (data) => apiPost('/customer-loans', data);
export const deleteCustomerLoan = (id) => apiDelete(`/customer-loans/${id}`);
