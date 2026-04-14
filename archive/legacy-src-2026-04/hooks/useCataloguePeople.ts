import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "../lib/firebase";
import { crewPath, talentPath } from "../lib/paths";
import { useAuth } from "../context/AuthContext";
import { useDepartments } from "./useDepartments";
import type {
  CataloguePerson,
  CatalogueCounts,
  CatalogueFilterGroup,
} from "../types/catalogue";

/**
 * Build a display name from first and last name.
 */
function buildDisplayName(firstName?: string | null, lastName?: string | null): string {
  const first = (firstName || "").trim();
  const last = (lastName || "").trim();
  const combined = `${first} ${last}`.trim();
  return combined || "Unnamed";
}

/**
 * Build avatar initials from first and last name.
 */
function buildAvatar(firstName?: string | null, lastName?: string | null): string {
  const first = (firstName || "").trim();
  const last = (lastName || "").trim();
  const firstInitial = first.charAt(0).toUpperCase();
  const lastInitial = last.charAt(0).toUpperCase();
  return `${firstInitial}${lastInitial}` || "??";
}

/**
 * Normalize a talent record to CataloguePerson.
 */
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
    role: (raw.name as string) || displayName, // For talent, role is often the character/model name
    location: null, // Talent doesn't have a location field by default
    payRate: null, // Can be extended if needed
    createdAt: raw.createdAt as Date | null,
    updatedAt: raw.updatedAt as Date | null,
    createdBy: (raw.createdBy as string) || null,
  };
}

/**
 * Normalize a crew member record to CataloguePerson.
 */
function normalizeCrew(
  id: string,
  raw: Record<string, unknown>,
  positionName?: string | null
): CataloguePerson {
  const firstName = (raw.firstName as string) || "";
  const lastName = (raw.lastName as string) || "";

  return {
    id,
    type: "crew",
    firstName,
    lastName,
    displayName: buildDisplayName(firstName, lastName),
    avatar: buildAvatar(firstName, lastName),
    email: (raw.email as string) || null,
    phone: (raw.phone as string) || null,
    notes: (raw.notes as string) || null,
    positionId: (raw.positionId as string) || null,
    departmentId: (raw.departmentId as string) || null,
    company: (raw.company as string) || null,
    role: positionName || null,
    location: null, // Can be extended if crew has location data
    payRate: null, // Can be extended if crew has pay rate data
    createdAt: raw.createdAt as Date | null,
    updatedAt: raw.updatedAt as Date | null,
    createdBy: (raw.createdBy as string) || null,
  };
}

interface UseCataloguePeopleOptions {
  /**
   * Filter group to apply: "all", "talent", or "crew"
   */
  filterGroup?: CatalogueFilterGroup;
  /**
   * Search query to filter by name, email, or role
   */
  searchQuery?: string;
}

interface UseCataloguePeopleResult {
  /**
   * Combined list of people (talent + crew), filtered and sorted
   */
  people: CataloguePerson[];
  /**
   * All people without filtering (for counts)
   */
  allPeople: CataloguePerson[];
  /**
   * Counts for each filter group
   */
  counts: CatalogueCounts;
  /**
   * Loading state
   */
  loading: boolean;
  /**
   * Error if any
   */
  error: Error | null;
}

/**
 * Hook to fetch and combine talent and crew data into a unified people list.
 * Supports filtering by type (talent/crew) and search query.
 */
