import os
import sys
import json
import pickle

def predict_travel_time(model, distance_km, speed_limit_kmh, hour_of_day, is_weekend, incident_reported, weather_factor):
    """
    Predict travel time in minutes using the loaded Random Forest model.
    """
    input_row = [distance_km, speed_limit_kmh, hour_of_day, is_weekend, incident_reported, weather_factor]

    if hasattr(model, 'predict'):
        try:
            import pandas as pd
            feature_cols = ["distance_km", "speed_limit_kmh", "hour_of_day", "is_weekend", "incident_reported", "weather_factor"]
            df_input = pd.DataFrame([input_row], columns=feature_cols)
            pred = model.predict(df_input)[0]
            return round(float(pred), 2)
        except Exception:
            pred = model.predict([input_row])[0]
            return round(float(pred), 2)
    return None

def load_model(model_path):
    if not os.path.exists(model_path):
        print(f"⚠️ Model file '{model_path}' not found. Run train.py first!")
        return None

    try:
        with open(model_path, 'rb') as f:
            return pickle.load(f)
    except Exception:
        try:
            import joblib
            return joblib.load(model_path)
        except Exception as e:
            print(f"❌ Error loading model: {e}")
            return None

def generate_predictions_json(model):
    """
    Generates predicted travel times for all city road links and exports predictions.json
    """
    # City roads network schema (matching C++ createCity graph)
    # Format: (EdgeKey, distance_km, speed_limit_kmh, hour, weekend, incident, weather)
    city_roads = [
        ("1-3", 4.5, 50.0, 17, 0, 0, 1.2),  # Central Hospital <-> Downtown Plaza
        ("2-3", 3.0, 50.0, 17, 0, 0, 1.0),  # Fire Station #1 <-> Downtown Plaza
        ("2-4", 5.0, 60.0, 17, 0, 0, 1.0),  # Fire Station #1 <-> Residential
        ("3-4", 2.5, 40.0, 17, 0, 1, 1.3),  # Downtown Plaza <-> Residential (Accident 🚨)
        ("3-5", 6.0, 80.0, 17, 0, 0, 1.0),  # Downtown Plaza <-> Highway Interchange
        ("4-6", 7.2, 70.0, 17, 0, 0, 1.0),  # Residential <-> Industrial Park
        ("5-6", 4.0, 90.0, 17, 0, 0, 1.0),  # Highway Interchange <-> Industrial Park
        ("1-5", 5.5, 75.0, 17, 0, 0, 1.0),  # Central Hospital <-> Highway Interchange
    ]

    predictions = {}
    print("\n🔮 Predicting travel times for City Road Network:")
    for edge, dist, speed, hour, weekend, incident, weather in city_roads:
        time_pred = predict_travel_time(model, dist, speed, hour, weekend, incident, weather)
        if time_pred is None:
            time_pred = round((dist / speed) * 60.0 * (1.5 if incident else 1.0), 2)
        predictions[edge] = time_pred
        print(f"   • Link '{edge}': {time_pred} min (Dist: {dist} km, Incident: {incident})")

    # Save predictions.json in ML directory
    ml_json_path = os.path.join(os.path.dirname(__file__), "predictions.json")
    with open(ml_json_path, "w") as f:
        json.dump(predictions, f, indent=2)
    print(f"\n📄 Saved predictions JSON to: {ml_json_path}")

    # Also export copy directly to C++ directory for seamless loading
    cpp_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "cpp"))
    if os.path.exists(cpp_dir):
        cpp_json_path = os.path.join(cpp_dir, "predictions.json")
        with open(cpp_json_path, "w") as f:
            json.dump(predictions, f, indent=2)
        print(f"📄 Exported copy to C++ directory: {cpp_json_path}")

    return predictions

def main():
    print("========================================================")
    print("🚗  TRAFFIC PREDICTION INFERENCE ENGINE")
    print("========================================================")

    model_path = os.path.join(os.path.dirname(__file__), "model.pkl")
    model = load_model(model_path)

    # Generate predictions.json for C++ graph consumption
    generate_predictions_json(model)

    print("========================================================")

if __name__ == "__main__":
    main()
