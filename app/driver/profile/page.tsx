import { redirect } from "next/navigation";

export default function DriverProfilePage() {
  redirect("/driver?tab=profile");
}
