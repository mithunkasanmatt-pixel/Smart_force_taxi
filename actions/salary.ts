"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function upsertDriverSalaryAction(data: {
  driverId: string;
  baseSalary: number;
  payType: string;
  hourlyRate?: number;
  bankName?: string;
  accountNumber?: string;
  routingNumber?: string;
  allowances?: number;
  deductions?: number;
  taxRate?: number;
  notes?: string;
}) {
  try {
    const session = await auth();
    if (!session?.user || (session.user.role !== "SUPER_ADMIN" && session.user.role !== "TRANSPORT_MANAGER")) {
      return { error: "Unauthorized access" };
    }

    const salary = await db.driverSalary.upsert({
      where: { driverId: data.driverId },
      update: {
        baseSalary: Number(data.baseSalary),
        payType: data.payType || "MONTHLY",
        hourlyRate: data.hourlyRate ? Number(data.hourlyRate) : null,
        bankName: data.bankName || null,
        accountNumber: data.accountNumber || null,
        routingNumber: data.routingNumber || null,
        allowances: Number(data.allowances || 0),
        deductions: Number(data.deductions || 0),
        taxRate: Number(data.taxRate || 13.5),
        notes: data.notes || null,
      },
      create: {
        driverId: data.driverId,
        baseSalary: Number(data.baseSalary),
        payType: data.payType || "MONTHLY",
        hourlyRate: data.hourlyRate ? Number(data.hourlyRate) : null,
        bankName: data.bankName || null,
        accountNumber: data.accountNumber || null,
        routingNumber: data.routingNumber || null,
        allowances: Number(data.allowances || 0),
        deductions: Number(data.deductions || 0),
        taxRate: Number(data.taxRate || 13.5),
        notes: data.notes || null,
      },
    });

    return { success: true, salary };
  } catch (error: any) {
    console.error("Error upserting driver salary:", error);
    return { error: error.message || "Failed to update driver salary details" };
  }
}

export async function getDriverSalaryAction(driverId: string) {
  try {
    const salary = await db.driverSalary.findUnique({
      where: { driverId },
      include: {
        driver: {
          select: {
            id: true,
            name: true,
            email: true,
            employeeId: true,
            ssn: true,
            phone: true,
          },
        },
      },
    });
    return { success: true, salary };
  } catch (error: any) {
    console.error("Error fetching driver salary:", error);
    return { error: error.message || "Failed to fetch driver salary" };
  }
}

export async function createPayrollRecordAction(data: {
  driverId: string;
  month: number;
  year: number;
  baseAmount: number;
  allowances: number;
  deductions: number;
  taxAmount: number;
  netSalary: number;
  paymentStatus?: string;
  paymentDate?: string;
  referenceNumber?: string;
  notes?: string;
}) {
  try {
    const session = await auth();
    if (!session?.user || (session.user.role !== "SUPER_ADMIN" && session.user.role !== "TRANSPORT_MANAGER")) {
      return { error: "Unauthorized access" };
    }

    const record = await db.payrollRecord.create({
      data: {
        driverId: data.driverId,
        month: Number(data.month),
        year: Number(data.year),
        baseAmount: Number(data.baseAmount),
        allowances: Number(data.allowances),
        deductions: Number(data.deductions),
        taxAmount: Number(data.taxAmount),
        netSalary: Number(data.netSalary),
        paymentStatus: data.paymentStatus || "PAID",
        paymentDate: data.paymentDate ? new Date(data.paymentDate) : new Date(),
        referenceNumber: data.referenceNumber || `PAY-${Date.now().toString().slice(-6)}`,
        notes: data.notes || null,
      },
    });

    return { success: true, record };
  } catch (error: any) {
    console.error("Error creating payroll record:", error);
    return { error: error.message || "Failed to create payroll record" };
  }
}

export async function updatePayrollStatusAction(recordId: string, paymentStatus: string, referenceNumber?: string) {
  try {
    const session = await auth();
    if (!session?.user || (session.user.role !== "SUPER_ADMIN" && session.user.role !== "TRANSPORT_MANAGER")) {
      return { error: "Unauthorized access" };
    }

    const updated = await db.payrollRecord.update({
      where: { id: recordId },
      data: {
        paymentStatus,
        paymentDate: paymentStatus === "PAID" ? new Date() : undefined,
        referenceNumber: referenceNumber || undefined,
      },
    });

    return { success: true, record: updated };
  } catch (error: any) {
    console.error("Error updating payroll status:", error);
    return { error: error.message || "Failed to update payroll status" };
  }
}
