#ifndef AMBULANCE_H
#define AMBULANCE_H

#include "Vehicle.h"

class Ambulance : public Vehicle {
private:
    bool patientOnBoard;
    bool sirenActive;

public:
    Ambulance(const std::string& vehicleId, int start, int end, bool patient = true)
        : Vehicle(vehicleId, start, end, 10, "Ambulance"), patientOnBoard(patient), sirenActive(true) {}

    bool hasPatient() const { return patientOnBoard; }
    bool isSirenActive() const { return sirenActive; }

    void setSiren(bool state) { sirenActive = state; }

    void printInfo() const override {
        std::cout << "[AMBULANCE 🚑] ID: " << id
                  << " | Route: " << startNode << " -> " << endNode
                  << " | Priority: " << priority
                  << " | Siren: " << (sirenActive ? "ON 🚨" : "OFF")
                  << " | Critical Patient: " << (patientOnBoard ? "YES" : "NO")
                  << std::endl;
    }
};

#endif // AMBULANCE_H
