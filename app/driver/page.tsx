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
    include: {
      salaryDetails: true,
      payrollRecords: {
        orderBy: {
          createdAt: "desc",
        },
      },
    },
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
  const [
    vehicles,
    bookings,
    activeTrip,
    assignedVehicle,
    logs,
    todayBookings,
    earnings,
    allDrivers,
    allTrips,
    performanceRecords,
  ] = await Promise.all([
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
    db.driverEarning.findMany({
      where: { driverId: driver.id },
      orderBy: { date: "desc" },
    }),
    db.user.findMany({
      where: { role: "DRIVER" },
    }),
    db.trip.findMany({
      where: { status: { notIn: ["CANCELLED"] } },
    }),
    db.driverPerformance.findMany({
      orderBy: [{ year: "desc" }, { weekNumber: "desc" }, { createdAt: "desc" }],
    }),
  ]);

  // Compute driver rank and performance matrix
  const sortedDrivers = allDrivers
    .map((d) => {
      const rec = performanceRecords.find((r) => r.driverId === d.id);
      let actual = rec ? rec.actualHours : 0;
      let booked = rec ? rec.bookedHours : 0;
      if (!rec) {
        allTrips
          .filter((t) => t.driverId === d.id)
          .forEach((t) => {
            const s = new Date(t.startTime).getTime();
            const e = new Date(t.endTime).getTime();
            if (e > s) {
              const hrs = (e - s) / (1000 * 60 * 60);
              booked += hrs;
              if (t.actualHours != null) actual += t.actualHours;
              else if (t.status === "COMPLETED" || e <= Date.now()) actual += hrs;
            }
          });
      }
      return {
        driverId: d.id,
        actualHours: Math.round(actual * 10) / 10,
        bookedHours: Math.round(booked * 10) / 10,
        score: rec?.score || 0,
        record: rec || null,
      };
    })
    .sort((a, b) => {
      if (b.actualHours !== a.actualHours) return b.actualHours - a.actualHours;
      if (b.bookedHours !== a.bookedHours) return b.bookedHours - a.bookedHours;
      return b.score - a.score;
    });

  const rankIndex = sortedDrivers.findIndex((item) => item.driverId === driver.id);
  const rank = rankIndex >= 0 ? rankIndex + 1 : null;
  const targetDriverItem = rankIndex >= 0 ? sortedDrivers[rankIndex] : null;

  const matrixData = {
    rank,
    totalDrivers: allDrivers.length,
    bookedHours: targetDriverItem?.bookedHours || 0,
    actualHours: targetDriverItem?.actualHours || 0,
    score: targetDriverItem?.score || 0,
    performanceRecord: targetDriverItem?.record || null,
  };

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
      initialEarnings={earnings}
      matrixData={matrixData}
    />
  );
}

