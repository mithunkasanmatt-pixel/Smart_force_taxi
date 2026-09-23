import React from "react";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { PerformanceMetricsAdminClient } from "@/components/admin/performance-metrics-client";

export const revalidate = 0;

export default async function AdminPerformanceMetricsPage() {
  const session = await auth();

  if (!session?.user || (session.user.role !== "SUPER_ADMIN" && session.user.role !== "TRANSPORT_MANAGER")) {
    redirect("/login");
  }

  // Fetch drivers, trips, and performance records in parallel
  const [drivers, trips, performanceRecords] = await Promise.all([
    db.user.findMany({
      where: {
        role: "DRIVER",
      },
      include: {
        assignedVehicle: true,
      },
      orderBy: {
        name: "asc",
      },
    }),
    db.trip.findMany({
      include: {
        driver: true,
        vehicle: true,
      },
      orderBy: {
        startTime: "desc",
      },
    }),
    db.driverPerformance.findMany({
      include: {
        driver: {
          include: {
            assignedVehicle: true,
          },
        },
      },
      orderBy: [
        { year: "desc" },
        { weekNumber: "desc" },
        { createdAt: "desc" },
      ],
    }),
  ]);

  return (
    <PerformanceMetricsAdminClient
      initialDrivers={drivers}
      initialTrips={trips}
      initialPerformanceRecords={performanceRecords}
      currentUserName={session.user.name || "Admin"}
    />
  );
}
