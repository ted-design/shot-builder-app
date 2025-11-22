import React, { useEffect, useMemo, useState } from "react";
import { updateEmail, updateProfile } from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import Avatar from "../components/ui/Avatar";
import { LoadingSpinner } from "../components/ui/LoadingSpinner";
import { useAuth } from "../context/AuthContext";
import { db, uploadImageFile, deleteImageByPath } from "../lib/firebase";
import SingleImageDropzone from "../components/common/SingleImageDropzone";
import { toast } from "../lib/toast";

const inputClass =
  "w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm transition placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500";

export default function AccountSettingsPage() {
  const { user, clientId } = useAuth();
  const [formState, setFormState] = useState({
    firstName: "",
    lastName: "",
    title: "",
    phone: "",
    email: "",
    avatarUrl: "",
    avatarPath: null,
  });
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [saving, setSaving] = useState(false);
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState("");
  const [reauthError, setReauthError] = useState("");
  const [removedAvatarPath, setRemovedAvatarPath] = useState(null);

  const displayName = useMemo(
    () => [formState.firstName, formState.lastName].filter(Boolean).join(" ").trim(),
    [formState.firstName, formState.lastName]
  );

  // Prime form with auth values
  useEffect(() => {
    if (!user) {
      setLoadingProfile(false);
      return;
    }

    const parts = (user.displayName || "").trim().split(" ").filter(Boolean);
    const firstName = parts[0] || "";
    const lastName = parts.length > 1 ? parts.slice(1).join(" ") : "";

    setFormState((prev) => ({
      ...prev,
      firstName,
      lastName,
      email: user.email || "",
      phone: user.phoneNumber || "",
      avatarUrl: user.photoURL || "",
    }));
    setLoadingProfile(false);
  }, [user]);

  // Load extra profile info from Firestore
  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      if (!user || !clientId) return;
      try {
        const profileRef = doc(db, "clients", clientId, "users", user.uid);
        const snapshot = await getDoc(profileRef);
        if (!snapshot.exists() || cancelled) return;

        const data = snapshot.data() || {};
        setFormState((prev) => ({
          ...prev,
          title: data.title || prev.title,
          phone: data.phone || prev.phone,
          email: data.email || prev.email,
          avatarUrl: data.photoURL || prev.avatarUrl,
          avatarPath: data.avatarPath || prev.avatarPath,
        }));
      } catch (error) {
        console.error("Failed to load account profile", error);
      }
    }

    loadProfile();
    return () => {
      cancelled = true;
    };
  }, [user, clientId]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    if (name === "email" && reauthError) {
      setReauthError("");
    }
    setFormState((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!user) return;

    setSaving(true);
    setReauthError("");

    let nextAvatarUrl = formState.avatarUrl;
    let nextAvatarPath = formState.avatarPath;

    const pathToRemove = removedAvatarPath || formState.avatarPath;
    if (!avatarFile && !nextAvatarUrl && pathToRemove) {
      await deleteImageByPath(pathToRemove).catch(() => {});
      nextAvatarPath = null;
    }

    if (avatarFile) {
      setAvatarUploading(true);
      setAvatarError("");
      try {
        const { downloadURL, path } = await uploadImageFile(avatarFile, {
          folder: "avatars",
          id: user.uid,
          filename: "avatar.webp",
        });
        if (formState.avatarPath && formState.avatarPath !== path) {
          await deleteImageByPath(formState.avatarPath).catch(() => {});
        }
        nextAvatarUrl = downloadURL;
        nextAvatarPath = path;
        setFormState((prev) => ({ ...prev, avatarUrl: downloadURL, avatarPath: path }));
        setAvatarFile(null);
        setRemovedAvatarPath(null);
      } catch (error) {
        console.error("Failed to upload avatar", error);
        setAvatarError(error?.message || "Avatar upload failed. Please try again.");
        setSaving(false);
        setAvatarUploading(false);
        return;
      } finally {
        setAvatarUploading(false);
      }
    }

    try {
      const mergedDisplayName = displayName || user.displayName || "";
      const profileUpdates = {};

      if (mergedDisplayName && mergedDisplayName !== user.displayName) {
        profileUpdates.displayName = mergedDisplayName;
      }
      if ((nextAvatarUrl || "") !== (user.photoURL || "")) {
        profileUpdates.photoURL = nextAvatarUrl || null;
      }

      if (Object.keys(profileUpdates).length > 0) {
        await updateProfile(user, profileUpdates);
      }

      if (formState.email && formState.email !== user.email) {
        await updateEmail(user, formState.email.trim());
      }

      if (clientId) {
        const profileRef = doc(db, "clients", clientId, "users", user.uid);
        await setDoc(
          profileRef,
          {
            displayName: mergedDisplayName || null,
            email: formState.email || null,
            phone: formState.phone || null,
            title: formState.title || null,
            photoURL: nextAvatarUrl || null,
            avatarPath: nextAvatarPath || null,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      }

      setFormState((prev) => ({
        ...prev,
        avatarUrl: nextAvatarUrl || "",
        avatarPath: nextAvatarPath || null,
      }));
      setRemovedAvatarPath(null);

      toast.success({ title: "Profile updated" });
    } catch (error) {
      console.error("Failed to update account settings", error);
      if (error?.code === "auth/requires-recent-login") {
        setReauthError("Please re-authenticate to change your email. Sign out and sign back in, then try again.");
      }
      toast.error({
        title: "Unable to update account",
        description: error?.message || "Please try again.",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loadingProfile) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">Account settings</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Manage your profile details, contact information, and avatar.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-card border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <div className="flex items-center gap-3">
            <Avatar name={displayName || user?.email || "Me"} email={user?.email} photoUrl={formState.avatarUrl} size="lg" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-50 truncate">{displayName || "Unnamed user"}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{formState.email || "No email on file"}</p>
              {formState.title ? (
                <p className="text-xs text-primary mt-1">{formState.title}</p>
              ) : null}
            </div>
          </div>
          <div className="mt-4 space-y-2 text-xs text-slate-500 dark:text-slate-400">
            <p>Updates here will sync across your profile and shared documents.</p>
            <p className="text-[11px] text-slate-400 dark:text-slate-500">
              Note: changing your email may require re-authentication depending on your provider.
            </p>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="lg:col-span-2 rounded-card border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800"
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">First name</span>
              <input
                name="firstName"
                value={formState.firstName}
                onChange={handleChange}
                placeholder="e.g. Alex"
                className={inputClass}
              />
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Last name</span>
              <input
                name="lastName"
                value={formState.lastName}
                onChange={handleChange}
                placeholder="e.g. Rivera"
                className={inputClass}
              />
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Title</span>
              <input
                name="title"
                value={formState.title}
                onChange={handleChange}
                placeholder="Producer, Director, Coordinator..."
                className={inputClass}
              />
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Phone</span>
              <input
                name="phone"
                value={formState.phone}
                onChange={handleChange}
                placeholder="+1 (555) 000-0000"
                className={inputClass}
              />
            </label>
            <label className="space-y-1 md:col-span-2">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Email</span>
              <input
                type="email"
                name="email"
                value={formState.email}
                onChange={handleChange}
                placeholder="you@example.com"
                className={inputClass}
                required
              />
              {reauthError ? (
                <p className="text-xs text-amber-600 dark:text-amber-400">{reauthError}</p>
              ) : (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Changing your email may require re-authentication depending on your provider.
                </p>
              )}
            </label>
            <div className="space-y-2 md:col-span-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Avatar</span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Images are optimized and converted to WebP automatically.
                </span>
              </div>
              <SingleImageDropzone
                value={avatarFile}
                onChange={setAvatarFile}
                existingImageUrl={formState.avatarUrl}
                onRemoveExisting={() => {
                  setRemovedAvatarPath((prev) => prev || formState.avatarPath);
                  setAvatarFile(null);
                  setFormState((prev) => ({ ...prev, avatarUrl: "", avatarPath: null }));
                }}
                disabled={saving || avatarUploading}
                showPreview
                className="bg-slate-50 dark:bg-slate-900/50"
              />
              {avatarError && (
                <p className="text-xs text-red-600 dark:text-red-400">{avatarError}</p>
              )}
            </div>
          </div>

          <div className="mt-6 flex items-center justify-end gap-3">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Tip: choose “System” theme in your profile menu to follow your OS settings.
            </p>
            <button
              type="submit"
              disabled={saving || avatarUploading}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70 dark:bg-indigo-500 dark:hover:bg-indigo-400"
            >
              {(saving || avatarUploading) && <LoadingSpinner size="sm" />}
              {avatarUploading ? "Uploading avatar..." : "Save changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
