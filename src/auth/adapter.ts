import type { LegacyUser } from "./types";
import type { User as FirebaseUser } from "firebase/auth";

export function adaptUser(u: FirebaseUser | null | undefined): LegacyUser | null {
  if (!u) return null;
  const providers = Array.isArray(u.providerData)
    ? u.providerData.map((p) => p?.providerId).filter(Boolean) as string[]
    : [];
  return {
    id: u.uid,
    email: u.email ?? null,
    name: u.displayName ?? (u.email ? u.email.split("@")[0] : null),
    avatarUrl: u.photoURL ?? null,
    verified: Boolean(u.emailVerified),
    providers,
  } as any;
}
