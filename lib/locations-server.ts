import fs from "fs";
import path from "path";
import { BookingLocation, DEFAULT_BOOKING_LOCATIONS } from "./locations";

const DATA_DIR = path.join(process.cwd(), "data");
const LOCATIONS_FILE = path.join(DATA_DIR, "booking-locations.json");

export function getStoredLocations(): BookingLocation[] {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(LOCATIONS_FILE)) {
      fs.writeFileSync(LOCATIONS_FILE, JSON.stringify(DEFAULT_BOOKING_LOCATIONS, null, 2), "utf-8");
      return DEFAULT_BOOKING_LOCATIONS;
    }
    const content = fs.readFileSync(LOCATIONS_FILE, "utf-8");
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
    return DEFAULT_BOOKING_LOCATIONS;
  } catch (error) {
    console.error("Error reading stored locations:", error);
    return DEFAULT_BOOKING_LOCATIONS;
  }
}

export function saveStoredLocations(locations: BookingLocation[]): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(LOCATIONS_FILE, JSON.stringify(locations, null, 2), "utf-8");
  } catch (error) {
    console.error("Error saving stored locations:", error);
  }
}
