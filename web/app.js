// Lease Mileage Tracker: all math runs in the browser; inputs are remembered in localStorage and can be shared as a link (query string).

const STORAGE_KEY = 'lease-tracker-v1';
const FIELDS = ['start', 'term', 'allowed', 'inception', 'odo', 'asof'];
const DAY_MS = 86400000;

const $ = id => document.getElementById(id);
const fmt = (n, decimals = 0) =>
  n.toLocaleString(undefined, { maximumFractionDigits: decimals, minimumFractionDigits: decimals });

// --- Dates (all UTC so daylight saving never shifts a day count) ---
const toIso = d => d.toISOString().slice(0, 10);
const parseIso = s => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};
// Adds whole months, clamping to the last day of a shorter month (Jan 31 + 1 month = Feb 28/29).
function addMonths(date, months) {
  const result = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(date.getUTCDate(), lastDay));
  return result;
}

// --- Persistence (the "as of" date is never saved; it always starts as today) ---
// Values in the page URL (?start=...&odo=...) win over localStorage, so a shared link always shows what was shared.
function loadInputs() {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch (e) { /* storage unavailable */ }
  const params = new URLSearchParams(location.search);
  const shared = Object.fromEntries(FIELDS.filter(f => params.has(f)).map(f => [f, params.get(f)]));
  const values = { term: 36, allowed: 30000, inception: 0, ...saved, ...shared, asof: shared.asof || toIso(new Date()) };
  FIELDS.forEach(f => { if (values[f] !== undefined && values[f] !== '') $(f).value = values[f]; });
}
function saveInputs() {
  const values = Object.fromEntries(FIELDS.filter(f => f !== 'asof').map(f => [f, $(f).value]));
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(values)); } catch (e) { /* storage unavailable */ }
}

// --- Share link: every input except "as of" (which should default to today for whoever opens it) ---
function shareUrl() {
  const params = new URLSearchParams();
  FIELDS.filter(f => f !== 'asof' && $(f).value !== '').forEach(f => params.set(f, $(f).value));
  return location.origin + location.pathname + '?' + params;
}
async function copyLink() {
  const url = shareUrl();
  let ok = false;
  try { await navigator.clipboard.writeText(url); ok = true; } catch (e) { /* fall through to manual copy */ }
  if (!ok) { window.prompt('Copy this link:', url); }
  $('copyMsg').textContent = ok ? 'Link copied.' : '';
  history.replaceState(null, '', url);
}

// Says what is missing or odd, in plain words; returns true when the results can be shown.
function checkInputs() {
  const val = f => $(f).value;
  const missing = [];
  if (!val('start')) missing.push('lease start date');
  if (!(+val('term') > 0)) missing.push('term (months)');
  if (!(+val('allowed') > 0)) missing.push('total miles allowed');
  if (val('odo') === '') missing.push('current odometer');
  if (!val('asof')) missing.push('as-of date');
  const hint = $('hint');
  if (missing.length) {
    hint.textContent = 'Fill in ' + missing.join(', ') + ' to see your results.';
    return false;
  }
  if (+val('odo') < (+val('inception') || 0)) {
    hint.textContent = 'Current odometer is lower than the odometer at signing; check both.';
  } else if (parseIso(val('asof')) <= parseIso(val('start'))) {
    hint.textContent = 'The as-of date is on or before the lease start, so there is no driving history yet; average pace and projection need at least one day.';
  } else {
    hint.textContent = '';
  }
  return true;
}

// --- Gauges: half-circle SVG, needle at the top = zero difference; left is good (under), right is over. ---
const SVG_NS = 'http://www.w3.org/2000/svg';
function arc(cx, cy, r, from, to) {                      // angles in degrees, 180 = left, 0 = right
  const pt = d => [cx + r * Math.cos(d * Math.PI / 180), cy - r * Math.sin(d * Math.PI / 180)];
  const [x1, y1] = pt(from), [x2, y2] = pt(to);
  return `M${x1.toFixed(1)} ${y1.toFixed(1)} A${r} ${r} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`;
}
function drawGauge(id, diff, range, leftLabel, rightLabel) {
  const svg = $(id), cx = 100, cy = 100, r = 78;
  const t = diff === null ? 0 : Math.max(-1, Math.min(1, diff / range));
  const theta = (90 - t * 90) * Math.PI / 180;           // needle angle
  const nx = cx + (r - 8) * Math.cos(theta), ny = cy - (r - 8) * Math.sin(theta);
  const label = diff === null ? 'no reading yet' : `${fmt(Math.abs(diff))} miles ${diff < 0 ? leftLabel.toLowerCase() : diff > 0 ? rightLabel.toLowerCase() : 'on target'}`;
  svg.setAttribute('aria-label', `${$(id + 'Title').textContent}: ${label}`);
  svg.innerHTML =
    `<path d="${arc(cx, cy, r, 180, 90.01)}" class="g-ok"/>` +
    `<path d="${arc(cx, cy, r, 90, 0)}" class="g-warn"/>` +
    `<line x1="${cx}" y1="${cy - r - 8}" x2="${cx}" y2="${cy - r + 8}" class="g-tick"/>` +
    (diff === null ? '' : `<line x1="${cx}" y1="${cy}" x2="${nx.toFixed(1)}" y2="${ny.toFixed(1)}" class="g-needle"/>`) +
    `<circle cx="${cx}" cy="${cy}" r="6" class="g-hub"/>` +
    `<text x="${cx - r}" y="${cy + 16}" text-anchor="middle" class="g-lbl">${leftLabel}</text>` +
    `<text x="${cx + r}" y="${cy + 16}" text-anchor="middle" class="g-lbl">${rightLabel}</text>`;
}

