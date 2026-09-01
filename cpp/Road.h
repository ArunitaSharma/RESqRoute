#ifndef ROAD_H
#define ROAD_H

#include <string>
#include <iostream>
#include <iomanip>
#include "TrafficSignal.h"

class Road {
private:
    int fromNode;
    int toNode;
    double distanceKm;
    double speedLimitKmh;
    double congestionLevel; // Multiplier: 1.0 = clear, 2.5 = heavy traffic
    TrafficSignal trafficSignal;

public:
    Road(int u = 0, int v = 0, double dist = 1.0, double speed = 50.0, SignalState signalState = SignalState::GREEN)
        : fromNode(u), toNode(v), distanceKm(dist), speedLimitKmh(speed), congestionLevel(1.0), trafficSignal(v, signalState) {}

    int getFromNode() const { return fromNode; }
    int getToNode() const { return toNode; }
    double getDistance() const { return distanceKm; }
    double getSpeedLimit() const { return speedLimitKmh; }
    double getCongestionLevel() const { return congestionLevel; }
    TrafficSignal& getTrafficSignal() { return trafficSignal; }
    const TrafficSignal& getTrafficSignal() const { return trafficSignal; }

    void setCongestionLevel(double level) {
        if (level < 1.0) level = 1.0;
        congestionLevel = level;
    }

    void setSignalState(SignalState state) {
        if (state == SignalState::RED) trafficSignal.setRed();
        else if (state == SignalState::YELLOW) trafficSignal.setYellow();
        else if (state == SignalState::GREEN) trafficSignal.setGreen();
    }

    void forceEmergencyGreen() {
        trafficSignal.forceEmergencyGreen();
    }

    // Dynamic travel time calculation in minutes
    double getTravelTimeMinutes(bool isEmergency = false) const {
        double effectiveSpeed = speedLimitKmh / congestionLevel;
        // Emergency vehicles bypass congestion partially via shoulders/sirens
        if (isEmergency && congestionLevel > 1.2) {
            effectiveSpeed = speedLimitKmh / (1.0 + (congestionLevel - 1.0) * 0.35);
        }
        double baseTimeHours = distanceKm / effectiveSpeed;
        double baseTimeMin = baseTimeHours * 60.0;

        // Traffic signal delay (if emergency signal is not optimized yet)
        double signalDelayMin = 0.0;
        if (!isEmergency || !trafficSignal.isEmergencyOverride()) {
            signalDelayMin = trafficSignal.getDelayPenaltySeconds() / 60.0;
        }

        return baseTimeMin + signalDelayMin;
    }

    void printInfo() const {
        std::cout << "Road (" << fromNode << " -> " << toNode << ") | "
                  << std::fixed << std::setprecision(1)
                  << distanceKm << " km @ " << speedLimitKmh << " km/h | Congestion: "
                  << congestionLevel << "x | Signal: " << trafficSignal.getStateString()
                  << " | Travel Time: " << getTravelTimeMinutes(false) << " min"
                  << std::endl;
    }
};

#endif // ROAD_H
