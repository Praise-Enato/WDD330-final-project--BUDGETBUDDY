import { getMonthKey, numeric } from './utils.js';
import { sumByMonth } from './expenseManager.js';

export function setMonthlyBudget(data, amount) {
  return {
    ...data,
    settings: {
      ...data.settings,
      monthlyBudget: Math.max(0, Number(numeric(amount).toFixed(2))),
    },
  };
}

export function budgetSnapshot(data) {
  const monthKey = getMonthKey();
  const spent = sumByMonth(data.expenses, monthKey);
  const budget = numeric(data.settings.monthlyBudget);
  const remaining = budget ? budget - spent : null;
  return {
    monthKey,
    budget,
    spent,
    remaining,
    overBudget: budget ? spent > budget : false,
  };
}
