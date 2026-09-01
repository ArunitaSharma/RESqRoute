#ifndef GRAPH_H
#define GRAPH_H

#include <vector>
#include <map>
#include <string>
#include <iostream>
#include <fstream>
#include <sstream>
#include <algorithm>
#include "Road.h"

struct Intersection {
    int id;
    std::string name;
};

class Graph {
private:
    std::map<int, Intersection> intersections;
    std::map<int, std::vector<Road>> adjList; // u -> list of outgoing Roads

public:
    Graph() = default;

    void addIntersection(int id, const std::string& name) {
        intersections[id] = {id, name};
        if (adjList.find(id) == adjList.end()) {
            adjList[id] = std::vector<Road>();
        }
    }

    bool hasIntersection(int id) const {
        return intersections.find(id) != intersections.end();
    }

    void addRoad(int u, int v, double distanceKm, double speedLimitKmh, SignalState signalState = SignalState::GREEN, bool bidirectional = true) {
        adjList[u].push_back(Road(u, v, distanceKm, speedLimitKmh, signalState));
        if (bidirectional) {
            adjList[v].push_back(Road(v, u, distanceKm, speedLimitKmh, signalState));
        }
    }

    std::string getIntersectionName(int id) const {
        auto it = intersections.find(id);
        if (it != intersections.end()) {
            return it->second.name;
        }
        return "Unknown Intersection";
    }

    const std::map<int, Intersection>& getIntersections() const {
        return intersections;
    }

    const std::vector<Road>& getNeighbors(int u) const {
        static const std::vector<Road> emptyVector;
        auto it = adjList.find(u);
        if (it != adjList.end()) {
            return it->second;
        }
        return emptyVector;
    }

    std::vector<Road>& getNeighborsMutable(int u) {
        return adjList[u];
    }

    Road* getRoad(int u, int v) {
        auto it = adjList.find(u);
        if (it != adjList.end()) {
            for (auto& road : it->second) {
                if (road.getToNode() == v) {
                    return &road;
                }
            }
        }
        return nullptr;
    }

    void updateRoadCongestion(int u, int v, double congestionLevel, bool bidirectional = true) {
        Road* r1 = getRoad(u, v);
        if (r1) r1->setCongestionLevel(congestionLevel);
        if (bidirectional) {
            Road* r2 = getRoad(v, u);
            if (r2) r2->setCongestionLevel(congestionLevel);
        }
    }

    void setSignalState(int u, int v, SignalState state, bool bidirectional = true) {
        Road* r1 = getRoad(u, v);
        if (r1) r1->setSignalState(state);
        if (bidirectional) {
            Road* r2 = getRoad(v, u);
            if (r2) r2->setSignalState(state);
        }
    }

    // Loads edge weights directly from predictions.json format: { "1-3": 7.2, "3-4": 15.5, ... }
    bool loadPredictedWeights(const std::string& filepath) {
        std::ifstream file(filepath);
        if (!file.is_open()) {
            std::cout << "❌ Error: Could not open JSON file at '" << filepath << "'" << std::endl;
            return false;
        }

        std::string line;
        int count = 0;
        std::cout << "📥 Ingesting ML predictions from JSON: " << filepath << std::endl;

        while (std::getline(file, line)) {
            // Find key in quotes: "u-v"
            size_t quoteStart = line.find('"');
            if (quoteStart == std::string::npos) continue;
            size_t quoteEnd = line.find('"', quoteStart + 1);
            if (quoteEnd == std::string::npos) continue;

            std::string key = line.substr(quoteStart + 1, quoteEnd - quoteStart - 1);
            size_t colonPos = line.find(':', quoteEnd);
            if (colonPos == std::string::npos) continue;

            std::string valueStr = line.substr(colonPos + 1);
            size_t commaPos = valueStr.find(',');
            if (commaPos != std::string::npos) valueStr = valueStr.substr(0, commaPos);

            try {
                double predictedTime = std::stod(valueStr);
                size_t dashPos = key.find('-');
                if (dashPos != std::string::npos) {
                    int u = std::stoi(key.substr(0, dashPos));
                    int v = std::stoi(key.substr(dashPos + 1));

                    Road* r1 = getRoad(u, v);
                    Road* r2 = getRoad(v, u);

                    if (r1) {
                        double baseClearTime = (r1->getDistance() / r1->getSpeedLimit()) * 60.0;
                        double congestionMultiplier = predictedTime / baseClearTime;
                        if (congestionMultiplier < 1.0) congestionMultiplier = 1.0;
                        r1->setCongestionLevel(congestionMultiplier);
                    }
                    if (r2) {
                        double baseClearTime = (r2->getDistance() / r2->getSpeedLimit()) * 60.0;
                        double congestionMultiplier = predictedTime / baseClearTime;
                        if (congestionMultiplier < 1.0) congestionMultiplier = 1.0;
                        r2->setCongestionLevel(congestionMultiplier);
                    }

                    std::cout << "   • Road [" << u << " ➔ " << v << "] ("
                              << getIntersectionName(u) << " ↔ " << getIntersectionName(v)
                              << "): Updated ML Travel Time Weight = " << predictedTime << " min" << std::endl;
                    count++;
                }
            } catch (...) {
                continue;
            }
        }

        file.close();
        std::cout << "✅ Successfully updated " << count << " road graph weights from predictions.json!\n" << std::endl;
        return count > 0;
    }

    void displayGraph() const {
        std::cout << "\n=================== CITY NETWORK MAP ===================" << std::endl;
        for (const auto& kv : intersections) {
            int id = kv.first;
            std::string name = kv.second.name;
            std::cout << "📍 [" << id << "] " << name << " Connections:" << std::endl;
            const auto& roads = getNeighbors(id);
            if (roads.empty()) {
                std::cout << "   (No outgoing roads)" << std::endl;
            } else {
                for (const auto& road : roads) {
                    std::cout << "   ➔ to [" << road.getToNode() << "] "
                              << getIntersectionName(road.getToNode())
                              << " | Dist: " << road.getDistance() << " km"
                              << " | Speed: " << road.getSpeedLimit() << " km/h"
                              << " | Congestion: " << road.getCongestionLevel() << "x"
                              << " | Light: " << road.getTrafficSignal().getStateString()
                              << std::endl;
                }
            }
        }
        std::cout << "========================================================\n" << std::endl;
    }
};

#endif // GRAPH_H
