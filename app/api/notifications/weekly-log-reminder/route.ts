import { NextResponse } from "next/server";
import { sendWeeklyLogReminderEmails } from "@/lib/notifications";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get("secret");

    if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const force = searchParams.get("force") === "true";
    const result = await sendWeeklyLogReminderEmails(force);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Weekly log reminder check error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
