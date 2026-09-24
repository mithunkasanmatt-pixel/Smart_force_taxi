"use client";

import React, { useState, useMemo, useCallback } from "react";
import {
  Award,
  TrendingUp,
  TrendingDown,
  Clock,
  Trophy,
  Star,
  AlertTriangle,
  CheckCircle2,
  Plus,
  Search,
  DollarSign,
  UserCheck,
  Trash2,
  Calendar,
  CalendarDays,
  X,
  Sparkles,
  Zap,
  Lock,
  Unlock,
  ChevronLeft,
  ChevronRight,
  ListFilter,
  FileSpreadsheet,
} from "lucide-react";
import { cn } from "@/utils/cn";
import { Button } from "@/components/ui/button";
import {
  verifyDriverHoursAction,
  grantDriverBonusRewardAction,
  deleteDriverPerformanceAction,
} from "@/actions/driver-performance";

function getLocalWeekDetails(d: Date = new Date()) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return {
    year: date.getUTCFullYear(),
    weekNumber: weekNo,
    weekLabel: `Week ${weekNo}, ${date.getUTCFullYear()}`,
  };
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatTimeString(dateInput: Date | string): string {
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return "";
  let hours = d.getHours();
  const minutes = d.getMinutes();
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  hours = hours ? hours : 12;
  const minutesStr = minutes < 10 ? `0${minutes}` : `${minutes}`;
  const hoursStr = hours < 10 ? `0${hours}` : `${hours}`;
  return `${hoursStr}:${minutesStr} ${ampm}`;
}

