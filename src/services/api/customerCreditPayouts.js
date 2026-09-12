import { apiGet, apiPost, apiDelete, withQuery } from '@/lib/apiClient';

export const listCustomerCreditPayouts = (params) => apiGet(withQuery('/customer-credit-payouts', params));
export const createCustomerCreditPayout = (data) => apiPost('/customer-credit-payouts', data);
export const deleteCustomerCreditPayout = (id) => apiDelete(`/customer-credit-payouts/${id}`);