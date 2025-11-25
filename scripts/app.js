import { loadData, saveData, resetData } from './storage.js';
import { categories, formatCurrency, todayISO } from './utils.js';
import { validateExpense, buildExpense, insertExpense, getRecentExpenses } from './expenseManager.js';
import { setMonthlyBudget, budgetSnapshot } from './budgetManager.js';
import { fetchRates, convertAmount, fetchAdvice } from './api.js';
import { applyTheme, initThemeToggle } from './theme.js';

const state = {
  data: loadData(),
  advice: null,
  adviceStatus: 'idle',
  adviceError: '',
  ratesStatus: 'idle',
};

const FALLBACK_CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'NGN', 'JPY', 'AUD', 'CHF', 'CNY', 'INR'];
const RATE_TTL_MS = 1000 * 60 * 60 * 12;

const selectors = {
  views: document.querySelectorAll('.view'),
  navLinks: document.querySelectorAll('.nav-link'),
  targets: document.querySelectorAll('[data-target]'),
  homeBudget: document.getElementById('home-budget'),
  homeSpent: document.getElementById('home-spent'),
  homeRemaining: document.getElementById('home-remaining'),
  homeProgress: document.getElementById('home-progress'),
  recentList: document.getElementById('recent-expenses'),
  recentEmpty: document.getElementById('recent-empty'),
  adviceText: document.getElementById('advice-text'),
  adviceStatus: document.getElementById('advice-status'),
  expenseForm: document.getElementById('expense-form'),
  expenseStatus: document.getElementById('expense-status'),
  expenseAmount: document.getElementById('expense-amount'),
  expenseCategory: document.getElementById('expense-category'),
  expenseDescription: document.getElementById('expense-description'),
  expenseDate: document.getElementById('expense-date'),
  dashboardPeriod: document.getElementById('dashboard-period'),
  dashSpent: document.getElementById('dash-spent'),
  dashRemaining: document.getElementById('dash-remaining'),
  allExpenses: document.getElementById('all-expenses'),
  historyEmpty: document.getElementById('history-empty'),
  clearData: document.getElementById('clear-data'),
  converterForm: document.getElementById('converter-form'),
  convertAmount: document.getElementById('convert-amount'),
  convertFrom: document.getElementById('convert-from'),
  convertTo: document.getElementById('convert-to'),
  convertResult: document.getElementById('convert-result'),
  convertStatus: document.getElementById('convert-status'),
  settingsForm: document.getElementById('settings-form'),
  budgetInput: document.getElementById('budget-input'),
  themeToggle: document.getElementById('theme-toggle'),
  settingsStatus: document.getElementById('settings-status'),
  apiCheck: document.getElementById('run-api-checks'),
  apiCheckStatus: document.getElementById('api-check-status'),
  adviceRefresh: document.getElementById('advice-refresh'),
};

function isRatesFresh(cache) {
  return Boolean(cache?.rates && cache?.ratesFetchedAt && Date.now() - cache.ratesFetchedAt < RATE_TTL_MS);
}

function buildCurrencyCodes(cache) {
  const codes = new Set();
  if (cache?.ratesBase) codes.add(cache.ratesBase);
  Object.keys(cache?.rates || {}).forEach((code) => codes.add(code));
  return [...codes].sort();
}

function updateCurrencyOptions(codes = [], preferFrom) {
  const previousFrom = selectors.convertFrom.value;
  const previousTo = selectors.convertTo.value;
  const usable = (codes.length ? codes : FALLBACK_CURRENCIES).filter(Boolean);
  if (!usable.length) return;
  const options = usable.map((code) => `<option value="${code}">${code}</option>`).join('');
  selectors.convertFrom.innerHTML = options;
  selectors.convertTo.innerHTML = options;
  const fromValue = usable.includes(previousFrom)
    ? previousFrom
    : preferFrom && usable.includes(preferFrom)
      ? preferFrom
      : usable[0];
  selectors.convertFrom.value = fromValue;
  const toValue =
    usable.includes(previousTo) && previousTo !== fromValue
      ? previousTo
      : usable.find((code) => code !== fromValue) || fromValue;
  selectors.convertTo.value = toValue;
}

