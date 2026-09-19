"use client";

import React, { useState, useTransition, useMemo } from "react";
import { User, DriverEarning } from "@prisma/client";
import {
  DollarSign,
  Calculator,
  Search,
  Plus,
  Pencil,
  Trash2,
  Calendar,
  User as UserIcon,
  TrendingUp,
  Building2,
  Receipt,
  AlertCircle,
  CheckCircle2,
  Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { cn } from "@/utils/cn";
import { useTranslation } from "@/components/layout/language-provider";
import { calculateEarningsBreakdown } from "@/lib/tax-calculator";
import {
  submitDriverEarningsAction,
  updateDriverEarningsAction,
  deleteDriverEarningsAction,
} from "@/actions/driver-earnings";

type DriverEarningWithDriver = DriverEarning & {
  driver: User;
};

interface AdminEarningsClientProps {
  drivers: User[];
  initialEarnings: DriverEarningWithDriver[];
}

export function AdminEarningsClient({ drivers, initialEarnings }: AdminEarningsClientProps) {
  const { t } = useTranslation();
  const [isPending, startTransition] = useTransition();

  const [earningsList, setEarningsList] = useState<DriverEarningWithDriver[]>(initialEarnings);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDriverFilter, setSelectedDriverFilter] = useState<string>("ALL");

  // Dialog States
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<DriverEarningWithDriver | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Form States for Add / Edit
  const [formData, setFormData] = useState({
    driverId: drivers[0]?.id || "",
    totalEarnings: "",
    date: new Date().toISOString().split("T")[0],
    notes: "",
  });

  const [dialogError, setDialogError] = useState<string | null>(null);
  const [dialogSuccess, setDialogSuccess] = useState<string | null>(null);

  // Live breakdown calculation in Add/Edit modal
  const liveBreakdown = useMemo(() => {
    const val = parseFloat(formData.totalEarnings);
    if (isNaN(val) || val <= 0) return null;
    return calculateEarningsBreakdown(val);
  }, [formData.totalEarnings]);

  // Filtered earnings list
  const filteredEarnings = useMemo(() => {
    return earningsList.filter((item) => {
      // Driver filter
      if (selectedDriverFilter !== "ALL" && item.driverId !== selectedDriverFilter) {
        return false;
      }
      // Search filter
      const query = searchTerm.toLowerCase();
      const driverName = item.driver?.name?.toLowerCase() || "";
      const empId = item.driver?.employeeId?.toLowerCase() || "";
      const notes = item.notes?.toLowerCase() || "";
      const dateStr = new Date(item.date).toLocaleDateString().toLowerCase();

      return (
        driverName.includes(query) ||
        empId.includes(query) ||
        notes.includes(query) ||
        dateStr.includes(query)
      );
    });
  }, [earningsList, selectedDriverFilter, searchTerm]);

  // Aggregated summary stats
  const summaryStats = useMemo(() => {
    const gross = filteredEarnings.reduce((acc, c) => acc + c.totalEarnings, 0);
    const tax = filteredEarnings.reduce((acc, c) => acc + c.taxAmount, 0);
    const driverPayouts = filteredEarnings.reduce((acc, c) => acc + c.driverShare, 0);
    const companyRevenue = filteredEarnings.reduce((acc, c) => acc + c.companyShare, 0);

    return {
      gross,
      tax,
      driverPayouts,
      companyRevenue,
      count: filteredEarnings.length,
    };
  }, [filteredEarnings]);

  // Open Add Dialog
  const handleOpenAdd = () => {
    setFormData({
      driverId: drivers[0]?.id || "",
      totalEarnings: "",
      date: new Date().toISOString().split("T")[0],
      notes: "",
    });
    setEditingRecord(null);
    setDialogError(null);
    setDialogSuccess(null);
    setIsAddDialogOpen(true);
  };

  // Open Edit Dialog
  const handleOpenEdit = (record: DriverEarningWithDriver) => {
    setEditingRecord(record);
    setFormData({
      driverId: record.driverId,
      totalEarnings: record.totalEarnings.toString(),
      date: new Date(record.date).toISOString().split("T")[0],
      notes: record.notes || "",
    });
    setDialogError(null);
    setDialogSuccess(null);
    setIsAddDialogOpen(true);
  };

  // Submit Add or Edit Form
  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    setDialogError(null);

    const val = parseFloat(formData.totalEarnings);
    if (isNaN(val) || val <= 0) {
      setDialogError("Please enter a valid total earnings amount greater than 0.");
      return;
    }

    startTransition(async () => {
      if (editingRecord) {
        // ADMIN EDIT ACTION
        const res = await updateDriverEarningsAction({
          id: editingRecord.id,
          totalEarnings: val,
          date: formData.date,
          notes: formData.notes || undefined,
        });

        if (res.error) {
          setDialogError(res.error);
        } else if (res.earning) {
          setEarningsList((prev) =>
            prev.map((item) => (item.id === res.earning.id ? (res.earning as any) : item))
          );
          setDialogSuccess("Record updated successfully!");
          setTimeout(() => {
            setIsAddDialogOpen(false);
          }, 1000);
        }
      } else {
        // ADMIN ADD ACTION
        const res = await submitDriverEarningsAction({
          driverId: formData.driverId,
          totalEarnings: val,
          date: formData.date,
          notes: formData.notes || undefined,
        });

        if (res.error) {
          setDialogError(res.error);
        } else if (res.earning) {
          setEarningsList((prev) => [res.earning as any, ...prev]);
          setDialogSuccess("Record created successfully!");
          setTimeout(() => {
            setIsAddDialogOpen(false);
          }, 1000);
        }
      }
    });
  };

  // Delete Action
  const handleDelete = (id: string) => {
    if (!confirm("Are you sure you want to delete this earnings record? This action cannot be undone.")) {
      return;
    }

    setDeletingId(id);
    startTransition(async () => {
      const res = await deleteDriverEarningsAction(id);
      setDeletingId(null);
      if (res.error) {
        alert(res.error);
      } else {
        setEarningsList((prev) => prev.filter((item) => item.id !== id));
      }
    });
  };

  return (
    <div className="space-y-6 text-foreground pb-12">
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">Driver Earnings Control</h2>
          <p className="text-sm text-muted-foreground">
            Manage driver total earnings submissions, 13.5% tax withholdings, driver shares (45%), and company shares (55%).
          </p>
        </div>

        <Button
          onClick={handleOpenAdd}
          className="bg-primary text-primary-foreground font-bold gap-2 cursor-pointer shadow-sm hover:bg-primary/90 shrink-0"
        >
          <Plus className="h-4 w-4" /> Add Driver Earnings
        </Button>
      </div>

      {/* Overview Stats Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 border border-border bg-card rounded-2xl shadow-xs space-y-1">
          <span className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider block">
            Total Gross Earnings
          </span>
          <span className="text-2xl font-black font-mono text-foreground">
            €{summaryStats.gross.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <span className="text-[10px] text-muted-foreground block">Across {summaryStats.count} entries</span>
        </div>

        <div className="p-4 border border-border bg-card rounded-2xl shadow-xs space-y-1">
          <span className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider block">
            13.5% Tax Withheld
          </span>
          <span className="text-2xl font-black font-mono text-red-500">
            €{summaryStats.tax.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <span className="text-[10px] text-muted-foreground block">Deducted from gross</span>
        </div>

        <div className="p-4 border border-emerald-500/20 bg-emerald-500/5 rounded-2xl shadow-xs space-y-1">
          <span className="text-[10px] font-extrabold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider block">
            Total Driver Shares (45%)
          </span>
          <span className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">
            €{summaryStats.driverPayouts.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <span className="text-[10px] text-muted-foreground block">Your Share after Tax</span>
        </div>

        <div className="p-4 border border-blue-500/20 bg-blue-500/5 rounded-2xl shadow-xs space-y-1">
          <span className="text-[10px] font-extrabold text-blue-700 dark:text-blue-400 uppercase tracking-wider block">
            Company Share (55%)
          </span>
          <span className="text-2xl font-black font-mono text-blue-600 dark:text-blue-400">
            €{summaryStats.companyRevenue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <span className="text-[10px] text-muted-foreground block">Fleet management share</span>
        </div>
      </div>

      {/* Search & Driver Filters Control Bar */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-card border border-border p-4 rounded-xl shadow-xs">
        <div className="relative w-full md:max-w-md">
          <Search className="absolute left-3 top-3 h-4.5 w-4.5 text-muted-foreground" />
          <Input
            placeholder="Search driver name, employee ID, date..."
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto shrink-0">
          <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-xs font-semibold text-muted-foreground shrink-0">Driver:</span>
          <select
            className="flex h-10 w-full md:w-56 rounded-lg border border-border bg-input px-3 py-2 text-xs font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={selectedDriverFilter}
            onChange={(e) => setSelectedDriverFilter(e.target.value)}
          >
            <option value="ALL">All Drivers ({drivers.length})</option>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} ({d.employeeId})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* TABLE / CARDS FOR ADMIN MANAGEMENT */}
      <div className="border border-border bg-card rounded-2xl p-6 space-y-4 shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-border/50">
          <h3 className="text-base font-extrabold text-foreground flex items-center gap-2">
            <Receipt className="h-5 w-5 text-primary" /> Driver Earnings Records
          </h3>
          <Badge variant="outline" className="font-mono text-xs">
            Showing {filteredEarnings.length} of {earningsList.length}
          </Badge>
        </div>

        {filteredEarnings.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground border border-dashed border-border rounded-xl">
            <Calculator className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
            <p className="text-xs font-semibold">No driver earnings records match your search.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Desktop Table View */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="text-[10px] uppercase font-bold text-muted-foreground bg-muted/40 border-b border-border">
                  <tr>
                    <th className="p-3">Date</th>
                    <th className="p-3">Driver</th>
                    <th className="p-3">Total Earnings</th>
                    <th className="p-3">13.5% Tax</th>
                    <th className="p-3">Remaining</th>
                    <th className="p-3">Driver Share (45%)</th>
                    <th className="p-3">Company Share (55%)</th>
                    <th className="p-3 text-right">Admin Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {filteredEarnings.map((item) => (
                    <tr key={item.id} className="hover:bg-muted/10 transition-colors">
                      <td className="p-3 font-semibold text-foreground whitespace-nowrap">
                        {new Date(item.date).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <span className="font-bold text-foreground block">{item.driver?.name}</span>
                        <span className="text-[10px] text-muted-foreground font-mono">{item.driver?.employeeId}</span>
                      </td>
                      <td className="p-3 font-mono font-bold text-foreground whitespace-nowrap">
                        €{item.totalEarnings.toFixed(2)}
                      </td>
                      <td className="p-3 font-mono font-semibold text-red-500 whitespace-nowrap">
                        -€{item.taxAmount.toFixed(2)}
                      </td>
                      <td className="p-3 font-mono font-semibold text-foreground whitespace-nowrap">
                        €{item.remainingAmount.toFixed(2)}
                      </td>
                      <td className="p-3 font-mono font-black text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                        €{item.driverShare.toFixed(2)}
                      </td>
                      <td className="p-3 font-mono font-black text-blue-600 dark:text-blue-400 whitespace-nowrap">
                        €{item.companyShare.toFixed(2)}
                      </td>
                      <td className="p-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenEdit(item)}
                            className="h-8 px-2 text-xs font-semibold cursor-pointer hover:border-primary"
                            title="Edit submitted record"
                          >
                            <Pencil className="h-3.5 w-3.5 mr-1 text-primary" /> Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={deletingId === item.id}
                            onClick={() => handleDelete(item.id)}
                            className="h-8 px-2 text-xs font-semibold cursor-pointer text-red-600 hover:bg-red-500/10 border-red-500/30"
                            title="Delete record"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Tablet & Mobile Cards View */}
            <div className="lg:hidden space-y-3">
              {filteredEarnings.map((item) => (
                <div key={item.id} className="p-4 border border-border rounded-xl bg-card space-y-3 shadow-xs">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-bold text-sm text-foreground">{item.driver?.name}</h4>
                      <span className="text-[10px] text-muted-foreground font-mono block">
                        {item.driver?.employeeId} · {new Date(item.date).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenEdit(item)}
                        className="h-7 px-2 text-[10px] font-bold cursor-pointer"
                      >
                        <Pencil className="h-3 w-3 mr-1 text-primary" /> Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={deletingId === item.id}
                        onClick={() => handleDelete(item.id)}
                        className="h-7 w-7 p-0 cursor-pointer text-red-600 hover:bg-red-500/10 border-red-500/30"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs p-3 bg-muted/20 border border-border/50 rounded-xl">
                    <div>
                      <span className="text-[9px] font-bold text-muted-foreground uppercase block">Total Gross</span>
                      <span className="font-mono font-extrabold text-foreground">€{item.totalEarnings.toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-[9px] font-bold text-muted-foreground uppercase block">13.5% Tax</span>
                      <span className="font-mono font-extrabold text-red-500">-€{item.taxAmount.toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-[9px] font-bold text-emerald-700 dark:text-emerald-400 uppercase block">Driver (45%)</span>
                      <span className="font-mono font-extrabold text-emerald-600 dark:text-emerald-400">€{item.driverShare.toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-[9px] font-bold text-blue-700 dark:text-blue-400 uppercase block">Company (55%)</span>
                      <span className="font-mono font-extrabold text-blue-600 dark:text-blue-400">€{item.companyShare.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ADMIN ADD / EDIT DIALOG */}
      {isAddDialogOpen && (
        <Dialog
          isOpen={isAddDialogOpen}
          onClose={() => setIsAddDialogOpen(false)}
          title={editingRecord ? `Edit Earnings Record (${editingRecord.driver?.name})` : "Add New Driver Earnings Record"}
          className="max-w-lg w-full"
        >
          <form onSubmit={handleSubmitForm} className="space-y-4 text-foreground">
            {dialogError && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-600 font-bold flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{dialogError}</span>
              </div>
            )}

            {dialogSuccess && (
              <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-xl text-xs text-green-600 font-bold flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>{dialogSuccess}</span>
              </div>
            )}

            {/* Driver Select (only for Add) */}
            {!editingRecord && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Select Driver
                </label>
                <select
                  className="flex h-10 w-full rounded-lg border border-border bg-input px-3 py-2 text-xs font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={formData.driverId}
                  onChange={(e) => setFormData({ ...formData, driverId: e.target.value })}
                  required
                >
                  {drivers.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.employeeId})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Total Earnings */}
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-bold text-foreground uppercase tracking-wider">
                  Total Gross Earnings (€)
                </label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="e.g. 1000.00"
                  value={formData.totalEarnings}
                  onChange={(e) => setFormData({ ...formData, totalEarnings: e.target.value })}
                  className="text-base font-bold font-mono h-11"
                  required
                />
              </div>

              {/* Date */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Date
                </label>
                <Input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="h-10 text-xs font-semibold"
                  required
                />
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Notes / Reference
                </label>
                <Input
                  type="text"
                  placeholder="Admin adjustment details"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="h-10 text-xs"
                />
              </div>
            </div>

            {/* Live Calculation Preview */}
            {liveBreakdown && (
              <div className="p-3 bg-muted/30 border border-border/60 rounded-xl space-y-2 text-xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                  Automatic Calculation Preview
                </span>
                <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                  <div>
                    <span className="text-muted-foreground block text-[9px]">13.5% Tax:</span>
                    <span className="font-bold text-red-500">-€{liveBreakdown.taxAmount.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[9px]">Remaining:</span>
                    <span className="font-bold text-foreground">€{liveBreakdown.remainingAmount.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-emerald-700 dark:text-emerald-400 block text-[9px] font-bold">Driver Share (45%):</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">€{liveBreakdown.driverShare.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-blue-700 dark:text-blue-400 block text-[9px] font-bold">Company Share (55%):</span>
                    <span className="font-bold text-blue-600 dark:text-blue-400">€{liveBreakdown.companyShare.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-border/40">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsAddDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isPending}
                className="bg-primary text-primary-foreground font-bold"
              >
                {isPending ? "Saving..." : editingRecord ? "Save Changes" : "Create Record"}
              </Button>
            </div>
          </form>
        </Dialog>
      )}
    </div>
  );
}
