'use strict';

const DEFAULT_PROVIDERS = [
  { name: 'AWS_like', cost: 1.8 },
  { name: 'Azure_like', cost: 2.2 },
  { name: 'GCP_like', cost: 2.0 }
];
const PALETTE = ['#ff3548', '#ff9b43', '#82e8ff', '#ffd17a', '#b6e1a5', '#ed86a8'];
const PRICE_MIN = 0.5;
const PRICE_MAX = 10.0;
const GRID_SIZE = 200;
const MAX_ITERATIONS = 100;
const CONVERGENCE_TOLERANCE = 1e-3;

function demand(prices, baseDemand, alpha) {
  const utilities = prices.map(price => -alpha * price);
  const maxUtility = Math.max(...utilities);
  const expUtility = utilities.map(value => Math.exp(value - maxUtility));
  const sum = expUtility.reduce((total, value) => total + value, 0);
  return expUtility.map(value => baseDemand * value / sum);
}

function bestResponse(prices, providerIndex, providers, baseDemand, alpha) {
  const candidates = prices.slice();
  let bestPrice = prices[providerIndex];
  let bestProfit = -Infinity;
  for (let step = 0; step < GRID_SIZE; step += 1) {
    const candidatePrice = PRICE_MIN + (PRICE_MAX - PRICE_MIN) * step / (GRID_SIZE - 1);
    candidates[providerIndex] = candidatePrice;
    const allocation = demand(candidates, baseDemand, alpha);
    const candidateProfit = (candidatePrice - providers[providerIndex].cost) * allocation[providerIndex];
    if (candidateProfit > bestProfit) {
      bestProfit = candidateProfit;
      bestPrice = candidatePrice;
    }
  }
  return bestPrice;
}

function findEquilibrium(providers, baseDemand = 2000, alpha = 1.2) {
  let prices = providers.map(provider => provider.cost * 1.5);
  const history = [prices.slice()];
  let converged = false;
  let iterations = 0;

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration += 1) {
    // This intentionally mirrors the supplied Python script: all best responses
    // are calculated against the previous iteration's price vector.
    const newPrices = prices.slice();
    for (let i = 0; i < providers.length; i += 1) {
      newPrices[i] = bestResponse(prices, i, providers, baseDemand, alpha);
    }
    history.push(newPrices.slice());
    iterations = iteration + 1;
    const maxChange = Math.max(...newPrices.map((price, i) => Math.abs(price - prices[i])));
    if (maxChange < CONVERGENCE_TOLERANCE) {
      prices = newPrices;
      converged = true;
      break;
    }
    prices = newPrices;
  }

  const allocations = demand(prices, baseDemand, alpha);
  const rows = providers.map((provider, i) => ({
    name: provider.name,
    cost: provider.cost,
    price: prices[i],
    demand: allocations[i],
    profit: (prices[i] - provider.cost) * allocations[i]
  }));
  return { prices, history, rows, iterations, converged, totalDemand: allocations.reduce((sum, value) => sum + value, 0), totalProfit: rows.reduce((sum, row) => sum + row.profit, 0) };
}

function competitionExperiment() {
  const results = [];
  for (let count = 2; count <= 6; count += 1) {
    const providers = Array.from({ length: count }, (_, i) => ({ name: `Provider_${i + 1}`, cost: 2.0 }));
    const marketDemand = 1000 * count / 3;
    // Same defaults as CloudPricingGame.simulate_competition in the original Python.
    const result = findEquilibrium(providers, marketDemand, 1.5);
    const profits = result.rows.map(row => row.profit);
    results.push({
      nProviders: count,
      avgPrice: result.prices.reduce((sum, price) => sum + price, 0) / count,
      minPrice: Math.min(...result.prices),
      totalDemand: result.totalDemand,
      avgProfit: profits.reduce((sum, value) => sum + value, 0) / count,
      totalProfit: profits.reduce((sum, value) => sum + value, 0)
    });
  }
  return results;
}

function fmt(value, digits = 3) {
  return Number(value).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}
