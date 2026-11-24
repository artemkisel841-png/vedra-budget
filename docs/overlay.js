'use strict';

const endpoint = new URL('https://raw.githubusercontent.com/artemkisel841-png/vedra-budget/budget-data/budget.json');
const number = document.getElementById('number');
const currency = document.getElementById('currency');
const output = number.parentElement;
const format = new Intl.NumberFormat('ru-RU');
let revision = -1;

function showBudget(amount) {
  const unset = amount === null;
  number.textContent = unset ? '—' : format.format(amount).replace('-', '−');
  currency.hidden = unset;
  if (unset) {
    output.setAttribute('aria-label', 'Сумма ещё не задана');
    output.style.removeProperty('--number-size');
  } else {
    output.removeAttribute('aria-label');
    const digits = String(Math.abs(amount)).length;
    const signWidth = amount < 0 ? 2 : 1;
    output.style.setProperty('--number-size', `${Math.min(19.5, 145 / (digits + signWidth))}cqw`);
  }
}

async function refreshBudget() {
  try {
    endpoint.searchParams.set('v', Date.now());
    const response = await fetch(endpoint, { cache: 'no-store', signal: AbortSignal.timeout(6000) });
    if (!response.ok) return;
    const state = await response.json();
    if (!Number.isSafeInteger(state.revision) || state.revision <= revision) return;
    if (state.amount !== null && !Number.isSafeInteger(state.amount)) return;
    showBudget(state.amount);
    revision = state.revision;
  } catch {
    // A temporary network failure leaves the latest displayed value in place.
  } finally {
    setTimeout(refreshBudget, 8000);
  }
}

refreshBudget();
