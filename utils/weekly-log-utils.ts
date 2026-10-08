/**
 * Calculates the start (Monday 00:00:00) and end (Monday 23:59:59) dates of the weekly log window.
 * The weekly log period runs from Monday to Monday.
 */
export function getWeeklyLogWindow(referenceDate: Date = new Date()) {
  const d = new Date(referenceDate);
  const day = d.getDay(); // 0 = Sun, 1 = Mon, 2 = Tue, ..., 6 = Sat

  const startOfWeek = new Date(d);
  startOfWeek.setHours(0, 0, 0, 0);

  if (day === 1) {
    // On Monday, the active weekly log check is for the 7-day period starting last Monday.
    startOfWeek.setDate(startOfWeek.getDate() - 7);
  } else if (day === 0) {
    // On Sunday, the active weekly log period started on Monday 6 days ago.
    startOfWeek.setDate(startOfWeek.getDate() - 6);
  } else {
    // Tue (2) to Sat (6): The active weekly log period started on Monday (day - 1) days ago.
    startOfWeek.setDate(startOfWeek.getDate() - (day - 1));
  }

  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(endOfWeek.getDate() + 7);
  endOfWeek.setHours(23, 59, 59, 999);

  return { startOfWeek, endOfWeek };
}

/**
 * Checks whether a given list of logs contains a submission within the Monday-to-Monday window.
 */
export function isWeeklyLogSubmitted(
  logs: { uploadedAt: Date | string }[] | null | undefined,
  referenceDate: Date = new Date()
): boolean {
  if (!logs || logs.length === 0) return false;
  const { startOfWeek, endOfWeek } = getWeeklyLogWindow(referenceDate);

  return logs.some((log) => {
    const uploadDate = new Date(log.uploadedAt);
    return uploadDate >= startOfWeek && uploadDate <= endOfWeek;
  });
}