function fmt0(value) { return Math.round(value).toLocaleString('en-US'); }
function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}
function svgText(x, y, value, extra = '') {
  return `<text x="${x}" y="${y}" ${extra}>${escapeHTML(value)}</text>`;
}
function svgLine(x1, y1, x2, y2, stroke = '#2b3f4d', width = 1, dash = '') {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${width}" ${dash ? `stroke-dasharray="${dash}"` : ''}/>`;
}

function renderLineChart(svg, series, xLabels, options = {}) {
  const width = options.width || 720;
  const height = options.height || 300;
  const margin = { left: 52, right: 21, top: 18, bottom: 38 };
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;
  const allValues = series.flatMap(item => item.values);
  let minY = options.minY !== undefined ? options.minY : Math.min(...allValues);
  let maxY = options.maxY !== undefined ? options.maxY : Math.max(...allValues);
  if (minY === maxY) { minY -= 1; maxY += 1; }
  if (options.minY === undefined) { const pad = (maxY - minY) * 0.14; minY -= pad; maxY += pad; }
  const y = value => margin.top + (maxY - value) / (maxY - minY) * plotH;
  const x = index => margin.left + (xLabels.length <= 1 ? plotW / 2 : index / (xLabels.length - 1) * plotW);
  const ticks = options.yTicks || 4;
  let markup = `<rect x="0" y="0" width="${width}" height="${height}" rx="10" fill="#151113"/>`;
  for (let tick = 0; tick <= ticks; tick += 1) {
    const value = minY + (maxY - minY) * tick / ticks;
    const yy = y(value);
    markup += svgLine(margin.left, yy, width - margin.right, yy, '#39272a', 1, '3 5');
    markup += svgText(margin.left - 10, yy + 3.5, options.yFormat ? options.yFormat(value) : value.toFixed(2), 'text-anchor="end" fill="#a58a84" font-size="10" font-family="DM Mono, monospace"');
  }
  markup += svgLine(margin.left, margin.top, margin.left, height - margin.bottom, '#644147', 1);
  markup += svgLine(margin.left, height - margin.bottom, width - margin.right, height - margin.bottom, '#644147', 1);
  const maxXTicks = options.maxXTicks || 6;
  const selectedIndexes = new Set();
  if (xLabels.length <= maxXTicks) xLabels.forEach((_, i) => selectedIndexes.add(i));
  else for (let i = 0; i < maxXTicks; i += 1) selectedIndexes.add(Math.round(i * (xLabels.length - 1) / (maxXTicks - 1)));
  selectedIndexes.forEach(index => {
    markup += svgText(x(index), height - 16, xLabels[index], 'text-anchor="middle" fill="#a58a84" font-size="10" font-family="DM Mono, monospace"');
  });
  series.forEach(item => {
    const points = item.values.map((value, i) => `${x(i)},${y(value)}`).join(' ');
    markup += `<polyline points="${points}" fill="none" stroke="${item.color}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>`;
    const dotIndexes = item.values.length > 16 ? [0, item.values.length - 1] : item.values.map((_, i) => i);
    dotIndexes.forEach(index => { markup += `<circle cx="${x(index)}" cy="${y(item.values[index])}" r="${item.values.length > 16 ? 3 : 3.2}" fill="${item.color}" stroke="#151113" stroke-width="1.2"/>`; });
  });
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.innerHTML = markup;
}

