from dataretrieval import waterdata
import pandas as pd

PARAMETER_NAMES = {
    "00060": "discharge_cfs",
    "00065": "gage_height_ft",
    "00010": "water_temperature_c",
    "00095": "specific_conductance_us_cm",
}


def get_current_data():
    SITE_ID = "USGS-01646500"

    df_continuous, _ = waterdata.get_continuous(
        monitoring_location_id=SITE_ID,
        parameter_code=list(PARAMETER_NAMES.keys()),
        time="P1D",
    )

    df = df_continuous[["time", "parameter_code", "value"]].copy()

    df["parameter_code"] = df["parameter_code"].replace(PARAMETER_NAMES)

    df = (
        df.pivot(
            index="time",
            columns="parameter_code",
            values="value",
        )
        .reset_index()
    )

    return df


if __name__ == "__main__":
    current_data = get_current_data()
    print(current_data)