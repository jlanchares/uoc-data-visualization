// Horizon graph: expected CSV columns: Entity,Code,Year,Annual GDP growth (%)
// This is a 3-band, two-sided (diverging) horizon plot. The bands are folded
// into the same row height; darker shades represent larger absolute values.
// Positive values rise from the bottom edge of a row and negative values are
// mirrored down from its top edge, so sign is readable without relying on color.
const host = document.getElementById('chart');
const statusEl = document.getElementById('status');
const warningsEl = document.getElementById('warnings');
const legendEl = document.getElementById('legend');
const tableEl = document.getElementById('data-table');
const tip = document.getElementById('tip');

const VALUE_COLUMN = 'Annual GDP growth (%)';
const REQUIRED_COLUMNS = ['Entity', 'Code', 'Year', VALUE_COLUMN];
const COUNTRIES = ['Spain', 'Australia', 'Germany', 'France', 'Italy', 'United States'];
const EXPECTED_YEARS = [2000, 2024];
const BANDS = 3;
const POSITIVE = ['#9ecae1', '#4292c6', '#08519c'];
const NEGATIVE = ['#fcae91', '#ef6548', '#a50f15'];
const GAP_COLOR = '#c9d1dc';

// Number('') is 0, so blank cells must become NaN rather than a fabricated zero.
const toNumber = text => ((text ?? '').trim() === '' ? NaN : Number(text));

function parseRow(d) {
  return {
    country: d.Entity,
    code: d.Code,
    year: toNumber(d.Year),
    value: toNumber(d[VALUE_COLUMN]),
    rawValue: d[VALUE_COLUMN]
  };
}

// Checks the loaded rows. Fatal problems throw; recoverable ones become warnings
// and the affected observations are left out, never replaced or interpolated.
function validate(rows) {
  const missingColumns = REQUIRED_COLUMNS.filter(c => !rows.columns.includes(c));
  if (missingColumns.length) {
    throw new Error(`Invalid CSV columns: missing ${missingColumns.join(', ')}. Expected ${REQUIRED_COLUMNS.join(', ')}.`);
  }

  const warnings = [];
  const seen = new Set();
  const valid = [];
  for (const d of rows.filter(row => COUNTRIES.includes(row.country))) {
    const key = `${d.country}|${d.year}`;
    if (!Number.isInteger(d.year)) warnings.push(`${d.country}: ignored a row with an invalid year.`);
    else if (!Number.isFinite(d.value)) warnings.push(`${d.country} ${d.year}: invalid GDP growth value "${d.rawValue ?? ''}" ignored.`);
    else if (seen.has(key)) warnings.push(`${d.country} ${d.year}: duplicated record ignored; the first one is shown.`);
    else {
      seen.add(key);
      valid.push(d);
    }
  }
  if (!valid.length) throw new Error(`No valid observations found for ${COUNTRIES.join(', ')}.`);

  const allYears = [...new Set(valid.map(d => d.year))].sort(d3.ascending);
  if (allYears.length < 2) {
    throw new Error(`The data only covers ${allYears[0]}. A Horizon Graph shows change over time, so it needs at least two years.`);
  }
  const [minYear, maxYear] = d3.extent(allYears);
  if (minYear !== EXPECTED_YEARS[0] || maxYear !== EXPECTED_YEARS[1]) {
    warnings.push(`Data covers ${minYear}–${maxYear}, not the expected ${EXPECTED_YEARS.join('–')}.`);
  }

  const years = d3.range(minYear, maxYear + 1);
  const series = COUNTRIES.map(name => {
    const byYear = new Map(valid.filter(d => d.country === name).map(d => [d.year, d.value]));
    if (!byYear.size) warnings.push(`${name}: country missing from the data; its row is empty.`);
    const missing = years.filter(year => !byYear.has(year));
    if (byYear.size && missing.length) warnings.push(`${name}: no data for ${missing.join(', ')} (shown as gaps).`);
    return { name, missing, points: years.map(year => ({ year, value: byYear.get(year) ?? null })) };
  });

  // A shared whole-number band size keeps every country on the same thresholds
  // and guarantees the largest magnitude fits without clipping.
  const maxAbs = d3.max(valid, d => Math.abs(d.value));
  const bandSize = Math.ceil(maxAbs / BANDS) || 1;
  return { series, valid, warnings, years, minYear, maxYear, maxAbs, bandSize };
}

// Adds a point wherever a segment crosses zero or a band threshold. Without them
// the clamped band edges would bend at observations instead of at the true crossing.
function withCrossings(points, thresholds) {
  const result = [];
  points.forEach((a, i) => {
    result.push(a);
    const b = points[i + 1];
    if (!b || a.value === null || b.value === null) return;
    thresholds
      .filter(t => (t > a.value && t < b.value) || (t < a.value && t > b.value))
      .map(t => ({ year: a.year + (t - a.value) / (b.value - a.value), value: t }))
      .sort((p, q) => p.year - q.year)
      .forEach(p => result.push(p));
  });
  return result;
}