function renderBarChart(svg, rows) {
  const width = 540, height = 290;
  const margin = { left: 44, right: 43, top: 18, bottom: 47 };
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;
  const maxDemand = Math.max(1, ...rows.map(row => row.demand)) * 1.18;
  const maxProfit = Math.max(1, ...rows.map(row => row.profit)) * 1.18;
  const yD = value => margin.top + plotH - value / maxDemand * plotH;
  const yP = value => margin.top + plotH - value / maxProfit * plotH;
  const groupWidth = plotW / rows.length;
  const barWidth = Math.min(22, groupWidth * .24);
  let markup = `<rect x="0" y="0" width="${width}" height="${height}" rx="10" fill="#151113"/>`;
  for (let i = 0; i <= 4; i += 1) {
    const yd = margin.top + plotH - plotH * i / 4;
    markup += svgLine(margin.left, yd, width - margin.right, yd, '#39272a', 1, '3 5');
    markup += svgText(margin.left - 7, yd + 3, fmt0(maxDemand * i / 4), 'text-anchor="end" fill="#d18c89" font-size="9" font-family="DM Mono, monospace"');
    markup += svgText(width - margin.right + 7, yd + 3, fmt0(maxProfit * i / 4), 'text-anchor="start" fill="#f0ad69" font-size="9" font-family="DM Mono, monospace"');
  }
  rows.forEach((row, i) => {
    const cx = margin.left + groupWidth * (i + .5);
    const demandHeight = margin.top + plotH - yD(row.demand);
    const profitHeight = margin.top + plotH - yP(row.profit);
    markup += `<rect x="${cx - barWidth - 2}" y="${yD(row.demand)}" width="${barWidth}" height="${demandHeight}" rx="3" fill="#ff3548" opacity=".9"/>`;
    markup += `<rect x="${cx + 2}" y="${yP(row.profit)}" width="${barWidth}" height="${profitHeight}" rx="3" fill="#ff9b43" opacity=".95"/>`;
    const name = row.name.length > 10 ? `${row.name.slice(0, 9)}…` : row.name;
    markup += svgText(cx, height - 25, name, 'text-anchor="middle" fill="#a6b7c2" font-size="9" font-family="DM Sans, sans-serif"');
  });
  markup += svgText(12, margin.top + plotH / 2, 'Demand', `transform="rotate(-90 12 ${margin.top + plotH / 2})" text-anchor="middle" fill="#ff6b70" font-size="9"`);
  markup += svgText(width - 8, margin.top + plotH / 2, 'Profit', `transform="rotate(90 ${width - 8} ${margin.top + plotH / 2})" text-anchor="middle" fill="#ff9b43" font-size="9"`);
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.innerHTML = markup;
}

function renderProviderEditor(providers) {
  const editor = document.getElementById('providerEditor');
  editor.innerHTML = providers.map((provider, index) => `
    <div class="provider-row" data-index="${index}">
      <input class="provider-name" aria-label="Provider ${index + 1} name" maxlength="24" value="${escapeHTML(provider.name)}" data-field="name" spellcheck="false">
      <input class="provider-cost" aria-label="Provider ${index + 1} marginal cost" type="number" min="0" max="9.5" step="0.1" value="${provider.cost}" data-field="cost" title="Marginal cost">
      <button class="provider-remove" type="button" data-remove="${index}" aria-label="Remove ${escapeHTML(provider.name)}" title="Remove provider" ${providers.length <= 2 ? 'disabled' : ''}>×</button>
    </div>`).join('');
  document.getElementById('providerCount').textContent = `${providers.length} / 6`;
  document.getElementById('addProviderBtn').disabled = providers.length >= 6;
}

function readProviders() {
  const rows = [...document.querySelectorAll('#providerEditor .provider-row')];
  return rows.map((row, index) => {
    const nameInput = row.querySelector('[data-field="name"]');
    const costInput = row.querySelector('[data-field="cost"]');
    const name = nameInput.value.trim() || `Provider_${index + 1}`;
    const cost = Math.max(0, Math.min(9.5, Number.parseFloat(costInput.value) || 0));
    return { name, cost };
  });
}

