"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { useSearchParams, usePathname, useRouter } from "next/navigation";

export type DriverTab = "dashboard" | "vehicles" | "weekly-log" | "earnings" | "profile";

interface DriverTabContextProps {
  activeTab: DriverTab;
  setActiveTab: (tab: DriverTab) => void;
}

export const DriverTabContext = createContext<DriverTabContextProps | undefined>(undefined);

export function DriverTabProvider({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const getTabFromUrl = (path: string, params: URLSearchParams): DriverTab => {
    if (path === "/driver/available-vehicles" || params.get("tab") === "vehicles") {
      return "vehicles";
    }
    if (path === "/driver/weekly-log" || params.get("tab") === "weekly-log") {
      return "weekly-log";
    }
    if (path === "/driver/earnings" || params.get("tab") === "earnings") {
      return "earnings";
    }
    if (path === "/driver/profile" || params.get("tab") === "profile") {
      return "profile";
    }
    return "dashboard";
  };

  const [activeTab, setActiveTabState] = useState<DriverTab>("dashboard");

  // Sync state with URL when component mounts or URL pathname/searchParams change
  useEffect(() => {
    const currentParams = new URLSearchParams(window.location.search);
    setActiveTabState(getTabFromUrl(window.location.pathname, currentParams));
  }, [pathname, searchParams]);

  const setActiveTab = (tab: DriverTab) => {
    setActiveTabState(tab);

    let targetPath = "/driver";
    if (tab === "vehicles") {
      targetPath = "/driver/available-vehicles";
    } else if (tab === "weekly-log") {
      targetPath = "/driver/weekly-log";
    } else if (tab === "earnings") {
      targetPath = "/driver/earnings";
    } else if (tab === "profile") {
      targetPath = "/driver/profile";
    }

    if (pathname !== "/driver" && pathname !== targetPath) {
      router.push(targetPath);
    } else {
      window.history.pushState(null, "", targetPath);
    }
  };


  return (
    <DriverTabContext.Provider value={{ activeTab, setActiveTab }}>
      {children}
    </DriverTabContext.Provider>
  );
}

export function useDriverTab() {
  const context = useContext(DriverTabContext);
  if (!context) {
    throw new Error("useDriverTab must be used within a DriverTabProvider");
  }
  return context;
}
