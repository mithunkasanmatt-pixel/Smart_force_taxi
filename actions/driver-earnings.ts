"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { calculateEarningsBreakdown } from "@/lib/tax-calculator";

// Submit total earnings (Driver or Admin)
export async function submitDriverEarningsAction(data: {
  driverId?: string;
  totalEarnings: number;
  date?: string;
  notes?: string;
}) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { error: "Unauthorized. Please sign in." };
    }

    let targetDriverId = session.user.id;

    if (session.user.role === "SUPER_ADMIN" || session.user.role === "TRANSPORT_MANAGER") {
      if (data.driverId) {
        targetDriverId = data.driverId;
      }
    } else if (session.user.role !== "DRIVER") {
      return { error: "Forbidden role." };
    }

    if (typeof data.totalEarnings !== "number" || isNaN(data.totalEarnings) || data.totalEarnings <= 0) {
      return { error: "Please enter a valid total earnings amount greater than 0." };
    }

    // Calculate tax, remaining, driver share, company share
    const breakdown = calculateEarningsBreakdown(data.totalEarnings);

    const submissionDate = data.date ? new Date(data.date) : new Date();

    const newRecord = await db.driverEarning.create({
      data: {
        driverId: targetDriverId,
        date: submissionDate,
        totalEarnings: breakdown.totalEarnings,
        taxRate: breakdown.taxRate,
        taxAmount: breakdown.taxAmount,
        remainingAmount: breakdown.remainingAmount,
        driverShareRate: breakdown.driverShareRate,
        driverShare: breakdown.driverShare,
        companyShareRate: breakdown.companyShareRate,
        companyShare: breakdown.companyShare,
        notes: data.notes || null,
        status: "SUBMITTED",
      },
      include: {
        driver: true,
      },
    });

    revalidatePath("/driver");
    revalidatePath("/driver/earnings");
    revalidatePath("/admin/earnings");
    revalidatePath("/admin/drivers");

    return { success: true, earning: newRecord };
  } catch (error: any) {
    console.error("Error submitting driver earnings:", error);
    return { error: error.message || "Failed to submit driver earnings." };
  }
}

// Update driver earnings (ADMIN ONLY)
export async function updateDriverEarningsAction(data: {
  id: string;
  totalEarnings: number;
  date?: string;
  notes?: string;
}) {
  try {
    const session = await auth();
    if (!session?.user || (session.user.role !== "SUPER_ADMIN" && session.user.role !== "TRANSPORT_MANAGER")) {
      return { error: "Permission denied. Only Admins can modify submitted earnings records." };
    }

    const existing = await db.driverEarning.findUnique({
      where: { id: data.id },
    });

    if (!existing) {
      return { error: "Earnings record not found." };
    }

    if (typeof data.totalEarnings !== "number" || isNaN(data.totalEarnings) || data.totalEarnings <= 0) {
      return { error: "Please enter a valid total earnings amount greater than 0." };
    }

    const breakdown = calculateEarningsBreakdown(data.totalEarnings);
    const updatedDate = data.date ? new Date(data.date) : existing.date;

    const updatedRecord = await db.driverEarning.update({
      where: { id: data.id },
      data: {
        date: updatedDate,
        totalEarnings: breakdown.totalEarnings,
        taxRate: breakdown.taxRate,
        taxAmount: breakdown.taxAmount,
        remainingAmount: breakdown.remainingAmount,
        driverShareRate: breakdown.driverShareRate,
        driverShare: breakdown.driverShare,
        companyShareRate: breakdown.companyShareRate,
        companyShare: breakdown.companyShare,
        notes: data.notes !== undefined ? data.notes : existing.notes,
        status: "ADJUSTED_BY_ADMIN",
      },
      include: {
        driver: true,
      },
    });

    revalidatePath("/driver");
    revalidatePath("/driver/earnings");
    revalidatePath("/admin/earnings");
    revalidatePath("/admin/drivers");

    return { success: true, earning: updatedRecord };
  } catch (error: any) {
    console.error("Error updating driver earnings:", error);
    return { error: error.message || "Failed to update driver earnings." };
  }
}

// Delete driver earnings (ADMIN ONLY)
export async function deleteDriverEarningsAction(id: string) {
  try {
    const session = await auth();
    if (!session?.user || (session.user.role !== "SUPER_ADMIN" && session.user.role !== "TRANSPORT_MANAGER")) {
      return { error: "Permission denied. Only Admins can delete earnings records." };
    }

    await db.driverEarning.delete({
      where: { id },
    });

    revalidatePath("/driver");
    revalidatePath("/driver/earnings");
    revalidatePath("/admin/earnings");
    revalidatePath("/admin/drivers");

    return { success: true };
  } catch (error: any) {
    console.error("Error deleting driver earnings:", error);
    return { error: error.message || "Failed to delete earnings record." };
  }
}
