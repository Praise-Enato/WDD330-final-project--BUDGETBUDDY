import { categories, getMonthKey, numeric, sanitizeText } from './utils.js';

const categorySet = new Set(categories);
const createId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `exp-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export function validateExpense(payload) {
  const amount = numeric(payload.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { valid: false, message: 'Amount must be greater than 0.' };
  }
  if (!categorySet.has(payload.category)) {
    return { valid: false, message: 'Select a valid category.' };
  }
  if (!payload.date || Number.isNaN(new Date(payload.date).getTime())) {
    return { valid: false, message: 'Enter a valid date.' };
  }
  return { valid: true, message: '' };
}

export function buildExpense(payload) {
  return {
    id: createId(),
    amount: Number(numeric(payload.amount).toFixed(2)),
    category: payload.category,
    description: sanitizeText(payload.description),
    date: payload.date,
    createdAt: new Date().toISOString(),
  };
}

export function insertExpense(data, expense) {
  return {
    ...data,
    expenses: [expense, ...(data.expenses || [])],
  };
}

export function getRecentExpenses(expenses = [], limit = 5) {
  return [...expenses].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, limit);
}

export function sumByMonth(expenses = [], monthKey) {
  return expenses
    .filter((item) => getMonthKey(item.date) === monthKey)
    .reduce((total, item) => total + numeric(item.amount), 0);
}

export function totalsByCategory(expenses = [], monthKey) {
  return expenses
    .filter((item) => getMonthKey(item.date) === monthKey)
    .reduce((acc, item) => {
      const current = acc[item.category] || 0;
      acc[item.category] = current + numeric(item.amount);
      return acc;
    }, {});
}
