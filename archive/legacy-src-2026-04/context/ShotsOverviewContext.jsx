import React, { createContext, useContext } from "react";

const ShotsOverviewContext = createContext(null);

export function ShotsOverviewProvider({ value, children }) {
  return <ShotsOverviewContext.Provider value={value}>{children}</ShotsOverviewContext.Provider>;
}

export function useShotsOverview() {
  return useContext(ShotsOverviewContext);
}

export default ShotsOverviewContext;
