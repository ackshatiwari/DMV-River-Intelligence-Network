import requests
import pandas as pd

PARAM_CODES = {
    "00060": "streamflow_cfs",
    "00065": "gage_height_ft",
    "00010": "temperature_c",
    "00095": "specific_conductance",
    "00300": "dissolved_oxygen",
    "00400": "pH",
    "63680": "turbidity_ntu",
}

params = {
    "format": "json",
    "sites": "01646500",  # Example site ID (Potomac River at Point of Rocks, MD)
    "parameterCd": ",".join(PARAM_CODES.keys()),
    "startDT": "2023-01-01",  # Start date for data retrieval
    "endDT": "2023-12-31",  # End date for data retrieval
}

response = requests.get("https://waterservices.usgs.gov/nwis/iv/", params=params)
data = response.json()

frames = []
for series in data["value"]["timeSeries"]:
    code = series["variable"]["variableCode"][0]["value"]
    col  = PARAM_CODES.get(code, code)
    df = pd.DataFrame(series["values"][0]["value"])
    df = df.rename(columns={"dateTime": "timestamp", "value": col})
    df[col] = pd.to_numeric(df[col], errors="coerce")
    df["timestamp"] = pd.to_datetime(df["timestamp"], utc=True)
    frames.append(df.set_index("timestamp")[[col]])

df = pd.concat(frames, axis=1)
print(df.head())