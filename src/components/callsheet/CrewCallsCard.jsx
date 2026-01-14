import React, { useEffect, useMemo, useState, useCallback } from "react";
import { Card, CardContent, CardHeader } from "../ui/card";
import { Button } from "../ui/button";
import { Modal } from "../ui/modal";
import { Switch } from "../ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { useDepartments } from "../../hooks/useDepartments";
import { useOrganizationCrew } from "../../hooks/useOrganizationCrew";
import { useProjectCrew } from "../../hooks/useProjectCrew";
import { useCrewCalls } from "../../hooks/useCrewCalls";
import { useProjectDepartments } from "../../hooks/useProjectDepartments";
import { parseTimeToMinutes } from "../../lib/timeUtils";
import {
  GripVertical,
  Eye,
  EyeOff,
  Mail,
  Phone,
  Plus,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Copy,
  Settings2,
  X,
  Clock,
  Columns,
  ArrowUp,
  ArrowDown,
  List,
} from "lucide-react";

function isTimeString(value) {
  if (!value) return false;
  return /^\d{1,2}:\d{2}$/.test(String(value).trim());
}

function getTimeDeltaMinutes(baseTime, overrideTime) {
  if (!isTimeString(baseTime) || !isTimeString(overrideTime)) return null;
  const base = parseTimeToMinutes(baseTime);
  const next = parseTimeToMinutes(overrideTime);
  if (!Number.isFinite(base) || !Number.isFinite(next)) return null;
  return next - base;
}

function formatDelta(deltaMinutes) {
  if (!Number.isFinite(deltaMinutes) || deltaMinutes === 0) return null;
  const sign = deltaMinutes > 0 ? "+" : "-";
  const abs = Math.abs(deltaMinutes);
  return `${sign}${abs}m`;
}

function getDeltaTag(deltaMinutes) {
  if (!Number.isFinite(deltaMinutes)) return null;
  if (deltaMinutes === 0) return { label: "ON TIME", tone: "muted" };
  if (deltaMinutes < 0) return { label: `EARLY ${Math.abs(deltaMinutes)}m`, tone: "blue" };
  return { label: `DELAY ${Math.abs(deltaMinutes)}m`, tone: "amber" };
}

function DeltaBadge({ deltaMinutes }) {
  const deltaLabel = formatDelta(deltaMinutes);
  const deltaTag = getDeltaTag(deltaMinutes);

  if (!deltaTag) return null;

  return (
    <span
      className={[
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap",
        deltaTag.tone === "blue"
          ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-200"
          : deltaTag.tone === "amber"
            ? "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-200"
            : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
      ].join(" ")}
      title={deltaLabel || undefined}
    >
      {deltaTag.label}
    </span>
  );
}

