#  RESqRoute
> **Smart Traffic & Emergency Vehicle Management System**

[![Live Demo](https://img.shields.io/badge/Live_Demo-GitHub_Pages-orange?style=for-the-badge&logo=github)](https://arunitasharma.github.io/RESqRoute/)
[![C++](https://img.shields.io/badge/Engine-C%2B%2B17-00599C?style=for-the-badge&logo=c%2B%2B)](cpp/)
[![Python ML](https://img.shields.io/badge/Predictor-Random_Forest-3776AB?style=for-the-badge&logo=python)](ml/)
[![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)

---

## Overview

**RESqRoute** is an intelligent emergency traffic routing and signal management system designed to minimize response times for ambulances and emergency units. By fusing a **C++ Dijkstra Graph Engine** with a **Python Random Forest Machine Learning Predictor**, RESqRoute dynamically forecasts traffic congestion and clears **Green Wave corridors** across city intersections.

 **Live Interactive Web Demo:** [arunitasharma.github.io/RESqRoute](https://arunitasharma.github.io/RESqRoute/)

---

##  End-to-End Execution Pipeline

```text
Emergency Dispatch (Priority 10)
           ↓
Priority Queue (Bypasses standard vehicle delays)
           ↓
TrafficManager (Orchestrates Graph & Signals)
           ↓
Real-Time Congestion Analysis (Ambient traffic levels)
           ↓
Random Forest ML Predictor (Forecasts edge weights: predictions.json)
           ↓
Dijkstra Graph Engine (Calculates fastest travel-time path)
           ↓
Green Wave Signal Synchronization (Traffic lights forced to GREEN 🟢)
           ↓
Hospital Arrival (Ambulance traverses cleared corridor)
