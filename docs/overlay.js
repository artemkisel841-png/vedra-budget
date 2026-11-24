import { createBudgetPainter } from './paint-amount.js';

const rawUrl = 'https://raw.githubusercontent.com/artemkisel841-png/vedra-budget/refs/heads/budget-data/budget.json';
const apiUrl = new URL('https://api.github.com/repos/artemkisel841-png/vedra-budget/contents/budget.json?ref=budget-data');
const number = document.getElementById('number');
const currency = document.getElementById('currency');
const output = number.parentElement;
const photo = document.getElementById('sign-photo');
const canvas = document.getElementById('amount-art');
const painter = photo.decode().then(() => createBudgetPainter(photo, canvas));
const format = new Intl.NumberFormat('ru-RU');
let revision = -1;

function showBudget(amount) {
  const unset = amount === null;
  number.textContent = unset ? '—' : format.format(amount).replace('-', '−').replace(/\s/g, '\u202f');
  currency.hidden = unset;
  if (unset) {
    output.setAttribute('aria-label', 'Сумма ещё не задана');
  } else {
    output.removeAttribute('aria-label');
  }
  painter.then((draw) => draw(number.textContent, !currency.hidden)).catch(console.error);
}

async function acceptBudget(response) {
  if (!response.ok) return;
  const state = await response.json();
  if (!Number.isSafeInteger(state.revision) || state.revision <= revision) return;
  if (state.amount !== null && !Number.isSafeInteger(state.amount)) return;
  showBudget(state.amount);
  revision = state.revision;
}

async function refreshRaw() {
  try {
    const response = await fetch(rawUrl, { cache: 'no-store', signal: AbortSignal.timeout(6000) });
    await acceptBudget(response);
  } catch {
    // A temporary network failure leaves the latest displayed value in place.
  } finally {
    setTimeout(refreshRaw, 12000);
  }
}

async function refreshApi() {
  // Raw GitHub files can lag behind branch updates. Check the Contents API
  // separately while staying below its public rate limit from a single source.
  let nextCheck = 75000;
  try {
    apiUrl.searchParams.set('read', Date.now());
    const response = await fetch(apiUrl, {
      cache: 'no-store',
      headers: { Accept: 'application/vnd.github.raw+json' },
      signal: AbortSignal.timeout(6000),
    });
    if (response.status === 403 || response.status === 429) {
      const retryAfter = Number(response.headers.get('Retry-After')) * 1000;
      const resetAt = Number(response.headers.get('X-RateLimit-Reset')) * 1000;
      nextCheck = Math.max(nextCheck, retryAfter || 0, resetAt - Date.now() + 1000);
    } else {
      await acceptBudget(response);
    }
  } catch {
    // The raw file remains available as a fallback.
  } finally {
    setTimeout(refreshApi, nextCheck);
  }
}

showBudget(null);
refreshRaw();
refreshApi();
