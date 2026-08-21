"use client";

import React, { useState, useEffect, useTransition, useMemo } from "react";
import { Vehicle, User, Trip } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { bookCarAction } from "@/actions/driver-trips";
import { Clock, User as UserIcon, AlertCircle, Check, Truck } from "lucide-react";
import { cn } from "@/utils/cn";
import { useTranslation } from "@/components/layout/language-provider";

// Extend Trip to include relations if present
type TripWithRelations = Trip & {
  driver?: User | null;
  vehicle?: Vehicle | null;
};

interface CarBookingGridProps {
  vehicle: Vehicle;
  bookings: TripWithRelations[];
  drivers: User[];
  currentUserId: string;
  currentUserRole: string;
  currentUserName: string;
  isImmediate?: boolean;
  onClose: () => void;
}

export function CarBookingGrid({
  vehicle,
  bookings,
  drivers,
  currentUserId,
  currentUserRole,
  currentUserName,
  isImmediate = false,
  onClose,
}: CarBookingGridProps) {
  const { t } = useTranslation();
  const [isPending, startTransition] = useTransition();
  const [mounted, setMounted] = useState(false);

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [clickedBookedSlot, setClickedBookedSlot] = useState<any | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<boolean>(false);

  const [bookingForm, setBookingForm] = useState({
    driverId: currentUserRole === "DRIVER" ? currentUserId : (drivers[0]?.id || ""),
    startTime: "",
    endTime: "",
    pickup: "",
    destination: "",
    purpose: "Corporate Duty",
    notes: "",
  });

  // Date strip window dates (7 days starting from today)
  const [windowDates, setWindowDates] = useState<Date[]>([]);
  useEffect(() => {
    setMounted(true);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const list: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      list.push(d);
    }
    setWindowDates(list);
  }, [selectedDate]);

  // Time format helper
  const formatTo12Hour = (dateTimeStr: string) => {
    if (!dateTimeStr) return "HH:MM";
    const parts = dateTimeStr.split("T");
    if (parts.length < 2) return "HH:MM";
    const timePart = parts[1]; // "HH:MM"
    const timeParts = timePart.split(":");
    if (timeParts.length < 2) return "HH:MM";
    const hours = parseInt(timeParts[0], 10);
    const minutes = timeParts[1];
    
    if (isNaN(hours)) return "HH:MM";
    
    const ampm = hours >= 12 ? "PM" : "AM";
    const displayHour = hours % 12 === 0 ? 12 : hours % 12;
    return `${String(displayHour).padStart(2, '0')}:${minutes} ${ampm}`;
  };

  // Generate 48 half-hour slots for the selectedDate
  const slotsList = useMemo(() => {
    const slots = [];
    const nowTime = new Date();
    for (let hour = 0; hour < 24; hour++) {
      for (const minute of [0, 30]) {
        const ampm = hour >= 12 ? "PM" : "AM";
        const displayHour = hour % 12 === 0 ? 12 : hour % 12;
        const displayMinute = minute === 0 ? "00" : "30";

        const pad = (num: number) => String(num).padStart(2, '0');
        const startStr = `${selectedDate.getFullYear()}-${pad(selectedDate.getMonth() + 1)}-${pad(selectedDate.getDate())}T${pad(hour)}:${pad(minute)}`;

        let endHour = hour;
        let endMinute = minute + 30;
        if (endMinute === 60) {
          endHour = (hour + 1) % 24;
          endMinute = 0;
        }
        const endStr = `${selectedDate.getFullYear()}-${pad(selectedDate.getMonth() + 1)}-${pad(selectedDate.getDate())}T${pad(endHour)}:${pad(endMinute)}`;

        const slotStartTime = new Date(startStr);
        const slotEndTime = new Date(endStr);

        // Skip past slots
        if (slotEndTime <= nowTime) continue;

        slots.push({
          label: `${displayHour}:${displayMinute} ${ampm}`,
          startStr,
          endStr,
        });
      }
    }
    return slots;
  }, [selectedDate]);

  const isSlotBooked = (slot: any) => {
    const slotStart = new Date(slot.startStr);
    const slotEnd = new Date(slot.endStr);
    
    return bookings.find((b) => {
      if (b.status === "CANCELLED" || b.status === "COMPLETED") return false;
      const bStart = new Date(b.startTime);
      const bEnd = new Date(b.endTime);
      return (bStart < slotEnd && bEnd > slotStart);
    });
  };

  const handleSlotClick = (slot: any) => {
    setFormError(null);
    setFormSuccess(false);

    if (!bookingForm.startTime || (bookingForm.startTime && bookingForm.endTime)) {
      // First click: Set From, clear To
      setBookingForm({
        ...bookingForm,
        startTime: slot.startStr,
        endTime: "",
      });
    } else {
      // Second click: Set To
      const startVal = new Date(bookingForm.startTime).getTime();
      const clickedVal = new Date(slot.startStr).getTime();

      if (clickedVal <= startVal) {
        setBookingForm({
          ...bookingForm,
          startTime: slot.startStr,
          endTime: "",
        });
      } else {
        // Check for 12-hour limit
        const limit12Hours = 12 * 60 * 60 * 1000;
        if (clickedVal - startVal > limit12Hours) {
          setFormError("Booking duration cannot exceed 12 hours.");
          return;
        }

        // Check for any booked slots in between
        const startValDate = new Date(bookingForm.startTime);
        const endValDate = new Date(slot.startStr);

        const hasConflictInBetween = bookings.some((b) => {
          if (b.status === "CANCELLED" || b.status === "COMPLETED") return false;
          const bStart = new Date(b.startTime);
          const bEnd = new Date(b.endTime);
          return bStart < endValDate && bEnd > startValDate;
        });

        if (hasConflictInBetween) {
          setFormError("The selected range overlaps with an existing booking.");
          return;
        }

        // Check for any driver double-bookings in this range
        const hasDriverConflict = bookings.some((b) => {
          if (b.status === "CANCELLED" || b.status === "COMPLETED") return false;
          if (b.driverId !== bookingForm.driverId) return false;
          const bStart = new Date(b.startTime);
          const bEnd = new Date(b.endTime);
          
          return bStart < endValDate && bEnd > startValDate;
        });

        if (hasDriverConflict) {
          setFormError("The selected driver already has another booking during this time slot.");
          return;
        }

        setBookingForm({
          ...bookingForm,
          endTime: slot.startStr,
        });
      }
    }
    setClickedBookedSlot(null);
  };

  const handleBookingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!bookingForm.driverId) {
      setFormError("Please select a driver for this booking.");
      return;
    }

    if (!bookingForm.startTime || !bookingForm.endTime) {
      setFormError("Start time and end time are required.");
      return;
    }

    const start = new Date(bookingForm.startTime);
    const end = new Date(bookingForm.endTime);

    if (start >= end) {
      setFormError("End time must be after start time.");
      return;
    }

    if (end.getTime() - start.getTime() > 12 * 60 * 60 * 1000) {
      setFormError("Booking duration cannot exceed 12 hours.");
      return;
    }

    // Allow start time to be up to 2 hours in the past
    const graceTime = new Date(Date.now() - 2 * 60 * 60 * 1000);
    if (start < graceTime) {
      setFormError("Booking start time cannot be in the past.");
      return;
    }

    if (!bookingForm.pickup || !bookingForm.destination) {
      setFormError("Please fill out pickup and drop locations.");
      return;
    }

    startTransition(async () => {
      const res = await bookCarAction({
        vehicleId: vehicle.id,
        driverId: bookingForm.driverId,
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        pickup: bookingForm.pickup,
        destination: bookingForm.destination,
        purpose: bookingForm.purpose,
        notes: bookingForm.notes || undefined,
        assignedBy: currentUserRole === "DRIVER" ? "DRIVER" : "ADMIN",
        requestedBy: currentUserRole === "DRIVER" ? currentUserName : `ADMIN (${currentUserName})`,
      });

      if (res.error) {
        setFormError(res.error);
      } else {
        setFormSuccess(true);
        setBookingForm({
          driverId: currentUserRole === "DRIVER" ? currentUserId : (drivers[0]?.id || ""),
          startTime: "",
          endTime: "",
          pickup: "",
          destination: "",
          purpose: "Corporate Duty",
          notes: "",
        });
        setTimeout(() => {
          onClose();
        }, 1500);
      }
    });
  };

  if (!mounted) return null;

  return (
    <div className="space-y-6 text-foreground">
      {/* Vehicle Info Summary Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-muted/30 border border-border/40 rounded-xl">
        <div className="flex items-center gap-3">
          {(vehicle as any).imageUrl ? (
            <img 
              src={(vehicle as any).imageUrl} 
              alt={vehicle.name} 
              className="w-12 h-12 rounded-lg object-cover border border-border shrink-0" 
            />
          ) : (
            <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center border border-border shrink-0">
              <Truck className="h-6 w-6 text-muted-foreground" />
            </div>
          )}
          <div>
            <span className="block text-[10px] uppercase font-bold text-muted-foreground tracking-widest">{t("selected_vehicle")}</span>
            <h4 className="text-lg font-bold text-foreground">{vehicle.name}</h4>
            <span className="font-mono text-xs font-bold text-primary block mt-0.5">{vehicle.vehicleNumber} · {vehicle.carType || "Sedan"}</span>
          </div>
        </div>
        <div className="text-right text-xs">
          <span className="text-muted-foreground">{t("odometer")}: </span>
          <span className="font-bold font-mono">{vehicle.odometer.toLocaleString()} km</span>
          <span className="block mt-1">
            {t("status")}: <Badge variant={vehicle.status === "AVAILABLE" ? "success" : "info"}>
              {vehicle.status === "AVAILABLE" ? t("available") : t("on_trip")}
            </Badge>
          </span>
        </div>
      </div>

      {/* Select Date Strip */}
      <div className="space-y-2">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block">Select Date</span>
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none items-center">
          {windowDates.map((date, idx) => {
            const isSelected = date.toDateString() === selectedDate.toDateString();
            const today = new Date();
            const isToday = date.toDateString() === today.toDateString();
            const isPast = date < today && !isToday;
            const monthStr = date.toLocaleString('default', { month: 'short' });
            const dayNum = date.getDate();
            const dayName = date.toLocaleString('default', { weekday: 'short' }).toUpperCase();

            return (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setSelectedDate(date);
                  setClickedBookedSlot(null);
                }}
                className={cn(
                  "flex flex-col items-center justify-between p-2 min-w-[55px] h-[70px] rounded-xl border transition-all cursor-pointer shrink-0 text-xs",
                  isSelected
                    ? "border-primary bg-primary/10 text-primary font-bold shadow-sm"
                    : isPast
                    ? "border-border/30 bg-muted/5 text-muted-foreground/40 cursor-not-allowed"
                    : "border-border bg-card text-muted-foreground hover:text-foreground hover:border-primary/30"
                )}
              >
                <span className="text-[8px] uppercase font-bold tracking-wider">{monthStr}</span>
                <span className="text-base font-extrabold">{dayNum}</span>
                <span className="text-[8px] font-semibold">{isToday ? "TODAY" : dayName}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* From & To Preview */}
      <div className="grid grid-cols-2 gap-4 border-t border-border/30 pt-4">
        <div className="relative border border-border bg-card rounded-xl p-3 flex flex-col justify-between shadow-sm">
          <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider">From</span>
          <div className="flex items-center gap-1.5 mt-1">
            <Clock className="h-4 w-4 text-muted-foreground/60" />
            <span className="text-sm font-extrabold text-foreground">
              {bookingForm.startTime ? formatTo12Hour(bookingForm.startTime) : "HH:MM"}
            </span>
          </div>
        </div>
        <div className="relative border border-border bg-card rounded-xl p-3 flex flex-col justify-between shadow-sm">
          <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider">To</span>
          <div className="flex items-center gap-1.5 mt-1">
            <Clock className="h-4 w-4 text-muted-foreground/60" />
            <span className="text-sm font-extrabold text-foreground">
              {bookingForm.endTime ? formatTo12Hour(bookingForm.endTime) : "HH:MM"}
            </span>
          </div>
        </div>
      </div>

      {/* Clear time selection */}
      {(bookingForm.startTime || bookingForm.endTime) && (
        <div className="flex justify-end pt-1">
          <Button 
            type="button" 
            variant="outline" 
            size="sm"
            onClick={() => {
              setBookingForm({
                ...bookingForm,
                startTime: "",
                endTime: "",
              });
              setClickedBookedSlot(null);
            }}
            className="text-[9px] h-6 px-2 font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
          >
            Clear Time Selection
          </Button>
        </div>
      )}

      {/* Time Slots Grid */}
      <div className="space-y-2 border-t border-border/30 pt-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Select Time Slot</span>
          <span className="text-[9px] text-muted-foreground italic">
            {slotsList.length} slots available
          </span>
        </div>
        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-1.5 max-h-48 overflow-y-auto pr-1">
          {slotsList.map((slot, index) => {
            const booking = isSlotBooked(slot);
            const isBooked = !!booking;
            const slotStart = new Date(slot.startStr).getTime();
            const isSelected = bookingForm.startTime && bookingForm.endTime
              ? (slotStart >= new Date(bookingForm.startTime).getTime() && slotStart <= new Date(bookingForm.endTime).getTime())
              : (bookingForm.startTime === slot.startStr || bookingForm.endTime === slot.startStr);

            return (
              <button
                key={index}
                type="button"
                title={isBooked ? `Booked by ${booking.driver?.name || booking.requestedBy || 'Driver'}` : undefined}
                onClick={() => {
                  if (isBooked) {
                    setClickedBookedSlot(booking);
                  } else {
                    handleSlotClick(slot);
                  }
                }}
                className={cn(
                  "p-1.5 rounded-lg border flex flex-col items-center justify-center text-center cursor-pointer transition-all h-[45px] text-[10px]",
                  isBooked
                    ? "bg-red-600/80 border-red-700/30 text-white hover:bg-red-600"
                    : isSelected
                      ? "border-primary bg-primary/10 text-primary font-bold shadow-sm"
                      : "border-border bg-muted/10 hover:bg-muted/30 text-foreground"
                )}
              >
                {slot.label}
                {isBooked && <span className="text-[7px] mt-0.5 opacity-80">Booked</span>}
              </button>
            );
          })}
        </div>

        {clickedBookedSlot && (
          <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-lg text-[11px] text-foreground space-y-1 mt-2">
            <h4 className="font-bold text-red-500 flex items-center gap-1">🚨 Slot Reservation Details</h4>
            <div className="grid grid-cols-2 gap-2 pt-0.5">
              <div>
                <span className="text-muted-foreground block text-[9px]">Booked By</span>
                <span className="font-semibold">{clickedBookedSlot.driver?.name || clickedBookedSlot.requestedBy || "N/A"}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[9px]">Schedule</span>
                <span className="font-semibold" suppressHydrationWarning>
                  {new Date(clickedBookedSlot.startTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - {new Date(clickedBookedSlot.endTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Booking Form */}
      <form onSubmit={handleBookingSubmit} className="space-y-4 border-t border-border/30 pt-4 text-xs">
        {formError && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-600 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          {/* Driver selector for Admin */}
          {currentUserRole === "ADMIN" ? (
            <div className="space-y-1.5">
              <label className="font-semibold text-muted-foreground">{t("assign_driver")}</label>
              <select
                className="flex h-10 w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-primary/50"
                value={bookingForm.driverId}
                onChange={(e) => setBookingForm({ ...bookingForm, driverId: e.target.value })}
              >
                <option value="" disabled>{t("select_driver")}</option>
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.employeeId})
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="font-semibold text-muted-foreground">{t("pickup")}</label>
            <Input
              placeholder="e.g. Headquarters / Airport"
              value={bookingForm.pickup}
              onChange={(e) => setBookingForm({ ...bookingForm, pickup: e.target.value })}
              required
            />
          </div>
          <div className="space-y-1.5">
            <label className="font-semibold text-muted-foreground">Drop Location</label>
            <Input
              placeholder="e.g. Client Office / Terminal 3"
              value={bookingForm.destination}
              onChange={(e) => setBookingForm({ ...bookingForm, destination: e.target.value })}
              required
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="font-semibold text-muted-foreground">{t("purpose")}</label>
          <Input
            placeholder="Corporate Duty"
            value={bookingForm.purpose}
            onChange={(e) => setBookingForm({ ...bookingForm, purpose: e.target.value })}
            required
          />
        </div>

        <div className="space-y-1.5">
          <label className="font-semibold text-muted-foreground">Notes (Optional)</label>
          <textarea
            className="flex min-h-[60px] w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-primary/50"
            placeholder="Enter any passenger details, cargo requirements, or instructions..."
            value={bookingForm.notes}
            onChange={(e) => setBookingForm({ ...bookingForm, notes: e.target.value })}
          />
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-border/40">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button type="submit" size="sm" disabled={isPending} className="bg-primary text-white">
            {isPending ? t("booking_loading") : t("confirm_booking")}
          </Button>
        </div>
      </form>

      {formSuccess && (
        <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-xl text-green-600 flex items-center justify-center gap-2 animate-bounce">
          <Check className="h-5 w-5" />
          <span className="font-bold">{t("booking_confirmed_success")}</span>
        </div>
      )}
    </div>
  );
}
