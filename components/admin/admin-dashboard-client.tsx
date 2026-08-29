"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TableContainer, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { useTranslation } from "@/components/layout/language-provider";
import { Truck, Clock, Users } from "lucide-react";
import { Vehicle, User, Trip } from "@prisma/client";

interface AdminDashboardClientProps {
  vehicles: (Vehicle & { trips: (Trip & { driver: User | null })[] })[];
  drivers: (User & { trips: (Trip & { vehicle: Vehicle | null })[] })[];
  initialAvailableCars: any[];
  initialBookedCars: any[];
  initialWorkingDrivers: any[];
  initialFreeDrivers: any[];
}

export function AdminDashboardClient({
  vehicles,
  drivers,
  initialAvailableCars,
  initialBookedCars,
  initialWorkingDrivers,
  initialFreeDrivers,
}: AdminDashboardClientProps) {
  const { t } = useTranslation();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Recalculate client-side to prevent hydration mismatches with current time
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    setNow(new Date());
    const interval = setInterval(() => setNow(new Date()), 30000); // refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const availableCars = vehicles.filter(vehicle => {
    const hasActiveBooking = vehicle.trips.some(trip => {
      const start = new Date(trip.startTime);
      const end = new Date(trip.endTime);
      return now >= start && now < end;
    });
    return vehicle.status === "AVAILABLE" && !hasActiveBooking;
  });

  const bookedCars = vehicles.map(vehicle => {
    const activeOrFutureBookings = vehicle.trips.filter(trip => {
      const end = new Date(trip.endTime);
      return end > now;
    });
    return {
      ...vehicle,
      bookings: activeOrFutureBookings,
    };
  }).filter(v => v.bookings.length > 0);

  const workingDrivers = drivers.filter(driver => {
    return driver.trips.some(trip => {
      const start = new Date(trip.startTime);
      const end = new Date(trip.endTime);
      return now >= start && now < end;
    });
  });

  const freeDrivers = drivers.filter(driver => {
    const hasActiveBooking = driver.trips.some(trip => {
      const start = new Date(trip.startTime);
      const end = new Date(trip.endTime);
      return now >= start && now < end;
    });
    return !hasActiveBooking;
  });

  if (!mounted) return null;

  return (
    <div className="space-y-8">
      {/* Header Title */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-foreground">{t("fleet_control_center")}</h2>
        <p className="text-sm text-muted-foreground">
          {t("fleet_control_center_desc")}
        </p>
      </div>

      {/* Stats Dashboard Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Available Cars Stat */}
        <Card className="border-border glass glow-primary hover:-translate-y-1 transition-transform duration-200">
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-full bg-emerald-500/10 p-3 text-emerald-500">
              <Truck className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground">{t("available_cars")}</p>
              <h3 className="text-2xl font-bold">{availableCars.length} {t("free")}</h3>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {t("ready_to_be_booked")}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Booked Cars Stat */}
        <Card className="border-border glass glow-primary hover:-translate-y-1 transition-transform duration-200">
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-full bg-blue-500/10 p-3 text-blue-500">
              <Clock className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground">{t("booked_cars")}</p>
              <h3 className="text-2xl font-bold">{bookedCars.length} {t("reserved")}</h3>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {t("currently_driving_or_scheduled")}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Working Drivers Stat */}
        <Card className="border-border glass glow-primary hover:-translate-y-1 transition-transform duration-200">
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-full bg-purple-500/10 p-3 text-purple-500">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground">{t("working_drivers")}</p>
              <h3 className="text-2xl font-bold">{workingDrivers.length} {t("on_duty")}</h3>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {t("currently_assigned_to_booking")}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Free Drivers Stat */}
        <Card className="border-border glass glow-primary hover:-translate-y-1 transition-transform duration-200">
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-full bg-amber-500/10 p-3 text-amber-500">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground">{t("free_drivers")}</p>
              <h3 className="text-2xl font-bold">{freeDrivers.length} {t("available")}</h3>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {t("ready_for_assignments")}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Availability Layout */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left Side: Cars Status */}
        <div className="space-y-6">
          {/* Available Cars Table */}
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                {t("available_free_cars")} ({availableCars.length})
              </CardTitle>
              <CardDescription>{t("available_free_cars_desc")}</CardDescription>
            </CardHeader>
            <CardContent>
              <TableContainer>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("car_details")}</TableHead>
                    <TableHead>{t("plate_number")}</TableHead>
                    <TableHead>{t("capacity")}</TableHead>
                    <TableHead>{t("odometer")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {availableCars.map((car) => (
                    <TableRow key={car.id}>
                      <TableCell className="font-semibold text-foreground">
                        <div className="flex items-center gap-2">
                          {(car as any).imageUrl ? (
                            <img 
                              src={(car as any).imageUrl} 
                              alt={car.name} 
                              className="w-8 h-8 rounded object-cover border border-border shrink-0" 
                            />
                          ) : (
                            <div className="w-8 h-8 rounded bg-muted flex items-center justify-center border border-border shrink-0">
                              <Truck className="h-4.5 w-4.5 text-muted-foreground" />
                            </div>
                          )}
                          <div>
                            {car.name} <span className="text-xs text-muted-foreground block">{car.brand} {car.model} ({car.year})</span>
                            <div className="mt-1">
                              {car.trips.length >= 3 ? (
                                <span className="inline-flex items-center gap-1 text-[9px] font-bold text-green-600 bg-green-500/10 px-1.5 py-0.5 rounded border border-green-500/25">
                                  🟢 {t("high_usage")} ({car.trips.length} {t("bookings")})
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[9px] font-bold text-red-600 bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/25">
                                  🔴 {t("low_usage")} ({car.trips.length} {t("bookings")})
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-primary font-bold text-xs">{car.vehicleNumber}</TableCell>
                      <TableCell className="text-xs font-semibold">{car.seatingCapacity} {t("seats_label")}</TableCell>
                      <TableCell className="font-mono text-xs">{car.odometer.toLocaleString()} km</TableCell>
                    </TableRow>
                  ))}
                  {availableCars.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-6 text-xs italic">
                        {t("no_vehicles_available")}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </TableContainer>
            </CardContent>
          </Card>

          {/* Booked Cars Table */}
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-blue-500" />
                {t("booked_cars_schedule")} ({bookedCars.length})
              </CardTitle>
              <CardDescription>{t("booked_cars_schedule_desc")}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {bookedCars.map((car) => (
                  <div key={car.id} className="border border-border/60 rounded-xl p-4 bg-muted/20 space-y-3 glass">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2">
                        {(car as any).imageUrl ? (
                          <img 
                            src={(car as any).imageUrl} 
                            alt={car.name} 
                            className="w-8 h-8 rounded object-cover border border-border shrink-0" 
                          />
                        ) : (
                          <div className="w-8 h-8 rounded bg-muted flex items-center justify-center border border-border shrink-0">
                            <Truck className="h-4.5 w-4.5 text-muted-foreground" />
                          </div>
                        )}
                        <div>
                          <span className="font-bold text-sm text-foreground block">{car.name}</span>
                          <span className="text-xs text-muted-foreground block">{car.brand} {car.model}</span>
                          <div className="mt-1 flex gap-1">
                            {car.trips.length >= 3 ? (
                              <span className="inline-flex items-center gap-1 text-[9px] font-bold text-green-600 bg-green-500/10 px-1.5 py-0.5 rounded border border-green-500/25">
                                🟢 {t("high_usage")} ({car.trips.length} {t("bookings")})
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[9px] font-bold text-red-600 bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/25">
                                🔴 {t("low_usage")} ({car.trips.length} {t("bookings")})
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <Badge variant="outline" className="font-mono text-[10px] text-primary border-primary/20 bg-primary/5">{car.vehicleNumber}</Badge>
                    </div>
                    <div className="space-y-2 border-t border-border/40 pt-3">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">{t("booked_slots")}</span>
                      {car.bookings.map((booking) => {
                        const start = new Date(booking.startTime);
                        const end = new Date(booking.endTime);
                        const isActive = now >= start && now < end;
                        return (
                          <div key={booking.id} className="flex justify-between items-center text-xs bg-card p-2 rounded-lg border border-border/30">
                            <span className="text-muted-foreground flex items-center gap-1.5" suppressHydrationWarning>
                              <span className={`h-1.5 w-1.5 rounded-full ${isActive ? 'bg-purple-500 animate-pulse' : 'bg-muted-foreground/40'}`} />
                              {start.toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })} - {end.toLocaleTimeString([], { timeStyle: 'short' })}
                            </span>
                            <span className="font-semibold text-foreground">
                              {booking.driver?.name || booking.requestedBy || "N/A"}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
                {bookedCars.length === 0 && (
                  <div className="text-center py-6 text-muted-foreground text-xs italic border border-dashed border-border/40 rounded-xl">
                    {t("no_bookings_logged")}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Side: Drivers Status */}
        <div className="space-y-6">
          {/* Working Drivers Table */}
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-purple-500 animate-pulse" />
                {t("working_drivers_count")} ({workingDrivers.length})
              </CardTitle>
              <CardDescription>{t("working_drivers_desc")}</CardDescription>
            </CardHeader>
            <CardContent>
              <TableContainer>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("driver")}</TableHead>
                    <TableHead>{t("car_booked")}</TableHead>
                    <TableHead>{t("booking_period")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {workingDrivers.map((driver) => {
                    const activeTrip = driver.trips.find(trip => {
                      const start = new Date(trip.startTime);
                      const end = new Date(trip.endTime);
                      return now >= start && now < end;
                    });
                    return (
                      <TableRow key={driver.id}>
                        <TableCell className="font-semibold text-foreground">
                          {driver.name}
                          <span className="text-[10px] text-muted-foreground block font-mono">{driver.employeeId}</span>
                        </TableCell>
                        <TableCell>
                          {activeTrip ? (
                            <div className="flex items-center gap-2">
                              {(activeTrip.vehicle as any)?.imageUrl ? (
                                <img 
                                  src={(activeTrip.vehicle as any).imageUrl} 
                                  alt={activeTrip.vehicle?.name} 
                                  className="w-8 h-8 rounded object-cover border border-border shrink-0" 
                                />
                              ) : (
                                <div className="w-8 h-8 rounded bg-muted flex items-center justify-center border border-border shrink-0">
                                  <Truck className="h-4.5 w-4.5 text-muted-foreground" />
                                </div>
                              )}
                              <div className="flex flex-col">
                                <span className="font-medium text-xs text-foreground">{activeTrip.vehicle?.name}</span>
                                <span className="font-mono text-[10px] text-primary font-bold">{activeTrip.vehicle?.vehicleNumber}</span>
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs italic">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs" suppressHydrationWarning>
                          {activeTrip ? (
                            <span className="font-medium text-foreground">
                              {new Date(activeTrip.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(activeTrip.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          ) : (
                            <span className="text-muted-foreground italic">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {workingDrivers.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground py-6 text-xs italic">
                        {t("no_drivers_working")}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </TableContainer>
            </CardContent>
          </Card>

          {/* Free Drivers Table */}
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                {t("free_available_drivers")} ({freeDrivers.length})
              </CardTitle>
              <CardDescription>{t("free_drivers_desc")}</CardDescription>
            </CardHeader>
            <CardContent>
              <TableContainer>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("driver_name")}</TableHead>
                    <TableHead>{t("employee_id")}</TableHead>
                    <TableHead>{t("emergency_phone")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {freeDrivers.map((driver) => (
                    <TableRow key={driver.id}>
                      <TableCell className="font-semibold text-foreground">
                        {driver.name}
                        <span className="text-[10px] text-muted-foreground block">{t("experience")}: {driver.experience || 0} {t("years_experience")}</span>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{driver.employeeId}</TableCell>
                      <TableCell className="text-xs">{driver.phone || "—"}</TableCell>
                    </TableRow>
                  ))}
                  {freeDrivers.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground py-6 text-xs italic">
                        {t("no_free_drivers")}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </TableContainer>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
