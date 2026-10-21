"use client";

import React, { useState, useEffect, useTransition, useCallback } from "react";
import { User, Vehicle, Trip, WeeklyLog } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { bookCarAction, cancelBookingAction, cancelUserBookingAction } from "@/actions/driver-trips";
import { Clock, Calendar, CalendarDays, AlertCircle, Truck, CheckCircle2, Headphones, PhoneCall, MessageCircle, Mail, ShieldAlert, AlertTriangle, XCircle, Shield, UserCheck, Search, Filter } from "lucide-react";
import { cn } from "@/utils/cn";
import { useTranslation } from "@/components/layout/language-provider";
import { useRouter } from "next/navigation";
import { isWeeklyLogSubmitted } from "@/utils/weekly-log-utils";

import { PerformanceMatrixSection, PerformanceMatrixData } from "./performance-matrix-section";
import { DEFAULT_BOOKING_LOCATIONS, BookingLocation } from "@/lib/locations";
import { getBookingLocationsAction } from "@/actions/locations";

interface DriverDashboardClientProps {
  driver: User;
  activeShift: any | null;
  assignedVehicle: Vehicle | null;
  vehicles: Vehicle[];
  bookings: (Trip & { driver?: User | null; vehicle?: Vehicle | null })[];
  activeTrip: (Trip & { vehicle: Vehicle }) | null;
  todayBookings: Trip[];
  logs?: WeeklyLog[];
  matrixData?: PerformanceMatrixData;
  driverBookings?: (Trip & { driver?: User | null; vehicle?: Vehicle | null })[];
}

