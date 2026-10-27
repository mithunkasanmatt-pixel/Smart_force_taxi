"use client";

import React, { useState } from "react";
import { Search, Truck, Users, Milestone, Calendar } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { CarBookingGrid } from "@/components/vehicles/car-booking-grid";
import { Vehicle, Trip, User } from "@prisma/client";
import { useTranslation } from "@/components/layout/language-provider";

interface AvailableVehiclesClientProps {
  vehicles: Vehicle[];
  bookings: (Trip & { driver?: User | null; vehicle?: Vehicle | null })[];
  currentUserId: string;
  currentUserRole: string;
  currentUserName: string;
  assignedVehicleId?: string | null;
}

export function AvailableVehiclesClient({
  vehicles,
  bookings,
  currentUserId,
  currentUserRole,
  currentUserName,
  assignedVehicleId,
}: AvailableVehiclesClientProps) {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedVehicleForBooking, setSelectedVehicleForBooking] = useState<Vehicle | null>(null);

  const filteredVehicles = vehicles
    .filter((v) => {
      const searchString = `${v.name} ${v.brand} ${v.model} ${v.vehicleNumber}`.toLowerCase();
      return searchString.includes(searchTerm.toLowerCase());
    })
    .sort((a, b) => {
      if (assignedVehicleId) {
        if (a.id === assignedVehicleId) return -1;
        if (b.id === assignedVehicleId) return 1;
      }
      return 0;
    });

  return (
    <div className="mx-auto max-w-7xl w-full space-y-6">
      {/* Title section */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight">{t("available_fleet")}</h2>
        <p className="text-sm text-muted-foreground">
          {t("available_fleet_desc")}
        </p>
      </div>

      {/* Search Input */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-3 h-4.5 w-4.5 text-muted-foreground" />
        <Input
          placeholder={t("search_available_cars")}
          className="pl-10 bg-card"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Grid of Vehicles */}
      <div className="grid gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filteredVehicles.map((vehicle) => (
          <div
            key={vehicle.id}
            className="rounded-3xl border border-border/80 bg-card p-4 sm:p-5 shadow-xs transition-all duration-200 hover:shadow-md hover:border-primary/40 flex flex-col justify-between space-y-3.5"
          >
            <div className="space-y-3">
              {/* Top Status Badge */}
              <div className="flex items-center justify-end">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  {vehicle.status}
                </span>
              </div>

              {/* Big Hero Vehicle Image */}
              <div className="relative w-full h-44 sm:h-52 rounded-2xl overflow-hidden bg-muted/15 border border-border/40 flex items-center justify-center p-2">
                {vehicle.imageUrl ? (
                  <img
                    src={vehicle.imageUrl}
                    alt={vehicle.name}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground/40 gap-2">
                    <Truck className="h-10 w-10 sm:h-12 sm:w-12" />
                    <span className="text-[11px] font-medium">No image available</span>
                  </div>
                )}
              </div>

              {/* Vehicle Title & Model */}
              <div className="space-y-0.5 pt-0.5">
                <h3 className="text-base sm:text-lg font-black tracking-tight text-foreground">
                  {vehicle.name}
                </h3>
                <p className="text-xs text-muted-foreground font-medium">
                  {vehicle.brand} {vehicle.model} ({vehicle.year})
                </p>
              </div>

              {/* Specifications: Seats & Odometer */}
              <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border/40">
                <div className="flex items-center gap-1.5 font-medium">
                  <Users className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>{vehicle.seatingCapacity} {t("seats_label")}</span>
                </div>
                <div className="flex items-center gap-1.5 font-medium">
                  <Milestone className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-mono">{vehicle.odometer.toLocaleString()} km</span>
                </div>
              </div>

              {/* Plate Number */}
              <div className="space-y-0.5 pt-0.5">
                <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">
                  {t("plate_number")}
                </span>
                <span className="font-mono text-sm sm:text-base font-black tracking-wide text-foreground block">
                  {vehicle.vehicleNumber}
                </span>
              </div>
            </div>

            {/* Book Vehicle Action Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setSelectedVehicleForBooking(vehicle)}
                className="w-full h-11 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer active:scale-[0.99]"
              >
                <Calendar className="h-4 w-4 text-white" />
                <span>{t("book_vehicle")}</span>
              </button>
            </div>
          </div>
        ))}

        {filteredVehicles.length === 0 && (
          <div className="col-span-full text-center py-12 text-muted-foreground glass rounded-xl border border-border">
            <Truck className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
            <h3 className="font-semibold text-foreground">{t("no_vehicles_available")}</h3>
          </div>
        )}
      </div>

      {/* Car Slot Booking Calendar Dialog */}
      {selectedVehicleForBooking && (
        <Dialog isOpen={!!selectedVehicleForBooking} onClose={() => setSelectedVehicleForBooking(null)} title={t("booking_calendar")} className="max-w-4xl">
          <CarBookingGrid
            vehicle={selectedVehicleForBooking}
            bookings={bookings.filter((b) => b.vehicleId === selectedVehicleForBooking.id)}
            drivers={[]}
            currentUserId={currentUserId}
            currentUserRole={currentUserRole}
            currentUserName={currentUserName}
            onClose={() => setSelectedVehicleForBooking(null)}
          />
        </Dialog>
      )}
    </div>
  );
}
