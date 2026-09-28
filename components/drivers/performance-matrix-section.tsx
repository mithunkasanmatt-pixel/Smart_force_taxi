"use client";

import React from "react";
import {
  Trophy,
  Award,
  DollarSign,
  TrendingUp,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Calendar,
  UserCheck,
  Zap,
} from "lucide-react";
import { cn } from "@/utils/cn";

export interface PerformanceMatrixData {
  rank: number | null;
  totalDrivers: number;
  bookedHours?: number;
  actualHours?: number;
  performanceRatio?: number;
  score?: number;
  performanceRecord?: {
    id: string;
    periodType?: string;
    weekLabel?: string | null;
    bookedHours: number;
    actualHours: number;
    performanceRatio: number;
    score: number;
    status: string;
    rewardEligible: boolean;
    rewardGranted: boolean;
    rewardTitle?: string | null;
    rewardAmount?: number | null;
    verifiedBy?: string | null;
    verifiedAt: Date | string;
    notes?: string | null;
  } | null;
}

interface PerformanceMatrixSectionProps {
  matrixData: PerformanceMatrixData;
  className?: string;
}

function formatDate(dateInput?: Date | string | null): string {
  if (!dateInput) return "N/A";
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return "N/A";
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function PerformanceMatrixSection({
  matrixData,
  className,
}: PerformanceMatrixSectionProps) {
  const { rank, totalDrivers, performanceRecord } = matrixData;
  const isTop3 = rank !== null && rank >= 1 && rank <= 3;
  const rewardGranted = performanceRecord?.rewardGranted || false;
  const rewardAmount = performanceRecord?.rewardAmount || 0;
  const rewardTitle = performanceRecord?.rewardTitle || (isTop3 ? `Top Performer Bonus - Rank #${rank}` : null);

  const bookedHours = performanceRecord?.bookedHours ?? matrixData.bookedHours ?? 0;
  const actualHours = performanceRecord?.actualHours ?? matrixData.actualHours ?? 0;
  const ratio = performanceRecord?.performanceRatio ?? matrixData.performanceRatio ?? 0;

  const rankBadgeText =
    rank === 1
      ? "🥇 1st Place (Top Performer)"
      : rank === 2
      ? "🥈 2nd Place"
      : rank === 3
      ? "🥉 3rd Place"
      : rank
      ? `Rank #${rank} of ${totalDrivers}`
      : "Not Ranked";

  const rankBgColor =
    rank === 1
      ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30"
      : rank === 2
      ? "bg-slate-500/10 text-slate-600 dark:text-slate-300 border-slate-500/30"
      : rank === 3
      ? "bg-amber-700/10 text-amber-700 dark:text-amber-500 border-amber-700/30"
      : "bg-muted text-muted-foreground border-border";

  return (
    <div
      className={cn(
        "p-6 border border-border bg-card rounded-2xl space-y-6 shadow-sm",
        className
      )}
    >
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20">
            <Trophy className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
              Performance Matrix
            </h3>
            <p className="text-xs text-muted-foreground">
              Official driver performance evaluation, leaderboard rank, and bonus reward status.
            </p>
          </div>
        </div>

        {rewardGranted ? (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-xs font-bold">
            <Sparkles className="h-3.5 w-3.5" />
            Bonus Paid (${rewardAmount})
          </div>
        ) : (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted text-muted-foreground border border-border text-xs font-semibold">
            <Award className="h-3.5 w-3.5" />
            No Bonus Issued
          </div>
        )}
      </div>

      {/* Top Grid: Rank & Bonus Amount Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Card 1: Leaderboard Rank */}
        <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Leaderboard Position / Rank
            </span>
            <Trophy className="h-4 w-4 text-amber-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-foreground font-mono">
              {rank ? `#${rank}` : "N/A"}
            </span>
            <span className="text-xs text-muted-foreground">
              {totalDrivers > 0 ? `out of ${totalDrivers} drivers` : ""}
            </span>
          </div>
          <div>
            <span
              className={cn(
                "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border",
                rankBgColor
              )}
            >
              {rankBadgeText}
            </span>
          </div>
        </div>

        {/* Card 2: Bonus Amount Received */}
        <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Bonus Amount Received
            </span>
            <DollarSign className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span
              className={cn(
                "text-2xl font-black font-mono",
                rewardGranted ? "text-emerald-500" : "text-foreground"
              )}
            >
              ${rewardAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-xs text-muted-foreground">
              {rewardGranted ? "Granted" : "No Bonus"}
            </span>
          </div>
          <div>
            <span
              className={cn(
                "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border",
                rewardGranted
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 font-bold"
                  : "bg-muted text-muted-foreground border-border"
              )}
            >
              {rewardGranted ? "Reward Paid by Fleet Management" : "Standard Driver Tier"}
            </span>
          </div>
        </div>

        {/* Card 3: Driving Hours & Efficiency Ratio */}
        <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-2 sm:col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Driving Hours & Efficiency
            </span>
            <TrendingUp className="h-4 w-4 text-primary" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-primary font-mono">
              {actualHours}h
            </span>
            <span className="text-xs text-muted-foreground">
              (Booked: {bookedHours}h)
            </span>
          </div>
          <div className="text-xs font-semibold text-muted-foreground flex items-center justify-between">
            <span>Adherence Ratio:</span>
            <span className="font-bold text-foreground font-mono">{ratio}%</span>
          </div>
        </div>
      </div>

      {/* Bonus Details OR Encouraging Message Section */}
      {rewardGranted ? (
        /* Bonus Payment Details Box */
        <div className="p-5 rounded-xl border border-emerald-500/30 bg-emerald-500/5 space-y-4">
          <div className="flex items-center justify-between border-b border-emerald-500/20 pb-3">
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-emerald-500" />
              <h4 className="text-sm font-bold text-emerald-700 dark:text-emerald-300">
                Bonus Payment Details
              </h4>
            </div>
            <span className="px-2.5 py-0.5 rounded text-[11px] font-bold bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30 uppercase tracking-wider">
              Payment Completed
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            <div>
              <span className="text-muted-foreground block text-[10px] font-bold uppercase">
                Reward Title
              </span>
              <strong className="text-foreground text-sm block truncate mt-0.5">
                {rewardTitle || "Top Performer Bonus"}
              </strong>
            </div>

            <div>
              <span className="text-muted-foreground block text-[10px] font-bold uppercase">
                Bonus Amount
              </span>
              <strong className="text-emerald-600 dark:text-emerald-400 text-sm font-mono block mt-0.5">
                ${rewardAmount.toFixed(2)}
              </strong>
            </div>

            <div>
              <span className="text-muted-foreground block text-[10px] font-bold uppercase">
                Granted / Approved By
              </span>
              <strong className="text-foreground block mt-0.5 flex items-center gap-1">
                <UserCheck className="h-3.5 w-3.5 text-primary" />
                {performanceRecord?.verifiedBy || "Fleet Admin"}
              </strong>
            </div>

            <div>
              <span className="text-muted-foreground block text-[10px] font-bold uppercase">
                Payment Date
              </span>
              <strong className="text-foreground block mt-0.5 flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-primary" />
                {formatDate(performanceRecord?.verifiedAt)}
              </strong>
            </div>
          </div>

          {performanceRecord?.notes && (
            <div className="pt-2 border-t border-emerald-500/20 text-xs">
              <span className="text-muted-foreground font-bold block text-[10px] uppercase">
                Admin Remarks / Notes:
              </span>
              <p className="text-emerald-800 dark:text-emerald-200 mt-0.5 italic">
                "{performanceRecord.notes}"
              </p>
            </div>
          )}
        </div>
      ) : (
        /* Encouraging Message Box for Drivers Who Did Not Receive a Bonus */
        <div className="p-5 rounded-xl border border-amber-500/30 bg-amber-500/5 space-y-3">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500 shrink-0 mt-0.5">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="space-y-1.5 flex-1">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-amber-700 dark:text-amber-400">
                  Performance & Bonus Status
                </h4>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  {rank ? `Current Position: #${rank}` : "Standard Tier"}
                </span>
              </div>
              <p className="text-xs font-semibold text-amber-800 dark:text-amber-300 leading-relaxed">
                You are currently ranked <strong>#{rank || "N/A"}</strong> out of {totalDrivers} active drivers. Fleet performance bonuses are awarded to the top 3 drivers on the leaderboard.
              </p>
              <div className="p-3 rounded-lg bg-card border border-amber-500/20 text-xs font-bold text-foreground flex items-center gap-2 mt-2">
                <TrendingUp className="h-4 w-4 text-amber-500 shrink-0" />
                <span>
                  “Improve your working hours and performance to earn more money and bonuses.”
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
