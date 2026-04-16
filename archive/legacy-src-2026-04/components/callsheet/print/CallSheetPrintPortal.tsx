import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "../../../lib/toast";
import { CallSheetPreview as CallSheetPreviewModern } from "../../schedule/preview/CallSheetPreview";
import { buildModernCallSheetData, getModernColors } from "./modernCallSheetData";
import { PrintReadinessProvider, usePrintReadinessSection, usePrintReadinessSnapshot } from "./PrintReadinessContext";

type PrintPortalProps = {
  open: boolean;
  onDone: () => void;
  schedule: any;
  scheduleLoading: boolean;
  entries: any[];
  entriesLoading: boolean;
  tracks: any[];
  projectTitle: string;
  dayDetails: any;
  dayDetailsLoading: boolean;
  crewRows: any[];
  crewLoading: boolean;
  talentRows: any[];
  talentLoading: boolean;
  clientRows: any[];
  clientLoading: boolean;
  sections: any[];
  callSheetConfig: any;
  callSheetConfigLoading: boolean;
  layoutV2: any;
  layoutV2Loading: boolean;
  columnConfig: any[];
};

function PrintSource({ id, label, ready }: { id: string; label: string; ready: boolean }) {
  usePrintReadinessSection(id, ready);

  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <div className="min-w-0 text-slate-700">{label}</div>
      {ready ? (
        <div className="flex items-center gap-1.5 text-emerald-700">
          <CheckCircle2 className="h-4 w-4" />
          <span>Ready</span>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Loading…</span>
        </div>
      )}
    </div>
  );
}

function PrintOrchestrator({
  onPrint,
  onAbort,
  timeoutMs,
}: {
  onPrint: () => void;
  onAbort: () => void;
  timeoutMs: number;
}) {
  const snapshot = usePrintReadinessSnapshot();
  const didPrintRef = useRef(false);

  useEffect(() => {
    if (didPrintRef.current) return;
    if (!snapshot.allReady) return;
    didPrintRef.current = true;
    onPrint();
  }, [onPrint, snapshot.allReady]);

  useEffect(() => {
    if (didPrintRef.current) return;
    const timer = window.setTimeout(() => {
      if (didPrintRef.current) return;
      onAbort();
    }, timeoutMs);
    return () => window.clearTimeout(timer);
  }, [onAbort, timeoutMs]);

  return null;
}

export default function CallSheetPrintPortal({
  open,
  onDone,
  schedule,
  scheduleLoading,
  entries,
  entriesLoading,
  tracks,
  projectTitle,
  dayDetails,
  dayDetailsLoading,
  crewRows,
  crewLoading,
  talentRows,
  talentLoading,
  clientRows,
  clientLoading,
  sections,
  callSheetConfig,
  callSheetConfigLoading,
  layoutV2,
  layoutV2Loading,
  columnConfig,
}: PrintPortalProps) {
  const [container, setContainer] = useState<HTMLElement | null>(null);
  const fallbackCleanupTimerRef = useRef<number | null>(null);

  const cleanup = useCallback(() => {
    document?.body?.removeAttribute("data-callsheet-printing");
    window.removeEventListener("afterprint", cleanup);

    if (fallbackCleanupTimerRef.current) {
      window.clearTimeout(fallbackCleanupTimerRef.current);
      fallbackCleanupTimerRef.current = null;
    }

    onDone();
  }, [onDone]);

  useEffect(() => {
    if (!open) return;
    const body = document?.body;
    if (!body) return;

    const portalContainer = document.createElement("div");
    portalContainer.id = "callsheet-print-portal";
    portalContainer.setAttribute("data-callsheet-print-portal", "1");
    body.appendChild(portalContainer);
    setContainer(portalContainer);

    return () => {
      if (fallbackCleanupTimerRef.current) {
        window.clearTimeout(fallbackCleanupTimerRef.current);
        fallbackCleanupTimerRef.current = null;
      }
      try {
        portalContainer.remove();
      } catch {}
      setContainer(null);
      body.removeAttribute("data-callsheet-printing");
      window.removeEventListener("afterprint", cleanup);
    };
  }, [cleanup, open]);

  const modernColors = useMemo(() => getModernColors(callSheetConfig), [callSheetConfig]);
  const modernData = useMemo(
    () =>
      buildModernCallSheetData({
        schedule,
        dayDetails,
        entries,
        crewRows,
        talentRows,
        sections,
        projectTitle,
        tracks,
      }),
    [crewRows, dayDetails, entries, projectTitle, schedule, sections, talentRows, tracks]
  );

  const handleAbort = useCallback(() => {
    toast.error({
      title: "Export failed",
      description: "Some call sheet data didn’t finish loading. Please try again.",
    });
    cleanup();
  }, [cleanup]);

  const handlePrint = useCallback(() => {
    const body = document?.body;
    if (!body) return;

    try {
      window.addEventListener("afterprint", cleanup);
      body.setAttribute("data-callsheet-printing", "1");

      fallbackCleanupTimerRef.current = window.setTimeout(() => {
        cleanup();
      }, 30000);

      window.print();
    } catch (err) {
      console.error("[CallSheetPrintPortal] window.print failed:", err);
      cleanup();
    }
  }, [cleanup]);

  const scheduleReady = !scheduleLoading && Boolean(schedule);
  const entriesReady = !entriesLoading;
  const dayDetailsReady = !dayDetailsLoading;
  const talentReady = !talentLoading;
  const crewReady = !crewLoading;
  const clientReady = !clientLoading;
  const configReady = !callSheetConfigLoading;
  const layoutReady = !layoutV2Loading;

  if (!open || !container) return null;

  return createPortal(
    <PrintReadinessProvider>
      <PrintOrchestrator onPrint={handlePrint} onAbort={handleAbort} timeoutMs={10000} />

      <div
        data-callsheet-print-overlay
        className="fixed inset-x-0 top-0 z-[10000] border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur"
      >
        <div className="mx-auto flex max-w-3xl items-start gap-3">
          <div className="mt-0.5 rounded-md bg-slate-100 p-2">
            <AlertCircle className="h-5 w-5 text-slate-500" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-slate-900">Preparing call sheet for print…</div>
            <div className="mt-2 space-y-1.5">
              <PrintSource id="schedule" label="Schedule" ready={scheduleReady} />
              <PrintSource id="entries" label="Entries" ready={entriesReady} />
              <PrintSource id="dayDetails" label="Day details" ready={dayDetailsReady} />
              <PrintSource id="talent" label="Talent calls" ready={talentReady} />
              <PrintSource id="crew" label="Crew calls" ready={crewReady} />
              <PrintSource id="clients" label="Client/guests" ready={clientReady} />
              <PrintSource id="config" label="Layout config" ready={configReady} />
              <PrintSource id="layoutV2" label="Header layout" ready={layoutReady} />
            </div>
          </div>
        </div>
      </div>

      <div className="pt-28">
        <CallSheetPreviewModern
          data={modernData}
          colors={modernColors}
          showMobile={false}
          zoom={100}
          layoutV2={layoutV2}
          sections={sections}
          columnConfig={columnConfig}
          scheduleBlockFields={callSheetConfig?.scheduleBlockFields}
        />
      </div>
    </PrintReadinessProvider>,
    container
  );
}

