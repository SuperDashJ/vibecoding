const modelInput = document.getElementById('modelInput');
const modelOptions = document.getElementById('modelOptions');
const priceInput = document.getElementById('priceInput');
const currencySelect = document.getElementById('currencySelect');
const sizeInput = document.getElementById('sizeInput');
const batchSelect = document.getElementById('batchSelect');
const verdictText = document.getElementById('verdictText');
const contextOutput = document.getElementById('contextOutput');
const formMessage = document.getElementById('formMessage');
const historyList = document.getElementById('historyList');
const clearHistoryButton = document.getElementById('clearHistory');
const shareButton = document.getElementById('shareButton');

const currencies = [
  { code: 'USD', label: 'USD (US Dollar)', rateToUSD: 1 },
  { code: 'EUR', label: 'EUR (Euro)', rateToUSD: 1.08 },
  { code: 'GBP', label: 'GBP (British Pound)', rateToUSD: 1.27 },
  { code: 'CAD', label: 'CAD (Canadian Dollar)', rateToUSD: 0.74 },
  { code: 'AUD', label: 'AUD (Australian Dollar)', rateToUSD: 0.66 },
  { code: 'JPY', label: 'JPY (Japanese Yen)', rateToUSD: 0.007 },
  { code: 'CHF', label: 'CHF (Swiss Franc)', rateToUSD: 1.13 },
  { code: 'SEK', label: 'SEK (Swedish Krona)', rateToUSD: 0.095 },
  { code: 'NZD', label: 'NZD (New Zealand Dollar)', rateToUSD: 0.61 },
  { code: 'SGD', label: 'SGD (Singapore Dollar)', rateToUSD: 0.74 }
];

let models = [];
let lastResult = null;

const historyKey = 'itwi-history';

const verdictOrder = ['Good Buy', 'Meh', 'Overpaying', 'Cooked'];

const formatCurrency = (value, code) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: code,
    maximumFractionDigits: 0
  }).format(value);

const getCurrency = (code) => currencies.find((item) => item.code === code) || currencies[0];

const loadModels = async () => {
  const response = await fetch('/api/models');
  const data = await response.json();
  models = data.models.map((model) => ({
    ...model,
    displayName: `${model.brand} ${model.model}`
  }));

  modelOptions.innerHTML = models
    .map((model) => `<option value="${model.displayName}"></option>`)
    .join('');
};

const setCurrencies = () => {
  currencySelect.innerHTML = currencies
    .map(
      (currency) =>
        `<option value="${currency.code}">${currency.label}</option>`
    )
    .join('');
  currencySelect.value = 'USD';
};

const findModel = (name) => {
  const normalized = name.trim().toLowerCase();
  return models.find(
    (model) => model.displayName.toLowerCase() === normalized
  );
};

const clampVerdict = (verdict, target) => {
  return verdictOrder[Math.max(verdictOrder.indexOf(verdict), verdictOrder.indexOf(target))];
};

const calculateVerdict = ({ priceUsd, retailUsd, batchTier }) => {
  const ratio = priceUsd / retailUsd;
  let verdict = 'Good Buy';

  if (ratio <= 0.9) {
    verdict = 'Good Buy';
  } else if (ratio <= 1.05) {
    verdict = 'Meh';
  } else if (ratio <= 1.3) {
    verdict = 'Overpaying';
  } else {
    verdict = 'Cooked';
  }

  if (batchTier === 'Overhyped / Low Quality' && ratio >= 1) {
    verdict = clampVerdict(verdict, 'Cooked');
  }

  if (batchTier === 'Budget' && ratio >= 1.1) {
    verdict = clampVerdict(verdict, 'Overpaying');
  }

  return { verdict, ratio };
};

const buildContext = ({ model, retailUsd, inputPrice, currency, ratio, batchTier, size }) => {
  const formattedRetail = formatCurrency(retailUsd / currency.rateToUSD, currency.code);
  const formattedInput = formatCurrency(inputPrice, currency.code);
  const ratioPercent = Math.round(ratio * 100);

  const notes = [];
  notes.push(`<span><strong>Retail price:</strong> ${formattedRetail}</span>`);
  notes.push(`<span><strong>Your price:</strong> ${formattedInput}</span>`);
  notes.push(`<span><strong>Retail ratio:</strong> ${ratioPercent}% of retail</span>`);

  if (size) {
    notes.push(`<span><strong>Size:</strong> ${size}</span>`);
  }

  if (batchTier) {
    notes.push(`<span><strong>Rep batch tier:</strong> ${batchTier}</span>`);
  }

  notes.push(`<span><strong>Model:</strong> ${model.displayName}</span>`);

  return notes.join('');
};