export function useCataloguePeople(
  options: UseCataloguePeopleOptions = {}
): UseCataloguePeopleResult {
  const { filterGroup = "all", searchQuery = "" } = options;
  const { clientId } = useAuth();
  const { departments } = useDepartments(clientId);

  const [talent, setTalent] = useState<CataloguePerson[]>([]);
  const [crew, setCrew] = useState<CataloguePerson[]>([]);
  const [loadingTalent, setLoadingTalent] = useState(true);
  const [loadingCrew, setLoadingCrew] = useState(true);
  const [errorTalent, setErrorTalent] = useState<Error | null>(null);
  const [errorCrew, setErrorCrew] = useState<Error | null>(null);

  // Build position name lookup from departments
  const positionNameById = useMemo(() => {
    const map = new Map<string, string>();
    departments.forEach((dept) => {
      if (dept.positions) {
        dept.positions.forEach((pos) => {
          map.set(pos.id, pos.title);
        });
      }
    });
    return map;
  }, [departments]);

  // Subscribe to talent collection
  useEffect(() => {
    if (!clientId) {
      setTalent([]);
      setLoadingTalent(false);
      return;
    }

    setLoadingTalent(true);
    setErrorTalent(null);

    const talentRef = collection(db, ...talentPath(clientId));
    const talentQuery = query(talentRef, orderBy("lastName", "asc"));

    const unsubscribe = onSnapshot(
      talentQuery,
      (snapshot) => {
        const normalized = snapshot.docs.map((doc) =>
          normalizeTalent(doc.id, doc.data())
        );
        setTalent(normalized);
        setLoadingTalent(false);
      },
      (err) => {
        console.error("[useCataloguePeople] Talent subscription error:", err);
        setErrorTalent(err);
        setLoadingTalent(false);
      }
    );

    return () => unsubscribe();
  }, [clientId]);

  // Subscribe to crew collection
  useEffect(() => {
    if (!clientId) {
      setCrew([]);
      setLoadingCrew(false);
      return;
    }

    setLoadingCrew(true);
    setErrorCrew(null);

    const crewRef = collection(db, ...crewPath(clientId));
    const crewQuery = query(crewRef, orderBy("lastName", "asc"));

    const unsubscribe = onSnapshot(
      crewQuery,
      (snapshot) => {
        const normalized = snapshot.docs.map((doc) => {
          const data = doc.data();
          const positionId = data.positionId as string | undefined;
          const positionName = positionId ? positionNameById.get(positionId) : null;
          return normalizeCrew(doc.id, data, positionName);
        });
        setCrew(normalized);
        setLoadingCrew(false);
      },
      (err) => {
        console.error("[useCataloguePeople] Crew subscription error:", err);
        setErrorCrew(err);
        setLoadingCrew(false);
      }
    );

    return () => unsubscribe();
  }, [clientId, positionNameById]);

  // Update crew with position names when departments change
  useEffect(() => {
    setCrew((prev) =>
      prev.map((person) => {
        if (person.positionId) {
          const positionName = positionNameById.get(person.positionId);
          if (positionName !== person.role) {
            return { ...person, role: positionName || null };
          }
        }
        return person;
      })
    );
  }, [positionNameById]);

  // Combine and sort all people
  const allPeople = useMemo(() => {
    const combined = [...talent, ...crew];
    // Sort by last name, then first name
    combined.sort((a, b) => {
      const aKey = `${a.lastName || ""} ${a.firstName || ""}`.trim().toLowerCase();
      const bKey = `${b.lastName || ""} ${b.firstName || ""}`.trim().toLowerCase();
      return aKey.localeCompare(bKey);
    });
    return combined;
  }, [talent, crew]);

  // Calculate counts
  const counts = useMemo((): CatalogueCounts => {
    return {
      all: allPeople.length,
      talent: talent.length,
      crew: crew.length,
    };
  }, [allPeople, talent, crew]);

  // Apply filter and search
  const filteredPeople = useMemo(() => {
    let result = allPeople;

    // Apply type filter
    if (filterGroup === "talent") {
      result = result.filter((p) => p.type === "talent");
    } else if (filterGroup === "crew") {
      result = result.filter((p) => p.type === "crew");
    }

    // Apply search filter
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

  const loading = loadingTalent || loadingCrew;
  const error = errorTalent || errorCrew;

  return {
    people: filteredPeople,
    allPeople,
    counts,
    loading,
    error,
  };
}