async function ensureRatesAndOptions(preferBase = 'USD') {
  if (isRatesFresh(state.data.cache)) {
    updateCurrencyOptions(buildCurrencyCodes(state.data.cache), state.data.cache.ratesBase);
    return state.data.cache;
  }
  state.ratesStatus = 'loading';
  const payload = await fetchRates(preferBase || 'USD');
  state.data.cache = {
    rates: payload.rates,
    ratesBase: payload.base,
    ratesFetchedAt: payload.fetchedAt,
  };
  saveData(state.data);
  updateCurrencyOptions(buildCurrencyCodes(state.data.cache), payload.base);
  state.ratesStatus = 'ready';
  return state.data.cache;
}

function attachNavigation() {
  selectors.targets.forEach((el) => {
    el.addEventListener('click', (event) => {
      const target = event.currentTarget.dataset.target;
      if (target) switchView(target);
    });
  });
}

function switchView(viewName) {
  selectors.views.forEach((view) => view.classList.toggle('active', view.dataset.view === viewName));
  selectors.navLinks.forEach((link) => link.classList.toggle('active', link.dataset.target === viewName));
}

function populateCategories() {
  selectors.expenseCategory.innerHTML = categories.map((cat) => `<option value="${cat}">${cat}</option>`).join('');
}

function renderBudget() {
  const snapshot = budgetSnapshot(state.data);
  selectors.homeBudget.textContent = snapshot.budget ? formatCurrency(snapshot.budget) : 'Not set';
  selectors.homeSpent.textContent = formatCurrency(snapshot.spent);
  selectors.homeRemaining.textContent = snapshot.budget
    ? `${snapshot.remaining >= 0 ? 'Remaining' : 'Over budget'}: ${formatCurrency(snapshot.remaining)}`
    : 'Set a budget in Settings to start tracking.';

  const progress = snapshot.budget ? Math.min((snapshot.spent / snapshot.budget) * 100, 100) : 0;
  selectors.homeProgress.style.width = `${progress}%`;

  selectors.dashboardPeriod.textContent = snapshot.monthKey;
  selectors.dashSpent.textContent = formatCurrency(snapshot.spent);
  selectors.dashRemaining.textContent = snapshot.budget
    ? formatCurrency(snapshot.remaining)
    : '—';
  selectors.dashRemaining.style.color = snapshot.overBudget ? 'var(--red)' : 'inherit';
}

function renderRecent() {
  const items = getRecentExpenses(state.data.expenses, 5);
  selectors.recentList.innerHTML = '';
  if (!items.length) {
    selectors.recentEmpty.style.display = 'block';
    return;
  }
  selectors.recentEmpty.style.display = 'none';
  items.forEach((item) => {
    const li = document.createElement('li');
    li.className = 'list-item';
    li.innerHTML = `<div><strong>${item.description || item.category}</strong><div class="meta">${formatDate(item.date)} • ${
      item.category
    }</div></div><div>${formatCurrency(item.amount)}</div>`;
    selectors.recentList.appendChild(li);
  });
}

function renderHistory() {
  const items = [...state.data.expenses].sort((a, b) => new Date(b.date) - new Date(a.date));
  selectors.allExpenses.innerHTML = '';
  if (!items.length) {
    selectors.historyEmpty.style.display = 'block';
    return;
  }
  selectors.historyEmpty.style.display = 'none';
  items.forEach((item) => {
    const li = document.createElement('li');
    li.className = 'list-item';
    li.innerHTML = `<div><strong>${item.description || item.category}</strong><div class="meta">${formatDate(item.date)} • ${
      item.category
    }</div></div><div>${formatCurrency(item.amount)}</div>`;
    selectors.allExpenses.appendChild(li);
  });
}

function renderAdvice() {
  if (state.adviceStatus === 'loading') {
    selectors.adviceStatus.textContent = 'Fetching advice...';
  } else if (state.adviceStatus === 'error') {
    selectors.adviceStatus.textContent = `Advice unavailable: ${state.adviceError || 'try again.'}`;
  } else {
    selectors.adviceStatus.textContent = '';
  }
  selectors.adviceText.textContent = state.advice?.text || 'Tap refresh to load a tip.';
}

function renderConverterResult(output) {
  selectors.convertStatus.textContent = '';
  selectors.convertResult.textContent = output || '';
}

function renderSettings() {
  selectors.budgetInput.value = state.data.settings.monthlyBudget || '';
  selectors.themeToggle.checked = state.data.settings.theme === 'dark';
}

function render() {
  renderBudget();
  renderRecent();
  renderHistory();
  renderAdvice();
  renderSettings();
}

