# uoc-data-visualization
UOC - Data Visualization

## Run locally

From the repository root:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000/`. Do not open the pages as `file://` URLs, because browsers can block CSV loading there.

## Horizon Graph: annual GDP growth

The page at `horizon-graph/` compares annual GDP growth in six countries.

| Item | Detail |
| --- | --- |
| Dataset | `horizon-graph/data.csv`, an unmodified copy of `data/annual-gdp-growth.csv` |
| CSV schema | `Entity,Code,Year,Annual GDP growth (%)` |
| Source | Our World in Data — Annual GDP Growth, based on World Bank data: https://ourworldindata.org/grapher/annual-gdp-growth |
| Original data | World Bank national accounts data, and OECD National Accounts data files |
| License | Material produced by Our World in Data is CC BY 4.0; third-party data remains subject to its original provider's terms |
| Access date | 2026-10-30 |
| Countries displayed | Spain, Australia, Germany, France, Italy, United States |
| Temporal coverage | 2000–2024 |

**Meaning of the values.** Each value is the annual percentage change in GDP, adjusted for inflation. Positive values mean the economy grew compared with the previous year and are drawn in blue, rising from the bottom edge of the row. Negative values mean it contracted and are drawn in red, hanging from the top edge.

**Transformations.** The CSV contains 231 countries and territories. The page keeps only the six countries above, in the browser, when it loads. No value is changed, normalized or interpolated. Missing years are shown as gaps.

**Limitations.** The file is a static snapshot, so it does not update automatically and the source figures may be revised later. The bands show magnitude in steps; use the tooltip or the data table for exact values. The chart does not explain why growth changed.

### Replace the CSV with a newer version

1. Download the CSV from the source page and save it as `data/annual-gdp-growth.csv`.
2. Copy it over `horizon-graph/data.csv`. The column names must stay the same.
3. Reload the page and read the status line and any warnings below the chart.
4. If the years changed, update `EXPECTED_YEARS` in `horizon-graph/chart.js`, plus the title, source text and access date in `horizon-graph/index.html` and this README.

To change the countries, edit the `COUNTRIES` array in `horizon-graph/chart.js`.