function bandLabel(band, bandSize, sign) {
  const edge = value => (value === 0 ? '0' : `${sign === 1 ? '+' : '−'}${value}`);
  const inner = edge(band * bandSize), outer = edge((band + 1) * bandSize);
  return sign === 1 ? `${inner} to ${outer}%` : `${outer} to ${inner}%`;
}

function renderLegend(model) {
  const { bandSize, series } = model;
  const bands = d3.range(BANDS);
  const entries = [
    ...bands.slice().reverse().map(band => ({ color: NEGATIVE[band], label: bandLabel(band, bandSize, -1) })),
    ...bands.map(band => ({ color: POSITIVE[band], label: bandLabel(band, bandSize, 1) }))
  ];
  if (series.some(s => s.missing.length)) entries.push({ color: GAP_COLOR, label: 'No data' });
  d3.select(legendEl).selectAll('span').data(entries).join('span')
    .html(d => `<i class="swatch" style="background:${d.color}"></i>${d.label}`);
}

function renderTable(model) {
  const pct = d3.format('.2f');
  const table = d3.select(tableEl);
  table.append('thead').append('tr').selectAll('th').data(['Year', ...COUNTRIES]).join('th').attr('scope', 'col').text(d => d);
  table.append('tbody').selectAll('tr').data(model.years).join('tr').selectAll('td')
    .data(year => [year, ...model.series.map(s => s.points.find(p => p.year === year).value)])
    .join('td')
    .text((d, i) => (i === 0 ? d : d === null ? '—' : pct(d)));
}

function yearTicks(minYear, maxYear, step) {
  const ticks = d3.range(Math.ceil(minYear / step) * step, maxYear + 1, step);
  if (maxYear - ticks[ticks.length - 1] >= step / 2) ticks.push(maxYear);
  return ticks;
}

function showTooltip(event, s, year) {
  const point = s.points.find(p => p.year === year);
  const growth = point.value === null ? 'no data' : `${d3.format('.2f')(point.value)}%`;
  tip.textContent = `Country: ${s.name}\nYear: ${year}\nGDP Growth: ${growth}`;
  const flip = event.clientX > window.innerWidth - 170;
  tip.style.opacity = 1;
  tip.style.left = `${flip ? event.clientX - 150 : event.clientX + 12}px`;
  tip.style.top = `${event.clientY - 16}px`;
}

