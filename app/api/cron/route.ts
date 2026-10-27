import { NextResponse } from "next/server";
import { 
  checkAndNotifyLicenseExpiry, 
  sendDailyAvailableVehiclesEmail, 
  sendWeeklyLogReminderEmails 
} from "@/lib/notifications";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get("secret");
    const authHeader = request.headers.get("authorization");

    // Verify secret if CRON_SECRET is configured in environment
    if (process.env.CRON_SECRET) {
      const isValidQuery = secret === process.env.CRON_SECRET;
      const isValidBearer = authHeader === `Bearer ${process.env.CRON_SECRET}`;
      if (!isValidQuery && !isValidBearer) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const results: Record<string, any> = {};

    // 1. Daily available vehicles broadcast
    try {
      results.dailyVehicles = await sendDailyAvailableVehiclesEmail();
    } catch (err: any) {
      console.error("Daily available vehicles cron error:", err);
      results.dailyVehicles = { error: err.message };
    }

    // 2. Driver license expiry check & alerts
    try {
      results.licenseExpiry = await checkAndNotifyLicenseExpiry();
    } catch (err: any) {
      console.error("License expiry cron error:", err);
      results.licenseExpiry = { error: err.message };
    }

    // 3. Weekly log submission reminder (runs on Mondays UTC, or when forced)
    const isMonday = new Date().getUTCDay() === 1;
    const forceWeekly = searchParams.get("forceWeekly") === "true";
    if (isMonday || forceWeekly) {
      try {
        results.weeklyLogReminder = await sendWeeklyLogReminderEmails(forceWeekly);
      } catch (err: any) {
        console.error("Weekly log reminder cron error:", err);
        results.weeklyLogReminder = { error: err.message };
      }
    } else {
      results.weeklyLogReminder = { skipped: "Not Monday" };
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      results,
    });
  } catch (error: any) {
    console.error("Master cron job execution error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  return GET(request);
}
