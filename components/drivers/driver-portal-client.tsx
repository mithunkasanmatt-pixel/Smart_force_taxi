"use client";

import React, { useEffect, useState } from "react";
import { useDriverTab } from "./driver-portal-context";
import { DriverDashboardClient } from "./driver-dashboard-client";
import { DriverMyBookingsClient } from "./driver-my-bookings-client";
import { AvailableVehiclesClient } from "./available-vehicles-client";
import { WeeklyLogClient } from "./weekly-log-client";
import { DriverEarningsClient } from "./driver-earnings-client";
import { DriverProfileViewClient } from "./driver-profile-view-client";
import { PerformanceMatrixSection, PerformanceMatrixData } from "./performance-matrix-section";
import { User, Vehicle, Trip, WeeklyLog, DriverEarning, DriverSalary, PayrollRecord } from "@prisma/client";

interface DriverPortalClientProps {
  driver: User & {
    salaryDetails?: DriverSalary | null;
    payrollRecords?: PayrollRecord[];
  };
  activeShift: any | null;
  assignedVehicle: Vehicle | null;
  vehicles: Vehicle[];
  bookings: (Trip & { driver?: User | null; vehicle?: Vehicle | null })[];
  activeTrip: (Trip & { vehicle: Vehicle }) | null;
  logs: WeeklyLog[];
  todayBookings: Trip[];
  initialEarnings?: DriverEarning[];
  matrixData?: PerformanceMatrixData;
  driverBookings?: (Trip & { driver?: User | null; vehicle?: Vehicle | null })[];
}

export function DriverPortalClient({
  driver,
  activeShift,
  assignedVehicle,
  vehicles,
  bookings,
  activeTrip,
  logs,
  todayBookings,
  initialEarnings = [],
  matrixData,
  driverBookings,
}: DriverPortalClientProps) {
  const { activeTab } = useDriverTab();

  useEffect(() => {
    const mainEl = document.querySelector("main");
    if (mainEl) {
      mainEl.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    }
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    }
  }, [activeTab]);

  return (
    <>
      <div className={activeTab === "dashboard" ? "block" : "hidden"}>
        <DriverDashboardClient
          driver={driver}
          activeShift={activeShift}
          assignedVehicle={assignedVehicle}
          vehicles={vehicles}
          bookings={bookings}
          driverBookings={driverBookings || bookings}
          activeTrip={activeTrip}
          todayBookings={todayBookings}
          logs={logs}
          matrixData={matrixData}
        />
      </div>
      <div className={activeTab === "my-bookings" ? "block" : "hidden"}>
        <DriverMyBookingsClient
          driver={driver}
          bookings={driverBookings || bookings}
          fleetBookings={bookings}
          vehicles={vehicles}
          assignedVehicle={assignedVehicle}
        />
      </div>
      <div className={activeTab === "performance-matrix" ? "block" : "hidden"}>
        {matrixData && <PerformanceMatrixSection matrixData={matrixData} />}
      </div>
      <div className={activeTab === "vehicles" ? "block" : "hidden"}>
        <AvailableVehiclesClient
          vehicles={vehicles.filter((v) => v.status === "AVAILABLE")}
          bookings={bookings}
          currentUserId={driver.id}
          currentUserRole="DRIVER"
          currentUserName={driver.name}
          assignedVehicleId={driver.assignedVehicleId}
        />
      </div>
      <div className={activeTab === "weekly-log" ? "block" : "hidden"}>
        <WeeklyLogClient
          driver={driver}
          initialLogs={logs}
        />
      </div>
      <div className={activeTab === "earnings" ? "block" : "hidden"}>
        <DriverEarningsClient
          driver={driver}
          initialEarnings={initialEarnings}
        />
      </div>
      <div className={activeTab === "profile" ? "block" : "hidden"}>
        <DriverProfileViewClient
          driver={driver}
          matrixData={matrixData}
        />
      </div>
    </>
  );
}

