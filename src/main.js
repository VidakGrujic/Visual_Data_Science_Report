// -----------------------------
// Data source
// -----------------------------
const DATA_URL = "../data/climate_data.json";
const HIGHLIGHT_COLOR = "#F58518"; // orange for selection

// -----------------------------
// Color palette (≤ 6, high contrast)
// -----------------------------
const SAFE_COLORS = [
  "#4C78A8", // blue
  "#72B7B2", // teal (instead of green)
  "#B279A2", // purple
  "#9D755D", // brown
  "#F2CF5B", // yellow-ish (still visible)
  "#7F7F7F"  // gray
];

const CONTINENT_COLORS = {
  "Africa": SAFE_COLORS[0],
  "Europe": SAFE_COLORS[1],
  "Asia": SAFE_COLORS[2],
  "North America": SAFE_COLORS[3],
  "South America": SAFE_COLORS[4],
  "Oceania": SAFE_COLORS[5]
};

// -----------------------------
// Global state (continent only)
// -----------------------------
let raw = [];

let state = {
  metric: "temperature", 
  selectedContinent: null,
  year: null // will be initialized after data load
};

// -----------------------------
// Utility functions
// -----------------------------
function mean(arr) {
  if (!arr.length) return null;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function groupBy(arr, keyFn) {
  const m = new Map();
  for (const item of arr) {
    const k = keyFn(item);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(item);
  }
  return m;
}

function metricToLabel(metric) {
  switch (metric) {
    case "temperature": return "Temperature (°C)";
    case "co2": return "CO2 Emissions (ppm)";
    case "sea_level": return "Sea Level Rise (mm)";
    case "precipitation": return "Precipitation (mm)";
    case "humidity": return "Humidity (%)";
    case "wind_speed": return "Wind Speed (km/h)";
    default: return metric;
  }
}

// -----------------------------
// Aggregation (continent only)
// -----------------------------
function aggregateYearContinent(data, metric) {
  const VALID_CONTINENTS = new Set([
    "Africa",
    "Europe",
    "Asia",
    "North America",
    "South America",
    "Oceania"
  ]);

  const filtered = data.filter(d =>
    d.year != null &&
    VALID_CONTINENTS.has(d.continent) &&
    Number.isFinite(d[metric])
  );

  const byYear = groupBy(filtered, d => d.year);
  const result = [];

  for (const [year, rowsYear] of byYear.entries()) {
    const byContinent = groupBy(rowsYear, d => d.continent);
    for (const [cont, rowsCont] of byContinent.entries()) {
      const vals = rowsCont.map(r => r[metric]).filter(Number.isFinite);
      const v = mean(vals);
      if (v != null) {
        result.push({
          year: Number(year),
          continent: cont,
          value: v
        });
      }
    }
  }

  result.sort((a, b) => a.year - b.year || a.continent.localeCompare(b.continent));
  return result;
}

// -----------------------------
// Plot 1: Line chart (trends)
// -----------------------------
function plotTrend() {
  const metric = state.metric;
  const metricLabel = metricToLabel(metric);

  const agg = aggregateYearContinent(raw, metric);
  const continents = Array.from(new Set(agg.map(d => d.continent))).sort();

  const byContinent = groupBy(agg, d => d.continent);

  const traces = continents.map((c, i) => {
    const rows = (byContinent.get(c) || []).sort((a, b) => a.year - b.year);
    const isSelected = state.selectedContinent === null || state.selectedContinent === c;
    return {
      type: "scatter",
      mode: "lines",
      name: c,
      x: rows.map(r => r.year),
      y: rows.map(r => r.value),
      line: {
      width: isSelected ? 4 : 2,
      color: c === state.selectedContinent
      ? "#F58518"
      : CONTINENT_COLORS[c]
      },
      opacity: isSelected ? 1 : 0.25,
      hovertemplate:
        `<b>${c}</b><br>` +
        `Year: %{x}<br>${metricLabel}: %{y:.3f}<extra></extra>`
    };
  });

  Plotly.newPlot(
  "trendChart",
  traces,
  {
    margin: { l: 52, r: 18, t: 10, b: 42 },
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
    font: { color: "#e9eefb" },
    xaxis: {
      title: "Year",
      gridcolor: "rgba(255,255,255,0.10)"
    },
    yaxis: {
      title: metricLabel,
      gridcolor: "rgba(255,255,255,0.10)"
    },
    legend: {
      orientation: "h",
      y: -0.25
    }
  },
  { responsive: true, displaylogo: false }
).then(gd => {
  gd.on("plotly_click", evt => {
    const clicked = evt.points[0].data.name;

    state.selectedContinent =
      state.selectedContinent === clicked ? null : clicked;

    plotTrend();
    plotRanking();
    plotHeatmap();
    plotMap();
  });
});
}

// -----------------------------
// Plot 2: Ranking bar chart
// -----------------------------
function plotRanking() {
  const metric = state.metric;
  const metricLabel = metricToLabel(metric);
  const year = state.year;
  const BASELINE_YEAR = 2000;

  // --- baseline (year 2000) ---
  const baseline = raw
    .filter(d =>
      d.year === BASELINE_YEAR &&
      Number.isFinite(d[metric])
    )
    .reduce((acc, d) => {
      if (!acc[d.continent]) acc[d.continent] = [];
      acc[d.continent].push(d[metric]);
      return acc;
    }, {});

  const baselineMean = {};
  for (const c in baseline) {
    baselineMean[c] = mean(baseline[c]);
  }

  // --- selected year ---
  const current = raw
    .filter(d =>
      d.year === year &&
      Number.isFinite(d[metric])
    )
    .reduce((acc, d) => {
      if (!acc[d.continent]) acc[d.continent] = [];
      acc[d.continent].push(d[metric]);
      return acc;
    }, {});

  // --- compute change ---
  const rows = Object.keys(current).map(cont => ({
    label: cont,
    value: mean(current[cont]) - (baselineMean[cont] ?? 0)
  }));

  const ordered = rows.sort((a, b) => b.value - a.value);

  Plotly.newPlot(
    "rankingChart",
    [{
      type: "bar",
      orientation: "h",
      x: ordered.map(d => d.value),
      y: ordered.map(d => d.label),
      marker: {
        color: ordered.map(d =>
          d.label === state.selectedContinent
            ? HIGHLIGHT_COLOR
            : "#9CA3AF"   // neutral gray
        )
      },
      hovertemplate:
        "<b>%{y}</b><br>" +
        `${metricLabel} change since ${BASELINE_YEAR}: %{x:.3f}` +
        "<extra></extra>"
    }],
    {
      margin: { l: 120, r: 20, t: 10, b: 40 },
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: "rgba(0,0,0,0)",
      font: { color: "#e9eefb" },
      xaxis: {
        title: `${metricLabel} change since ${BASELINE_YEAR}`,
        gridcolor: "rgba(255,255,255,0.10)"
      }
    },
    { responsive: true, displaylogo: false }
  ).then(gd => {
    gd.on("plotly_click", evt => {
      const clicked = evt.points[0].y;
      state.selectedContinent =
        state.selectedContinent === clicked ? null : clicked;

      plotTrend();
      plotRanking();
      plotHeatmap();
      plotMap();
    });
  });
}



function plotHeatmap() {
  const metric = state.metric;
  const metricLabel = metricToLabel(metric);

  const agg = aggregateYearContinent(raw, metric);

  const continents = Array.from(
    new Set(agg.map(d => d.continent))
  ).sort();

  const years = Array.from(
    new Set(agg.map(d => d.year))
  ).sort((a, b) => a - b);

  // build z-matrix with masking for brushing & linking
  const z = continents.map(cont =>
    years.map(year => {
      const cell = agg.find(
        d => d.continent === cont && d.year === year
      );

      // if a continent is selected, hide others
      if (
        state.selectedContinent !== null &&
        cont !== state.selectedContinent
      ) {
        return null;
      }

      return cell ? cell.value : null;
    })
  );

  Plotly.newPlot(
    "heatmapChart",
    [{
      type: "heatmap",
      x: years,
      y: continents,
      z: z,
      colorscale: "Cividis",
      colorbar: {
        title: metricLabel
      },
      hovertemplate:
        "<b>%{y}</b><br>" +
        "Year: %{x}<br>" +
        `${metricLabel}: %{z:.3f}<extra></extra>`
    }],
    {
      margin: { l: 110, r: 20, t: 10, b: 40 },
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: "rgba(0,0,0,0)",
      font: { color: "#e9eefb" },
      xaxis: {
        title: "Year"
      }
    },
    { responsive: true, displaylogo: false }
  );
}

// -----------------------------
// Plot 4: World map (continents)
// -----------------------------
function plotMap() {
  const metric = state.metric;
  const metricLabel = metricToLabel(metric);
  const year = state.year;

  const VALID_CONTINENTS = Object.keys(CONTINENT_COLORS);

  // filter data for selected year
  const dataYear = raw.filter(d =>
    d.year === year &&
    VALID_CONTINENTS.includes(d.continent) &&
    Number.isFinite(d[metric])
  );

  const traces = VALID_CONTINENTS.map(cont => {
    const rows = dataYear.filter(d => d.continent === cont);
    const countries = rows.map(d => d.country);

    if (!countries.length) return null;

    const isSelected =
      state.selectedContinent !== null && cont === state.selectedContinent;

    const color = isSelected
      ? HIGHLIGHT_COLOR
      : CONTINENT_COLORS[cont];

    return {
      type: "choropleth",
      locations: countries,
      locationmode: "country names",
      z: countries.map(() => 1),
      colorscale: [[0, color], [1, color]],
      showscale: false,
      name: cont,
      marker: {
        line: {
          color: "rgba(255,255,255,0.4)",
          width: 0.5
        }
      },
      opacity:
        state.selectedContinent === null || isSelected ? 1 : 0.25,
      hovertemplate:
        `<b>${cont}</b><br>` +
        `Year: ${year}<extra></extra>`
    };
  }).filter(Boolean); // remove null traces

  Plotly.newPlot(
    "mapChart",
    traces,
    {
      margin: { l: 0, r: 0, t: 0, b: 0 },
      paper_bgcolor: "rgba(0,0,0,0)",
      geo: {
        projection: { type: "natural earth" },
        bgcolor: "rgba(0,0,0,0)",
        showframe: false,
        showcoastlines: false
      },
      legend: {
        orientation: "h",
        y: -0.15
      }
    },
    { responsive: true, displaylogo: false }
  ).then(gd => {
  gd.on("plotly_click", evt => {
    const clicked = evt.points[0].data.name;

    state.selectedContinent =
      state.selectedContinent === clicked ? null : clicked;

    plotTrend();
    plotRanking();
    plotHeatmap();
    plotMap();
  });
});
}





// -----------------------------
// Init
// -----------------------------
async function init() {
  const res = await fetch(DATA_URL);
  raw = await res.json();

  raw = raw.map(d => ({
    ...d,
    year: Number(d.year),
    temperature: Number(d.temperature),
    co2: Number(d.co2),
    sea_level: Number(d.sea_level),
    precipitation: Number(d.precipitation),
    humidity: Number(d.humidity),
    wind_speed: Number(d.wind_speed)
  }));

  const slider = document.getElementById("yearSlider");
  const label = document.getElementById("yearLabel");

  const years = raw.map(d => d.year).filter(Number.isFinite);
  const minYear = Math.min(...years);
  const maxYear = Math.max(...years);

  slider.min = minYear;
  slider.max = maxYear;
  slider.step = 1;

  state.year = maxYear;
  slider.value = state.year;
  label.textContent = state.year;

  document.getElementById("metricSelect")
    .addEventListener("change", e => {
      state.metric = e.target.value;
      plotTrend();
      plotRanking();
      plotHeatmap();
      plotMap();
    });

  slider.addEventListener("input", e => {
    state.year = Number(e.target.value);
    label.textContent = state.year;
    plotRanking();
    plotMap();
  });

  // NOW render
  plotTrend();
  plotRanking();
  plotHeatmap();
  plotMap();
}


init();
