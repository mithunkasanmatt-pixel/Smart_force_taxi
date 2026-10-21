"use client";

import React, { useState, useEffect, useTransition } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { MapPin, Plus, Trash2, CheckCircle2, AlertCircle } from "lucide-react";
import { BookingLocation } from "@/lib/locations";
import {
  getBookingLocationsAction,
  addBookingLocationAction,
  deleteBookingLocationAction,
} from "@/actions/locations";

interface LocationManagerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onLocationsChange?: (locations: BookingLocation[]) => void;
}

export function LocationManagerDialog({
  isOpen,
  onClose,
  onLocationsChange,
}: LocationManagerDialogProps) {
  const [locations, setLocations] = useState<BookingLocation[]>([]);
  const [newLocationName, setNewLocationName] = useState("");
  const [newLocationType, setNewLocationType] = useState<"both" | "pickup" | "drop">("both");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadLocations = async () => {
    try {
      const data = await getBookingLocationsAction();
      setLocations(data);
      onLocationsChange?.(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadLocations();
      setError(null);
      setSuccess(null);
      setNewLocationName("");
    }
  }, [isOpen]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!newLocationName.trim()) {
      setError("Location name cannot be empty");
      return;
    }

    startTransition(async () => {
      const res = await addBookingLocationAction({
        name: newLocationName.trim(),
        type: newLocationType,
      });

      if (res.error) {
        setError(res.error);
      } else {
        setSuccess(`Added "${newLocationName.trim()}" successfully!`);
        setNewLocationName("");
        await loadLocations();
      }
    });
  };

  const handleDelete = (id: string, name: string) => {
    if (!confirm(`Are you sure you want to remove "${name}"?`)) return;

    setError(null);
    setSuccess(null);

    startTransition(async () => {
      const res = await deleteBookingLocationAction(id);
      if (res.error) {
        setError(res.error);
      } else {
        setSuccess(`Removed "${name}".`);
        await loadLocations();
      }
    });
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Manage Pickup & Drop Locations"
      className="max-w-lg w-full"
    >
      <div className="space-y-5 text-foreground">
        <p className="text-xs text-muted-foreground leading-relaxed">
          Configure default and custom locations available to drivers during vehicle booking.
        </p>

        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-600 rounded-xl text-xs flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="p-3 bg-green-500/10 border border-green-500/20 text-green-600 rounded-xl text-xs flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {/* Add Location Form */}
        <form onSubmit={handleAdd} className="p-4 bg-muted/20 border border-border rounded-xl space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Plus className="h-4 w-4 text-primary" /> Add New Location
          </h4>

          <div className="space-y-2">
            <Input
              type="text"
              placeholder="e.g. Airport Terminal 1 Parking"
              value={newLocationName}
              onChange={(e) => setNewLocationName(e.target.value)}
              className="text-xs h-9 bg-card"
              disabled={isPending}
            />

            <div className="flex items-center gap-3">
              <label className="text-[11px] font-semibold text-muted-foreground">Type:</label>
              <div className="flex items-center gap-3 text-xs">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="locationType"
                    checked={newLocationType === "both"}
                    onChange={() => setNewLocationType("both")}
                    className="accent-primary"
                  />
                  <span>Pickup & Drop</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="locationType"
                    checked={newLocationType === "pickup"}
                    onChange={() => setNewLocationType("pickup")}
                    className="accent-primary"
                  />
                  <span>Pickup only</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="locationType"
                    checked={newLocationType === "drop"}
                    onChange={() => setNewLocationType("drop")}
                    className="accent-primary"
                  />
                  <span>Drop only</span>
                </label>
              </div>
            </div>
          </div>

          <Button
            type="submit"
            disabled={isPending || !newLocationName.trim()}
            size="sm"
            className="w-full text-xs font-bold h-9 mt-2"
          >
            {isPending ? "Adding..." : "Add Location"}
          </Button>
        </form>

        {/* Current Locations List */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
            <span>Configured Locations ({locations.length})</span>
          </h4>

          <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
            {locations.map((loc) => {
              const isDefault = loc.id === "loc-tikkurila" || loc.id === "loc-hakunila";
              return (
                <div
                  key={loc.id}
                  className="flex items-center justify-between p-3 rounded-xl border border-border bg-card hover:border-primary/40 transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <MapPin className="h-4 w-4 text-primary shrink-0" />
                    <div className="min-w-0">
                      <span className="text-xs font-bold text-foreground block truncate">
                        {loc.name}
                      </span>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Badge variant="outline" className="text-[9px] uppercase font-semibold">
                          {loc.type === "both" ? "Pickup & Drop" : loc.type === "pickup" ? "Pickup Only" : "Drop Only"}
                        </Badge>
                        {isDefault && (
                          <Badge variant="secondary" className="text-[8px] uppercase">
                            Default
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  {!isDefault && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(loc.id, loc.name)}
                      disabled={isPending}
                      className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-500/10 shrink-0"
                      title="Delete location"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex justify-end pt-3 border-t border-border">
          <Button variant="outline" onClick={onClose} size="sm" className="text-xs font-semibold">
            Done
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
