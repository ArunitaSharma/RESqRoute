#ifndef DIJKSTRA_H
#define DIJKSTRA_H

#include <vector>
#include <map>
#include <queue>
#include <limits>
#include <algorithm>
#include <iostream>
#include "Graph.h"

struct RouteResult {
    bool found;
    std::vector<int> path;
    double totalTravelTimeMinutes;
    double totalDistanceKm;

    RouteResult()
        : found(false), totalTravelTimeMinutes(std::numeric_limits<double>::infinity()), totalDistanceKm(0.0) {}
};

class Dijkstra {
public:
    static RouteResult findShortestPath(const Graph& graph, int startNode, int endNode, bool isEmergency = false) {
        RouteResult result;

        if (!graph.hasIntersection(startNode) || !graph.hasIntersection(endNode)) {
            std::cout << "❌ Error: Invalid start or end intersection ID (" << startNode << " -> " << endNode << ")" << std::endl;
            return result;
        }

        if (startNode == endNode) {
            result.found = true;
            result.path.push_back(startNode);
            result.totalTravelTimeMinutes = 0.0;
            result.totalDistanceKm = 0.0;
            return result;
        }

        // Min-priority queue: pair<travelTime, nodeID>
        using QueueElement = std::pair<double, int>;
        std::priority_queue<QueueElement, std::vector<QueueElement>, std::greater<QueueElement>> pq;

        std::map<int, double> distMap;
        std::map<int, int> parentMap;

        // Initialize distances
        for (const auto& kv : graph.getIntersections()) {
            distMap[kv.first] = std::numeric_limits<double>::infinity();
        }

        distMap[startNode] = 0.0;
        pq.push({0.0, startNode});

        while (!pq.empty()) {
            auto top = pq.top();
            pq.pop();
            double currentDist = top.first;
            int u = top.second;

            if (currentDist > distMap[u]) continue;

            if (u == endNode) break; // Reached target

            for (const auto& road : graph.getNeighbors(u)) {
                int v = road.getToNode();
                double edgeWeight = road.getTravelTimeMinutes(isEmergency);

                if (distMap[u] + edgeWeight < distMap[v]) {
                    distMap[v] = distMap[u] + edgeWeight;
                    parentMap[v] = u;
                    pq.push({distMap[v], v});
                }
            }
        }

        if (distMap[endNode] == std::numeric_limits<double>::infinity()) {
            result.found = false;
            return result;
        }

        // Reconstruct path
        std::vector<int> path;
        int current = endNode;
        while (current != startNode) {
            path.push_back(current);
            auto it = parentMap.find(current);
            if (it == parentMap.end()) break;
            current = it->second;
        }
        path.push_back(startNode);
        std::reverse(path.begin(), path.end());

        result.found = true;
        result.path = path;
        result.totalTravelTimeMinutes = distMap[endNode];

        // Calculate total distance
        double distanceSum = 0.0;
        for (size_t i = 0; i < path.size() - 1; ++i) {
            int u = path[i];
            int v = path[i + 1];
            for (const auto& road : graph.getNeighbors(u)) {
                if (road.getToNode() == v) {
                    distanceSum += road.getDistance();
                    break;
                }
            }
        }
        result.totalDistanceKm = distanceSum;

        return result;
    }
};

#endif // DIJKSTRA_H
