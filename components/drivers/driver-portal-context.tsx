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

  const [activeTab, setActiveTabState] = useState<DriverTab>(() => {
    if (typeof window !== "undefined") {
      return getTabFromUrl(window.location.pathname, new URLSearchParams(window.location.search));
    }
    return "dashboard";
  });

  // Sync state with URL on initial mount and when popstate (browser back/forward) occurs
  useEffect(() => {
    const handlePopState = () => {
      const currentParams = new URLSearchParams(window.location.search);
      setActiveTabState(getTabFromUrl(window.location.pathname, currentParams));
    };

    handlePopState();
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
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

    if (typeof window !== "undefined" && window.location.pathname + window.location.search !== targetPath) {
      window.history.pushState({ tab }, "", targetPath);
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
