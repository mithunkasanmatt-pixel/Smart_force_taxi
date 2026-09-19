"use client";

import React, { useState, useTransition, useMemo } from "react";
import { User, DriverEarning } from "@prisma/client";
import {
  Euro,
  Calculator,
  Lock,
  Calendar,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Receipt,
  Info,
  Clock,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/utils/cn";
import { calculateEarningsBreakdown } from "@/lib/tax-calculator";
import { submitDriverEarningsAction } from "@/actions/driver-earnings";

interface DriverEarningsClientProps {
  driver: User;
  initialEarnings: DriverEarning[];
}

export function DriverEarningsClient({ driver, initialEarnings }: DriverEarningsClientProps) {
  const [isPending, startTransition] = useTransition();

  const [totalEarningsInput, setTotalEarningsInput] = useState<string>("");
  const [notesInput, setNotesInput] = useState<string>("");
  const [dateInput, setDateInput] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  });

  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<boolean>(false);
  const [earningsList, setEarningsList] = useState<DriverEarning[]>(initialEarnings);

  // Live calculation preview
  const liveCalculation = useMemo(() => {
    const amount = parseFloat(totalEarningsInput);
    if (isNaN(amount) || amount <= 0) return null;
    return calculateEarningsBreakdown(amount);
  }, [totalEarningsInput]);

  // Overall statistics
  const stats = useMemo(() => {
    const totalGross = earningsList.reduce((acc, curr) => acc + curr.totalEarnings, 0);
    const totalTax = earningsList.reduce((acc, curr) => acc + curr.taxAmount, 0);
    const totalNetDriverShare = earningsList.reduce((acc, curr) => acc + curr.driverShare, 0);

    return {
      totalGross,
      totalTax,
      totalNetDriverShare,
      entriesCount: earningsList.length,
    };
  }, [earningsList]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(false);

    const numericAmount = parseFloat(totalEarningsInput);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      setFormError("Please enter a valid Total Earnings amount greater than 0.");
      return;
    }

    startTransition(async () => {
      const res = await submitDriverEarningsAction({
        driverId: driver.id,
        totalEarnings: numericAmount,
        date: dateInput,
        notes: notesInput || undefined,
      });

      if (res.error) {
        setFormError(res.error);
      } else if (res.earning) {
        setEarningsList((prev) => [res.earning as any, ...prev]);
        setTotalEarningsInput("");
        setNotesInput("");
        setFormSuccess(true);
        setTimeout(() => setFormSuccess(false), 4000);
      }
    });
  };

  return (
    <div className="mx-auto max-w-7xl w-full space-y-6 text-foreground pb-12">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-primary/10 via-primary/5 to-background border border-primary/20 p-6 rounded-2xl shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider mb-1">
            <Receipt className="h-4 w-4" /> Driver Earnings Portal
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
            Earnings & Tax Calculation
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Submit your daily earnings to calculate automatic tax deductions and your net payout.
          </p>
        </div>

        {/* Total Net Payout Badge */}
        <div className="bg-card border border-border p-4 rounded-xl shadow-xs text-left md:text-right shrink-0">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block">
            Total Payout (After Tax)
          </span>
          <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
            €{stats.totalNetDriverShare.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      {/* Grid Layout: Input Form & Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Col (7 cols): Submission Form */}
        <div className="lg:col-span-7 space-y-4 border border-border bg-card p-6 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-border/50">
            <h2 className="text-base font-extrabold text-foreground flex items-center gap-2">
              <Calculator className="h-5 w-5 text-primary" /> Enter Total Earnings
            </h2>
            <Badge variant="outline" className="text-[10px] font-bold text-amber-600 bg-amber-500/10 border-amber-500/20">
              Auto Tax & Share Calculation
            </Badge>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {formError && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-600 font-bold flex items-center gap-2 animate-in fade-in">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {formSuccess && (
              <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-xl text-xs text-green-600 font-bold flex items-center gap-2 animate-bounce">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>Earnings submitted successfully! Your record is now saved.</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Earnings Amount Input */}
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1">
                  <Euro className="h-4 w-4 text-emerald-500" /> Total Earnings (€)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-lg font-bold text-muted-foreground">€</span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="e.g. 500.00"
                    value={totalEarningsInput}
                    onChange={(e) => setTotalEarningsInput(e.target.value)}
                    className="pl-8 text-lg font-bold font-mono h-12"
                    required
                  />
                </div>
              </div>

              {/* Date Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" /> Date of Earnings
                </label>
                <Input
                  type="date"
                  value={dateInput}
                  onChange={(e) => setDateInput(e.target.value)}
                  className="h-10 text-xs font-semibold"
                  required
                />
              </div>

              {/* Notes Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Notes / Shift Info (Optional)
                </label>
                <Input
                  type="text"
                  placeholder="e.g. Day shift fare collection"
                  value={notesInput}
                  onChange={(e) => setNotesInput(e.target.value)}
                  className="h-10 text-xs"
                />
              </div>
            </div>

            {/* LIVE BREAKDOWN PREVIEW */}
            {liveCalculation && (
              <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl space-y-3 animate-in fade-in">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-primary block">
                  Automatic Calculation Preview
                </span>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-2.5 bg-card border border-border rounded-lg">
                    <span className="text-muted-foreground text-[10px] block font-semibold">Total Earnings</span>
                    <span className="font-extrabold font-mono text-sm text-foreground">
                      €{liveCalculation.totalEarnings.toFixed(2)}
                    </span>
                  </div>

                  <div className="p-2.5 bg-card border border-border rounded-lg">
                    <span className="text-muted-foreground text-[10px] block font-semibold">13.5% Tax Deduction</span>
                    <span className="font-extrabold font-mono text-sm text-red-500">
                      -€{liveCalculation.taxAmount.toFixed(2)}
                    </span>
                  </div>

                  <div className="p-2.5 bg-card border border-border rounded-lg col-span-2 sm:col-span-1">
                    <span className="text-muted-foreground text-[10px] block font-semibold">Remaining Amount</span>
                    <span className="font-extrabold font-mono text-sm text-foreground">
                      €{liveCalculation.remainingAmount.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* PROMINENT REQUIRED DISPLAY: Your Share after Tax Payment */}
                <div className="p-4 bg-emerald-500/10 border-2 border-emerald-500/30 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="text-xs font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400 block">
                      Your Share after Tax Payment
                    </span>
                    <span className="text-[10px] text-muted-foreground block font-semibold mt-0.5">
                      Net payout (Calculated share after 13.5% tax deduction)
                    </span>
                  </div>
                  <span className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">
                    €{liveCalculation.driverShare.toFixed(2)}
                  </span>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={isPending}
              className="w-full h-11 bg-primary text-primary-foreground font-bold text-sm cursor-pointer shadow-sm hover:bg-primary/90"
            >
              {isPending ? "Submitting Earnings..." : "Submit Total Earnings"}
            </Button>
          </form>
        </div>

        {/* Right Col (5 cols): Overview Cards & Info */}
        <div className="lg:col-span-5 space-y-4">
          <div className="border border-border bg-card p-5 rounded-2xl shadow-xs space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4 text-primary" /> Earnings Summary Stats
            </h3>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-muted/20 border border-border/60 rounded-xl">
                <span className="text-muted-foreground text-[10px] font-bold block">Submitted Entries</span>
                <span className="text-xl font-extrabold font-mono text-foreground">{stats.entriesCount}</span>
              </div>
              <div className="p-3 bg-muted/20 border border-border/60 rounded-xl">
                <span className="text-muted-foreground text-[10px] font-bold block">Total Gross Earnings</span>
                <span className="text-xl font-extrabold font-mono text-foreground">€{stats.totalGross.toFixed(2)}</span>
              </div>
              <div className="p-3 bg-muted/20 border border-border/60 rounded-xl col-span-2">
                <span className="text-muted-foreground text-[10px] font-bold block">Total Tax Deducted (13.5%)</span>
                <span className="text-lg font-extrabold font-mono text-red-500">€{stats.totalTax.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Locked Entry Policy Alert */}
          <div className="p-4 bg-amber-500/10 border border-amber-500/25 rounded-2xl space-y-2 text-xs text-amber-800 dark:text-amber-300">
            <div className="flex items-center gap-2 font-bold uppercase tracking-wider text-[11px]">
              <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0" />
              <span>Edit Permission Notice</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              Once submitted, earnings entries are <strong>locked and non-editable by drivers</strong>.
              If any correction or modification is required, only the <strong>Admin</strong> has permission to adjust submitted records.
            </p>
          </div>
        </div>
      </div>

      {/* SUBMITTED EARNINGS HISTORY TABLE / CARDS */}
      <div className="border border-border bg-card rounded-2xl p-6 space-y-4 shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-border/50">
          <div>
            <h3 className="text-base font-extrabold text-foreground flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" /> Submitted Earnings History
            </h3>
            <span className="text-xs text-muted-foreground">
              Review your past earnings submissions and net payouts.
            </span>
          </div>
          <Badge variant="outline" className="font-mono text-xs">
            {earningsList.length} Records
          </Badge>
        </div>

        {earningsList.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground border border-dashed border-border rounded-xl">
            <Receipt className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
            <p className="text-xs font-semibold">No earnings submissions recorded yet.</p>
            <span className="text-[11px]">Use the form above to submit your earnings.</span>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="text-[10px] uppercase font-bold text-muted-foreground bg-muted/40 border-b border-border">
                  <tr>
                    <th className="p-3">Date</th>
                    <th className="p-3">Total Earnings</th>
                    <th className="p-3">13.5% Tax</th>
                    <th className="p-3">Your Share after Tax Payment</th>
                    <th className="p-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {earningsList.map((item) => (
                    <tr key={item.id} className="hover:bg-muted/10 transition-colors">
                      <td className="p-3 font-semibold text-foreground whitespace-nowrap">
                        {new Date(item.date).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}
                      </td>
                      <td className="p-3 font-mono font-bold text-foreground whitespace-nowrap">
                        €{item.totalEarnings.toFixed(2)}
                      </td>
                      <td className="p-3 font-mono font-semibold text-red-500 whitespace-nowrap">
                        -€{item.taxAmount.toFixed(2)}
                      </td>
                      <td className="p-3 font-mono font-black text-emerald-600 dark:text-emerald-400 text-sm whitespace-nowrap">
                        €{item.driverShare.toFixed(2)}
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <Badge variant="outline" className="text-[9px] font-bold gap-1 bg-muted/30">
                          <Lock className="h-3 w-3 text-muted-foreground" />
                          {item.status === "ADJUSTED_BY_ADMIN" ? "Adjusted by Admin" : "Submitted (Locked)"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards View */}
            <div className="md:hidden space-y-3">
              {earningsList.map((item) => (
                <div key={item.id} className="p-4 border border-border rounded-xl space-y-2 bg-muted/5">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-xs font-bold text-foreground">
                        {new Date(item.date).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                      </span>
                      {item.notes && <span className="text-[10px] text-muted-foreground block italic">{item.notes}</span>}
                    </div>
                    <Badge variant="outline" className="text-[8px] font-bold gap-1">
                      <Lock className="h-2.5 w-2.5" />
                      Locked
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-border/40">
                    <div>
                      <span className="text-[9px] font-bold text-muted-foreground uppercase block">Total Earnings</span>
                      <span className="font-mono font-bold text-foreground">€{item.totalEarnings.toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-[9px] font-bold text-muted-foreground uppercase block">13.5% Tax</span>
                      <span className="font-mono font-bold text-red-500">-€{item.taxAmount.toFixed(2)}</span>
                    </div>
                  </div>

                  {/* PROMINENT REQUIRED DISPLAY FOR MOBILE CARD */}
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex items-center justify-between mt-2">
                    <span className="text-[10px] font-black uppercase text-emerald-700 dark:text-emerald-400">
                      Your Share after Tax Payment
                    </span>
                    <span className="text-base font-black font-mono text-emerald-600 dark:text-emerald-400">
                      €{item.driverShare.toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
