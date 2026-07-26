import joblib
import pandas as pd

import os
print(os.getcwd())

model = joblib.load("backend/chapters/potomac_river/pot_river_dc_little_falls_pump_station/models/flood_threshold/pot_river_near_little_falls_flood_threshold_xgboost_model.json")
print(type(model))      
print(model.get_params())   