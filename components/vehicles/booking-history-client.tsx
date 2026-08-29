"use client";

import React, { useState, useEffect, useTransition } from "react";
import { Trip, User, Vehicle } from "@prisma/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TableContainer, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { deleteBookingAction } from "@/actions/driver-trips";
import { Dialog } from "@/components/ui/dialog";
import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/components/layout/language-provider";

interface BookingHistoryProps {
  bookings: (Trip & { driver?: User | null; vehicle?: Vehicle | null })[];
}

export function BookingHistoryClient({ bookings }: BookingHistoryProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [isPending, startTransition] = useTransition();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // Delete modal flow states
  const [bookingToDelete, setBookingToDelete] = useState<(Trip & { driver?: User | null }) | null>(null);
  const [deleteStep, setDeleteStep] = useState<0 | 1 | 2>(0); // 0 = closed, 1 = warning popup, 2 = fields confirmation input
  const [inputName, setInputName] = useState("");
  const [inputEmail, setInputEmail] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const filteredBookings = bookings.filter((b) => {
    const driverName = b.driver?.name || b.requestedBy || "";
    const vehicleName = b.vehicle?.name || "";
    const tripNumber = b.tripNumber || "";
    const query = searchTerm.toLowerCase();
    return (
      driverName.toLowerCase().includes(query) ||
      vehicleName.toLowerCase().includes(query) ||
      tripNumber.toLowerCase().includes(query)
    );
  });

  const formatDuration = (start: Date, end: Date) => {
    const diffMs = new Date(end).getTime() - new Date(start).getTime();
    const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMins = Math.round((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    if (diffHrs === 0) return `${diffMins} mins`;
    return `${diffHrs}h ${diffMins}m`;
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-foreground">{t("booking_history")}</h2>
        <p className="text-sm text-muted-foreground">
          {t("booking_history_desc")}
        </p>
      </div>

      {/* Search and Filters */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-3 h-4.5 w-4.5 text-muted-foreground" />
        <Input
          placeholder={t("search_bookings_placeholder")}
          className="pl-10 bg-card"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Booking History Table */}
      <Card className="border-border bg-card">
        <CardContent className="p-0">
          <TableContainer>
            <TableHeader>
              <TableRow>
                <TableHead>{t("reference")}</TableHead>
                <TableHead>{t("driver_details")}</TableHead>
                <TableHead>{t("vehicle_details")}</TableHead>
                <TableHead>{t("booking_date")}</TableHead>
                <TableHead>{t("timeslot")}</TableHead>
                <TableHead>{t("duration")}</TableHead>
                <TableHead>{t("assigned_by")}</TableHead>
                <TableHead>{t("status")}</TableHead>
                <TableHead className="text-right">{t("actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredBookings.map((b) => {
                // Time restricted option visibility: only allowed up to 1 hour before scheduled start
                const bookingStartTime = new Date(b.startTime);
                const oneHourBeforeStart = new Date(bookingStartTime.getTime() - 60 * 60 * 1000);
                const now = new Date();
                const showDeleteButton = now < oneHourBeforeStart;

                return (
                  <TableRow key={b.id}>
                    <TableCell className="font-mono text-xs font-bold text-primary">{b.tripNumber}</TableCell>
                    <TableCell className="text-sm">
                      {b.driver ? (
                        <div>
                          <span className="font-semibold block text-foreground">{b.driver.name}</span>
                          <span className="text-[10px] text-muted-foreground block font-mono">{b.driver.employeeId}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground italic">{b.requestedBy || t("unknown")}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {b.vehicle ? (
                        <div>
                          <span className="font-semibold block text-foreground">{b.vehicle.name}</span>
                          <span className="text-[10px] text-muted-foreground block font-mono">{b.vehicle.vehicleNumber}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground italic">{t("no_vehicle")}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs font-medium" suppressHydrationWarning>
                      {mounted ? new Date(b.startTime).toLocaleDateString([], { dateStyle: "medium" }) : ""}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground font-medium" suppressHydrationWarning>
                      {mounted ? (
                        <>
                          {new Date(b.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} -{" "}
                          {new Date(b.endTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </>
                      ) : ""}
                    </TableCell>
                    <TableCell className="text-xs font-semibold">{formatDuration(b.startTime, b.endTime)}</TableCell>
                    <TableCell className="text-xs">
                      <Badge variant="outline" className={b.assignedBy === "ADMIN" ? "bg-amber-500/10 border-amber-500/25 text-amber-500 font-bold" : "bg-blue-500/10 border-blue-500/25 text-blue-500 font-bold"}>
                        {b.assignedBy || "DRIVER"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          b.status === "CANCELLED"
                            ? "danger"
                            : b.status === "COMPLETED"
                            ? "secondary"
                            : "success"
                        }
                        className="uppercase text-[9px]"
                      >
                        {b.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {showDeleteButton ? (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => {
                            setBookingToDelete(b);
                            setDeleteStep(1);
                          }}
                          className="h-8 text-xs font-bold cursor-pointer"
                        >
                          {t("delete_vehicle")}
                        </Button>
                      ) : (
                        <span className="text-muted-foreground text-xs italic">{t("closed")}</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {filteredBookings.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-12 text-xs italic">
                    {t("no_bookings_found")}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Step 1: Warning Danger Confirmation Popup */}
      <Dialog
        isOpen={deleteStep === 1}
        onClose={() => {
          setDeleteStep(0);
          setBookingToDelete(null);
        }}
        title={t("confirm_booking_deletion")}
      >
        <div className="space-y-4">
          <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-4 text-red-600">
            <h4 className="font-bold flex items-center gap-1.5 text-sm">
              ⚠️ {t("danger")}
            </h4>
            <p className="text-xs mt-1.5 font-medium leading-relaxed">
              {t("delete_booking_danger_desc")}
            </p>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setDeleteStep(0);
                setBookingToDelete(null);
              }}
              className="text-xs font-semibold cursor-pointer"
            >
              {t("cancel")}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setDeleteStep(2)}
              className="text-xs font-bold cursor-pointer"
            >
              {t("OK")}
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Step 2: Verification Input Fields Modal */}
      <Dialog
        isOpen={deleteStep === 2}
        onClose={() => {
          setDeleteStep(0);
          setBookingToDelete(null);
          setInputName("");
          setInputEmail("");
          setDeleteError(null);
        }}
        title={t("verify_booking_owner")}
      >
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            {t("verify_booking_owner_desc")}
          </p>

          <div className="bg-muted/40 p-3 rounded-lg border border-border/40 text-xs space-y-1 select-all">
            <div><span className="font-semibold text-muted-foreground">{t("booking_owner_name")}:</span> <span className="font-mono font-bold text-foreground">{bookingToDelete?.driver?.name || bookingToDelete?.requestedBy || ""}</span></div>
            <div><span className="font-semibold text-muted-foreground">{t("booking_owner_email")}:</span> <span className="font-mono font-bold text-foreground">{bookingToDelete?.driver?.email || "—"}</span></div>
          </div>

          {deleteError && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-xs text-red-600 font-semibold animate-pulse">
              {deleteError}
            </div>
          )}

          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground block">
                {t("booking_owner_name")}
              </label>
              <Input
                placeholder="e.g. John Doe"
                value={inputName}
                onChange={(e) => setInputName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground block">
                {t("booking_owner_email")}
              </label>
              <Input
                type="email"
                placeholder="e.g. john@smartforcetaxi.com"
                value={inputEmail}
                onChange={(e) => setInputEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setDeleteStep(0);
                setBookingToDelete(null);
                setInputName("");
                setInputEmail("");
                setDeleteError(null);
              }}
              className="text-xs font-semibold cursor-pointer"
            >
              {t("cancel")}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                setDeleteError(null);
                if (!bookingToDelete) return;

                const expectedName = bookingToDelete.driver?.name || bookingToDelete.requestedBy || "";
                const expectedEmail = bookingToDelete.driver?.email || "";

                if (
                  inputName.trim() !== expectedName.trim() ||
                  inputEmail.trim().toLowerCase() !== expectedEmail.trim().toLowerCase()
                ) {
                  setDeleteError(t("verification_failed_incorrect"));
                  return;
                }

                startTransition(async () => {
                  const res = await deleteBookingAction(bookingToDelete.id, inputName, inputEmail);
                  if (res.error) {
                    setDeleteError(res.error);
                  } else {
                    setDeleteStep(0);
                    setBookingToDelete(null);
                    setInputName("");
                    setInputEmail("");
                    router.refresh();
                  }
                });
              }}
              disabled={isPending}
              className="text-xs font-bold cursor-pointer"
            >
              {isPending ? t("deleting") : t("confirm_delete")}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
