#ifndef FIRETRUCK_H
#define FIRETRUCK_H

#include "Vehicle.h"

class FireTruck : public Vehicle {
private:
    int waterCapacityLiters;
    bool ladderEquipped;

public:
    FireTruck(const std::string& vehicleId, int start, int end, int capacity = 5000, bool ladder = true)
        : Vehicle(vehicleId, start, end, 9, "FireTruck"), waterCapacityLiters(capacity), ladderEquipped(ladder) {}

    int getWaterCapacity() const { return waterCapacityLiters; }
    bool hasLadder() const { return ladderEquipped; }

    void printInfo() const override {
        std::cout << "[FIRE TRUCK 🚒] ID: " << id
                  << " | Route: " << startNode << " -> " << endNode
                  << " | Priority: " << priority
                  << " | Water: " << waterCapacityLiters << "L"
                  << " | Ladder: " << (ladderEquipped ? "YES" : "NO")
                  << std::endl;
    }
};

#endif // FIRETRUCK_H
