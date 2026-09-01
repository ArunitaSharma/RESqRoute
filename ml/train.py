import os
import csv
import math
import random
import pickle

# --- Pure Python Random Forest Engine (Zero Third-Party Binary Dependencies) ---
class DecisionNode:
    def __init__(self, feature=None, threshold=None, left=None, right=None, value=None):
        self.feature = feature
        self.threshold = threshold
        self.left = left
        self.right = right
        self.value = value

    def is_leaf(self):
        return self.value is not None

class SimpleDecisionTreeRegressor:
    def __init__(self, max_depth=5, min_samples_split=2):
        self.max_depth = max_depth
        self.min_samples_split = min_samples_split
        self.root = None

    def _mse(self, y):
        if not y:
            return 0.0
        mean = sum(y) / len(y)
        return sum((val - mean) ** 2 for val in y) / len(y)

    def _build_tree(self, X, y, depth=0):
        n_samples = len(y)
        if depth >= self.max_depth or n_samples < self.min_samples_split or len(set(y)) == 1:
            leaf_value = sum(y) / n_samples if n_samples > 0 else 0.0
            return DecisionNode(value=leaf_value)

        n_features = len(X[0])
        best_mse = float('inf')
        best_feat, best_thresh = None, None
        best_left_idx, best_right_idx = [], []

        for feat_idx in range(n_features):
            thresholds = set(row[feat_idx] for row in X)
            for thresh in thresholds:
                left_idx = [i for i in range(n_samples) if X[i][feat_idx] <= thresh]
                right_idx = [i for i in range(n_samples) if X[i][feat_idx] > thresh]

                if not left_idx or not right_idx:
                    continue

                left_y = [y[i] for i in left_idx]
                right_y = [y[i] for i in right_idx]

                weighted_mse = (len(left_y) * self._mse(left_y) + len(right_y) * self._mse(right_y)) / n_samples
                if weighted_mse < best_mse:
                    best_mse = weighted_mse
                    best_feat = feat_idx
                    best_thresh = thresh
                    best_left_idx = left_idx
                    best_right_idx = right_idx

        if best_feat is None:
            leaf_value = sum(y) / n_samples
            return DecisionNode(value=leaf_value)

        left_child = self._build_tree([X[i] for i in best_left_idx], [y[i] for i in best_left_idx], depth + 1)
        right_child = self._build_tree([X[i] for i in best_right_idx], [y[i] for i in best_right_idx], depth + 1)
        return DecisionNode(feature=best_feat, threshold=best_thresh, left=left_child, right=right_child)

    def fit(self, X, y):
        self.root = self._build_tree(X, y)

    def _predict_row(self, node, row):
        if node.is_leaf():
            return node.value
        if row[node.feature] <= node.threshold:
            return self._predict_row(node.left, row)
        return self._predict_row(node.right, row)

    def predict(self, X):
        return [self._predict_row(self.root, row) for row in X]

class RandomForestRegressorModel:
    def __init__(self, n_trees=25, max_depth=5, seed=42):
        self.n_trees = n_trees
        self.max_depth = max_depth
        self.seed = seed
        self.trees = []
        self.feature_names = []

    def fit(self, X, y, feature_names=None):
        random.seed(self.seed)
        self.trees = []
        self.feature_names = feature_names or []
        n_samples = len(X)

        for _ in range(self.n_trees):
            indices = [random.randint(0, n_samples - 1) for _ in range(n_samples)]
            sample_X = [X[i] for i in indices]
            sample_y = [y[i] for i in indices]

            tree = SimpleDecisionTreeRegressor(max_depth=self.max_depth)
            tree.fit(sample_X, sample_y)
            self.trees.append(tree)

    def predict(self, X):
        all_preds = [tree.predict(X) for tree in self.trees]
        n_samples = len(X)
        final_preds = []
        for i in range(n_samples):
            avg_pred = sum(preds[i] for preds in all_preds) / len(self.trees)
            final_preds.append(avg_pred)
        return final_preds


def load_csv_data(filepath):
    features = []
    targets = []
    headers = []

    with open(filepath, 'r') as f:
        reader = csv.reader(f)
        headers = next(reader)
        # Target is travel_time_min (last column)
        for row in reader:
            if not row:
                continue
            vals = [float(x) for x in row]
            features.append(vals[:-1])
            targets.append(vals[-1])

    feature_names = headers[:-1]
    return features, targets, feature_names


def main():
    print("========================================================")
    print("🤖 TRAFFIC ML PIPELINE: Training Random Forest Model")
    print("========================================================")

    # Try using scikit-learn & pandas first if available
    try:
        import pandas as pd
        import joblib
        from sklearn.ensemble import RandomForestRegressor
        from sklearn.metrics import mean_squared_error, r2_score

        data_path = os.path.join(os.path.dirname(__file__), "traffic_data.csv")
        print(f"📊 Loading dataset from {data_path} (using pandas & sklearn)...")
        df = pd.read_csv(data_path)

        feature_cols = ["distance_km", "speed_limit_kmh", "hour_of_day", "is_weekend", "incident_reported", "weather_factor"]
        X = df[feature_cols]
        y = df["travel_time_min"]

        print("🌲 Training RandomForestRegressor...")
        model = RandomForestRegressor(n_estimators=100, random_state=42)
        model.fit(X, y)

        y_pred = model.predict(X)
        mse = mean_squared_error(y, y_pred)
        r2 = r2_score(y, y_pred)

        print(f"✅ Model trained successfully!")
        print(f"   • MSE: {mse:.4f} | R²: {r2:.4f}")

        model_path = os.path.join(os.path.dirname(__file__), "model.pkl")
        joblib.dump(model, model_path)
        print(f"💾 Saved model to {model_path}")
        print("========================================================")
        return

    except Exception as e:
        print(f"ℹ️  Note: Scikit-Learn not available ({e}). Using pure Python Random Forest engine.")

    # Pure Python execution path
    data_path = os.path.join(os.path.dirname(__file__), "traffic_data.csv")
    print(f"📊 Loading dataset from {data_path}...")
    X, y, feature_names = load_csv_data(data_path)
    print(f"   Loaded {len(X)} training samples with {len(feature_names)} features.")

    print("\n🌲 Training Pure-Python RandomForestRegressor...")
    model = RandomForestRegressorModel(n_trees=30, max_depth=5, seed=42)
    model.fit(X, y, feature_names)

    y_pred = model.predict(X)
    mse = sum((y[i] - y_pred[i]) ** 2 for i in range(len(y))) / len(y)
    print(f"✅ Model trained successfully!")
    print(f"   • Mean Squared Error (MSE): {mse:.4f}")

    model_path = os.path.join(os.path.dirname(__file__), "model.pkl")
    with open(model_path, 'wb') as f:
        pickle.dump(model, f)

    print(f"\n💾 Model saved to: {model_path}")
    print("========================================================")

if __name__ == "__main__":
    main()
