import type { LegacyUser } from "./types";
import type { User as FirebaseUser } from "firebase/auth";

export function adaptUser(u: FirebaseUser | null | undefined): LegacyUser | null {
  if (!u) return null;
  return {
    id: u.uid,
    email: u.email ?? null,
    name: u.displayName ?? (u.email ? u.email.split("@")[0] : null),
    photoURL: u.photoURL ?? null,
  };
}

