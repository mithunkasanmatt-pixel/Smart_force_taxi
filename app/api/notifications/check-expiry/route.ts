import { NextResponse } from "next/server";
import { checkAndNotifyLicenseExpiry } from "@/lib/notifications";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const driverId = searchParams.get("driverId") || undefined;
    const result = await checkAndNotifyLicenseExpiry(driverId);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("License expiry check error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
