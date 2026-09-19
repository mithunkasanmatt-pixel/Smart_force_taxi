"use client";

import React, { useState, useTransition } from "react";
import { User, DriverSalary, PayrollRecord } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import {
  CreditCard,
  Search,
  DollarSign,
  Building,
  Calendar,
  CheckCircle2,
  Clock,
  Edit3,
  Plus,
  Loader2,
  TrendingUp,
  Percent,
  FileText,
  User as UserIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { upsertDriverSalaryAction, createPayrollRecordAction, updatePayrollStatusAction } from "@/actions/salary";

interface AccountingProps {
  drivers: (User & {
    salaryDetails?: DriverSalary | null;
    payrollRecords?: PayrollRecord[];
  })[];
  payrollHistory: (PayrollRecord & {
    driver: {
      id: string;
      name: string;
      email: string;
      employeeId: string;
      ssn?: string | null;
    };
  })[];
}

export function AccountingManagerClient({ drivers, payrollHistory }: AccountingProps) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDriver, setSelectedDriver] = useState<any>(drivers[0] || null);
  const [isPending, startTransition] = useTransition();

  // Modals
  const [isEditSalaryOpen, setIsEditSalaryOpen] = useState(false);
  const [isCreatePayrollOpen, setIsCreatePayrollOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Salary Form State
  const [salaryForm, setSalaryForm] = useState({
    baseSalary: 2500,
    payType: "MONTHLY",
    hourlyRate: 0,
    bankName: "",
    accountNumber: "",
    routingNumber: "",
    allowances: 0,
    deductions: 0,
    taxRate: 13.5,
    notes: "",
  });

  // Payroll Form State
  const [payrollForm, setPayrollForm] = useState({
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    baseAmount: 2500,
    allowances: 0,
    deductions: 0,
    notes: "",
  });

  const filteredDrivers = drivers.filter(
    (d) =>
      d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.employeeId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (d.ssn && d.ssn.includes(searchTerm))
  );

  const openEditSalaryModal = (driver: any) => {
    setSelectedDriver(driver);
    const sal = driver.salaryDetails;
    setSalaryForm({
      baseSalary: sal?.baseSalary || 2500,
      payType: sal?.payType || "MONTHLY",
      hourlyRate: sal?.hourlyRate || 0,
      bankName: sal?.bankName || "",
      accountNumber: sal?.accountNumber || "",
      routingNumber: sal?.routingNumber || "",
      allowances: sal?.allowances || 0,
      deductions: sal?.deductions || 0,
      taxRate: sal?.taxRate || 13.5,
      notes: sal?.notes || "",
    });
    setFormError(null);
    setFormSuccess(null);
    setIsEditSalaryOpen(true);
  };

  const handleSaveSalary = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDriver) return;
    setFormError(null);

    startTransition(async () => {
      const res = await upsertDriverSalaryAction({
        driverId: selectedDriver.id,
        baseSalary: Number(salaryForm.baseSalary),
        payType: salaryForm.payType,
        hourlyRate: Number(salaryForm.hourlyRate),
        bankName: salaryForm.bankName,
        accountNumber: salaryForm.accountNumber,
        routingNumber: salaryForm.routingNumber,
        allowances: Number(salaryForm.allowances),
        deductions: Number(salaryForm.deductions),
        taxRate: Number(salaryForm.taxRate),
        notes: salaryForm.notes,
      });

      if (res.error) {
        setFormError(res.error);
      } else {
        setFormSuccess("Salary details updated successfully!");
        setTimeout(() => {
          setIsEditSalaryOpen(false);
          router.refresh();
        }, 1200);
      }
    });
  };

  const openCreatePayrollModal = (driver: any) => {
    setSelectedDriver(driver);
    const sal = driver.salaryDetails;
    setPayrollForm({
      month: new Date().getMonth() + 1,
      year: new Date().getFullYear(),
      baseAmount: sal?.baseSalary || 2500,
      allowances: sal?.allowances || 0,
      deductions: sal?.deductions || 0,
      notes: "",
    });
    setFormError(null);
    setFormSuccess(null);
    setIsCreatePayrollOpen(true);
  };

  const handleGeneratePayroll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDriver) return;
    setFormError(null);

    const sal = selectedDriver.salaryDetails;
    const taxRate = sal?.taxRate || 13.5;
    const gross = payrollForm.baseAmount + payrollForm.allowances - payrollForm.deductions;
    const taxAmount = (gross * taxRate) / 100;
    const netSalary = gross - taxAmount;

    startTransition(async () => {
      const res = await createPayrollRecordAction({
        driverId: selectedDriver.id,
        month: Number(payrollForm.month),
        year: Number(payrollForm.year),
        baseAmount: Number(payrollForm.baseAmount),
        allowances: Number(payrollForm.allowances),
        deductions: Number(payrollForm.deductions),
        taxAmount: Math.round(taxAmount * 100) / 100,
        netSalary: Math.round(netSalary * 100) / 100,
        paymentStatus: "PAID",
        notes: payrollForm.notes,
      });

      if (res.error) {
        setFormError(res.error);
      } else {
        setFormSuccess("Payroll slip generated and marked as PAID!");
        setTimeout(() => {
          setIsCreatePayrollOpen(false);
          router.refresh();
        }, 1200);
      }
    });
  };

  const calculateNetSalaryPreview = (base: number, allow: number, deduct: number, tax: number) => {
    const gross = base + allow - deduct;
    const taxAmt = (gross * tax) / 100;
    return Math.max(0, Math.round((gross - taxAmt) * 100) / 100);
  };

  // Stats
  const totalMonthlyPayroll = drivers.reduce((acc, d) => {
    const base = d.salaryDetails?.baseSalary || 2500;
    const allow = d.salaryDetails?.allowances || 0;
    const deduct = d.salaryDetails?.deductions || 0;
    const tax = d.salaryDetails?.taxRate || 13.5;
    return acc + calculateNetSalaryPreview(base, allow, deduct, tax);
  }, 0);

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <DollarSign className="h-7 w-7 text-emerald-500" /> Accounting & Salary Portal
          </h2>
          <p className="text-sm text-muted-foreground">
            Manage driver compensation structures, bank account details, monthly payroll slips, and tax deductions.
          </p>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 border border-border bg-card rounded-xl space-y-1 glass">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Total Registered Drivers</span>
          <div className="flex items-center justify-between">
            <span className="text-2xl font-extrabold text-foreground">{drivers.length}</span>
            <UserIcon className="h-6 w-6 text-primary" />
          </div>
        </div>

        <div className="p-5 border border-border bg-card rounded-xl space-y-1 glass">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Est. Monthly Net Payroll</span>
          <div className="flex items-center justify-between">
            <span className="text-2xl font-extrabold text-emerald-500">€{totalMonthlyPayroll.toLocaleString()}</span>
            <TrendingUp className="h-6 w-6 text-emerald-500" />
          </div>
        </div>

        <div className="p-5 border border-border bg-card rounded-xl space-y-1 glass">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Processed Payslips</span>
          <div className="flex items-center justify-between">
            <span className="text-2xl font-extrabold text-foreground">{payrollHistory.length}</span>
            <FileText className="h-6 w-6 text-amber-500" />
          </div>
        </div>

        <div className="p-5 border border-border bg-card rounded-xl space-y-1 glass">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Default Tax Withholding</span>
          <div className="flex items-center justify-between">
            <span className="text-2xl font-extrabold text-foreground">13.5%</span>
            <Percent className="h-6 w-6 text-indigo-500" />
          </div>
        </div>
      </div>

      {/* Main Content Layout */}
      <div className="space-y-6">
        {/* Search Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3 top-3 h-4.5 w-4.5 text-muted-foreground" />
            <Input
              placeholder="Search driver by name, SSN, ID or email..."
              className="pl-10 bg-card"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Drivers Salary Directory Table */}
        <div className="border border-border rounded-xl bg-card overflow-hidden shadow-sm">
          <div className="p-4 bg-muted/20 border-b border-border font-bold text-sm text-foreground flex items-center justify-between">
            <span>Driver Salary Directory ({filteredDrivers.length})</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-muted-foreground uppercase font-semibold text-[10px] tracking-wider">
                  <th className="p-4">Driver Profile</th>
                  <th className="p-4">SSN / Address</th>
                  <th className="p-4">Pay Structure</th>
                  <th className="p-4">Base Salary</th>
                  <th className="p-4">Allowances / Deductions</th>
                  <th className="p-4">Est. Net Pay</th>
                  <th className="p-4">Bank Details</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredDrivers.map((driver) => {
                  const sal = driver.salaryDetails;
                  const base = sal?.baseSalary || 2500;
                  const allow = sal?.allowances || 0;
                  const deduct = sal?.deductions || 0;
                  const tax = sal?.taxRate || 13.5;
                  const net = calculateNetSalaryPreview(base, allow, deduct, tax);

                  return (
                    <tr key={driver.id} className="hover:bg-muted/20 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          {driver.profilePicture ? (
                            <img
                              src={driver.profilePicture}
                              alt={driver.name}
                              className="w-10 h-10 rounded-full object-cover border border-border"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
                              {driver.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <span className="font-bold text-foreground text-sm block">{driver.name}</span>
                            <span className="text-[10px] text-muted-foreground font-mono">{driver.employeeId}</span>
                          </div>
                        </div>
                      </td>

                      <td className="p-4">
                        <div>
                          <span className="font-mono font-semibold text-foreground block">SSN: {driver.ssn || "N/A"}</span>
                          <span className="text-[11px] text-muted-foreground truncate block max-w-[150px]">{driver.homeAddress || "N/A"}</span>
                        </div>
                      </td>

                      <td className="p-4">
                        <Badge variant="outline" className="text-[10px] font-semibold bg-primary/5 text-primary border-primary/20">
                          {sal?.payType || "MONTHLY"}
                        </Badge>
                      </td>

                      <td className="p-4 font-bold text-foreground font-mono">€{base.toLocaleString()}</td>

                      <td className="p-4 space-y-0.5">
                        <span className="text-emerald-500 font-mono text-[11px] block">+€{allow} Allow.</span>
                        <span className="text-red-500 font-mono text-[11px] block">-€{deduct} Deduct.</span>
                      </td>

                      <td className="p-4">
                        <span className="font-extrabold text-emerald-500 text-sm font-mono">€{net.toLocaleString()}</span>
                        <span className="text-[9px] text-muted-foreground block">({tax}% tax)</span>
                      </td>

                      <td className="p-4">
                        {sal?.bankName ? (
                          <div>
                            <span className="font-semibold text-foreground block text-[11px]">{sal.bankName}</span>
                            <span className="font-mono text-[10px] text-muted-foreground block">Acc: •••• {sal.accountNumber?.slice(-4) || "N/A"}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground italic text-[11px]">Not configured</span>
                        )}
                      </td>

                      <td className="p-4 text-right space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEditSalaryModal(driver)}
                          className="h-8 text-xs cursor-pointer border-border"
                        >
                          <Edit3 className="h-3.5 w-3.5 mr-1 text-amber-500" /> Structure
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => openCreatePayrollModal(driver)}
                          className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer"
                        >
                          <DollarSign className="h-3.5 w-3.5 mr-1" /> Payslip
                        </Button>
                      </td>
                    </tr>
                  );
                })}

                {filteredDrivers.length === 0 && (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-xs text-muted-foreground italic">
                      No drivers match the search query.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Payroll History Log */}
        <div className="border border-border rounded-xl bg-card overflow-hidden shadow-sm">
          <div className="p-4 bg-muted/20 border-b border-border font-bold text-sm text-foreground flex items-center justify-between">
            <span className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" /> Generated Payroll History ({payrollHistory.length})
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-muted-foreground uppercase font-semibold text-[10px] tracking-wider">
                  <th className="p-4">Reference No.</th>
                  <th className="p-4">Driver</th>
                  <th className="p-4">Period</th>
                  <th className="p-4">Base</th>
                  <th className="p-4">Tax Withheld</th>
                  <th className="p-4">Net Paid</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Payment Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {payrollHistory.map((rec) => (
                  <tr key={rec.id} className="hover:bg-muted/20 transition-colors">
                    <td className="p-4 font-mono font-bold text-foreground">{rec.referenceNumber || "PAY-RECORD"}</td>
                    <td className="p-4">
                      <span className="font-bold text-foreground block">{rec.driver.name}</span>
                      <span className="text-[10px] text-muted-foreground font-mono">{rec.driver.employeeId}</span>
                    </td>
                    <td className="p-4 font-semibold text-foreground">
                      {new Date(rec.year, rec.month - 1).toLocaleString("default", { month: "long" })} {rec.year}
                    </td>
                    <td className="p-4 font-mono">€{rec.baseAmount.toLocaleString()}</td>
                    <td className="p-4 font-mono text-amber-500">€{rec.taxAmount.toLocaleString()}</td>
                    <td className="p-4 font-mono font-extrabold text-emerald-500">€{rec.netSalary.toLocaleString()}</td>
                    <td className="p-4">
                      <Badge className="bg-emerald-500/20 text-emerald-500 border-emerald-500/30 text-[10px]">
                        <CheckCircle2 className="h-3 w-3 mr-1" /> {rec.paymentStatus}
                      </Badge>
                    </td>
                    <td className="p-4 text-muted-foreground">
                      {rec.paymentDate ? new Date(rec.paymentDate).toLocaleDateString() : "N/A"}
                    </td>
                  </tr>
                ))}

                {payrollHistory.length === 0 && (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-xs text-muted-foreground italic">
                      No payroll records generated yet. Click "Payslip" on any driver to process a payment.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Edit Salary Details Modal */}
      <Dialog
        isOpen={isEditSalaryOpen}
        onClose={() => setIsEditSalaryOpen(false)}
        title={`Salary Configuration - ${selectedDriver?.name || ""}`}
        className="max-w-xl"
      >
        <form onSubmit={handleSaveSalary} className="space-y-4">
          {formError && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-500 font-medium">
              {formError}
            </div>
          )}
          {formSuccess && (
            <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-xs text-green-500 font-medium">
              {formSuccess}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Pay Type */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Payment Type</label>
              <select
                className="flex h-9 w-full rounded-lg border border-border bg-input px-3 py-1 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                value={salaryForm.payType}
                onChange={(e) => setSalaryForm({ ...salaryForm, payType: e.target.value })}
              >
                <option value="MONTHLY">Monthly Fixed Salary</option>
                <option value="WEEKLY">Weekly Salary</option>
                <option value="HOURLY">Hourly Rate</option>
                <option value="PER_TRIP">Per Trip Revenue Share</option>
              </select>
            </div>

            {/* Base Salary */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Base Salary Amount (€)</label>
              <Input
                type="number"
                value={salaryForm.baseSalary}
                onChange={(e) => setSalaryForm({ ...salaryForm, baseSalary: Number(e.target.value) })}
                required
              />
            </div>

            {/* Allowances */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Allowances (€)</label>
              <Input
                type="number"
                value={salaryForm.allowances}
                onChange={(e) => setSalaryForm({ ...salaryForm, allowances: Number(e.target.value) })}
              />
            </div>

            {/* Deductions */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Standard Deductions (€)</label>
              <Input
                type="number"
                value={salaryForm.deductions}
                onChange={(e) => setSalaryForm({ ...salaryForm, deductions: Number(e.target.value) })}
              />
            </div>

            {/* Tax Rate */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Tax Withholding Rate (%)</label>
              <Input
                type="number"
                step="0.1"
                value={salaryForm.taxRate}
                onChange={(e) => setSalaryForm({ ...salaryForm, taxRate: Number(e.target.value) })}
              />
            </div>

            {/* Bank Name */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Bank Name</label>
              <Input
                placeholder="e.g. Chase Bank / Nordea"
                value={salaryForm.bankName}
                onChange={(e) => setSalaryForm({ ...salaryForm, bankName: e.target.value })}
              />
            </div>

            {/* Account Number */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Account Number / IBAN</label>
              <Input
                placeholder="Account number"
                value={salaryForm.accountNumber}
                onChange={(e) => setSalaryForm({ ...salaryForm, accountNumber: e.target.value })}
              />
            </div>

            {/* Routing Number */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Routing / SWIFT Code</label>
              <Input
                placeholder="Routing / SWIFT code"
                value={salaryForm.routingNumber}
                onChange={(e) => setSalaryForm({ ...salaryForm, routingNumber: e.target.value })}
              />
            </div>
          </div>

          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex justify-between items-center text-xs">
            <span className="font-semibold text-foreground">Net Monthly Preview:</span>
            <span className="font-extrabold text-emerald-500 text-base font-mono">
              €
              {calculateNetSalaryPreview(
                salaryForm.baseSalary,
                salaryForm.allowances,
                salaryForm.deductions,
                salaryForm.taxRate
              ).toLocaleString()}
            </span>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <Button type="button" variant="outline" onClick={() => setIsEditSalaryOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
              {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null} Save Structure
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Generate Payroll Slip Modal */}
      <Dialog
        isOpen={isCreatePayrollOpen}
        onClose={() => setIsCreatePayrollOpen(false)}
        title={`Generate Payslip - ${selectedDriver?.name || ""}`}
        className="max-w-md"
      >
        <form onSubmit={handleGeneratePayroll} className="space-y-4">
          {formError && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-500 font-medium">
              {formError}
            </div>
          )}
          {formSuccess && (
            <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-xs text-green-500 font-medium">
              {formSuccess}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Month</label>
              <select
                className="flex h-9 w-full rounded-lg border border-border bg-input px-3 py-1 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                value={payrollForm.month}
                onChange={(e) => setPayrollForm({ ...payrollForm, month: Number(e.target.value) })}
              >
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {new Date(0, i).toLocaleString("default", { month: "long" })}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Year</label>
              <Input
                type="number"
                value={payrollForm.year}
                onChange={(e) => setPayrollForm({ ...payrollForm, year: Number(e.target.value) })}
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Base Amount (€)</label>
              <Input
                type="number"
                value={payrollForm.baseAmount}
                onChange={(e) => setPayrollForm({ ...payrollForm, baseAmount: Number(e.target.value) })}
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Allowances (€)</label>
              <Input
                type="number"
                value={payrollForm.allowances}
                onChange={(e) => setPayrollForm({ ...payrollForm, allowances: Number(e.target.value) })}
              />
            </div>
          </div>

          <div className="p-3 bg-muted rounded-lg space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Gross Amount:</span>
              <span className="font-mono font-bold text-foreground">
                €{(payrollForm.baseAmount + payrollForm.allowances - payrollForm.deductions).toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Estimated Tax Withholding:</span>
              <span className="font-mono font-bold text-amber-500">
                -€
                {(
                  ((payrollForm.baseAmount + payrollForm.allowances - payrollForm.deductions) *
                    (selectedDriver?.salaryDetails?.taxRate || 13.5)) /
                  100
                ).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between border-t border-border pt-1 font-bold">
              <span className="text-foreground">Net Payable:</span>
              <span className="font-mono text-emerald-500 text-sm">
                €
                {calculateNetSalaryPreview(
                  payrollForm.baseAmount,
                  payrollForm.allowances,
                  payrollForm.deductions,
                  selectedDriver?.salaryDetails?.taxRate || 13.5
                ).toLocaleString()}
              </span>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <Button type="button" variant="outline" onClick={() => setIsCreatePayrollOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
              {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null} Confirm & Issue Payment
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
