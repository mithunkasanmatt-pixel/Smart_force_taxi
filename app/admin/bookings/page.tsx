import React from "react";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { BookingHistoryClient } from "@/components/vehicles/booking-history-client";

export const revalidate = 0;

export default async function AdminBookingsPage() {
  const session = await auth();

  if (!session?.user || (session.user.role !== "SUPER_ADMIN" && session.user.role !== "TRANSPORT_MANAGER")) {
    redirect("/login");
  }

  // Fetch all bookings with driver and vehicle relations
  const bookings = await db.trip.findMany({
    include: {
      driver: true,
      vehicle: true,
    },
    orderBy: {
      startTime: "desc",
    },
  });

  return <BookingHistoryClient bookings={bookings} />;
}
