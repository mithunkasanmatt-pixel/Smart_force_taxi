"use server";

import { auth } from "@/lib/auth";
import { getStoredLocations, saveStoredLocations } from "@/lib/locations-server";
import { BookingLocation, DEFAULT_BOOKING_LOCATIONS } from "@/lib/locations";
import { revalidatePath } from "next/cache";

export async function getBookingLocationsAction(): Promise<BookingLocation[]> {
  try {
    return getStoredLocations();
  } catch (error) {
    console.error("Failed to get locations:", error);
    return DEFAULT_BOOKING_LOCATIONS;
  }
}

export async function addBookingLocationAction(data: {
  name: string;
  type?: "pickup" | "drop" | "both";
}): Promise<{ success?: boolean; error?: string; location?: BookingLocation }> {
  try {
    const session = await auth();
    if (!session?.user || (session.user.role !== "SUPER_ADMIN" && session.user.role !== "TRANSPORT_MANAGER")) {
      return { error: "Unauthorized. Admin permissions required to add locations." };
    }

    const trimmedName = data.name?.trim();
    if (!trimmedName) {
      return { error: "Location name cannot be empty." };
    }

    const currentLocations = getStoredLocations();
    const existing = currentLocations.find(
      (l) => l.name.toLowerCase() === trimmedName.toLowerCase()
    );

    if (existing) {
      return { error: "A location with this name already exists." };
    }

    const newLocation: BookingLocation = {
      id: `loc-${Date.now()}`,
      name: trimmedName,
      type: data.type || "both",
      createdAt: new Date().toISOString(),
    };

    const updated = [...currentLocations, newLocation];
    saveStoredLocations(updated);
    revalidatePath("/driver");
    revalidatePath("/admin");
    revalidatePath("/admin/bookings");

    return { success: true, location: newLocation };
  } catch (error: any) {
    console.error("Failed to add location:", error);
    return { error: error?.message || "Failed to add location." };
  }
}

export async function deleteBookingLocationAction(
  id: string
): Promise<{ success?: boolean; error?: string }> {
  try {
    const session = await auth();
    if (!session?.user || (session.user.role !== "SUPER_ADMIN" && session.user.role !== "TRANSPORT_MANAGER")) {
      return { error: "Unauthorized. Admin permissions required to delete locations." };
    }

    const currentLocations = getStoredLocations();
    const updated = currentLocations.filter((l) => l.id !== id);
    saveStoredLocations(updated);
    revalidatePath("/driver");
    revalidatePath("/admin");
    revalidatePath("/admin/bookings");

    return { success: true };
  } catch (error: any) {
    console.error("Failed to delete location:", error);
    return { error: error?.message || "Failed to delete location." };
  }
}
