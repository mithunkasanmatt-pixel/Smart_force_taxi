import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const diagnostics: Record<string, any> = {
    timestamp: new Date().toISOString(),
    env: {
      hasDatabaseUrl: !!process.env.DATABASE_URL,
      databaseUrlHost: process.env.DATABASE_URL
        ? process.env.DATABASE_URL.split("@")[1]?.split("?")[0] || "exists-but-no-host"
        : "missing",
      hasAuthSecret: !!process.env.AUTH_SECRET,
      authSecretLength: process.env.AUTH_SECRET?.length || 0,
      nodeEnv: process.env.NODE_ENV,
    },
    databaseConnection: "untested",
  };

  try {
    // Try a simple count query to verify database connectivity
    const userCount = await db.user.count();
    diagnostics.databaseConnection = "success";
    diagnostics.userCount = userCount;
  } catch (error: any) {
    diagnostics.databaseConnection = "failed";
    diagnostics.dbError = {
      message: error.message || "Unknown error",
      code: error.code || null,
      meta: error.meta || null,
    };
  }

  return NextResponse.json(diagnostics);
}
