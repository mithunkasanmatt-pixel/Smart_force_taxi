"use client";

import React, { useState } from "react";
import { User } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/utils/cn";
import {
  User as UserIcon,
  ShieldAlert,
  Eye,
  EyeOff,
  AlertTriangle,
} from "lucide-react";

interface DriverProfileViewProps {
  driver: User;
}

export function DriverProfileViewClient({ driver }: DriverProfileViewProps) {
  const [showSsn, setShowSsn] = useState(false);

  // Calculate License Expiry Days & Warning Period
  const expiryDate = driver.licenseExpiry ? new Date(driver.licenseExpiry) : null;
  let isExpiringSoon = false;
  let isExpired = false;
  let daysRemaining: number | null = null;

  if (expiryDate) {
    const now = new Date();
    const warningStartDate = new Date(expiryDate);
    const targetMonth = warningStartDate.getMonth() - 1;
    warningStartDate.setMonth(targetMonth);
    if (warningStartDate.getMonth() > (targetMonth < 0 ? 11 : targetMonth)) {
      warningStartDate.setDate(0);
    }
    warningStartDate.setHours(0, 0, 0, 0);

    daysRemaining = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (now > expiryDate) {
      isExpired = true;
    } else if (now >= warningStartDate) {
      isExpiringSoon = true;
    }
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Expiry Notification Banner */}
      {isExpired && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 flex items-start gap-3 shadow-sm animate-pulse">
          <AlertTriangle className="h-6 w-6 shrink-0 mt-0.5 text-red-500" />
          <div className="space-y-1">
            <h4 className="font-bold text-sm">URGENT: Taxi License Expired!</h4>
            <p className="text-xs text-red-600/90 dark:text-red-300">
              Your taxi license expired {Math.abs(daysRemaining || 0)} days ago on{" "}
              {expiryDate?.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}. Please renew your license immediately and submit updated proof to your fleet manager. You cannot operate fleet vehicles with an expired license.
            </p>
          </div>
        </div>
      )}

      {isExpiringSoon && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 flex items-start gap-3 shadow-sm">
          <ShieldAlert className="h-6 w-6 shrink-0 mt-0.5 text-amber-500" />
          <div className="space-y-1">
            <h4 className="font-bold text-sm">Taxi License Expiring Soon!</h4>
            <p className="text-xs text-amber-700/90 dark:text-amber-300">
              Your taxi license will expire in <strong>{daysRemaining} day(s)</strong> on{" "}
              {expiryDate?.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}. Please renew your license promptly to prevent disruption to your driving duties.
            </p>
          </div>
        </div>
      )}

      {/* Profile Header & Summary */}
      <div className="p-6 border border-border bg-card rounded-2xl space-y-6 glass shadow-sm">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 text-center sm:text-left">
          {driver.profilePicture ? (
            <img
              src={driver.profilePicture}
              alt={driver.name}
              className="w-24 h-24 rounded-full object-cover border-4 border-primary/30 shadow-md shrink-0"
            />
          ) : (
            <div className="w-24 h-24 rounded-full bg-primary/10 border-4 border-primary/20 flex items-center justify-center text-primary font-extrabold text-3xl shrink-0">
              {driver.name.charAt(0).toUpperCase()}
            </div>
          )}

          <div className="space-y-2 flex-1">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <Badge variant="outline" className="text-xs font-mono bg-muted">
                ID: {driver.employeeId}
              </Badge>
              <Badge className="bg-emerald-500/20 text-emerald-500 border-emerald-500/30 text-xs">
                Active Driver
              </Badge>
              {isExpired ? (
                <Badge className="bg-red-500 text-white font-bold text-xs">License Expired</Badge>
              ) : isExpiringSoon ? (
                <Badge className="bg-amber-500 text-zinc-950 font-bold text-xs">{daysRemaining}d to Expiry</Badge>
              ) : (
                <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-xs">
                  License Valid
                </Badge>
              )}
            </div>

            <h2 className="text-2xl sm:text-3xl font-bold text-foreground">{driver.name}</h2>
            <p className="text-sm text-muted-foreground">{driver.email} &bull; {driver.phone || "No phone registered"}</p>
          </div>
        </div>

        {/* Mandatory Profile Details Grid */}
        <div className="border-t border-border/60 pt-6">
          <h3 className="text-sm font-bold text-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
            <UserIcon className="h-4 w-4 text-primary" /> Driver Profile Mandatory Details
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {/* Full Name */}
            <div className="p-3.5 rounded-xl bg-muted/20 border border-border/60 space-y-1">
              <span className="text-[10px] font-bold text-muted-foreground uppercase block">Full Name</span>
              <span className="text-sm font-bold text-foreground">{driver.name}</span>
            </div>

            {/* SSN */}
            <div className="p-3.5 rounded-xl bg-muted/20 border border-border/60 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-muted-foreground uppercase">Social Security Number (SSN)</span>
                <button
                  type="button"
                  onClick={() => setShowSsn(!showSsn)}
                  className="text-xs text-primary hover:underline flex items-center gap-1 font-semibold cursor-pointer"
                >
                  {showSsn ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  {showSsn ? "Hide" : "Show"}
                </button>
              </div>
              <span className="text-sm font-mono font-bold text-foreground">
                {showSsn ? driver.ssn || "N/A" : driver.ssn ? `•••-••-${driver.ssn.slice(-4)}` : "N/A"}
              </span>
            </div>

            {/* Home Address */}
            <div className="p-3.5 rounded-xl bg-muted/20 border border-border/60 space-y-1">
              <span className="text-[10px] font-bold text-muted-foreground uppercase block">Home Address</span>
              <span className="text-sm font-medium text-foreground">{driver.homeAddress || "N/A"}</span>
            </div>

            {/* Email Address */}
            <div className="p-3.5 rounded-xl bg-muted/20 border border-border/60 space-y-1">
              <span className="text-[10px] font-bold text-muted-foreground uppercase block">Email Address</span>
              <span className="text-sm font-medium text-foreground truncate block">{driver.email}</span>
            </div>

            {/* Phone Number */}
            <div className="p-3.5 rounded-xl bg-muted/20 border border-border/60 space-y-1">
              <span className="text-[10px] font-bold text-muted-foreground uppercase block">Phone Number</span>
              <span className="text-sm font-medium text-foreground">{driver.phone || "N/A"}</span>
            </div>

            {/* Taxi License Number */}
            <div className="p-3.5 rounded-xl bg-muted/20 border border-border/60 space-y-1">
              <span className="text-[10px] font-bold text-muted-foreground uppercase block">Taxi License Number</span>
              <span className="text-sm font-mono font-bold text-foreground">{driver.licenseNumber || "N/A"}</span>
            </div>

            {/* License Issue Date */}
            <div className="p-3.5 rounded-xl bg-muted/20 border border-border/60 space-y-1">
              <span className="text-[10px] font-bold text-muted-foreground uppercase block">Taxi License Issue Date</span>
              <span className="text-sm font-medium text-foreground">
                {driver.licenseIssueDate
                  ? new Date(driver.licenseIssueDate).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
                  : "N/A"}
              </span>
            </div>

            {/* License Expiry Date */}
            <div className="p-3.5 rounded-xl bg-muted/20 border border-border/60 space-y-1">
              <span className="text-[10px] font-bold text-muted-foreground uppercase block">Taxi License Expiry Date</span>
              <span className={cn("text-sm font-bold block", isExpired ? "text-red-500" : isExpiringSoon ? "text-amber-500" : "text-foreground")}>
                {driver.licenseExpiry
                  ? new Date(driver.licenseExpiry).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
                  : "N/A"}
              </span>
            </div>

            {/* Emergency Contact */}
            <div className="p-3.5 rounded-xl bg-muted/20 border border-border/60 space-y-1">
              <span className="text-[10px] font-bold text-muted-foreground uppercase block">Emergency Contact</span>
              <span className="text-sm font-medium text-foreground">{driver.emergencyContact || "N/A"}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
