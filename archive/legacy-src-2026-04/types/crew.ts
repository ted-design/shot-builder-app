import type { Timestamp } from "firebase/firestore";

export interface CrewMember {
  id: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  positionId?: string | null;
  departmentId?: string | null;
  company?: string | null;
  notes?: string | null;
  createdAt?: Timestamp | Date | null;
  updatedAt?: Timestamp | Date | null;
  createdBy?: string | null;
}

export interface ProjectCrewAssignment {
  id: string;
  projectId: string;
  crewMemberId: string;
  positionId?: string | null;
  positionScope?: "org" | "project" | null;
  departmentId?: string | null;
  departmentScope?: "org" | "project" | null;
  notes?: string | null;
  createdAt?: Timestamp | Date | null;
  updatedAt?: Timestamp | Date | null;
  createdBy?: string | null;
}