export function DriverDashboardClient({
  driver,
  activeShift,
  assignedVehicle,
  vehicles,
  bookings,
  activeTrip,
  todayBookings,
  logs = [],
  matrixData,
  driverBookings,
}: DriverDashboardClientProps) {
  const { t } = useTranslation();
  const [isPending, startTransition] = useTransition();
  const [mounted, setMounted] = useState(false);

  const router = useRouter();
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [vehicleFilter, setVehicleFilter] = useState<"ALL" | "AVAILABLE" | "ON_TRIP">("ALL");
  // Dates: 7-day default window; showAllDates toggles full calendar mode
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showAllDates, setShowAllDates] = useState(false);
  // Displayed dates: ±3 around selected if selected ≠ today, else 7-day window
  const [windowDates, setWindowDates] = useState<Date[]>([]);

  // Live bookings state for real-time slot availability
  const [liveBookings, setLiveBookings] = useState<(Trip & { driver?: User | null; vehicle?: Vehicle | null })[]>(bookings);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  const [locationsList, setLocationsList] = useState<BookingLocation[]>(DEFAULT_BOOKING_LOCATIONS);
  const [isCustomPickup, setIsCustomPickup] = useState(false);
  const [isCustomDrop, setIsCustomDrop] = useState(false);

  useEffect(() => {
    getBookingLocationsAction().then((locs) => {
      if (locs && locs.length > 0) {
        setLocationsList(locs);
      }
    });
  }, []);

  const [bookingTimes, setBookingTimes] = useState({
    startTime: "",
    endTime: "",
    pickup: DEFAULT_BOOKING_LOCATIONS[0].name,
    destination: DEFAULT_BOOKING_LOCATIONS[0].name,
    purpose: "Corporate Duty",
    notes: "",
  });
  const [clickedBookedSlot, setClickedBookedSlot] = useState<any | null>(null);
  const [activeField, setActiveField] = useState<"from" | "to">("from");
  const handleOpenCalendar = () => {
    setShowAllDates(true);
  };
  const [showSundayPopup, setShowSundayPopup] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [bookingSuccess, setBookingSuccess] = useState<string | null>(null);
  const [supportBooking, setSupportBooking] = useState<any | null>(null);
  const [historyFilter, setHistoryFilter] = useState<"ALL" | "UPCOMING" | "ADMIN" | "DRIVER" | "COMPLETED" | "CANCELLED">("ALL");
  const [historySearch, setHistorySearch] = useState("");

  const [hoveredImage, setHoveredImage] = useState<string | null>(null);

  const [activePreviewImage, setActivePreviewImage] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const handleMouseEnter = (imgUrl: string) => {
    if (typeof window !== "undefined" && window.matchMedia("(hover: hover)").matches) {
      setHoveredImage(imgUrl);
    }
  };

  const handleMouseLeave = () => {
    setHoveredImage(null);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    setMousePos({ x: e.clientX, y: e.clientY });
  };

  useEffect(() => {
    setMounted(true);

    const params = new URLSearchParams(window.location.search);
    const preselectedVehicleId = params.get("vehicleId");
    if (preselectedVehicleId) {
      const match = vehicles.find((v) => v.id === preselectedVehicleId);
      if (match) {
        setSelectedVehicle(match);
      }
    } else if (assignedVehicle) {
      setSelectedVehicle(assignedVehicle);
    }

    // Generate initial 7-day window (±3 days around today)
    const list: Date[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = -3; i <= 3; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      list.push(d);
    }
    setWindowDates(list);

    // Weekly log submission check (Monday to Monday window)
    const isLogSubmittedThisWeek = isWeeklyLogSubmitted(logs);
    if (!isLogSubmittedThisWeek) {
      const dismissed = sessionStorage.getItem("weekly_log_popup_dismissed");
      if (!dismissed) {
        setShowSundayPopup(true);
      }
    }
  }, [vehicles, logs]);

  // When selectedDate changes, update window to display 3 days before and 3 days after selected date
  useEffect(() => {
    const sel = new Date(selectedDate);
    sel.setHours(0, 0, 0, 0);

    const window: Date[] = [];
    for (let i = -3; i <= 3; i++) {
      const d = new Date(sel);
      d.setDate(sel.getDate() + i);
      window.push(d);
    }
    setWindowDates(window);
  }, [selectedDate]);

  // Helper: fetch live bookings for active vehicle
  const fetchLiveBookings = useCallback(async (vehicleId: string) => {
    try {
      const res = await fetch(`/api/bookings?vehicleId=${vehicleId}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      if (data.bookings) {
        setLiveBookings(data.bookings);
        setLastRefreshed(new Date());
      }
    } catch {
      // silently ignore network errors
    }
  }, []);

  // Poll for live bookings every 20 seconds when a vehicle is selected
  useEffect(() => {
    const activeVehicleId = selectedVehicle?.id || vehicles[0]?.id;
    if (!activeVehicleId) return;
    // Initial fetch
    fetchLiveBookings(activeVehicleId);
    const interval = setInterval(() => fetchLiveBookings(activeVehicleId), 20000);
    return () => clearInterval(interval);
  }, [selectedVehicle, vehicles, fetchLiveBookings]);







  // Vehicle Counts
  const availableCount = vehicles.filter(v => v.status === "AVAILABLE").length;
  const onTripCount = vehicles.filter(v => v.status === "ON_TRIP").length;

  const filteredVehicles = vehicles
    .filter((car) => {
      if (vehicleFilter === "AVAILABLE") return car.status === "AVAILABLE";
      if (vehicleFilter === "ON_TRIP") return car.status === "ON_TRIP";
      return true;
    })
    .sort((a, b) => {
      if (assignedVehicle) {
        if (a.id === assignedVehicle.id) return -1;
        if (b.id === assignedVehicle.id) return 1;
      }
      return 0;
    });

  const activeVehicleForDisplay = selectedVehicle;

  // Active Vehicle Bookings for the selected date — uses live bookings for real-time accuracy
  const activeVehicleBookings = liveBookings.filter((b) => {
    if (!activeVehicleForDisplay || b.vehicleId !== activeVehicleForDisplay.id || b.status === "CANCELLED" || b.status === "COMPLETED") return false;
    // Include any booking that overlaps with the selected date at all
    const dayStart = new Date(selectedDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(selectedDate);
    dayEnd.setHours(23, 59, 59, 999);
    const bStart = new Date(b.startTime);
    const bEnd = new Date(b.endTime);
    return bStart < dayEnd && bEnd > dayStart;
  });



  const formatTo24Hour = (dateTimeStr: string) => {
    if (!dateTimeStr) return "HH:MM";
    const parts = dateTimeStr.split("T");
    if (parts.length < 2) return "HH:MM";
    const timePart = parts[1]; // "HH:MM"
    const timeParts = timePart.split(":");
    if (timeParts.length < 2) return "HH:MM";
    const hours = parseInt(timeParts[0], 10);
    const minutes = timeParts[1];
    
    if (isNaN(hours)) return "HH:MM";
    return `${String(hours).padStart(2, '0')}:${minutes}`;
  };

  const slotsList = React.useMemo(() => {
    const now = new Date();
    const slots = [];
    for (let hour = 0; hour < 24; hour++) {
      for (const minute of [0, 30]) {
        const pad = (num: number) => String(num).padStart(2, '0');
        const displayHour = pad(hour);
        const displayMinute = minute === 0 ? "00" : "30";
        const timeFormatted = `${displayHour}:${displayMinute}`;

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

        // Skip past slots (slot must not have already ended)
        if (slotEndTime <= now) continue;

        slots.push({
          label: timeFormatted,
          labelFormatted: (
            <div className="flex flex-col items-center justify-center">
              <span className="text-[13px] font-bold">{timeFormatted}</span>
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

  // Calculate today's duration and status rules based on todayBookings prop
  const todayBookingsInfo = React.useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    // Filter bookings (trips) for this driver on this day
    const list = todayBookings.filter((b) => {
      if (b.driverId !== driver.id || b.status === "CANCELLED") return false;
      const bStart = new Date(b.startTime);
      const bEnd = new Date(b.endTime);
      return bStart < tomorrow && bEnd > today;
    });

    const durationMs = list.reduce((sum, b) => {
      const bStart = new Date(b.startTime);
      const bEnd = new Date(b.endTime);
      const clampedStart = bStart < today ? today : bStart;
      const clampedEnd = bEnd > tomorrow ? tomorrow : bEnd;
      return sum + Math.max(0, clampedEnd.getTime() - clampedStart.getTime());
    }, 0);

    const hrs = durationMs / (1000 * 60 * 60);
    
    let statusText = "Normal Duration";
    let colorClass = "bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400";
    let descText = "Your booking duration is in the standard range.";

    if (hrs === 0) {
      statusText = "No Booking";
      colorClass = "bg-muted/40 border border-border text-muted-foreground";
      descText = "You have no bookings scheduled for today.";
    } else if (hrs >= 4 && hrs < 6) {
      statusText = "Too Short / Needs Improvement";
      colorClass = "bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400";
      descText = "Booking duration is too short. Please adjust if possible.";
    } else if (hrs >= 6 && hrs < 8) {
      statusText = "Needs More Duration";
      colorClass = "bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400";
      descText = "Please add more booking duration to your shift if possible.";
    } else if (hrs >= 11) {
      statusText = "Good Duration / Good Time Slot";
      colorClass = "bg-green-500/10 border border-green-500/20 text-green-600 dark:text-green-400";
      descText = "Great! You have a good booking duration scheduled for today.";
    }

    const formatHrsMins = (h: number) => {
      const hours = Math.floor(h);
      const mins = Math.round((h - hours) * 60);
      if (hours === 0) return `${mins}m`;
      return `${hours}h ${mins}m`;
    };

    return {
      hours: hrs,
      formattedDuration: formatHrsMins(hrs),
      statusText,
      colorClass,
      descText,
      bookingsCount: list.length,
    };
  }, [todayBookings, driver.id]);

  const isSlotBooked = (slot: any) => {
    const slotStart = new Date(slot.startStr);
    const slotEnd = new Date(slot.endStr);
    
    return activeVehicleBookings.find((b) => {
      const bStart = new Date(b.startTime);
      const bEnd = new Date(b.endTime);
      return (bStart < slotEnd && bEnd > slotStart);
    });
  };

  const handleSlotClick = (slot: any) => {
    setBookingError(null);
    setBookingSuccess(null);

    const slotStart = slot.startStr;
    const slotEnd = slot.endStr;

    // Check conflict for a given start and end range
    const checkDriverConflict = (startStr: string, endStr: string) => {
      const s = new Date(startStr);
      const e = new Date(endStr);
      return bookings.some((b) => {
        if (b.status === "CANCELLED" || b.status === "COMPLETED") return false;
        if (b.driverId !== driver.id) return false;
        const bStart = new Date(b.startTime);
        const bEnd = new Date(b.endTime);
        return bStart < e && bEnd > s;
      });
    };

    if (activeField === "from" || !bookingTimes.startTime) {
      // Selecting / setting From Time
      const proposedStart = slotStart;
      const proposedEnd = bookingTimes.endTime;

      if (proposedEnd && new Date(proposedEnd) > new Date(proposedStart)) {
        // Range validation
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
        // No valid end time set, validate only the selected single slot
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
      // activeField === "to" and bookingTimes.startTime is set
      const startVal = new Date(bookingTimes.startTime).getTime();
      const clickedVal = new Date(slotStart).getTime();

      if (clickedVal <= startVal) {
        // Reset From to this slot and clear To
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
        // Valid proposed range
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

    if (!activeVehicleForDisplay) {
      setBookingError("No vehicle selected.");
      return;
    }

    if (!bookingTimes.startTime || !bookingTimes.endTime) {
      setBookingError("Start time and end time are required.");
      return;
    }

    const start = new Date(bookingTimes.startTime);
    const end = new Date(bookingTimes.endTime);

    if (start >= end) {
      setBookingError("End time must be after start time.");
      return;
    }

    if (end.getTime() - start.getTime() > 12 * 60 * 60 * 1000) {
      setBookingError("Booking duration cannot exceed 12 hours.");
      return;
    }

    if (!bookingTimes.pickup || !bookingTimes.destination || !bookingTimes.purpose) {
      setBookingError("Pickup location, drop location, and purpose are required.");
      return;
    }

    // Allow start time to be up to 2 hours in the past to accommodate selecting the current slot
    const graceTime = new Date(Date.now() - 2 * 60 * 60 * 1000);
    if (start < graceTime) {
      setBookingError("Booking start time cannot be in the past.");
      return;
    }

    startTransition(async () => {
      const res = await bookCarAction({
        vehicleId: activeVehicleForDisplay.id,
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
        setBookingSuccess("Vehicle booked successfully!");
        setBookingTimes({
          startTime: "",
          endTime: "",
          pickup: locationsList[0]?.name || DEFAULT_BOOKING_LOCATIONS[0].name,
          destination: locationsList[0]?.name || DEFAULT_BOOKING_LOCATIONS[0].name,
          purpose: "Corporate Duty",
          notes: "",
        });
        setActiveField("from");
        router.refresh();
      }
    });
  };

  const expiryDate = driver.licenseExpiry ? new Date(driver.licenseExpiry) : null;
  let isExpiringSoon = false;
  let isExpired = false;
  let daysRemaining: number | null = null;

  if (expiryDate) {
    const now = new Date();
    const warningStartDate = new Date(expiryDate);
    const targetMonth = warningStartDate.getMonth() - 6;
    warningStartDate.setMonth(targetMonth);
    const expectedMonth = (targetMonth % 12 + 12) % 12;
    if (warningStartDate.getMonth() !== expectedMonth) {
      warningStartDate.setDate(0);
    }
    warningStartDate.setHours(0, 0, 0, 0);

    daysRemaining = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (now > expiryDate) {
      isExpired = true;
    } else if (now >= warningStartDate) {
      isExpiringSoon = true;
    }
  }

  const isLogSubmittedThisWeek = isWeeklyLogSubmitted(logs);

  return (
    <div className="mx-auto max-w-7xl w-full space-y-6">
      {/* Weekly Log Reminder Banner (Monday to Monday Window) */}
      {!isLogSubmittedThisWeek && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-sm">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-6 w-6 shrink-0 mt-0.5 text-amber-500 animate-pulse" />
            <div className="space-y-1">
              <h4 className="font-bold text-sm">Weekly Work Log Required</h4>
              <p className="text-xs text-amber-700/90 dark:text-amber-300">
                Your weekly work screenshot log for this week (Monday to Monday) has not been submitted yet. Please upload your log statement.
              </p>
            </div>
          </div>
          <Button
            onClick={() => router.push("/driver/weekly-log")}
            className="bg-amber-500 hover:bg-amber-600 text-zinc-950 font-bold text-xs shrink-0 self-end sm:self-center"
          >
            Upload Weekly Log Now
          </Button>
        </div>
      )}

      {/* License Expiry Notification Banner */}
      {isExpired && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 flex items-start gap-3 shadow-sm animate-pulse">
          <AlertTriangle className="h-6 w-6 shrink-0 mt-0.5 text-red-500" />
          <div className="space-y-1">
            <h4 className="font-bold text-sm">URGENT: Taxi License Expired!</h4>
            <p className="text-xs text-red-600/90 dark:text-red-300">
              Your taxi license expired {Math.abs(daysRemaining || 0)} days ago on{" "}
              {expiryDate?.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}. Please renew your license immediately and submit updated proof to your fleet manager. You cannot operate fleet vehicles with an expired license.
            </p>
          </div>
        </div>
      )}

      {isExpiringSoon && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 flex items-start gap-3 shadow-sm">
          <ShieldAlert className="h-6 w-6 shrink-0 mt-0.5 text-amber-500" />
          <div className="space-y-1">
            <h4 className="font-bold text-sm">Taxi License Expiring Soon!</h4>
            <p className="text-xs text-amber-700/90 dark:text-amber-300">
              Your taxi license will expire in <strong>{daysRemaining} day(s)</strong> on{" "}
              {expiryDate?.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}. Please renew your license promptly to prevent disruption to your driving duties.
            </p>
          </div>
        </div>
      )}

      {/* Welcome banner & Driver details */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 bg-card border border-border p-6 rounded-2xl text-foreground glass glow-primary">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">{t("btn_driver_portal")}</h2>
          <p className="text-sm text-muted-foreground">{t("manage_assignments")}</p>
        </div>
        <div className="text-xs space-y-2 md:border-l md:border-border/40 md:pl-6">
          <div className="flex items-center gap-1.5"><span className="text-muted-foreground font-semibold">Driver Name:</span> <span className="font-bold text-foreground">{driver.name}</span></div>
          <div className="flex items-center gap-1.5"><span className="text-muted-foreground font-semibold">License ID:</span> <span className="font-mono font-semibold text-foreground">{driver.licenseNumber}</span></div>
          <div className="flex items-center gap-1.5"><span className="text-muted-foreground font-semibold">Expiry Date:</span> <span className="font-semibold text-foreground">{driver.licenseExpiry ? (mounted ? new Date(driver.licenseExpiry).toLocaleDateString() : "") : "N/A"}</span></div>
        </div>
      </div>

      {/* Today's Booking Duration Card */}
      <Card className="border-border bg-card text-foreground">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-bold">Today's Booking Summary</CardTitle>
          <CardDescription>Your total scheduled booking time and status rating for today.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className={cn("p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4", todayBookingsInfo.colorClass)}>
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold tracking-wider opacity-80">Booking Status Rating</span>
              <div className="text-lg font-extrabold flex items-center gap-2">
                {todayBookingsInfo.statusText}
              </div>
              <p className="text-xs opacity-90">{todayBookingsInfo.descText}</p>
            </div>
            <div className="text-left sm:text-right shrink-0 border-t sm:border-t-0 sm:border-l border-current/25 pt-3 sm:pt-0 sm:pl-6">
              <span className="text-[10px] uppercase font-bold tracking-wider block opacity-80">Total Duration</span>
              <span className="text-2xl font-black block tracking-tight">{todayBookingsInfo.formattedDuration}</span>
              <span className="text-[10px] block opacity-85 mt-0.5">{todayBookingsInfo.bookingsCount} booking{todayBookingsInfo.bookingsCount !== 1 ? 's' : ''} today</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Fleet Vehicles Slot Booking Calendar (Design inspired by reference image) */}
      {/* 1. SELECT VEHICLE SECTION */}
      <Card className="border-border bg-card text-foreground">
          <CardHeader className="border-b border-border/30 pb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Truck className="h-5 w-5 text-primary" />
                Select Vehicle
              </CardTitle>
              <CardDescription>Select a vehicle first to view available booking slots.</CardDescription>
            </div>
            {/* Clickable Vehicle Counts */}
            <div className="flex items-center gap-3 bg-muted/20 p-1.5 rounded-xl border border-border/40 text-xs shrink-0 font-bold">
              <button 
                type="button"
                onClick={() => setVehicleFilter("ALL")}
                className={cn(
                  "px-3 py-1.5 rounded-lg transition-all cursor-pointer",
                  vehicleFilter === "ALL" 
                    ? "bg-primary text-white shadow-sm" 
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                All ({vehicles.length})
              </button>
              <button 
                type="button"
                onClick={() => setVehicleFilter("AVAILABLE")}
                className={cn(
                  "px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1",
                  vehicleFilter === "AVAILABLE" 
                    ? "bg-green-600 text-white shadow-sm" 
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
                Available ({availableCount})
              </button>
              <button 
                type="button"
                onClick={() => setVehicleFilter("ON_TRIP")}
                className={cn(
                  "px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1",
                  vehicleFilter === "ON_TRIP" 
                    ? "bg-blue-600 text-white shadow-sm" 
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
                On-Trip ({onTripCount})
              </button>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
              {filteredVehicles.map((car) => {
                const isAssigned = assignedVehicle?.id === car.id;
                const isSelected = selectedVehicle?.id === car.id;
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
                      isSelected
                        ? "border-2 border-primary bg-primary/5 ring-2 ring-primary/25 shadow-md scale-[1.01]"
                        : isAssigned
                          ? "border-amber-500/60 bg-amber-500/5 hover:border-amber-500 hover:shadow-xs"
                          : "border-border bg-card hover:border-primary/40 hover:bg-muted/10 hover:shadow-xs"
                    )}
                  >
                    {/* Top Rectangular Image */}
                    <div className="relative w-full h-28 sm:h-32 bg-muted/20 overflow-hidden border-b border-border/40">
                      {carImg ? (
                        <img 
                          src={carImg} 
                          alt={car.name} 
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" 
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground/40 gap-1 bg-muted/10">
                          <Truck className="h-8 w-8" />
                          <span className="text-[10px] font-medium">No photo</span>
                        </div>
                      )}

                      {/* Top Badges */}
                      <div className="absolute top-2 left-2 right-2 flex items-center justify-between pointer-events-none">
                        {isAssigned ? (
                          <span className="text-[9px] bg-amber-500 text-zinc-950 font-black px-1.5 py-0.5 rounded shadow-xs uppercase tracking-wider">
                            Assigned
                          </span>
                        ) : <span />}

                        {isSelected && (
                          <span className="text-[9px] bg-primary text-white font-black px-1.5 py-0.5 rounded shadow-xs uppercase tracking-wider">
                            Active
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Bottom Info: Title and Plate */}
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
              {filteredVehicles.length === 0 && (
                <div className="col-span-full py-8 text-center text-xs text-muted-foreground italic">
                  No vehicles in this category.
                </div>
              )}
            </div>
          </CardContent>
        </Card>

      {/* 2. BOOKING SLOT SECTION */}
      {selectedVehicle && (
        <Card className="border-border bg-card text-foreground">
          <CardHeader className="border-b border-border/30 pb-4">
            <div className="space-y-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Truck className="h-5 w-5 text-primary" />
                  Booking Slot
                </CardTitle>
                <div className="text-xs text-muted-foreground mt-1.5 font-medium">
                  Active Vehicle: <span className="font-bold text-primary font-mono">{selectedVehicle.name} ({selectedVehicle.vehicleNumber})</span>
                </div>
              </div>

              {/* Big Car Image & Small Change Vehicle Button */}
              <div className="flex flex-col items-center pt-1 w-full">
                {(selectedVehicle as any).imageUrl ? (
                  <div className="w-full max-w-md rounded-2xl overflow-hidden border border-border/80 shadow-sm bg-muted/10 relative group flex items-center justify-center p-1">
                    <img 
                      src={(selectedVehicle as any).imageUrl} 
                      alt={selectedVehicle.name} 
                      className="w-full h-auto max-h-60 sm:max-h-72 object-contain rounded-xl cursor-zoom-in transition-transform duration-300 group-hover:scale-[1.02]" 
                      loading="lazy"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActivePreviewImage((selectedVehicle as any).imageUrl);
                      }}
                      onMouseEnter={() => handleMouseEnter((selectedVehicle as any).imageUrl)}
                      onMouseLeave={handleMouseLeave}
                      onMouseMove={handleMouseMove}
                    />
                  </div>
                ) : (
                  <div className="w-full max-w-md h-48 rounded-2xl bg-muted/30 border border-border flex flex-col items-center justify-center gap-2 text-muted-foreground">
                    <Truck className="h-12 w-12 opacity-50" />
                    <span className="text-xs font-semibold">No Image Available</span>
                  </div>
                )}

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedVehicle(null);
                    setBookingTimes({
                      startTime: "",
                      endTime: "",
                      pickup: locationsList[0]?.name || DEFAULT_BOOKING_LOCATIONS[0].name,
                      destination: locationsList[0]?.name || DEFAULT_BOOKING_LOCATIONS[0].name,
                      purpose: "Corporate Duty",
                      notes: "",
                    });
                    setClickedBookedSlot(null);
                  }}
                  className="h-6 px-3 text-[10px] font-semibold mt-2.5 rounded-md border-border text-foreground hover:bg-muted/40 shadow-2xs cursor-pointer"
                >
                  Change Vehicle
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            {/* Date Selector Row */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Select Date</span>
                <div className="flex items-center gap-2">
                  {/* Live refresh indicator */}
                  {mounted && (
                    <span className="text-[9px] text-muted-foreground">
                      Updated {lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                  {/* Calendar icon — toggles between 7-day strip and full date picker */}
                  {/* Calendar icon — opens calendar picker modal */}
                  <div className="relative">
                    <button
                      type="button"
                      title="Open calendar to pick any date"
                      onClick={handleOpenCalendar}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer shadow-xs",
                        showAllDates
                          ? "border-primary bg-primary text-white shadow-sm"
                          : "border-border bg-card text-foreground hover:border-primary/40 hover:text-primary"
                      )}
                    >
                      <CalendarDays className="h-4 w-4" />
                      <span>All Dates</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* 7-Day Window Strip: Displays 3 days before and 3 days after the selected date */}
              <div className="flex gap-2 overflow-x-auto pb-2 pt-1 scrollbar-none items-center w-full">
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
                        "flex flex-col items-center justify-between p-2 sm:p-2.5 min-w-[62px] sm:min-w-[66px] h-[76px] sm:h-[80px] rounded-xl border transition-all cursor-pointer shrink-0 flex-1",
                        isSelected
                          ? "border-primary bg-primary/10 text-primary font-bold shadow-md glow-primary ring-1 ring-primary/40"
                          : isPast
                          ? "border-border/30 bg-muted/5 text-muted-foreground/40 hover:text-foreground/80 hover:border-border"
                          : "border-border bg-card text-muted-foreground hover:text-foreground hover:border-primary/30"
                      )}
                    >
                      <span className="text-[9px] uppercase font-bold tracking-wider">{monthStr}</span>
                      <span className="text-lg font-extrabold tracking-tight">{dayNum}</span>
                      <span className={cn("text-[9px] font-semibold", isToday && !isSelected && "text-primary font-bold")}>
                        {isToday ? "TODAY" : dayName}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Calendar Modal Dialog for All Dates Selection */}
            {showAllDates && (
              <Dialog
                isOpen={showAllDates}
                onClose={() => setShowAllDates(false)}
                title="Select Booking Date"
                className="max-w-md w-full"
              >
                <div className="space-y-4 text-foreground p-1">
                  <p className="text-xs text-muted-foreground">
                    Select any date from the calendar to view vehicle booking slots for that day. Selecting a date will display <strong>3 days before</strong> and <strong>3 days after</strong> your chosen date.
                  </p>
                  <div className="flex flex-col items-center justify-center p-4 bg-muted/20 border border-border/40 rounded-xl space-y-3">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Calendar Date Picker</label>
                    <input
                      type="date"
                      className="w-full p-3 rounded-xl border border-border bg-input text-foreground font-semibold text-sm focus:ring-2 focus:ring-primary focus:outline-none cursor-pointer"
                      value={mounted ? selectedDate.toISOString().split('T')[0] : ""}
                      onClick={(e) => {
                        try {
                          if ("showPicker" in HTMLInputElement.prototype) {
                            e.currentTarget.showPicker();
                          }
                        } catch {
                          // ignore
                        }
                      }}
                      onChange={(e) => {
                        if (e.target.value) {
                          const [y, m, d] = e.target.value.split('-').map(Number);
                          const picked = new Date(y, m - 1, d);
                          setSelectedDate(picked);
                          setClickedBookedSlot(null);
                          setShowAllDates(false);
                        }
                      }}
                    />
                  </div>
                  <div className="flex justify-between items-center pt-3 border-t border-border">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedDate(new Date());
                        setClickedBookedSlot(null);
                        setShowAllDates(false);
                      }}
                      className="text-xs font-semibold"
                    >
                      Today
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => setShowAllDates(false)}
                      className="bg-primary text-white text-xs font-semibold"
                    >
                      Close Calendar
                    </Button>
                  </div>
                </div>
              </Dialog>
            )}

            {activeVehicleForDisplay && (
              <>

              {/* From & To time fields */}
              <div className="grid grid-cols-2 gap-4 border-t border-border/30 pt-4">
                {/* From Card */}
                <div 
                  onClick={() => setActiveField("from")}
                  className={cn(
                    "relative border rounded-xl p-4 flex flex-col justify-between shadow-sm cursor-pointer transition-all",
                    activeField === "from"
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-border bg-card hover:border-primary/50 text-muted-foreground"
                  )}
                >
                  <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">From</span>
                  <div className="flex items-center gap-2.5 mt-1.5">
                    <Clock className="h-5 w-5 text-muted-foreground/60" />
                    <span className="text-base font-extrabold text-foreground">
                      {mounted && bookingTimes.startTime ? formatTo24Hour(bookingTimes.startTime) : "HH:MM"}
                    </span>
                  </div>
                </div>

                {/* To Card */}
                <div 
                  onClick={() => setActiveField("to")}
                  className={cn(
                    "relative border rounded-xl p-4 flex flex-col justify-between shadow-sm cursor-pointer transition-all",
                    activeField === "to"
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-border bg-card hover:border-primary/50 text-muted-foreground"
                  )}
                >
                  <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">To</span>
                  <div className="flex items-center gap-2.5 mt-1.5">
                    <Clock className="h-5 w-5 text-muted-foreground/60" />
                    <span className="text-base font-extrabold text-foreground">
                      {mounted && bookingTimes.endTime ? formatTo24Hour(bookingTimes.endTime) : "HH:MM"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Selection Reset Button */}
              {(bookingTimes.startTime || bookingTimes.endTime) && (
                <div className="flex justify-end pt-1">
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      setBookingTimes({
                        ...bookingTimes,
                        startTime: "",
                        endTime: "",
                      });
                      setClickedBookedSlot(null);
                      setActiveField("from");
                    }}
                    className="text-[10px] h-7 px-3 font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
                  >
                    Clear Time Selection
                  </Button>
                </div>
              )}

              {/* Time Slots Grid — shows only future slots */}
              <div className="space-y-2.5 border-t border-border/30 pt-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Select Time Slot</span>
                    <span className="text-[10px] text-muted-foreground italic ml-2">
                      ({slotsList.length} slot{slotsList.length !== 1 ? 's' : ''} available)
                    </span>
                  </div>

                  {/* Visual Color Legend */}
                  <div className="flex flex-wrap items-center gap-2.5 text-[10px]">
                    <div className="flex items-center gap-1">
                      <span className="h-2.5 w-2.5 rounded-sm border-2 border-emerald-500 bg-emerald-500/20" />
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">Selected</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="h-2.5 w-2.5 rounded-sm border-2 border-amber-500 bg-amber-500/20" />
                      <span className="font-semibold text-amber-600 dark:text-amber-400">Your Booking</span>
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

                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2 max-h-64 overflow-y-auto pr-1">
                  {slotsList.map((slot, index) => {
                    const booking = isSlotBooked(slot);
                    const isBooked = !!booking;
                    const isMyBooking = isBooked && ((booking as any).driverId === driver.id || (booking as any).driver?.id === driver.id);
                    const isOtherBooking = isBooked && !isMyBooking;
                    const slotStart = new Date(slot.startStr).getTime();
                    const isSelected = !isBooked && (bookingTimes.startTime && bookingTimes.endTime
                      ? (slotStart >= new Date(bookingTimes.startTime).getTime() && slotStart <= new Date(bookingTimes.endTime).getTime())
                      : (bookingTimes.startTime === slot.startStr || bookingTimes.endTime === slot.startStr));
                    
                    return (
                      <button
                        key={index}
                        type="button"
                        disabled={isOtherBooking}
                        title={
                          isMyBooking
                            ? "Your booking (Click to view details)"
                            : isOtherBooking
                              ? `Booked by ${(booking as any)?.driver?.name || (booking as any)?.requestedBy || 'another driver'}`
                              : `Available slot ${slot.labelFormatted}`
                        }
                        onClick={() => {
                          if (isMyBooking) {
                            setClickedBookedSlot(booking);
                          } else if (!isOtherBooking) {
                            handleSlotClick(slot);
                          }
                        }}
                        className={cn(
                          "p-2 rounded-xl border flex flex-col items-center justify-center text-center transition-all h-[52px]",
                          isSelected
                            ? "border-2 border-emerald-500 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold shadow-xs ring-2 ring-emerald-500/20 cursor-pointer"
                            : isMyBooking
                              ? "border-2 border-amber-500 bg-amber-500/15 text-amber-600 dark:text-amber-400 font-bold shadow-xs hover:bg-amber-500/25 cursor-pointer"
                              : isOtherBooking
                                ? "border border-red-500/25 bg-red-500/10 text-red-500 dark:text-red-400 cursor-not-allowed opacity-75"
                                : "border border-slate-200 dark:border-slate-800 bg-card hover:border-primary/50 hover:bg-primary/5 text-foreground cursor-pointer"
                        )}
                      >
                        <span className="text-xs font-bold leading-tight">{slot.labelFormatted}</span>
                        {isMyBooking && <span className="text-[8px] mt-0.5 font-bold uppercase tracking-wider leading-none">Your booking</span>}
                        {isOtherBooking && <span className="text-[8px] mt-0.5 font-semibold opacity-90 leading-none">Booked</span>}
                        {isSelected && <span className="text-[8px] mt-0.5 font-bold uppercase tracking-wider leading-none">Selected</span>}
                      </button>
                    );
                  })}
                </div>

                {clickedBookedSlot && (
                  <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl text-xs text-foreground space-y-2 mt-3 animate-fade-in">
                    <h4 className="font-bold text-red-500 flex items-center gap-1">🚨 Slot Reservation Details</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 pt-1">
                      <div>
                        <span className="text-muted-foreground block">Booked By</span>
                        <span className="font-semibold text-foreground">{clickedBookedSlot.driver?.name || clickedBookedSlot.requestedBy || "N/A"}</span>
                      </div>
                      {clickedBookedSlot.driver?.employeeId && (
                        <div>
                          <span className="text-muted-foreground block">Employee ID</span>
                          <span className="font-semibold text-foreground">{clickedBookedSlot.driver.employeeId}</span>
                        </div>
                      )}
                      <div>
                        <span className="text-muted-foreground block">Trip Purpose</span>
                        <span className="font-semibold text-foreground">{clickedBookedSlot.purpose || "—"}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block">Booking Schedule</span>
                        <span className="font-semibold text-foreground">
                          {new Date(clickedBookedSlot.startTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: false})} - {new Date(clickedBookedSlot.endTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: false})}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Manual Time Selection Form */}
              <form onSubmit={handleBookingSubmit} className="space-y-4 border-t border-border/30 pt-4">
                {bookingError && (
                  <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-xl text-xs text-red-500 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <p>{bookingError}</p>
                  </div>
                )}
                {bookingSuccess && (
                  <div className="bg-green-500/10 border border-green-500/20 p-3 rounded-xl text-xs text-green-500 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <p>{bookingSuccess}</p>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Pickup Location */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-muted-foreground">Pickup Location</label>
                      {isCustomPickup && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsCustomPickup(false);
                            setBookingTimes({
                              ...bookingTimes,
                              pickup: locationsList[0]?.name || DEFAULT_BOOKING_LOCATIONS[0].name,
                            });
                          }}
                          className="text-[10px] text-primary hover:underline font-semibold"
                        >
                          Select preset
                        </button>
                      )}
                    </div>
                    {!isCustomPickup ? (
                      <select
                        value={bookingTimes.pickup}
                        onChange={(e) => {
                          if (e.target.value === "__custom__") {
                            setIsCustomPickup(true);
                            setBookingTimes({ ...bookingTimes, pickup: "" });
                          } else {
                            setBookingTimes({ ...bookingTimes, pickup: e.target.value });
                          }
                        }}
                        className="w-full h-10 rounded-xl border border-input bg-card px-3 text-xs font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer"
                        required
                      >
                        {locationsList
                          .filter((l) => l.type === "pickup" || l.type === "both")
                          .map((loc) => (
                            <option key={loc.id} value={loc.name}>
                              {loc.name}
                            </option>
                          ))}
                        <option value="__custom__">+ Other / Enter Custom...</option>
                      </select>
                    ) : (
                      <Input
                        type="text"
                        placeholder="Type custom pickup location..."
                        value={bookingTimes.pickup}
                        onChange={(e) => setBookingTimes({ ...bookingTimes, pickup: e.target.value })}
                        className="focus-visible:ring-primary text-xs h-10 rounded-xl"
                        autoFocus
                        required
                      />
                    )}
                  </div>

                  {/* Drop Location */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-muted-foreground">Drop Location</label>
                      {isCustomDrop && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsCustomDrop(false);
                            setBookingTimes({
                              ...bookingTimes,
                              destination: locationsList[0]?.name || DEFAULT_BOOKING_LOCATIONS[0].name,
                            });
                          }}
                          className="text-[10px] text-primary hover:underline font-semibold"
                        >
                          Select preset
                        </button>
                      )}
                    </div>
                    {!isCustomDrop ? (
                      <select
                        value={bookingTimes.destination}
                        onChange={(e) => {
                          if (e.target.value === "__custom__") {
                            setIsCustomDrop(true);
                            setBookingTimes({ ...bookingTimes, destination: "" });
                          } else {
                            setBookingTimes({ ...bookingTimes, destination: e.target.value });
                          }
                        }}
                        className="w-full h-10 rounded-xl border border-input bg-card px-3 text-xs font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer"
                        required
                      >
                        {locationsList
                          .filter((l) => l.type === "drop" || l.type === "both")
                          .map((loc) => (
                            <option key={loc.id} value={loc.name}>
                              {loc.name}
                            </option>
                          ))}
                        <option value="__custom__">+ Other / Enter Custom...</option>
                      </select>
                    ) : (
                      <Input
                        type="text"
                        placeholder="Type custom drop location..."
                        value={bookingTimes.destination}
                        onChange={(e) => setBookingTimes({ ...bookingTimes, destination: e.target.value })}
                        className="focus-visible:ring-primary text-xs h-10 rounded-xl"
                        autoFocus
                        required
                      />
                    )}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Purpose of Booking</label>
                  <Input
                    type="text"
                    placeholder="e.g. Airport Pickup"
                    value={bookingTimes.purpose}
                    onChange={(e) => setBookingTimes({ ...bookingTimes, purpose: e.target.value })}
                    className="focus-visible:ring-primary text-xs h-10"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Notes (Optional)</label>
                  <textarea
                    className="flex min-h-[50px] w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-primary text-xs"
                    placeholder="Add notes for the trip..."
                    value={bookingTimes.notes}
                    onChange={(e) => setBookingTimes({ ...bookingTimes, notes: e.target.value })}
                  />
                </div>

                <div className="flex justify-end pt-2 border-t border-border/30">
                  <Button 
                    type="submit" 
                    className="bg-primary text-white font-bold h-10 shadow-sm hover:glow-primary px-6 text-xs"
                    disabled={isPending}
                  >
                    {isPending ? "Confirming..." : "Confirm Booking"}
                  </Button>
                </div>
              </form>
            </>
          )}
        </CardContent>
      </Card>
      )}

      {/* Booking History & Schedule */}
      {(() => {
        const now = new Date();
        const allHistoryBookings = (() => {
          const base = driverBookings && driverBookings.length > 0 ? driverBookings : bookings.filter((b) => b.driverId === driver.id);
          const map = new Map<string, typeof base[0]>();
          base.forEach((b) => map.set(b.id, b));
          return Array.from(map.values()).sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
        })();

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
          <div className="space-y-4 w-full text-foreground">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/30 pb-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-lg sm:text-xl font-bold">
                  <Calendar className="h-5 w-5 text-primary" />
                  <span>{t("my_bookings_schedule")}</span>
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
                const canCancelDirectly = diffHours >= 12 && isUpcoming;
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
                            <span>&lt;12h to start</span>
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
                    <div className="rounded-2xl border border-border/70 bg-muted/10 p-3 sm:p-3.5 flex items-center gap-3.5 shadow-xs">
                      {(b.vehicle as any)?.imageUrl ? (
                        <img 
                          src={(b.vehicle as any).imageUrl} 
                          alt={b.vehicle?.name} 
                          className="w-20 h-20 sm:w-22 sm:h-22 rounded-xl object-cover border border-border shrink-0 cursor-zoom-in" 
                          loading="lazy"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActivePreviewImage((b.vehicle as any).imageUrl);
                          }}
                          onMouseEnter={() => handleMouseEnter((b.vehicle as any).imageUrl)}
                          onMouseLeave={handleMouseLeave}
                          onMouseMove={handleMouseMove}
                        />
                      ) : (
                        <div className="w-20 h-20 sm:w-22 sm:h-22 rounded-xl bg-muted flex items-center justify-center border border-border shrink-0">
                          <Truck className="h-8 w-8 text-muted-foreground" />
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
                          <Calendar className="h-5 w-5 text-muted-foreground/80 shrink-0" />
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
                                  if (res.requiresSupport) {
                                    setSupportBooking(b);
                                  } else {
                                    alert(res.error);
                                  }
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
                        <button
                          type="button"
                          onClick={() => setSupportBooking(b)}
                          className="w-full rounded-2xl border border-amber-400 bg-amber-50/60 hover:bg-amber-100/70 dark:bg-amber-950/20 dark:hover:bg-amber-900/30 py-3 px-3 sm:px-4 flex items-center justify-center gap-2 sm:gap-2.5 transition-all cursor-pointer shadow-xs active:scale-[0.99]"
                        >
                          <Headphones className="h-5 w-5 text-amber-500 shrink-0" />
                          <div className="h-4 sm:h-5 w-px bg-amber-300 dark:bg-amber-700 shrink-0" />
                          <span className="text-amber-600 dark:text-amber-400 font-bold text-[11px] min-[370px]:text-xs sm:text-sm whitespace-nowrap">
                            Contact Admin Support to Cancel
                          </span>
                        </button>
                      )
                    )}

                    {/* Completed indicator */}
                    {b.status === "COMPLETED" && (
                      <div className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
                        <CheckCircle2 className="h-4 w-4 shrink-0" />
                        <span>Completed Duty · Vehicle safely returned</span>
                      </div>
                    )}

                    {/* Cancelled indicator */}
                    {b.status === "CANCELLED" && (
                      <div className="flex items-center gap-2 p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-semibold">
                        <XCircle className="h-4 w-4 shrink-0" />
                        <span>Booking Cancelled</span>
                      </div>
                    )}
                  </div>
                );
              })}

              {filteredHistory.length === 0 && (
                <div className="text-center py-10 px-4 border border-dashed border-border/70 rounded-3xl bg-card space-y-2.5">
                  <Calendar className="h-8 w-8 text-muted-foreground/50 mx-auto" />
                  <p className="text-sm font-semibold text-foreground">
                    {historyFilter === "UPCOMING" ? t("no_upcoming_bookings") : "No bookings found in this category"}
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

      {/* Contact Support Cancellation Modal */}
      {supportBooking && (
        <Dialog
          isOpen={!!supportBooking}
          onClose={() => setSupportBooking(null)}
          title="Cancellation Restricted (<12 Hours)"
          className="max-w-md"
        >
          <div className="space-y-4">
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 flex items-start gap-3 shadow-sm">
              <ShieldAlert className="h-6 w-6 text-amber-500 shrink-0 mt-0.5" />
              <div className="space-y-1 text-xs">
                <h4 className="font-bold text-sm">Direct System Cancellation Disabled</h4>
                <p className="leading-relaxed">
                  Bookings starting within 12 hours cannot be cancelled directly through the system. Scheduled start time:{" "}
                  <strong>
                    {new Date(supportBooking.startTime).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: false,
                    })} ({new Date(supportBooking.startTime).toLocaleDateString()})
                  </strong>.
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-muted/20 border border-border/60 text-xs space-y-2">
              <div className="flex justify-between border-b border-border/40 pb-1.5">
                <span className="text-muted-foreground font-semibold">Trip Reference:</span>
                <span className="font-mono font-bold text-primary">{supportBooking.tripNumber}</span>
              </div>
              <div className="flex justify-between border-b border-border/40 pb-1.5">
                <span className="text-muted-foreground font-semibold">Assigned Vehicle:</span>
                <span className="font-semibold text-foreground">
                  {supportBooking.vehicle?.name || "Vehicle"} ({supportBooking.vehicle?.vehicleNumber || "—"})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground font-semibold">Time Remaining to Start:</span>
                <span className="font-bold text-amber-500">
                  {Math.max(
                    0,
                    Math.round(
                      ((new Date(supportBooking.startTime).getTime() - new Date().getTime()) / (1000 * 60 * 60)) * 10
                    ) / 10
                  )}{" "}
                  Hours Remaining
                </span>
              </div>
            </div>

            <div className="space-y-2.5 pt-1">
              <span className="text-xs font-bold text-foreground block">
                Please contact Admin Support to request cancellation:
              </span>
              <div className="space-y-2">
                {/* Contact admin support */}
                <a
                  href="tel:+358417297334"
                  className="flex items-center justify-between p-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors shadow-sm"
                >
                  <div className="flex items-center gap-2.5">
                    <PhoneCall className="h-4 w-4 shrink-0" />
                    <span>Contact Admin Support</span>
                  </div>
                  <span className="font-mono text-emerald-100 text-xs tracking-tight">+358 41 7297334</span>
                </a>

                {/* Connect WhatsApp */}
                <a
                  href={`https://wa.me/358417297334?text=${encodeURIComponent(
                    `Hello Admin Support, I need to request cancellation for Trip #${supportBooking.tripNumber} (${supportBooking.vehicle?.name || "Vehicle"} - ${supportBooking.vehicle?.vehicleNumber || ""}).`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-3 rounded-xl bg-[#25D366] hover:bg-[#20ba59] text-white font-bold text-xs transition-colors shadow-sm"
                >
                  <div className="flex items-center gap-2.5">
                    <MessageCircle className="h-4 w-4 shrink-0" />
                    <span>Connect WhatsApp</span>
                  </div>
                  <span className="font-mono text-white/95 text-xs tracking-tight">+358 41 7297334</span>
                </a>

                {/* Email Support */}
                <a
                  href={`mailto:support@smartforcetaxi.com?subject=Urgent%20Cancellation%20Request%20${supportBooking.tripNumber}`}
                  className="flex items-center justify-center gap-2 p-2.5 rounded-xl border border-border bg-card hover:bg-accent text-foreground font-semibold text-xs transition-colors"
                >
                  <Mail className="h-4 w-4 text-primary" /> Email Support
                </a>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-border">
              <Button variant="outline" onClick={() => setSupportBooking(null)} className="text-xs font-semibold">
                Close
              </Button>
            </div>
          </div>
        </Dialog>
      )}

      {/* Weekly Log Upload Reminder Dialog */}
      {showSundayPopup && !isLogSubmittedThisWeek && (
      <Dialog 
        isOpen={showSundayPopup} 
        onClose={() => {
          sessionStorage.setItem("weekly_log_popup_dismissed", "true");
          setShowSundayPopup(false);
        }} 
        title="Weekly Log Screenshot Reminder"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-6 w-6 text-amber-500 shrink-0 mt-0.5 animate-bounce" />
            <div>
              <h4 className="font-bold text-foreground">Weekly Screenshot Log Required</h4>
              <p className="text-xs text-muted-foreground mt-1">
                Your weekly work statement screenshot for this week (Monday to Monday) has not been submitted yet. Please capture and upload your work screenshot log.
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t border-border pt-4 mt-6">
            <Button 
              variant="outline" 
              onClick={() => {
                sessionStorage.setItem("weekly_log_popup_dismissed", "true");
                setShowSundayPopup(false);
              }}
            >
              Remind Me Later
            </Button>
            <Button 
              onClick={() => {
                sessionStorage.setItem("weekly_log_popup_dismissed", "true");
                setShowSundayPopup(false);
                router.push("/driver/weekly-log");
              }} 
              className="bg-primary text-white font-semibold"
            >
              Upload Log Now
            </Button>
          </div>
        </div>
      </Dialog>
      )}

      {hoveredImage && (
        <div 
          className="fixed z-50 pointer-events-none p-1.5 bg-card border border-border rounded-xl shadow-2xl transition-opacity duration-200 hidden lg:block"
          style={{
            left: `${mousePos.x + 15}px`,
            top: `${mousePos.y + 15}px`,
            transform: 'translate3d(0, 0, 0)',
          }}
        >
          <img 
            src={hoveredImage} 
            alt="Preview" 
            className="w-48 h-48 object-cover rounded-lg" 
          />
        </div>
      )}

      {activePreviewImage && (
        <Dialog 
          isOpen={!!activePreviewImage} 
          onClose={() => setActivePreviewImage(null)} 
          title="Vehicle Image Preview"
        >
          <div className="flex items-center justify-center p-2">
            <img 
              src={activePreviewImage} 
              alt="Vehicle Full Preview" 
              className="max-w-full max-h-[70vh] object-contain rounded-lg border border-border" 
            />
          </div>
        </Dialog>
      )}

    </div>
  );
}
