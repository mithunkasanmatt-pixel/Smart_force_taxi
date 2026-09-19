"use client";

import React, { useState, useMemo, useEffect } from "react";
import { Vehicle, Trip, User } from "@prisma/client";
import {
  Calendar as CalendarIcon,
  Clock,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  User as UserIcon,
  MapPin,
  Info,
  Lock,
  Truck,
  Sparkles,
  CalendarDays,
  CalendarRange,
} from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/utils/cn";
import { useTranslation } from "@/components/layout/language-provider";

type TripWithRelations = Trip & {
  driver?: User | null;
  vehicle?: Vehicle | null;
};

interface BookingCalendarModalProps {
  vehicle: Vehicle & { assignedDrivers?: User[] };
  bookings: TripWithRelations[];
  isOpen: boolean;
  onClose: () => void;
  initialDate?: Date;
}

export function BookingCalendarModal({
  vehicle,
  bookings,
  isOpen,
  onClose,
  initialDate,
}: BookingCalendarModalProps) {
  const { t } = useTranslation();
  const [mounted, setMounted] = useState(false);
  const [viewMode, setViewMode] = useState<"WEEKLY" | "MONTHLY">("WEEKLY");

  // Reference date for calculations
  const [activeDate, setActiveDate] = useState<Date>(() => {
    const d = initialDate ? new Date(initialDate) : new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });

  // Selected date for slot inspection / booking in weekly view
  const [selectedDay, setSelectedDay] = useState<Date>(() => {
    const d = initialDate ? new Date(initialDate) : new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });

  // Hours selection state (for booking preview & 12h max enforcement)
  const [selectionStart, setSelectionStart] = useState<Date | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<Date | null>(null);
  const [selectionError, setSelectionError] = useState<string | null>(null);

  // Inspected booked slot details
  const [inspectedBooking, setInspectedBooking] = useState<TripWithRelations | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Update active date if initialDate changes
  useEffect(() => {
    if (initialDate) {
      const d = new Date(initialDate);
      d.setHours(0, 0, 0, 0);
      setActiveDate(d);
      setSelectedDay(d);
    }
  }, [initialDate]);

  // Format Helper: 12-hour Time (e.g. 09:30 AM)
  const formatTime12h = (date: Date) => {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });
  };

  // Format Helper: Short Date
  const formatDateShort = (date: Date) => {
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  // Format Helper: Full Date
  const formatDateFull = (date: Date) => {
    return date.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric", year: "numeric" });
  };

  // Get active vehicle bookings (filter out cancelled)
  const vehicleBookings = useMemo(() => {
    return bookings.filter(
      (b) => b.vehicleId === vehicle.id && b.status !== "CANCELLED"
    );
  }, [bookings, vehicle.id]);

  // --- WEEKLY VIEW HELPERS ---
  // Generate 7 days for the active week (starting from Monday of current activeDate)
  const weekDays = useMemo(() => {
    const dates: Date[] = [];
    const curr = new Date(activeDate);
    // Find Monday of the current week
    const day = curr.getDay(); // 0 is Sun, 1 is Mon...
    const diff = curr.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
    const monday = new Date(curr.setDate(diff));
    monday.setHours(0, 0, 0, 0);

    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      dates.push(d);
    }
    return dates;
  }, [activeDate]);

  // Get bookings for a specific day
  const getBookingsForDay = (date: Date) => {
    const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
    const dayEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);

    return vehicleBookings.filter((b) => {
      const s = new Date(b.startTime);
      const e = new Date(b.endTime);
      return s < dayEnd && e > dayStart;
    });
  };

  // Get 24 half-hour or hourly slots for selected day (e.g. 06:00 to 22:00 or full 24h)
  const dayHourlySlots = useMemo(() => {
    const slots = [];
    const year = selectedDay.getFullYear();
    const month = selectedDay.getMonth();
    const day = selectedDay.getDate();

    for (let hour = 0; hour < 24; hour++) {
      const start = new Date(year, month, day, hour, 0, 0, 0);
      const end = new Date(year, month, day, hour + 1, 0, 0, 0);

      // Check if slot overlaps with any booking
      const overlappingBooking = vehicleBookings.find((b) => {
        const bStart = new Date(b.startTime);
        const bEnd = new Date(b.endTime);
        return bStart < end && bEnd > start;
      });

      slots.push({
        hour,
        label: start.toLocaleTimeString([], { hour: "numeric", hour12: true }),
        start,
        end,
        isBooked: !!overlappingBooking,
        booking: overlappingBooking || null,
      });
    }
    return slots;
  }, [selectedDay, vehicleBookings]);

  // Handle selecting slot in Weekly View with 12h Limit enforcement
  const handleSlotClick = (slotStart: Date, slotEnd: Date, isBooked: boolean, booking: TripWithRelations | null) => {
    setSelectionError(null);

    if (isBooked && booking) {
      setInspectedBooking(booking);
      return;
    }

    setInspectedBooking(null);

    if (!selectionStart || (selectionStart && selectionEnd)) {
      // First click: set start time
      setSelectionStart(slotStart);
      setSelectionEnd(slotEnd);
    } else {
      // Second click: set end time
      if (slotStart < selectionStart) {
        // Reset start if earlier slot clicked
        setSelectionStart(slotStart);
        setSelectionEnd(slotEnd);
      } else {
        const proposedEnd = slotEnd;
        const diffMs = proposedEnd.getTime() - selectionStart.getTime();

        // 12-Hour Maximum Limit Enforcement
        if (diffMs > 12 * 60 * 60 * 1000) {
          setSelectionError("Maximum booking duration is limited to 12 hours.");
          const maxEnd = new Date(selectionStart.getTime() + 12 * 60 * 60 * 1000);
          setSelectionEnd(maxEnd);
        } else {
          // Check for booked slot overlap in range
          const hasOverlap = vehicleBookings.some((b) => {
            const bStart = new Date(b.startTime);
            const bEnd = new Date(b.endTime);
            return bStart < proposedEnd && bEnd > selectionStart;
          });

          if (hasOverlap) {
            setSelectionError("Selected range overlaps with an existing booking.");
            setSelectionStart(slotStart);
            setSelectionEnd(slotEnd);
          } else {
            setSelectionEnd(proposedEnd);
          }
        }
      }
    }
  };

  // Calculate selection duration in hours
  const selectionDurationHours = useMemo(() => {
    if (!selectionStart || !selectionEnd) return 0;
    const diffMs = selectionEnd.getTime() - selectionStart.getTime();
    return Math.round((diffMs / (1000 * 60 * 60)) * 10) / 10;
  }, [selectionStart, selectionEnd]);

  // Clear current hour selection
  const clearSelection = () => {
    setSelectionStart(null);
    setSelectionEnd(null);
    setSelectionError(null);
    setInspectedBooking(null);
  };

  // --- MONTHLY VIEW HELPERS ---
  const getDayBookingStats = (date: Date) => {
    const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
    const endOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
    const totalDayMs = 24 * 60 * 60 * 1000;

    const dayBookings = vehicleBookings.filter((b) => {
      const bStart = new Date(b.startTime);
      const bEnd = new Date(b.endTime);
      return bStart < endOfDay && bEnd > startOfDay;
    });

    if (dayBookings.length === 0) {
      return {
        count: 0,
        bookedHours: 0,
        bookedPercentage: 0,
        availablePercentage: 100,
      };
    }

    // Calculate total booked ms
    const intervals = dayBookings.map((b) => {
      const s = Math.max(new Date(b.startTime).getTime(), startOfDay.getTime());
      const e = Math.min(new Date(b.endTime).getTime(), endOfDay.getTime() + 1);
      return { start: s, end: Math.max(s, e) };
    });

    intervals.sort((a, b) => a.start - b.start);
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
    const bookedPercentage = Math.round((clampedBookedMs / totalDayMs) * 100);
    const availablePercentage = Math.max(0, 100 - bookedPercentage);
    const bookedHours = Math.round((clampedBookedMs / (1000 * 60 * 60)) * 10) / 10;

    return {
      count: dayBookings.length,
      bookedHours,
      bookedPercentage,
      availablePercentage,
    };
  };

  if (!mounted) return null;

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={`${t("booking_calendar")} - ${vehicle.brand} ${vehicle.name}`}
      className="max-w-5xl md:max-w-6xl w-full"
    >
      <div className="space-y-5 text-foreground">
        {/* Header Bar: Vehicle Info Summary & View Mode Switcher */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-muted/30 border border-border/50 rounded-xl shadow-xs">
          <div className="flex items-center gap-3">
            {vehicle.imageUrl ? (
              <img
                src={vehicle.imageUrl}
                alt={vehicle.name}
                className="w-12 h-12 rounded-lg object-cover border border-border shrink-0"
              />
            ) : (
              <div className="w-12 h-12 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 text-primary">
                <Truck className="h-6 w-6" />
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold tracking-tight text-foreground">
                  {vehicle.brand} {vehicle.name}
                </h3>
                <Badge variant="outline" className="font-mono text-xs font-bold bg-background">
                  {vehicle.vehicleNumber}
                </Badge>
              </div>
              <span className="text-xs text-muted-foreground block mt-0.5">
                {vehicle.model} ({vehicle.year}) · {vehicle.carType || "Sedan"}
              </span>
            </div>
          </div>

          {/* View Switcher: Weekly vs Monthly */}
          <div className="flex items-center gap-1 p-1 bg-muted/60 rounded-xl border border-border/60 shrink-0">
            <button
              type="button"
              onClick={() => setViewMode("WEEKLY")}
              className={cn(
                "flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                viewMode === "WEEKLY"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <CalendarRange className="h-3.5 w-3.5" />
              <span>Weekly View</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("MONTHLY")}
              className={cn(
                "flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                viewMode === "MONTHLY"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <CalendarDays className="h-3.5 w-3.5" />
              <span>Monthly View</span>
            </button>
          </div>
        </div>

        {/* PROMINENT SELECTED BOOKING HOURS HERO BANNER */}
        <div className="relative border-2 border-primary/40 bg-gradient-to-r from-primary/10 via-primary/5 to-background rounded-2xl p-4 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary">
              <Sparkles className="h-4 w-4" />
              <span>Selected Booking Hours</span>
            </div>
            <Badge variant="outline" className="text-[10px] font-bold text-amber-600 bg-amber-500/10 border-amber-500/30">
              ⚡ Max 12 Hours Duration Limit
            </Badge>
          </div>

          {selectionStart && selectionEnd ? (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-primary text-primary-foreground font-black text-xl sm:text-2xl font-mono shadow-xs tracking-tight flex items-center gap-2">
                  <Clock className="h-6 w-6" />
                  <span>{formatTime12h(selectionStart)}</span>
                  <span className="text-primary-foreground/70 font-sans text-sm">&rarr;</span>
                  <span>{formatTime12h(selectionEnd)}</span>
                </div>
                <div>
                  <span className="text-xs font-bold text-foreground block">
                    {formatDateFull(selectionStart)}
                  </span>
                  <span className="text-[11px] font-extrabold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 inline-block mt-0.5">
                    Duration: {selectionDurationHours} Hours {selectionDurationHours >= 12 ? "(Maximum Reached)" : ""}
                  </span>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={clearSelection}
                className="text-xs font-semibold h-8 cursor-pointer shrink-0"
              >
                Clear Selection
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between py-1 text-muted-foreground text-xs font-semibold">
              <span className="flex items-center gap-2 text-foreground/80">
                <Info className="h-4 w-4 text-primary shrink-0" />
                Select start and end time slots below to preview booking hours (Up to 12 hours maximum).
              </span>
              <span className="text-[11px] font-mono text-muted-foreground hidden sm:inline">
                No hours selected
              </span>
            </div>
          )}

          {selectionError && (
            <div className="p-2.5 bg-red-500/10 border border-red-500/25 rounded-lg text-xs text-red-600 font-bold flex items-center gap-2 animate-in fade-in">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{selectionError}</span>
            </div>
          )}
        </div>

        {/* ======================================================== */}
        {/* WEEKLY VIEW                                              */}
        {/* ======================================================== */}
        {viewMode === "WEEKLY" && (
          <div className="space-y-4">
            {/* Week Navigation Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0 cursor-pointer"
                  onClick={() => {
                    const d = new Date(activeDate);
                    d.setDate(d.getDate() - 7);
                    setActiveDate(d);
                    setSelectedDay(d);
                  }}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs font-bold cursor-pointer"
                  onClick={() => {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    setActiveDate(today);
                    setSelectedDay(today);
                  }}
                >
                  Today
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0 cursor-pointer"
                  onClick={() => {
                    const d = new Date(activeDate);
                    d.setDate(d.getDate() + 7);
                    setActiveDate(d);
                    setSelectedDay(d);
                  }}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <span className="text-sm font-extrabold text-foreground ml-2">
                  {formatDateShort(weekDays[0])} – {formatDateShort(weekDays[6])} ({weekDays[0].getFullYear()})
                </span>
              </div>

              {/* Status Legend */}
              <div className="flex items-center gap-4 text-xs font-semibold">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-emerald-500 border border-emerald-600 inline-block" />
                  <span className="text-muted-foreground">Available</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-red-500 border border-red-600 inline-block" />
                  <span className="text-muted-foreground">Booked Slot</span>
                </div>
              </div>
            </div>

            {/* 7-Day Strip selector for Weekly View */}
            <div className="grid grid-cols-7 gap-2">
              {weekDays.map((dayDate, idx) => {
                const isSelected = dayDate.toDateString() === selectedDay.toDateString();
                const isToday = dayDate.toDateString() === new Date().toDateString();
                const dayBookings = getBookingsForDay(dayDate);
                const hasBookings = dayBookings.length > 0;

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setSelectedDay(dayDate);
                      clearSelection();
                    }}
                    className={cn(
                      "flex flex-col items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer text-center",
                      isSelected
                        ? "border-primary bg-primary/10 text-primary font-bold shadow-sm ring-1 ring-primary"
                        : "border-border bg-card text-muted-foreground hover:text-foreground hover:border-primary/40"
                    )}
                  >
                    <span className="text-[10px] font-bold uppercase tracking-wider">
                      {dayDate.toLocaleDateString([], { weekday: "short" })}
                    </span>
                    <span className="text-lg font-black my-0.5">{dayDate.getDate()}</span>
                    <div className="flex items-center gap-1">
                      {isToday && (
                        <span className="text-[8px] font-extrabold uppercase text-primary bg-primary/15 px-1 rounded">
                          Today
                        </span>
                      )}
                      {hasBookings ? (
                        <span className="text-[9px] font-bold text-red-600 bg-red-500/15 px-1.5 py-0.5 rounded-full border border-red-500/20">
                          {dayBookings.length} Booked
                        </span>
                      ) : (
                        <span className="text-[9px] font-bold text-emerald-600 bg-emerald-500/15 px-1.5 py-0.5 rounded-full border border-emerald-500/20">
                          Available
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Hourly Slot Selector for Selected Day */}
            <div className="border border-border rounded-xl bg-card p-4 space-y-3 shadow-xs">
              <div className="flex items-center justify-between pb-2 border-b border-border/40">
                <span className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-primary" />
                  Time Slots for {formatDateFull(selectedDay)}
                </span>
                <span className="text-xs font-semibold text-muted-foreground">
                  Click slot to start range selection (12 Hours Max)
                </span>
              </div>

              {/* 24 Hourly Slots Grid */}
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2 max-h-64 overflow-y-auto pr-1">
                {dayHourlySlots.map((slot, idx) => {
                  const isSlotSelected =
                    selectionStart && selectionEnd
                      ? slot.start >= selectionStart && slot.start < selectionEnd
                      : selectionStart
                      ? slot.start.getTime() === selectionStart.getTime()
                      : false;

                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSlotClick(slot.start, slot.end, slot.isBooked, slot.booking)}
                      className={cn(
                        "p-2 rounded-xl border flex flex-col items-center justify-center text-center cursor-pointer transition-all h-14 text-xs relative overflow-hidden",
                        slot.isBooked
                          ? "bg-red-500/15 border-red-500/30 text-red-700 dark:text-red-400 font-bold hover:bg-red-500/25"
                          : isSlotSelected
                          ? "bg-primary text-primary-foreground font-black border-primary ring-2 ring-primary/50 shadow-sm"
                          : "bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400 font-bold hover:bg-emerald-500/20"
                      )}
                    >
                      <span className="text-[11px] font-extrabold font-mono">{slot.label}</span>
                      {slot.isBooked ? (
                        <span className="text-[9px] uppercase font-bold text-red-600 dark:text-red-400 mt-0.5 flex items-center gap-0.5">
                          <Lock className="h-2.5 w-2.5" /> Booked
                        </span>
                      ) : (
                        <span className="text-[9px] uppercase font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 flex items-center gap-0.5">
                          <CheckCircle2 className="h-2.5 w-2.5" /> Available
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Inspected Booked Details Card */}
              {inspectedBooking && (
                <div className="p-4 border border-red-500/30 bg-red-500/5 rounded-xl space-y-2 animate-in fade-in">
                  <div className="flex items-center justify-between border-b border-red-500/20 pb-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="danger" className="font-mono text-xs">
                        Trip #{inspectedBooking.tripNumber}
                      </Badge>
                      <span className="text-xs font-bold text-foreground">
                        Booked Time Slot Details
                      </span>
                    </div>
                    <Badge variant="outline" className="uppercase text-[9px] font-bold">
                      {inspectedBooking.status}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-1">
                    <div>
                      <span className="text-muted-foreground block text-[9px] uppercase font-bold">
                        Driver
                      </span>
                      <span className="font-semibold text-foreground flex items-center gap-1 mt-0.5">
                        <UserIcon className="h-3.5 w-3.5 text-muted-foreground" />
                        {inspectedBooking.driver?.name || "Assigned Driver"}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[9px] uppercase font-bold">
                        Schedule
                      </span>
                      <span className="font-semibold text-foreground font-mono mt-0.5 block">
                        {new Date(inspectedBooking.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} – {new Date(inspectedBooking.endTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[9px] uppercase font-bold">
                        Route
                      </span>
                      <span className="font-semibold text-foreground flex items-center gap-1 mt-0.5 truncate">
                        <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        {inspectedBooking.pickup} &rarr; {inspectedBooking.destination}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* MONTHLY VIEW                                             */}
        {/* ======================================================== */}
        {viewMode === "MONTHLY" && (
          <div className="space-y-4">
            {/* Month Navigation */}
            <div className="flex items-center justify-between pb-2 border-b border-border/40">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0 cursor-pointer"
                onClick={() => {
                  const d = new Date(activeDate);
                  d.setMonth(d.getMonth() - 1);
                  setActiveDate(d);
                }}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-base font-extrabold text-foreground tracking-tight">
                {activeDate.toLocaleString("default", { month: "long", year: "numeric" })}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0 cursor-pointer"
                onClick={() => {
                  const d = new Date(activeDate);
                  d.setMonth(d.getMonth() + 1);
                  setActiveDate(d);
                }}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {/* Monthly Calendar Grid */}
            <div className="grid grid-cols-7 gap-1.5 text-center">
              {/* Day Headers */}
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                <span
                  key={day}
                  className="text-xs font-bold text-muted-foreground uppercase py-1.5 bg-muted/20 rounded-lg"
                >
                  {day}
                </span>
              ))}

              {/* Day Cells */}
              {(() => {
                const year = activeDate.getFullYear();
                const month = activeDate.getMonth();
                const firstDayIndex = new Date(year, month, 1).getDay();
                const totalDays = new Date(year, month + 1, 0).getDate();

                const cells = [];
                for (let i = 0; i < firstDayIndex; i++) {
                  cells.push(<div key={`empty-${i}`} className="h-20" />);
                }

                for (let d = 1; d <= totalDays; d++) {
                  const cellDate = new Date(year, month, d);
                  const stats = getDayBookingStats(cellDate);
                  const isToday = cellDate.toDateString() === new Date().toDateString();

                  cells.push(
                    <div
                      key={`day-${d}`}
                      onClick={() => {
                        setSelectedDay(cellDate);
                        setActiveDate(cellDate);
                        setViewMode("WEEKLY");
                      }}
                      className={cn(
                        "h-20 border rounded-xl flex flex-col justify-between p-2 text-left cursor-pointer transition-all hover:scale-[1.02] hover:shadow-md",
                        isToday
                          ? "border-primary bg-primary/5 ring-1 ring-primary"
                          : stats.count > 0
                          ? "border-red-500/30 bg-red-500/5 hover:border-red-500"
                          : "border-border/40 bg-card hover:border-primary/40"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={cn(
                            "text-xs font-black h-5 w-5 rounded-full flex items-center justify-center",
                            isToday ? "bg-primary text-primary-foreground" : "text-foreground"
                          )}
                        >
                          {d}
                        </span>
                        {stats.count > 0 && (
                          <Badge variant="danger" className="text-[9px] px-1 py-0 h-4">
                            {stats.count} Booked
                          </Badge>
                        )}
                      </div>

                      {/* Percentage & Available breakdown bar */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[9px] font-bold text-muted-foreground">
                          <span>{stats.availablePercentage}% Avail</span>
                          <span>{stats.bookedHours}h Booked</span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-emerald-500/20 overflow-hidden flex">
                          {stats.bookedPercentage > 0 && (
                            <div
                              className="h-full bg-red-500 transition-all"
                              style={{ width: `${stats.bookedPercentage}%` }}
                            />
                          )}
                          <div
                            className="h-full bg-emerald-500 transition-all"
                            style={{ width: `${stats.availablePercentage}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                }
                return cells;
              })()}
            </div>

            {/* Monthly Legend */}
            <div className="flex items-center justify-around pt-3 border-t border-border/40 text-xs font-semibold text-muted-foreground">
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded-full bg-emerald-500 inline-block" />
                <span>Available Day Slots</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded-full bg-red-500 inline-block" />
                <span>Booked Hours</span>
              </div>
              <span className="text-[11px] text-muted-foreground italic">
                * Click any day in Monthly view to inspect in Weekly View
              </span>
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
}