function handleExpenseSubmit(event) {
  event.preventDefault();
  selectors.expenseStatus.textContent = '';
  const payload = {
    amount: selectors.expenseAmount.value,
    category: selectors.expenseCategory.value,
    description: selectors.expenseDescription.value,
    date: selectors.expenseDate.value,
  };
  const validation = validateExpense(payload);
  if (!validation.valid) {
    selectors.expenseStatus.textContent = validation.message;
    return;
  }
  const expense = buildExpense(payload);
  state.data = insertExpense(state.data, expense);
  saveData(state.data);
  selectors.expenseForm.reset();
  selectors.expenseDate.value = todayISO();
  selectors.expenseStatus.textContent = 'Expense saved locally.';
  renderBudget();
  renderRecent();
  renderHistory();
}

async function handleConvert(event) {
  event.preventDefault();
  const usingFresh = isRatesFresh(state.data.cache);
  selectors.convertStatus.textContent = usingFresh ? 'Using cached rates...' : 'Fetching rates...';
  selectors.convertResult.textContent = '';
  const amount = selectors.convertAmount.value;
  const from = selectors.convertFrom.value;
  const to = selectors.convertTo.value;
  try {
    const cache = await ensureRatesAndOptions(from || 'USD');
    const converted = convertAmount(amount, from, to, {
      base: cache.ratesBase,
      rates: cache.rates,
    });
    if (converted === null) {
      selectors.convertStatus.textContent = 'Conversion failed. Try different currencies.';
      return;
    }
    selectors.convertStatus.textContent = `Rates updated for ${cache.ratesBase}.`;
    selectors.convertResult.textContent = `${formatCurrency(amount, from)} → ${formatCurrency(converted, to)}`;
  } catch (err) {
    selectors.convertStatus.textContent = `ExchangeRate API error: ${err.message}`;
  }
}

async function loadAdvice() {
  state.adviceStatus = 'loading';
  renderAdvice();
  try {
    const tip = await fetchAdvice();
    state.advice = tip;
    state.adviceStatus = 'ready';
    state.adviceError = '';
    renderAdvice();
  } catch (err) {
    state.adviceStatus = 'error';
    state.adviceError = err.message;
    renderAdvice();
  }
}

function handleSettingsSubmit(event) {
  event.preventDefault();
  const budgetValue = selectors.budgetInput.value;
  state.data = setMonthlyBudget(state.data, budgetValue);
  saveData(state.data);
  selectors.settingsStatus.textContent = 'Settings saved.';
  renderBudget();
}

async function runApiChecks() {
  selectors.apiCheckStatus.textContent = 'Running API checks...';
  try {
    await ensureRatesAndOptions(state.data.cache?.ratesBase || 'USD');
    await fetchAdvice();
    selectors.apiCheckStatus.textContent = 'APIs reachable. Converter and tips ready.';
  } catch (err) {
    selectors.apiCheckStatus.textContent = `API check failed: ${err.message}`;
  }
}

function attachEvents() {
  selectors.expenseForm.addEventListener('submit', handleExpenseSubmit);
  selectors.converterForm.addEventListener('submit', handleConvert);
  selectors.settingsForm.addEventListener('submit', handleSettingsSubmit);
  selectors.apiCheck.addEventListener('click', runApiChecks);
  selectors.clearData.addEventListener('click', () => {
    state.data = resetData();
    selectors.expenseForm.reset();
    selectors.settingsForm.reset();
    selectors.expenseDate.value = todayISO();
    populateCategories();
    updateCurrencyOptions(buildCurrencyCodes(state.data.cache));
    applyTheme(state.data.settings.theme);
    render();
  });
  selectors.adviceRefresh.addEventListener('click', loadAdvice);
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function init() {
  applyTheme(state.data.settings.theme);
  initThemeToggle(selectors.themeToggle, state.data.settings.theme, (theme) => {
    state.data.settings.theme = theme;
    saveData(state.data);
  });
  attachNavigation();
  populateCategories();
  updateCurrencyOptions(buildCurrencyCodes(state.data.cache), state.data.cache.ratesBase);
  ensureRatesAndOptions(state.data.cache?.ratesBase || 'USD').catch((err) => {
    selectors.convertStatus.textContent = `Rates unavailable: ${err.message}`;
  });
  selectors.expenseDate.value = todayISO();
  attachEvents();
  render();
  loadAdvice();
}

document.addEventListener('DOMContentLoaded', init);
