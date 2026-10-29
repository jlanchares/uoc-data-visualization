// Gantt chart: expected CSV columns: task,start,end,phase (ISO date YYYY-MM-DD)
const host = d3.select('#chart'), statusEl = d3.select('#status'), tip = d3.select('#tip');
const parse = d3.utcParse('%Y-%m-%d');
const format = d3.utcFormat('%d %b %Y');

d3.csv('./data.csv', d => ({ task: d.task, start: parse(d.start), end: parse(d.end), phase: d.phase || 'Other' }))
  .then(rows => {
    const data = rows.filter(d => d.task && d.start && d.end && d.end >= d.start);
    if (!data.length) throw new Error('No valid rows. Check task,start,end,phase column names and YYYY-MM-DD dates.');
    const width = 950, m = {top: 25, right: 25, bottom: 65, left: 195}, rowHeight = 36;
    const height = m.top + data.length * rowHeight + m.bottom;
    const minDate = d3.min(data, d => d.start), maxDate = d3.max(data, d => d.end);
    const x = d3.scaleUtc().domain([d3.utcDay.offset(minDate, -3), d3.utcDay.offset(maxDate, 3)]).range([m.left, width - m.right]);
    const y = d3.scaleBand().domain(data.map(d => d.task)).range([m.top, height - m.bottom]).padding(0.24);
    const phases = [...new Set(data.map(d => d.phase))];
    const color = d3.scaleOrdinal().domain(phases).range(['#2675b9', '#8054bb', '#1a947f', '#d48a30', '#cc5870']);
    d3.select('#legend').selectAll('span').data(phases).join('span').html(d => `<i class="swatch" style="background:${color(d)}"></i>${d}`);
    const svg = host.append('svg').attr('viewBox', `0 0 ${width} ${height}`).attr('role', 'img').attr('aria-label', 'Gantt chart showing project tasks across time');
    const tickValues = x.ticks(d3.utcMonth.every(1));
    svg.append('g').attr('class', 'grid').selectAll('line').data(tickValues).join('line').attr('x1', x).attr('x2', x).attr('y1', m.top).attr('y2', height - m.bottom);
    svg.append('g').attr('class', 'axis').attr('transform', `translate(0,${height - m.bottom})`).call(d3.axisBottom(x).ticks(d3.utcMonth.every(1)).tickFormat(d3.utcFormat('%b %Y')));
    svg.append('g').attr('class', 'axis').attr('transform', `translate(${m.left},0)`).call(d3.axisLeft(y).tickSize(0).tickPadding(12));
    svg.selectAll('rect.task').data(data).join('rect').attr('class', 'task').attr('x', d => x(d.start)).attr('y', d => y(d.task)).attr('width', d => Math.max(2, x(d3.utcDay.offset(d.end, 1)) - x(d.start))).attr('height', y.bandwidth()).attr('rx', 4).attr('fill', d => color(d.phase))
      .on('mousemove', (event, d) => tip.style('opacity', 1).style('left', `${event.clientX + 12}px`).style('top', `${event.clientY - 16}px`).text(`${d.task}: ${format(d.start)} – ${format(d.end)}`))
      .on('mouseleave', () => tip.style('opacity', 0));
    statusEl.text(`Loaded ${data.length} tasks from data.csv`);
  })
  .catch(err => statusEl.attr('class', 'error').text(`Could not load CSV: ${err.message}. Use a local HTTP server, not file://.`));
