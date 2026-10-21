import { NextResponse } from "next/server";
import { checkAndNotifyLicenseExpiry } from "@/lib/notifications";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get("secret");

    if (process.env.CRON_SECRET && secret && secret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const driverId = searchParams.get("driverId") || undefined;
    const forceParam = searchParams.get("force");
    // If a specific driverId is requested and force is not specified, default to true for immediate manual dispatch
    const force = forceParam !== null ? forceParam === "true" : Boolean(driverId);
    const slot = searchParams.get("slot") || undefined;

    const result = await checkAndNotifyLicenseExpiry(driverId, force, slot);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("License expiry check error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return GET(request);
}
