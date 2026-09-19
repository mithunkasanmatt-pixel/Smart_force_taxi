"use client";

import React, { useState } from "react";
import { User, DriverSalary, PayrollRecord } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { cn } from "@/utils/cn";
import {

  User as UserIcon,
  Mail,
  Phone,
  Calendar,
  CreditCard,
  MapPin,
  ShieldAlert,
  Eye,
  EyeOff,
  DollarSign,
  Building,
  FileText,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";

interface DriverProfileViewProps {
  driver: User & {
    salaryDetails?: DriverSalary | null;
    payrollRecords?: PayrollRecord[];
  };
}

export function DriverProfileViewClient({ driver }: DriverProfileViewProps) {
  const [showSsn, setShowSsn] = useState(false);

  const salary = driver.salaryDetails;
  const payslips = driver.payrollRecords || [];

  // Calculate License Expiry Days
  const now = new Date();
  const expiryDate = driver.licenseExpiry ? new Date(driver.licenseExpiry) : null;
  const daysRemaining = expiryDate
    ? Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    : null;

  const isExpired = daysRemaining !== null && daysRemaining < 0;
  const isExpiringSoon = daysRemaining !== null && daysRemaining >= 0 && daysRemaining <= 30;

  const baseSalary = salary?.baseSalary || 2500;
  const allowances = salary?.allowances || 0;
  const deductions = salary?.deductions || 0;
  const taxRate = salary?.taxRate || 13.5;
  const grossSalary = baseSalary + allowances - deductions;
  const taxAmount = (grossSalary * taxRate) / 100;
  const netSalary = Math.max(0, Math.round((grossSalary - taxAmount) * 100) / 100);

  return (
    <div className="space-y-6 pb-12">
      {/* Expiry Notification Banner */}
      {isExpired && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 flex items-start gap-3 shadow-sm animate-pulse">
          <AlertTriangle className="h-6 w-6 shrink-0 mt-0.5 text-red-500" />
          <div className="space-y-1">
            <h4 className="font-bold text-sm">URGENT: Taxi License Expired!</h4>
            <p className="text-xs text-red-600/90 dark:text-red-300">
              Your taxi license expired {Math.abs(daysRemaining)} days ago on{" "}
              {expiryDate?.toLocaleDateString()}. Please renew your license immediately and submit updated proof to your fleet manager. You cannot operate fleet vehicles with an expired license.
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
              {expiryDate?.toLocaleDateString()}. Please renew your license promptly to prevent disruption to your driving duties.
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

      {/* Salary & Payroll Details Section (Read-Only for Driver) */}
      <div className="p-6 border border-border bg-card rounded-2xl space-y-6 glass shadow-sm">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-emerald-500" /> My Salary Details (Accounting View)
            </h3>
            <p className="text-xs text-muted-foreground">
              Official compensation breakdown managed by the Fleet Accounting Team.
            </p>
          </div>
          <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-xs">
            {salary?.payType || "MONTHLY"} PAY
          </Badge>
        </div>

        {/* Compensation Breakdown Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-muted/30 border border-border/60 space-y-1">
            <span className="text-[10px] font-bold text-muted-foreground uppercase block">Base Salary</span>
            <span className="text-xl font-mono font-bold text-foreground">€{baseSalary.toLocaleString()}</span>
          </div>

          <div className="p-4 rounded-xl bg-muted/30 border border-border/60 space-y-1">
            <span className="text-[10px] font-bold text-muted-foreground uppercase block">Allowances / Bonus</span>
            <span className="text-xl font-mono font-bold text-emerald-500">+€{allowances.toLocaleString()}</span>
          </div>

          <div className="p-4 rounded-xl bg-muted/30 border border-border/60 space-y-1">
            <span className="text-[10px] font-bold text-muted-foreground uppercase block">Est. Tax ({taxRate}%)</span>
            <span className="text-xl font-mono font-bold text-amber-500">-€{taxAmount.toFixed(2)}</span>
          </div>

          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 space-y-1">
            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase block">Est. Net Take-Home</span>
            <span className="text-2xl font-mono font-extrabold text-emerald-500">€{netSalary.toLocaleString()}</span>
          </div>
        </div>

        {/* Bank & Payment Information */}
        <div className="p-4 rounded-xl bg-muted/20 border border-border/60 space-y-2">
          <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Building className="h-4 w-4 text-primary" /> Direct Deposit Bank Account Details
          </h4>

          {salary?.bankName ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 text-xs">
              <div>
                <span className="text-muted-foreground block text-[10px] uppercase">Bank Name</span>
                <span className="font-bold text-foreground">{salary.bankName}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[10px] uppercase">Account Number</span>
                <span className="font-mono font-bold text-foreground">
                  •••• {salary.accountNumber?.slice(-4) || "N/A"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[10px] uppercase">Routing / SWIFT</span>
                <span className="font-mono font-bold text-foreground">{salary.routingNumber || "N/A"}</span>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic pt-1">
              Direct deposit details not yet configured by accounting. Please contact your administrator.
            </p>
          )}
        </div>

        {/* Monthly Payslips History */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
            <FileText className="h-4 w-4 text-primary" /> Issued Monthly Payslips ({payslips.length})
          </h4>

          <div className="border border-border/60 rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-muted-foreground uppercase font-semibold text-[10px] tracking-wider">
                  <th className="p-3">Ref No.</th>
                  <th className="p-3">Period</th>
                  <th className="p-3">Gross Pay</th>
                  <th className="p-3">Tax Withheld</th>
                  <th className="p-3">Net Salary</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {payslips.map((p) => (
                  <tr key={p.id} className="hover:bg-muted/20 transition-colors">
                    <td className="p-3 font-mono font-bold text-foreground">{p.referenceNumber || "PAY-RECORD"}</td>
                    <td className="p-3 font-semibold text-foreground">
                      {new Date(p.year, p.month - 1).toLocaleString("default", { month: "long" })} {p.year}
                    </td>
                    <td className="p-3 font-mono">€{(p.baseAmount + p.allowances - p.deductions).toLocaleString()}</td>
                    <td className="p-3 font-mono text-amber-500">€{p.taxAmount.toLocaleString()}</td>
                    <td className="p-3 font-mono font-extrabold text-emerald-500">€{p.netSalary.toLocaleString()}</td>
                    <td className="p-3">
                      <Badge className="bg-emerald-500/20 text-emerald-500 border-emerald-500/30 text-[10px]">
                        <CheckCircle2 className="h-3 w-3 mr-1" /> {p.paymentStatus}
                      </Badge>
                    </td>
                  </tr>
                ))}

                {payslips.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-xs text-muted-foreground italic">
                      No issued payslips yet. Monthly payment records will appear here after payroll processing.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
