const STORAGE_KEY = 'subkiller_subscriptions';
const CURRENCY_KEY = 'subkiller_currency';
const SUPPORTED_CURRENCIES = ['USD', 'CHF', 'EUR', 'GBP'];

const form = document.getElementById('subscription-form');
const listContainer = document.getElementById('subscription-list');
const totalMonthlyEl = document.getElementById('total-monthly');
const totalYearlyEl = document.getElementById('total-yearly');
const activeCountEl = document.getElementById('active-count');
const possibleSavingsEl = document.getElementById('possible-savings');
const mainYearlyMessageEl = document.getElementById('main-yearly-message');
const clearAllButton = document.getElementById('clear-all');
const currencySelect = document.getElementById('currency');

let subscriptions = loadSubscriptions();
let selectedCurrency = loadCurrency();

function loadSubscriptions() {
  const raw = readStorage(STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.map(normalizeSubscription).filter(Boolean);
  } catch {
    return [];
  }
}

function saveSubscriptions() {
  writeStorage(STORAGE_KEY, JSON.stringify(subscriptions));
}

function loadCurrency() {
  const storedCurrency = readStorage(CURRENCY_KEY);
  return SUPPORTED_CURRENCIES.includes(storedCurrency) ? storedCurrency : 'USD';
}

function saveCurrency() {
  writeStorage(CURRENCY_KEY, selectedCurrency);
}

function createSubscriptionId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function loadCurrency() {
  const storedCurrency = localStorage.getItem(CURRENCY_KEY);
  return SUPPORTED_CURRENCIES.includes(storedCurrency) ? storedCurrency : 'USD';
}

function saveCurrency() {
  localStorage.setItem(CURRENCY_KEY, selectedCurrency);
}

function determineVerdict(usage) {
  const verdictMap = {
    often: 'Keep',
    sometimes: 'Consider',
    rarely: 'Cancel soon',
    never: 'Cancel now',
  };
  return verdictMap[usage] || 'Consider';
}

function getMonthlyCost(price, cycle) {
  if (cycle === 'weekly') return (price * 52) / 12;
  if (cycle === 'yearly') return price / 12;
  return price;
}

function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: selectedCurrency }).format(value);
}

function calculateTotals() {
  let totalMonthly = 0;
  let possibleYearlySavings = 0;

  for (const item of subscriptions) {
    const monthly = getMonthlyCost(item.price, item.cycle);
    totalMonthly += monthly;

    const verdict = determineVerdict(item.usage);
    if (verdict === 'Cancel soon' || verdict === 'Cancel now') {
      possibleYearlySavings += monthly * 12;
    }
  }

  const totalYearly = totalMonthly * 12;

  return {
    totalMonthly,
    totalYearly,
    activeCount: subscriptions.length,
    possibleYearlySavings,
  };
}

function deleteSubscription(id) {
  subscriptions = subscriptions.filter((sub) => sub.id !== id);
  saveSubscriptions();
  renderSubscriptions();
}

function clearAllSubscriptions() {
  subscriptions = [];
  saveSubscriptions();
  renderSubscriptions();
}

function renderSubscriptions() {
  const totals = calculateTotals();

  totalMonthlyEl.textContent = formatCurrency(totals.totalMonthly);
  totalYearlyEl.textContent = formatCurrency(totals.totalYearly);
  activeCountEl.textContent = totals.activeCount;
  possibleSavingsEl.textContent = formatCurrency(totals.possibleYearlySavings);
  mainYearlyMessageEl.textContent = `Your subscriptions cost you ${formatCurrency(totals.totalYearly)} per year.`;

  if (subscriptions.length === 0) {
    listContainer.innerHTML = '<p class="empty-state">Add your first subscription to see your monthly cost, yearly cost, and possible savings.</p>';
    return;
  }

  listContainer.innerHTML = subscriptions
    .map((item) => {
      const monthly = getMonthlyCost(item.price, item.cycle);
      const yearly = monthly * 12;
      const verdict = determineVerdict(item.usage);
      const verdictClass = getVerdictClass(verdict);

      return `
        <article class="subscription-card">
          <h3>${escapeHtml(item.name)}</h3>
          <p class="meta">${escapeHtml(item.category)}</p>
          <p>Original: <strong>${formatCurrency(item.price)}</strong> / ${escapeHtml(item.cycle)}</p>
          <p>Monthly equivalent: <strong>${formatCurrency(monthly)}</strong></p>
          <p>Yearly equivalent: <strong>${formatCurrency(yearly)}</strong></p>
          <p>Usage level: <strong>${escapeHtml(item.usage)}</strong></p>
          <p class="verdict ${verdictClass}">${verdict}</p>
          <button class="btn danger" data-delete-id="${item.id}" type="button">Delete</button>
        </article>
      `;
    })
    .join('');

  listContainer.querySelectorAll('[data-delete-id]').forEach((button) => {
    button.addEventListener('click', () => {
      deleteSubscription(button.dataset.deleteId);
    });
  });
}

form.addEventListener('submit', (event) => {
  event.preventDefault();

  const formData = new FormData(form);
  const name = String(formData.get('name')).trim();
  const price = Number(formData.get('price'));
  const cycle = String(formData.get('cycle'));
  const usage = String(formData.get('usage'));
  const category = String(formData.get('category'));

  if (!name || !Number.isFinite(price) || price < 0) return;

  subscriptions.push({
    id: createSubscriptionId(),
    name,
    price,
    cycle,
    usage,
    category,
  });

  saveSubscriptions();
  renderSubscriptions();
  form.reset();
  form.cycle.value = 'monthly';
  form.usage.value = 'often';
  form.category.value = 'entertainment';
});

currencySelect.value = selectedCurrency;
currencySelect.addEventListener('change', () => {
  selectedCurrency = currencySelect.value;
  saveCurrency();
  renderSubscriptions();
});

clearAllButton.addEventListener('click', clearAllSubscriptions);

renderSubscriptions();