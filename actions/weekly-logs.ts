"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { v2 as cloudinary } from "cloudinary";
import { sendWeeklyLogSubmissionEmailToAdmin } from "@/lib/notifications";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Uploads base64 screenshot to Cloudinary and saves database record with optional message
 */
export async function uploadWeeklyScreenshotAction(driverId: string, base64Image: string, message?: string) {
  try {
    if (!driverId) {
      return { error: "Driver ID is required" };
    }
    if (!base64Image) {
      return { error: "Screenshot image is required" };
    }

    console.log(`Starting Cloudinary upload for driver: ${driverId}`);
    
    // Upload image to Cloudinary under 'weekly-logs' folder
    const uploadResult = await cloudinary.uploader.upload(base64Image, {
      folder: "weekly-logs",
    });

    console.log(`Cloudinary upload successful: ${uploadResult.secure_url}`);

    const trimmedMessage = message && message.trim() ? message.trim() : null;

    // Create the DB record
    const weeklyLog = await db.weeklyLog.create({
      data: {
        driverId,
        imageUrl: uploadResult.secure_url,
        message: trimmedMessage,
        uploadedAt: new Date(),
      },
    });

    // Notify admins via email if driver details are available
    try {
      const driver = await db.user.findUnique({
        where: { id: driverId },
      });
      if (driver) {
        await sendWeeklyLogSubmissionEmailToAdmin(
          driver.name,
          driver.employeeId,
          uploadResult.secure_url,
          trimmedMessage
        );
      }
    } catch (notifErr) {
      console.error("Failed to send admin notification email for weekly log:", notifErr);
    }

    revalidatePath("/driver/weekly-log");
    revalidatePath("/admin/weekly-log");
    return { success: true, log: weeklyLog };
  } catch (error: any) {
    console.error("Weekly screenshot upload error:", error);
    return { error: error.message || "Failed to upload weekly screenshot" };
  }
}

/**
 * Retrieves all weekly logs for the current driver
 */
export async function getDriverWeeklyLogsAction(driverId: string) {
  try {
    const logs = await db.weeklyLog.findMany({
      where: { driverId },
      orderBy: { uploadedAt: "desc" },
    });
    return { success: true, logs };
  } catch (error: any) {
    console.error("Fetch driver weekly logs error:", error);
    return { error: error.message || "Failed to retrieve weekly logs" };
  }
}

/**
 * Retrieves all weekly logs for admin review
 */
export async function getAllWeeklyLogsAction() {
  try {
    const logs = await db.weeklyLog.findMany({
      include: {
        driver: true,
      },
      orderBy: { uploadedAt: "desc" },
    });
    return { success: true, logs };
  } catch (error: any) {
    console.error("Fetch all weekly logs error:", error);
    return { error: error.message || "Failed to retrieve all weekly logs" };
  }
}
