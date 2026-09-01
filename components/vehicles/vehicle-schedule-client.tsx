"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import { User, Vehicle, Trip } from "@prisma/client";
import { Search, Clock, User as UserIcon, MapPin, Calendar, Truck, Info, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/utils/cn";
import { Dialog } from "@/components/ui/dialog";
import { useTranslation } from "@/components/layout/language-provider";

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
  const { t } = useTranslation();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "AVAILABLE" | "BOOKED" | "MAINTENANCE">("ALL");
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  });

  const dateInputRef = useRef<HTMLInputElement>(null);
  
  // Track which booking is clicked for details (keyed by vehicle ID)
  const [selectedBookingDetails, setSelectedBookingDetails] = useState<Record<string, ClampedBooking | null>>({});

  // Vehicle calendar states
  const [calendarVehicle, setCalendarVehicle] = useState<Vehicle | null>(null);
  const [currentMonth, setCurrentMonth] = useState<Date>(() => new Date());

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

  // Format Helper: 12h Time
  const formatTime12h = (date: Date) => {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });
  };

  // Format Helper: Full Date
  const formatFullDate = (date: Date) => {
    return date.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric", year: "numeric" });
  };

  const getDayBookingStats = (vehicleId: string, date: Date) => {
    const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
    const endOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
    const totalDayMs = 24 * 60 * 60 * 1000;

    const dayBookings = bookings.filter((b) => {
      if (b.status === "CANCELLED") return false;
      if (b.vehicleId !== vehicleId) return false;
      const bStart = new Date(b.startTime);
      const bEnd = new Date(b.endTime);
      return bStart < endOfDay && bEnd > startOfDay;
    });

    if (dayBookings.length === 0) {
      return {
        bookedMs: 0,
        bookedHours: 0,
        bookedPercentage: 0,
        availablePercentage: 100,
      };
    }

    // Clamp intervals to the day's bounds [startOfDay, endOfDay]
    const intervals: { start: number; end: number }[] = dayBookings.map((b) => {
      const s = Math.max(new Date(b.startTime).getTime(), startOfDay.getTime());
      const e = Math.min(new Date(b.endTime).getTime(), endOfDay.getTime() + 1);
      return { start: s, end: Math.max(s, e) };
    });

    // Sort by start time
    intervals.sort((a, b) => a.start - b.start);

    // Merge overlapping intervals to avoid double-counting
    const merged: { start: number; end: number }[] = [];
    for (const interval of intervals) {
      if (merged.length === 0) {
        merged.push(interval);
      } else {
        const last = merged[merged.length - 1];
        if (interval.start <= last.end) {
          last.end = Math.max(last.end, interval.end);
        } else {
          merged.push(interval);
        }
      }
    }

    const totalBookedMs = merged.reduce((acc, curr) => acc + (curr.end - curr.start), 0);
    const clampedBookedMs = Math.min(Math.max(totalBookedMs, 0), totalDayMs);

    const bookedPercentage = Math.round((clampedBookedMs / totalDayMs) * 1000) / 10;
    const availablePercentage = Math.max(0, Math.round((100 - bookedPercentage) * 10) / 10);
    const bookedHours = Math.round((clampedBookedMs / (1000 * 60 * 60)) * 10) / 10;

    return {
      bookedMs: clampedBookedMs,
      bookedHours,
      bookedPercentage,
      availablePercentage,
    };
  };

  // Boundaries for selected date (full 24 hours 00:00 - 24:00)
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

  // Full 24-hour timeline scale (00:00–24:00)
  const timelineScale = useMemo(() => {
    return [
      { label: "12 AM", pct: 0 },
      { label: "2 AM", pct: (2 / 24) * 100 },
      { label: "4 AM", pct: (4 / 24) * 100 },
      { label: "6 AM", pct: (6 / 24) * 100 },
      { label: "8 AM", pct: (8 / 24) * 100 },
      { label: "10 AM", pct: (10 / 24) * 100 },
      { label: "12 PM", pct: (12 / 24) * 100 },
      { label: "2 PM", pct: (14 / 24) * 100 },
      { label: "4 PM", pct: (16 / 24) * 100 },
      { label: "6 PM", pct: (18 / 24) * 100 },
      { label: "8 PM", pct: (20 / 24) * 100 },
      { label: "10 PM", pct: (22 / 24) * 100 },
      { label: "12 AM", pct: 100 }
    ];
  }, []);

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

  if (!mounted) return null;

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-foreground">{t("vehicle_schedule")}</h2>
        <p className="text-sm text-muted-foreground">
          {t("vehicle_schedule_desc")}
        </p>
      </div>

      {/* Date Strip Navigation */}
      <div className="border border-border rounded-xl bg-card p-4 space-y-2.5 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">{t("select_schedule_date")}</span>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-semibold text-primary">
              {formatFullDate(selectedDate)}
            </Badge>
            <div className="relative">
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-xs font-semibold cursor-pointer"
                onClick={() => {
                  try {
                    dateInputRef.current?.showPicker();
                  } catch (err) {
                    dateInputRef.current?.click();
                  }
                }}
              >
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                <span>{t("booking_calendar")}</span>
              </Button>
              <input
                ref={dateInputRef}
                type="date"
                className="absolute inset-0 opacity-0 w-full h-full pointer-events-none"
                min={(() => {
                  const today = new Date();
                  const yyyy = today.getFullYear();
                  const mm = String(today.getMonth() + 1).padStart(2, "0");
                  const dd = String(today.getDate()).padStart(2, "0");
                  return `${yyyy}-${mm}-${dd}`;
                })()}
                value={(() => {
                  const yyyy = selectedDate.getFullYear();
                  const mm = String(selectedDate.getMonth() + 1).padStart(2, "0");
                  const dd = String(selectedDate.getDate()).padStart(2, "0");
                  return `${yyyy}-${mm}-${dd}`;
                })()}
                onChange={(e) => {
                  if (e.target.value) {
                    const [year, month, day] = e.target.value.split("-").map(Number);
                    const newDate = new Date(year, month - 1, day, 0, 0, 0, 0);
                    setSelectedDate(newDate);
                  }
                }}
              />
            </div>
          </div>
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
                  {isToday ? t("TODAY") : dayName}
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
            placeholder={t("search_vehicles_placeholder")}
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto shrink-0 scrollbar-none">
          <span className="text-xs font-semibold text-muted-foreground hidden lg:inline">{t("filter_status_now")}</span>
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
                {status === "ALL" && t("all_vehicles")}
                {status === "AVAILABLE" && t("available_now")}
                {status === "BOOKED" && t("booked_now")}
                {status === "MAINTENANCE" && t("maintenance")}
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
                  
                  {/* Plate Number Badge & Calendar Icon Option */}
                  <div className="mt-2.5 flex items-center gap-2">
                    <Badge variant="outline" className="font-mono text-[10px] font-bold bg-muted/30">
                      {vehicle.vehicleNumber}
                    </Badge>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-6 w-6 p-0 rounded-md cursor-pointer hover:border-primary shrink-0"
                      onClick={() => {
                        setCalendarVehicle(vehicle);
                        setCurrentMonth(new Date());
                      }}
                      title="View Vehicle Calendar Schedule"
                    >
                      <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-2 border-t border-border/30 pt-3">
                  {/* Permanent Drivers */}
                  <div className="text-[10px]">
                    <span className="text-muted-foreground block font-bold uppercase tracking-wider">{t("allocated_drivers")}</span>
                    <span className="font-semibold text-foreground">
                      {vehicle.assignedDrivers && vehicle.assignedDrivers.length > 0
                        ? vehicle.assignedDrivers.map((d) => d.name).join(", ")
                        : t("unallocated")}
                    </span>
                  </div>

                  {/* Real-time Status Badge */}
                  <div className="flex flex-wrap items-center gap-2">
                    {currentStatus === "AVAILABLE" && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-green-600 bg-green-500/10 px-2 py-0.5 rounded-full border border-green-500/20 uppercase">
                        <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" /> {t("available_now")}
                      </span>
                    )}
                    {currentStatus === "BOOKED" && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20 uppercase">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" /> {t("booked_now")}
                      </span>
                    )}
                    {currentStatus === "MAINTENANCE" && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-red-600 bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/20 uppercase">
                        <span className="h-1.5 w-1.5 rounded-full bg-red-500" /> {t("maintenance")}
                      </span>
                    )}
                    {isHighUsage ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-green-600 bg-green-500/10 px-2 py-0.5 rounded border border-green-500/25">
                        🟢 {t("high_usage")} ({totalBookingsCount} {t("bookings")})
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-500/10 px-2 py-0.5 rounded border border-red-500/25">
                        🔴 {t("low_usage")} ({totalBookingsCount} {t("bookings")})
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Col 2: Timeline Bar & Details (9 cols) */}
              <div className="md:col-span-9 flex flex-col justify-between space-y-4">
                {/* Timeline Grid Header Scale */}
                <div className="relative h-4 w-full text-[9px] text-muted-foreground font-mono font-bold select-none">
                  {timelineScale.map((item, index) => (
                    <span
                      key={index}
                      className={cn(
                        "absolute whitespace-nowrap",
                        index === 0
                          ? "left-0 translate-x-0"
                          : index === timelineScale.length - 1
                          ? "right-0 -translate-x-0"
                          : "-translate-x-1/2",
                        index % 2 !== 0 ? "hidden sm:inline" : ""
                      )}
                      style={index === timelineScale.length - 1 ? undefined : { left: `${item.pct}%` }}
                    >
                      {item.label}
                    </span>
                  ))}
                </div>

                {/* Timeline Track */}
                <div className="relative w-full h-11 bg-emerald-500/10 dark:bg-emerald-950/20 border border-emerald-500/25 rounded-lg flex overflow-hidden">
                  {vehicle.status === "MAINTENANCE" ? (
                    <div className="absolute inset-0 bg-red-500/10 flex items-center justify-center text-xs font-bold text-red-500/80 uppercase tracking-widest gap-2">
                      <AlertCircle className="h-4.5 w-4.5" /> Out of Service (Maintenance)
                    </div>
                  ) : (
                    <>
                      {/* Grid guideline markers aligned with scale */}
                      {timelineScale.slice(1, -1).map((item, idx) => (
                        <div
                          key={idx}
                          className="absolute h-full w-[1px] bg-border/20"
                          style={{ left: `${item.pct}%` }}
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
                        <Info className="h-3.5 w-3.5" /> {t("booking_confirmed_success")}: {selectedDetails.tripNumber}
                      </h5>
                      <Badge variant="info" className="uppercase text-[9px]">{selectedDetails.status}</Badge>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                      <div>
                        <span className="text-muted-foreground block text-[9px] uppercase font-bold">{t("driver_details")}</span>
                        <span className="font-semibold text-foreground flex items-center gap-1">
                          <UserIcon className="h-3.5 w-3.5 text-muted-foreground" />
                          {selectedDetails.driverName} {selectedDetails.driverPhone ? `(${selectedDetails.driverPhone})` : ""}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[9px] uppercase font-bold">{t("schedule")}</span>
                        <span className="font-semibold text-foreground font-mono">
                          {selectedDetails.startTime.toLocaleString([], { dateStyle: "short", timeStyle: "short" })} - {selectedDetails.endTime.toLocaleTimeString([], { timeStyle: "short" })}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[9px] uppercase font-bold">{t("route")}</span>
                        <span className="font-semibold text-foreground flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                          {selectedDetails.pickup} &rarr; {selectedDetails.destination}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1 border-t border-border/30">
                      <div>
                        <span className="text-muted-foreground block text-[9px] uppercase font-bold">{t("purpose")}</span>
                        <span className="font-semibold text-foreground">{selectedDetails.purpose}</span>
                      </div>
                      {selectedDetails.notes && (
                        <div>
                          <span className="text-muted-foreground block text-[9px] uppercase font-bold">{t("notes")}</span>
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
            {t("no_vehicles_match")}
          </div>
        )}
      {calendarVehicle && (
        <Dialog
          isOpen={!!calendarVehicle}
          onClose={() => setCalendarVehicle(null)}
          title={`${t("booking_calendar")} - ${calendarVehicle.brand} ${calendarVehicle.name}`}
          className="max-w-md"
        >
          <div className="space-y-4">
            {/* Month Navigation */}
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0 cursor-pointer"
                onClick={() => {
                  setCurrentMonth((prev) => {
                    const d = new Date(prev);
                    d.setMonth(prev.getMonth() - 1);
                    return d;
                  });
                }}
              >
                &larr;
              </Button>
              <span className="text-sm font-bold text-foreground">
                {currentMonth.toLocaleString("default", { month: "long", year: "numeric" })}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0 cursor-pointer"
                onClick={() => {
                  setCurrentMonth((prev) => {
                    const d = new Date(prev);
                    d.setMonth(prev.getMonth() + 1);
                    return d;
                  });
                }}
              >
                &rarr;
              </Button>
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-1 text-center">
              {/* Day headers */}
              {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
                <span key={day} className="text-[10px] font-bold text-muted-foreground uppercase py-1">
                  {day}
                </span>
              ))}

              {/* Days */}
              {(() => {
                const year = currentMonth.getFullYear();
                const month = currentMonth.getMonth();
                const firstDayIndex = new Date(year, month, 1).getDay();
                const totalDays = new Date(year, month + 1, 0).getDate();

                const cells = [];
                for (let i = 0; i < firstDayIndex; i++) {
                  cells.push(<div key={`empty-${i}`} className="h-[52px]" />);
                }

                for (let d = 1; d <= totalDays; d++) {
                  const cellDate = new Date(year, month, d);
                  const stats = getDayBookingStats(calendarVehicle.id, cellDate);

                  let bookedPctDisplay = Math.round(stats.bookedPercentage);
                  let availPctDisplay = 100 - bookedPctDisplay;
                  if (stats.bookedPercentage > 0 && bookedPctDisplay === 0) {
                    bookedPctDisplay = 1;
                    availPctDisplay = 99;
                  } else if (stats.bookedPercentage < 100 && bookedPctDisplay === 100) {
                    bookedPctDisplay = 99;
                    availPctDisplay = 1;
                  }

                  cells.push(
                    <div
                      key={`day-${d}`}
                      className="h-[52px] border border-border/30 rounded-lg flex flex-col items-center justify-between p-1 bg-muted/5 hover:bg-muted/15 transition-colors cursor-default"
                      title={`${cellDate.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}: ${bookedPctDisplay}% Booked (${stats.bookedHours}h) • ${availPctDisplay}% Available`}
                    >
                      <span className="text-[10px] font-bold text-foreground leading-none">{d}</span>
                      
                      {/* 24-Hour Percentage Bar */}
                      <div className="w-full h-4 rounded overflow-hidden flex bg-muted/30 border border-black/10 dark:border-white/10 shadow-inner shrink-0">
                        {bookedPctDisplay > 0 && (
                          <div
                            className="h-full bg-red-500 dark:bg-red-600 flex items-center justify-center transition-all shrink-0 overflow-hidden"
                            style={{ width: `${bookedPctDisplay}%` }}
                          >
                            <span className="text-[8px] font-extrabold text-white leading-none px-0.5 truncate drop-shadow-xs">
                              {bookedPctDisplay}%
                            </span>
                          </div>
                        )}
                        {availPctDisplay > 0 && (
                          <div
                            className="h-full bg-emerald-500 dark:bg-emerald-600 flex items-center justify-center transition-all shrink-0 overflow-hidden"
                            style={{ width: `${availPctDisplay}%` }}
                          >
                            <span className="text-[8px] font-extrabold text-white leading-none px-0.5 truncate drop-shadow-xs">
                              {availPctDisplay}%
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }
                return cells;
              })()}
            </div>

            {/* Legend */}
            <div className="flex justify-around pt-3 border-t border-border text-[10px] font-semibold text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-3 rounded bg-emerald-500 flex items-center justify-center text-[7px] font-bold text-white">
                  %
                </div>
                <span>{t("available")} (Free %)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-3 rounded bg-red-500 flex items-center justify-center text-[7px] font-bold text-white">
                  %
                </div>
                <span>{t("fully_booked")} (Booked %)</span>
              </div>
            </div>
          </div>
        </Dialog>
      )}
      </div>
    </div>
  );
}
