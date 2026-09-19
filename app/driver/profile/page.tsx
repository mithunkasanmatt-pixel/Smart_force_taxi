import React from "react";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { DriverProfileViewClient } from "@/components/drivers/driver-profile-view-client";

export const revalidate = 0;

export default async function DriverProfilePage() {
  const session = await auth();

  if (!session?.user || session.user.role !== "DRIVER") {
    redirect("/login");
  }

  const driver = await db.user.findUnique({
    where: { id: session.user.id },
    include: {
      salaryDetails: true,
      payrollRecords: {
        orderBy: {
          createdAt: "desc",
        },
      },
    },
  });

  if (!driver) {
    redirect("/login");
  }

  return <DriverProfileViewClient driver={driver} />;
}
