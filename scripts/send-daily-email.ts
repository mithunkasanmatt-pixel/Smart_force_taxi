import { sendDailyAvailableVehiclesEmail } from "../lib/notifications";

async function run() {
  console.log("Starting daily available vehicles email script...");
  try {
    const result = await sendDailyAvailableVehiclesEmail();
    console.log("Script execution finished successfully:", result);
    process.exit(0);
  } catch (error) {
    console.error("Script execution failed:", error);
    process.exit(1);
  }
}

run();
