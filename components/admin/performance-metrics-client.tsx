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
  MapPin,
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

export function PerformanceMetricsAdminClient({
  initialDrivers,
  initialTrips,
  initialPerformanceRecords,
  currentUserName,
}: PerformanceMetricsClientProps) {
  const [periodType, setPeriodType] = useState<"WEEKLY" | "MONTHLY" | "YEARLY">("WEEKLY");
  const [records, setRecords] = useState<PerformanceRecord[]>(initialPerformanceRecords);
  const [searchTerm, setSearchTerm] = useState("");
  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false);
  const [isRewardModalOpen, setIsRewardModalOpen] = useState(false);
  const [selectedRecordForReward, setSelectedRecordForReward] = useState<PerformanceRecord | null>(null);

  const currentWeekInfo = useMemo(() => getLocalWeekDetails(), []);

  // Compute available week options for the week selector
  const weekOptions = useMemo(() => {
    const map = new Map<string, { weekNumber: number; year: number; weekLabel: string; rangeText: string }>();

    // Add current week & previous 12 weeks
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

    // Include any week from initialTrips
    initialTrips.forEach((t) => {
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

    // Include any week from performance records
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
  }, [initialTrips, initialPerformanceRecords]);

  // Selected week key state (default to current week)
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

  // Active driver state for the weekly breakdown view
  const [activeDriverIdForBreakdown, setActiveDriverIdForBreakdown] = useState<string>(
    initialDrivers[0]?.id || ""
  );

  // Verification Form State
  const [selectedDriverId, setSelectedDriverId] = useState<string>(initialDrivers[0]?.id || "");
  const [modalPeriod, setModalPeriod] = useState<"THIS_WEEK" | "THIS_MONTH">("THIS_WEEK");
  const [inputBookedHours, setInputBookedHours] = useState<string>("0");
  const [inputActualHours, setInputActualHours] = useState<string>("0");
  const [inputNotes, setInputNotes] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Reward Form State
  const [rewardTitle, setRewardTitle] = useState<string>("Weekly Top Performer Bonus");
  const [rewardAmount, setRewardAmount] = useState<string>("150");
  const [rewardNotes, setRewardNotes] = useState<string>("");

  // Helper to calculate automatically computed booked hours for a driver in a specific week/period
  const getDriverBookedHours = useCallback(
    (driverId: string, weekNo?: number, yr?: number) => {
      if (!driverId) return 0;
      const targetWeekNo = weekNo ?? selectedWeekInfo.weekNumber;
      const targetYear = yr ?? selectedWeekInfo.year;

      const driverTrips = initialTrips.filter((t) => {
        if (t.driverId !== driverId || t.status === "CANCELLED") return false;
        if (periodType === "WEEKLY") {
          const details = getLocalWeekDetails(new Date(t.startTime));
          return details.weekNumber === targetWeekNo && details.year === targetYear;
        } else if (periodType === "MONTHLY") {
          const tDate = new Date(t.startTime);
          return tDate.getFullYear() === targetYear && tDate.getMonth() + 1 === (new Date().getMonth() + 1);
        } else {
          const tDate = new Date(t.startTime);
          return tDate.getFullYear() === targetYear;
        }
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
    [initialTrips, periodType, selectedWeekInfo]
  );

  // Helper to check if driver has completed work for the selected period/week
  const checkDriverWorkCompleted = useCallback(
    (driverId: string, weekNo?: number, yr?: number) => {
      if (!driverId) return false;
      const targetWeekNo = weekNo ?? selectedWeekInfo.weekNumber;
      const targetYear = yr ?? selectedWeekInfo.year;
      const now = new Date();

      const driverTrips = initialTrips.filter((t) => {
        if (t.driverId !== driverId || t.status === "CANCELLED") return false;
        if (periodType === "WEEKLY") {
          const details = getLocalWeekDetails(new Date(t.startTime));
          return details.weekNumber === targetWeekNo && details.year === targetYear;
        } else if (periodType === "MONTHLY") {
          const tDate = new Date(t.startTime);
          return tDate.getFullYear() === targetYear && tDate.getMonth() + 1 === (new Date().getMonth() + 1);
        } else {
          const tDate = new Date(t.startTime);
          return tDate.getFullYear() === targetYear;
        }
      });

      if (driverTrips.length === 0) return false;

      // Work is completed if any trip status is COMPLETED or trip endTime <= now
      return driverTrips.some(
        (t) => t.status === "COMPLETED" || new Date(t.endTime) <= now
      );
    },
    [initialTrips, periodType, selectedWeekInfo]
  );

  // Modal specific helpers for calculation based on selected modalPeriod (This Week vs This Month)
  const getModalBookedHours = useCallback(
    (driverId: string, period: "THIS_WEEK" | "THIS_MONTH") => {
      if (!driverId) return 0;
      const now = new Date();

      const driverTrips = initialTrips.filter((t) => {
        if (t.driverId !== driverId || t.status === "CANCELLED") return false;
        const tDate = new Date(t.startTime);
        if (period === "THIS_WEEK") {
          const currentWeekDetails = getLocalWeekDetails(now);
          const details = getLocalWeekDetails(tDate);
          return details.weekNumber === currentWeekDetails.weekNumber && details.year === currentWeekDetails.year;
        } else {
          return tDate.getFullYear() === now.getFullYear() && tDate.getMonth() === now.getMonth();
        }
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
    [initialTrips]
  );

  const checkModalWorkCompleted = useCallback(
    (driverId: string, period: "THIS_WEEK" | "THIS_MONTH") => {
      if (!driverId) return false;
      const now = new Date();

      const driverTrips = initialTrips.filter((t) => {
        if (t.driverId !== driverId || t.status === "CANCELLED") return false;
        const tDate = new Date(t.startTime);
        if (period === "THIS_WEEK") {
          const currentWeekDetails = getLocalWeekDetails(now);
          const details = getLocalWeekDetails(tDate);
          return details.weekNumber === currentWeekDetails.weekNumber && details.year === currentWeekDetails.year;
        } else {
          return tDate.getFullYear() === now.getFullYear() && tDate.getMonth() === now.getMonth();
        }
      });

      if (driverTrips.length === 0) return false;

      return driverTrips.some(
        (t) => t.status === "COMPLETED" || new Date(t.endTime) <= now
      );
    },
    [initialTrips]
  );

  const autoBookedHoursForModal = useMemo(() => {
    return getModalBookedHours(selectedDriverId, modalPeriod);
  }, [selectedDriverId, modalPeriod, getModalBookedHours]);

  const isWorkCompletedForModal = useMemo(() => {
    return checkModalWorkCompleted(selectedDriverId, modalPeriod);
  }, [selectedDriverId, modalPeriod, checkModalWorkCompleted]);

  // Handle auto prefill when selected driver or modal period changes
  const handleDriverSelectChange = (driverId: string, customPeriod?: "THIS_WEEK" | "THIS_MONTH") => {
    setSelectedDriverId(driverId);
    const activePeriod = customPeriod || modalPeriod;
    const calculatedBooked = getModalBookedHours(driverId, activePeriod);
    const workDone = checkModalWorkCompleted(driverId, activePeriod);

    const now = new Date();
    const currentWeekDetails = getLocalWeekDetails(now);

    const existing = records.find((r) => {
      if (r.driverId !== driverId) return false;
      if (activePeriod === "THIS_WEEK") {
        return r.periodType === "WEEKLY" && r.weekNumber === currentWeekDetails.weekNumber && r.year === currentWeekDetails.year;
      } else {
        return r.periodType === "MONTHLY" && r.month === (now.getMonth() + 1) && r.year === now.getFullYear();
      }
    });

    if (existing) {
      setInputBookedHours((calculatedBooked > 0 ? calculatedBooked : existing.bookedHours).toString());
      setInputActualHours(workDone ? existing.actualHours.toString() : "0");
      setInputNotes(existing.notes || "");
    } else {
      setInputBookedHours(calculatedBooked.toString());
      setInputActualHours(workDone ? calculatedBooked.toString() : "0");
      setInputNotes("");
    }
  };

  const handleModalPeriodToggle = (period: "THIS_WEEK" | "THIS_MONTH") => {
    setModalPeriod(period);
    handleDriverSelectChange(selectedDriverId, period);
  };

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

  // Compute Driver Performance Leaderboard (Ranked Drivers for selected week)
  const driverLeaderboard = useMemo(() => {
    return initialDrivers
      .map((driver) => {
        const driverRecord = filteredRecords.find((r) => r.driverId === driver.id);
        const computedBooked = getDriverBookedHours(driver.id);
        const booked = computedBooked > 0 ? computedBooked : (driverRecord ? driverRecord.bookedHours : 0);
        const actual = driverRecord ? driverRecord.actualHours : 0;
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
        if (a.isVerified && !b.isVerified) return -1;
        if (!a.isVerified && b.isVerified) return 1;
        if (b.score !== a.score) return b.score - a.score;
        if (b.bookedHours !== a.bookedHours) return b.bookedHours - a.bookedHours;
        return b.ratio - a.ratio;
      });
  }, [initialDrivers, filteredRecords, getDriverBookedHours, checkDriverWorkCompleted]);

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

  // Calculation previews for modal
  const liveBooked = parseFloat(inputBookedHours) || 0;
  const liveActual = parseFloat(inputActualHours) || 0;
  const liveRatio = liveBooked > 0 ? Math.round((liveActual / liveBooked) * 1000) / 10 : 0;
  const liveScore = useMemo(() => {
    if (liveBooked <= 0) return 0;
    const diff = Math.abs(liveBooked - liveActual);
    const ratio = liveActual / liveBooked;
    let s = Math.max(0, Math.min(100, Math.round(100 - (diff / liveBooked) * 40)));
    if (ratio >= 0.9 && ratio <= 1.1) s = Math.min(100, s + 10);
    return s;
  }, [liveBooked, liveActual]);

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

  // All bookings for the selected driver in the active weekly breakdown
  const driverBookingsForSelectedWeek = useMemo(() => {
    if (!activeDriverIdForBreakdown) return [];
    return initialTrips
      .filter((t) => {
        if (t.driverId !== activeDriverIdForBreakdown) return false;
        const w = getLocalWeekDetails(new Date(t.startTime));
        return w.weekNumber === selectedWeekInfo.weekNumber && w.year === selectedWeekInfo.year;
      })
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
  }, [activeDriverIdForBreakdown, initialTrips, selectedWeekInfo]);

  const activeDriverBreakdownData = useMemo(() => {
    const driver = initialDrivers.find((d) => d.id === activeDriverIdForBreakdown);
    if (!driver) return null;
    const bookedHours = getDriverBookedHours(driver.id);
    const isWorkCompleted = checkDriverWorkCompleted(driver.id);
    const record = filteredRecords.find((r) => r.driverId === driver.id);
    return {
      driver,
      bookedHours,
      isWorkCompleted,
      record,
    };
  }, [activeDriverIdForBreakdown, initialDrivers, getDriverBookedHours, checkDriverWorkCompleted, filteredRecords]);

  // Handle Verify Hours Form Submission
  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormError(null);
    setFormSuccess(null);

    if (!isWorkCompletedForModal) {
      setFormError("Actual Driving Hours cannot be saved before the driver completes the booked time.");
      setIsSubmitting(false);
      return;
    }

    const booked = parseFloat(inputBookedHours);
    const actual = parseFloat(inputActualHours);

    if (isNaN(booked) || booked < 0) {
      setFormError("Please enter a valid booked hours value.");
      setIsSubmitting(false);
      return;
    }

    if (isNaN(actual) || actual < 0) {
      setFormError("Please enter a valid actual driving hours value.");
      setIsSubmitting(false);
      return;
    }

    const now = new Date();
    const currentWeekDetails = getLocalWeekDetails(now);

    const res = await verifyDriverHoursAction(
      modalPeriod === "THIS_WEEK"
        ? {
            driverId: selectedDriverId,
            periodType: "WEEKLY",
            year: currentWeekDetails.year,
            weekNumber: currentWeekDetails.weekNumber,
            weekLabel: currentWeekDetails.weekLabel,
            bookedHours: booked,
            actualHours: actual,
            notes: inputNotes,
          }
        : {
            driverId: selectedDriverId,
            periodType: "MONTHLY",
            year: now.getFullYear(),
            month: now.getMonth() + 1,
            weekLabel: `${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}`,
            bookedHours: booked,
            actualHours: actual,
            notes: inputNotes,
          }
    );

    setIsSubmitting(false);

    if (res.error) {
      setFormError(res.error);
    } else if (res.success && res.performance) {
      setFormSuccess("Driver performance hours verified successfully!");
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
        setIsVerifyModalOpen(false);
        setFormSuccess(null);
      }, 1000);
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
    <div className="space-y-8 p-6 md:p-8 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20">
              <Award className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                Driver Performance Metrics
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Monitor driver weekly/monthly driving hours, verify actual vs booked ratios, track top ranks & assign performance bonuses.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            onClick={() => {
              if (initialDrivers.length > 0) {
                handleDriverSelectChange(initialDrivers[0].id);
              }
              setIsVerifyModalOpen(true);
            }}
            className="bg-primary text-primary-foreground hover:bg-primary/95 shadow-md flex items-center gap-2 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Verify Driving Hours
          </Button>
        </div>
      </div>

      {/* Summary Analytics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Fleet Score */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm hover:border-primary/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Average Fleet Score
            </span>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-foreground">
              {avgFleetScore > 0 ? `${avgFleetScore}%` : "N/A"}
            </span>
            <span className="text-xs text-muted-foreground">
              ({verifiedCount} drivers verified)
            </span>
          </div>
          <div className="mt-2 text-xs text-emerald-500 font-medium flex items-center gap-1">
            <CheckCircle2 className="h-3.5 w-3.5" /> Optimal efficiency baseline
          </div>
        </div>

        {/* Top Performer */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm hover:border-amber-500/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Top Performer ({periodType.toLowerCase()})
            </span>
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500">
              <Trophy className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            {driverLeaderboard[0]?.isVerified ? (
              <div>
                <span className="text-lg font-bold text-foreground block truncate">
                  🥇 {driverLeaderboard[0].driver.name}
                </span>
                <span className="text-xs text-amber-500 font-semibold">
                  Ratio: {driverLeaderboard[0].ratio}% (Score: {driverLeaderboard[0].score}/100)
                </span>
              </div>
            ) : (
              <span className="text-sm text-muted-foreground">No verifications logged yet</span>
            )}
          </div>
          <div className="mt-2 text-xs text-muted-foreground flex items-center gap-1">
            <Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400" /> Rank #1 Leaderboard
          </div>
        </div>

        {/* Total Bonuses Awarded */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm hover:border-primary/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Bonus Rewards Distributed
            </span>
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <DollarSign className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-extrabold text-foreground">
              ${totalRewardsAmount.toLocaleString()}
            </span>
          </div>
          <div className="mt-2 text-xs text-primary font-medium flex items-center gap-1">
            <Sparkles className="h-3.5 w-3.5" /> Encouraging top performance
          </div>
        </div>

        {/* Underperformance Warning */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm hover:border-red-500/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Needs Attention
            </span>
            <div className="p-2 rounded-lg bg-red-500/10 text-red-500">
              <AlertTriangle className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-extrabold text-foreground">
              {stagnantDrivers.length}
            </span>
            <span className="text-xs text-muted-foreground ml-2">driver(s) flagged</span>
          </div>
          <div className="mt-2 text-xs text-red-400 font-medium flex items-center gap-1">
            <TrendingDown className="h-3.5 w-3.5" /> Stagnant or declining ratio
          </div>
        </div>
      </div>

      {/* Underperformance Warning Banner */}
      {stagnantDrivers.length > 0 && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-bold text-red-600 dark:text-red-400">
                Drivers Requiring Performance Improvement ({stagnantDrivers.length})
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                The system identified drivers whose actual vs booked driving hours ratio has not improved consistently over multiple verification periods.
              </p>

              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                {stagnantDrivers.map(({ driver, latestRecord, reason }) => (
                  <div
                    key={driver.id}
                    className="p-3 rounded-lg bg-card border border-red-500/20 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between font-semibold text-foreground">
                      <span>{driver.name} ({driver.employeeId})</span>
                      <span className="px-2 py-0.5 rounded bg-red-500/10 text-red-500 text-[11px]">
                        Ratio: {latestRecord.performanceRatio}%
                      </span>
                    </div>
                    <p className="text-muted-foreground">{reason}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Period Filter Tabs & Specific Week Selector */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-card p-3 rounded-xl border border-border">
        {/* Period Selector Tabs */}
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

        {/* Specific Week Selector Option */}
        {periodType === "WEEKLY" && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap flex items-center gap-1">
              <CalendarDays className="h-4 w-4 text-primary" />
              Select Specific Week:
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

      {/* TOP 10 DRIVERS LEADERBOARD SECTION */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-500" />
            <h2 className="text-lg font-bold text-foreground">
              Driver Performance Leaderboard ({periodType === "WEEKLY" ? selectedWeekInfo.weekLabel : periodType.toLowerCase()})
            </h2>
          </div>
          <span className="text-xs text-muted-foreground">
            Rankings updated dynamically based on Booked vs Actual Hours ratio
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3">
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
                  "flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border transition-all duration-200 bg-card",
                  rank === 1
                    ? "border-amber-500/50 shadow-md bg-gradient-to-r from-amber-500/5 via-card to-card"
                    : "border-border hover:border-primary/40"
                )}
              >
                {/* Driver Info & Rank */}
                <div className="flex items-center gap-4">
                  <div
                    className={cn(
                      "h-10 w-10 rounded-xl flex items-center justify-center text-sm shadow-sm border shrink-0",
                      badgeColor
                    )}
                  >
                    {rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `#${rank}`}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-foreground text-base">{item.driver.name}</h3>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-mono">
                        {item.driver.employeeId}
                      </span>
                      {item.isWorkCompleted ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/20">
                          Work Completed
                        </span>
                      ) : (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold border border-amber-500/20">
                          Work Pending
                        </span>
                      )}
                      {item.rewardGranted && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 font-medium flex items-center gap-1">
                          <Zap className="h-3 w-3" /> Reward Awarded (${item.rewardAmount})
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {item.driver.assignedVehicle
                        ? `Assigned Vehicle: ${item.driver.assignedVehicle.name} (${item.driver.assignedVehicle.vehicleNumber})`
                        : "No assigned vehicle"}
                    </p>
                  </div>
                </div>

                {/* Performance Metrics Breakdown */}
                <div className="flex flex-wrap items-center gap-6">
                  {/* Booked vs Actual Hours */}
                  <div className="text-left sm:text-right">
                    <span className="text-[11px] uppercase tracking-wider text-muted-foreground block font-medium">
                      Booked vs Actual
                    </span>
                    <span className="text-sm font-semibold text-foreground font-mono">
                      {item.bookedHours}h Booked /{" "}
                      <strong className="text-primary">{item.actualHours}h Actual</strong>
                    </span>
                  </div>

                  {/* Ratio Percentage */}
                  <div className="text-left sm:text-right">
                    <span className="text-[11px] uppercase tracking-wider text-muted-foreground block font-medium">
                      Performance Ratio
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
                      {item.isVerified ? `${item.ratio}%` : "Pending Verification"}
                    </span>
                  </div>

                  {/* Score */}
                  <div className="text-left sm:text-right">
                    <span className="text-[11px] uppercase tracking-wider text-muted-foreground block font-medium">
                      Score
                    </span>
                    <span className="text-sm font-bold text-foreground">
                      {item.isVerified ? `${item.score} / 100` : "-"}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setActiveDriverIdForBreakdown(item.driver.id);
                        handleDriverSelectChange(item.driver.id);
                        setIsVerifyModalOpen(true);
                      }}
                      className="text-xs cursor-pointer border-border hover:bg-muted"
                    >
                      {item.isVerified ? "Edit Verification" : "Verify Hours"}
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
                        {item.rewardGranted ? "Bonus Paid" : "Grant Bonus"}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* DRIVER WEEKLY BOOKINGS BREAKDOWN SECTION */}
      <div className="space-y-4 pt-6 border-t border-border">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Driver Weekly Bookings & Performance Details
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Select a driver to view all bookings made during{" "}
              <strong className="text-foreground">{selectedWeekInfo.rangeText}</strong>.
            </p>
          </div>

          {/* Driver Selector */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-muted-foreground whitespace-nowrap">
              Select Driver:
            </label>
            <select
              value={activeDriverIdForBreakdown}
              onChange={(e) => setActiveDriverIdForBreakdown(e.target.value)}
              className="rounded-lg border border-border bg-card px-3 py-2 text-xs text-foreground font-semibold focus:outline-none focus:ring-2 focus:ring-primary/50 cursor-pointer"
            >
              {initialDrivers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.employeeId})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Active Driver Weekly Overview Card */}
        {activeDriverBreakdownData && (
          <div className="p-4 rounded-xl border border-border bg-card space-y-4 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                  {activeDriverBreakdownData.driver.name.charAt(0)}
                </div>
                <div>
                  <h3 className="font-bold text-foreground text-base">
                    {activeDriverBreakdownData.driver.name}
                  </h3>
                  <span className="text-xs text-muted-foreground font-mono">
                    Employee ID: {activeDriverBreakdownData.driver.employeeId}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {/* Work Status Badge */}
                {activeDriverBreakdownData.isWorkCompleted ? (
                  <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold border border-emerald-500/20 flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Work Completed
                  </span>
                ) : (
                  <span className="px-3 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-bold border border-amber-500/20 flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    Work In Progress / Pending
                  </span>
                )}

                {/* Booked Hours Badge */}
                <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-extrabold border border-primary/20">
                  Booked Hours: {activeDriverBreakdownData.bookedHours}h
                </span>

                <Button
                  size="sm"
                  onClick={() => {
                    handleDriverSelectChange(activeDriverBreakdownData.driver.id);
                    setIsVerifyModalOpen(true);
                  }}
                  className="text-xs font-semibold cursor-pointer"
                >
                  {activeDriverBreakdownData.isWorkCompleted
                    ? "Verify Driving Hours"
                    : "View Verification"}
                </Button>
              </div>
            </div>

            {/* Bookings Table */}
            <div>
              <h4 className="text-xs font-bold text-foreground uppercase tracking-wider mb-2">
                Bookings Made During {selectedWeekInfo.weekLabel} ({driverBookingsForSelectedWeek.length})
              </h4>

              {driverBookingsForSelectedWeek.length > 0 ? (
                <div className="rounded-lg border border-border overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-muted/60 text-muted-foreground uppercase font-semibold border-b border-border">
                      <tr>
                        <th className="px-3 py-2.5">Trip #</th>
                        <th className="px-3 py-2.5">Vehicle</th>
                        <th className="px-3 py-2.5">Route (Pickup → Drop)</th>
                        <th className="px-3 py-2.5">Scheduled Slot</th>
                        <th className="px-3 py-2.5 font-mono">Booked Hours</th>
                        <th className="px-3 py-2.5 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {driverBookingsForSelectedWeek.map((trip) => {
                        const start = new Date(trip.startTime);
                        const end = new Date(trip.endTime);
                        const durationHrs = Math.round(((end.getTime() - start.getTime()) / (1000 * 60 * 60)) * 10) / 10;
                        const isFinished = trip.status === "COMPLETED" || end <= new Date();

                        return (
                          <tr key={trip.id} className="hover:bg-muted/30 transition-colors">
                            <td className="px-3 py-2.5 font-bold font-mono text-primary">
                              {trip.tripNumber || "WRK-N/A"}
                            </td>
                            <td className="px-3 py-2.5 font-medium text-foreground">
                              {trip.vehicle?.name ? (
                                <span>
                                  {trip.vehicle.name}{" "}
                                  <span className="text-[11px] text-muted-foreground font-mono">
                                    ({trip.vehicle.vehicleNumber})
                                  </span>
                                </span>
                              ) : (
                                "Vehicle N/A"
                              )}
                            </td>
                            <td className="px-3 py-2.5 text-muted-foreground">
                              <span className="font-semibold text-foreground">{trip.pickup || "HQ"}</span>
                              {" → "}
                              <span className="font-semibold text-foreground">{trip.destination || "Destination"}</span>
                            </td>
                            <td className="px-3 py-2.5 text-muted-foreground font-mono">
                              {formatShortDateString(start)} {formatTimeString(start)} - {formatTimeString(end)}
                            </td>
                            <td className="px-3 py-2.5 font-mono font-bold text-foreground">
                              {durationHrs} Hours
                            </td>
                            <td className="px-3 py-2.5 text-right">
                              <span
                                className={cn(
                                  "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                                  trip.status === "COMPLETED" || isFinished
                                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                                    : trip.status === "CANCELLED"
                                    ? "bg-red-500/10 text-red-500 border border-red-500/20"
                                    : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
                                )}
                              >
                                {trip.status === "COMPLETED"
                                  ? "COMPLETED"
                                  : isFinished
                                  ? "DRIVING FINISHED"
                                  : trip.status}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-6 text-center text-xs text-muted-foreground border border-dashed border-border rounded-lg bg-muted/20">
                  No bookings recorded for {activeDriverBreakdownData.driver.name} during {selectedWeekInfo.weekLabel}.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* HISTORICAL PERFORMANCE VERIFICATION LOGS TABLE */}
      <div className="space-y-4 pt-4 border-t border-border">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-foreground">Verification & Reward Audit History</h3>
            <p className="text-xs text-muted-foreground">
              Complete records of manually verified actual hours and awarded bonuses.
            </p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search driver name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-lg border border-border bg-card pl-9 pr-4 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/60 text-muted-foreground uppercase font-semibold tracking-wider border-b border-border">
                <tr>
                  <th className="px-4 py-3">Driver</th>
                  <th className="px-4 py-3">Period</th>
                  <th className="px-4 py-3 font-mono">Booked Hours</th>
                  <th className="px-4 py-3 font-mono">Actual Hours</th>
                  <th className="px-4 py-3">Ratio</th>
                  <th className="px-4 py-3">Score</th>
                  <th className="px-4 py-3">Bonus / Reward</th>
                  <th className="px-4 py-3">Verified By</th>
                  <th className="px-4 py-3 text-right">Actions</th>
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
                      <td className="px-4 py-3.5 font-medium text-foreground">
                        <div>
                          <span className="font-bold">{record.driver?.name || "Unknown Driver"}</span>
                          <span className="text-[11px] text-muted-foreground block font-mono">
                            {record.driver?.employeeId}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-muted-foreground">
                        <span className="px-2 py-0.5 rounded bg-muted font-medium">
                          {record.weekLabel || `${record.periodType} ${record.year}`}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 font-mono text-foreground font-medium">
                        {record.bookedHours} Hours
                      </td>
                      <td className="px-4 py-3.5 font-mono text-primary font-bold">
                        {record.actualHours} Hours
                      </td>
                      <td className="px-4 py-3.5 font-mono font-bold">
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
                      <td className="px-4 py-3.5 font-semibold text-foreground">
                        {record.score} / 100
                      </td>
                      <td className="px-4 py-3.5">
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
                      <td className="px-4 py-3.5 text-muted-foreground">
                        <div>
                          <span>{record.verifiedBy || "Admin"}</span>
                          <span className="text-[10px] text-muted-foreground block">
                            {formatDateString(record.verifiedAt)}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-right">
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
                    <td colSpan={9} className="text-center py-8 text-muted-foreground">
                      No verified driver performance logs recorded yet. Click "Verify Driving Hours" above to manually verify driver hours.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* MODAL 1: VERIFY MANUAL DRIVING HOURS */}
      {isVerifyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl p-6 relative animate-in fade-in zoom-in duration-200">
            <button
              onClick={() => setIsVerifyModalOpen(false)}
              className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-3 mb-5">
              <div className="p-2 rounded-xl bg-primary/10 text-primary">
                <Clock className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground">
                  Manual Driving Hours Verification
                </h3>
                <p className="text-xs text-muted-foreground">
                  Verify driver actual driving hours against booked hours for{" "}
                  <strong className="text-foreground">
                    {modalPeriod === "THIS_WEEK" ? "This Week" : "This Month"}
                  </strong>.
                </p>
              </div>
            </div>

            <form onSubmit={handleVerifySubmit} className="space-y-4">
              {/* Select Period: This Week or This Month */}
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Select Period *
                </label>
                <div className="grid grid-cols-2 gap-2 bg-muted/60 p-1 rounded-lg">
                  <button
                    type="button"
                    onClick={() => handleModalPeriodToggle("THIS_WEEK")}
                    className={cn(
                      "py-2 text-xs font-semibold rounded-md transition-all cursor-pointer flex items-center justify-center gap-1.5",
                      modalPeriod === "THIS_WEEK"
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Calendar className="h-3.5 w-3.5" />
                    This Week
                  </button>
                  <button
                    type="button"
                    onClick={() => handleModalPeriodToggle("THIS_MONTH")}
                    className={cn(
                      "py-2 text-xs font-semibold rounded-md transition-all cursor-pointer flex items-center justify-center gap-1.5",
                      modalPeriod === "THIS_MONTH"
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <CalendarDays className="h-3.5 w-3.5" />
                    This Month
                  </button>
                </div>
              </div>

              {/* Driver Select with Period Booking Hours */}
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Select Driver *
                </label>
                <select
                  value={selectedDriverId}
                  onChange={(e) => handleDriverSelectChange(e.target.value)}
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 cursor-pointer"
                  required
                >
                  {initialDrivers.map((d) => {
                    const hrs = getModalBookedHours(d.id, modalPeriod);
                    return (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.employeeId}) — {hrs}h Booked
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Booked Hours vs Actual Hours inputs */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Booking Hours (Allotted) *
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={inputBookedHours}
                    onChange={(e) => setInputBookedHours(e.target.value)}
                    placeholder="e.g. 10"
                    className="w-full rounded-lg border border-border bg-card px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 font-mono"
                    required
                  />
                  <span className="text-[10px] text-muted-foreground mt-0.5 block">
                    Allotted for {modalPeriod === "THIS_WEEK" ? "This Week" : "This Month"}: {autoBookedHoursForModal}h
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1 flex items-center justify-between">
                    <span>Actual Driving Hours *</span>
                    {!isWorkCompletedForModal ? (
                      <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold flex items-center gap-1">
                        <Lock className="h-3 w-3" /> Booking Pending
                      </span>
                    ) : (
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                        <Unlock className="h-3 w-3" /> Booking Completed
                      </span>
                    )}
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    disabled={!isWorkCompletedForModal}
                    value={inputActualHours}
                    onChange={(e) => setInputActualHours(e.target.value)}
                    placeholder={!isWorkCompletedForModal ? "Disabled until booking time is completed" : "e.g. 9"}
                    className={cn(
                      "w-full rounded-lg border px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 font-mono",
                      !isWorkCompletedForModal
                        ? "bg-muted/60 text-muted-foreground border-amber-500/30 cursor-not-allowed opacity-75"
                        : "bg-card border-border focus:ring-primary/50"
                    )}
                    required
                  />
                  <span className="text-[10px] text-muted-foreground mt-0.5 block">
                    {!isWorkCompletedForModal
                      ? "Actual Driving Hours field is locked until the driver completes the booked time."
                      : "Verified actual driving hours entered by Admin"}
                  </span>
                </div>
              </div>

              {/* Live Ratio & Score Preview Card */}
              <div className="p-3.5 rounded-xl bg-muted/50 border border-border space-y-2">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                  Calculated Ratio & Score
                </span>
                <div className="flex items-center justify-between text-xs font-mono">
                  <span>
                    Booked vs Actual Ratio:{" "}
                    <strong className="text-primary font-bold">{liveRatio}%</strong>
                  </span>
                  <span>
                    Score:{" "}
                    <strong
                      className={cn(
                        "font-bold",
                        liveScore >= 80 ? "text-emerald-500" : "text-amber-500"
                      )}
                    >
                      {liveScore} / 100
                    </strong>
                  </span>
                </div>

                {liveRatio >= 85 && (
                  <div className="text-[11px] text-emerald-500 font-medium flex items-center gap-1">
                    <Sparkles className="h-3 w-3" /> Driver qualifies for Top Performance Bonus!
                  </div>
                )}
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
                  placeholder="e.g. Verified odometer log and shift check-in timestamp."
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
                  type="button"
                  variant="outline"
                  onClick={() => setIsVerifyModalOpen(false)}
                  className="text-xs cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting || !isWorkCompletedForModal}
                  className="text-xs bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? "Saving..." : "Verify & Save Performance"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: GRANT BONUS / REWARD */}
      {isRewardModalOpen && selectedRecordForReward && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl p-6 relative animate-in fade-in zoom-in duration-200">
            <button
              onClick={() => setIsRewardModalOpen(false)}
              className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
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
