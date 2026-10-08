"use client";

import React, { useState, useEffect } from "react";
import { User, WeeklyLog } from "@prisma/client";
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { TableContainer, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Clock, Eye, Search, ExternalLink, CheckCircle2, AlertCircle, Send, Users, ShieldCheck, ShieldAlert } from "lucide-react";
import { useTranslation } from "@/components/layout/language-provider";
import { getWeeklyLogWindow } from "@/utils/weekly-log-utils";

type WeeklyLogWithDriver = WeeklyLog & {
  driver: User;
};

interface WeeklyLogAdminClientProps {
  drivers?: User[];
  initialLogs: WeeklyLogWithDriver[];
}

export function WeeklyLogAdminClient({ drivers = [], initialLogs }: WeeklyLogAdminClientProps) {
  const { t } = useTranslation();
  const [mounted, setMounted] = useState(false);
  const [logs] = useState<WeeklyLogWithDriver[]>(initialLogs);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "SUBMITTED" | "NOT_SUBMITTED">("ALL");
  const [selectedLog, setSelectedLog] = useState<WeeklyLogWithDriver | null>(null);
  const [sendingReminder, setSendingReminder] = useState(false);
  const [reminderMessage, setReminderMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const { startOfWeek, endOfWeek } = getWeeklyLogWindow(new Date());

  // Format week label e.g., "Oct 5, 2026 - Oct 12, 2026"
  const weekLabel = `${startOfWeek.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${endOfWeek.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;

  // Map drivers to their weekly log submission status for the current Monday-to-Monday week
  const driverStatuses = drivers.map((driver) => {
    const weekLogs = logs.filter((log) => {
      if (log.driverId !== driver.id) return false;
      const uploadDate = new Date(log.uploadedAt);
      return uploadDate >= startOfWeek && uploadDate <= endOfWeek;
    });

    const latestLog = weekLogs.length > 0 ? weekLogs[0] : null;
    const isSubmitted = !!latestLog;

    return {
      driver,
      isSubmitted,
      submittedLog: latestLog,
      totalLogsCount: logs.filter((l) => l.driverId === driver.id).length,
    };
  });

  const totalDriversCount = driverStatuses.length;
  const submittedCount = driverStatuses.filter((d) => d.isSubmitted).length;
  const pendingCount = totalDriversCount - submittedCount;
  const complianceRate = totalDriversCount > 0 ? Math.round((submittedCount / totalDriversCount) * 100) : 0;

  const filteredDriverStatuses = driverStatuses.filter((item) => {
    const name = (item.driver.name || "").toLowerCase();
    const empId = (item.driver.employeeId || "").toLowerCase();
    const query = searchQuery.toLowerCase().trim();
    const matchesQuery = name.includes(query) || empId.includes(query);

    if (!matchesQuery) return false;
    if (statusFilter === "SUBMITTED") return item.isSubmitted;
    if (statusFilter === "NOT_SUBMITTED") return !item.isSubmitted;
    return true;
  });

  const handleSendManualReminders = async () => {
    setSendingReminder(true);
    setReminderMessage(null);
    try {
      const res = await fetch("/api/notifications/weekly-log-reminder?force=true");
      const data = await res.json();
      if (data.success) {
        setReminderMessage({
          type: "success",
          text: `Email reminders sent successfully to ${data.sentCount} pending driver(s)!`,
        });
      } else {
        setReminderMessage({
          type: "error",
          text: data.error || "Failed to send reminders.",
        });
      }
    } catch (err: any) {
      setReminderMessage({
        type: "error",
        text: err.message || "Network error while sending reminders.",
      });
    } finally {
      setSendingReminder(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl w-full space-y-6 text-foreground p-6">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">{t("weekly_log")} Management</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Monitor weekly work screenshot logs for the current week: <strong className="text-foreground">{weekLabel}</strong> (Monday to Monday).
          </p>
        </div>
        <Button
          onClick={handleSendManualReminders}
          disabled={sendingReminder || pendingCount === 0}
          className="bg-amber-500 hover:bg-amber-600 text-zinc-950 font-bold text-xs flex items-center gap-2 shadow-sm self-start md:self-auto"
        >
          <Send className="h-4 w-4" />
          {sendingReminder ? "Sending Reminders..." : `Send Email Reminders (${pendingCount} Pending)`}
        </Button>
      </div>

      {reminderMessage && (
        <div className={`p-4 rounded-xl border flex items-center gap-3 text-xs font-semibold ${
          reminderMessage.type === "success" 
            ? "bg-green-500/10 border-green-500/30 text-green-500" 
            : "bg-red-500/10 border-red-500/30 text-red-500"
        }`}>
          {reminderMessage.type === "success" ? (
            <CheckCircle2 className="h-5 w-5 shrink-0" />
          ) : (
            <AlertCircle className="h-5 w-5 shrink-0" />
          )}
          <p>{reminderMessage.text}</p>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Total Drivers</CardTitle>
            <Users className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black">{totalDriversCount}</div>
            <p className="text-[11px] text-muted-foreground mt-1">Registered drivers in fleet</p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold text-green-500 uppercase tracking-wider">Submitted Logs</CardTitle>
            <ShieldCheck className="h-5 w-5 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-green-500">{submittedCount}</div>
            <p className="text-[11px] text-muted-foreground mt-1">Completed for current week</p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold text-amber-500 uppercase tracking-wider">Pending Submission</CardTitle>
            <ShieldAlert className="h-5 w-5 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-amber-500">{pendingCount}</div>
            <p className="text-[11px] text-muted-foreground mt-1">Not yet uploaded for this week</p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Submission Rate</CardTitle>
            <Clock className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black">{complianceRate}%</div>
            <div className="w-full bg-muted rounded-full h-1.5 mt-2">
              <div className="bg-primary h-1.5 rounded-full transition-all" style={{ width: `${complianceRate}%` }} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Driver Weekly Submission Status Table */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-4">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <CardTitle className="text-lg font-bold">Driver Weekly Log Status</CardTitle>
              <CardDescription className="text-xs">
                Status of all fleet drivers for the active week (<span className="font-semibold text-foreground">{weekLabel}</span>).
              </CardDescription>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              {/* Filter Tabs */}
              <div className="flex items-center bg-muted/20 p-1 rounded-xl border border-border/40 text-xs font-bold shrink-0">
                <button
                  type="button"
                  onClick={() => setStatusFilter("ALL")}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    statusFilter === "ALL" 
                      ? "bg-primary text-white shadow-sm" 
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  All ({totalDriversCount})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter("SUBMITTED")}
                  className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 ${
                    statusFilter === "SUBMITTED" 
                      ? "bg-green-600 text-white shadow-sm" 
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
                  Submitted ({submittedCount})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter("NOT_SUBMITTED")}
                  className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 ${
                    statusFilter === "NOT_SUBMITTED" 
                      ? "bg-amber-600 text-white shadow-sm" 
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                  Pending ({pendingCount})
                </button>
              </div>

              {/* Search Bar */}
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search driver name or ID..."
                  className="pl-9 focus-visible:ring-primary text-xs h-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <TableContainer>
            <TableHeader>
              <TableRow>
                <TableHead>Driver Name</TableHead>
                <TableHead>Employee ID</TableHead>
                <TableHead>Weekly Status (Mon–Mon)</TableHead>
                <TableHead>Submitted Screenshot</TableHead>
                <TableHead>Message</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDriverStatuses.map(({ driver, isSubmitted, submittedLog }) => (
                <TableRow key={driver.id} className="hover:bg-muted/10">
                  <TableCell className="font-semibold text-foreground">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 text-primary font-bold flex items-center justify-center text-xs shrink-0">
                        {driver.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <span className="block font-bold text-sm">{driver.name}</span>
                        <span className="text-[10px] text-muted-foreground block">{driver.email}</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs font-semibold">
                    {driver.employeeId || "—"}
                  </TableCell>
                  <TableCell>
                    {isSubmitted ? (
                      <div className="space-y-1">
                        <Badge variant="outline" className="bg-green-500/10 border-green-500/30 text-green-500 font-bold text-xs flex items-center gap-1.5 w-fit">
                          <CheckCircle2 className="h-3.5 w-3.5" /> SUBMITTED
                        </Badge>
                        <span className="text-[10px] text-muted-foreground block font-mono">
                          {mounted && submittedLog ? new Date(submittedLog.uploadedAt).toLocaleString() : ""}
                        </span>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <Badge variant="outline" className="bg-amber-500/10 border-amber-500/30 text-amber-500 font-bold text-xs flex items-center gap-1.5 w-fit animate-pulse">
                          <AlertCircle className="h-3.5 w-3.5" /> NOT SUBMITTED
                        </Badge>
                        <span className="text-[10px] text-amber-600 dark:text-amber-400 block font-semibold">
                          Pending submission
                        </span>
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-xs">
                    {submittedLog ? (
                      <div className="flex items-center gap-2">
                        <img 
                          src={submittedLog.imageUrl} 
                          alt="Screenshot preview"
                          className="w-10 h-10 object-cover rounded-md border border-border shrink-0 cursor-pointer"
                          onClick={() => setSelectedLog(submittedLog)}
                        />
                        <button
                          type="button"
                          onClick={() => setSelectedLog(submittedLog)}
                          className="text-primary hover:underline font-semibold text-xs flex items-center gap-1"
                        >
                          <Eye className="h-3.5 w-3.5" /> View Log
                        </button>
                      </div>
                    ) : (
                      <span className="text-muted-foreground/60 italic text-[11px]">No submission yet</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs max-w-xs">
                    {submittedLog?.message ? (
                      <span className="italic text-foreground line-clamp-2">"{submittedLog.message}"</span>
                    ) : (
                      <span className="text-muted-foreground/60 italic text-[11px]">None</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground font-mono">
                    {driver.phone || "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    {submittedLog ? (
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setSelectedLog(submittedLog)}
                          className="text-xs font-semibold flex items-center gap-1 hover:text-primary"
                        >
                          <Eye className="h-3.5 w-3.5" /> Preview
                        </Button>
                        <a
                          href={submittedLog.imageUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline self-center px-2"
                        >
                          Open Link <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    ) : (
                      <span className="text-xs text-amber-500 font-semibold italic">Pending Upload</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {filteredDriverStatuses.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10 text-muted-foreground italic text-xs">
                    No drivers match the current filter or search query.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Screenshot Preview Modal Dialog */}
      {selectedLog && (
        <Dialog 
          isOpen={!!selectedLog} 
          onClose={() => setSelectedLog(null)} 
          title={`Weekly Screenshot Review - ${selectedLog.driver?.name || "Driver"}`}
          className="max-w-2xl"
        >
          <div className="space-y-4">
            <div className="bg-muted/10 p-3 rounded-lg border border-border/40 text-xs flex justify-between">
              <div>
                <span className="text-muted-foreground font-semibold">Employee ID: </span>
                <span className="font-semibold">{selectedLog.driver?.employeeId}</span>
              </div>
              <div>
                <span className="text-muted-foreground font-semibold">Uploaded: </span>
                <span className="font-semibold">{mounted ? new Date(selectedLog.uploadedAt).toLocaleString() : "Loading..."}</span>
              </div>
            </div>

            {selectedLog.message && (
              <div className="bg-muted/20 p-3 rounded-lg border border-border/40 text-xs space-y-1">
                <span className="font-semibold text-muted-foreground block text-[11px]">Driver Message:</span>
                <p className="text-foreground italic whitespace-pre-wrap">{selectedLog.message}</p>
              </div>
            )}
            
            <div className="border border-border rounded-lg overflow-hidden bg-black/40 flex items-center justify-center p-2">
              <img 
                src={selectedLog.imageUrl} 
                alt={`Screenshot uploaded by ${selectedLog.driver?.name}`}
                className="max-h-[500px] w-auto object-contain mx-auto rounded shadow-lg"
              />
            </div>

            <div className="flex justify-end pt-2 border-t border-border">
              <Button onClick={() => setSelectedLog(null)}>
                Close Preview
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}