function formatDateString(dateInput: Date | string): string {
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return "";
  return `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

function formatShortDateString(dateInput: Date | string): string {
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return "";
  return `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`;
}

function getWeekDateRange(weekNumber: number, year: number) {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const dayOfWeek = jan4.getUTCDay() || 7;
  const firstMonday = new Date(jan4);
  firstMonday.setUTCDate(jan4.getUTCDate() - dayOfWeek + 1);

  const targetMonday = new Date(firstMonday);
  targetMonday.setUTCDate(firstMonday.getUTCDate() + (weekNumber - 1) * 7);

  const targetSunday = new Date(targetMonday);
  targetSunday.setUTCDate(targetMonday.getUTCDate() + 6);

  const startStr = `${MONTH_NAMES[targetMonday.getUTCMonth()]} ${targetMonday.getUTCDate()}`;
  const endStr = `${MONTH_NAMES[targetSunday.getUTCMonth()]} ${targetSunday.getUTCDate()}, ${targetSunday.getUTCFullYear()}`;

  return `${startStr} - ${endStr}`;
}

function getWeekRangeFromDate(d: Date) {
  const date = new Date(d);
  const day = date.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(date);
  monday.setDate(date.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  return { monday, sunday };
}

interface Driver {
  id: string;
  name: string;
  email: string;
  employeeId: string;
  phone?: string | null;
  experience?: number | null;
  assignedVehicle?: {
    name: string;
    vehicleNumber: string;
  } | null;
}

interface Trip {
  id: string;
  tripNumber?: string | null;
  driverId?: string | null;
  vehicleId?: string | null;
  startTime: Date | string;
  endTime: Date | string;
  status: string;
  pickup?: string | null;
  destination?: string | null;
  purpose?: string | null;
  actualHours?: number | null;
  assignedBy?: string | null;
  requestedBy?: string | null;
  driver?: Driver | null;
  vehicle?: {
    name: string;
    vehicleNumber: string;
  } | null;
}

interface PerformanceRecord {
  id: string;
  driverId: string;
  periodType: string;
  weekLabel?: string | null;
  weekNumber?: number | null;
  month?: number | null;
  year: number;
  bookedHours: number;
  actualHours: number;
  performanceRatio: number;
  score: number;
  status: string;
  rewardEligible: boolean;
  rewardGranted: boolean;
  rewardTitle?: string | null;
  rewardAmount?: number | null;
  verifiedBy?: string | null;
  verifiedAt: Date | string;
  notes?: string | null;
  driver?: Driver;
}

interface PerformanceMetricsClientProps {
  initialDrivers: Driver[];
  initialTrips: Trip[];
  initialPerformanceRecords: PerformanceRecord[];
  currentUserName: string;
}

function MonthCalendarView({
  currentMonth,
  onMonthChange,
  selectedDate,
  onSelectDate,
  bookingDates,
}: {
  currentMonth: Date;
  onMonthChange: (d: Date) => void;
  selectedDate: Date;
  onSelectDate: (d: Date) => void;
  bookingDates: Set<string>;
}) {
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  const firstDay = new Date(year, month, 1);
  const startWeekday = (firstDay.getDay() + 6) % 7; // Mon=0, Sun=6
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const prevMonth = () => onMonthChange(new Date(year, month - 1, 1));
  const nextMonth = () => onMonthChange(new Date(year, month + 1, 1));

  const monthYearStr = currentMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const isSameDay = (d1: Date, d2: Date) =>
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();

  const formatDateKey = (year: number, month: number, day: number) => {
    const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
    return `${year}-${pad(month + 1)}-${pad(day)}`;
  };

  const daysGrid: (Date | null)[] = [];
  for (let i = 0; i < startWeekday; i++) {
    daysGrid.push(null);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    daysGrid.push(new Date(year, month, day));
  }

  return (
    <div className="bg-muted/30 border border-border rounded-xl p-3.5 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-bold text-foreground text-xs flex items-center gap-2">
          <Calendar className="h-4 w-4 text-primary" />
          {monthYearStr}
        </h4>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={prevMonth}
            className="p-1 rounded-lg border border-border hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => {
              const now = new Date();
              onMonthChange(now);
              onSelectDate(now);
            }}
            className="px-2 py-0.5 text-[11px] font-semibold rounded-lg border border-border hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
          >
            Today
          </button>
          <button
            type="button"
            onClick={nextMonth}
            className="p-1 rounded-lg border border-border hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-muted-foreground uppercase">
        <div>Mon</div>
        <div>Tue</div>
        <div>Wed</div>
        <div>Thu</div>
        <div>Fri</div>
        <div>Sat</div>
        <div>Sun</div>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {daysGrid.map((dateItem, idx) => {
          if (!dateItem) {
            return <div key={`empty-${idx}`} className="h-8 rounded-lg bg-muted/10" />;
          }

          const isSelected = isSameDay(dateItem, selectedDate);
          const isToday = isSameDay(dateItem, new Date());
          const dateKey = formatDateKey(dateItem.getFullYear(), dateItem.getMonth(), dateItem.getDate());
          const hasBooking = bookingDates.has(dateKey);

          return (
            <button
              key={dateKey}
              type="button"
              onClick={() => onSelectDate(dateItem)}
              className={cn(
                "h-8 rounded-lg text-xs font-semibold transition-all relative flex flex-col items-center justify-center cursor-pointer",
                isSelected
                  ? "bg-primary text-primary-foreground font-bold shadow-sm"
                  : isToday
                  ? "border border-primary text-primary font-bold bg-primary/5"
                  : "bg-card text-foreground hover:bg-muted border border-border/40"
              )}
            >
              <span>{dateItem.getDate()}</span>
              {hasBooking && (
                <span
                  className={cn(
                    "h-1 w-1 rounded-full mt-0.5",
                    isSelected ? "bg-white" : "bg-primary"
                  )}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function PerformanceMetricsAdminClient({
  initialDrivers,
  initialTrips,
  initialPerformanceRecords,
  currentUserName,
}: PerformanceMetricsClientProps) {
  // Navigation Tabs for clean uncluttered layout
  const [activeTab, setActiveTab] = useState<"VERIFY" | "LEADERBOARD" | "HISTORY">("VERIFY");
  const [periodType, setPeriodType] = useState<"WEEKLY" | "MONTHLY" | "YEARLY">("WEEKLY");
  const [records, setRecords] = useState<PerformanceRecord[]>(initialPerformanceRecords);
  const [tripsState, setTripsState] = useState<Trip[]>(initialTrips);
  const [searchTerm, setSearchTerm] = useState("");
  const [isRewardModalOpen, setIsRewardModalOpen] = useState(false);
  const [selectedRecordForReward, setSelectedRecordForReward] = useState<PerformanceRecord | null>(null);

  const currentWeekInfo = useMemo(() => getLocalWeekDetails(), []);

  // Available week options for selector
  const weekOptions = useMemo(() => {
    const map = new Map<string, { weekNumber: number; year: number; weekLabel: string; rangeText: string }>();

    for (let i = 0; i <= 12; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i * 7);
      const details = getLocalWeekDetails(d);
      const key = `${details.year}-W${details.weekNumber}`;
      if (!map.has(key)) {
        const rangeStr = getWeekDateRange(details.weekNumber, details.year);
        map.set(key, {
          weekNumber: details.weekNumber,
          year: details.year,
          weekLabel: details.weekLabel,
          rangeText: `Week ${details.weekNumber}, ${details.year} (${rangeStr})`,
        });
      }
    }

    tripsState.forEach((t) => {
      const details = getLocalWeekDetails(new Date(t.startTime));
      const key = `${details.year}-W${details.weekNumber}`;
      if (!map.has(key)) {
        const rangeStr = getWeekDateRange(details.weekNumber, details.year);
        map.set(key, {
          weekNumber: details.weekNumber,
          year: details.year,
          weekLabel: details.weekLabel,
          rangeText: `Week ${details.weekNumber}, ${details.year} (${rangeStr})`,
        });
      }
    });

    initialPerformanceRecords.forEach((r) => {
      if (r.weekNumber && r.year) {
        const key = `${r.year}-W${r.weekNumber}`;
        if (!map.has(key)) {
          const rangeStr = getWeekDateRange(r.weekNumber, r.year);
          map.set(key, {
            weekNumber: r.weekNumber,
            year: r.year,
            weekLabel: r.weekLabel || `Week ${r.weekNumber}, ${r.year}`,
            rangeText: `Week ${r.weekNumber}, ${r.year} (${rangeStr})`,
          });
        }
      }
    });

    return Array.from(map.values()).sort((a, b) => {
      if (b.year !== a.year) return b.year - a.year;
      return b.weekNumber - a.weekNumber;
    });
  }, [tripsState, initialPerformanceRecords]);

  const [selectedWeekKey, setSelectedWeekKey] = useState<string>(() => {
    const c = getLocalWeekDetails();
    return `${c.year}-W${c.weekNumber}`;
  });

  const selectedWeekInfo = useMemo(() => {
    const match = weekOptions.find((w) => `${w.year}-W${w.weekNumber}` === selectedWeekKey);
    return (
      match ||
      weekOptions[0] || {
        weekNumber: currentWeekInfo.weekNumber,
        year: currentWeekInfo.year,
        weekLabel: currentWeekInfo.weekLabel,
        rangeText: currentWeekInfo.weekLabel,
      }
    );
  }, [weekOptions, selectedWeekKey, currentWeekInfo]);

  const [activeDriverIdForBreakdown, setActiveDriverIdForBreakdown] = useState<string>(
    initialDrivers[0]?.id || ""
  );

  // Verification Form State (Rendered directly inline on page)
  const [selectedDriverId, setSelectedDriverId] = useState<string>(initialDrivers[0]?.id || "");
  const [modalOption, setModalOption] = useState<"WEEKLY" | "MONTHLY">("WEEKLY");
  const [selectedModalWeekKey, setSelectedModalWeekKey] = useState<string>(selectedWeekKey);
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<Date>(new Date());
  const [currentCalendarMonth, setCurrentCalendarMonth] = useState<Date>(new Date());
  const [bookingActualHoursMap, setBookingActualHoursMap] = useState<Record<string, number>>({});
  const [inputNotes, setInputNotes] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Reward Form State
  const [rewardTitle, setRewardTitle] = useState<string>("Weekly Top Performer Bonus");
  const [rewardAmount, setRewardAmount] = useState<string>("150");
  const [rewardNotes, setRewardNotes] = useState<string>("");

  // Calculate automatically computed booked hours for a driver in a specific week
  const getDriverBookedHours = useCallback(
    (driverId: string, weekNo?: number, yr?: number) => {
      if (!driverId) return 0;
      const targetWeekNo = weekNo ?? selectedWeekInfo.weekNumber;
      const targetYear = yr ?? selectedWeekInfo.year;

      const driverTrips = tripsState.filter((t) => {
        if (t.driverId !== driverId || t.status === "CANCELLED") return false;
        const details = getLocalWeekDetails(new Date(t.startTime));
        return details.weekNumber === targetWeekNo && details.year === targetYear;
      });

      let totalMs = 0;
      driverTrips.forEach((trip) => {
        const start = new Date(trip.startTime).getTime();
        const end = new Date(trip.endTime).getTime();
        if (end > start) {
          totalMs += end - start;
        }
      });
      const hours = totalMs / (1000 * 60 * 60);
      return Math.round(hours * 10) / 10;
    },
    [tripsState, selectedWeekInfo]
  );

  // Calculate actual driving hours for a driver in a week
  const getDriverActualHours = useCallback(
    (driverId: string, weekNo?: number, yr?: number) => {
      if (!driverId) return 0;
      const targetWeekNo = weekNo ?? selectedWeekInfo.weekNumber;
      const targetYear = yr ?? selectedWeekInfo.year;

      const driverTrips = tripsState.filter((t) => {
        if (t.driverId !== driverId || t.status === "CANCELLED") return false;
        const details = getLocalWeekDetails(new Date(t.startTime));
        return details.weekNumber === targetWeekNo && details.year === targetYear;
      });

      const now = new Date();
      let totalActual = 0;
      driverTrips.forEach((t) => {
        const isCompleted = t.status === "COMPLETED" || new Date(t.endTime) <= now;
        if (t.actualHours !== undefined && t.actualHours !== null) {
          totalActual += t.actualHours;
        } else if (isCompleted) {
          const start = new Date(t.startTime).getTime();
          const end = new Date(t.endTime).getTime();
          if (end > start) {
            totalActual += (end - start) / (1000 * 60 * 60);
          }
        }
      });
      return Math.round(totalActual * 10) / 10;
    },
    [tripsState, selectedWeekInfo]
  );

  // Helper to check if driver has completed work for the week
  const checkDriverWorkCompleted = useCallback(
    (driverId: string, weekNo?: number, yr?: number) => {
      if (!driverId) return false;
      const targetWeekNo = weekNo ?? selectedWeekInfo.weekNumber;
      const targetYear = yr ?? selectedWeekInfo.year;
      const now = new Date();

      const driverTrips = tripsState.filter((t) => {
        if (t.driverId !== driverId || t.status === "CANCELLED") return false;
        const details = getLocalWeekDetails(new Date(t.startTime));
        return details.weekNumber === targetWeekNo && details.year === targetYear;
      });

      if (driverTrips.length === 0) return false;

      return driverTrips.some(
        (t) => t.status === "COMPLETED" || new Date(t.endTime) <= now
      );
    },
    [tripsState, selectedWeekInfo]
  );

  // Filter records by periodType & selected week
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      if (r.periodType !== periodType) return false;
      if (periodType === "WEEKLY") {
        return r.weekNumber === selectedWeekInfo.weekNumber && r.year === selectedWeekInfo.year;
      }
      return r.year === selectedWeekInfo.year;
    });
  }, [records, periodType, selectedWeekInfo]);

  // Compute Driver Performance Leaderboard (Ranked by Total Actual Driving Hours descending)
  const driverLeaderboard = useMemo(() => {
    return initialDrivers
      .map((driver) => {
        const driverRecord = filteredRecords.find((r) => r.driverId === driver.id);
        const computedBooked = getDriverBookedHours(driver.id);
        const computedActual = getDriverActualHours(driver.id);
        const booked = computedBooked > 0 ? computedBooked : (driverRecord ? driverRecord.bookedHours : 0);
        const actual = driverRecord ? driverRecord.actualHours : computedActual;
        const ratio = driverRecord ? driverRecord.performanceRatio : (booked > 0 && actual > 0 ? Math.round((actual / booked) * 1000) / 10 : 0);
        const score = driverRecord ? driverRecord.score : 0;
        const isVerified = Boolean(driverRecord);
        const isWorkCompleted = checkDriverWorkCompleted(driver.id);

        return {
          driver,
          performanceRecord: driverRecord,
          bookedHours: booked,
          actualHours: actual,
          ratio,
          score,
          isVerified,
          isWorkCompleted,
          rewardGranted: driverRecord?.rewardGranted || false,
          rewardAmount: driverRecord?.rewardAmount || 0,
          rewardTitle: driverRecord?.rewardTitle || "",
        };
      })
      .sort((a, b) => {
        // Ranking based on Total Actual Driving Hours: highest actual hours appears first
        if (b.actualHours !== a.actualHours) return b.actualHours - a.actualHours;
        if (b.bookedHours !== a.bookedHours) return b.bookedHours - a.bookedHours;
        return b.score - a.score;
      });
  }, [initialDrivers, filteredRecords, getDriverBookedHours, getDriverActualHours, checkDriverWorkCompleted]);

  // Identify Underperforming / Stagnant Drivers
  const stagnantDrivers = useMemo(() => {
    return initialDrivers
      .map((driver) => {
        const driverRecords = records
          .filter((r) => r.driverId === driver.id)
          .sort((a, b) => new Date(b.verifiedAt).getTime() - new Date(a.verifiedAt).getTime());

        if (driverRecords.length === 0) return null;

        const latest = driverRecords[0];
        const previous = driverRecords[1];

        const isLowPerformance = latest.performanceRatio < 75 || latest.score < 65;
        const isDecliningTrend =
          previous && latest.performanceRatio < previous.performanceRatio && latest.score < previous.score;

        if (isLowPerformance || isDecliningTrend) {
          return {
            driver,
            latestRecord: latest,
            previousRecord: previous,
            reason: isDecliningTrend
              ? `Performance ratio dropped by ${(previous.performanceRatio - latest.performanceRatio).toFixed(1)}% compared to previous period`
              : `Performance ratio (${latest.performanceRatio}%) is below expected standard threshold (85%)`,
          };
        }
        return null;
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
  }, [initialDrivers, records]);

  // Summary Metrics
  const verifiedCount = filteredRecords.length;
  const avgFleetScore = useMemo(() => {
    if (filteredRecords.length === 0) return 0;
    const sum = filteredRecords.reduce((acc, curr) => acc + curr.score, 0);
    return Math.round(sum / filteredRecords.length);
  }, [filteredRecords]);

  const totalRewardsAmount = useMemo(() => {
    return records.reduce((acc, curr) => acc + (curr.rewardAmount || 0), 0);
  }, [records]);

  // Inline verification active week info
  const modalWeekInfo = useMemo(() => {
    if (modalOption === "WEEKLY") {
      const match = weekOptions.find((w) => `${w.year}-W${w.weekNumber}` === selectedModalWeekKey);
      return match || selectedWeekInfo;
    } else {
      const { monday, sunday } = getWeekRangeFromDate(selectedCalendarDate);
      const details = getLocalWeekDetails(monday);
      const startStr = `${MONTH_NAMES[monday.getMonth()]} ${monday.getDate()}`;
      const endStr = `${MONTH_NAMES[sunday.getMonth()]} ${sunday.getDate()}, ${sunday.getFullYear()}`;
      return {
        weekNumber: details.weekNumber,
        year: details.year,
        weekLabel: details.weekLabel,
        rangeText: `Week ${details.weekNumber}, ${details.year} (${startStr} - ${endStr})`,
        monday,
        sunday,
      };
    }
  }, [modalOption, selectedModalWeekKey, weekOptions, selectedWeekInfo, selectedCalendarDate]);

  // Bookings for the selected driver during the inline section's active week
  const modalWeekBookings = useMemo(() => {
    if (!selectedDriverId) return [];

    let mondayDate: Date;
    let sundayDate: Date;

    if (modalOption === "WEEKLY") {
      const jan4 = new Date(Date.UTC(modalWeekInfo.year, 0, 4));
      const dayOfWeek = jan4.getUTCDay() || 7;
      const firstMonday = new Date(jan4);
      firstMonday.setUTCDate(jan4.getUTCDate() - dayOfWeek + 1);

      const targetMonday = new Date(firstMonday);
      targetMonday.setUTCDate(firstMonday.getUTCDate() + (modalWeekInfo.weekNumber - 1) * 7);

      const targetSunday = new Date(targetMonday);
      targetSunday.setUTCDate(targetMonday.getUTCDate() + 6);

      mondayDate = new Date(targetMonday.getUTCFullYear(), targetMonday.getUTCMonth(), targetMonday.getUTCDate(), 0, 0, 0);
      sundayDate = new Date(targetSunday.getUTCFullYear(), targetSunday.getUTCMonth(), targetSunday.getUTCDate(), 23, 59, 59);
    } else {
      const { monday, sunday } = getWeekRangeFromDate(selectedCalendarDate);
      mondayDate = monday;
      sundayDate = sunday;
    }

    return tripsState
      .filter((t) => {
        if (t.driverId !== selectedDriverId || t.status === "CANCELLED") return false;
        const start = new Date(t.startTime);
        return start >= mondayDate && start <= sundayDate;
      })
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  }, [selectedDriverId, modalOption, modalWeekInfo, selectedCalendarDate, tripsState]);

  // Map of booking dates for selected driver (used by MonthCalendarView)
  const driverBookingDatesSet = useMemo(() => {
    const set = new Set<string>();
    if (!selectedDriverId) return set;
    tripsState.forEach((t) => {
      if (t.driverId === selectedDriverId && t.status !== "CANCELLED") {
        const d = new Date(t.startTime);
        const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
        const dateKey = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
        set.add(dateKey);
      }
    });
    return set;
  }, [selectedDriverId, tripsState]);

  // Totals for inline verification
  const modalTotals = useMemo(() => {
    let totalBooked = 0;
    let totalActual = 0;

    const now = new Date();

    modalWeekBookings.forEach((t) => {
      const start = new Date(t.startTime).getTime();
      const end = new Date(t.endTime).getTime();
      const durationHrs = Math.max(0, Math.round(((end - start) / (1000 * 60 * 60)) * 10) / 10);
      totalBooked += durationHrs;

      const isCompleted = t.status === "COMPLETED" || new Date(t.endTime) <= now;
      const userVal = bookingActualHoursMap[t.id];

      if (userVal !== undefined) {
        totalActual += userVal;
      } else if (t.actualHours !== undefined && t.actualHours !== null) {
        totalActual += t.actualHours;
      } else if (isCompleted) {
        totalActual += durationHrs;
      }
    });

    return {
      totalBooked: Math.round(totalBooked * 10) / 10,
      totalActual: Math.round(totalActual * 10) / 10,
    };
  }, [modalWeekBookings, bookingActualHoursMap]);

  // All bookings for the selected driver in the active weekly breakdown view
  const driverBookingsForSelectedWeek = useMemo(() => {
    if (!activeDriverIdForBreakdown) return [];
    return tripsState
      .filter((t) => {
        if (t.driverId !== activeDriverIdForBreakdown) return false;
        const w = getLocalWeekDetails(new Date(t.startTime));
        return w.weekNumber === selectedWeekInfo.weekNumber && w.year === selectedWeekInfo.year;
      })
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
  }, [activeDriverIdForBreakdown, tripsState, selectedWeekInfo]);

  const activeDriverBreakdownData = useMemo(() => {
    const driver = initialDrivers.find((d) => d.id === activeDriverIdForBreakdown);
    if (!driver) return null;
    const bookedHours = getDriverBookedHours(driver.id);
    const actualHours = getDriverActualHours(driver.id);
    const isWorkCompleted = checkDriverWorkCompleted(driver.id);
    const record = filteredRecords.find((r) => r.driverId === driver.id);
    return {
      driver,
      bookedHours,
      actualHours,
      isWorkCompleted,
      record,
    };
  }, [activeDriverIdForBreakdown, initialDrivers, getDriverBookedHours, getDriverActualHours, checkDriverWorkCompleted, filteredRecords]);

  // Handle Verify Hours Form Submission
  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormError(null);
    setFormSuccess(null);

    const now = new Date();
    const tripActualHoursInput = modalWeekBookings.map((t) => {
      const isCompleted = t.status === "COMPLETED" || new Date(t.endTime) <= now;
      const durationHrs = Math.max(0, Math.round(((new Date(t.endTime).getTime() - new Date(t.startTime).getTime()) / (1000 * 60 * 60)) * 10) / 10);
      const userVal = bookingActualHoursMap[t.id];
      const finalVal = userVal !== undefined ? userVal : (t.actualHours ?? (isCompleted ? durationHrs : 0));
      return {
        tripId: t.id,
        actualHours: finalVal,
      };
    });

    const res = await verifyDriverHoursAction({
      driverId: selectedDriverId,
      periodType: modalOption === "WEEKLY" ? "WEEKLY" : "MONTHLY",
      year: modalWeekInfo.year,
      weekNumber: modalWeekInfo.weekNumber,
      weekLabel: modalWeekInfo.weekLabel,
      bookedHours: modalTotals.totalBooked,
      actualHours: modalTotals.totalActual,
      tripActualHours: tripActualHoursInput,
      notes: inputNotes,
    });

    setIsSubmitting(false);

    if (res.error) {
      setFormError(res.error);
    } else if (res.success && res.performance) {
      setFormSuccess("Driver driving hours verified and saved successfully!");

      setTripsState((prev) =>
        prev.map((t) => {
          const match = tripActualHoursInput.find((i) => i.tripId === t.id);
          return match ? { ...t, actualHours: match.actualHours } : t;
        })
      );

      setRecords((prev) => {
        const idx = prev.findIndex((r) => r.id === res.performance.id);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = res.performance as any;
          return updated;
        }
        return [res.performance as any, ...prev];
      });

      setTimeout(() => {
        setFormSuccess(null);
      }, 3000);
    }
  };

  // Handle Grant Reward Submission
  const handleGrantRewardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecordForReward) return;

    setIsSubmitting(true);
    setFormError(null);

    const amount = parseFloat(rewardAmount);

    const res = await grantDriverBonusRewardAction({
      performanceId: selectedRecordForReward.id,
      rewardTitle,
      rewardAmount: amount,
      notes: rewardNotes,
    });

    setIsSubmitting(false);

    if (res.error) {
      setFormError(res.error);
    } else if (res.success && res.performance) {
      setRecords((prev) =>
        prev.map((r) => (r.id === res.performance.id ? (res.performance as any) : r))
      );
      setIsRewardModalOpen(false);
      setSelectedRecordForReward(null);
    }
  };

  // Delete Performance Record
  const handleDeleteRecord = async (id: string) => {
    if (!confirm("Are you sure you want to delete this performance verification record?")) {
      return;
    }
    const res = await deleteDriverPerformanceAction(id);
    if (res.success) {
      setRecords((prev) => prev.filter((r) => r.id !== id));
    } else if (res.error) {
      alert(res.error);
    }
  };

  return (
    <div className="space-y-6 p-6 md:p-8 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20">
              <Award className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                Driver Performance Metrics
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Verify driver driving hours, track top performance ranks, and manage fleet bonus rewards.
              </p>
            </div>
          </div>
        </div>

        {/* Quick Tab Jump Button */}
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setActiveTab("VERIFY")}
            className={cn(
              "text-xs font-semibold cursor-pointer shadow-sm flex items-center gap-2",
              activeTab === "VERIFY"
                ? "bg-primary text-primary-foreground hover:bg-primary/95"
                : "bg-muted text-muted-foreground hover:text-foreground"
            )}
          >
            <Clock className="h-4 w-4" />
            Verify Hours Section
          </Button>
        </div>
      </div>

      {/* Summary Analytics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Fleet Score */}
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm hover:border-primary/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Average Fleet Score
            </span>
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-foreground">
              {avgFleetScore > 0 ? `${avgFleetScore}%` : "N/A"}
            </span>
            <span className="text-[11px] text-muted-foreground">
              ({verifiedCount} verified)
            </span>
          </div>
        </div>

        {/* Top Performer */}
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm hover:border-amber-500/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Top Performer ({periodType.toLowerCase()})
            </span>
            <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-500">
              <Trophy className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2">
            {driverLeaderboard[0] ? (
              <div className="truncate">
                <span className="text-sm font-bold text-foreground block truncate">
                  🥇 {driverLeaderboard[0].driver.name}
                </span>
                <span className="text-[11px] text-amber-500 font-semibold">
                  {driverLeaderboard[0].actualHours}h Actual Driving
                </span>
              </div>
            ) : (
              <span className="text-xs text-muted-foreground">No driver data logged yet</span>
            )}
          </div>
        </div>

        {/* Total Bonuses Awarded */}
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm hover:border-primary/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Bonus Rewards Distributed
            </span>
            <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
              <DollarSign className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-extrabold text-foreground">
              ${totalRewardsAmount.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Underperformance Warning */}
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm hover:border-red-500/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Needs Attention
            </span>
            <div className="p-1.5 rounded-lg bg-red-500/10 text-red-500">
              <AlertTriangle className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-foreground">
              {stagnantDrivers.length}
            </span>
            <span className="text-[11px] text-muted-foreground">driver(s) flagged</span>
          </div>
        </div>
      </div>

      {/* Underperformance Warning Banner */}
      {stagnantDrivers.length > 0 && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-xs font-bold text-red-600 dark:text-red-400">
                Drivers Requiring Performance Improvement ({stagnantDrivers.length})
              </h3>
              <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                {stagnantDrivers.map(({ driver, latestRecord, reason }) => (
                  <div
                    key={driver.id}
                    className="p-2.5 rounded-lg bg-card border border-red-500/20 text-xs space-y-0.5"
                  >
                    <div className="flex items-center justify-between font-semibold text-foreground">
                      <span>{driver.name} ({driver.employeeId})</span>
                      <span className="px-1.5 py-0.5 rounded bg-red-500/10 text-red-500 text-[10px]">
                        Ratio: {latestRecord.performanceRatio}%
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">{reason}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Tabs Bar for Clean Page Organization */}
      <div className="flex items-center gap-2 border-b border-border pb-3 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab("VERIFY")}
          className={cn(
            "px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap",
            activeTab === "VERIFY"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-muted/40"
          )}
        >
          <Clock className="h-4 w-4" />
          Manual Driving Hours Verification
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("LEADERBOARD")}
          className={cn(
            "px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap",
            activeTab === "LEADERBOARD"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-muted/40"
          )}
        >
          <Trophy className="h-4 w-4" />
          Leaderboard & Driver Bookings
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("HISTORY")}
          className={cn(
            "px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap",
            activeTab === "HISTORY"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-muted/40"
          )}
        >
          <FileSpreadsheet className="h-4 w-4" />
          Audit History Logs
        </button>
      </div>

      {/* SECTION 1: INLINE RESPONSIVE VERIFY HOURS SECTION */}
      {activeTab === "VERIFY" && (
        <div className="bg-card border border-border rounded-2xl shadow-sm p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-primary/10 text-primary">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-foreground">
                  Manual Driving Hours Verification
                </h2>
                <p className="text-xs text-muted-foreground">
                  Verify driver actual driving hours against allotted booking hours per booking slot.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 bg-muted/60 p-1 rounded-lg self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setModalOption("WEEKLY")}
                className={cn(
                  "px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer flex items-center gap-1.5",
                  modalOption === "WEEKLY"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Calendar className="h-3.5 w-3.5" />
                Weekly
              </button>
              <button
                type="button"
                onClick={() => setModalOption("MONTHLY")}
                className={cn(
                  "px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer flex items-center gap-1.5",
                  modalOption === "MONTHLY"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <CalendarDays className="h-3.5 w-3.5" />
                Monthly
              </button>
            </div>
          </div>

          <form onSubmit={handleVerifySubmit} className="space-y-5">
            {/* Driver Selector & Mode Specific Controls */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Select Driver *
                </label>
                <select
                  value={selectedDriverId}
                  onChange={(e) => setSelectedDriverId(e.target.value)}
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 cursor-pointer font-semibold"
                  required
                >
                  {initialDrivers.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.employeeId})
                    </option>
                  ))}
                </select>
              </div>

              {modalOption === "WEEKLY" ? (
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Select Week *
                  </label>
                  <select
                    value={selectedModalWeekKey}
                    onChange={(e) => setSelectedModalWeekKey(e.target.value)}
                    className="w-full rounded-lg border border-border bg-card px-3 py-2 text-xs text-foreground font-semibold focus:outline-none focus:ring-2 focus:ring-primary/50 cursor-pointer"
                  >
                    {weekOptions.map((w) => (
                      <option key={`${w.year}-W${w.weekNumber}`} value={`${w.year}-W${w.weekNumber}`}>
                        {w.rangeText}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Calendar View (Select any date to display its week)
                  </label>
                  <div className="p-2.5 rounded-lg bg-primary/5 border border-primary/20 text-xs text-primary font-semibold flex items-center gap-2">
                    <Calendar className="h-4 w-4 shrink-0" />
                    <span>
                      Displaying week for selected date: <strong>{modalWeekInfo.rangeText}</strong>
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* If Monthly Mode, Render Month Calendar View */}
            {modalOption === "MONTHLY" && (
              <div>
                <MonthCalendarView
                  currentMonth={currentCalendarMonth}
                  onMonthChange={setCurrentCalendarMonth}
                  selectedDate={selectedCalendarDate}
                  onSelectDate={setSelectedCalendarDate}
                  bookingDates={driverBookingDatesSet}
                />
              </div>
            )}

            {/* BOOKINGS LIST FOR THE WEEK */}
            <div className="space-y-3 pt-3 border-t border-border">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5 text-primary" />
                  Bookings for Selected Week ({modalWeekBookings.length})
                </h4>
                <span className="text-[11px] text-muted-foreground font-mono">
                  {modalWeekInfo.weekLabel}
                </span>
              </div>

              {modalWeekBookings.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {modalWeekBookings.map((trip, idx) => {
                    const start = new Date(trip.startTime);
                    const end = new Date(trip.endTime);
                    const durationHrs = Math.max(0, Math.round(((end.getTime() - start.getTime()) / (1000 * 60 * 60)) * 10) / 10);
                    const isCompleted = trip.status === "COMPLETED" || end <= new Date();

                    const currentActualVal =
                      bookingActualHoursMap[trip.id] !== undefined
                        ? bookingActualHoursMap[trip.id]
                        : (trip.actualHours ?? (isCompleted ? durationHrs : 0));

                    return (
                      <div
                        key={trip.id}
                        className="p-3.5 rounded-xl border border-border bg-card space-y-3 shadow-sm hover:border-primary/30 transition-all"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/40 pb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-primary font-mono">
                              #{idx + 1} {trip.tripNumber || "TRIP-N/A"}
                            </span>
                            <span className="text-xs font-medium text-foreground truncate max-w-[150px]">
                              {trip.vehicle?.name ? `${trip.vehicle.name}` : "Vehicle N/A"}
                            </span>
                          </div>
                          <span
                            className={cn(
                              "px-2 py-0.5 rounded text-[10px] font-bold uppercase shrink-0 w-fit",
                              isCompleted
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                                : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                            )}
                          >
                            {isCompleted ? "Completed" : "Driving Incomplete"}
                          </span>
                        </div>

                        <div className="text-xs text-muted-foreground flex flex-col gap-1">
                          <div className="truncate">
                            <span className="font-semibold text-foreground">{trip.pickup || "HQ"}</span>
                            {" → "}
                            <span className="font-semibold text-foreground">{trip.destination || "Destination"}</span>
                          </div>
                          <div className="font-mono text-[11px] text-muted-foreground">
                            {formatShortDateString(start)} {formatTimeString(start)} - {formatTimeString(end)}
                          </div>
                        </div>

                        {/* Hours Inputs per booking */}
                        <div className="grid grid-cols-2 gap-2 pt-1 bg-muted/20 p-2.5 rounded-lg border border-border/50">
                          {/* Booking Hours (Allotted) */}
                          <div>
                            <label className="block text-[10px] font-bold text-foreground mb-1">
                              Booking Hours (Allotted) *
                            </label>
                            <div className="px-2.5 py-1.5 rounded-lg border border-border bg-muted/60 text-xs font-mono font-bold text-foreground">
                              {durationHrs} Hours
                            </div>
                          </div>

                          {/* Actual Driving Hours */}
                          <div>
                            <label className="block text-[10px] font-bold text-foreground mb-1 flex items-center justify-between">
                              <span>Actual Hours *</span>
                              {!isCompleted ? (
                                <span className="text-[9px] text-amber-600 dark:text-amber-400 font-bold flex items-center gap-0.5">
                                  <Lock className="h-2.5 w-2.5" /> Locked
                                </span>
                              ) : (
                                <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-0.5">
                                  <Unlock className="h-2.5 w-2.5" /> Edit
                                </span>
                              )}
                            </label>
                            <input
                              type="number"
                              step="0.1"
                              min="0"
                              disabled={!isCompleted}
                              value={currentActualVal}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value);
                                setBookingActualHoursMap((prev) => ({
                                  ...prev,
                                  [trip.id]: isNaN(val) ? 0 : val,
                                }));
                              }}
                              placeholder={!isCompleted ? "Locked" : "e.g. 2.5"}
                              className={cn(
                                "w-full rounded-lg border px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 font-mono font-bold",
                                !isCompleted
                                  ? "bg-muted/60 text-muted-foreground border-amber-500/30 cursor-not-allowed opacity-75"
                                  : "bg-card border-border focus:ring-primary/50 text-primary"
                              )}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-6 text-center text-xs text-muted-foreground border border-dashed border-border rounded-xl bg-muted/20">
                  No bookings recorded for this driver during {modalWeekInfo.weekLabel}.
                </div>
              )}
            </div>

            {/* TOTALS SUMMARY CARD */}
            <div className="p-4 rounded-xl bg-muted/50 border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-[11px] font-bold text-foreground uppercase tracking-wider block">
                  Total Driving Hours Summary ({modalWeekInfo.weekLabel})
                </span>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Combined booking duration and verified actual driving hours for selected week.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="px-4 py-2 rounded-lg bg-card border border-border text-center">
                  <span className="text-[10px] text-muted-foreground uppercase block">
                    Total Booking
                  </span>
                  <strong className="text-sm font-extrabold text-foreground font-mono">
                    {modalTotals.totalBooked}h
                  </strong>
                </div>

                <div className="px-4 py-2 rounded-lg bg-card border border-primary/40 text-center">
                  <span className="text-[10px] text-muted-foreground uppercase block">
                    Total Actual
                  </span>
                  <strong className="text-sm font-black text-primary font-mono">
                    {modalTotals.totalActual}h
                  </strong>
                </div>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Notes / Verification Remarks (Optional)
              </label>
              <textarea
                rows={2}
                value={inputNotes}
                onChange={(e) => setInputNotes(e.target.value)}
                placeholder="e.g. Verified trip logs and shift duration."
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>

            {formError && (
              <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-500 font-medium">
                {formError}
              </div>
            )}

            {formSuccess && (
              <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-500 font-medium">
                {formSuccess}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="submit"
                disabled={isSubmitting}
                className="text-xs bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer font-bold px-6 py-2 shadow-sm"
              >
                {isSubmitting ? "Saving..." : "Verify & Save Performance"}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* SECTION 2: LEADERBOARD & DRIVER BOOKINGS BREAKDOWN */}
      {activeTab === "LEADERBOARD" && (
        <div className="space-y-6">
          {/* Period Filter Tabs & Specific Week Selector */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-card p-3 rounded-xl border border-border">
            <div className="flex items-center bg-muted/60 p-1 rounded-lg">
              <button
                onClick={() => setPeriodType("WEEKLY")}
                className={cn(
                  "px-4 py-2 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 cursor-pointer",
                  periodType === "WEEKLY"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Calendar className="h-3.5 w-3.5" />
                Weekly Performance
              </button>

              <button
                onClick={() => setPeriodType("MONTHLY")}
                className={cn(
                  "px-4 py-2 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 cursor-pointer",
                  periodType === "MONTHLY"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Monthly
              </button>

              <button
                onClick={() => setPeriodType("YEARLY")}
                className={cn(
                  "px-4 py-2 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 cursor-pointer",
                  periodType === "YEARLY"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Yearly
              </button>
            </div>

            {periodType === "WEEKLY" && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap flex items-center gap-1">
                  <CalendarDays className="h-4 w-4 text-primary" />
                  Select Week:
                </span>
                <select
                  value={selectedWeekKey}
                  onChange={(e) => setSelectedWeekKey(e.target.value)}
                  className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-foreground font-semibold focus:outline-none focus:ring-2 focus:ring-primary/50 cursor-pointer max-w-xs truncate"
                >
                  {weekOptions.map((w) => (
                    <option key={`${w.year}-W${w.weekNumber}`} value={`${w.year}-W${w.weekNumber}`}>
                      {w.rangeText}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* TOP DRIVERS LEADERBOARD */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-amber-500" />
                <h2 className="text-base font-bold text-foreground">
                  Driver Performance Leaderboard ({periodType === "WEEKLY" ? selectedWeekInfo.weekLabel : periodType.toLowerCase()})
                </h2>
              </div>
              <span className="text-xs text-muted-foreground">
                Ranked by Total Actual Driving Hours
              </span>
            </div>

            <div className="grid grid-cols-1 gap-2.5">
              {driverLeaderboard.slice(0, 10).map((item, index) => {
                const rank = index + 1;
                const badgeColor =
                  rank === 1
                    ? "bg-amber-500 text-amber-950 font-extrabold border-amber-400"
                    : rank === 2
                    ? "bg-slate-300 text-slate-900 font-extrabold border-slate-200"
                    : rank === 3
                    ? "bg-amber-700 text-amber-100 font-extrabold border-amber-600"
                    : "bg-muted text-muted-foreground font-semibold";

                return (
                  <div
                    key={item.driver.id}
                    className={cn(
                      "flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border transition-all bg-card",
                      rank === 1
                        ? "border-amber-500/50 shadow-sm bg-gradient-to-r from-amber-500/5 via-card to-card"
                        : "border-border hover:border-primary/40"
                    )}
                  >
                    {/* Driver Info & Rank */}
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "h-9 w-9 rounded-xl flex items-center justify-center text-xs shadow-sm border shrink-0",
                          badgeColor
                        )}
                      >
                        {rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `#${rank}`}
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-foreground text-sm">{item.driver.name}</h3>
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-mono">
                            {item.driver.employeeId}
                          </span>
                          {item.rewardGranted && (
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 font-medium flex items-center gap-1">
                              <Zap className="h-3 w-3" /> Bonus (${item.rewardAmount})
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {item.driver.assignedVehicle
                            ? `Vehicle: ${item.driver.assignedVehicle.name} (${item.driver.assignedVehicle.vehicleNumber})`
                            : "No assigned vehicle"}
                        </p>
                      </div>
                    </div>

                    {/* Performance Metrics Breakdown */}
                    <div className="flex flex-wrap items-center gap-5">
                      <div className="text-left sm:text-right">
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground block">
                          Total Actual Driving
                        </span>
                        <span className="text-sm font-black text-primary font-mono">
                          {item.actualHours} Hours
                        </span>
                      </div>

                      <div className="text-left sm:text-right">
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground block">
                          Total Booking
                        </span>
                        <span className="text-sm font-semibold text-foreground font-mono">
                          {item.bookedHours} Hours
                        </span>
                      </div>

                      <div className="text-left sm:text-right">
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground block">
                          Ratio
                        </span>
                        <span
                          className={cn(
                            "text-sm font-extrabold font-mono",
                            item.ratio >= 90
                              ? "text-emerald-500"
                              : item.ratio >= 75
                              ? "text-amber-500"
                              : item.isVerified
                              ? "text-red-500"
                              : "text-muted-foreground"
                          )}
                        >
                          {item.isVerified ? `${item.ratio}%` : "Pending"}
                        </span>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedDriverId(item.driver.id);
                            setActiveTab("VERIFY");
                          }}
                          className="text-xs cursor-pointer border-border hover:bg-muted"
                        >
                          Verify Hours
                        </Button>

                        {item.isVerified && (
                          <Button
                            size="sm"
                            disabled={item.rewardGranted}
                            onClick={() => {
                              setSelectedRecordForReward(item.performanceRecord || null);
                              setRewardTitle(`Top Performer Bonus - Rank #${rank}`);
                              setRewardAmount(rank === 1 ? "200" : rank === 2 ? "150" : "100");
                              setIsRewardModalOpen(true);
                            }}
                            className={cn(
                              "text-xs cursor-pointer flex items-center gap-1",
                              item.rewardGranted
                                ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                                : "bg-amber-500 hover:bg-amber-600 text-white shadow-sm"
                            )}
                          >
                            <Award className="h-3.5 w-3.5" />
                            {item.rewardGranted ? "Paid" : "Grant Bonus"}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* DRIVER WEEKLY BOOKINGS BREAKDOWN */}
          <div className="space-y-4 pt-4 border-t border-border">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" />
                  Driver Weekly Bookings Details
                </h2>
                <p className="text-xs text-muted-foreground">
                  Select a driver to view all bookings during <strong className="text-foreground">{selectedWeekInfo.rangeText}</strong>.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-muted-foreground whitespace-nowrap">
                  Select Driver:
                </label>
                <select
                  value={activeDriverIdForBreakdown}
                  onChange={(e) => setActiveDriverIdForBreakdown(e.target.value)}
                  className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-foreground font-semibold focus:outline-none focus:ring-2 focus:ring-primary/50 cursor-pointer"
                >
                  {initialDrivers.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.employeeId})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {activeDriverBreakdownData && (
              <div className="p-4 rounded-xl border border-border bg-card space-y-4 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-3">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
                      {activeDriverBreakdownData.driver.name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-bold text-foreground text-sm">
                        {activeDriverBreakdownData.driver.name}
                      </h3>
                      <span className="text-[11px] text-muted-foreground font-mono">
                        ID: {activeDriverBreakdownData.driver.employeeId}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2.5 py-1 rounded-full bg-muted text-foreground text-xs font-bold border border-border font-mono">
                      Booked: {activeDriverBreakdownData.bookedHours}h
                    </span>

                    <span className="px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-extrabold border border-primary/20 font-mono">
                      Actual Driving: {activeDriverBreakdownData.actualHours}h
                    </span>

                    <Button
                      size="sm"
                      onClick={() => {
                        setSelectedDriverId(activeDriverBreakdownData.driver.id);
                        setActiveTab("VERIFY");
                      }}
                      className="text-xs font-semibold cursor-pointer"
                    >
                      Verify Hours
                    </Button>
                  </div>
                </div>

                <div>
                  {driverBookingsForSelectedWeek.length > 0 ? (
                    <div className="rounded-lg border border-border overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-muted/60 text-muted-foreground uppercase font-semibold border-b border-border">
                          <tr>
                            <th className="px-3 py-2">Trip #</th>
                            <th className="px-3 py-2">Vehicle</th>
                            <th className="px-3 py-2">Route</th>
                            <th className="px-3 py-2">Scheduled Slot</th>
                            <th className="px-3 py-2 font-mono">Booking Hours</th>
                            <th className="px-3 py-2 font-mono">Actual Hours</th>
                            <th className="px-3 py-2 text-right">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {driverBookingsForSelectedWeek.map((trip) => {
                            const start = new Date(trip.startTime);
                            const end = new Date(trip.endTime);
                            const durationHrs = Math.max(0, Math.round(((end.getTime() - start.getTime()) / (1000 * 60 * 60)) * 10) / 10);
                            const isFinished = trip.status === "COMPLETED" || end <= new Date();

                            return (
                              <tr key={trip.id} className="hover:bg-muted/30 transition-colors">
                                <td className="px-3 py-2 font-bold font-mono text-primary">
                                  {trip.tripNumber || "WRK-N/A"}
                                </td>
                                <td className="px-3 py-2 font-medium text-foreground">
                                  {trip.vehicle?.name ? (
                                    <span>
                                      {trip.vehicle.name}{" "}
                                      <span className="text-[10px] text-muted-foreground font-mono">
                                        ({trip.vehicle.vehicleNumber})
                                      </span>
                                    </span>
                                  ) : (
                                    "Vehicle N/A"
                                  )}
                                </td>
                                <td className="px-3 py-2 text-muted-foreground">
                                  <span className="font-semibold text-foreground">{trip.pickup || "HQ"}</span>
                                  {" → "}
                                  <span className="font-semibold text-foreground">{trip.destination || "Destination"}</span>
                                </td>
                                <td className="px-3 py-2 text-muted-foreground font-mono text-[11px]">
                                  {formatShortDateString(start)} {formatTimeString(start)} - {formatTimeString(end)}
                                </td>
                                <td className="px-3 py-2 font-mono font-bold text-foreground">
                                  {durationHrs}h
                                </td>
                                <td className="px-3 py-2 font-mono font-bold text-primary">
                                  {trip.actualHours !== undefined && trip.actualHours !== null
                                    ? `${trip.actualHours}h`
                                    : isFinished
                                    ? `${durationHrs}h`
                                    : "0h (Pending)"}
                                </td>
                                <td className="px-3 py-2 text-right">
                                  <span
                                    className={cn(
                                      "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                                      trip.status === "COMPLETED" || isFinished
                                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                                        : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                                    )}
                                  >
                                    {isFinished ? "COMPLETED" : trip.status}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="p-4 text-center text-xs text-muted-foreground border border-dashed border-border rounded-lg bg-muted/20">
                      No bookings recorded for {activeDriverBreakdownData.driver.name} during {selectedWeekInfo.weekLabel}.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SECTION 3: HISTORICAL AUDIT LOGS */}
      {activeTab === "HISTORY" && (
        <div className="space-y-4 bg-card p-5 rounded-2xl border border-border shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-foreground">Verification & Reward Audit History</h3>
              <p className="text-xs text-muted-foreground">
                Complete records of manually verified actual hours and awarded performance bonuses.
              </p>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search driver name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-lg border border-border bg-card pl-9 pr-4 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
          </div>

          <div className="rounded-xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/60 text-muted-foreground uppercase font-semibold tracking-wider border-b border-border">
                  <tr>
                    <th className="px-4 py-2.5">Driver</th>
                    <th className="px-4 py-2.5">Period</th>
                    <th className="px-4 py-2.5 font-mono">Booked Hours</th>
                    <th className="px-4 py-2.5 font-mono">Actual Hours</th>
                    <th className="px-4 py-2.5">Ratio</th>
                    <th className="px-4 py-2.5">Bonus / Reward</th>
                    <th className="px-4 py-2.5">Verified By</th>
                    <th className="px-4 py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {records
                    .filter((r) =>
                      searchTerm
                        ? r.driver?.name?.toLowerCase().includes(searchTerm.toLowerCase())
                        : true
                    )
                    .map((record) => (
                      <tr key={record.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-medium text-foreground">
                          <div>
                            <span className="font-bold">{record.driver?.name || "Unknown Driver"}</span>
                            <span className="text-[10px] text-muted-foreground block font-mono">
                              {record.driver?.employeeId}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          <span className="px-2 py-0.5 rounded bg-muted font-medium">
                            {record.weekLabel || `${record.periodType} ${record.year}`}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-foreground font-medium">
                          {record.bookedHours} Hours
                        </td>
                        <td className="px-4 py-3 font-mono text-primary font-bold">
                          {record.actualHours} Hours
                        </td>
                        <td className="px-4 py-3 font-mono font-bold">
                          <span
                            className={cn(
                              record.performanceRatio >= 90
                                ? "text-emerald-500"
                                : record.performanceRatio >= 75
                                ? "text-amber-500"
                                : "text-red-500"
                            )}
                          >
                            {record.performanceRatio}%
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {record.rewardGranted ? (
                            <div className="flex flex-col">
                              <span className="font-bold text-emerald-500 flex items-center gap-1">
                                <DollarSign className="h-3 w-3" /> ${record.rewardAmount}
                              </span>
                              <span className="text-[10px] text-muted-foreground">
                                {record.rewardTitle}
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground italic">None</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          <div>
                            <span>{record.verifiedBy || "Admin"}</span>
                            <span className="text-[10px] text-muted-foreground block">
                              {formatDateString(record.verifiedAt)}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleDeleteRecord(record.id)}
                            className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-500/10 cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  {records.length === 0 && (
                    <tr>
                      <td colSpan={8} className="text-center py-6 text-muted-foreground">
                        No verified driver performance logs recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* GRANT BONUS / REWARD MODAL */}
      {isRewardModalOpen && selectedRecordForReward && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl p-6 relative animate-in fade-in zoom-in duration-200">
            <button
              onClick={() => setIsRewardModalOpen(false)}
              className="absolute right-4 top-4 text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-3 mb-5">
              <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-500">
                <Trophy className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground">
                  Grant Performance Bonus / Reward
                </h3>
                <p className="text-xs text-muted-foreground">
                  Award a performance cash bonus or recognition reward to top performing driver.
                </p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 text-xs mb-4">
              <span className="text-muted-foreground block">Target Driver:</span>
              <strong className="text-foreground text-sm font-bold">
                {selectedRecordForReward.driver?.name} ({selectedRecordForReward.driver?.employeeId})
              </strong>
              <div className="mt-1 text-muted-foreground font-mono">
                Verified Ratio: {selectedRecordForReward.performanceRatio}% (Score: {selectedRecordForReward.score}/100)
              </div>
            </div>

            <form onSubmit={handleGrantRewardSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Reward Title *
                </label>
                <input
                  type="text"
                  value={rewardTitle}
                  onChange={(e) => setRewardTitle(e.target.value)}
                  placeholder="e.g. Top 10 Weekly Driver Bonus"
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Bonus Amount ($) *
                </label>
                <input
                  type="number"
                  step="5"
                  min="1"
                  value={rewardAmount}
                  onChange={(e) => setRewardAmount(e.target.value)}
                  placeholder="150"
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Reward Citation / Remarks (Optional)
                </label>
                <textarea
                  rows={2}
                  value={rewardNotes}
                  onChange={(e) => setRewardNotes(e.target.value)}
                  placeholder="e.g. Awarded for top weekly efficiency rating."
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>

              {formError && (
                <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-500">
                  {formError}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsRewardModalOpen(false)}
                  className="text-xs cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="text-xs bg-amber-500 hover:bg-amber-600 text-white font-bold cursor-pointer flex items-center gap-1.5"
                >
                  <Award className="h-4 w-4" />
                  {isSubmitting ? "Granting..." : "Grant Reward Bonus"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
