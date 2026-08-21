import React from "react";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { VehicleScheduleClient } from "@/components/vehicles/vehicle-schedule-client";

export const revalidate = 0;

export default async function AdminSchedulePage() {
  const session = await auth();

  if (!session?.user || (session.user.role !== "SUPER_ADMIN" && session.user.role !== "TRANSPORT_MANAGER")) {
    redirect("/login");
  }

  // Fetch all vehicles and bookings in parallel for optimized performance
  const [vehicles, bookings] = await Promise.all([
    db.vehicle.findMany({
      include: {
        assignedDrivers: true,
      },
      orderBy: {
        name: "asc",
      },
    }),
    db.trip.findMany({
      where: {
        status: {
          not: "CANCELLED",
        },
      },
      include: {
        driver: true,
        vehicle: true,
      },
      orderBy: {
        startTime: "asc",
      },
    }),
  ]);

  return <VehicleScheduleClient vehicles={vehicles} bookings={bookings} />;
}