function render(model) {
  const { series, minYear, maxYear, bandSize } = model;
  const width = Math.max(240, host.clientWidth || 950);
  const narrow = width < 560;
  const m = { top: 8, right: 20, bottom: 34, left: narrow ? 92 : 112 };
  const rowHeight = 52, gap = 8;
  const height = m.top + series.length * (rowHeight + gap) - gap + m.bottom;
  const plotBottom = height - m.bottom;

  const x = d3.scaleLinear().domain([minYear, maxYear]).range([m.left, width - m.right]);
  const thresholds = d3.range(-BANDS, BANDS + 1).map(k => k * bandSize);
  const ticks = yearTicks(minYear, maxYear, narrow ? 10 : 5);

  d3.select(host).selectAll('svg').remove();
  const svg = d3.select(host).append('svg').attr('viewBox', `0 0 ${width} ${height}`).attr('width', width).attr('height', height)
    .attr('role', 'img').attr('aria-label', `Horizon graph of annual GDP growth from ${minYear} to ${maxYear} for ${COUNTRIES.join(', ')}. The same values are available in the data table below the chart.`);

  series.forEach((s, i) => {
    const yTop = m.top + i * (rowHeight + gap), yBottom = yTop + rowHeight;
    const row = svg.append('g').attr('class', 'row').attr('data-country', s.name);
    row.append('rect').attr('x', m.left).attr('y', yTop).attr('width', width - m.left - m.right).attr('height', rowHeight).attr('fill', '#f3f6fa');

    // A missing year clears the segments that touch it, so nothing is interpolated across it.
    row.selectAll('rect.gap').data(s.missing).join('rect').attr('class', 'gap')
      .attr('x', year => x(Math.max(year - 1, minYear))).attr('y', yTop)
      .attr('width', year => x(Math.min(year + 1, maxYear)) - x(Math.max(year - 1, minYear))).attr('height', rowHeight)
      .attr('fill', GAP_COLOR);

    // Paint high-magnitude bands on top of low-magnitude ones. This keeps
    // their dark colors visible inside the same folded row height.
    const points = withCrossings(s.points, thresholds);
    for (const sign of [1, -1]) {
      for (let band = 0; band < BANDS; band++) {
        const fill = v => Math.max(0, Math.min(1, (sign * v - band * bandSize) / bandSize)) * rowHeight;
        const area = d3.area().defined(d => d.value !== null).x(d => x(d.year))
          .y0(sign === 1 ? yBottom : yTop)
          .y1(d => (sign === 1 ? yBottom - fill(d.value) : yTop + fill(d.value)));
        row.append('path').datum(points).attr('class', 'band').attr('d', area)
          .attr('data-sign', sign).attr('data-band', band)
          .attr('fill', sign === 1 ? POSITIVE[band] : NEGATIVE[band]);
      }
    }

    // Both edges of a row are the zero reference.
    row.selectAll('line.zero').data([yTop, yBottom]).join('line').attr('class', 'zero')
      .attr('x1', m.left).attr('x2', width - m.right).attr('y1', d => d).attr('y2', d => d).attr('stroke', '#bcc9d8');
    svg.append('text').attr('x', m.left - 10).attr('y', yTop + rowHeight / 2 + 4).attr('text-anchor', 'end')
      .attr('font-size', 13).attr('fill', '#253953').text(s.name);
  });

  svg.append('g').attr('class', 'year-lines').selectAll('line').data(ticks).join('line')
    .attr('x1', x).attr('x2', x).attr('y1', m.top).attr('y2', plotBottom).attr('stroke', '#fff').attr('stroke-opacity', 0.7);
  svg.append('g').attr('class', 'axis').attr('transform', `translate(0,${plotBottom + 6})`)
    .call(d3.axisBottom(x).tickValues(ticks).tickFormat(d3.format('d')));

  // One overlay handles hover for all rows so the indicator spans the whole chart.
  const indicator = svg.append('line').attr('class', 'indicator').attr('y1', m.top).attr('y2', plotBottom)
    .attr('stroke', '#172338').attr('stroke-width', 1).attr('opacity', 0).attr('pointer-events', 'none');
  svg.append('rect').attr('class', 'hover-layer').attr('x', m.left).attr('y', m.top)
    .attr('width', width - m.left - m.right).attr('height', plotBottom - m.top)
    .attr('fill', 'transparent').style('cursor', 'crosshair').style('touch-action', 'pan-y')
    .on('pointermove pointerdown', event => {
      const [px, py] = d3.pointer(event, svg.node());
      const year = Math.max(minYear, Math.min(maxYear, Math.round(x.invert(px))));
      const index = Math.max(0, Math.min(series.length - 1, Math.floor((py - m.top) / (rowHeight + gap))));
      indicator.attr('x1', x(year)).attr('x2', x(year)).attr('opacity', 0.75);
      showTooltip(event, series[index], year);
    })
    .on('pointerleave', () => {
      indicator.attr('opacity', 0);
      tip.style.opacity = 0;
    });
}

function showWarnings(warnings) {
  warningsEl.hidden = !warnings.length;
  d3.select(warningsEl).selectAll('li').data(warnings).join('li').text(d => d);
}

function showError(err) {
  statusEl.className = 'error';
  if (/^\d{3}\b/.test(err.message)) statusEl.textContent = `Could not load data.csv (HTTP ${err.message}). Check that the file exists next to this page.`;
  else if (err instanceof TypeError) statusEl.textContent = `Could not load data.csv: ${err.message}. Use a local HTTP server, not file://.`;
  else statusEl.textContent = err.message;
}

function start() {
  // 'no-cache' makes the browser revalidate, so a replaced CSV is never served stale.
  d3.csv('./data.csv', { cache: 'no-cache' }, parseRow)
    .then(rows => {
      const model = validate(rows);
      showWarnings(model.warnings);
      renderLegend(model);
      renderTable(model);
      render(model);

      let lastWidth = host.clientWidth;
      new ResizeObserver(() => {
        if (host.clientWidth && host.clientWidth !== lastWidth) {
          lastWidth = host.clientWidth;
          render(model);
        }
      }).observe(host);

      const { bandSize, valid, minYear, maxYear, maxAbs } = model;
      const shown = model.series.filter(s => s.missing.length < model.years.length).length;
      statusEl.textContent = `Loaded ${valid.length} observations for ${shown} of ${COUNTRIES.length} countries, ${minYear}–${maxYear}, from ${rows.length} rows in data.csv. `
        + `Shared scale: ${BANDS} bands of ${bandSize} percentage points each, up to ±${BANDS * bandSize}% (largest magnitude ${d3.format('.2f')(maxAbs)}%).`;
    })
    .catch(showError);
}

if (typeof d3 === 'undefined') showError(new Error('Could not load the D3.js library from its CDN. Check your connection and reload.'));
else start();