function renderResults(result, providers, competitionResults) {
  document.getElementById('kpiPrice').textContent = fmt(result.prices.reduce((sum, p) => sum + p, 0) / result.prices.length);
  document.getElementById('kpiDemand').textContent = fmt0(result.totalDemand);
  document.getElementById('kpiProfit').textContent = fmt0(result.totalProfit);
  document.getElementById('kpiIterations').textContent = String(result.iterations);
  document.getElementById('convergenceStatus').textContent = result.converged ? 'Converged' : 'Iteration limit reached';
  document.getElementById('convergenceStatus').style.color = result.converged ? '#6ee7b7' : '#f6bd60';

  document.getElementById('resultsBody').innerHTML = result.rows.map((row, index) => `
    <tr>
      <td><span class="provider-cell"><i class="provider-swatch" style="background:${PALETTE[index % PALETTE.length]}"></i>${escapeHTML(row.name)}</span></td>
      <td>${fmt(row.cost, 2)}</td><td class="price-cell">${fmt(row.price)}</td><td>${fmt(row.demand, 1)}</td><td>${fmt(row.profit, 1)}</td>
    </tr>`).join('');

  renderLineChart(document.getElementById('convergenceChart'), providers.map((provider, index) => ({
    name: provider.name, color: PALETTE[index % PALETTE.length], values: result.history.map(prices => prices[index])
  })), result.history.map((_, index) => String(index)), { width: 720, height: 300, maxXTicks: 7, yFormat: value => value.toFixed(2) });
  document.getElementById('convergenceLegend').innerHTML = providers.map((provider, index) => `<span class="legend-item"><i style="background:${PALETTE[index % PALETTE.length]}"></i>${escapeHTML(provider.name)}</span>`).join('');

  renderLineChart(document.getElementById('competitionChart'), [{ name: 'Average equilibrium price', color: '#ff3548', values: competitionResults.map(row => row.avgPrice) }], competitionResults.map(row => String(row.nProviders)), { width: 540, height: 290, minY: 2.7, maxY: 3.45, yTicks: 3, yFormat: value => value.toFixed(2), maxXTicks: 5 });
  renderBarChart(document.getElementById('demandProfitChart'), result.rows);
  document.getElementById('competitionBody').innerHTML = competitionResults.map(row => `
    <tr><td>${row.nProviders}</td><td class="price-cell">${fmt(row.avgPrice)}</td><td>${fmt0(row.totalDemand)}</td><td>${fmt(row.avgProfit, 1)}</td><td>${fmt0(row.totalProfit)}</td></tr>`).join('');
}

function initApp() {
  const baseDemandInput = document.getElementById('baseDemand');
  const sensitivityInput = document.getElementById('sensitivity');
  let providers = DEFAULT_PROVIDERS.map(provider => ({ ...provider }));
  let runCount = 0;

  function runSimulation() {
    providers = readProviders();
    const baseDemand = Number(baseDemandInput.value);
    const alpha = Number(sensitivityInput.value);
    const result = findEquilibrium(providers, baseDemand, alpha);
    const marketComparison = competitionExperiment();
    renderResults(result, providers, marketComparison);
    runCount += 1;
    document.getElementById('runStatus').textContent = result.converged
      ? `Run ${runCount} complete · converged in ${result.iterations} iterations.`
      : `Run ${runCount} complete · maximum iteration count reached.`;
    document.getElementById('runBtn').focus({ preventScroll: true });
  }

  function updateInputLabels() {
    document.getElementById('baseDemandValue').textContent = fmt0(Number(baseDemandInput.value));
    document.getElementById('sensitivityValue').textContent = Number(sensitivityInput.value).toFixed(2);
  }

  renderProviderEditor(providers);
  updateInputLabels();
  document.getElementById('runBtn').addEventListener('click', runSimulation);
  baseDemandInput.addEventListener('input', updateInputLabels);
  sensitivityInput.addEventListener('input', updateInputLabels);

  document.getElementById('providerEditor').addEventListener('click', event => {
    const removeButton = event.target.closest('[data-remove]');
    if (!removeButton || providers.length <= 2) return;
    providers = readProviders();
    providers.splice(Number(removeButton.dataset.remove), 1);
    renderProviderEditor(providers);
  });
  document.getElementById('addProviderBtn').addEventListener('click', () => {
    if (providers.length >= 6) return;
    providers = readProviders();
    providers.push({ name: `Provider_${providers.length + 1}`, cost: 2.0 });
    renderProviderEditor(providers);
  });
  document.getElementById('resetBtn').addEventListener('click', () => {
    providers = DEFAULT_PROVIDERS.map(provider => ({ ...provider }));
    baseDemandInput.value = '2000';
    sensitivityInput.value = '1.2';
    renderProviderEditor(providers);
    updateInputLabels();
    runSimulation();
  });
  runSimulation();
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', initApp);
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { demand, bestResponse, findEquilibrium, competitionExperiment, DEFAULT_PROVIDERS };
}
