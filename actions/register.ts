"use server";

import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth-utils";
import { sendDriverRegistrationEmail, sendDriverRegistrationWhatsApp } from "@/lib/notifications";
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function registerUser(data: {
  name: string;
  email: string;
  phone?: string;
  ssn?: string;
  homeAddress?: string;
  licenseNumber: string;
  licenseIssueDate?: string;
  licenseExpiry: string;
  profilePicture?: string;
  experience?: number;
  shift?: string;
  emergencyContact?: string;
  password?: string;
}) {
  try {
    if (!data.name || !data.email || !data.password) {
      return { error: "Name, email, and password are required fields." };
    }

    // Check if email already exists
    const existingUser = await db.user.findUnique({
      where: { email: data.email.toLowerCase().trim() },
    });

    if (existingUser) {
      return { error: "An account with this email address already exists." };
    }

    let finalProfilePicture = data.profilePicture || null;

    // Handle Cloudinary upload if profile picture is provided as base64 data URL
    if (data.profilePicture && data.profilePicture.startsWith("data:image")) {
      try {
        if (process.env.CLOUDINARY_CLOUD_NAME) {
          const uploadResult = await cloudinary.uploader.upload(data.profilePicture, {
            folder: "driver-profiles",
          });
          finalProfilePicture = uploadResult.secure_url;
        }
      } catch (uploadErr) {
        console.error("Cloudinary driver profile picture upload warning:", uploadErr);
        // Fallback to storing data URL directly if Cloudinary upload fails
      }
    }

    // Auto-generate a unique employee ID
    let employeeId = "";
    let isUnique = false;
    let attempts = 0;
    while (!isUnique && attempts < 10) {
      const rand = Math.floor(10000 + Math.random() * 90000);
      employeeId = `SF-DRV-${rand}`;
      const existingEmp = await db.user.findUnique({
        where: { employeeId },
      });
      if (!existingEmp) {
        isUnique = true;
      }
      attempts++;
    }

    if (!isUnique) {
      return { error: "Failed to generate a unique employee ID. Please try again." };
    }

    const hashedPassword = hashPassword(data.password);

    const newUser = await db.user.create({
      data: {
        name: data.name,
        email: data.email.toLowerCase().trim(),
        employeeId: employeeId,
        phone: data.phone || null,
        ssn: data.ssn || null,
        homeAddress: data.homeAddress || null,
        licenseNumber: data.licenseNumber || null,
        licenseIssueDate: data.licenseIssueDate ? new Date(data.licenseIssueDate) : null,
        licenseExpiry: data.licenseExpiry ? new Date(data.licenseExpiry) : null,
        profilePicture: finalProfilePicture,
        experience: data.experience !== undefined ? Number(data.experience) : null,
        shift: data.shift || "Morning",
        emergencyContact: data.emergencyContact || null,
        password: hashedPassword,
        role: "DRIVER",
      },
    });


    // Create default DriverSalary record for accounting
    await db.driverSalary.create({
      data: {
        driverId: newUser.id,
        baseSalary: 2500.0,
        payType: "MONTHLY",
        taxRate: 13.5,
      },
    });

    // Send email credentials notification
    await sendDriverRegistrationEmail(
      data.email.toLowerCase().trim(),
      data.name,
      employeeId,
      data.password
    );

    // Send WhatsApp credentials notification
    if (data.phone) {
      await sendDriverRegistrationWhatsApp(
        data.phone,
        data.name,
        data.email.toLowerCase().trim(),
        data.password
      );
    }

    return { success: true, driverId: newUser.id };
  } catch (error: any) {
    console.error("Self-registration error:", error);
    return { error: error.message || "Failed to register account" };
  }
}

export async function updateDriverProfileAction(
  driverId: string,
  data: {
    name: string;
    email: string;
    phone?: string;
    ssn?: string;
    homeAddress?: string;
    licenseNumber?: string;
    licenseIssueDate?: string;
    licenseExpiry?: string;
    profilePicture?: string;
    experience?: number;
    emergencyContact?: string;
    shift?: string;
  }
) {
  try {
    const updated = await db.user.update({
      where: { id: driverId },
      data: {
        name: data.name,
        email: data.email.toLowerCase().trim(),
        phone: data.phone || null,
        ssn: data.ssn || null,
        homeAddress: data.homeAddress || null,
        licenseNumber: data.licenseNumber || null,
        licenseIssueDate: data.licenseIssueDate ? new Date(data.licenseIssueDate) : null,
        licenseExpiry: data.licenseExpiry ? new Date(data.licenseExpiry) : null,
        profilePicture: data.profilePicture || null,
        experience: data.experience !== undefined ? Number(data.experience) : null,
        emergencyContact: data.emergencyContact || null,
        shift: data.shift || undefined,
      },
    });

    return { success: true, user: updated };
  } catch (error: any) {
    console.error("Update driver profile error:", error);
    return { error: error.message || "Failed to update driver profile" };
  }
}