const recommendationCopy = (verdict) => {
  switch (verdict) {
    case 'Good Buy':
      return 'Below retail. If you want it, this is a clean pickup.';
    case 'Meh':
      return 'Near retail. Only worth it if you need it now.';
    case 'Overpaying':
      return 'You are above retail. Try to negotiate or wait.';
    default:
      return 'This is cooked. Consider passing or finding a better batch.';
  }
};

const renderHistory = () => {
  const items = JSON.parse(localStorage.getItem(historyKey) || '[]');
  if (!items.length) {
    historyList.innerHTML = '<p class="helper">No history yet.</p>';
    return;
  }

  historyList.innerHTML = items
    .map((item) => {
      return `
        <div class="history-item">
          <div class="history-item__row">
            <strong>${item.model}</strong>
            <span class="badge">${item.verdict}</span>
          </div>
          <div class="history-item__row">
            <span>${item.price}</span>
            <span>${item.date}</span>
          </div>
          ${item.batch ? `<div class="history-item__row"><span>Batch: ${item.batch}</span></div>` : ''}
          <div class="history-item__row">
            <button type="button" data-id="${item.id}">Delete</button>
          </div>
        </div>
      `;
    })
    .join('');

  historyList.querySelectorAll('button').forEach((button) => {
    button.addEventListener('click', () => {
      const id = button.getAttribute('data-id');
      const updated = items.filter((item) => item.id !== id);
      localStorage.setItem(historyKey, JSON.stringify(updated));
      renderHistory();
    });
  });
};

const saveHistory = (entry) => {
  const items = JSON.parse(localStorage.getItem(historyKey) || '[]');
  items.unshift(entry);
  localStorage.setItem(historyKey, JSON.stringify(items.slice(0, 50)));
  renderHistory();
};

const handleSubmit = (event) => {
  event.preventDefault();
  formMessage.textContent = '';

  const modelName = modelInput.value;
  const priceValue = parseFloat(priceInput.value);
  const currency = getCurrency(currencySelect.value);
  const batchTier = batchSelect.value;
  const size = sizeInput.value.trim();

  if (!modelName) {
    formMessage.textContent = 'Model is required.';
    return;
  }

  if (Number.isNaN(priceValue) || priceValue <= 0) {
    formMessage.textContent = 'Enter a valid price.';
    return;
  }

  const model = findModel(modelName);
  if (!model) {
    verdictText.textContent = 'Unknown model';
    contextOutput.innerHTML = '<span>Please select a model from the list.</span>';
    return;
  }

  const priceUsd = priceValue * currency.rateToUSD;
  const retailUsd = model.retail_price_usd;

  const { verdict, ratio } = calculateVerdict({ priceUsd, retailUsd, batchTier });

  verdictText.textContent = verdict;
  contextOutput.innerHTML = `${buildContext({
    model,
    retailUsd,
    inputPrice: priceValue,
    currency,
    ratio,
    batchTier,
    size
  })}<span><strong>Recommendation:</strong> ${recommendationCopy(verdict)}</span>`;

  lastResult = {
    verdict,
    model: model.displayName,
    price: formatCurrency(priceValue, currency.code),
    currency: currency.code
  };

  saveHistory({
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    model: model.displayName,
    verdict,
    price: formatCurrency(priceValue, currency.code),
    batch: batchTier,
    date: new Date().toLocaleString()
  });
};

const handleShare = async () => {
  const shareCopy = lastResult
    ? `${lastResult.model}: ${lastResult.verdict} at ${lastResult.price}. Try it: https://is-this-worth-it.local?ref=FRIEND123`
    : 'Check sneaker prices fast: https://is-this-worth-it.local?ref=FRIEND123';

  try {
    await navigator.clipboard.writeText(shareCopy);
    shareButton.textContent = 'Copied!';
    setTimeout(() => {
      shareButton.textContent = 'Share with friend';
    }, 2000);
  } catch (error) {
    shareButton.textContent = 'Copy failed';
    setTimeout(() => {
      shareButton.textContent = 'Share with friend';
    }, 2000);
  }
};

clearHistoryButton.addEventListener('click', () => {
  localStorage.removeItem(historyKey);
  renderHistory();
});

shareButton.addEventListener('click', handleShare);

document.getElementById('valueForm').addEventListener('submit', handleSubmit);

setCurrencies();
loadModels();
renderHistory();
