import { redirect } from "next/navigation";

export default function DriverBookingsPage() {
  redirect("/driver?tab=bookings");
}
