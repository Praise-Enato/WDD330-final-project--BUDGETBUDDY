const STORAGE_KEY = 'budgetbuddy-state-v1';

const defaultData = Object.freeze({
  expenses: [],
  settings: {
    monthlyBudget: 0,
    theme: 'light',
    preferredCurrency: 'USD',
  },
  cache: {
    rates: null,
    ratesBase: 'USD',
    ratesFetchedAt: null,
  },
});

function cloneDefault() {
  return JSON.parse(JSON.stringify(defaultData));
}

function mergeData(raw) {
  return {
    ...cloneDefault(),
    ...(raw || {}),
    settings: {
      ...cloneDefault().settings,
      ...(raw?.settings || {}),
    },
    cache: {
      ...cloneDefault().cache,
      ...(raw?.cache || {}),
    },
  };
}

export function loadData() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return cloneDefault();
    const parsed = JSON.parse(stored);
    return mergeData(parsed);
  } catch (err) {
    console.warn('Failed to read localStorage, using defaults', err);
    return cloneDefault();
  }
}

export function saveData(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.error('Failed to persist data', err);
  }
}

export function resetData() {
  const fresh = cloneDefault();
  saveData(fresh);
  return fresh;
}
