import { useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import { useProjectScope } from "../context/ProjectScopeContext";
import { useDepartments } from "./useDepartments";
import { useProjectDepartments } from "./useProjectDepartments";
import { useOrganizationCrew } from "./useOrganizationCrew";
import { useProjectCrew } from "./useProjectCrew";
import { useTalent } from "./useFirestoreQuery";
import type {
  CatalogueCounts,
  CatalogueFilterGroup,
  CataloguePerson,
} from "../types/catalogue";

function buildDisplayName(firstName?: string | null, lastName?: string | null): string {
  const first = (firstName || "").trim();
  const last = (lastName || "").trim();
  const combined = `${first} ${last}`.trim();
  return combined || "Unnamed";
}

function buildAvatar(firstName?: string | null, lastName?: string | null): string {
  const first = (firstName || "").trim();
  const last = (lastName || "").trim();
  const firstInitial = first.charAt(0).toUpperCase();
  const lastInitial = last.charAt(0).toUpperCase();
  return `${firstInitial}${lastInitial}` || "??";
}

function normalizeTalent(id: string, raw: Record<string, unknown>): CataloguePerson {
  const firstName = (raw.firstName as string) || "";
  const lastName = (raw.lastName as string) || "";
  const displayName = (raw.name as string) || buildDisplayName(firstName, lastName);

  return {
    id,
    type: "talent",
    firstName,
    lastName,
    displayName,
    avatar: buildAvatar(firstName, lastName),
    email: (raw.email as string) || null,
    phone: (raw.phone as string) || null,
    notes: (raw.notes as string) || (raw.sizing as string) || null,
    agency: (raw.agency as string) || null,
    gender: (raw.gender as string) || null,
    url: (raw.url as string) || null,
    headshotPath: (raw.headshotPath as string) || null,
    measurements: (raw.measurements as Record<string, unknown>) || null,
    role: (raw.name as string) || displayName,
    location: null,
    payRate: null,
    createdAt: raw.createdAt as Date | null,
    updatedAt: raw.updatedAt as Date | null,
    createdBy: (raw.createdBy as string) || null,
  };
}

function buildPositionTitleMap(departments: Array<{ positions?: Array<{ id: string; title: string }> }>, scope: "org" | "project") {
  const map = new Map<string, string>();
  departments.forEach((dept) => {
    (dept.positions || []).forEach((pos) => {
      map.set(`${scope}:${pos.id}`, pos.title);
    });
  });
  return map;
}

interface UseProjectCataloguePeopleOptions {
  filterGroup?: CatalogueFilterGroup;
  searchQuery?: string;
  projectId?: string | null;
}

interface UseProjectCataloguePeopleResult {
  people: CataloguePerson[];
  allPeople: CataloguePerson[];
  counts: CatalogueCounts;
  loading: boolean;
  error: Error | null;
}

export function useProjectCataloguePeople(
  options: UseProjectCataloguePeopleOptions = {}
): UseProjectCataloguePeopleResult {
  const { filterGroup = "all", searchQuery = "", projectId: projectIdOverride = null } = options;
  const { clientId } = useAuth();
  const { currentProjectId } = useProjectScope();
  const projectId = projectIdOverride ?? currentProjectId;

  const { departments: orgDepartments } = useDepartments(clientId);
  const { departments: projectDepartments } = useProjectDepartments(clientId, projectId);
  const { crew: orgCrew = [], loading: loadingCrew, error: errorCrew } = useOrganizationCrew(clientId);
  const { assignments: crewAssignments = [], loading: loadingAssignments, error: errorAssignments } = useProjectCrew(
    clientId,
    projectId
  );

  const {
    data: projectTalentRaw = [],
    isLoading: loadingTalent,
    error: talentError,
  } = useTalent(clientId, {
    projectId,
    scope: "project",
    enabled: Boolean(clientId && projectId),
  });

  const positionTitleByScopedId = useMemo(() => {
    const map = new Map<string, string>();
    const orgMap = buildPositionTitleMap(orgDepartments, "org");
    const projectMap = buildPositionTitleMap(projectDepartments, "project");
    orgMap.forEach((value, key) => map.set(key, value));
    projectMap.forEach((value, key) => map.set(key, value));
    return map;
  }, [orgDepartments, projectDepartments]);

  const crewById = useMemo(() => new Map(orgCrew.map((member) => [member.id, member])), [orgCrew]);

  const crewPeople = useMemo((): CataloguePerson[] => {
    if (!projectId) return [];

    const assignmentsByCrewId = new Map<string, Array<typeof crewAssignments[number]>>();
    crewAssignments.forEach((assignment) => {
      if (!assignment.crewMemberId) return;
      const list = assignmentsByCrewId.get(assignment.crewMemberId) || [];
      list.push(assignment);
      assignmentsByCrewId.set(assignment.crewMemberId, list);
    });

    const people: CataloguePerson[] = [];
    assignmentsByCrewId.forEach((assignments, crewMemberId) => {
      const crewMember = crewById.get(crewMemberId);
      if (!crewMember) return;

      const positionTitles = new Set<string>();
      assignments.forEach((assignment) => {
        if (!assignment.positionId) return;
        const scope = assignment.positionScope || "org";
        const title = positionTitleByScopedId.get(`${scope}:${assignment.positionId}`);
        if (title) positionTitles.add(title);
      });

      const role = positionTitles.size ? Array.from(positionTitles).join(", ") : null;

      people.push({
        id: crewMember.id,
        type: "crew",
        firstName: crewMember.firstName || "",
        lastName: crewMember.lastName || "",
        displayName: buildDisplayName(crewMember.firstName, crewMember.lastName),
        avatar: buildAvatar(crewMember.firstName, crewMember.lastName),
        email: crewMember.email || null,
        phone: crewMember.phone || null,
        notes: crewMember.notes || null,
        positionId: crewMember.positionId || null,
        departmentId: crewMember.departmentId || null,
        company: crewMember.company || null,
        role,
        location: null,
        payRate: null,
        createdAt: crewMember.createdAt || null,
        updatedAt: crewMember.updatedAt || null,
        createdBy: crewMember.createdBy || null,
      });
    });

    people.sort((a, b) => {
      const aKey = `${a.lastName || ""} ${a.firstName || ""}`.trim().toLowerCase();
      const bKey = `${b.lastName || ""} ${b.firstName || ""}`.trim().toLowerCase();
      return aKey.localeCompare(bKey);
    });

    return people;
  }, [crewAssignments, crewById, positionTitleByScopedId, projectId]);

  const talentPeople = useMemo((): CataloguePerson[] => {
    return projectTalentRaw.map((talent: any) => normalizeTalent(talent.id, talent));
  }, [projectTalentRaw]);

  const allPeople = useMemo(() => {
    const combined = [...crewPeople, ...talentPeople];
    combined.sort((a, b) => {
      const aKey = `${a.lastName || ""} ${a.firstName || ""}`.trim().toLowerCase();
      const bKey = `${b.lastName || ""} ${b.firstName || ""}`.trim().toLowerCase();
      return aKey.localeCompare(bKey);
    });
    return combined;
  }, [crewPeople, talentPeople]);

  const counts = useMemo((): CatalogueCounts => {
    return {
      all: allPeople.length,
      crew: crewPeople.length,
      talent: talentPeople.length,
    };
  }, [allPeople, crewPeople, talentPeople]);

  const filteredPeople = useMemo(() => {
    let result = allPeople;

    if (filterGroup === "talent") result = result.filter((p) => p.type === "talent");
    else if (filterGroup === "crew") result = result.filter((p) => p.type === "crew");

    const query = searchQuery.trim().toLowerCase();
    if (query) {
      result = result.filter((p) => {
        const searchable = [
          p.firstName,
          p.lastName,
          p.displayName,
          p.email,
          p.role,
          p.agency,
          p.company,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return searchable.includes(query);
      });
    }

    return result;
  }, [allPeople, filterGroup, searchQuery]);

  const error = (talentError as Error | null) || errorAssignments || errorCrew || null;
  const loading = loadingTalent || loadingCrew || loadingAssignments;

  return {
    people: filteredPeople,
    allPeople,
    counts,
    loading,
    error,
  };
}

