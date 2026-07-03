import matplotlib.pyplot as plt
import seaborn as sns
import pandas as pd

df = pd.read_csv("backend/SOURCES_AND_DATASHEETS/usgs_data_USGS-01646500_20260703_130600.csv");

# the date and time column is unnamed, and stream flow is streamflow_cfs; rename the date time column to datetime
df.rename(columns={df.columns[0]: "datetime"}, inplace=True)
df["datetime"] = pd.to_datetime(df["datetime"], utc=True)

df = df.dropna(subset=["streamflow_cfs"])

# plot streamflow on y axis and date on x axis
plt.figure(figsize=(12, 6))
sns.lineplot(data=df, x="datetime", y="streamflow_cfs")
plt.title("Streamflow Over Time")
plt.xlabel("Date")
plt.ylabel("Streamflow (cfs)")
plt.xticks(rotation=45)
plt.tight_layout()

plt.savefig("streamflow_plot.png")
plt.show()