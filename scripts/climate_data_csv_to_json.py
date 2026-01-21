import pandas as pd
import json
from pathlib import Path

# Paths
INPUT_CSV = Path("../data/climate_change_clean_data.csv")
OUTPUT_JSON = Path("../data/climate_data.json")

# Load CSV
df = pd.read_csv(INPUT_CSV)

# Parse date
df["Date"] = pd.to_datetime(df["Date"], errors="coerce")

# Rename columns to JS-friendly names
df = df.rename(columns={
    "Date": "date",
    "Country": "country",
    "Continent": "continent",
    "Temperature": "temperature",
    "CO2 Emissions": "co2",
    "Sea Level Rise": "sea_level",
    "Precipitation": "precipitation",
    "Humidity": "humidity",
    "Wind Speed": "wind_speed",
    "Year": "year",
    "Month": "month"
})

# Keep only what the dashboard needs
columns_to_keep = [
    "date",
    "country",
    "continent",
    "year",
    "month",
    "temperature",
    "co2",
    "sea_level",
    "precipitation",
    "humidity",
    "wind_speed"
]

df = df[columns_to_keep]

# Convert date to ISO string (JSON-safe)
df["date"] = df["date"].dt.strftime("%Y-%m-%d")

# Ensure numeric columns are numeric
numeric_cols = [
    "temperature", "co2", "sea_level",
    "precipitation", "humidity", "wind_speed"
]

for col in numeric_cols:
    df[col] = pd.to_numeric(df[col], errors="coerce").round(3)

# Drop rows with missing critical values
df = df.dropna(subset=["country", "year", "temperature"])

# Convert to list of dicts
records = df.to_dict(orient="records")

# Write JSON
OUTPUT_JSON.parent.mkdir(parents=True, exist_ok=True)
with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
    json.dump(records, f, indent=2)

print(f"Saved {len(records)} records to {OUTPUT_JSON}")
