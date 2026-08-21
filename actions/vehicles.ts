"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { VehicleStatus } from "@prisma/client";
import { v2 as cloudinary } from "cloudinary";
import { sendVehicleReassignmentEmail, sendVehicleAssignmentEmail } from "@/lib/notifications";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function createVehicle(data: {
  vehicleNumber: string;
  name: string;
  brand: string;
  model: string;
  year: number;
  seatingCapacity: number;
  registrationNumber: string;
  insuranceExpiry: string;
  fcExpiry: string;
  pollutionExpiry: string;
  serviceDueDate: string;
  odometer: number;
  status: VehicleStatus;
  carType?: string;
  ownershipType?: string;
  notes?: string;
  imageUrl?: string;
  base64Image?: string;
}) {
  try {
    let imageUrl = data.imageUrl || null;

    if (data.base64Image) {
      console.log("Uploading vehicle image to Cloudinary...");
      const uploadResult = await cloudinary.uploader.upload(data.base64Image, {
        folder: "vehicles",
      });
      imageUrl = uploadResult.secure_url;
      console.log("Cloudinary upload successful:", imageUrl);
    }

    await db.vehicle.create({
      data: {
        vehicleNumber: data.vehicleNumber,
        name: data.name,
        brand: data.brand,
        model: data.model,
        year: Number(data.year),
        seatingCapacity: Number(data.seatingCapacity),
        registrationNumber: data.registrationNumber,
        insuranceExpiry: new Date(data.insuranceExpiry),
        fcExpiry: new Date(data.fcExpiry),
        pollutionExpiry: new Date(data.pollutionExpiry),
        serviceDueDate: new Date(data.serviceDueDate),
        odometer: Number(data.odometer),
        status: data.status,
        carType: data.carType || null,
        ownershipType: data.ownershipType || null,
        notes: data.notes || null,
        imageUrl: imageUrl,
      },
    });
    revalidatePath("/admin/vehicles");
    revalidatePath("/driver/available-vehicles");
    revalidatePath("/admin");
    return { success: true };
  } catch (error: any) {
    console.error("Create vehicle error:", error);
    return { error: error.message || "Failed to create vehicle" };
  }
}

export async function updateVehicle(
  id: string,
  data: {
    vehicleNumber: string;
    name: string;
    brand: string;
    model: string;
    year: number;
    seatingCapacity: number;
    registrationNumber: string;
    insuranceExpiry: string;
    fcExpiry: string;
    pollutionExpiry: string;
    serviceDueDate: string;
    odometer: number;
    status: VehicleStatus;
    carType?: string;
    ownershipType?: string;
    notes?: string;
    imageUrl?: string;
    base64Image?: string;
  }
) {
  try {
    let imageUrl = data.imageUrl !== undefined ? data.imageUrl : null;

    if (data.base64Image) {
      console.log("Uploading updated vehicle image to Cloudinary...");
      const uploadResult = await cloudinary.uploader.upload(data.base64Image, {
        folder: "vehicles",
      });
      imageUrl = uploadResult.secure_url;
      console.log("Cloudinary upload successful:", imageUrl);
    }

    await db.vehicle.update({
      where: { id },
      data: {
        vehicleNumber: data.vehicleNumber,
        name: data.name,
        brand: data.brand,
        model: data.model,
        year: Number(data.year),
        seatingCapacity: Number(data.seatingCapacity),
        registrationNumber: data.registrationNumber,
        insuranceExpiry: new Date(data.insuranceExpiry),
        fcExpiry: new Date(data.fcExpiry),
        pollutionExpiry: new Date(data.pollutionExpiry),
        serviceDueDate: new Date(data.serviceDueDate),
        odometer: Number(data.odometer),
        status: data.status,
        carType: data.carType || null,
        ownershipType: data.ownershipType || null,
        notes: data.notes || null,
        imageUrl: imageUrl,
      },
    });
    revalidatePath("/admin/vehicles");
    revalidatePath("/driver/available-vehicles");
    revalidatePath("/admin");
    return { success: true };
  } catch (error: any) {
    console.error("Update vehicle error:", error);
    return { error: error.message || "Failed to update vehicle" };
  }
}

export async function deleteVehicle(id: string) {
  try {
    await db.vehicle.delete({
      where: { id },
    });
    revalidatePath("/admin/vehicles");
    revalidatePath("/driver/available-vehicles");
    revalidatePath("/admin");
    return { success: true };
  } catch (error: any) {
    console.error("Delete vehicle error:", error);
    return { error: error.message || "Failed to delete vehicle" };
  }
}

