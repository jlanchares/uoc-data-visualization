// Area chart: expected CSV columns: year,value
const host = d3.select('#chart');
const statusEl = d3.select('#status');
const tip = d3.select('#tip');

// 'no-cache' makes the browser revalidate, so a replaced CSV is never served stale.
d3.csv('./data.csv', { cache: 'no-cache' }, d => ({ year: +d.year, value: +d.value }))
  .then(rows => {
    const data = rows.filter(d => Number.isFinite(d.year) && Number.isFinite(d.value)).sort((a, b) => a.year - b.year);
    if (!data.length) throw new Error('No valid rows. Check year,value column names.');
    const width = 900, height = 390, m = {top: 20, right: 25, bottom: 52, left: 70};
    const x = d3.scaleLinear().domain(d3.extent(data, d => d.year)).range([m.left, width - m.right]);
    const y = d3.scaleLinear().domain([0, d3.max(data, d => d.value) * 1.1]).nice().range([height - m.bottom, m.top]);
    const svg = host.append('svg').attr('viewBox', `0 0 ${width} ${height}`).attr('role', 'img').attr('aria-label', 'Area chart of annual CO₂ emissions of Spain from 1830 to 2024');
    svg.append('g').attr('class', 'grid').attr('transform', `translate(${m.left},0)`).call(d3.axisLeft(y).tickSize(-(width - m.left - m.right)).tickFormat(''));
    svg.append('path').datum(data).attr('fill', '#a7d2f1').attr('d', d3.area().x(d => x(d.year)).y0(y(0)).y1(d => y(d.value)));
    svg.append('path').datum(data).attr('fill', 'none').attr('stroke', '#1764a8').attr('stroke-width', 2.5).attr('d', d3.line().x(d => x(d.year)).y(d => y(d.value)));
    svg.append('g').attr('class', 'axis').attr('transform', `translate(0,${height - m.bottom})`).call(d3.axisBottom(x).ticks(Math.min(12, data.length)).tickFormat(d3.format('d')));
    // Values are stored in tonnes; the axis shows millions so the labels fit the left margin.
    svg.append('g').attr('class', 'axis').attr('transform', `translate(${m.left},0)`).call(d3.axisLeft(y).tickFormat(d => d3.format(',')(d / 1e6)));
    svg.append('text').attr('x', m.left).attr('y', 12).attr('font-size', 12).attr('fill', '#52647b').text('Million tonnes of CO₂');
    svg.selectAll('circle.point').data(data).join('circle').attr('class', 'point').attr('cx', d => x(d.year)).attr('cy', d => y(d.value)).attr('r', 4).attr('fill', '#1764a8')
      .on('mousemove', (event, d) => tip.style('opacity', 1).style('left', `${event.clientX + 12}px`).style('top', `${event.clientY - 16}px`).text(`${d.year}: ${d3.format(',.0f')(d.value)} tonnes`))
      .on('mouseleave', () => tip.style('opacity', 0));
    statusEl.text(`Loaded ${data.length} observations from data.csv`);
  })
  .catch(err => statusEl.attr('class', 'error').text(`Could not load CSV: ${err.message}. Use a local HTTP server, not file://.`));
