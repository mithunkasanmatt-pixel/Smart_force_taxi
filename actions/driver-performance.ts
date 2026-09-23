"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";

export interface VerifyHoursInput {
  driverId: string;
  periodType: "WEEKLY" | "MONTHLY" | "YEARLY";
  year: number;
  weekNumber?: number;
  month?: number;
  weekLabel?: string;
  bookedHours: number;
  actualHours: number;
  notes?: string;
}

export interface GrantRewardInput {
  performanceId: string;
  rewardTitle: string;
  rewardAmount: number;
  notes?: string;
}

/**
 * Utility to calculate ISO Week number and year label (Internal helper)
 */
function getWeekDetails(d: Date = new Date()) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return {
    year: date.getUTCFullYear(),
    weekNumber: weekNo,
    weekLabel: `Week ${weekNo}, ${date.getUTCFullYear()}`,
  };
}

/**
 * Verify and save driver actual vs booked driving hours
 */
export async function verifyDriverHoursAction(input: VerifyHoursInput) {
  try {
    const session = await auth();
    if (!session?.user || (session.user.role !== "SUPER_ADMIN" && session.user.role !== "TRANSPORT_MANAGER")) {
      return { error: "Permission denied. Admin authorization required." };
    }

    if (!input.driverId) {
      return { error: "Driver ID is required." };
    }

    if (typeof input.bookedHours !== "number" || input.bookedHours < 0) {
      return { error: "Please enter a valid non-negative Booked Hours value." };
    }

    if (typeof input.actualHours !== "number" || input.actualHours < 0) {
      return { error: "Please enter a valid non-negative Actual Driving Hours value." };
    }

    const periodType = input.periodType || "WEEKLY";
    const year = input.year || new Date().getFullYear();
    const currentWeekDetails = getWeekDetails();
    const weekNumber = input.weekNumber ?? (periodType === "WEEKLY" ? currentWeekDetails.weekNumber : undefined);
    const month = input.month ?? (periodType === "MONTHLY" ? new Date().getMonth() + 1 : undefined);
    const weekLabel = input.weekLabel || (weekNumber ? `Week ${weekNumber}, ${year}` : `${year}`);

    // Calculate Ratio: Booked vs Actual Driving Hours
    // Ratio represents actual driving efficiency / adherence
    const ratioVal = input.bookedHours > 0 ? input.actualHours / input.bookedHours : 0;
    const ratioPercentage = Math.round(ratioVal * 1000) / 10; // e.g. 90.0%

    // Performance Score out of 100
    // Optimal is actual driving hours matching or exceeding booked hours efficiently (e.g. 80% - 110% ratio = high score)
    let score = 0;
    if (input.bookedHours > 0) {
      const diff = Math.abs(input.bookedHours - input.actualHours);
      const ratio = input.actualHours / input.bookedHours;
      // High score when actual hours matches booked hours closely
      score = Math.max(0, Math.min(100, Math.round(100 - (diff / input.bookedHours) * 40)));
      if (ratio >= 0.9 && ratio <= 1.1) {
        score = Math.min(100, score + 10);
      }
    }

    const isRewardEligible = score >= 80 || ratioVal >= 0.85;

    // Check if performance log already exists for this driver in this period
    const existing = await db.driverPerformance.findFirst({
      where: {
        driverId: input.driverId,
        periodType,
        year,
        weekNumber: weekNumber ?? null,
        month: month ?? null,
      },
    });

    let performanceRecord;

    if (existing) {
      performanceRecord = await db.driverPerformance.update({
        where: { id: existing.id },
        data: {
          bookedHours: input.bookedHours,
          actualHours: input.actualHours,
          performanceRatio: ratioPercentage,
          score,
          rewardEligible: isRewardEligible,
          status: "VERIFIED",
          verifiedBy: session.user.name || "Admin",
          verifiedAt: new Date(),
          notes: input.notes ?? existing.notes,
        },
        include: { driver: true },
      });
    } else {
      performanceRecord = await db.driverPerformance.create({
        data: {
          driverId: input.driverId,
          periodType,
          year,
          weekNumber: weekNumber ?? null,
          month: month ?? null,
          weekLabel,
          bookedHours: input.bookedHours,
          actualHours: input.actualHours,
          performanceRatio: ratioPercentage,
          score,
          status: "VERIFIED",
          rewardEligible: isRewardEligible,
          rewardGranted: false,
          verifiedBy: session.user.name || "Admin",
          verifiedAt: new Date(),
          notes: input.notes || null,
        },
        include: { driver: true },
      });
    }

    revalidatePath("/admin/performance-metrics");
    revalidatePath("/admin/drivers");

    return { success: true, performance: performanceRecord };
  } catch (error: any) {
    console.error("Error verifying driver hours:", error);
    return { error: error.message || "Failed to verify driver hours." };
  }
}

/**
 * Grant Bonus / Reward to Top Performing Driver
 */
export async function grantDriverBonusRewardAction(input: GrantRewardInput) {
  try {
    const session = await auth();
    if (!session?.user || (session.user.role !== "SUPER_ADMIN" && session.user.role !== "TRANSPORT_MANAGER")) {
      return { error: "Permission denied. Only Admins can grant rewards." };
    }

    if (!input.performanceId) {
      return { error: "Performance Record ID is required." };
    }

    if (!input.rewardTitle || input.rewardTitle.trim() === "") {
      return { error: "Reward Title is required (e.g., 'Weekly Top Performer Bonus')." };
    }

    if (typeof input.rewardAmount !== "number" || input.rewardAmount <= 0) {
      return { error: "Please enter a valid reward bonus amount greater than 0." };
    }

    const existing = await db.driverPerformance.findUnique({
      where: { id: input.performanceId },
    });

    if (!existing) {
      return { error: "Performance record not found." };
    }

    const updated = await db.driverPerformance.update({
      where: { id: input.performanceId },
      data: {
        rewardGranted: true,
        rewardTitle: input.rewardTitle.trim(),
        rewardAmount: input.rewardAmount,
        notes: input.notes !== undefined ? input.notes : existing.notes,
      },
      include: { driver: true },
    });

    revalidatePath("/admin/performance-metrics");
    revalidatePath("/admin/drivers");

    return { success: true, performance: updated };
  } catch (error: any) {
    console.error("Error granting driver reward:", error);
    return { error: error.message || "Failed to grant reward bonus." };
  }
}

/**
 * Delete / Reset a performance verification record (ADMIN ONLY)
 */
export async function deleteDriverPerformanceAction(id: string) {
  try {
    const session = await auth();
    if (!session?.user || (session.user.role !== "SUPER_ADMIN" && session.user.role !== "TRANSPORT_MANAGER")) {
      return { error: "Permission denied. Only Admins can delete performance records." };
    }

    await db.driverPerformance.delete({
      where: { id },
    });

    revalidatePath("/admin/performance-metrics");

    return { success: true };
  } catch (error: any) {
    console.error("Error deleting driver performance record:", error);
    return { error: error.message || "Failed to delete performance record." };
  }
}
