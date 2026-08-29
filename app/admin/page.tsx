import React from "react";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AdminDashboardClient } from "@/components/admin/admin-dashboard-client";

export const revalidate = 0; // Disable caching to fetch live db values

export default async function AdminDashboard() {
  const session = await auth();

  if (!session?.user || (session.user.role !== "SUPER_ADMIN" && session.user.role !== "TRANSPORT_MANAGER")) {
    redirect("/login");
  }

  // Fetch vehicles (with trips) and drivers (with trips) in parallel for optimized speed
  const [vehicles, drivers] = await Promise.all([
    db.vehicle.findMany({
      include: {
        trips: {
          where: {
            status: {
              notIn: ["CANCELLED", "COMPLETED"],
            },
          },
          include: {
            driver: true,
          },
          orderBy: {
            startTime: "asc",
          },
        },
      },
      orderBy: {
        name: "asc",
      },
    }),
    db.user.findMany({
      where: {
        role: "DRIVER",
      },
      include: {
        trips: {
          where: {
            status: {
              notIn: ["CANCELLED", "COMPLETED"],
            },
          },
          include: {
            vehicle: true,
          },
          orderBy: {
            startTime: "asc",
          },
        },
      },
      orderBy: {
        name: "asc",
      },
    }),
  ]);

  return (
    <AdminDashboardClient
      vehicles={vehicles}
      drivers={drivers}
      initialAvailableCars={[]}
      initialBookedCars={[]}
      initialWorkingDrivers={[]}
      initialFreeDrivers={[]}
    />
  );
}
