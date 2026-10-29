// Horizon graph: expected CSV columns: date,series,value (ISO date YYYY-MM-DD)
// This is a 3-band, two-sided (diverging) horizon plot. The bands are folded
// into the same row height; darker shades represent larger absolute values.
const host = d3.select('#chart'), statusEl = d3.select('#status');
const parse = d3.utcParse('%Y-%m-%d');

d3.csv('./data.csv', d => ({ date: parse(d.date), series: d.series, value: +d.value }))
  .then(rows => {
    const data = rows.filter(d => d.date && d.series && Number.isFinite(d.value));
    if (!data.length) throw new Error('No valid rows. Check date,series,value column names.');
    const series = d3.groups(data, d => d.series).map(([name, values]) => ({name, values: values.sort((a,b) => a.date-b.date)}));
    const width = 950, m = { top: 20, right: 28, bottom: 56, left: 115 }, rowHeight = 76, gap = 16;
    const height = m.top + series.length * (rowHeight + gap) + m.bottom;
    const x = d3.scaleUtc().domain(d3.extent(data, d => d.date)).range([m.left, width - m.right]);
    const bands = 3;
    const maxAbs = d3.max(data, d => Math.abs(d.value)) || 1;
    const bandSize = maxAbs / bands;
    const positive = ['#d1e5f0', '#67a9cf', '#2166ac'];
    const negative = ['#fddbc7', '#ef8a62', '#b2182b'];
    const svg = host.append('svg').attr('viewBox', `0 0 ${width} ${height}`).attr('role','img').attr('aria-label', 'Horizon graph comparing four demo series');
    const chartWidth = width-m.left-m.right;
    series.forEach((s, i) => {
      const yTop = m.top + i * (rowHeight + gap), baseline = yTop + rowHeight;
      svg.append('rect').attr('x',m.left).attr('y',yTop).attr('width',chartWidth).attr('height',rowHeight).attr('fill','#f3f6fa');
      // Paint high-magnitude bands on top of low-magnitude ones. This keeps
      // their dark colors visible at the same folded baseline.
      for (const sign of [1,-1]) {
        for (let band = 0; band < bands; band++) {
          const area = d3.area()
            .x(d => x(d.date))
            .y0(baseline)
            .y1(d => baseline - Math.max(0, Math.min(1, (sign*d.value - band*bandSize)/bandSize)) * rowHeight);
          svg.append('path').datum(s.values).attr('d',area)
            .attr('fill', sign === 1 ? positive[band] : negative[band]);
        }
      }
      svg.append('text').attr('x',m.left-12).attr('y',yTop+rowHeight/2+4).attr('text-anchor','end').attr('font-size',13).attr('fill','#253953').text(s.name);
      svg.append('line').attr('x1',m.left).attr('x2',width-m.right).attr('y1',baseline).attr('y2',baseline).attr('stroke','#bcc9d8');
    });
    svg.append('g').attr('class','axis').attr('transform',`translate(0,${height-m.bottom+13})`).call(d3.axisBottom(x).ticks(d3.utcMonth.every(2)).tickFormat(d3.utcFormat('%b %Y')));
    statusEl.text(`Loaded ${data.length} records across ${series.length} series. Auto scale: 3 bands × ${d3.format('.2f')(bandSize)} units per band (±${d3.format('.2f')(maxAbs)}).`);
  })
  .catch(err => statusEl.attr('class','error').text(`Could not load CSV: ${err.message}. Use a local HTTP server, not file://.`));
