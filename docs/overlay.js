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
const revisionKey = 'vedra-budget:last-confirmed-revision';
let revision = -1;
let initialized = false;

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

function lastSeenRevision() {
  try {
    const stored = localStorage.getItem(revisionKey);
    const value = Number(stored);
    if (stored !== null && Number.isSafeInteger(value) && value >= 0) return value;
  } catch {
    // Storage can be disabled in browser sources.
  }
  return -1;
}

async function acceptBudget(response) {
  if (!response.ok) return false;
  const state = await response.json();
  const seen = lastSeenRevision();
  if (!Number.isSafeInteger(state.revision) || state.revision < Math.max(0, revision, seen)) return false;
  if (state.amount !== null && !Number.isSafeInteger(state.amount)) return false;
  if (state.revision > revision) {
    showBudget(state.amount);
    revision = state.revision;
    if (revision > seen) {
      try {
        localStorage.setItem(revisionKey, String(revision));
      } catch {
        // The current page still rejects older revisions in memory.
      }
    }
  }
  return true;
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
  // The uncached Contents API read must complete before the CDN can feed the widget.
  // A reload otherwise gives an older, faster CDN response a blank slate.
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
    } else if (await acceptBudget(response)) {
      if (!initialized) {
        initialized = true;
        refreshRaw();
      }
    } else if (!initialized) {
      nextCheck = 12000;
    }
  } catch {
    if (!initialized) nextCheck = 12000;
  } finally {
    setTimeout(refreshApi, nextCheck);
  }
}

showBudget(null);
refreshApi();
