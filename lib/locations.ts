export interface BookingLocation {
  id: string;
  name: string;
  type: "pickup" | "drop" | "both";
  createdAt: string;
}

export const DEFAULT_BOOKING_LOCATIONS: BookingLocation[] = [
  {
    id: "loc-tikkurila",
    name: "Tikkurila 24 hr parking",
    type: "both",
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "loc-hakunila",
    name: "Hakunila K market parking",
    type: "both",
    createdAt: "2026-01-01T00:00:00.000Z",
  },
];
