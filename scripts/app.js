import { loadData, saveData, resetData } from './storage.js';
import { categories, formatCurrency, todayISO } from './utils.js';
import { validateExpense, buildExpense, insertExpense, getRecentExpenses, sumByMonth, totalsByCategory, deleteExpense } from './expenseManager.js';
import { setMonthlyBudget, budgetSnapshot } from './budgetManager.js';
import { fetchRates, convertAmount, fetchAdvice } from './api.js';
import { applyTheme, initThemeToggle } from './theme.js';

const state = {
  data: loadData(),
  advice: null,
  adviceStatus: 'idle',
  adviceError: '',
  ratesStatus: 'idle',
  filters: {
    category: 'all',
  },
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
  budgetAlert: document.getElementById('budget-alert'),
  filterCategory: document.getElementById('filter-category'),
  allExpenses: document.getElementById('all-expenses'),
  historyEmpty: document.getElementById('history-empty'),
  clearData: document.getElementById('clear-data'),
  pieStatus: document.getElementById('pie-status'),
  barStatus: document.getElementById('bar-status'),
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

const charts = {
  pie: null,
  bar: null,
};

function parseCurrencyInput(value) {
  if (!value) return 0;
  const cleaned = value.toString().replace(/[^0-9]/g, '');
  const parsed = Number.parseInt(cleaned, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCurrencyInput(value) {
  const num = parseCurrencyInput(value);
  if (!num) return '';
  return `$${num.toLocaleString('en-US')}`;
}

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
      if (window.innerWidth <= 720) {
        const nav = document.querySelector('.nav');
        const toggle = document.querySelector('.menu-toggle');
        nav?.classList.remove('open');
        if (toggle) toggle.setAttribute('aria-expanded', 'false');
      }
    });
  });
}

function switchView(viewName) {
  selectors.views.forEach((view) => view.classList.toggle('active', view.dataset.view === viewName));
  selectors.navLinks.forEach((link) => link.classList.toggle('active', link.dataset.target === viewName));
}

function renderFilterOptions() {
  const options = ['all', ...categories];
  selectors.filterCategory.innerHTML = options
    .map((value) => `<option value="${value}">${value === 'all' ? 'All categories' : value}</option>`)
    .join('');
  selectors.filterCategory.value = state.filters.category;
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
  selectors.budgetAlert.textContent = snapshot.overBudget ? 'Budget exceeded!' : '';
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
    li.className = 'list-item fade-in';
    li.innerHTML = `<div><strong>${item.description || item.category}</strong><div class="meta">${formatDate(item.date)} • ${
      item.category
    }</div></div><div>${formatCurrency(item.amount)}</div>`;
    selectors.recentList.appendChild(li);
  });
}

function getFilteredExpenses() {
  const sorted = [...state.data.expenses].sort((a, b) => new Date(b.date) - new Date(a.date));
  if (state.filters.category === 'all') return sorted;
  return sorted.filter((item) => item.category === state.filters.category);
}

function getLastMonths(count = 6) {
  const now = new Date();
  const months = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    months.push({ key, label: d.toLocaleDateString('en-US', { month: 'short' }) });
  }
  return months;
}

function ensureChart(key, ctx, config) {
  if (!window.Chart || !ctx) return;
  if (charts[key]) {
    charts[key].destroy();
  }
  charts[key] = new Chart(ctx, config);
}

function renderCharts() {
  if (!window.Chart) {
    selectors.pieStatus.textContent = 'Charts unavailable (Chart.js not loaded).';
    selectors.barStatus.textContent = 'Charts unavailable (Chart.js not loaded).';
    return;
  }
  const monthKey = budgetSnapshot(state.data).monthKey;
  const totals = totalsByCategory(state.data.expenses, monthKey);
  const labels = Object.keys(totals);
  const values = Object.values(totals);

  if (!labels.length) {
    selectors.pieStatus.textContent = 'Add expenses to see category breakdown.';
    if (charts.pie) {
      charts.pie.destroy();
      charts.pie = null;
    }
    const pieCanvas = document.getElementById('category-pie');
    if (pieCanvas?.getContext) pieCanvas.getContext('2d').clearRect(0, 0, pieCanvas.width, pieCanvas.height);
  } else {
    selectors.pieStatus.textContent = '';
    ensureChart(
      'pie',
      document.getElementById('category-pie'),
      {
        type: 'pie',
        data: {
          labels,
          datasets: [
            {
              data: values,
              backgroundColor: ['#2e86c1', '#1a5276', '#abebc6', '#e74c3c', '#f2c94c', '#8e44ad'],
            },
          ],
        },
        options: {
          plugins: {
            legend: { position: 'bottom' },
          },
        },
      }
    );
  }

  const months = getLastMonths(6);
  const barLabels = months.map((m) => m.label);
  const barData = months.map((m) => sumByMonth(state.data.expenses, m.key));

  if (!barData.some((value) => value > 0)) {
    selectors.barStatus.textContent = 'Add expenses to see monthly totals.';
    if (charts.bar) {
      charts.bar.destroy();
      charts.bar = null;
    }
    const barCanvas = document.getElementById('monthly-bar');
    if (barCanvas?.getContext) barCanvas.getContext('2d').clearRect(0, 0, barCanvas.width, barCanvas.height);
  } else {
    selectors.barStatus.textContent = '';
    ensureChart(
      'bar',
      document.getElementById('monthly-bar'),
      {
        type: 'bar',
        data: {
          labels: barLabels,
          datasets: [
            {
              label: 'Total spent',
              data: barData,
              backgroundColor: '#2e86c1',
              borderRadius: 8,
            },
          ],
        },
        options: {
          scales: {
            y: { beginAtZero: true },
          },
          plugins: {
            legend: { display: false },
          },
        },
      }
    );
  }
}

