#ifndef TRAFFIC_SIGNAL_H
#define TRAFFIC_SIGNAL_H

#include <string>
#include <iostream>

enum class SignalState {
    RED,
    YELLOW,
    GREEN
};

class TrafficSignal {
private:
    int intersectionId;
    SignalState state;
    bool emergencyOverride;

public:
    TrafficSignal(int id = 0, SignalState initialState = SignalState::RED)
        : intersectionId(id), state(initialState), emergencyOverride(false) {}

    int getIntersectionId() const { return intersectionId; }
    SignalState getState() const { return state; }
    bool isEmergencyOverride() const { return emergencyOverride; }

    void setRed() {
        state = SignalState::RED;
        emergencyOverride = false;
    }

    void setYellow() {
        state = SignalState::YELLOW;
        emergencyOverride = false;
    }

    void setGreen() {
        state = SignalState::GREEN;
    }

    void forceEmergencyGreen() {
        state = SignalState::GREEN;
        emergencyOverride = true;
    }

    std::string getStateString() const {
        if (emergencyOverride) return "GREEN (EMERGENCY OVERRIDE 🚨)";
        switch (state) {
            case SignalState::RED: return "RED 🔴";
            case SignalState::YELLOW: return "YELLOW 🟡";
            case SignalState::GREEN: return "GREEN 🟢";
        }
        return "UNKNOWN";
    }

    double getDelayPenaltySeconds() const {
        if (state == SignalState::GREEN || emergencyOverride) return 0.0;
        if (state == SignalState::YELLOW) return 10.0; // 10s yellow light delay
        return 45.0; // 45s red light wait penalty
    }
};

#endif // TRAFFIC_SIGNAL_H
