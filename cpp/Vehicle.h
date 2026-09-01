#ifndef VEHICLE_H
#define VEHICLE_H

#include <string>
#include <iostream>

class Vehicle {
protected:
    std::string id;
    int startNode;
    int endNode;
    int priority; // 1 = Normal, 10 = High Emergency
    std::string type;

public:
    Vehicle(const std::string& vehicleId, int start, int end, int prio = 1, const std::string& vehicleType = "Standard")
        : id(vehicleId), startNode(start), endNode(end), priority(prio), type(vehicleType) {}

    virtual ~Vehicle() = default;

    std::string getId() const { return id; }
    int getStartNode() const { return startNode; }
    int getEndNode() const { return endNode; }
    int getPriority() const { return priority; }
    std::string getType() const { return type; }

    virtual bool isEmergency() const { return priority > 5; }

    virtual void printInfo() const {
        std::cout << "[" << type << "] ID: " << id
                  << " | Route: " << startNode << " -> " << endNode
                  << " | Priority: " << priority << std::endl;
    }
};

#endif // VEHICLE_H
