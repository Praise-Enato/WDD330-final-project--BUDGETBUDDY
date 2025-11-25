const EXCHANGE_ENDPOINT = 'https://api.exchangerate-api.com/v4/latest/';
const ADVICE_ENDPOINT = 'https://api.adviceslip.com/advice';

export async function fetchRates(base = 'USD') {
  const response = await fetch(`${EXCHANGE_ENDPOINT}${encodeURIComponent(base)}`);
  if (!response.ok) {
    throw new Error(`ExchangeRate API error: ${response.status}`);
  }
  const json = await response.json();
  return {
    base: json.base || base,
    rates: json.rates || {},
    fetchedAt: Date.now(),
  };
}

export function convertAmount(amount, from, to, payload) {
  if (!payload || !payload.rates) return null;
  const base = payload.base;
  const rates = payload.rates;
  const value = Number(amount);
  if (!Number.isFinite(value)) return null;
  if (from === to) return value;
  if (!rates[to]) return null;

  if (from === base) {
    return value * rates[to];
  }

  if (!rates[from]) return null;
  const amountInBase = value / rates[from];
  return amountInBase * rates[to];
}

export async function fetchAdvice() {
  const response = await fetch(ADVICE_ENDPOINT, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Advice API error: ${response.status}`);
  }
  const json = await response.json();
  return {
    id: json?.slip?.id,
    text: json?.slip?.advice || 'Keep spending aligned to what matters most.',
  };
}
