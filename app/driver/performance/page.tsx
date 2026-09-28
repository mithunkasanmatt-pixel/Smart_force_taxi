import { redirect } from "next/navigation";

export default function DriverPerformancePage() {
  redirect("/driver?tab=performance-matrix");
}
