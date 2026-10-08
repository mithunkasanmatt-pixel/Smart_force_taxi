import React from "react";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { WeeklyLogAdminClient } from "@/components/drivers/weekly-log-admin-client";

export const revalidate = 0;

export default async function AdminWeeklyLogPage() {
  const session = await auth();

  if (!session?.user || (session.user.role !== "SUPER_ADMIN" && session.user.role !== "TRANSPORT_MANAGER")) {
    redirect("/login");
  }

  const [drivers, logs] = await Promise.all([
    db.user.findMany({
      where: {
        role: "DRIVER",
      },
      orderBy: {
        name: "asc",
      },
    }),
    db.weeklyLog.findMany({
      include: {
        driver: true,
      },
      orderBy: {
        uploadedAt: "desc",
      },
    }),
  ]);

  return <WeeklyLogAdminClient drivers={drivers} initialLogs={logs} />;
}