export async function assignVehicleToDriver(
  vehicleId: string | null,
  driverId: string,
  replaceDriverId?: string | null
) {
  try {
    // 1. If vehicleId is null, it means we want to unallocate the driver from their current vehicle
    if (!vehicleId) {
      const driver = await db.user.findUnique({
        where: { id: driverId },
        include: { assignedVehicle: true },
      });

      if (!driver) {
        return { error: "Driver not found" };
      }

      if (driver.assignedVehicle) {
        const prevVehicle = driver.assignedVehicle;
        // Unallocate
        await db.user.update({
          where: { id: driverId },
          data: { assignedVehicleId: null },
        });

        // Send email notification to driver whose allocation was cancelled
        try {
          await sendVehicleReassignmentEmail(
            driver.email,
            driver.name,
            prevVehicle.name,
            prevVehicle.vehicleNumber
          );
        } catch (emailError) {
          console.error("Error sending vehicle cancellation email:", emailError);
        }
      }

      revalidatePath("/admin/drivers");
      revalidatePath("/driver");
      revalidatePath("/admin");
      return { success: true };
    }

    // 2. If vehicleId is not null, we want to allocate the vehicle to the driver
    const vehicle = await db.vehicle.findUnique({
      where: { id: vehicleId },
      include: { assignedDrivers: true },
    });

    if (!vehicle) {
      return { error: "Vehicle not found" };
    }

    const currentDrivers = vehicle.assignedDrivers || [];

    // Check if the target driver is already assigned to this vehicle
    const isAlreadyAssignedToThis = currentDrivers.some((d) => d.id === driverId);
    if (isAlreadyAssignedToThis) {
      return { success: true }; // Already assigned, nothing to do
    }

    // Find the new driver who is being assigned
    const newDriver = await db.user.findUnique({
      where: { id: driverId },
      include: { assignedVehicle: true },
    });

    if (!newDriver) {
      return { error: "Driver not found" };
    }

    // If new driver already has an allocated vehicle, unallocate them from it first
    if (newDriver.assignedVehicle) {
      const prevVehicle = newDriver.assignedVehicle;
      await db.user.update({
        where: { id: driverId },
        data: { assignedVehicleId: null },
      });
      try {
        await sendVehicleReassignmentEmail(
          newDriver.email,
          newDriver.name,
          prevVehicle.name,
          prevVehicle.vehicleNumber
        );
      } catch (emailError) {
        console.error("Error sending previous vehicle cancellation email:", emailError);
      }
    }

    // Now check if vehicle already has 2 assigned drivers
    if (currentDrivers.length >= 2) {
      // We must have replaceDriverId specified
      if (!replaceDriverId) {
        return { error: "Vehicle is already permanently allocated to two drivers. Please choose one to replace." };
      }

      // Find the driver to replace
      const driverToReplace = currentDrivers.find((d) => d.id === replaceDriverId);
      if (!driverToReplace) {
        return { error: "Driver to replace is not currently assigned to this vehicle." };
      }

      // Unassign the replaced driver
      await db.user.update({
        where: { id: replaceDriverId },
        data: { assignedVehicleId: null },
      });

      // Send email to the replaced driver
      try {
        await sendVehicleReassignmentEmail(
          driverToReplace.email,
          driverToReplace.name,
          vehicle.name,
          vehicle.vehicleNumber
        );
      } catch (emailError) {
        console.error("Error sending vehicle reassignment email to replaced driver:", emailError);
      }
    }

    // Finally, assign the vehicle to the new driver
    await db.user.update({
      where: { id: driverId },
      data: { assignedVehicleId: vehicleId },
    });

    // Send email to the newly assigned driver
    try {
      await sendVehicleAssignmentEmail(
        newDriver.email,
        newDriver.name,
        vehicle.name,
        vehicle.vehicleNumber
      );
    } catch (emailError) {
      console.error("Error sending vehicle assignment email to new driver:", emailError);
    }

    revalidatePath("/admin/drivers");
    revalidatePath("/driver");
    revalidatePath("/admin");
    return { success: true };
  } catch (error: any) {
    console.error("Assign vehicle to driver error:", error);
    return { error: error.message || "Failed to assign vehicle." };
  }
}