function CrewMemberRow({
  assignment,
  member,
  draft,
  generalCrewCallTime,
  showEmails,
  showPhones,
  onDraftChange,
  onApply,
  onClear,
  readOnly,
  positionName,
}) {
  const name = member
    ? `${member.firstName || ""} ${member.lastName || ""}`.trim() || "Unnamed"
    : `Missing (${assignment.crewMemberId})`;

  const inherited = draft.trim() || (generalCrewCallTime ? String(generalCrewCallTime).trim() : "");
  const delta = getTimeDeltaMinutes(generalCrewCallTime, inherited);
  const hasPrecall = !!draft.trim();

  return (
    <div className="group flex items-center gap-2 px-3 py-1.5 min-h-[40px] border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
      {/* Drag handle */}
      <GripVertical className="h-4 w-4 text-slate-300 dark:text-slate-600 cursor-grab flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />

      {/* Role + Name stacked */}
      <div className="min-w-0 flex-1">
        <div className="font-medium text-sm text-slate-800 dark:text-slate-200 truncate">
          {positionName || "Crew"}
        </div>
        <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
          {name}
        </div>
      </div>

      {/* Contact icons */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {showEmails && member?.email ? (
          <a
            href={`mailto:${member.email}`}
            className="text-blue-500 hover:text-blue-600 transition-colors"
            title={member.email}
          >
            <Mail className="h-3.5 w-3.5" />
          </a>
        ) : showEmails ? (
          <Mail className="h-3.5 w-3.5 text-slate-300 dark:text-slate-600" />
        ) : null}

        {showPhones && member?.phone ? (
          <a
            href={`tel:${member.phone}`}
            className="text-blue-500 hover:text-blue-600 transition-colors"
            title={member.phone}
          >
            <Phone className="h-3.5 w-3.5" />
          </a>
        ) : showPhones ? (
          <Phone className="h-3.5 w-3.5 text-slate-300 dark:text-slate-600" />
        ) : null}
      </div>

      {/* Delta badge */}
      <div className="w-20 flex-shrink-0">
        <DeltaBadge deltaMinutes={delta} />
      </div>

      {/* Call time input */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <input
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.currentTarget.blur();
            }
          }}
          onBlur={onApply}
          placeholder={generalCrewCallTime ? generalCrewCallTime : "HH:MM"}
          disabled={readOnly}
          className="w-20 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm text-center focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
        />
        {hasPrecall ? (
          <button
            type="button"
            onClick={onClear}
            disabled={readOnly}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors disabled:opacity-50"
            title="Clear precall"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>
    </div>
  );
}

function DepartmentSection({
  deptId,
  title,
  rows,
  isExpanded,
  onToggleExpand,
  draftByCrewMemberId,
  generalCrewCallTime,
  showEmails,
  showPhones,
  onDraftChange,
  onApplyCrewCall,
  onClearCrewCall,
  onSetDepartmentPrecall,
  readOnly,
  positionNameByCrewMemberId,
}) {
  const crewCount = rows.length;
  const precallCount = rows.filter(({ assignment }) => {
    const draft = draftByCrewMemberId[assignment.crewMemberId] || "";
    return draft.trim().length > 0;
  }).length;

  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
      {/* Department header */}
      <button
        type="button"
        onClick={onToggleExpand}
        className="w-full flex items-center gap-2 px-3 py-2.5 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left"
      >
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 text-slate-500 flex-shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-slate-500 flex-shrink-0" />
        )}
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex-1">
          {title}
        </span>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {precallCount > 0 ? `${precallCount}/${crewCount} precalls` : `${crewCount} crew`}
        </span>
        {!readOnly ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs ml-2"
            onClick={(e) => {
              e.stopPropagation();
              onSetDepartmentPrecall(deptId);
            }}
          >
            <Clock className="h-3 w-3 mr-1" />
            Set All
          </Button>
        ) : null}
      </button>

      {/* Crew members list */}
      {isExpanded ? (
        <div className="bg-white dark:bg-slate-900">
          {rows.map(({ assignment, member }) => (
            <CrewMemberRow
              key={assignment.crewMemberId}
              assignment={assignment}
              member={member}
              draft={draftByCrewMemberId[assignment.crewMemberId] || ""}
              generalCrewCallTime={generalCrewCallTime}
              showEmails={showEmails}
              showPhones={showPhones}
              onDraftChange={(value) => onDraftChange(assignment.crewMemberId, value)}
              onApply={() => onApplyCrewCall(assignment.crewMemberId)}
              onClear={() => onClearCrewCall(assignment.crewMemberId)}
              readOnly={readOnly}
              positionName={positionNameByCrewMemberId.get(assignment.crewMemberId) || null}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function CrewCallsCard({
  clientId,
  projectId,
  scheduleId,
  generalCrewCallTime,
  readOnly = false,
  previousSchedules = [],
}) {
  const { departments } = useDepartments(clientId);
  const { departments: projectDepartments } = useProjectDepartments(clientId, projectId);
  const { crewById } = useOrganizationCrew(clientId);
  const { assignments, loading: loadingAssignments, error: assignmentsError } = useProjectCrew(
    clientId,
    projectId
  );
  const { callsByCrewMemberId, upsertCrewCall, deleteCrewCall } = useCrewCalls(
    clientId,
    projectId,
    scheduleId
  );

  const [draftByCrewMemberId, setDraftByCrewMemberId] = useState({});
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [isDeptPrecallModalOpen, setIsDeptPrecallModalOpen] = useState(false);
  const [deptPrecallTarget, setDeptPrecallTarget] = useState(null);
  const [deptPrecallTime, setDeptPrecallTime] = useState("");
  const [expandedDepts, setExpandedDepts] = useState(new Set());
  const [showLayoutOptions, setShowLayoutOptions] = useState(true);

  // Persisted display preferences (scoped to schedule to avoid cross-callsheet bleed)
  const keyEmails = scheduleId ? `callSheetCrew.showEmails:${scheduleId}` : null;
  const keyPhones = scheduleId ? `callSheetCrew.showPhones:${scheduleId}` : null;
  const keyColumnCount = scheduleId ? `callSheetCrew.columnCount:${scheduleId}` : null;
  const keyDepartmentOrder = scheduleId ? `callSheetCrew.departmentOrder:${scheduleId}` : null;

  const [showEmails, setShowEmails] = useState(() => {
    if (!keyEmails) return false;
    try {
      const stored = localStorage.getItem(keyEmails);
      if (stored == null) return false; // SetHero default: emails OFF when unset
      return stored === "true";
    } catch {
      return false;
    }
  });
  const [showPhones, setShowPhones] = useState(() => {
    if (!keyPhones) return false;
    try {
      const stored = localStorage.getItem(keyPhones);
      if (stored == null) return true;
      return stored === "true";
    } catch {
      return false;
    }
  });

  // Column count: "auto" | "1" | "2" | "3"
  const [columnCount, setColumnCount] = useState(() => {
    if (!keyColumnCount) return "auto";
    try {
      const stored = localStorage.getItem(keyColumnCount);
      if (stored === "1" || stored === "2" || stored === "3") return stored;
      return "auto"; // Default to auto when unset or invalid
    } catch {
      return "auto";
    }
  });

  // Department order: array of normalized department names (uppercase)
  const [departmentOrder, setDepartmentOrder] = useState(() => {
    if (!keyDepartmentOrder) return null;
    try {
      const stored = localStorage.getItem(keyDepartmentOrder);
      if (!stored) return null;
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  });

  const toggleShowEmails = useCallback((checked) => {
    setShowEmails(checked);
    if (!keyEmails) return;
    try {
      localStorage.setItem(keyEmails, String(checked));
      // Dispatch custom event for same-page listeners (PreviewPanel)
      window.dispatchEvent(new CustomEvent("crewDisplayOptionsChange"));
    } catch {}
  }, [keyEmails]);

  const toggleShowPhones = useCallback((checked) => {
    setShowPhones(checked);
    if (!keyPhones) return;
    try {
      localStorage.setItem(keyPhones, String(checked));
      // Dispatch custom event for same-page listeners (PreviewPanel)
      window.dispatchEvent(new CustomEvent("crewDisplayOptionsChange"));
    } catch {}
  }, [keyPhones]);

  const handleColumnCountChange = useCallback((value) => {
    setColumnCount(value);
    if (!keyColumnCount) return;
    try {
      localStorage.setItem(keyColumnCount, value);
      // Dispatch custom event for same-page listeners (PreviewPanel)
      window.dispatchEvent(new CustomEvent("crewDisplayOptionsChange"));
    } catch {}
  }, [keyColumnCount]);

  // Save department order to localStorage and dispatch event
  const saveDepartmentOrder = useCallback((order) => {
    setDepartmentOrder(order);
    if (!keyDepartmentOrder) return;
    try {
      if (order && order.length > 0) {
        localStorage.setItem(keyDepartmentOrder, JSON.stringify(order));
      } else {
        localStorage.removeItem(keyDepartmentOrder);
      }
      // Dispatch custom event for same-page listeners (PreviewPanel)
      window.dispatchEvent(new CustomEvent("crewDisplayOptionsChange"));
    } catch {}
  }, [keyDepartmentOrder]);

  const assignedCrew = useMemo(() => {
    return assignments
      .map((a) => {
        const member = crewById.get(a.crewMemberId) || null;
        return { assignment: a, member };
      })
      .filter((row) => row.assignment?.crewMemberId);
  }, [assignments, crewById]);

  const grouped = useMemo(() => {
    const groups = new Map();
    assignedCrew.forEach(({ assignment, member }) => {
      const resolvedScope = assignment.departmentScope || (assignment.departmentId ? "org" : null);
      const resolvedId = assignment.departmentId || member?.departmentId || null;
      const key = resolvedScope && resolvedId ? `${resolvedScope}:${resolvedId}` : "__unassigned__";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push({ assignment, member });
    });

    groups.forEach((rows) => {
      rows.sort((a, b) => {
        const aKey = `${a.member?.lastName || ""} ${a.member?.firstName || ""}`.trim().toLowerCase();
        const bKey = `${b.member?.lastName || ""} ${b.member?.firstName || ""}`.trim().toLowerCase();
        return aKey.localeCompare(bKey);
      });
    });

    return groups;
  }, [assignedCrew]);

  const orderedGroupIds = useMemo(() => {
    const orgIds = departments.map((d) => `org:${d.id}`);
    const projectIds = projectDepartments.map((d) => `project:${d.id}`);
    const existing = Array.from(grouped.keys()).filter((id) => id !== "__unassigned__");
    const ordered = [...orgIds, ...projectIds].filter((id) => existing.includes(id));
    const leftovers = existing.filter((id) => !ordered.includes(id));
    const hasUnassigned = grouped.has("__unassigned__");
    return [...ordered, ...leftovers, ...(hasUnassigned ? ["__unassigned__"] : [])];
  }, [departments, grouped, projectDepartments]);

  const departmentNameById = useMemo(() => {
    const map = new Map();
    departments.forEach((d) => map.set(`org:${d.id}`, d.name));
    projectDepartments.forEach((d) => map.set(`project:${d.id}`, d.name));
    return map;
  }, [departments, projectDepartments]);

  // Move a department up or down in the order
  const moveDepartment = useCallback((deptName, direction) => {
    // Get current departments from the grouped data
    const currentDepts = orderedGroupIds
      .map((id) => departmentNameById.get(id) || (id === "__unassigned__" ? "Unassigned" : "Unknown"))
      .map((name) => name.toUpperCase());

    // Use stored order if available, otherwise use current order
    const workingOrder = departmentOrder && departmentOrder.length > 0
      ? [...departmentOrder]
      : [...currentDepts];

    const normalizedName = deptName.toUpperCase();
    const currentIndex = workingOrder.indexOf(normalizedName);
    if (currentIndex === -1) return;

    const newIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= workingOrder.length) return;

    // Swap positions
    [workingOrder[currentIndex], workingOrder[newIndex]] = [workingOrder[newIndex], workingOrder[currentIndex]];
    saveDepartmentOrder(workingOrder);
  }, [departmentOrder, orderedGroupIds, departmentNameById, saveDepartmentOrder]);

  // Build position lookup from departments
  const positionById = useMemo(() => {
    const map = new Map();
    departments.forEach((dept) => {
      (dept.positions || []).forEach((pos) => {
        map.set(pos.id, pos.title);
      });
    });
    projectDepartments.forEach((dept) => {
      (dept.positions || []).forEach((pos) => {
        map.set(pos.id, pos.title);
      });
    });
    return map;
  }, [departments, projectDepartments]);

  // Build position name lookup for crew members
  const positionNameByCrewMemberId = useMemo(() => {
    const map = new Map();
    assignedCrew.forEach(({ assignment, member }) => {
      // Check assignment first, then fall back to member's positionId
      const posId = assignment.positionId || member?.positionId;
      if (posId && positionById.has(posId)) {
        map.set(assignment.crewMemberId, positionById.get(posId));
      }
    });
    return map;
  }, [assignedCrew, positionById]);

  // Initialize all departments as expanded
  useEffect(() => {
    if (orderedGroupIds.length > 0 && expandedDepts.size === 0) {
      setExpandedDepts(new Set(orderedGroupIds));
    }
  }, [orderedGroupIds, expandedDepts.size]);

  useEffect(() => {
    const next = {};
    assignedCrew.forEach(({ assignment }) => {
      const call = callsByCrewMemberId.get(assignment.crewMemberId);
      const value = (call?.callTime || call?.callText || "").trim();
      next[assignment.crewMemberId] = value;
    });
    setDraftByCrewMemberId(next);
  }, [assignedCrew, callsByCrewMemberId]);

  const applyCrewCall = useCallback(
    (crewMemberId) => {
      if (readOnly) return;
      const raw = (draftByCrewMemberId[crewMemberId] || "").trim();
      if (!raw) {
        deleteCrewCall.mutate(crewMemberId);
        return;
      }

      if (isTimeString(raw)) {
        upsertCrewCall.mutate({ crewMemberId, updates: { callTime: raw, callText: null } });
        return;
      }

      upsertCrewCall.mutate({ crewMemberId, updates: { callTime: null, callText: raw } });
    },
    [draftByCrewMemberId, readOnly, deleteCrewCall, upsertCrewCall]
  );

  const clearCrewCall = useCallback(
    (crewMemberId) => {
      if (readOnly) return;
      setDraftByCrewMemberId((prev) => ({
        ...prev,
        [crewMemberId]: "",
      }));
      deleteCrewCall.mutate(crewMemberId);
    },
    [readOnly, deleteCrewCall]
  );

  const handleDraftChange = useCallback((crewMemberId, value) => {
    setDraftByCrewMemberId((prev) => ({
      ...prev,
      [crewMemberId]: value,
    }));
  }, []);

  const toggleDeptExpanded = useCallback((deptId) => {
    setExpandedDepts((prev) => {
      const next = new Set(prev);
      if (next.has(deptId)) {
        next.delete(deptId);
      } else {
        next.add(deptId);
      }
      return next;
    });
  }, []);

  const handleSetDepartmentPrecall = useCallback((deptId) => {
    setDeptPrecallTarget(deptId);
    setDeptPrecallTime("");
    setIsDeptPrecallModalOpen(true);
  }, []);

  const applyDepartmentPrecall = useCallback(() => {
    if (!deptPrecallTarget || !deptPrecallTime.trim()) return;
    const rows = grouped.get(deptPrecallTarget) || [];
    const timeValue = deptPrecallTime.trim();
    const isTime = isTimeString(timeValue);

    rows.forEach(({ assignment }) => {
      const updates = isTime
        ? { callTime: timeValue, callText: null }
        : { callTime: null, callText: timeValue };
      upsertCrewCall.mutate({ crewMemberId: assignment.crewMemberId, updates });
    });

    setIsDeptPrecallModalOpen(false);
    setDeptPrecallTarget(null);
    setDeptPrecallTime("");
  }, [deptPrecallTarget, deptPrecallTime, grouped, upsertCrewCall]);

  const expandAll = useCallback(() => {
    setExpandedDepts(new Set(orderedGroupIds));
  }, [orderedGroupIds]);

  const collapseAll = useCallback(() => {
    setExpandedDepts(new Set());
  }, []);

  const totalCrew = assignedCrew.length;
  const totalPrecalls = assignedCrew.filter(({ assignment }) => {
    const draft = draftByCrewMemberId[assignment.crewMemberId] || "";
    return draft.trim().length > 0;
  }).length;

  return (
    <div className="space-y-4">
      {/* Header with controls */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            Crew Call Times
          </div>
          <div className="text-xs text-slate-500 mt-0.5">
            {totalPrecalls > 0
              ? `${totalPrecalls} of ${totalCrew} crew have custom precalls`
              : `${totalCrew} crew members`}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Copy precalls dropdown */}
          {previousSchedules.length > 0 ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Copy className="h-3.5 w-3.5" />
                  Copy from
                  <ChevronDown className="h-3 w-3 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {previousSchedules.map((sched) => (
                  <DropdownMenuItem key={sched.id}>
                    {sched.name || sched.date || sched.id}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}

          {/* Layout options toggle */}
          <Button
            variant={showLayoutOptions ? "secondary" : "outline"}
            size="sm"
            onClick={() => setShowLayoutOptions(!showLayoutOptions)}
          >
            <Settings2 className="h-3.5 w-3.5" />
          </Button>

          {/* Clear all */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsClearModalOpen(true)}
            disabled={readOnly || totalPrecalls === 0}
          >
            Clear All
          </Button>
        </div>
      </div>

      {/* Layout Options Panel */}
      {showLayoutOptions ? (
        <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-4 space-y-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Display Options
          </div>
          <div className="flex flex-wrap gap-6">
            {/* Email toggle */}
            <label className="flex items-center gap-2 cursor-pointer">
              <Switch checked={showEmails} onCheckedChange={toggleShowEmails} />
              <span className="text-sm text-slate-700 dark:text-slate-300">Show emails</span>
            </label>

            {/* Phone toggle */}
            <label className="flex items-center gap-2 cursor-pointer">
              <Switch checked={showPhones} onCheckedChange={toggleShowPhones} />
              <span className="text-sm text-slate-700 dark:text-slate-300">Show phone numbers</span>
            </label>

            {/* Column count */}
            <div className="flex items-center gap-2">
              <Columns className="h-4 w-4 text-slate-500 dark:text-slate-400" />
              <span className="text-sm text-slate-700 dark:text-slate-300">Columns</span>
              <select
                value={columnCount}
                onChange={(e) => handleColumnCountChange(e.target.value)}
                className="h-8 px-2 text-sm rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="auto">Auto</option>
                <option value="1">1</option>
                <option value="2">2</option>
              </select>
            </div>
          </div>

          {/* Expand/Collapse controls */}
          <div className="flex gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
            <Button variant="ghost" size="sm" onClick={expandAll}>
              Expand All
            </Button>
            <Button variant="ghost" size="sm" onClick={collapseAll}>
              Collapse All
            </Button>
          </div>

          {/* Department Order */}
          {orderedGroupIds.length > 1 ? (
            <div className="pt-3 border-t border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2 mb-2">
                <List className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Department Order
                </span>
              </div>
              <div className="space-y-1">
                {(() => {
                  // Build ordered list for display - use stored order if available
                  const currentDeptNames = orderedGroupIds.map((id) =>
                    departmentNameById.get(id) || (id === "__unassigned__" ? "Unassigned" : "Unknown")
                  );
                  const normalizedCurrent = currentDeptNames.map((n) => n.toUpperCase());

                  // If we have a stored order, use it (filtering to only include current departments)
                  let displayOrder;
                  if (departmentOrder && departmentOrder.length > 0) {
                    // Start with stored order items that exist in current data
                    const orderedItems = departmentOrder.filter((name) =>
                      normalizedCurrent.includes(name.toUpperCase())
                    );
                    // Add any new departments not in stored order
                    const newItems = normalizedCurrent.filter(
                      (name) => !departmentOrder.map((d) => d.toUpperCase()).includes(name)
                    );
                    displayOrder = [...orderedItems, ...newItems];
                  } else {
                    displayOrder = normalizedCurrent;
                  }

                  return displayOrder.map((deptName, index) => (
                    <div
                      key={deptName}
                      className="flex items-center gap-2 px-2 py-1.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                    >
                      <span className="flex-1 text-sm text-slate-700 dark:text-slate-300 truncate">
                        {deptName}
                      </span>
                      <div className="flex gap-0.5">
                        <button
                          type="button"
                          onClick={() => moveDepartment(deptName, "up")}
                          disabled={index === 0}
                          className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                          title="Move up"
                        >
                          <ChevronUp className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveDepartment(deptName, "down")}
                          disabled={index === displayOrder.length - 1}
                          className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                          title="Move down"
                        >
                          <ChevronDown className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Info banner */}
      <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-900/20 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
        <span className="font-medium">Tip:</span> Leave blank to use general crew call
        {generalCrewCallTime ? ` (${generalCrewCallTime})` : ""}. Enter a time (HH:MM) or text like
        "OFF" / "O/C".
      </div>

      {/* Content */}
      {loadingAssignments ? (
        <div className="text-sm text-slate-500 py-8 text-center">Loading crew assignments...</div>
      ) : assignmentsError ? (
        <div className="text-sm text-red-600 py-4">
          Failed to load project crew: {assignmentsError.message}
        </div>
      ) : assignedCrew.length === 0 ? (
        <div className="text-sm text-slate-500 py-8 text-center">
          No crew assigned to this project yet.
          <br />
          <span className="text-slate-400">Add crew in Project Assets.</span>
        </div>
      ) : (
        <div className="space-y-3">
          {orderedGroupIds.map((deptId) => {
            const rows = grouped.get(deptId) || [];
            const title =
              deptId === "__unassigned__"
                ? "Unassigned"
                : departmentNameById.get(deptId) || "Unknown Department";

            return (
              <DepartmentSection
                key={deptId}
                deptId={deptId}
                title={title}
                rows={rows}
                isExpanded={expandedDepts.has(deptId)}
                onToggleExpand={() => toggleDeptExpanded(deptId)}
                draftByCrewMemberId={draftByCrewMemberId}
                generalCrewCallTime={generalCrewCallTime}
                showEmails={showEmails}
                showPhones={showPhones}
                onDraftChange={handleDraftChange}
                onApplyCrewCall={applyCrewCall}
                onClearCrewCall={clearCrewCall}
                onSetDepartmentPrecall={handleSetDepartmentPrecall}
                readOnly={readOnly}
                positionNameByCrewMemberId={positionNameByCrewMemberId}
              />
            );
          })}
        </div>
      )}

      {/* Clear All Modal */}
      <Modal
        open={isClearModalOpen}
        onClose={() => setIsClearModalOpen(false)}
        labelledBy="callsheet-clear-crew-overrides-title"
        describedBy="callsheet-clear-crew-overrides-desc"
        contentClassName="!max-w-md !min-h-0"
        closeOnOverlay={false}
      >
        <div className="p-6">
          <div className="space-y-2">
            <div
              id="callsheet-clear-crew-overrides-title"
              className="text-lg font-semibold text-slate-900 dark:text-slate-100"
            >
              Clear all crew precalls?
            </div>
            <div
              id="callsheet-clear-crew-overrides-desc"
              className="text-sm text-slate-600 dark:text-slate-400"
            >
              This removes all custom crew call times for this schedule. Crew will use the general
              call time instead.
            </div>
          </div>
          <div className="mt-6 flex justify-end gap-3">
            <Button variant="outline" onClick={() => setIsClearModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                assignedCrew.forEach(({ assignment }) =>
                  deleteCrewCall.mutate(assignment.crewMemberId)
                );
                setIsClearModalOpen(false);
              }}
              disabled={readOnly}
            >
              Clear All
            </Button>
          </div>
        </div>
      </Modal>

      {/* Department Precall Modal */}
      <Modal
        open={isDeptPrecallModalOpen}
        onClose={() => setIsDeptPrecallModalOpen(false)}
        labelledBy="callsheet-dept-precall-title"
        describedBy="callsheet-dept-precall-desc"
        contentClassName="!max-w-md !min-h-0"
        closeOnOverlay={false}
      >
        <div className="p-6">
          <div className="space-y-2">
            <div
              id="callsheet-dept-precall-title"
              className="text-lg font-semibold text-slate-900 dark:text-slate-100"
            >
              Set department precall
            </div>
            <div
              id="callsheet-dept-precall-desc"
              className="text-sm text-slate-600 dark:text-slate-400"
            >
              Set the same call time for all crew in{" "}
              <span className="font-medium">
                {deptPrecallTarget === "__unassigned__"
                  ? "Unassigned"
                  : departmentNameById.get(deptPrecallTarget) || "this department"}
              </span>
              .
            </div>
          </div>
          <div className="mt-4">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Call time
            </label>
            <input
              type="text"
              value={deptPrecallTime}
              onChange={(e) => setDeptPrecallTime(e.target.value)}
              placeholder="HH:MM or text like OFF"
              className="mt-1 w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              autoFocus
            />
          </div>
          <div className="mt-6 flex justify-end gap-3">
            <Button variant="outline" onClick={() => setIsDeptPrecallModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={applyDepartmentPrecall} disabled={!deptPrecallTime.trim()}>
              Apply to All
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
