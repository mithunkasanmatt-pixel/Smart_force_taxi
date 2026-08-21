"use client";

import React, { useState, useMemo, useEffect } from "react";
import { User, Vehicle, Trip } from "@prisma/client";
import { Search, Clock, User as UserIcon, MapPin, Calendar, Truck, Info, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/utils/cn";

interface VehicleScheduleClientProps {
  vehicles: (Vehicle & { assignedDrivers?: User[] })[];
  bookings: (Trip & { driver?: User | null; vehicle?: Vehicle | null })[];
}

interface ClampedBooking {
  id: string;
  tripNumber: string;
  driverName: string;
  driverPhone: string | null;
  purpose: string;
  pickup: string;
  destination: string;
  status: string;
  notes: string | null;
  startTime: Date;
  endTime: Date;
  clampedStart: Date;
  clampedEnd: Date;
}

interface TimeSlot {
  start: Date;
  end: Date;
}

export function VehicleScheduleClient({ vehicles, bookings }: VehicleScheduleClientProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "AVAILABLE" | "BOOKED" | "MAINTENANCE">("ALL");
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  });
  
  // Track which booking is clicked for details (keyed by vehicle ID)
  const [selectedBookingDetails, setSelectedBookingDetails] = useState<Record<string, ClampedBooking | null>>({});

  // Generate date strip: 14 days starting from today
  const dateStrip = useMemo(() => {
    const dates = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = 0; i < 14; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      dates.push(d);
    }
    return dates;
  }, []);

  // Set default selection when selectedDate changes or vehicle list updates
  useEffect(() => {
    setSelectedBookingDetails({});
  }, [selectedDate]);

  // Boundaries for selected date
  const dayStart = useMemo(() => {
    const d = new Date(selectedDate);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [selectedDate]);

  const dayEnd = useMemo(() => {
    const d = new Date(selectedDate);
    d.setHours(23, 59, 59, 999);
    return d;
  }, [selectedDate]);

  const now = useMemo(() => new Date(), []);

  // Format Helper: 12h Time
  const formatTime12h = (date: Date) => {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });
  };

  // Format Helper: Full Date
  const formatFullDate = (date: Date) => {
    return date.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric", year: "numeric" });
  };

  // Process schedule data for each vehicle on the selected day
  const scheduleData = useMemo(() => {
    return vehicles.map((vehicle) => {
      // Find bookings overlapping with selected date
      const vehicleBookings: ClampedBooking[] = bookings
        .filter((b) => {
          if (b.vehicleId !== vehicle.id) return false;
          const bStart = new Date(b.startTime);
          const bEnd = new Date(b.endTime);
          return bStart < dayEnd && bEnd > dayStart;
        })
        .map((b) => {
          const bStart = new Date(b.startTime);
          const bEnd = new Date(b.endTime);
          return {
            id: b.id,
            tripNumber: b.tripNumber,
            driverName: b.driver?.name || "Unknown Driver",
            driverPhone: b.driver?.phone || null,
            purpose: b.purpose,
            pickup: b.pickup,
            destination: b.destination,
            status: b.status,
            notes: b.notes,
            startTime: bStart,
            endTime: bEnd,
            clampedStart: bStart < dayStart ? dayStart : bStart,
            clampedEnd: bEnd > dayEnd ? dayEnd : bEnd,
          };
        })
        .sort((a, b) => a.clampedStart.getTime() - b.clampedStart.getTime());

      // Calculate Free Slots
      const freeSlots: TimeSlot[] = [];
      let currentMarker = dayStart;

      vehicleBookings.forEach((booking) => {
        if (booking.clampedStart.getTime() > currentMarker.getTime()) {
          freeSlots.push({
            start: new Date(currentMarker),
            end: new Date(booking.clampedStart),
          });
        }
        if (booking.clampedEnd.getTime() > currentMarker.getTime()) {
          currentMarker = booking.clampedEnd;
        }
      });

      if (currentMarker.getTime() < dayEnd.getTime()) {
        freeSlots.push({
          start: new Date(currentMarker),
          end: new Date(dayEnd),
        });
      }

      // Check current availability status (at the current moment "now")
      let currentStatus: "AVAILABLE" | "BOOKED" | "MAINTENANCE" = "AVAILABLE";
      if (vehicle.status === "MAINTENANCE") {
        currentStatus = "MAINTENANCE";
      } else {
        const isCurrentlyBooked = bookings.some((b) => {
          if (b.vehicleId !== vehicle.id) return false;
          const bStart = new Date(b.startTime);
          const bEnd = new Date(b.endTime);
          return bStart <= now && bEnd >= now;
        });
        if (isCurrentlyBooked) {
          currentStatus = "BOOKED";
        }
      }

      const totalBookingsCount = bookings.filter((b) => b.vehicleId === vehicle.id).length;
      const isHighUsage = totalBookingsCount >= 3;

      return {
        vehicle,
        bookings: vehicleBookings,
        freeSlots,
        currentStatus,
        totalBookingsCount,
        isHighUsage,
      };
    });
  }, [vehicles, bookings, dayStart, dayEnd, now]);

  // Filter schedule data
  const filteredSchedule = useMemo(() => {
    return scheduleData.filter((item) => {
      // 1. Search filter (name, brand, model, vehicle number)
      const query = searchTerm.toLowerCase();
      const matchesSearch =
        item.vehicle.name.toLowerCase().includes(query) ||
        item.vehicle.brand.toLowerCase().includes(query) ||
        item.vehicle.model.toLowerCase().includes(query) ||
        item.vehicle.vehicleNumber.toLowerCase().includes(query);

      if (!matchesSearch) return false;

      // 2. Status filter
      if (statusFilter === "ALL") return true;
      return item.currentStatus === statusFilter;
    });
  }, [scheduleData, searchTerm, statusFilter]);

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-foreground">Vehicle Availability & Booking Schedule</h2>
        <p className="text-sm text-muted-foreground">
          Centralized overview of real-time vehicle availability, booked slots, and free periods for the next 2 weeks.
        </p>
      </div>

      {/* Date Strip Navigation */}
      <div className="border border-border rounded-xl bg-card p-4 space-y-2.5 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Select Schedule Date (14-Day View)</span>
          <Badge variant="outline" className="font-semibold text-primary">
            {formatFullDate(selectedDate)}
          </Badge>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none items-center">
          {dateStrip.map((date, idx) => {
            const isSelected = date.toDateString() === selectedDate.toDateString();
            const today = new Date();
            const isToday = date.toDateString() === today.toDateString();
            const monthStr = date.toLocaleString("default", { month: "short" });
            const dayNum = date.getDate();
            const dayName = date.toLocaleString("default", { weekday: "short" }).toUpperCase();

            return (
              <button
                key={idx}
                type="button"
                onClick={() => setSelectedDate(date)}
                className={cn(
                  "flex flex-col items-center justify-between p-2.5 min-w-[70px] h-[82px] rounded-xl border transition-all cursor-pointer shrink-0",
                  isSelected
                    ? "border-primary bg-primary/10 text-primary font-bold shadow-sm"
                    : "border-border bg-muted/10 text-muted-foreground hover:text-foreground hover:border-primary/30"
                )}
              >
                <span className="text-[9px] uppercase font-bold tracking-wider">{monthStr}</span>
                <span className="text-lg font-extrabold">{dayNum}</span>
                <span className={cn("text-[9px] font-semibold", isToday && !isSelected && "text-primary")}>
                  {isToday ? "TODAY" : dayName}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Filters Control Bar */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-card border border-border p-4 rounded-xl shadow-sm">
        <div className="relative w-full md:max-w-md">
          <Search className="absolute left-3 top-3 h-4.5 w-4.5 text-muted-foreground" />
          <Input
            placeholder="Search by vehicle name, brand, plate number..."
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto shrink-0 scrollbar-none">
          <span className="text-xs font-semibold text-muted-foreground hidden lg:inline">Filter Status Now:</span>
          <div className="flex gap-1.5 p-1 bg-muted/40 rounded-lg border border-border/60">
            {(["ALL", "AVAILABLE", "BOOKED", "MAINTENANCE"] as const).map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={cn(
                  "px-3 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer",
                  statusFilter === status
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {status === "ALL" && "All Vehicles"}
                {status === "AVAILABLE" && "Available Now"}
                {status === "BOOKED" && "Booked Now"}
                {status === "MAINTENANCE" && "Maintenance"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Schedule Timeline Grid List */}
      <div className="space-y-4">
        {filteredSchedule.map(({ vehicle, bookings: vehicleBookings, freeSlots, currentStatus, totalBookingsCount, isHighUsage }) => {
          const selectedDetails = selectedBookingDetails[vehicle.id] || null;

          return (
            <div
              key={vehicle.id}
              className="border border-border rounded-xl bg-card p-5 shadow-sm space-y-4 flex flex-col md:grid md:grid-cols-12 md:gap-6 items-stretch"
            >
              {/* Col 1: Vehicle Card (3 cols) */}
              <div className="md:col-span-3 flex flex-col justify-between space-y-3 md:border-r md:border-border/60 md:pr-6">
                <div>
                  <div className="flex items-start gap-2.5">
                    {vehicle.imageUrl ? (
                      <img
                        src={vehicle.imageUrl}
                        alt={vehicle.name}
                        className="w-10 h-10 rounded object-cover border border-border shrink-0"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded bg-muted flex items-center justify-center border border-border shrink-0">
                        <Truck className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                    <div>
                      <h4 className="font-bold text-sm text-foreground">{vehicle.brand} {vehicle.name}</h4>
                      <span className="text-[10px] text-muted-foreground block font-mono">{vehicle.model} ({vehicle.year})</span>
                    </div>
                  </div>
                  
                  {/* Plate Number Badge */}
                  <div className="mt-2.5">
                    <Badge variant="outline" className="font-mono text-[10px] font-bold bg-muted/30">
                      {vehicle.vehicleNumber}
                    </Badge>
                  </div>
                </div>

                <div className="space-y-2 border-t border-border/30 pt-3">
                  {/* Permanent Drivers */}
                  <div className="text-[10px]">
                    <span className="text-muted-foreground block font-bold uppercase tracking-wider">Allocated Drivers:</span>
                    <span className="font-semibold text-foreground">
                      {vehicle.assignedDrivers && vehicle.assignedDrivers.length > 0
                        ? vehicle.assignedDrivers.map((d) => d.name).join(", ")
                        : "Unallocated"}
                    </span>
                  </div>

                  {/* Real-time Status Badge */}
                  <div className="flex flex-wrap items-center gap-2">
                    {currentStatus === "AVAILABLE" && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-green-600 bg-green-500/10 px-2 py-0.5 rounded-full border border-green-500/20 uppercase">
                        <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" /> Available Now
                      </span>
                    )}
                    {currentStatus === "BOOKED" && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20 uppercase">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" /> Booked Now
                      </span>
                    )}
                    {currentStatus === "MAINTENANCE" && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-red-600 bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/20 uppercase">
                        <span className="h-1.5 w-1.5 rounded-full bg-red-500" /> Maintenance
                      </span>
                    )}
                    {isHighUsage ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-green-600 bg-green-500/10 px-2 py-0.5 rounded border border-green-500/25">
                        🟢 High Usage ({totalBookingsCount} bookings)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-500/10 px-2 py-0.5 rounded border border-red-500/25">
                        🔴 Low Usage ({totalBookingsCount} bookings)
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Col 2: Timeline Bar & Details (9 cols) */}
              <div className="md:col-span-9 flex flex-col justify-between space-y-4">
                {/* Timeline Grid Header Scale */}
                <div className="relative h-4 w-full text-[9px] text-muted-foreground font-mono font-bold flex justify-between select-none">
                  <span>12 AM</span>
                  <span className="hidden sm:inline">2 AM</span>
                  <span>4 AM</span>
                  <span className="hidden sm:inline">6 AM</span>
                  <span>8 AM</span>
                  <span className="hidden sm:inline">10 AM</span>
                  <span>12 PM</span>
                  <span className="hidden sm:inline">2 PM</span>
                  <span>4 PM</span>
                  <span className="hidden sm:inline">6 PM</span>
                  <span>8 PM</span>
                  <span className="hidden sm:inline">10 PM</span>
                  <span>12 AM</span>
                </div>

                {/* Timeline Track */}
                <div className="relative w-full h-11 bg-emerald-500/10 dark:bg-emerald-950/20 border border-emerald-500/25 rounded-lg flex overflow-hidden">
                  {vehicle.status === "MAINTENANCE" ? (
                    <div className="absolute inset-0 bg-red-500/10 flex items-center justify-center text-xs font-bold text-red-500/80 uppercase tracking-widest gap-2">
                      <AlertCircle className="h-4.5 w-4.5" /> Out of Service (Maintenance)
                    </div>
                  ) : (
                    <>
                      {/* Grid guideline markers */}
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((idx) => (
                        <div
                          key={idx}
                          className="absolute h-full w-[1px] bg-border/20"
                          style={{ left: `${(idx / 12) * 100}%` }}
                        />
                      ))}

                      {/* Render Booked slots absolute overlays */}
                      {vehicleBookings.map((booking) => {
                        const totalMs = dayEnd.getTime() - dayStart.getTime();
                        const leftPct = ((booking.clampedStart.getTime() - dayStart.getTime()) / totalMs) * 100;
                        const widthPct = ((booking.clampedEnd.getTime() - booking.clampedStart.getTime()) / totalMs) * 100;

                        return (
                          <button
                            key={booking.id}
                            type="button"
                            onClick={() => {
                              setSelectedBookingDetails((prev) => ({
                                ...prev,
                                [vehicle.id]: prev[vehicle.id]?.id === booking.id ? null : booking,
                              }));
                            }}
                            className={cn(
                              "absolute h-full border-l border-r border-orange-700/20 font-mono text-[9px] font-bold text-white px-1.5 flex flex-col justify-center items-center cursor-pointer select-none overflow-hidden hover:opacity-90 active:scale-95 transition-all",
                              booking.status === "ACCEPTED" || booking.status === "IN_PROGRESS"
                                ? "bg-amber-600 hover:bg-amber-700"
                                : booking.status === "ASSIGNED"
                                ? "bg-orange-500 hover:bg-orange-600"
                                : "bg-zinc-600 hover:bg-zinc-700"
                            )}
                            style={{
                              left: `${leftPct}%`,
                              width: `${Math.max(widthPct, 2)}%`, // At least 2% to stay visible
                            }}
                          >
                            <span className="truncate w-full block text-center">
                              {formatTime12h(booking.startTime)}
                            </span>
                            <span className="truncate w-full block text-center opacity-85 text-[7px] hidden sm:inline">
                              {booking.driverName}
                            </span>
                          </button>
                        );
                      })}
                    </>
                  )}
                </div>

                {/* Slots Information Summary */}
                {vehicle.status !== "MAINTENANCE" && (
                  <div className="space-y-2 border-t border-border/30 pt-3">
                    {/* Explicit Free slots badges */}
                    <div className="flex flex-wrap items-center gap-1.5 text-xs">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Free slots:</span>
                      {freeSlots.length === 0 ? (
                        <Badge variant="outline" className="text-[10px] font-bold text-red-500 bg-red-500/5">
                          None Available
                        </Badge>
                      ) : (
                        freeSlots.map((slot, idx) => (
                          <Badge
                            key={idx}
                            variant="secondary"
                            className="text-[10px] font-bold bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                          >
                            <Clock className="h-3 w-3 mr-1 shrink-0" />
                            {formatTime12h(slot.start)} - {formatTime12h(slot.end)}
                          </Badge>
                        ))
                      )}
                    </div>

                    {/* Bookings listing for the day */}
                    {vehicleBookings.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 text-xs">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Booked intervals:</span>
                        {vehicleBookings.map((booking) => (
                          <button
                            key={booking.id}
                            type="button"
                            onClick={() => {
                              setSelectedBookingDetails((prev) => ({
                                ...prev,
                                [vehicle.id]: prev[vehicle.id]?.id === booking.id ? null : booking,
                              }));
                            }}
                            className={cn(
                              "inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border cursor-pointer transition-all",
                              selectedDetails?.id === booking.id
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-orange-500/10 text-orange-600 border-orange-500/20 hover:bg-orange-500/20"
                            )}
                          >
                            <Clock className="h-3 w-3 mr-1" />
                            {formatTime12h(booking.startTime)} - {formatTime12h(booking.endTime)} ({booking.driverName})
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Clicked booking details card */}
                {selectedDetails && (
                  <div className="p-4 border border-primary/20 bg-primary/5 rounded-xl space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="flex justify-between items-start">
                      <h5 className="font-extrabold text-xs text-primary uppercase tracking-wider flex items-center gap-1">
                        <Info className="h-3.5 w-3.5" /> Booking Reference Details: {selectedDetails.tripNumber}
                      </h5>
                      <Badge variant="info" className="uppercase text-[9px]">{selectedDetails.status}</Badge>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                      <div>
                        <span className="text-muted-foreground block text-[9px] uppercase font-bold">Driver Info</span>
                        <span className="font-semibold text-foreground flex items-center gap-1">
                          <UserIcon className="h-3.5 w-3.5 text-muted-foreground" />
                          {selectedDetails.driverName} {selectedDetails.driverPhone ? `(${selectedDetails.driverPhone})` : ""}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[9px] uppercase font-bold">Full Shift Schedule</span>
                        <span className="font-semibold text-foreground font-mono">
                          {selectedDetails.startTime.toLocaleString([], { dateStyle: "short", timeStyle: "short" })} - {selectedDetails.endTime.toLocaleTimeString([], { timeStyle: "short" })}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[9px] uppercase font-bold">Route / Depot</span>
                        <span className="font-semibold text-foreground flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                          {selectedDetails.pickup} &rarr; {selectedDetails.destination}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1 border-t border-border/30">
                      <div>
                        <span className="text-muted-foreground block text-[9px] uppercase font-bold">Purpose</span>
                        <span className="font-semibold text-foreground">{selectedDetails.purpose}</span>
                      </div>
                      {selectedDetails.notes && (
                        <div>
                          <span className="text-muted-foreground block text-[9px] uppercase font-bold">Notes</span>
                          <span className="font-semibold text-foreground italic">{selectedDetails.notes}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {filteredSchedule.length === 0 && (
          <div className="text-center py-16 text-muted-foreground border border-dashed border-border rounded-xl bg-card">
            No vehicles match the selected search or status filter.
          </div>
        )}
      </div>
    </div>
  );
}