function renderHistory() {
  const items = getFilteredExpenses();
  selectors.allExpenses.innerHTML = '';
  if (!items.length) {
    selectors.historyEmpty.style.display = 'block';
    selectors.historyEmpty.textContent =
      state.filters.category === 'all'
        ? 'No expenses recorded.'
        : `No expenses in ${state.filters.category}.`;
    return;
  }
  selectors.historyEmpty.style.display = 'none';
  items.forEach((item) => {
    const li = document.createElement('li');
    li.className = 'list-item fade-in';
    li.innerHTML = `<div><strong>${item.description || item.category}</strong><div class="meta">${formatDate(item.date)} • ${
      item.category
    }</div></div><div class="list-actions"><span>${formatCurrency(item.amount)}</span><button class="button danger" data-expense-id="${
      item.id
    }">Delete</button></div>`;
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
  selectors.budgetInput.value = state.data.settings.monthlyBudget
    ? formatCurrency(state.data.settings.monthlyBudget)
    : '';
  selectors.themeToggle.checked = state.data.settings.theme === 'dark';
}

function render() {
  renderBudget();
  renderRecent();
  renderHistory();
  renderAdvice();
  renderSettings();
  renderCharts();
}

function handleExpenseSubmit(event) {
  event.preventDefault();
  selectors.expenseStatus.textContent = '';
  const payload = {
    amount: parseCurrencyInput(selectors.expenseAmount.value),
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
  const budgetValue = parseCurrencyInput(selectors.budgetInput.value);
  state.data = setMonthlyBudget(state.data, budgetValue);
  saveData(state.data);
  selectors.budgetInput.value = formatCurrencyInput(budgetValue);
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
    selectors.budgetInput.value = '';
    populateCategories();
    renderFilterOptions();
    updateCurrencyOptions(buildCurrencyCodes(state.data.cache));
    applyTheme(state.data.settings.theme);
    render();
  });
  selectors.adviceRefresh.addEventListener('click', loadAdvice);
  selectors.filterCategory.addEventListener('change', (event) => {
    state.filters.category = event.target.value;
    renderHistory();
  });
  selectors.budgetInput.addEventListener('focus', () => {
    selectors.budgetInput.value = parseCurrencyInput(selectors.budgetInput.value) || '';
  });
  selectors.budgetInput.addEventListener('blur', () => {
    selectors.budgetInput.value = formatCurrencyInput(selectors.budgetInput.value);
  });
  const syncFormatted = (inputEl) => {
    const formatted = formatCurrencyInput(inputEl.value);
    inputEl.value = formatted;
    const end = inputEl.value.length;
    inputEl.setSelectionRange(end, end);
  };

  selectors.budgetInput.addEventListener('input', () => syncFormatted(selectors.budgetInput));
  selectors.expenseAmount.addEventListener('input', () => syncFormatted(selectors.expenseAmount));
  selectors.expenseAmount.addEventListener('focus', () => {
    selectors.expenseAmount.value = parseCurrencyInput(selectors.expenseAmount.value) || '';
  });
  selectors.expenseAmount.addEventListener('blur', () => {
    syncFormatted(selectors.expenseAmount);
  });
  selectors.allExpenses.addEventListener('click', (event) => {
    const target = event.target;
    if (target.matches('button[data-expense-id]')) {
      const id = target.getAttribute('data-expense-id');
      state.data = deleteExpense(state.data, id);
      saveData(state.data);
      renderBudget();
      renderRecent();
      renderHistory();
      renderCharts();
    }
  });
  const menuToggle = document.querySelector('.menu-toggle');
  const nav = document.querySelector('.nav');
  if (menuToggle && nav) {
    menuToggle.addEventListener('click', () => {
      const isOpen = nav.classList.toggle('open');
      menuToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });
  }
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
  renderFilterOptions();
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
