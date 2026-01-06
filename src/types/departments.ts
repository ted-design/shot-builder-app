import type { Timestamp } from "firebase/firestore";

export interface Department {
  id: string;
  name: string;
  order: number;
  isVisible: boolean;
  createdAt?: Timestamp | Date | null;
  updatedAt?: Timestamp | Date | null;
  createdBy?: string | null;
}

export interface Position {
  id: string;
  departmentId: string;
  title: string;
  order: number;
  createdAt?: Timestamp | Date | null;
  updatedAt?: Timestamp | Date | null;
  createdBy?: string | null;
}

export interface DepartmentWithPositions extends Department {
  positions: Position[];
}

