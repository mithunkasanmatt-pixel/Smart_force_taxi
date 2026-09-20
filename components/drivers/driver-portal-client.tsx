"use client";

import React, { useEffect, useState } from "react";
import { useDriverTab } from "./driver-portal-context";
import { DriverDashboardClient } from "./driver-dashboard-client";
import { AvailableVehiclesClient } from "./available-vehicles-client";
import { WeeklyLogClient } from "./weekly-log-client";
import { DriverEarningsClient } from "./driver-earnings-client";
import { DriverProfileViewClient } from "./driver-profile-view-client";
import { useTranslation } from "@/components/layout/language-provider";
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
}: DriverPortalClientProps) {
  const { activeTab } = useDriverTab();

  return (
    <>
      <div className={activeTab === "dashboard" ? "block" : "hidden"}>
        <DriverDashboardClient
          driver={driver}
          activeShift={activeShift}
          assignedVehicle={assignedVehicle}
          vehicles={vehicles}
          bookings={bookings}
          activeTrip={activeTrip}
          todayBookings={todayBookings}
        />
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
        />
      </div>
    </>
  );
}

