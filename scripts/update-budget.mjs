import { setTimeout as delay } from 'node:timers/promises';

const { BUDGET_OPERATION: operation, BUDGET_VALUE: input, GITHUB_REPOSITORY: repo,
  GITHUB_API_URL: api, GITHUB_RUN_ID: runId, GH_TOKEN: token } = process.env;
const branch = 'budget-data';
const rawValue = (input ?? '').replace(/[\s\u202f]/g, '').replace(/^−/, '-');
const value = Number(rawValue);
const isSet = operation === 'Установить';
const isAdd = operation === 'Прибавить';
const isSubtract = operation === 'Вычесть';

if (!api || !repo || !token || !/^\d+$/.test(runId ?? '')) {
  throw new Error('Запуску нужны учётные данные GitHub Actions.');
}
if (!isSet && !isAdd && !isSubtract) throw new Error('Неизвестное действие.');
if (!/^[+-]?\d+$/.test(rawValue) || !Number.isSafeInteger(value)) {
  throw new Error('Введите сумму целым числом в рублях.');
}
if (!isSet && value <= 0) throw new Error('Для прибавления и вычитания введите положительную сумму.');

const endpoint = new URL(`${api}/repos/${repo}/contents/budget.json`);
const readEndpoint = new URL(endpoint);
readEndpoint.searchParams.set('ref', branch);
const headers = {
  'Authorization': `Bearer ${token}`,
  'Accept': 'application/vnd.github+json',
  'Content-Type': 'application/json',
};
for (let attempt = 0; ; attempt += 1) {
  const response = await fetch(readEndpoint, { headers, signal: AbortSignal.timeout(12000) });
  if (!response.ok) throw new Error(`GitHub не прочитал сумму (HTTP ${response.status}).`);
  const file = await response.json();
  const current = JSON.parse(Buffer.from(file.content, 'base64').toString('utf8'));
  if (!file.sha || !Number.isSafeInteger(current.revision) ||
      (current.amount !== null && !Number.isSafeInteger(current.amount)) ||
      !Array.isArray(current.appliedRuns)) {
    throw new Error('Файл суммы повреждён.');
  }

  if (current.appliedRuns.includes(runId)) {
    console.log('Этот запуск уже учтён.');
    break;
  }
  if (!isSet && current.amount === null) {
    throw new Error('Сначала установите начальную сумму.');
  }

  const amount = isSet ? value : current.amount + (isAdd ? value : -value);
  if (!Number.isSafeInteger(amount)) throw new Error('Результат выходит за допустимый диапазон.');

  const next = {
    amount,
    revision: current.revision + 1,
    appliedRuns: [...current.appliedRuns, runId],
  };
  const updated = await fetch(endpoint, {
    method: 'PUT', headers, signal: AbortSignal.timeout(12000),
    body: JSON.stringify({
      message: `${operation} сумму`,
      branch,
      sha: file.sha,
      content: Buffer.from(`${JSON.stringify(next)}\n`).toString('base64'),
    }),
  });

  if (updated.ok) {
    console.log('Сумма сохранена.');
    break;
  }
  if (updated.status !== 409 || attempt >= 6) {
    throw new Error(`GitHub не сохранил сумму (HTTP ${updated.status}).`);
  }
  await delay(150 * (attempt + 1));
}
