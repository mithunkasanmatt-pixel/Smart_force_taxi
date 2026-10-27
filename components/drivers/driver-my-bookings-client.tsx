"use client";

import React, { useState, useMemo, useEffect, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trip, User, Vehicle } from "@prisma/client";
import { 
  ChevronLeft, 
  ChevronRight, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  MapPin, 
  Truck, 
  CalendarDays, 
  Plus, 
  AlertCircle, 
  Check, 
  Calendar as CalendarIcon, 
  X, 
  Layers, 
  Briefcase,
  ShieldAlert,
  UserCheck,
  Search,
  Headphones
} from "lucide-react";
import { cn } from "@/utils/cn";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { bookCarAction, cancelUserBookingAction } from "@/actions/driver-trips";
import { DEFAULT_BOOKING_LOCATIONS, BookingLocation } from "@/lib/locations";
import { getBookingLocationsAction } from "@/actions/locations";

type TripWithRelations = Trip & {
  driver?: User | null;
  vehicle?: Vehicle | null;
};

interface DriverMyBookingsClientProps {
  driver: User;
  bookings: TripWithRelations[];
  fleetBookings?: TripWithRelations[];
  vehicles?: Vehicle[];
  assignedVehicle?: Vehicle | null;
}

export function DriverMyBookingsClient({ 
  driver, 
  bookings: initialBookings, 
  fleetBookings: initialFleetBookings,
  vehicles = [],
  assignedVehicle: propAssignedVehicle
}: DriverMyBookingsClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [mounted, setMounted] = useState(false);

  // Toggle between Month Calendar view (Mockup 1) and Week Slider view (Mockup 2)
  const [viewMode, setViewMode] = useState<"MONTH" | "WEEK">("MONTH");

  // Toggle visibility of the vehicle slot booking form
  const [showBookingSection, setShowBookingSection] = useState(true);

  // Assigned vehicle resolution
  const resolvedAssignedVehicle = useMemo(() => {
    if (propAssignedVehicle) return propAssignedVehicle;
    if (driver.assignedVehicleId) {
      return vehicles.find((v) => v.id === driver.assignedVehicleId) || null;
    }
    return null;
  }, [propAssignedVehicle, driver.assignedVehicleId, vehicles]);

  // Selected vehicle for booking (defaults to assigned vehicle or first available vehicle)
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(() => {
    if (resolvedAssignedVehicle) return resolvedAssignedVehicle;
    return vehicles[0] || null;
  });

  const [vehicleFilter, setVehicleFilter] = useState<"ALL" | "AVAILABLE" | "ON_TRIP">("ALL");

  // Booking date selection
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const [windowDates, setWindowDates] = useState<Date[]>([]);
  const [showAllDates, setShowAllDates] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(() => new Date());

  // Slot selection states
  const [activeField, setActiveField] = useState<"from" | "to">("from");
  const [clickedBookedSlot, setClickedBookedSlot] = useState<TripWithRelations | null>(null);
  const [activePreviewImage, setActivePreviewImage] = useState<string | null>(null);

  // Form states
  const [locationsList, setLocationsList] = useState<BookingLocation[]>(DEFAULT_BOOKING_LOCATIONS);
  const [isCustomPickup, setIsCustomPickup] = useState(false);
  const [isCustomDrop, setIsCustomDrop] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [bookingSuccess, setBookingSuccess] = useState<string | null>(null);
  const [historyFilter, setHistoryFilter] = useState<"ALL" | "UPCOMING" | "ADMIN" | "DRIVER" | "COMPLETED" | "CANCELLED">("ALL");
  const [historySearch, setHistorySearch] = useState("");

  const [bookingTimes, setBookingTimes] = useState({
    startTime: "",
    endTime: "",
    pickup: DEFAULT_BOOKING_LOCATIONS[0].name,
    destination: DEFAULT_BOOKING_LOCATIONS[0].name,
    purpose: "Corporate Duty",
    notes: "",
  });

  // Live fleet bookings for slot conflict checking
  const [liveBookings, setLiveBookings] = useState<TripWithRelations[]>(
    initialFleetBookings || initialBookings || []
  );

  // All bookings for this driver (for schedule & calendar)
  const [allDriverBookings, setAllDriverBookings] = useState<TripWithRelations[]>(initialBookings);

  useEffect(() => {
    setAllDriverBookings(initialBookings);
  }, [initialBookings]);

  useEffect(() => {
    if (initialFleetBookings && initialFleetBookings.length > 0) {
      setLiveBookings(initialFleetBookings);
    }
  }, [initialFleetBookings]);

  // Calendar states
  const [currentMonth, setCurrentMonth] = useState<Date>(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [inspectedTrip, setInspectedTrip] = useState<TripWithRelations | null>(null);

  // Load locations presets
  useEffect(() => {
    getBookingLocationsAction().then((locs) => {
      if (locs && locs.length > 0) {
        setLocationsList(locs);
        setBookingTimes((prev) => ({
          ...prev,
          pickup: prev.pickup || locs[0].name,
          destination: prev.destination || locs[0].name,
        }));
      }
    });
  }, []);

  // Set mounted and scroll reset
  useEffect(() => {
    setMounted(true);
    const mainEl = document.querySelector("main");
    if (mainEl) {
      mainEl.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    }
  }, []);

  // 7-day window dates: 3 days before and 3 days after selected date
  useEffect(() => {
    const sel = new Date(selectedDate);
    sel.setHours(0, 0, 0, 0);

    const list: Date[] = [];
    for (let i = -3; i <= 3; i++) {
      const d = new Date(sel);
      d.setDate(sel.getDate() + i);
      list.push(d);
    }
    setWindowDates(list);
  }, [selectedDate]);

  // Live booking polling for the active vehicle
  const fetchLiveBookings = useCallback(async (vehicleId: string) => {
    try {
      const res = await fetch(`/api/bookings?vehicleId=${vehicleId}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      if (data.bookings) {
        setLiveBookings((prev) => {
          const others = prev.filter((b) => b.vehicleId !== vehicleId);
          return [...others, ...data.bookings];
        });
        setLastRefreshed(new Date());
      }
    } catch {
      // silently ignore network errors
    }
  }, []);

  useEffect(() => {
    const activeVehicleId = selectedVehicle?.id || resolvedAssignedVehicle?.id || vehicles[0]?.id;
    if (!activeVehicleId) return;
    fetchLiveBookings(activeVehicleId);
    const interval = setInterval(() => fetchLiveBookings(activeVehicleId), 20000);
    return () => clearInterval(interval);
  }, [selectedVehicle, resolvedAssignedVehicle, vehicles, fetchLiveBookings]);

  // Vehicle Counts
  const availableCount = useMemo(() => vehicles.filter((v) => v.status === "AVAILABLE").length, [vehicles]);
  const onTripCount = useMemo(() => vehicles.filter((v) => v.status === "ON_TRIP").length, [vehicles]);

  const filteredVehicles = useMemo(() => {
    return vehicles
      .filter((car) => {
        if (vehicleFilter === "AVAILABLE") return car.status === "AVAILABLE";
        if (vehicleFilter === "ON_TRIP") return car.status === "ON_TRIP";
        return true;
      })
      .sort((a, b) => {
        if (resolvedAssignedVehicle) {
          if (a.id === resolvedAssignedVehicle.id) return -1;
          if (b.id === resolvedAssignedVehicle.id) return 1;
        }
        return 0;
      });
  }, [vehicles, vehicleFilter, resolvedAssignedVehicle]);

  const activeVehicleForDisplay = selectedVehicle;

  // Active Vehicle Bookings for the selected date
  const activeVehicleBookings = useMemo(() => {
    return liveBookings.filter((b) => {
      if (!activeVehicleForDisplay || b.vehicleId !== activeVehicleForDisplay.id || b.status === "CANCELLED" || b.status === "COMPLETED") return false;
      const dayStart = new Date(selectedDate);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(selectedDate);
      dayEnd.setHours(23, 59, 59, 999);
      const bStart = new Date(b.startTime);
      const bEnd = new Date(b.endTime);
      return bStart < dayEnd && bEnd > dayStart;
    });
  }, [liveBookings, activeVehicleForDisplay, selectedDate]);

  const formatTo24Hour = (dateTimeStr: string) => {
    if (!dateTimeStr) return "HH:MM";
    const parts = dateTimeStr.split("T");
    if (parts.length < 2) return "HH:MM";
    const timePart = parts[1];
    const timeParts = timePart.split(":");
    if (timeParts.length < 2) return "HH:MM";
    const hours = parseInt(timeParts[0], 10);
    const minutes = timeParts[1];
    if (isNaN(hours)) return "HH:MM";
    return `${String(hours).padStart(2, '0')}:${minutes}`;
  };

  const MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  const MONTH_SHORT = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
  ];
  const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  // Deterministic 24-hour time and duration (prevents SSR/client hydration locale mismatch)
  const formatTripTimeAndDuration = (startStr: string | Date, endStr: string | Date) => {
    const s = new Date(startStr);
    const e = new Date(endStr);
    const pad = (n: number) => String(n).padStart(2, "0");
    const startFormatted = `${pad(s.getHours())}:${pad(s.getMinutes())}`;
    const endFormatted = `${pad(e.getHours())}:${pad(e.getMinutes())}`;
    const diffHours = (e.getTime() - s.getTime()) / (1000 * 60 * 60);
    const duration = (Math.round(diffHours * 10) / 10).toFixed(2);
    return `${startFormatted} – ${endFormatted} ( ${duration} h )`;
  };

  // Generate 48 30-minute intervals for selected date
  const slotsList = useMemo(() => {
    const now = new Date();
    const isTodayDate = selectedDate.toDateString() === now.toDateString();
    const slots = [];
    for (let hour = 0; hour < 24; hour++) {
      for (const minute of [0, 30]) {
        const pad = (num: number) => String(num).padStart(2, '0');
        const displayHour = pad(hour);
        const displayMinute = minute === 0 ? "00" : "30";
        const timeFormatted = `${displayHour}:${displayMinute}`;

        const slotStartDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), hour, minute, 0, 0);
        const slotEndDate = new Date(slotStartDate.getTime() + 30 * 60 * 1000);

        const startStr = `${slotStartDate.getFullYear()}-${pad(slotStartDate.getMonth() + 1)}-${pad(slotStartDate.getDate())}T${pad(slotStartDate.getHours())}:${pad(slotStartDate.getMinutes())}`;
        const endStr = `${slotEndDate.getFullYear()}-${pad(slotEndDate.getMonth() + 1)}-${pad(slotEndDate.getDate())}T${pad(slotEndDate.getHours())}:${pad(slotEndDate.getMinutes())}`;

        // Skip past slots for today
        if (isTodayDate && slotEndDate <= now) continue;

        slots.push({
          label: timeFormatted,
          labelFormatted: (
            <div className="flex flex-col items-center justify-center">
              <span className="text-xs sm:text-[13px] font-bold leading-tight">{timeFormatted}</span>
            </div>
          ),
          hour,
          minute,
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
    return activeVehicleBookings.find((b) => {
      const bStart = new Date(b.startTime);
      const bEnd = new Date(b.endTime);
      return bStart < slotEnd && bEnd > slotStart;
    });
  };

  const handleSlotClick = (slot: any) => {
    setBookingError(null);
    setBookingSuccess(null);

    const slotStart = slot.startStr;
    const slotEnd = slot.endStr;

    const checkDriverConflict = (startStr: string, endStr: string) => {
      const s = new Date(startStr);
      const e = new Date(endStr);
      return allDriverBookings.some((b) => {
        if (b.status === "CANCELLED" || b.status === "COMPLETED") return false;
        if (b.driverId !== driver.id) return false;
        const bStart = new Date(b.startTime);
        const bEnd = new Date(b.endTime);
        return bStart < e && bEnd > s;
      });
    };

    if (activeField === "from" || !bookingTimes.startTime) {
      const proposedStart = slotStart;
      const proposedEnd = bookingTimes.endTime;

      if (proposedEnd && new Date(proposedEnd) > new Date(proposedStart)) {
        if (new Date(proposedEnd).getTime() - new Date(proposedStart).getTime() > 12 * 60 * 60 * 1000) {
          setBookingTimes({
            ...bookingTimes,
            startTime: proposedStart,
            endTime: "",
          });
          setActiveField("to");
          return;
        }

        const startValDate = new Date(proposedStart);
        const endValDate = new Date(proposedEnd);
        const hasConflictInBetween = liveBookings.some((b) => {
          if (b.status === "CANCELLED" || b.status === "COMPLETED") return false;
          if (b.vehicleId !== activeVehicleForDisplay?.id) return false;
          const bStart = new Date(b.startTime);
          const bEnd = new Date(b.endTime);
          return bStart < endValDate && bEnd > startValDate;
        });

        if (hasConflictInBetween) {
          setBookingError("The selected range overlaps with an existing booking.");
          setBookingTimes({
            ...bookingTimes,
            startTime: proposedStart,
            endTime: "",
          });
          setActiveField("to");
          return;
        }

        if (checkDriverConflict(proposedStart, proposedEnd)) {
          setBookingError("You already have another booking during this time slot.");
          setBookingTimes({
            ...bookingTimes,
            startTime: "",
            endTime: "",
          });
          setActiveField("from");
          return;
        }

        setBookingTimes({
          ...bookingTimes,
          startTime: proposedStart,
        });
        setActiveField("to");
      } else {
        if (checkDriverConflict(proposedStart, slotEnd)) {
          setBookingError("You already have another booking during this time slot.");
          setBookingTimes({
            ...bookingTimes,
            startTime: "",
            endTime: "",
          });
          setActiveField("from");
          return;
        }

        setBookingTimes({
          ...bookingTimes,
          startTime: proposedStart,
          endTime: "",
        });
        setActiveField("to");
      }
    } else {
      const startVal = new Date(bookingTimes.startTime).getTime();
      const clickedVal = new Date(slotStart).getTime();

      if (clickedVal <= startVal) {
        if (checkDriverConflict(slotStart, slotEnd)) {
          setBookingError("You already have another booking during this time slot.");
          setBookingTimes({
            ...bookingTimes,
            startTime: "",
            endTime: "",
          });
          setActiveField("from");
          return;
        }

        setBookingTimes({
          ...bookingTimes,
          startTime: slotStart,
          endTime: "",
        });
        setActiveField("to");
      } else {
        if (clickedVal - startVal > 12 * 60 * 60 * 1000) {
          setBookingError("Booking duration cannot exceed 12 hours.");
          return;
        }

        const startValDate = new Date(bookingTimes.startTime);
        const endValDate = new Date(slotStart);
        const hasConflictInBetween = liveBookings.some((b) => {
          if (b.status === "CANCELLED" || b.status === "COMPLETED") return false;
          if (b.vehicleId !== activeVehicleForDisplay?.id) return false;
          const bStart = new Date(b.startTime);
          const bEnd = new Date(b.endTime);
          return bStart < endValDate && bEnd > startValDate;
        });

        if (hasConflictInBetween) {
          setBookingError("The selected range overlaps with an existing booking.");
          return;
        }

        if (checkDriverConflict(bookingTimes.startTime, slotStart)) {
          setBookingError("You already have another booking during this time slot.");
          setBookingTimes({
            ...bookingTimes,
            startTime: "",
            endTime: "",
          });
          setActiveField("from");
          return;
        }

        setBookingTimes({
          ...bookingTimes,
          endTime: slotStart,
        });
      }
    }
    setClickedBookedSlot(null);
  };

  const handleBookingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setBookingError(null);
    setBookingSuccess(null);

    if (!selectedVehicle) {
      setBookingError("Please select a vehicle first.");
      return;
    }

    if (!bookingTimes.startTime || !bookingTimes.endTime) {
      setBookingError("Please select both FROM and TO time slots.");
      return;
    }

    const start = new Date(bookingTimes.startTime);
    const end = new Date(bookingTimes.endTime);

    if (end <= start) {
      setBookingError("End time must be after start time.");
      return;
    }

    const durationHrs = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    if (durationHrs > 12) {
      setBookingError("Booking duration cannot exceed 12 hours.");
      return;
    }

    startTransition(async () => {
      const res = await bookCarAction({
        vehicleId: selectedVehicle.id,
        driverId: driver.id,
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        pickup: bookingTimes.pickup,
        destination: bookingTimes.destination,
        purpose: bookingTimes.purpose,
        notes: bookingTimes.notes || undefined,
        assignedBy: "DRIVER",
        requestedBy: driver.name,
      });

      if (res.error) {
        setBookingError(res.error);
      } else {
        setBookingSuccess("Booking confirmed successfully!");
        setBookingTimes({
          startTime: "",
          endTime: "",
          pickup: locationsList[0]?.name || DEFAULT_BOOKING_LOCATIONS[0].name,
          destination: locationsList[0]?.name || DEFAULT_BOOKING_LOCATIONS[0].name,
          purpose: "Corporate Duty",
          notes: "",
        });
        setActiveField("from");
        if (selectedVehicle?.id) {
          fetchLiveBookings(selectedVehicle.id);
        }
        router.refresh();
      }
    });
  };

  // Schedule Calendar Computations
  const myBookings = useMemo(() => {
    return allDriverBookings.filter((b) => b.driverId === driver.id);
  }, [allDriverBookings, driver.id]);

  const bookingsByDate = useMemo(() => {
    const map = new Map<string, TripWithRelations[]>();
    for (const b of myBookings) {
      const d = new Date(b.startTime);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const list = map.get(key) || [];
      list.push(b);
      map.set(key, list);
    }
    return map;
  }, [myBookings]);

  const prevMonth = () => {
    setCurrentMonth((prev) => {
      const d = new Date(prev);
      d.setMonth(d.getMonth() - 1);
      return d;
    });
  };

  const nextMonth = () => {
    setCurrentMonth((prev) => {
      const d = new Date(prev);
      d.setMonth(d.getMonth() + 1);
      return d;
    });
  };

  const monthDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDayIndex = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();

    const days: { date: Date; isCurrentMonth: boolean }[] = [];
    const prevMonthTotalDays = new Date(year, month, 0).getDate();
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      days.push({
        date: new Date(year, month - 1, prevMonthTotalDays - i),
        isCurrentMonth: false,
      });
    }

    for (let i = 1; i <= totalDays; i++) {
      days.push({
        date: new Date(year, month, i),
        isCurrentMonth: true,
      });
    }

    const remaining = 7 - (days.length % 7);
    if (remaining < 7) {
      for (let i = 1; i <= remaining; i++) {
        days.push({
          date: new Date(year, month + 1, i),
          isCurrentMonth: false,
        });
      }
    }

    return days;
  }, [currentMonth]);

  const weekDays = useMemo(() => {
    const d = new Date(selectedDate);
    const dayOfWeek = d.getDay();
    const sunday = new Date(d);
    sunday.setDate(d.getDate() - dayOfWeek);
    sunday.setHours(0, 0, 0, 0);

    const list: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(sunday);
      day.setDate(sunday.getDate() + i);
      list.push(day);
    }
    return list;
  }, [selectedDate]);

  const prevWeek = () => {
    setSelectedDate((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() - 7);
      return d;
    });
  };

  const nextWeek = () => {
    setSelectedDate((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + 7);
      return d;
    });
  };

  const isToday = (d: Date) => {
    const today = new Date();
    return d.toDateString() === today.toDateString();
  };

  const isSelected = (d: Date) => {
    return d.toDateString() === selectedDate.toDateString();
  };

  const getDateKey = (d: Date) => {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  const onSelectDateFromCalendar = (d: Date, scrollToBooking = false) => {
    setSelectedDate(d);
    setBookingTimes((prev) => ({
      ...prev,
      startTime: "",
      endTime: "",
    }));
    setActiveField("from");
    setClickedBookedSlot(null);
    setShowBookingSection(true);

    if (scrollToBooking) {
      setTimeout(() => {
        const el = document.getElementById("vehicle-booking-section");
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 100);
    }
  };

  return (
    <div className="mx-auto max-w-5xl w-full max-w-full space-y-4 sm:space-y-6 pb-24 text-foreground overflow-x-hidden">
      
      {/* ========================================================================= */}
      {/* 1. TOP CURVED BANNER CARD (Design Reference: Mockup 1 & 2 Header)         */}
      {/* ========================================================================= */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-primary/20 via-primary/10 to-amber-500/20 border border-primary/30 p-3.5 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="space-y-0.5">
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
              Completed Tasks
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary text-white uppercase tracking-wider shadow-2xs">
                Schedule
              </span>
            </h1>
            <p className="text-xs text-muted-foreground font-medium">
              Month calendar overview & weekly task details
            </p>
          </div>

          {/* View Toggles & Booking Action */}
          <div className="flex flex-wrap items-center gap-2 self-start sm:self-center">
            {/* View Mode Switcher: Month | Week */}
            <div className="inline-flex items-center gap-1 p-1 rounded-full bg-card/90 backdrop-blur-xs border border-border shadow-xs shrink-0">
              <button
                type="button"
                onClick={() => setViewMode("MONTH")}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0",
                  viewMode === "MONTH"
                    ? "bg-primary text-white shadow-xs"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                <CalendarDays className="h-3.5 w-3.5" />
                <span>Month</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("WEEK")}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0",
                  viewMode === "WEEK"
                    ? "bg-primary text-white shadow-xs"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                <CalendarIcon className="h-3.5 w-3.5" />
                <span>Week</span>
              </button>
            </div>

            {/* Action Toggle: Book Vehicle / Hide Slots */}
            <button
              type="button"
              onClick={() => setShowBookingSection(!showBookingSection)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 border shadow-xs",
                showBookingSection
                  ? "bg-primary/15 text-primary border-primary/30 hover:bg-primary/20"
                  : "bg-card/90 text-foreground border-border hover:bg-card hover:border-primary/40"
              )}
            >
              <Truck className="h-3.5 w-3.5" />
              <span>{showBookingSection ? "Hide Slots" : "Book Vehicle"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. CALENDAR CARD (Mockup 1: Month Calendar OR Mockup 2: Week Slider)     */}
      {/* ========================================================================= */}
      <div className="rounded-3xl border border-border/80 bg-card p-4 sm:p-5 shadow-xs space-y-3">
        {viewMode === "MONTH" ? (
          /* MOCKUP 1: MONTH CALENDAR */
          <>
            {/* Header: 📅 2026 on left, < October > on right */}
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-primary" />
                <span className="font-extrabold text-sm sm:text-base text-foreground">
                  {currentMonth.getFullYear()}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const today = new Date();
                    setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1));
                    onSelectDateFromCalendar(today);
                  }}
                  className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 transition-colors cursor-pointer ml-1"
                >
                  Today
                </button>
              </div>

              <div className="flex items-center gap-1 sm:gap-2">
                <button
                  type="button"
                  onClick={prevMonth}
                  aria-label="Previous month"
                  className="h-7 w-7 rounded-full border border-border/80 hover:bg-muted/40 flex items-center justify-center transition-colors cursor-pointer text-muted-foreground hover:text-foreground"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span suppressHydrationWarning className="font-black text-xs sm:text-sm text-foreground min-w-[75px] sm:min-w-[85px] text-center">
                  {MONTH_NAMES[currentMonth.getMonth()]}
                </span>
                <button
                  type="button"
                  onClick={nextMonth}
                  aria-label="Next month"
                  className="h-7 w-7 rounded-full border border-border/80 hover:bg-muted/40 flex items-center justify-center transition-colors cursor-pointer text-muted-foreground hover:text-foreground"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Days of Week Header matching Reference: SUN  MON  TUE  WED  THU  FRI  SAT */}
            <div className="grid grid-cols-7 text-center font-bold text-[10px] sm:text-[11px] text-muted-foreground/70 uppercase tracking-wider py-1">
              <span>SUN</span>
              <span>MON</span>
              <span>TUE</span>
              <span>WED</span>
              <span>THU</span>
              <span>FRI</span>
              <span>SAT</span>
            </div>

            {/* Days Grid matching Reference */}
            <div className="grid grid-cols-7 gap-1 sm:gap-1.5 pt-1">
              {monthDays.map((item, idx) => {
                const dayDate = item.date;
                const dateKey = getDateKey(dayDate);
                const dayBookings = bookingsByDate.get(dateKey) || [];
                const hasBookings = dayBookings.length > 0;
                const isSelectedDate = isSelected(dayDate);
                const isTodayDate = isToday(dayDate);

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      onSelectDateFromCalendar(dayDate);
                      if (!item.isCurrentMonth) {
                        setCurrentMonth(new Date(dayDate.getFullYear(), dayDate.getMonth(), 1));
                      }
                    }}
                    className={cn(
                      "flex flex-col items-center justify-center h-9 sm:h-11 rounded-xl p-0.5 transition-all relative cursor-pointer",
                      !item.isCurrentMonth && "opacity-25",
                      isSelectedDate
                        ? "bg-primary text-white font-extrabold shadow-sm scale-105 z-10"
                        : isTodayDate
                          ? "border border-primary/50 bg-primary/10 text-primary font-bold"
                          : "hover:bg-muted/40 text-foreground font-semibold"
                    )}
                  >
                    <span className="text-xs sm:text-sm leading-none">{dayDate.getDate()}</span>
                    {hasBookings && (
                      <span
                        className={cn(
                          "h-1 w-1 sm:h-1.5 sm:w-1.5 rounded-full mt-1",
                          isSelectedDate ? "bg-white" : "bg-primary"
                        )}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          /* MOCKUP 2: WEEK SLIDER VIEW */
          <>
            <div className="flex items-center justify-between border-b border-border/40 pb-2.5">
              <span suppressHydrationWarning className="font-extrabold text-xs sm:text-sm text-foreground">
                {MONTH_SHORT[weekDays[0].getMonth()]} {weekDays[0].getDate()} – {MONTH_SHORT[weekDays[6].getMonth()]} {weekDays[6].getDate()}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={prevWeek}
                  className="h-7 w-7 rounded-full border border-border/70 hover:bg-muted/40 flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onSelectDateFromCalendar(new Date())}
                  className="text-[10px] font-bold px-2 py-0.5 rounded-md border border-border/70 hover:bg-muted/40 text-foreground cursor-pointer"
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={nextWeek}
                  className="h-7 w-7 rounded-full border border-border/70 hover:bg-muted/40 flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Days columns with circle badge on selected day */}
            <div className="grid grid-cols-7 gap-1 py-1">
              {weekDays.map((date, idx) => {
                const isSelectedDate = isSelected(date);
                const isTodayDate = isToday(date);
                const dateKey = getDateKey(date);
                const dayBookings = bookingsByDate.get(dateKey) || [];
                const hasBookings = dayBookings.length > 0;

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => onSelectDateFromCalendar(date)}
                    className={cn(
                      "flex flex-col items-center justify-center py-2 rounded-xl transition-all cursor-pointer relative",
                      isSelectedDate
                        ? "bg-primary text-white font-extrabold shadow-sm scale-105"
                        : isTodayDate
                          ? "border border-primary/50 bg-primary/10 text-primary font-bold"
                          : "hover:bg-muted/40 text-foreground font-semibold"
                    )}
                  >
                    <span suppressHydrationWarning className="text-[9px] uppercase font-bold tracking-wider opacity-80">
                      {DAY_SHORT[date.getDay()]}
                    </span>
                    <span className="text-sm sm:text-base font-black mt-0.5">
                      {date.getDate()}
                    </span>
                    {hasBookings && (
                      <span
                        className={cn(
                          "h-1.5 w-1.5 rounded-full mt-0.5",
                          isSelectedDate ? "bg-white" : "bg-primary"
                        )}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 3. OPTIONAL VEHICLE BOOKING ENGINE ACCORDION / DRAWER                     */}
      {/* ========================================================================= */}
      {showBookingSection && !selectedVehicle && (
        <Card id="vehicle-booking-section" className="border-border bg-card text-foreground shadow-sm rounded-3xl overflow-hidden animate-fade-in scroll-mt-6 p-4 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-border/30 pb-3 gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <Truck className="h-4 w-4 sm:h-5 sm:w-5 text-primary shrink-0" />
                <span>Select Vehicle to Book</span>
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Choose a vehicle to view its schedule and book available time slots
              </p>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
              {/* Responsive Vehicle Filter Bar */}
              <div className="overflow-x-auto no-scrollbar scrollbar-none pb-0.5 flex-1 sm:flex-initial">
                <div className="flex items-center gap-1.5 sm:gap-2 bg-muted/20 p-1 sm:p-1.5 rounded-xl border border-border/40 text-xs font-bold min-w-max">
                  <button 
                    type="button"
                    onClick={() => setVehicleFilter("ALL")}
                    className={cn(
                      "px-2.5 sm:px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap text-center text-xs shrink-0 select-none",
                      vehicleFilter === "ALL" 
                        ? "bg-primary text-white shadow-sm font-bold" 
                        : "text-muted-foreground hover:text-foreground font-medium"
                    )}
                  >
                    All ({vehicles.length})
                  </button>
                  <button 
                    type="button"
                    onClick={() => setVehicleFilter("AVAILABLE")}
                    className={cn(
                      "px-2.5 sm:px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap text-center text-xs shrink-0 select-none",
                      vehicleFilter === "AVAILABLE" 
                        ? "bg-green-600 text-white shadow-sm font-bold" 
                        : "text-muted-foreground hover:text-foreground font-medium"
                    )}
                  >
                    <span className="h-2 w-2 rounded-full bg-green-400 shrink-0" />
                    <span>Available ({availableCount})</span>
                  </button>
                  <button 
                    type="button"
                    onClick={() => setVehicleFilter("ON_TRIP")}
                    className={cn(
                      "px-2.5 sm:px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap text-center text-xs shrink-0 select-none",
                      vehicleFilter === "ON_TRIP" 
                        ? "bg-blue-600 text-white shadow-sm font-bold" 
                        : "text-muted-foreground hover:text-foreground font-medium"
                    )}
                  >
                    <span className="h-2 w-2 rounded-full bg-blue-400 shrink-0" />
                    <span>On-Trip ({onTripCount})</span>
                  </button>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowBookingSection(false)}
                className="h-8 w-8 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer shrink-0"
                title="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4 pt-1">
            {filteredVehicles.map((car) => {
              const isAssigned = propAssignedVehicle?.id === car.id;
              const carImg = (car as any).imageUrl;

              return (
                <button
                  key={car.id}
                  type="button"
                  onClick={() => {
                    setSelectedVehicle(car);
                    setClickedBookedSlot(null);
                  }}
                  className={cn(
                    "group rounded-2xl border transition-all duration-200 cursor-pointer overflow-hidden flex flex-col text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary w-full",
                    isAssigned
                      ? "border-amber-500/60 bg-amber-500/5 hover:border-amber-500 hover:shadow-xs"
                      : "border-border bg-card hover:border-primary/40 hover:bg-muted/10 hover:shadow-xs"
                  )}
                >
                  <div className="relative w-full h-28 sm:h-32 bg-muted/15 overflow-hidden border-b border-border/40 flex items-center justify-center p-1.5">
                    {carImg ? (
                      <img 
                        src={carImg} 
                        alt={car.name} 
                        className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-105" 
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground/40 gap-1 bg-muted/10">
                        <Truck className="h-8 w-8" />
                        <span className="text-[10px] font-medium">No photo</span>
                      </div>
                    )}
                    {isAssigned && (
                      <div className="absolute top-2 left-2 pointer-events-none">
                        <span className="text-[9px] bg-amber-500 text-zinc-950 font-black px-1.5 py-0.5 rounded shadow-xs uppercase tracking-wider">
                          Assigned
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="p-3 flex flex-col justify-between flex-1 w-full space-y-1">
                    <div>
                      <h4 className="font-bold text-xs sm:text-sm text-foreground leading-snug line-clamp-1 group-hover:text-primary transition-colors">
                        {car.name}
                      </h4>
                      <p className="text-[11px] font-mono font-semibold text-muted-foreground mt-0.5 truncate">
                        {car.vehicleNumber}
                      </p>
                    </div>
                    <div className="flex items-center justify-between pt-1.5 border-t border-border/30 text-[10px] text-muted-foreground">
                      <span>{car.seatingCapacity ? `${car.seatingCapacity} seats` : "Standard"}</span>
                      <span className={cn(
                        "font-bold uppercase tracking-wider text-[9px]",
                        car.status === "AVAILABLE" ? "text-emerald-500" : car.status === "ON_TRIP" ? "text-blue-500" : "text-amber-500"
                      )}>
                        {car.status}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
            {vehicles.length === 0 && (
              <div className="col-span-full py-8 text-center text-xs text-muted-foreground italic">
                No vehicles available.
              </div>
            )}
          </div>
        </Card>
      )}

      {showBookingSection && selectedVehicle && (
        <Card id="vehicle-booking-section" className="border-border bg-card text-foreground shadow-sm rounded-3xl overflow-hidden animate-fade-in scroll-mt-6">
          <CardHeader className="p-4 sm:p-5 border-b border-border/30 pb-3 sm:pb-4 bg-muted/10">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <Truck className="h-4 w-4 sm:h-5 sm:w-5 text-primary shrink-0" />
                  <span>Book Vehicle Slot</span>
                </CardTitle>
                <div className="text-xs text-muted-foreground mt-0.5 font-medium">
                  Active: <span className="font-bold text-primary font-mono">{selectedVehicle.name} ({selectedVehicle.vehicleNumber})</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedVehicle(null)}
                  className="h-7 px-2.5 text-[11px] font-semibold rounded-lg"
                >
                  Change Vehicle
                </Button>
                <button
                  type="button"
                  onClick={() => setShowBookingSection(false)}
                  className="h-7 w-7 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer"
                  title="Collapse Booking Slots"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-4 sm:p-5 space-y-4 sm:space-y-5 pt-4">
            {/* FROM and TO 24-hr cards */}
            <div className="grid grid-cols-2 gap-2 sm:gap-4">
              <div 
                onClick={() => setActiveField("from")}
                className={cn(
                  "relative border rounded-2xl p-3 sm:p-4 flex flex-col justify-between shadow-2xs cursor-pointer transition-all",
                  activeField === "from"
                    ? "border-emerald-500 bg-emerald-500/10 ring-1 ring-emerald-500"
                    : "border-border bg-card hover:border-emerald-500/50 text-muted-foreground"
                )}
              >
                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">From</span>
                <div className="flex items-center gap-2 mt-1">
                  <Clock className={cn("h-4 w-4 sm:h-5 sm:w-5 shrink-0", activeField === "from" ? "text-emerald-500" : "text-muted-foreground/60")} />
                  <span className="text-sm sm:text-base font-extrabold text-foreground">
                    {mounted && bookingTimes.startTime ? formatTo24Hour(bookingTimes.startTime) : "HH:MM"}
                  </span>
                </div>
              </div>

              <div 
                onClick={() => setActiveField("to")}
                className={cn(
                  "relative border rounded-2xl p-3 sm:p-4 flex flex-col justify-between shadow-2xs cursor-pointer transition-all",
                  activeField === "to"
                    ? "border-emerald-500 bg-emerald-500/10 ring-1 ring-emerald-500"
                    : "border-border bg-card hover:border-emerald-500/50 text-muted-foreground"
                )}
              >
                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">To</span>
                <div className="flex items-center gap-2 mt-1">
                  <Clock className={cn("h-4 w-4 sm:h-5 sm:w-5 shrink-0", activeField === "to" ? "text-emerald-500" : "text-muted-foreground/60")} />
                  <span className="text-sm sm:text-base font-extrabold text-foreground">
                    {mounted && bookingTimes.endTime ? formatTo24Hour(bookingTimes.endTime) : "HH:MM"}
                  </span>
                </div>
              </div>
            </div>

            {/* Time Slots Grid */}
            <div className="space-y-2.5 pt-1">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span suppressHydrationWarning className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Select Time Slot ({MONTH_SHORT[selectedDate.getMonth()]} {selectedDate.getDate()})
                  </span>
                  <span className="text-[10px] text-muted-foreground italic ml-2">
                    ({slotsList.length} slots available)
                  </span>
                </div>

                {/* Visual Color Legend */}
                <div className="flex flex-wrap items-center gap-2.5 text-[10px]">
                  <div className="flex items-center gap-1">
                    <span className="h-2.5 w-2.5 rounded-sm border-2 border-emerald-500 bg-emerald-500/20" />
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">Selected</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="h-2.5 w-2.5 rounded-sm border-2 border-slate-400 dark:border-slate-500 bg-slate-300/60 dark:bg-slate-700" />
                    <span className="font-semibold text-slate-700 dark:text-slate-300">Your Booking</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="h-2.5 w-2.5 rounded-sm border border-red-500/30 bg-red-500/15" />
                    <span className="font-medium text-red-500">Booked</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="h-2.5 w-2.5 rounded-sm border border-slate-200 dark:border-slate-800 bg-card" />
                    <span className="font-medium text-muted-foreground">Available</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-1.5 sm:gap-2 max-h-60 overflow-y-auto pr-1">
                {slotsList.map((slot, index) => {
                  const booking = isSlotBooked(slot);
                  const isBooked = !!booking;
                  const isMyBooking = isBooked && ((booking as any).driverId === driver.id || (booking as any).driver?.id === driver.id);
                  const isOtherBooking = isBooked && !isMyBooking;
                  const slotStart = new Date(slot.startStr).getTime();
                  const isSelectedSlot = !isBooked && (bookingTimes.startTime && bookingTimes.endTime
                    ? (slotStart >= new Date(bookingTimes.startTime).getTime() && slotStart <= new Date(bookingTimes.endTime).getTime())
                    : (bookingTimes.startTime === slot.startStr || bookingTimes.endTime === slot.startStr));
                  
                  return (
                    <button
                      key={index}
                      type="button"
                      title={
                        isMyBooking
                          ? "Your booking (Click to view details)"
                          : isOtherBooking
                            ? `Booked by ${(booking as any)?.driver?.name || (booking as any)?.requestedBy || 'another driver'} (Click to view details)`
                            : `Available slot ${slot.label}`
                      }
                      onClick={() => {
                        if (isMyBooking || isOtherBooking) {
                          setClickedBookedSlot((prev) => (prev?.id === booking?.id ? null : (booking as TripWithRelations)));
                        } else {
                          handleSlotClick(slot);
                        }
                      }}
                      className={cn(
                        "p-1.5 rounded-xl border flex flex-col items-center justify-center text-center transition-all h-[44px] sm:h-[48px]",
                        isSelectedSlot
                          ? "border-2 border-emerald-500 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold shadow-xs ring-2 ring-emerald-500/20 cursor-pointer"
                          : isMyBooking
                            ? "border-2 border-slate-400 dark:border-slate-500 bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold shadow-xs hover:bg-slate-300/80 dark:hover:bg-slate-700/80 cursor-pointer"
                            : isOtherBooking
                              ? "border border-red-500/30 bg-red-500/10 text-red-500 dark:text-red-400 cursor-pointer hover:bg-red-500/20 active:scale-95"
                              : "border border-slate-200 dark:border-slate-800 bg-card hover:border-primary/50 hover:bg-primary/5 text-foreground cursor-pointer"
                      )}
                    >
                      <span className="text-xs font-bold leading-tight">{slot.label}</span>
                      {isMyBooking && <span className="text-[7px] mt-0.5 font-bold uppercase tracking-wider leading-none">Your booking</span>}
                      {isOtherBooking && <span className="text-[7px] mt-0.5 font-semibold opacity-90 leading-none">Booked</span>}
                      {isSelectedSlot && <span className="text-[7px] mt-0.5 font-bold uppercase tracking-wider leading-none">Selected</span>}
                    </button>
                  );
                })}
              </div>

              {/* Clicked Booked Slot Detail Card */}
              {clickedBookedSlot && (
                <div className={cn(
                  "border p-3.5 sm:p-4 rounded-2xl text-xs space-y-2.5 transition-all animate-in fade-in slide-in-from-top-1",
                  (clickedBookedSlot.driverId === driver.id || clickedBookedSlot.driver?.id === driver.id)
                    ? "bg-slate-500/10 border-slate-400/40 text-foreground"
                    : "bg-red-500/10 border-red-500/30 text-foreground"
                )}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 font-bold">
                      {(clickedBookedSlot.driverId === driver.id || clickedBookedSlot.driver?.id === driver.id) ? (
                        <span className="text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                          <CheckCircle2 className="h-4 w-4 text-slate-600 dark:text-slate-400" /> Your Booking Details
                        </span>
                      ) : (
                        <span className="text-red-500 flex items-center gap-1.5">
                          <AlertCircle className="h-4 w-4" /> Car Reserved by Another Driver
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setClickedBookedSlot(null)}
                      className="text-muted-foreground hover:text-foreground text-[11px] px-2 py-0.5 rounded-lg border border-border/40 hover:bg-card transition-colors"
                    >
                      Close
                    </button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                    <div>
                      <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Booked By</span>
                      <span className="font-bold text-foreground">
                        {clickedBookedSlot.driver?.name || clickedBookedSlot.requestedBy || "Another Driver"}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Vehicle</span>
                      <span className="font-semibold text-foreground">
                        {activeVehicleForDisplay?.name || "Vehicle"} ({activeVehicleForDisplay?.vehicleNumber})
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Time Schedule</span>
                      <span className="font-semibold text-foreground">
                        {formatTo24Hour(clickedBookedSlot.startTime as any)} - {formatTo24Hour(clickedBookedSlot.endTime as any)}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Purpose</span>
                      <span className="font-semibold text-foreground">
                        {clickedBookedSlot.purpose || "Duty Booking"}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Booking Form */}
            <form onSubmit={handleBookingSubmit} className="space-y-3 pt-2 border-t border-border/30">
              {bookingError && (
                <div className="bg-red-500/10 border border-red-500/20 p-2.5 rounded-xl text-xs text-red-500 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <p>{bookingError}</p>
                </div>
              )}
              {bookingSuccess && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 p-2.5 rounded-xl text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <p>{bookingSuccess}</p>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Pickup Location</label>
                  <select
                    value={bookingTimes.pickup}
                    onChange={(e) => setBookingTimes({ ...bookingTimes, pickup: e.target.value })}
                    className="w-full h-9 rounded-xl border border-input bg-card px-2.5 text-xs font-medium cursor-pointer"
                  >
                    {locationsList.map((loc) => (
                      <option key={loc.id} value={loc.name}>{loc.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Drop Location</label>
                  <select
                    value={bookingTimes.destination}
                    onChange={(e) => setBookingTimes({ ...bookingTimes, destination: e.target.value })}
                    className="w-full h-9 rounded-xl border border-input bg-card px-2.5 text-xs font-medium cursor-pointer"
                  >
                    {locationsList.map((loc) => (
                      <option key={loc.id} value={loc.name}>{loc.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <Button 
                  type="submit" 
                  className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-white font-bold h-10 px-6 text-xs rounded-xl shadow-xs"
                  disabled={isPending}
                >
                  {isPending ? "Confirming..." : "Confirm Booking"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* ========================================================================= */}
      {/* 4. BOOKINGS HISTORY & SCHEDULE                                            */}
      {/* ========================================================================= */}
      {(() => {
        const now = new Date();
        const allHistoryBookings = allDriverBookings || [];

        const upcomingCount = allHistoryBookings.filter(
          (b) => b.status !== "COMPLETED" && b.status !== "CANCELLED" && new Date(b.endTime) >= now
        ).length;

        const adminCount = allHistoryBookings.filter(
          (b) => b.assignedBy === "ADMIN" || b.status === "ASSIGNED" || (b.requestedBy && b.requestedBy.toUpperCase().includes("ADMIN"))
        ).length;

        const driverCount = allHistoryBookings.filter(
          (b) => !(b.assignedBy === "ADMIN" || b.status === "ASSIGNED" || (b.requestedBy && b.requestedBy.toUpperCase().includes("ADMIN")))
        ).length;

        const completedCount = allHistoryBookings.filter(
          (b) => b.status === "COMPLETED" || (b.status !== "CANCELLED" && new Date(b.endTime) < now)
        ).length;

        const cancelledCount = allHistoryBookings.filter((b) => b.status === "CANCELLED").length;

        const filteredHistory = allHistoryBookings.filter((b) => {
          if (historyFilter === "UPCOMING") {
            if (b.status === "COMPLETED" || b.status === "CANCELLED" || new Date(b.endTime) < now) return false;
          } else if (historyFilter === "ADMIN") {
            const isAdmin = b.assignedBy === "ADMIN" || b.status === "ASSIGNED" || (b.requestedBy && b.requestedBy.toUpperCase().includes("ADMIN"));
            if (!isAdmin) return false;
          } else if (historyFilter === "DRIVER") {
            const isAdmin = b.assignedBy === "ADMIN" || b.status === "ASSIGNED" || (b.requestedBy && b.requestedBy.toUpperCase().includes("ADMIN"));
            if (isAdmin) return false;
          } else if (historyFilter === "COMPLETED") {
            if (b.status !== "COMPLETED" && !(b.status !== "CANCELLED" && new Date(b.endTime) < now)) return false;
          } else if (historyFilter === "CANCELLED") {
            if (b.status !== "CANCELLED") return false;
          }

          if (historySearch.trim()) {
            const q = historySearch.toLowerCase();
            const matchTrip = (b.tripNumber || "").toLowerCase().includes(q);
            const matchVehicle = (b.vehicle?.name || "").toLowerCase().includes(q) || (b.vehicle?.vehicleNumber || "").toLowerCase().includes(q);
            const matchLoc = (b.pickup || "").toLowerCase().includes(q) || (b.destination || "").toLowerCase().includes(q);
            const matchPurpose = (b.purpose || "").toLowerCase().includes(q);
            if (!matchTrip && !matchVehicle && !matchLoc && !matchPurpose) return false;
          }

          return true;
        });

        return (
          <div className="space-y-4 w-full text-foreground pt-2">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/30 pb-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-lg sm:text-xl font-bold">
                  <CalendarDays className="h-5 w-5 text-primary" />
                  <span>Booking History & Schedule</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  View your complete booking history — including admin-assigned duties and self-booked slots.
                </p>
              </div>

              {/* Search Bar */}
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search history & fleet..."
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  className="pl-9 h-9 text-xs bg-card"
                />
              </div>
            </div>

            {/* Filter Tabs (All, Upcoming, Admin Assigned, Driver Booked, Completed, Cancelled) */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
              <button
                type="button"
                onClick={() => setHistoryFilter("ALL")}
                className={cn(
                  "px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5",
                  historyFilter === "ALL"
                    ? "bg-primary text-white shadow-xs"
                    : "bg-muted/30 hover:bg-muted/50 text-muted-foreground hover:text-foreground border border-border/50"
                )}
              >
                <span>All History</span>
                <span className={cn(
                  "px-1.5 py-0.2 rounded-md text-[10px]",
                  historyFilter === "ALL" ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
                )}>
                  {allHistoryBookings.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setHistoryFilter("UPCOMING")}
                className={cn(
                  "px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5",
                  historyFilter === "UPCOMING"
                    ? "bg-amber-500 text-zinc-950 shadow-xs"
                    : "bg-muted/30 hover:bg-muted/50 text-muted-foreground hover:text-foreground border border-border/50"
                )}
              >
                <Clock className="h-3.5 w-3.5" />
                <span>Upcoming</span>
                <span className={cn(
                  "px-1.5 py-0.2 rounded-md text-[10px]",
                  historyFilter === "UPCOMING" ? "bg-black/15 text-zinc-950 font-black" : "bg-muted text-muted-foreground"
                )}>
                  {upcomingCount}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setHistoryFilter("ADMIN")}
                className={cn(
                  "px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5",
                  historyFilter === "ADMIN"
                    ? "bg-purple-600 text-white shadow-xs"
                    : "bg-muted/30 hover:bg-muted/50 text-muted-foreground hover:text-foreground border border-border/50"
                )}
              >
                <ShieldAlert className="h-3.5 w-3.5" />
                <span>Admin Assigned</span>
                <span className={cn(
                  "px-1.5 py-0.2 rounded-md text-[10px]",
                  historyFilter === "ADMIN" ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
                )}>
                  {adminCount}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setHistoryFilter("DRIVER")}
                className={cn(
                  "px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5",
                  historyFilter === "DRIVER"
                    ? "bg-blue-600 text-white shadow-xs"
                    : "bg-muted/30 hover:bg-muted/50 text-muted-foreground hover:text-foreground border border-border/50"
                )}
              >
                <UserCheck className="h-3.5 w-3.5" />
                <span>Driver Booked</span>
                <span className={cn(
                  "px-1.5 py-0.2 rounded-md text-[10px]",
                  historyFilter === "DRIVER" ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
                )}>
                  {driverCount}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setHistoryFilter("COMPLETED")}
                className={cn(
                  "px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5",
                  historyFilter === "COMPLETED"
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "bg-muted/30 hover:bg-muted/50 text-muted-foreground hover:text-foreground border border-border/50"
                )}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Completed</span>
                <span className={cn(
                  "px-1.5 py-0.2 rounded-md text-[10px]",
                  historyFilter === "COMPLETED" ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
                )}>
                  {completedCount}
                </span>
              </button>

              {cancelledCount > 0 && (
                <button
                  type="button"
                  onClick={() => setHistoryFilter("CANCELLED")}
                  className={cn(
                    "px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5",
                    historyFilter === "CANCELLED"
                      ? "bg-red-600 text-white shadow-xs"
                      : "bg-muted/30 hover:bg-muted/50 text-muted-foreground hover:text-foreground border border-border/50"
                  )}
                >
                  <XCircle className="h-3.5 w-3.5" />
                  <span>Cancelled</span>
                  <span className={cn(
                    "px-1.5 py-0.2 rounded-md text-[10px]",
                    historyFilter === "CANCELLED" ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
                  )}>
                    {cancelledCount}
                  </span>
                </button>
              )}
            </div>

            {/* List of Bookings / History */}
            <div className="space-y-4 max-h-[750px] overflow-y-auto pr-1">
              {filteredHistory.map((b) => {
                const bStartTime = new Date(b.startTime);
                const bEndTime = new Date(b.endTime);
                const isPast = bEndTime < now;
                const isUpcoming = !isPast && b.status !== "COMPLETED" && b.status !== "CANCELLED";
                const diffHours = (bStartTime.getTime() - now.getTime()) / (1000 * 60 * 60);
                const canCancelDirectly = diffHours >= 24 && isUpcoming;
                const isAdmin = b.assignedBy === "ADMIN" || b.status === "ASSIGNED" || (b.requestedBy && b.requestedBy.toUpperCase().includes("ADMIN"));

                return (
                  <div key={b.id} className="rounded-3xl border border-border/70 bg-card p-4 sm:p-5 space-y-4 shadow-xs transition-all hover:border-primary/40">
                    {/* Trip Header & Badges */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <h3 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
                          {b.tripNumber}
                        </h3>

                        {/* Admin Assigned vs Driver Booked Tag */}
                        {isAdmin ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-purple-500/30 bg-purple-500/10 px-3 py-0.5 text-xs font-black text-purple-600 dark:text-purple-400 uppercase tracking-wide">
                            <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
                            <span>Admin Assigned</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-0.5 text-xs font-black text-blue-600 dark:text-blue-400 uppercase tracking-wide">
                            <UserCheck className="h-3.5 w-3.5 shrink-0" />
                            <span>Driver Booked</span>
                          </span>
                        )}
                      </div>

                      {/* Status Badges */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {isUpcoming && !canCancelDirectly && (
                          <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/80 bg-amber-50/80 dark:bg-amber-950/40 px-3 py-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400 whitespace-nowrap shrink-0">
                            <Clock className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                            <span>&lt;24h to start</span>
                          </div>
                        )}

                        <div className={cn(
                          "inline-flex items-center rounded-full px-3.5 py-0.5 text-xs font-extrabold tracking-wide uppercase whitespace-nowrap shrink-0 border",
                          b.status === "COMPLETED" ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400" :
                          b.status === "CANCELLED" ? "bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400" :
                          b.status === "IN_PROGRESS" ? "bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400" :
                          "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400"
                        )}>
                          {b.status}
                        </div>
                      </div>
                    </div>

                    {/* Vehicle Card */}
                    <div className="rounded-2xl border border-border/70 bg-muted/10 p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center gap-3.5 sm:gap-5 shadow-xs">
                      {(b.vehicle as any)?.imageUrl ? (
                        <div className="w-full sm:w-48 md:w-56 h-32 sm:h-28 md:h-32 rounded-xl border border-border/80 bg-background/80 dark:bg-muted/20 shrink-0 overflow-hidden flex items-center justify-center p-1.5 shadow-2xs">
                          <img 
                            src={(b.vehicle as any).imageUrl} 
                            alt={b.vehicle?.name} 
                            className="w-full h-full object-contain cursor-zoom-in transition-transform duration-200 hover:scale-105" 
                            loading="lazy"
                            onClick={() => setInspectedTrip(b)}
                          />
                        </div>
                      ) : (
                        <div className="w-full sm:w-48 md:w-56 h-32 sm:h-28 md:h-32 rounded-xl bg-muted flex items-center justify-center border border-border shrink-0">
                          <Truck className="h-10 w-10 text-muted-foreground" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <h4 className="font-bold text-base sm:text-lg text-foreground leading-snug truncate">
                          {b.vehicle?.name || "Vehicle"}
                        </h4>
                        <p className="text-xs sm:text-sm font-semibold font-mono text-muted-foreground mt-0.5 truncate">
                          ({b.vehicle?.vehicleNumber || "—"})
                        </p>
                        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs sm:text-sm font-medium text-muted-foreground mt-1.5">
                          <span className="text-foreground/90 font-medium break-words">{b.pickup}</span>
                          <span className="text-primary font-bold text-xs sm:text-sm leading-none shrink-0">➔</span>
                          <span className="text-foreground/90 font-medium break-words">{b.destination}</span>
                        </div>
                      </div>
                    </div>

                    {/* Time & Date Card */}
                    <div className="rounded-2xl border border-border/70 bg-card p-3.5 sm:p-4 space-y-2.5 shadow-xs">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-amber-500/15 flex items-center justify-center shrink-0">
                            <Clock className="h-4 w-4 text-amber-500 stroke-[2.5]" />
                          </div>
                          <span className="font-extrabold text-base sm:text-lg text-foreground tracking-tight">
                            {mounted ? `${bStartTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })} – ${bEndTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}` : ""}
                          </span>
                        </div>
                        <span className="text-xs font-semibold text-muted-foreground">
                          {((bEndTime.getTime() - bStartTime.getTime()) / (1000 * 60 * 60)).toFixed(1)} hrs
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 flex items-center justify-center shrink-0">
                          <CalendarIcon className="h-5 w-5 text-muted-foreground/80 shrink-0" />
                        </div>
                        <span className="font-semibold text-sm sm:text-base text-muted-foreground">
                          {mounted ? bStartTime.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" }) : ""}
                        </span>
                      </div>
                    </div>

                    {/* Purpose and Notes */}
                    {(b.purpose || b.notes) && (
                      <div className="text-xs text-muted-foreground bg-muted/20 rounded-xl p-2.5 space-y-1">
                        {b.purpose && <div><span className="font-semibold text-foreground">Purpose:</span> {b.purpose}</div>}
                        {b.notes && <div><span className="font-semibold text-foreground">Notes:</span> {b.notes}</div>}
                      </div>
                    )}

                    {/* Action Button for Upcoming Bookings */}
                    {isUpcoming && (
                      canCancelDirectly ? (
                        <button
                          type="button"
                          onClick={async () => {
                            if (confirm("Are you sure you want to cancel this booking?")) {
                              startTransition(async () => {
                                const res = await cancelUserBookingAction(b.id);
                                if (res.error) {
                                  alert(res.error);
                                } else {
                                  router.refresh();
                                }
                              });
                            }
                          }}
                          disabled={isPending}
                          className="w-full rounded-2xl border border-red-400/80 bg-red-50/60 hover:bg-red-100/70 dark:bg-red-950/20 dark:hover:bg-red-900/30 py-3 px-3 sm:px-4 flex items-center justify-center gap-2 sm:gap-2.5 transition-all cursor-pointer shadow-xs active:scale-[0.99] disabled:opacity-50"
                        >
                          <XCircle className="h-5 w-5 text-red-500 shrink-0" />
                          <div className="h-4 sm:h-5 w-px bg-red-300 dark:bg-red-700 shrink-0" />
                          <span className="text-red-600 dark:text-red-400 font-bold text-xs sm:text-sm whitespace-nowrap">
                            Cancel Booking
                          </span>
                        </button>
                      ) : (
                        <div className="p-3 rounded-2xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-300/80 dark:border-amber-700/60 flex items-center justify-between text-xs">
                          <span className="text-amber-800 dark:text-amber-300 font-semibold flex items-center gap-1.5">
                            <Headphones className="h-4 w-4 text-amber-500 shrink-0" />
                            Starts in &lt;24h (Admin Cancellation Only)
                          </span>
                          <a
                            href="tel:+358417297334"
                            className="text-amber-600 dark:text-amber-400 font-bold hover:underline"
                          >
                            +358 41 7297334
                          </a>
                        </div>
                      )
                    )}

                    {/* View Details Button */}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setInspectedTrip(b)}
                      className="w-full text-xs font-semibold h-9 rounded-xl"
                    >
                      View Trip Details
                    </Button>
                  </div>
                );
              })}

              {filteredHistory.length === 0 && (
                <div className="text-center py-10 px-4 border border-dashed border-border/70 rounded-3xl bg-card space-y-2.5">
                  <CalendarDays className="h-8 w-8 text-muted-foreground/50 mx-auto" />
                  <p className="text-sm font-semibold text-foreground">
                    {historyFilter === "UPCOMING" ? "No upcoming bookings scheduled" : "No bookings found in this category"}
                  </p>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                    {historyFilter !== "ALL"
                      ? "Try switching to another filter tab to view all bookings and duty history."
                      : "You have not made or been assigned any vehicle bookings yet."}
                  </p>
                  {historyFilter !== "ALL" && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setHistoryFilter("ALL");
                        setHistorySearch("");
                      }}
                      className="mt-1 text-xs"
                    >
                      View All History
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })()}



      {/* ========================================================================= */}
      {/* 5. TRIP DETAILS MODAL DIALOG                                              */}
      {/* ========================================================================= */}
      {inspectedTrip && (
        <Dialog
          isOpen={!!inspectedTrip}
          onClose={() => setInspectedTrip(null)}
          title={`Task Details #${inspectedTrip.tripNumber || inspectedTrip.id.slice(0, 8)}`}
          className="max-w-md"
        >
          <div className="space-y-4 pt-1 text-foreground">
            <div className="flex items-center justify-between p-3 rounded-2xl bg-muted/20 border border-border/50">
              <span className="text-xs font-semibold text-muted-foreground">Status</span>
              <span className={cn(
                "px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider",
                inspectedTrip.status === "COMPLETED" ? "bg-emerald-500/15 text-emerald-600" :
                inspectedTrip.status === "CANCELLED" ? "bg-red-500/15 text-red-500" :
                "bg-primary/15 text-primary"
              )}>
                {inspectedTrip.status}
              </span>
            </div>

            {inspectedTrip.vehicle && (
              <div className="p-3.5 rounded-2xl border border-border/60 bg-card flex items-center gap-3">
                {(inspectedTrip.vehicle as any)?.imageUrl ? (
                  <div className="w-28 sm:w-36 h-20 sm:h-24 rounded-xl border border-border/80 bg-background/80 dark:bg-muted/20 shrink-0 overflow-hidden flex items-center justify-center p-1 shadow-2xs">
                    <img
                      src={(inspectedTrip.vehicle as any).imageUrl}
                      alt={inspectedTrip.vehicle.name}
                      className="w-full h-full object-contain"
                    />
                  </div>
                ) : (
                  <div className="w-28 sm:w-36 h-20 sm:h-24 rounded-xl bg-muted flex items-center justify-center border border-border shrink-0">
                    <Truck className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <h4 className="font-bold text-xs sm:text-sm text-foreground truncate">{inspectedTrip.vehicle.name}</h4>
                  <p className="text-[11px] sm:text-xs font-mono text-muted-foreground">{inspectedTrip.vehicle.vehicleNumber}</p>
                  <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5">{inspectedTrip.vehicle.year} · {inspectedTrip.vehicle.seatingCapacity} Seats</p>
                </div>
              </div>
            )}

            <div className="space-y-2 p-3 sm:p-3.5 rounded-2xl border border-border/60 bg-card text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Date:</span>
                <span className="font-bold">
                  {new Date(inspectedTrip.startTime).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Time Slot:</span>
                <span className="font-bold font-mono">
                  {new Date(inspectedTrip.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })} –{" "}
                  {new Date(inspectedTrip.endTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Duration:</span>
                <span className="font-bold">
                  {((new Date(inspectedTrip.endTime).getTime() - new Date(inspectedTrip.startTime).getTime()) / (1000 * 60 * 60)).toFixed(2)} hours
                </span>
              </div>
            </div>

            <div className="space-y-1.5 p-3 sm:p-3.5 rounded-2xl border border-border/60 bg-card text-xs">
              <div className="flex items-start gap-2">
                <span className="text-muted-foreground w-14 sm:w-16 shrink-0">Pickup:</span>
                <span className="font-bold text-foreground truncate">{inspectedTrip.pickup || "—"}</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-muted-foreground w-14 sm:w-16 shrink-0">Drop:</span>
                <span className="font-bold text-foreground truncate">{inspectedTrip.destination || "—"}</span>
              </div>
            </div>

            {inspectedTrip.notes && (
              <div className="p-2.5 sm:p-3 rounded-2xl bg-muted/20 border border-border/40 text-xs">
                <span className="text-muted-foreground block font-semibold mb-0.5">Notes:</span>
                <p className="text-foreground">{inspectedTrip.notes}</p>
              </div>
            )}
          </div>
        </Dialog>
      )}
    </div>
  );
}
