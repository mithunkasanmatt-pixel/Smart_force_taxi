"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { sendBookingCancellationEmail, sendBookingConfirmationEmail, sendCarAvailabilityBroadcastEmail } from "@/lib/notifications";

// Driver/Admin books a car slot
export async function bookCarAction(data: {
  vehicleId: string;
  driverId: string;
  startTime: string; // ISO string
  endTime: string; // ISO string
  pickup: string;
  destination: string;
  purpose: string;
  notes?: string;
  assignedBy: "DRIVER" | "ADMIN";
  requestedBy: string;
}) {
  try {
    const start = new Date(data.startTime);
    const end = new Date(data.endTime);

    if (start >= end) {
      return { error: "End time must be after start time." };
    }

    // 1. Verify vehicle is not offline or in maintenance
    const vehicle = await db.vehicle.findUnique({
      where: { id: data.vehicleId },
    });

    if (!vehicle) {
      return { error: "Vehicle not found." };
    }

    if (vehicle.status === "OFFLINE" || vehicle.status === "MAINTENANCE") {
      return { error: "This vehicle is currently offline or under maintenance." };
    }

    const driver = await db.user.findUnique({
      where: { id: data.driverId },
    });

    if (!driver) {
      return { error: "Driver not found." };
    }

    // 2. Validate vehicle availability / slot conflicts
    const conflict = await db.trip.findFirst({
      where: {
        vehicleId: data.vehicleId,
        status: {
          notIn: ["CANCELLED", "COMPLETED"],
        },
        OR: [
          {
            startTime: { lte: start },
            endTime: { gt: start },
          },
          {
            startTime: { lt: end },
            endTime: { gte: end },
          },
          {
            startTime: { gte: start },
            endTime: { lte: end },
          },
        ],
      },
    });

    if (conflict) {
      return { error: "This vehicle is already booked during the selected time slot." };
    }

    // 3. Validate driver availability / slot conflicts
    const driverConflict = await db.trip.findFirst({
      where: {
        driverId: data.driverId,
        status: {
          notIn: ["CANCELLED", "COMPLETED"],
        },
        OR: [
          {
            startTime: { lte: start },
            endTime: { gt: start },
          },
          {
            startTime: { lt: end },
            endTime: { gte: end },
          },
          {
            startTime: { gte: start },
            endTime: { lte: end },
          },
        ],
      },
    });

    if (driverConflict) {
      return { error: "The selected driver already has another booking during this time slot." };
    }

    // 4. Generate unique trip/work number
    let tripNumber = "";
    while (true) {
      tripNumber = "WRK-" + Math.floor(1000 + Math.random() * 9000);
      const exists = await db.trip.findUnique({
        where: { tripNumber },
      });
      if (!exists) break;
    }

    // 5. Create trip/booking
    await db.$transaction(async (tx) => {
      await tx.trip.create({
        data: {
          tripNumber,
          pickup: data.pickup,
          destination: data.destination,
          startTime: start,
          endTime: end,
          purpose: data.purpose,
          notes: data.notes || null,
          driverId: data.driverId,
          vehicleId: data.vehicleId,
          status: data.assignedBy === "ADMIN" ? "ASSIGNED" : "ACCEPTED",
          assignedBy: data.assignedBy,
          requestedBy: data.requestedBy,
          department: "Operations",
        },
      });
    });

    // Send confirmation email to driver
    if (driver.email) {
      const diffMs = end.getTime() - start.getTime();
      const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
      const diffMins = Math.round((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      const durationText = diffHrs > 0 ? `${diffHrs}h ${diffMins}m` : `${diffMins}m`;

      await sendBookingConfirmationEmail(
        driver.email,
        driver.name,
        vehicle.name,
        start,
        end,
        durationText
      );
    }

    revalidatePath("/driver");
    revalidatePath("/admin");
    return { success: true };
  } catch (error: any) {
    console.error("Book car action error:", error);
    return { error: error.message || "Failed to book vehicle." };
  }
}

// Admin cancels a booking
export async function cancelBookingAction(tripId: string) {
  try {
    const session = await auth();
    if (!session?.user || (session.user.role !== "SUPER_ADMIN" && session.user.role !== "TRANSPORT_MANAGER")) {
      return { error: "Unauthorized. Admin privileges required." };
    }

    const trip = await db.trip.findUnique({
      where: { id: tripId },
      include: {
        driver: true,
        vehicle: true,
      },
    });

    if (!trip) {
      return { error: "Booking not found." };
    }

    if (trip.status === "CANCELLED") {
      return { error: "This booking is already cancelled." };
    }

    await db.trip.update({
      where: { id: tripId },
      data: {
        status: "CANCELLED",
      },
    });

    if (trip.driver?.email) {
      await sendBookingCancellationEmail(
        trip.driver.email,
        trip.driver.name,
        trip.tripNumber,
        trip.vehicle.name,
        trip.startTime,
        trip.endTime
      );
    }

    revalidatePath("/admin");
    revalidatePath("/admin/bookings");
    revalidatePath("/driver");
    return { success: true };
  } catch (error: any) {
    console.error("Cancel booking action error:", error);
    return { error: error.message || "Failed to cancel booking." };
  }
}

// Admin deletes a booking with validation matching and time limits
export async function deleteBookingAction(tripId: string, name: string, email: string) {
  try {
    const session = await auth();
    if (!session?.user || (session.user.role !== "SUPER_ADMIN" && session.user.role !== "TRANSPORT_MANAGER")) {
      return { error: "Unauthorized. Admin privileges required." };
    }

    const trip = await db.trip.findUnique({
      where: { id: tripId },
      include: {
        driver: true,
        vehicle: true,
      },
    });

    if (!trip) {
      return { error: "Booking not found." };
    }

    // Time restriction check
    const bookingStartTime = new Date(trip.startTime);
    const oneHourBeforeStart = new Date(bookingStartTime.getTime() - 60 * 60 * 1000);
    const now = new Date();
    if (now >= oneHourBeforeStart) {
      return { error: "Bookings can only be deleted up to 1 hour before the scheduled start time." };
    }

    // Verification details check
    const expectedName = trip.driver?.name || trip.requestedBy || "";
    const expectedEmail = trip.driver?.email || "";

    if (name.trim() !== expectedName.trim() || email.trim().toLowerCase() !== expectedEmail.trim().toLowerCase()) {
      return { error: "Verification failed: Entered name or email is incorrect." };
    }

    // Physical deletion
    await db.trip.delete({
      where: { id: tripId },
    });

    revalidatePath("/admin");
    revalidatePath("/admin/bookings");
    revalidatePath("/driver");
    return { success: true };
  } catch (error: any) {
    console.error("Delete booking action error:", error);
    return { error: error.message || "Failed to delete booking." };
  }
}

// Driver cancels their own booking and broadcasts availability to all other drivers
export async function cancelUserBookingAction(tripId: string) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "DRIVER") {
      return { error: "Unauthorized. Driver login required." };
    }

    const trip = await db.trip.findUnique({
      where: { id: tripId },
      include: {
        driver: true,
        vehicle: true,
      },
    });

    if (!trip) {
      return { error: "Booking not found." };
    }

    if (trip.driverId !== session.user.id) {
      return { error: "You can only cancel your own bookings." };
    }

    if (trip.status === "CANCELLED") {
      return { error: "This booking is already cancelled." };
    }

    // Update trip status to CANCELLED
    await db.trip.update({
      where: { id: tripId },
      data: {
        status: "CANCELLED",
      },
    });

    // Query all driver users to broadcast email notification
    const drivers = await db.user.findMany({
      where: {
        role: "DRIVER",
      },
      select: {
        email: true,
        name: true,
      },
    });

    await sendCarAvailabilityBroadcastEmail(
      drivers.filter(d => d.email !== null) as { email: string; name: string }[],
      trip.vehicle.name,
      trip.vehicle.vehicleNumber
    );

    revalidatePath("/driver");
    revalidatePath("/admin");
    return { success: true };
  } catch (error: any) {
    console.error("Cancel user booking action error:", error);
    return { error: error.message || "Failed to cancel booking." };
  }
}
