import { apiGet, apiPost, withQuery } from '@/lib/apiClient';

// Customer <-> Supplier balance offsets (مقاصة). No delete: a transfer is a
// permanent record. `accountType` is 'customer' | 'supplier'.
export const listAccountBalanceTransfers = (params) => apiGet(withQuery('/account-balance-transfers', params));
export const createAccountBalanceTransfer = (data) => apiPost('/account-balance-transfers', data);
