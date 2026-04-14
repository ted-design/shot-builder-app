import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";

type PrintReadinessSnapshot = {
  total: number;
  ready: number;
  allReady: boolean;
  states: Record<string, boolean>;
};

type PrintReadinessContextValue = {
  register: (id: string) => () => void;
  setReady: (id: string, ready: boolean) => void;
  snapshot: PrintReadinessSnapshot;
};

const PrintReadinessContext = createContext<PrintReadinessContextValue | null>(null);

export function PrintReadinessProvider({ children }: { children: React.ReactNode }) {
  const statesRef = useRef<Map<string, boolean>>(new Map());
  const [version, setVersion] = useState(0);

  const register = useMemo(() => {
    return (id: string) => {
      if (!statesRef.current.has(id)) {
        statesRef.current.set(id, false);
        setVersion((v) => v + 1);
      }
      return () => {
        if (statesRef.current.delete(id)) {
          setVersion((v) => v + 1);
        }
      };
    };
  }, []);

  const setReady = useMemo(() => {
    return (id: string, ready: boolean) => {
      const prev = statesRef.current.get(id);
      if (prev === ready) return;
      statesRef.current.set(id, ready);
      setVersion((v) => v + 1);
    };
  }, []);

  const snapshot: PrintReadinessSnapshot = useMemo(() => {
    const states: Record<string, boolean> = {};
    let total = 0;
    let ready = 0;
    for (const [id, value] of statesRef.current.entries()) {
      total += 1;
      if (value) ready += 1;
      states[id] = value;
    }
    return {
      total,
      ready,
      allReady: total > 0 && ready === total,
      states,
    };
  }, [version]);

  const value = useMemo(() => ({ register, setReady, snapshot }), [register, setReady, snapshot]);

  return <PrintReadinessContext.Provider value={value}>{children}</PrintReadinessContext.Provider>;
}

export function usePrintReadinessSection(id: string, ready: boolean) {
  const ctx = useContext(PrintReadinessContext);
  if (!ctx) {
    throw new Error("usePrintReadinessSection must be used within PrintReadinessProvider");
  }

  useEffect(() => {
    return ctx.register(id);
  }, [ctx, id]);

  useEffect(() => {
    ctx.setReady(id, ready);
  }, [ctx, id, ready]);
}

export function usePrintReadinessSnapshot() {
  const ctx = useContext(PrintReadinessContext);
  if (!ctx) {
    throw new Error("usePrintReadinessSnapshot must be used within PrintReadinessProvider");
  }
  return ctx.snapshot;
}

