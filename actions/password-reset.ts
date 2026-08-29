"use server";

import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth-utils";
import { sendResetPasswordOtpEmail } from "@/lib/notifications";

export async function sendResetPasswordOtpAction(email: string) {
  try {
    const trimmedEmail = email.toLowerCase().trim();
    if (!trimmedEmail) {
      return { error: "Email address is required." };
    }

    const user = await db.user.findUnique({
      where: { email: trimmedEmail },
    });

    if (!user) {
      return { error: "No account found with this email address." };
    }

    if (user.role !== "DRIVER") {
      return { error: "Only drivers are permitted to use this reset form." };
    }

    // Generate a secure 6-digit random code
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

    await db.user.update({
      where: { id: user.id },
      data: {
        resetOtp: otp,
        resetOtpExpiry: expiry,
      },
    });

    await sendResetPasswordOtpEmail(trimmedEmail, user.name, otp);

    return { success: true };
  } catch (error: any) {
    console.error("sendResetPasswordOtpAction error:", error);
    return { error: error.message || "Failed to send reset code. Please try again." };
  }
}

export async function verifyResetPasswordOtpAction(email: string, otp: string) {
  try {
    const trimmedEmail = email.toLowerCase().trim();
    const trimmedOtp = otp.trim();

    if (!trimmedEmail || !trimmedOtp) {
      return { error: "Email and code are required." };
    }

    const user = await db.user.findUnique({
      where: { email: trimmedEmail },
    });

    if (!user || !user.resetOtp || !user.resetOtpExpiry) {
      return { error: "Invalid request. Please request a new code." };
    }

    if (user.resetOtp !== trimmedOtp) {
      return { error: "The code entered is incorrect." };
    }

    if (new Date() > new Date(user.resetOtpExpiry)) {
      return { error: "The code has expired. Please request a new one." };
    }

    return { success: true };
  } catch (error: any) {
    console.error("verifyResetPasswordOtpAction error:", error);
    return { error: error.message || "Failed to verify code." };
  }
}

export async function resetPasswordWithOtpAction(email: string, otp: string, newPassword: string) {
  try {
    const trimmedEmail = email.toLowerCase().trim();
    const trimmedOtp = otp.trim();

    if (!trimmedEmail || !trimmedOtp || !newPassword) {
      return { error: "All fields are required." };
    }

    const user = await db.user.findUnique({
      where: { email: trimmedEmail },
    });

    if (!user || !user.resetOtp || !user.resetOtpExpiry) {
      return { error: "Invalid request." };
    }

    if (user.resetOtp !== trimmedOtp) {
      return { error: "The code entered is incorrect." };
    }

    if (new Date() > new Date(user.resetOtpExpiry)) {
      return { error: "The code has expired." };
    }

    const hashedPassword = hashPassword(newPassword);

    await db.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetOtp: null,
        resetOtpExpiry: null,
      },
    });

    return { success: true };
  } catch (error: any) {
    console.error("resetPasswordWithOtpAction error:", error);
    return { error: error.message || "Failed to reset password." };
  }
}
