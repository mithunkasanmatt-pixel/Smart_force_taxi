import React from "react";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AdminEarningsClient } from "@/components/admin/admin-earnings-client";

export const revalidate = 0;

export default async function AdminEarningsPage() {
  const session = await auth();

  if (
    !session?.user ||
    (session.user.role !== "SUPER_ADMIN" && session.user.role !== "TRANSPORT_MANAGER")
  ) {
    redirect("/login");
  }

  const [drivers, earnings] = await Promise.all([
    db.user.findMany({
      where: { role: "DRIVER" },
      orderBy: { name: "asc" },
    }),
    db.driverEarning.findMany({
      include: {
        driver: true,
      },
      orderBy: { date: "desc" },
    }),
  ]);

  return <AdminEarningsClient drivers={drivers} initialEarnings={earnings as any} />;
}
