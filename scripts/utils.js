export const categories = ['Food', 'Transport', 'Shopping', 'Bills', 'Others'];

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function getMonthKey(dateInput = new Date()) {
  const d = new Date(dateInput);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function formatCurrency(amount = 0, currency = 'USD') {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Number(amount) || 0);
  } catch (err) {
    return `${currency} ${Number(amount).toFixed(2)}`;
  }
}

export function sanitizeText(value = '') {
  return value.trim().slice(0, 80);
}

export function numeric(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
