import React from "react";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AccountingManagerClient } from "@/components/admin/accounting-manager-client";

export const revalidate = 0;

export default async function AccountingPage() {
  const session = await auth();

  if (!session?.user || (session.user.role !== "SUPER_ADMIN" && session.user.role !== "TRANSPORT_MANAGER")) {
    redirect("/login");
  }

  const [drivers, payrollHistory] = await Promise.all([
    db.user.findMany({
      where: {
        role: "DRIVER",
      },
      include: {
        salaryDetails: true,
        payrollRecords: {
          orderBy: {
            createdAt: "desc",
          },
          take: 5,
        },
      },
      orderBy: {
        name: "asc",
      },
    }),
    db.payrollRecord.findMany({
      include: {
        driver: {
          select: {
            id: true,
            name: true,
            email: true,
            employeeId: true,
            ssn: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 50,
    }),
  ]);

  return (
    <AccountingManagerClient
      drivers={drivers}
      payrollHistory={payrollHistory}
    />
  );
}
