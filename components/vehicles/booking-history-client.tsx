"use client";

import React, { useState, useTransition } from "react";
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

interface BookingHistoryProps {
  bookings: (Trip & { driver?: User | null; vehicle?: Vehicle | null })[];
}

export function BookingHistoryClient({ bookings }: BookingHistoryProps) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [isPending, startTransition] = useTransition();

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
        <h2 className="text-3xl font-bold tracking-tight text-foreground">Booking History</h2>
        <p className="text-sm text-muted-foreground">
          View all vehicle slot bookings, reservation history, and cancel active schedules.
        </p>
      </div>

      {/* Search and Filters */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-3 h-4.5 w-4.5 text-muted-foreground" />
        <Input
          placeholder="Search bookings by driver name, vehicle, or reference..."
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
                <TableHead>Reference</TableHead>
                <TableHead>Driver Details</TableHead>
                <TableHead>Vehicle Details</TableHead>
                <TableHead>Booking Date</TableHead>
                <TableHead>Timeslot</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Assigned By</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
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
                        <span className="text-muted-foreground italic">{b.requestedBy || "Unknown"}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {b.vehicle ? (
                        <div>
                          <span className="font-semibold block text-foreground">{b.vehicle.name}</span>
                          <span className="text-[10px] text-muted-foreground block font-mono">{b.vehicle.vehicleNumber}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground italic">No Vehicle</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs font-medium">
                      {new Date(b.startTime).toLocaleDateString([], { dateStyle: "medium" })}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground font-medium">
                      {new Date(b.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} -{" "}
                      {new Date(b.endTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
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
                          Delete
                        </Button>
                      ) : (
                        <span className="text-muted-foreground text-xs italic">Closed</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {filteredBookings.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-12 text-xs italic">
                    No bookings found.
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
        title="Confirm Booking Deletion"
      >
        <div className="space-y-4">
          <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-4 text-red-600">
            <h4 className="font-bold flex items-center gap-1.5 text-sm">
              ⚠️ DANGER
            </h4>
            <p className="text-xs mt-1.5 font-medium leading-relaxed">
              Danger: This action will permanently delete this booking. This cannot be undone.
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
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setDeleteStep(2)}
              className="text-xs font-bold cursor-pointer"
            >
              OK
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
        title="Verify Booking Owner Details"
      >
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            To proceed, please enter the booking user's exact name and email address.
          </p>

          <div className="bg-muted/40 p-3 rounded-lg border border-border/40 text-xs space-y-1 select-all">
            <div><span className="font-semibold text-muted-foreground">Booking User Name:</span> <span className="font-mono font-bold text-foreground">{bookingToDelete?.driver?.name || bookingToDelete?.requestedBy || ""}</span></div>
            <div><span className="font-semibold text-muted-foreground">Booking User Email:</span> <span className="font-mono font-bold text-foreground">{bookingToDelete?.driver?.email || "—"}</span></div>
          </div>

          {deleteError && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-xs text-red-600 font-semibold animate-pulse">
              {deleteError}
            </div>
          )}

          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground block">
                Booking Owner Name
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
                Booking Owner Email
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
              Cancel
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
                  setDeleteError("Verification failed: Entered name or email is incorrect.");
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
              Confirm Delete
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
