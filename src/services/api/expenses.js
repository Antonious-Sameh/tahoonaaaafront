import { apiGet, apiPost, apiDelete, withQuery } from '@/lib/apiClient';

export const listExpenses = (params) => apiGet(withQuery('/expenses', params));
export const getExpensesSummary = () => apiGet('/expenses/summary');
export const createExpense = (data) => apiPost('/expenses', data);
export const deleteExpense = (id) => apiDelete(`/expenses/${id}`);