// --- Calculation ---
function calculate() {
  saveInputs();
  $('copyMsg').textContent = '';
  const val = f => $(f).value;
  const complete = checkInputs();
  $('result').hidden = $('details').hidden = $('numbers').hidden = !complete;
  if (!complete) return;

  const start = parseIso(val('start'));
  const asOf = parseIso(val('asof'));
  const end = addMonths(start, +val('term'));
  const totalDays = Math.round((end - start) / DAY_MS);
  const daysLeft = Math.max(0, Math.round((end - asOf) / DAY_MS));
  const elapsed = Math.min(totalDays, Math.max(0, Math.round((asOf - start) / DAY_MS)));

  const inception = +val('inception') || 0;
  const allowed = +val('allowed');
  const driven = +val('odo') - inception;
  const remaining = allowed - driven;

  const evenPace = allowed / totalDays;                  // miles/day if spread evenly over the term
  const expectedDriven = evenPace * elapsed;
  const pace = daysLeft > 0 ? Math.max(0, remaining) / daysLeft : 0;
  const avgPace = elapsed > 0 ? driven / elapsed : 0;
  const projected = driven + avgPace * daysLeft;
  const ahead = expectedDriven - driven;                 // positive = under the even pace

  $('pace').textContent = daysLeft > 0 ? fmt(pace, 1) : '–';
  $('paceNote').textContent = daysLeft > 0
    ? `for the next ${fmt(daysLeft)} days, to stay within your ${fmt(allowed)} miles`
    : 'The lease term has ended.';

  const status = $('status');
  if (remaining < 0) {
    status.className = 'status warn';
    status.textContent = `You are ${fmt(-remaining)} miles over the allowance.`;
  } else if (ahead >= 0) {
    status.className = 'status ok';
    status.textContent = `Ahead of schedule by ${fmt(ahead)} miles.`;
  } else {
    status.className = 'status warn';
    status.textContent = `${fmt(-ahead)} miles ahead of the even pace (${fmt(evenPace, 1)}/day).`;
  }

  const usedPct = Math.min(100, Math.max(0, driven / allowed * 100));
  $('usedBar').style.width = usedPct + '%';
  $('usedText').textContent = `${fmt(usedPct)}% of your ${fmt(allowed)}-mile allowance used`;
  $('driven').textContent = fmt(driven) + ' mi';
  $('remaining').textContent = fmt(remaining) + ' mi';
  $('daysLeft').textContent = fmt(daysLeft);
  $('expected').textContent = fmt(inception + expectedDriven);
  $('origPace').textContent = fmt(evenPace, 1);
  $('avgPace').textContent = elapsed > 0 ? fmt(avgPace, 1) : '–';
  $('needPace').textContent = daysLeft > 0 ? fmt(pace, 1) : '–';
  const hasHistory = elapsed > 0;
  const projDiff = projected - allowed;                  // positive = projected to go over
  $('projDriven').textContent = hasHistory ? fmt(projected) + ' mi' : '–';
  $('projDiff').textContent = hasHistory
    ? `${fmt(Math.abs(projDiff))} mi ${projDiff > 0 ? 'over' : 'under'}` : '–';
  $('projected').textContent = hasHistory ? fmt(inception + projected) : '–';

  // Gauge 1: miles driven minus miles expected so far. Gauge 2: projected total minus allowance.
  const over = -ahead;
  drawGauge('g1', over, allowed * 0.1, 'Under pace', 'Over pace');
  $('g1Text').textContent = Math.round(over) === 0 ? 'Right on the even pace.'
    : `${fmt(Math.abs(over))} miles ${over < 0 ? 'under' : 'over'} the even pace so far.`;
  drawGauge('g2', hasHistory ? projDiff : null, allowed * 0.2, 'Under', 'Over');
  $('g2Text').textContent = !hasHistory ? 'Needs at least one day of driving history.'
    : `At your average you finish ${fmt(Math.abs(projDiff))} miles ${projDiff > 0 ? 'over' : 'under'} your allowance.`;
  $('endDate').textContent = toIso(end);
}

loadInputs();
FIELDS.forEach(f => $(f).addEventListener('input', calculate));
calculate();
$('copy').addEventListener('click', copyLink);
