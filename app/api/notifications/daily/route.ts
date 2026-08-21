import { NextResponse } from "next/server";
import { sendDailyAvailableVehiclesEmail } from "@/lib/notifications";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  // Simple validation check: if a CRON_SECRET is configured, we require it
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret");
  
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await sendDailyAvailableVehiclesEmail();
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Daily notification cron error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
