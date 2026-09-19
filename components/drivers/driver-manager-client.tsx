"use client";

import React, { useState, useTransition, useEffect, useCallback, useMemo } from "react";
import { User, Vehicle, Trip } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { bookCarAction, cancelBookingAction } from "@/actions/driver-trips";
import { assignVehicleToDriver } from "@/actions/vehicles";
import { Search, Plus, Clock, MapPin, CheckCircle2, ChevronRight, UserCheck, Truck } from "lucide-react";
import { useTranslation } from "@/components/layout/language-provider";
import { useRouter } from "next/navigation";
import { cn } from "@/utils/cn";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { registerUser } from "@/actions/register";
import { Mail, Lock, CreditCard, Calendar, Briefcase, ShieldAlert, AlertCircle, Loader2, User as UserIcon, Eye, EyeOff, Upload } from "lucide-react";
import { isWeakPassword } from "@/lib/auth-utils";

const passwordValidation = z.string()
  .min(8, "Password must be at least 8 characters long")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[0-9]/, "Password must contain at least one number")
  .regex(/[^a-zA-Z0-9]/, "Password must contain at least one special character")
  .refine((val) => !isWeakPassword(val), {
    message: "Simple or weak passwords are not accepted"
  });

const registerSchema = z.object({
  name: z.string().min(2, "Full Name is required"),
  ssn: z.string().min(5, "Social Security Number (SSN) is required"),
  homeAddress: z.string().min(5, "Home Address is required"),
  email: z.string().email("Please enter a valid email address"),
  phone: z.string().min(8, "Phone number is required"),
  password: passwordValidation,
  confirmPassword: z.string().min(1, "Please confirm your password"),
  licenseNumber: z.string().min(5, "License number is required"),
  licenseIssueDate: z.string().min(1, "License issue date is required"),
  licenseExpiry: z.string().min(1, "License expiry date is required"),
  profilePicture: z.string().optional(),
  experience: z.number().min(0, "Experience must be a positive number"),
  emergencyContact: z.string().min(10, "Emergency contact must be at least 10 digits"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

type RegisterFormValues = z.infer<typeof registerSchema>;

interface DriverManagerProps {
  drivers: (User & { assignedVehicle?: Vehicle | null })[];
  bookings: (Trip & { driver?: User | null; vehicle?: Vehicle | null })[];
  vehicles: (Vehicle & { assignedDrivers?: User[] })[];
  currentUserName: string;
}

export function DriverManagerClient({ drivers, bookings, vehicles, currentUserName }: DriverManagerProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(drivers[0]?.id || null);
  const [allocationVehicleId, setAllocationVehicleId] = useState("");
  const [confirmReassign, setConfirmReassign] = useState(false);
  const [replaceDriverId, setReplaceDriverId] = useState<string>("");
  const [sendingNotifId, setSendingNotifId] = useState<string | null>(null);
  const [notifSuccess, setNotifSuccess] = useState<string | null>(null);

  useEffect(() => {
    setReplaceDriverId("");
  }, [allocationVehicleId, selectedDriverId]);

  // Booking Modal State
  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState(false);

  // Live active bookings for selected vehicle (to show in the slots calendar)
  const [liveBookings, setLiveBookings] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [clickedBookedSlot, setClickedBookedSlot] = useState<any>(null);
  const [activeField, setActiveField] = useState<"from" | "to">("from");

  // Register Driver popup states
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [registerSuccess, setRegisterSuccess] = useState(false);
  const [isRegisterLoading, setIsRegisterLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [profileImagePreview, setProfileImagePreview] = useState<string | null>(null);
  const [profileImageSizeKb, setProfileImageSizeKb] = useState<number | null>(null);
  const [profileImageError, setProfileImageError] = useState<string | null>(null);

  // Helper to compress and resize images up to 500 KB limit
  const compressImageFile = (file: File): Promise<{ dataUrl: string; sizeKb: number }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const MAX_WIDTH = 600;
          const MAX_HEIGHT = 600;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height = Math.round((height * MAX_WIDTH) / width);
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width = Math.round((width * MAX_HEIGHT) / height);
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
            // Calculate base64 size in KB
            const sizeKb = Math.round((dataUrl.length * 3) / 4 / 1024);
            resolve({ dataUrl, sizeKb });
          } else {
            const dataUrl = event.target?.result as string;
            const sizeKb = Math.round((dataUrl.length * 3) / 4 / 1024);
            resolve({ dataUrl, sizeKb });
          }
        };
        img.onerror = (err) => reject(err);
      };
      reader.onerror = (err) => reject(err);
    });
  };


  const {
    register: registerField,
    handleSubmit: handleRegisterSubmit,
    setValue,
    formState: { errors: registerErrors },
    reset: resetRegisterForm,
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: "",
      ssn: "",
      homeAddress: "",
      email: "",
      phone: "",
      password: "",
      confirmPassword: "",
      licenseNumber: "",
      licenseIssueDate: "",
      licenseExpiry: "",
      profilePicture: "",
      experience: 0,
      emergencyContact: "",
    },
  });


  const onRegisterSubmit = async (data: RegisterFormValues) => {
    setIsRegisterLoading(true);
    setRegisterError(null);

    try {
      const result = await registerUser({
        name: data.name,
        ssn: data.ssn,
        homeAddress: data.homeAddress,
        email: data.email,
        phone: data.phone,
        password: data.password,
        licenseNumber: data.licenseNumber,
        licenseIssueDate: data.licenseIssueDate,
        licenseExpiry: data.licenseExpiry,
        profilePicture: data.profilePicture,
        experience: data.experience,
        emergencyContact: data.emergencyContact,
      });

      if (result.error) {
        setRegisterError(result.error);
        setIsRegisterLoading(false);
      } else {
        setRegisterSuccess(true);
        setIsRegisterLoading(false);
        setTimeout(() => {
          setIsRegisterOpen(false);
          setRegisterSuccess(false);
          resetRegisterForm();
          router.refresh();
        }, 2000);
      }
    } catch (err) {
      setRegisterError("An unexpected error occurred. Please try again.");
      setIsRegisterLoading(false);
    }
  };

  const handleSendExpiryAlert = async (driverId: string) => {
    setSendingNotifId(driverId);
    setNotifSuccess(null);
    try {
      const res = await fetch(`/api/notifications/check-expiry?driverId=${driverId}`);
      if (res.ok) {
        setNotifSuccess("License expiry notification (email & website) dispatched successfully!");
        setTimeout(() => setNotifSuccess(null), 4000);
      } else {
        alert("Failed to send notification alert.");
      }
    } catch (err) {
      console.error(err);
      alert("Error triggering notification alert.");
    } finally {
      setSendingNotifId(null);
    }
  };


  const [bookingForm, setBookingForm] = useState({
    vehicleId: "",
    startTime: "",
    endTime: "",
    pickup: "",
    destination: "",
    purpose: "Corporate Duty",
    notes: "",
  });

  const filteredDrivers = drivers.filter((d) =>
    d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.employeeId.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const activeDriver = useMemo(() => {
    return drivers.find((d) => d.id === selectedDriverId) || drivers[0] || null;
  }, [drivers, selectedDriverId]);

  // Filter bookings for selected driver
  const driverBookings = activeDriver
    ? bookings.filter((b) => b.driverId === activeDriver.id)
    : [];

  const now = new Date();

  // Categorize selected driver bookings
  const upcomingBookings = driverBookings.filter(
    (b) => new Date(b.endTime) > now && b.status !== "CANCELLED" && b.status !== "COMPLETED"
  ).sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

  const pastBookings = driverBookings.filter(
    (b) => new Date(b.endTime) <= now || b.status === "CANCELLED" || b.status === "COMPLETED"
  ).sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

  // Date strip window dates
  const [windowDates, setWindowDates] = useState<Date[]>([]);
  useEffect(() => {
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

  // Helper: fetch live bookings for active vehicle
  const fetchLiveBookings = useCallback(async (vehicleId: string) => {
    try {
      const res = await fetch(`/api/bookings?vehicleId=${vehicleId}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      if (data.bookings) {
        setLiveBookings(data.bookings);
      }
    } catch {
      // silently ignore network errors
    }
  }, []);

  // Poll for live bookings when vehicle is selected in form
  useEffect(() => {
    if (!bookingForm.vehicleId || !isBookingOpen) return;
    fetchLiveBookings(bookingForm.vehicleId);
    const interval = setInterval(() => fetchLiveBookings(bookingForm.vehicleId), 20000);
    return () => clearInterval(interval);
  }, [bookingForm.vehicleId, isBookingOpen, fetchLiveBookings]);

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
    
    return liveBookings.find((b) => {
      const bStart = new Date(b.startTime);
      const bEnd = new Date(b.endTime);
      return (bStart < slotEnd && bEnd > slotStart);
    });
  };

  const handleSlotClick = (slot: any) => {
    setFormError(null);
    setFormSuccess(false);

    const slotStart = slot.startStr;
    const slotEnd = slot.endStr;

    // Check conflict for a given start and end range
    const checkDriverConflict = (startStr: string, endStr: string) => {
      const s = new Date(startStr);
      const e = new Date(endStr);
      return bookings.some((b) => {
        if (b.status === "CANCELLED" || b.status === "COMPLETED") return false;
        if (b.driverId !== activeDriver?.id) return false;
        const bStart = new Date(b.startTime);
        const bEnd = new Date(b.endTime);
        return bStart < e && bEnd > s;
      });
    };

    if (activeField === "from" || !bookingForm.startTime) {
      // Selecting / setting From Time
      const proposedStart = slotStart;
      const proposedEnd = bookingForm.endTime;

      if (proposedEnd && new Date(proposedEnd) > new Date(proposedStart)) {
        // Range validation
        if (new Date(proposedEnd).getTime() - new Date(proposedStart).getTime() > 12 * 60 * 60 * 1000) {
          setBookingForm({
            ...bookingForm,
            startTime: proposedStart,
            endTime: "",
          });
          setActiveField("to");
          return;
        }

        const startValDate = new Date(proposedStart);
        const endValDate = new Date(proposedEnd);
        const hasConflictInBetween = liveBookings.some((b) => {
          const bStart = new Date(b.startTime);
          const bEnd = new Date(b.endTime);
          return bStart < endValDate && bEnd > startValDate;
        });

        if (hasConflictInBetween) {
          setFormError("The selected range overlaps with an existing booking.");
          setBookingForm({
            ...bookingForm,
            startTime: proposedStart,
            endTime: "",
          });
          setActiveField("to");
          return;
        }

        if (checkDriverConflict(proposedStart, proposedEnd)) {
          setFormError("The selected driver already has another booking during this time slot.");
          setBookingForm({
            ...bookingForm,
            startTime: "",
            endTime: "",
          });
          setActiveField("from");
          return;
        }

        setBookingForm({
          ...bookingForm,
          startTime: proposedStart,
        });
        setActiveField("to");
      } else {
        // No valid end time set, validate only the selected single slot
        if (checkDriverConflict(proposedStart, slotEnd)) {
          setFormError("The selected driver already has another booking during this time slot.");
          setBookingForm({
            ...bookingForm,
            startTime: "",
            endTime: "",
          });
          setActiveField("from");
          return;
        }

        setBookingForm({
          ...bookingForm,
          startTime: proposedStart,
          endTime: "",
        });
        setActiveField("to");
      }
    } else {
      // activeField === "to" and bookingForm.startTime is set
      const startVal = new Date(bookingForm.startTime).getTime();
      const clickedVal = new Date(slotStart).getTime();

      if (clickedVal <= startVal) {
        // Reset From to this slot and clear To
        if (checkDriverConflict(slotStart, slotEnd)) {
          setFormError("The selected driver already has another booking during this time slot.");
          setBookingForm({
            ...bookingForm,
            startTime: "",
            endTime: "",
          });
          setActiveField("from");
          return;
        }

        setBookingForm({
          ...bookingForm,
          startTime: slotStart,
          endTime: "",
        });
        setActiveField("to");
      } else {
        // Valid proposed range
        if (clickedVal - startVal > 12 * 60 * 60 * 1000) {
          setFormError("Booking duration cannot exceed 12 hours.");
          return;
        }

        const startValDate = new Date(bookingForm.startTime);
        const endValDate = new Date(slotStart);
        const hasConflictInBetween = liveBookings.some((b) => {
          const bStart = new Date(b.startTime);
          const bEnd = new Date(b.endTime);
          return bStart < endValDate && bEnd > startValDate;
        });

        if (hasConflictInBetween) {
          setFormError("The selected range overlaps with an existing booking.");
          return;
        }

        if (checkDriverConflict(bookingForm.startTime, slotStart)) {
          setFormError("The selected driver already has another booking during this time slot.");
          setBookingForm({
            ...bookingForm,
            startTime: "",
            endTime: "",
          });
          setActiveField("from");
          return;
        }

        setBookingForm({
          ...bookingForm,
          endTime: slotStart,
        });
      }
    }
    setClickedBookedSlot(null);
  };

  const handleOpenBooking = () => {
    setBookingForm({
      vehicleId: vehicles[0]?.id || "",
      startTime: "",
      endTime: "",
      pickup: "",
      destination: "",
      purpose: "Corporate Duty",
      notes: "",
    });
    setFormError(null);
    setFormSuccess(false);
    setSelectedDate(new Date());
    setLiveBookings([]);
    setIsBookingOpen(true);
    setActiveField("from");
  };

  const handleBookingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!activeDriver) return;
    if (!bookingForm.vehicleId) {
      setFormError("Please select a vehicle.");
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

    startTransition(async () => {
      const res = await bookCarAction({
        vehicleId: bookingForm.vehicleId,
        driverId: activeDriver.id,
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        pickup: bookingForm.pickup,
        destination: bookingForm.destination,
        purpose: bookingForm.purpose,
        notes: bookingForm.notes || undefined,
        assignedBy: "ADMIN",
        requestedBy: `ADMIN (${currentUserName})`,
      });

      if (res.error) {
        setFormError(res.error);
      } else {
        setFormSuccess(true);
        setActiveField("from");
        setTimeout(() => {
          setIsBookingOpen(false);
          router.refresh();
        }, 1500);
      }
    });
  };

  const currentAssignedCar = activeDriver?.assignedVehicle || null;

  const selectedAllocVehicle = useMemo(() => {
    return vehicles.find((v) => v.id === allocationVehicleId) || null;
  }, [vehicles, allocationVehicleId]);

  const assignedDrivers = selectedAllocVehicle?.assignedDrivers || [];
  const assignedDriversCount = assignedDrivers.length;

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">Driver Management & Booking</h2>
          <p className="text-sm text-muted-foreground">
            View registered drivers, search booking schedules, and reserve vehicle slots on their behalf.
          </p>
        </div>
        <Button
          onClick={() => setIsRegisterOpen(true)}
          className="bg-amber-500 hover:bg-amber-600 text-zinc-950 font-bold shrink-0"
        >
          <Plus className="h-4.5 w-4.5 mr-2" /> Register Driver
        </Button>
      </div>

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Drivers List (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4.5 w-4.5 text-muted-foreground" />
            <Input
              placeholder="Search driver by name or ID..."
              className="pl-10 bg-card"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="border border-border rounded-xl bg-card overflow-hidden divide-y divide-border">
            <div className="p-3 bg-muted/20 font-bold text-xs uppercase text-muted-foreground tracking-wider flex justify-between items-center">
              <span>Drivers ({filteredDrivers.length})</span>
            </div>
            <div className="max-h-[550px] overflow-y-auto divide-y divide-border/60">
              {filteredDrivers.map((driver) => {
                const isSelected = activeDriver?.id === driver.id;
                return (
                  <button
                    key={driver.id}
                    onClick={() => {
                      setSelectedDriverId(driver.id);
                      setAllocationVehicleId("");
                      setConfirmReassign(false);
                      setFormError(null);
                    }}
                    className={`w-full text-left p-4 transition-all duration-150 flex items-center justify-between border-none ${
                      isSelected
                        ? "bg-primary/10 text-primary border-l-4 border-l-primary font-semibold"
                        : "hover:bg-muted/30 text-foreground"
                    }`}
                  >
                    <div>
                      <span className="block text-sm">{driver.name}</span>
                      <span className="block text-[10px] text-muted-foreground font-mono mt-0.5">{driver.employeeId}</span>
                    </div>
                    <ChevronRight className={`h-4.5 w-4.5 transition-transform ${isSelected ? 'translate-x-1 text-primary' : 'text-muted-foreground'}`} />
                  </button>
                );
              })}
              {filteredDrivers.length === 0 && (
                <div className="p-8 text-center text-xs text-muted-foreground italic">
                  No drivers found.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Driver Details & Bookings (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          {activeDriver ? (
            <div className="space-y-6">
              {/* Driver Summary & Profile Card */}
              <div className="p-6 border border-border bg-card rounded-xl space-y-6 glass">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                  {/* Left Profile Avatar & Basic Info */}
                  <div className="flex items-start gap-4">
                    {activeDriver.profilePicture ? (
                      <img
                        src={activeDriver.profilePicture}
                        alt={activeDriver.name}
                        className="w-16 h-16 rounded-full object-cover border-2 border-amber-500 shadow-md shrink-0"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-amber-500/10 border-2 border-amber-500/30 flex items-center justify-center text-amber-500 font-bold text-xl shrink-0">
                        {activeDriver.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Driver Profile</span>
                        <Badge variant="outline" className="text-[10px] font-mono bg-muted">
                          {activeDriver.employeeId}
                        </Badge>
                      </div>
                      <h3 className="text-2xl font-bold text-foreground flex items-center gap-2">
                        {activeDriver.name}
                      </h3>
                      <p className="text-xs text-muted-foreground">{activeDriver.email} &bull; {activeDriver.phone || "No Phone Registered"}</p>
                    </div>
                  </div>

                  {/* Right Action Buttons */}
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <Button onClick={handleOpenBooking} className="bg-amber-500 hover:bg-amber-600 text-zinc-950 font-bold text-xs">
                      <Plus className="h-4 w-4 mr-1.5" /> Book Slot on Behalf
                    </Button>
                    <a href="/admin/accounting" className="inline-flex items-center justify-center rounded-md text-xs font-semibold ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3">
                      <CreditCard className="h-4 w-4 mr-1.5 text-emerald-500" /> Salary Details
                    </a>
                  </div>
                </div>

                {/* Notification Alert Message if sent */}
                {notifSuccess && (
                  <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-xs text-green-600 dark:text-green-400 font-medium">
                    {notifSuccess}
                  </div>
                )}

                {/* Mandatory Driver Profile Details Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 p-4 rounded-xl bg-muted/20 border border-border/60 text-xs">
                  <div>
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase block">Full Name</span>
                    <span className="font-bold text-foreground text-sm">{activeDriver.name}</span>
                  </div>

                  <div>
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase block">Social Security Number (SSN)</span>
                    <span className="font-mono font-bold text-foreground">{activeDriver.ssn || "N/A"}</span>
                  </div>

                  <div>
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase block">Home Address</span>
                    <span className="font-medium text-foreground">{activeDriver.homeAddress || "N/A"}</span>
                  </div>

                  <div>
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase block">Phone Number</span>
                    <span className="font-medium text-foreground">{activeDriver.phone || "N/A"}</span>
                  </div>

                  <div>
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase block">Taxi License Issue Date</span>
                    <span className="font-medium text-foreground">
                      {activeDriver.licenseIssueDate
                        ? new Date(activeDriver.licenseIssueDate).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
                        : "N/A"}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase block">Taxi License Expiry Date</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="font-bold text-foreground">
                        {activeDriver.licenseExpiry
                          ? new Date(activeDriver.licenseExpiry).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
                          : "N/A"}
                      </span>
                      {activeDriver.licenseExpiry && (() => {
                        const days = Math.ceil((new Date(activeDriver.licenseExpiry).getTime() - new Date().getTime()) / (1000 * 3600 * 24));
                        if (days < 0) {
                          return <Badge className="bg-red-500/20 text-red-500 hover:bg-red-500/20 border-red-500/30 text-[9px]">Expired</Badge>;
                        } else if (days <= 30) {
                          return <Badge className="bg-amber-500/20 text-amber-500 hover:bg-amber-500/20 border-amber-500/30 text-[9px]">{days}d left</Badge>;
                        } else {
                          return <Badge className="bg-emerald-500/20 text-emerald-500 hover:bg-emerald-500/20 border-emerald-500/30 text-[9px]">Valid</Badge>;
                        }
                      })()}
                    </div>
                  </div>
                </div>

                {/* Expiry Notification Action Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="h-5 w-5 text-amber-500 shrink-0" />
                    <div>
                      <span className="text-xs font-bold text-foreground block">Taxi License Expiry Notification</span>
                      <span className="text-[11px] text-muted-foreground">Send instant automated email & website notification alert to driver.</span>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleSendExpiryAlert(activeDriver.id)}
                    disabled={sendingNotifId === activeDriver.id || !activeDriver.licenseExpiry}
                    className="border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 text-xs font-bold shrink-0 cursor-pointer"
                  >
                    {sendingNotifId === activeDriver.id ? (
                      <>
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Sending...
                      </>
                    ) : (
                      <>
                        <Mail className="mr-1.5 h-3.5 w-3.5" /> Dispatch Expiry Alert
                      </>
                    )}
                  </Button>
                </div>


                {/* Permanent Vehicle Allocation Section */}
                <div className="border-t border-border/30 pt-4 mt-2 space-y-2">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">Permanent Vehicle Allocation</span>
                  {currentAssignedCar ? (
                    <div className="flex items-center justify-between bg-primary/5 p-3 rounded-lg border border-primary/20">
                      <div className="flex items-center gap-2">
                        {(currentAssignedCar as any).imageUrl ? (
                          <img 
                            src={(currentAssignedCar as any).imageUrl} 
                            alt={currentAssignedCar.name} 
                            className="w-8 h-8 rounded object-cover border border-border shrink-0" 
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded bg-muted flex items-center justify-center border border-border shrink-0">
                            <Truck className="h-4.5 w-4.5 text-muted-foreground" />
                          </div>
                        )}
                        <div>
                          <span className="text-xs text-foreground font-bold">{currentAssignedCar.name}</span>
                          <span className="text-[10px] text-muted-foreground block font-mono">({currentAssignedCar.vehicleNumber})</span>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          startTransition(async () => {
                            const res = await assignVehicleToDriver(null, activeDriver.id);
                            if (res.error) {
                              alert(res.error);
                            } else {
                              router.refresh();
                            }
                          });
                        }}
                        className="h-8 text-xs border-red-500/30 text-red-500 hover:bg-red-500/10 cursor-pointer"
                        disabled={isPending}
                      >
                        Unallocate Car
                      </Button>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      <div className="flex flex-col sm:flex-row gap-2">
                        <select
                          id="assign-vehicle-select"
                          className="flex h-9 w-full sm:w-64 rounded-lg border border-border bg-input px-3 py-1 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                          value={allocationVehicleId}
                          onChange={(e) => {
                            setAllocationVehicleId(e.target.value);
                          }}
                        >
                          <option value="" disabled>-- Allocate Vehicle --</option>
                          {vehicles.map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.name} ({v.vehicleNumber})
                            </option>
                          ))}
                        </select>
                        <Button
                          size="sm"
                          onClick={async () => {
                            if (!allocationVehicleId) return;
                            if (assignedDriversCount >= 2 && !replaceDriverId) {
                              alert(`Please select which of the two existing drivers should be replaced.`);
                              return;
                            }
                            startTransition(async () => {
                              const res = await assignVehicleToDriver(
                                allocationVehicleId,
                                activeDriver.id,
                                replaceDriverId || null
                              );
                              if (res.error) {
                                alert(res.error);
                              } else {
                                setAllocationVehicleId("");
                                setReplaceDriverId("");
                                router.refresh();
                              }
                            });
                          }}
                          className="bg-primary text-white font-semibold h-9 text-xs cursor-pointer"
                          disabled={isPending || (assignedDriversCount >= 2 && !replaceDriverId)}
                        >
                          Allocate Vehicle
                        </Button>
                      </div>

                      {/* Display assignment details and replacement option when vehicle is fully allocated (2 drivers) */}
                      {allocationVehicleId && assignedDriversCount >= 2 && (
                        <div className="border border-amber-500/30 rounded-lg p-3 bg-amber-500/5 space-y-2 max-w-xl">
                          <p className="text-xs text-amber-600 dark:text-amber-500 font-medium">
                            ⚠️ This vehicle is currently permanently assigned to two drivers: <strong>{assignedDrivers.map(d => d.name).join(" and ")}</strong>.
                          </p>
                          <p className="text-xs text-foreground font-semibold">
                            Which of the two existing drivers should be replaced/cancelled?
                          </p>
                          <div className="space-y-1.5 mt-1">
                            {assignedDrivers.map((d) => (
                              <div key={d.id} className="flex items-center gap-2">
                                <input
                                  type="radio"
                                  id={`replace-driver-${d.id}`}
                                  name="replaceDriver"
                                  value={d.id}
                                  checked={replaceDriverId === d.id}
                                  onChange={() => setReplaceDriverId(d.id)}
                                  className="h-4 w-4 border-border text-primary focus:ring-primary bg-input cursor-pointer"
                                />
                                <label htmlFor={`replace-driver-${d.id}`} className="text-xs text-foreground font-semibold cursor-pointer">
                                  {d.name} ({d.employeeId})
                                </label>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Upcoming Slots */}
              <div className="border border-border rounded-xl bg-card overflow-hidden">
                <div className="p-4 bg-muted/20 border-b border-border font-bold text-sm text-foreground flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                  Upcoming & Active Bookings ({upcomingBookings.length})
                </div>
                <div className="p-4 space-y-3">
                  {upcomingBookings.map((b) => (
                    <div key={b.id} className="p-4 border border-border/60 rounded-xl bg-muted/10 glass space-y-2">
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-2">
                          {(b.vehicle as any)?.imageUrl ? (
                            <img 
                              src={(b.vehicle as any).imageUrl} 
                              alt={b.vehicle?.name} 
                              className="w-8 h-8 rounded object-cover border border-border shrink-0" 
                              loading="lazy"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded bg-muted flex items-center justify-center border border-border shrink-0">
                              <Truck className="h-4.5 w-4.5 text-muted-foreground" />
                            </div>
                          )}
                          <div>
                            <span className="font-bold text-sm text-foreground block">{b.vehicle?.name}</span>
                            <span className="text-xs text-muted-foreground block font-mono">{b.vehicle?.vehicleNumber}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="info" className="uppercase text-[9px]">{b.status}</Badge>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="h-6 text-[10px] px-2 py-0.5 font-bold"
                            onClick={async () => {
                              if (confirm("Are you sure you want to cancel this booking?")) {
                                startTransition(async () => {
                                  const res = await cancelBookingAction(b.id);
                                  if (res.error) {
                                    alert(res.error);
                                  } else {
                                    router.refresh();
                                  }
                                });
                              }
                            }}
                            disabled={isPending}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs border-t border-border/30 pt-2.5 mt-2.5">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Clock className="h-3.5 w-3.5" />
                          <span suppressHydrationWarning>
                            {new Date(b.startTime).toLocaleString([], { dateStyle: "short", timeStyle: "short" })} - {new Date(b.endTime).toLocaleTimeString([], { timeStyle: "short" })}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <MapPin className="h-3.5 w-3.5" />
                          <span>{b.pickup} &rarr; {b.destination}</span>
                        </div>
                      </div>
                      {b.notes && (
                        <div className="bg-card/50 p-2 rounded border border-border/30 text-[11px] text-muted-foreground italic">
                          Notes: {b.notes}
                        </div>
                      )}
                    </div>
                  ))}
                  {upcomingBookings.length === 0 && (
                    <div className="text-center py-8 text-xs text-muted-foreground italic">
                      No upcoming bookings scheduled for this driver.
                    </div>
                  )}
                </div>
              </div>

              {/* Past Bookings */}
              <div className="border border-border rounded-xl bg-card overflow-hidden">
                <div className="p-4 bg-muted/20 border-b border-border font-bold text-sm text-foreground">
                  Past Booking History ({pastBookings.length})
                </div>
                <div className="p-4 space-y-3">
                  {pastBookings.map((b) => (
                    <div key={b.id} className="p-4 border border-border/40 rounded-xl bg-muted/5 space-y-2 opacity-85">
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-2">
                          {(b.vehicle as any)?.imageUrl ? (
                            <img 
                              src={(b.vehicle as any).imageUrl} 
                              alt={b.vehicle?.name} 
                              className="w-8 h-8 rounded object-cover border border-border shrink-0" 
                              loading="lazy"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded bg-muted flex items-center justify-center border border-border shrink-0">
                              <Truck className="h-4.5 w-4.5 text-muted-foreground" />
                            </div>
                          )}
                          <div>
                            <span className="font-medium text-sm text-foreground block">{b.vehicle?.name}</span>
                            <span className="text-xs text-muted-foreground block font-mono">{b.vehicle?.vehicleNumber}</span>
                          </div>
                        </div>
                        <Badge variant="secondary" className="uppercase text-[9px]">{b.status}</Badge>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs border-t border-border/20 pt-2 mt-2">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Clock className="h-3.5 w-3.5" />
                          <span suppressHydrationWarning>
                            {new Date(b.startTime).toLocaleString([], { dateStyle: "short", timeStyle: "short" })} - {new Date(b.endTime).toLocaleTimeString([], { timeStyle: "short" })}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <MapPin className="h-3.5 w-3.5" />
                          <span>{b.pickup} &rarr; {b.destination}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                  {pastBookings.length === 0 && (
                    <div className="text-center py-8 text-xs text-muted-foreground italic">
                      No historical bookings logged.
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-16 text-muted-foreground border border-dashed border-border rounded-xl bg-card">
              Please select a driver from the list to view their schedule.
            </div>
          )}
        </div>
      </div>

      {/* Book Slot on Behalf Modal */}
      {activeDriver && (
        <Dialog isOpen={isBookingOpen} onClose={() => setIsBookingOpen(false)} title={`Book Slot on Behalf of ${activeDriver.name}`}>
          <div className="space-y-4 max-h-[85vh] overflow-y-auto pr-1">
            {formError && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-xs text-red-600">
                {formError}
              </div>
            )}
            {formSuccess && (
              <div className="rounded-lg bg-green-500/10 border border-green-500/20 p-3 text-xs text-green-600 flex items-center gap-2">
                <CheckCircle2 className="h-4.5 w-4.5" /> Booking Created Successfully!
              </div>
            )}

            {/* Select Vehicle dropdown */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground block">Select Vehicle</label>
              <select
                className="flex h-10 w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-primary/50"
                value={bookingForm.vehicleId}
                onChange={(e) => {
                  setBookingForm({ ...bookingForm, vehicleId: e.target.value, startTime: "", endTime: "" });
                  setClickedBookedSlot(null);
                }}
                required
              >
                <option value="" disabled>-- Select Vehicle --</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} ({v.vehicleNumber}) &bull; {v.status}
                  </option>
                ))}
              </select>
            </div>

            {/* Date and Time slots selection */}
            {bookingForm.vehicleId && (
              <>
                <div className="space-y-2 border-t border-border/30 pt-4">
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
                  <div 
                    onClick={() => setActiveField("from")}
                    className={cn(
                      "relative border rounded-xl p-3 flex flex-col justify-between shadow-sm cursor-pointer transition-all",
                      activeField === "from"
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "border-border bg-card hover:border-primary/50 text-muted-foreground"
                    )}
                  >
                    <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider">From</span>
                    <div className="flex items-center gap-1.5 mt-1">
                      <Clock className="h-4 w-4 text-muted-foreground/60" />
                      <span className="text-sm font-extrabold text-foreground">
                        {bookingForm.startTime ? formatTo12Hour(bookingForm.startTime) : "HH:MM"}
                      </span>
                    </div>
                  </div>
                  <div 
                    onClick={() => setActiveField("to")}
                    className={cn(
                      "relative border rounded-xl p-3 flex flex-col justify-between shadow-sm cursor-pointer transition-all",
                      activeField === "to"
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "border-border bg-card hover:border-primary/50 text-muted-foreground"
                    )}
                  >
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
                        setActiveField("from");
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

                {/* Form fields */}
                <form onSubmit={handleBookingSubmit} className="space-y-4 border-t border-border/30 pt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-muted-foreground">Pickup Location</label>
                      <Input
                        placeholder="Base Depot / Airport"
                        value={bookingForm.pickup}
                        onChange={(e) => setBookingForm({ ...bookingForm, pickup: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-muted-foreground">Drop Location</label>
                      <Input
                        placeholder="Hotel / Corporate Office"
                        value={bookingForm.destination}
                        onChange={(e) => setBookingForm({ ...bookingForm, destination: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground">Purpose</label>
                    <Input
                      placeholder="Corporate Duty"
                      value={bookingForm.purpose}
                      onChange={(e) => setBookingForm({ ...bookingForm, purpose: e.target.value })}
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground">Notes (Optional)</label>
                    <textarea
                      className="flex min-h-[50px] w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      placeholder="Add notes for the trip..."
                      value={bookingForm.notes}
                      onChange={(e) => setBookingForm({ ...bookingForm, notes: e.target.value })}
                    />
                  </div>

                  <div className="flex justify-end gap-2 border-t border-border pt-4">
                    <Button type="button" variant="outline" onClick={() => setIsBookingOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={isPending} className="bg-amber-500 hover:bg-amber-600 text-zinc-950 font-bold">
                      {isPending ? "Booking..." : "Confirm Booking"}
                    </Button>
                  </div>
                </form>
              </>
            )}
          </div>
        </Dialog>
      )}

      {/* Register Driver Dialog Popup */}
      <Dialog 
        isOpen={isRegisterOpen} 
        onClose={() => {
          setIsRegisterOpen(false);
          setRegisterSuccess(false);
          setRegisterError(null);
          setProfileImagePreview(null);
          setProfileImageSizeKb(null);
          setProfileImageError(null);
          resetRegisterForm();
        }} 
        title="Register Driver"
        className="max-w-xl"
      >


        {registerSuccess ? (
          <div className="rounded-lg bg-green-500/10 border border-green-500/20 p-6 text-center text-green-600 dark:text-green-400 space-y-2">
            <h3 className="text-lg font-semibold">Registration Successful!</h3>
            <p className="text-sm">Driver profile has been created successfully.</p>
          </div>
        ) : (
          <form onSubmit={handleRegisterSubmit(onRegisterSubmit)} className="space-y-4">
            {registerError && (
              <div className="flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-600 dark:text-red-400">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <p>{registerError}</p>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Full Name */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground" htmlFor="reg-name">
                  Full Name
                </label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="reg-name"
                    type="text"
                    placeholder="John Doe"
                    className="pl-10 focus-visible:ring-amber-500"
                    disabled={isRegisterLoading}
                    {...registerField("name")}
                  />
                </div>
                {registerErrors.name && (
                  <p className="text-xs text-red-500 font-medium">{registerErrors.name.message}</p>
                )}
              </div>

              {/* Email Address */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground" htmlFor="reg-email">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="reg-email"
                    type="email"
                    placeholder="john.doe@company.com"
                    className="pl-10 focus-visible:ring-amber-500"
                    disabled={isRegisterLoading}
                    {...registerField("email")}
                  />
                </div>
                {registerErrors.email && (
                  <p className="text-xs text-red-500 font-medium">{registerErrors.email.message}</p>
                )}
              </div>

              {/* Password */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground" htmlFor="reg-password">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="reg-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    className="pl-10 pr-10 focus-visible:ring-amber-500"
                    disabled={isRegisterLoading}
                    {...registerField("password")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 h-4 w-4 text-muted-foreground hover:text-foreground cursor-pointer focus:outline-none bg-transparent border-none p-0 flex items-center justify-center"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {registerErrors.password && (
                  <p className="text-xs text-red-500 font-medium">{registerErrors.password.message}</p>
                )}
              </div>

              {/* Confirm Password */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground" htmlFor="reg-confirmPassword">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="reg-confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="••••••••"
                    className="pl-10 pr-10 focus-visible:ring-amber-500"
                    disabled={isRegisterLoading}
                    {...registerField("confirmPassword")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-3 h-4 w-4 text-muted-foreground hover:text-foreground cursor-pointer focus:outline-none bg-transparent border-none p-0 flex items-center justify-center"
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {registerErrors.confirmPassword && (
                  <p className="text-xs text-red-500 font-medium">{registerErrors.confirmPassword.message}</p>
                )}
              </div>

              {/* Social Security Number (SSN) */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground" htmlFor="reg-ssn">
                  Social Security Number (SSN)
                </label>
                <div className="relative">
                  <CreditCard className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="reg-ssn"
                    type="text"
                    placeholder="XXX-XX-XXXX"
                    className="pl-10 focus-visible:ring-amber-500"
                    disabled={isRegisterLoading}
                    {...registerField("ssn")}
                  />
                </div>
                {registerErrors.ssn && (
                  <p className="text-xs text-red-500 font-medium">{registerErrors.ssn.message}</p>
                )}
              </div>

              {/* Home Address */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground" htmlFor="reg-homeAddress">
                  Home Address
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="reg-homeAddress"
                    type="text"
                    placeholder="123 Main St, City, State"
                    className="pl-10 focus-visible:ring-amber-500"
                    disabled={isRegisterLoading}
                    {...registerField("homeAddress")}
                  />
                </div>
                {registerErrors.homeAddress && (
                  <p className="text-xs text-red-500 font-medium">{registerErrors.homeAddress.message}</p>
                )}
              </div>

              {/* Phone Number */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground" htmlFor="reg-phone">
                  Phone Number
                </label>
                <div className="relative">
                  <ShieldAlert className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="reg-phone"
                    type="tel"
                    placeholder="+1 (555) 019-2834"
                    className="pl-10 focus-visible:ring-amber-500"
                    disabled={isRegisterLoading}
                    {...registerField("phone")}
                  />
                </div>
                {registerErrors.phone && (
                  <p className="text-xs text-red-500 font-medium">{registerErrors.phone.message}</p>
                )}
              </div>

              {/* Driving License Number */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground" htmlFor="reg-licenseNumber">
                  Driving License Number
                </label>
                <div className="relative">
                  <CreditCard className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="reg-licenseNumber"
                    type="text"
                    placeholder="DL-8927491"
                    className="pl-10 focus-visible:ring-amber-500"
                    disabled={isRegisterLoading}
                    {...registerField("licenseNumber")}
                  />
                </div>
                {registerErrors.licenseNumber && (
                  <p className="text-xs text-red-500 font-medium">{registerErrors.licenseNumber.message}</p>
                )}
              </div>

              {/* Taxi License Issue Date */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground" htmlFor="reg-licenseIssueDate">
                  Taxi License Issue Date
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="reg-licenseIssueDate"
                    type="date"
                    className="pl-10 focus-visible:ring-amber-500"
                    disabled={isRegisterLoading}
                    {...registerField("licenseIssueDate")}
                  />
                </div>
                {registerErrors.licenseIssueDate && (
                  <p className="text-xs text-red-500 font-medium">{registerErrors.licenseIssueDate.message}</p>
                )}
              </div>

              {/* License Expiry */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground" htmlFor="reg-licenseExpiry">
                  Taxi License Expiry Date
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="reg-licenseExpiry"
                    type="date"
                    className="pl-10 focus-visible:ring-amber-500"
                    disabled={isRegisterLoading}
                    {...registerField("licenseExpiry")}
                  />
                </div>
                {registerErrors.licenseExpiry && (
                  <p className="text-xs text-red-500 font-medium">{registerErrors.licenseExpiry.message}</p>
                )}
              </div>

              {/* Profile Image Upload */}
              <div className="space-y-1 sm:col-span-2">
                <label className="text-xs font-semibold text-muted-foreground block">
                  Driver Profile Image (Max 500 KB)
                </label>
                <div className="flex items-start gap-4 p-3 rounded-xl bg-muted/20 border border-border/80">
                  {profileImagePreview ? (
                    <img
                      src={profileImagePreview}
                      alt="Driver Profile Preview"
                      className="w-16 h-16 rounded-full object-cover border-2 border-amber-500 shrink-0"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-amber-500/10 border-2 border-dashed border-amber-500/40 flex items-center justify-center text-amber-500 shrink-0">
                      <UserIcon className="h-7 w-7" />
                    </div>
                  )}
                  <div className="flex-1 space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <label
                        htmlFor="profile-picture-upload"
                        className="cursor-pointer inline-flex items-center justify-center rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-600 text-zinc-950 px-3 py-2 transition-colors shadow-sm"
                      >
                        <Upload className="h-3.5 w-3.5 mr-1.5" />
                        {profileImagePreview ? "Change Photo" : "Upload Profile Image"}
                      </label>
                      {profileImagePreview && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setProfileImagePreview(null);
                            setProfileImageSizeKb(null);
                            setProfileImageError(null);
                            setValue("profilePicture", "");
                          }}
                          className="text-xs text-red-500 hover:bg-red-500/10 h-8"
                        >
                          Remove
                        </Button>
                      )}
                    </div>

                    {/* Status & Size Info Badges */}
                    {profileImageError ? (
                      <p className="text-xs text-red-500 font-bold bg-red-500/10 border border-red-500/20 p-2 rounded-lg">
                        ⚠️ {profileImageError}
                      </p>
                    ) : profileImageSizeKb !== null ? (
                      <div className="flex items-center gap-2 text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                        <span>Compressed Size: {profileImageSizeKb} KB (Within 500 KB limit)</span>
                      </div>
                    ) : (
                      <p className="text-[10px] text-muted-foreground">
                        PNG, JPG or WebP images up to <strong>500 KB</strong>. Images are automatically optimized.
                      </p>
                    )}

                    <input
                      id="profile-picture-upload"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={isRegisterLoading}
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;

                        setProfileImageError(null);

                        try {
                          const { dataUrl, sizeKb } = await compressImageFile(file);

                          if (sizeKb > 500) {
                            setProfileImageError(`Image size (${sizeKb} KB) exceeds the 500 KB limit. Please choose a smaller photo.`);
                            setProfileImagePreview(null);
                            setProfileImageSizeKb(null);
                            setValue("profilePicture", "");
                          } else {
                            setProfileImagePreview(dataUrl);
                            setProfileImageSizeKb(sizeKb);
                            setValue("profilePicture", dataUrl);
                          }
                        } catch (err) {
                          console.error("Image processing error:", err);
                          setProfileImageError("Failed to process image file. Please try a different image.");
                        }
                      }}
                    />
                  </div>
                </div>
              </div>



              {/* Experience */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground" htmlFor="reg-experience">
                  Years of Experience
                </label>
                <div className="relative">
                  <Briefcase className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="reg-experience"
                    type="number"
                    placeholder="3"
                    className="pl-10 focus-visible:ring-amber-500"
                    disabled={isRegisterLoading}
                    {...registerField("experience", { valueAsNumber: true })}
                  />
                </div>
                {registerErrors.experience && (
                  <p className="text-xs text-red-500 font-medium">{registerErrors.experience.message}</p>
                )}
              </div>

              {/* Emergency Contact */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground" htmlFor="reg-emergencyContact">
                  Emergency Contact Number
                </label>
                <div className="relative">
                  <ShieldAlert className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="reg-emergencyContact"
                    type="tel"
                    placeholder="+1 (555) 901-2948"
                    className="pl-10 focus-visible:ring-amber-500"
                    disabled={isRegisterLoading}
                    {...registerField("emergencyContact")}
                  />
                </div>
                {registerErrors.emergencyContact && (
                  <p className="text-xs text-red-500 font-medium">{registerErrors.emergencyContact.message}</p>
                )}
              </div>
            </div>


            <Button type="submit" className="w-full mt-4 bg-amber-500 hover:bg-amber-600 text-zinc-950 font-bold" disabled={isRegisterLoading}>
              {isRegisterLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("register_driver")}...
                </>
              ) : (
                t("register_button")
              )}
            </Button>
          </form>
        )}
      </Dialog>
    </div>
  );
}
