import React from "react";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { DriverPortalClient } from "@/components/drivers/driver-portal-client";

export const revalidate = 0;

export default async function DriverDashboard() {
  const session = await auth();

  if (!session?.user || session.user.role !== "DRIVER") {
    redirect("/login");
  }

  const driver = await db.user.findUnique({
    where: { id: session.user.id },
  });

  if (!driver) {
    redirect("/login?error=SessionExpired");
  }

  // Calculate today's time range for filtering bookings
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayStart.getDate() + 1);

  // Fetch all required data in parallel for optimized portal performance
  const [vehicles, bookings, activeTrip, assignedVehicle, logs, todayBookings] = await Promise.all([
    db.vehicle.findMany({
      orderBy: {
        name: "asc",
      },
    }),
    db.trip.findMany({
      where: {
        status: {
          notIn: ["CANCELLED", "COMPLETED"],
        },
      },
      include: {
        driver: true,
        vehicle: true,
      },
    }),
    db.trip.findFirst({
      where: {
        driverId: driver.id,
        status: {
          in: ["ASSIGNED", "ACCEPTED", "IN_PROGRESS"],
        },
      },
      include: {
        vehicle: true,
      },
    }),
    driver.assignedVehicleId
      ? db.vehicle.findUnique({
          where: { id: driver.assignedVehicleId },
        })
      : Promise.resolve(null),
    db.weeklyLog.findMany({
      where: { driverId: driver.id },
      orderBy: { uploadedAt: "desc" },
    }),
    db.trip.findMany({
      where: {
        driverId: driver.id,
        status: {
          notIn: ["CANCELLED"],
        },
        startTime: {
          lt: todayEnd,
        },
        endTime: {
          gt: todayStart,
        },
      },
    }),
  ]);

  return (
    <DriverPortalClient
      driver={driver}
      activeShift={null}
      assignedVehicle={assignedVehicle}
      vehicles={vehicles}
      bookings={bookings}
      activeTrip={activeTrip}
      logs={logs}
      todayBookings={todayBookings}
    />
  );
}

