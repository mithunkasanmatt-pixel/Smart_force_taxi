"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { VehicleStatus } from "@prisma/client";
import { v2 as cloudinary } from "cloudinary";

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

export async function assignVehicleToDriver(vehicleId: string, driverId: string | null) {
  try {
    if (driverId) {
      // Clear any other vehicle assigned to this driver
      await db.vehicle.updateMany({
        where: { assignedDriverId: driverId },
        data: { assignedDriverId: null },
      });
    }

    // Assign the selected vehicle
    await db.vehicle.update({
      where: { id: vehicleId },
      data: { assignedDriverId: driverId },
    });

    revalidatePath("/admin/drivers");
    revalidatePath("/driver");
    revalidatePath("/admin");
    return { success: true };
  } catch (error: any) {
    console.error("Assign vehicle to driver error:", error);
    return { error: error.message || "Failed to assign vehicle." };
  }
}
