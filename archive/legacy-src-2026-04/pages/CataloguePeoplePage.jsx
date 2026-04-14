import React, { useState, useMemo } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useProjectCataloguePeople } from "../hooks/useProjectCataloguePeople";
import { useTalent } from "../hooks/useFirestoreQuery";
import { useDepartments } from "../hooks/useDepartments";
import { useOrganizationCrew } from "../hooks/useOrganizationCrew";
import { useProjectCrew } from "../hooks/useProjectCrew";
import { useProjectDepartments } from "../hooks/useProjectDepartments";
import CataloguePeopleSidebar from "../components/catalogue/CataloguePeopleSidebar";
import CataloguePeopleContent from "../components/catalogue/CataloguePeopleContent";
import AddPersonModal from "../components/crew/AddPersonModal";
import CrewEditModal from "../components/crew/CrewEditModal";
import ProjectCrewRolesModal from "../components/crew/ProjectCrewRolesModal";
import TalentCreateModal from "../components/talent/TalentCreateModal";
import TalentEditModal from "../components/talent/TalentEditModal";
import { addDoc, collection, serverTimestamp, updateDoc, doc, arrayUnion, arrayRemove } from "../lib/demoSafeFirestore";
import { db, deleteImageByPath, uploadImageFile } from "../lib/firebase";
import { writeDoc } from "../lib/firestoreWrites";
import { talentPath } from "../lib/paths";
import { normalizeMeasurementsMap } from "../lib/measurements";
import { describeFirebaseError } from "../lib/firebaseErrors";
import { toast } from "../lib/toast";
import { canManageProjects, canManageTalent } from "../lib/rbac";
import { buildTalentGalleryUpdate, stripHtmlToText } from "../lib/talentGallery";

/**
 * CataloguePeoplePage
 *
 * Displays the People section of the Catalogue with a secondary sidebar
 * for filtering between All People, Crew, and Talent.
 */
export default function CataloguePeoplePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { projectId } = useParams();
  const { clientId, user, role: globalRole } = useAuth();

  // Determine the current filter group from the URL
  const filterGroup = useMemo(() => {
    const path = location.pathname;
    if (path.endsWith("/talent")) return "talent";
    if (path.endsWith("/crew")) return "crew";
    return "all";
  }, [location.pathname]);

  // State for search query
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch project-scoped people data
  const { people, counts, loading, error } = useProjectCataloguePeople({
    filterGroup,
    searchQuery,
    projectId,
  });

  const canManageCrew = canManageProjects(globalRole);
  const canManageTalentRecords = canManageTalent(globalRole);

  const { departments: orgDepartments = [] } = useDepartments(clientId);

  const [openCrewAddModal, setOpenCrewAddModal] = useState(false);
  const [crewAddBusy, setCrewAddBusy] = useState(false);

  const [openTalentAddModal, setOpenTalentAddModal] = useState(false);
  const [talentAddBusy, setTalentAddBusy] = useState(false);

  const { crew: orgCrew = [], createCrewMember, updateCrewMember } = useOrganizationCrew(clientId);
  const {
    assignments: crewAssignments = [],
    createAssignment,
    updateAssignment,
    deleteAssignment,
  } = useProjectCrew(clientId, projectId);
  const { departments: projectDepartments, createPosition } = useProjectDepartments(clientId, projectId);

  const existingCrewIds = useMemo(() => new Set(crewAssignments.map((a) => a.crewMemberId).filter(Boolean)), [crewAssignments]);

  const { data: projectTalent = [] } = useTalent(clientId, {
    scope: "project",
    projectId,
    enabled: Boolean(clientId && projectId),
  });
  const { data: allTalent = [] } = useTalent(clientId, { scope: "all", enabled: Boolean(clientId) });

  const projectTalentIds = useMemo(() => new Set(projectTalent.map((t) => t.id)), [projectTalent]);
  const projectTalentById = useMemo(() => new Map(projectTalent.map((talent) => [talent.id, talent])), [projectTalent]);

  const crewById = useMemo(() => new Map(orgCrew.map((member) => [member.id, member])), [orgCrew]);
  const crewAssignmentsByCrewId = useMemo(() => {
    const map = new Map();
    crewAssignments.forEach((assignment) => {
      if (!assignment.crewMemberId) return;
      const list = map.get(assignment.crewMemberId) || [];
      list.push(assignment);
      map.set(assignment.crewMemberId, list);
    });
    return map;
  }, [crewAssignments]);
  const projectDepartmentIds = useMemo(() => new Set(projectDepartments.map((dept) => dept.id)), [projectDepartments]);
  const combinedDepartments = useMemo(() => {
    const map = new Map();
    [...projectDepartments, ...orgDepartments].forEach((dept) => {
      if (!dept?.id) return;
      map.set(dept.id, dept);
    });
    return Array.from(map.values());
  }, [orgDepartments, projectDepartments]);

  const [editTalentTarget, setEditTalentTarget] = useState(null);
  const [talentEditBusy, setTalentEditBusy] = useState(false);
  const [editCrewTarget, setEditCrewTarget] = useState(null);
  const [crewEditBusy, setCrewEditBusy] = useState(false);
  const [editCrewRolesTarget, setEditCrewRolesTarget] = useState(null);
  const [crewRolesBusy, setCrewRolesBusy] = useState(false);

  const addMenuItems = useMemo(() => {
    const items = [];

    const addCrewItems = () => {
      items.push({
        key: "add-crew",
        label: "Add crew",
        disabled: !canManageCrew,
        onSelect: () => setOpenCrewAddModal(true),
      });
    };

    const addTalentItems = () => {
      items.push({
        key: "add-talent",
        label: "Add talent",
        disabled: !canManageTalentRecords,
        onSelect: () => setOpenTalentAddModal(true),
      });
    };

    if (filterGroup === "crew") addCrewItems();
    else if (filterGroup === "talent") addTalentItems();
    else {
      addTalentItems();
      addCrewItems();
    }

    return items;
  }, [canManageCrew, canManageTalentRecords, filterGroup]);

  const addCrewToProject = async ({ crewMember, roles, isNew }) => {
    if (!clientId || !projectId) throw new Error("Missing project");
    if (!canManageCrew) throw new Error("You do not have permission to manage crew.");

    setCrewAddBusy(true);
    try {
      let crewMemberId = crewMember.id;

      if (isNew) {
        const result = await createCrewMember.mutateAsync({
          firstName: crewMember.firstName,
          lastName: crewMember.lastName,
          email: crewMember.email,
          phone: crewMember.phone,
          notes: crewMember.notes,
          departmentId: null,
          positionId: null,
        });
        crewMemberId = result?.id;
        if (!crewMemberId) throw new Error("Failed to create crew member");
      }

      for (const role of roles) {
        await createAssignment.mutateAsync({
          crewMemberId,
          departmentId: role.departmentId,
          departmentScope: role.departmentScope || "project",
          positionId: role.positionId,
          positionScope: role.positionScope || "project",
        });
      }

      const name = `${crewMember.firstName || ""} ${crewMember.lastName || ""}`.trim() || "Crew member";
      toast.success({
        title: `${name} added to project`,
        description: `Assigned ${roles.length} role${roles.length === 1 ? "" : "s"}`,
      });
    } finally {
      setCrewAddBusy(false);
    }
  };

  const createProjectTalent = async ({
    firstName,
    lastName,
    agency,
    phone,
    email,
    notes,
    measurements,
    sizing,
    galleryImages,
    url,
    gender,
    headshotFile,
  }) => {
    if (!clientId || !projectId) throw new Error("Missing project");
    if (!user) throw new Error("You must be signed in to add talent.");
    if (!canManageTalentRecords) throw new Error("You do not have permission to add talent.");

    const first = (firstName || "").trim();
    const last = (lastName || "").trim();
    if (!first && !last) throw new Error("Enter at least a first or last name.");

    const name = `${first} ${last}`.trim() || "Unnamed talent";
    setTalentAddBusy(true);

    try {
      const notesHtml = notes || sizing || "";
      const notesPlain = stripHtmlToText(notesHtml || "");
      const measurementData = normalizeMeasurementsMap(measurements);

      const docRef = await writeDoc("create talent", () =>
        addDoc(collection(db, ...talentPath(clientId)), {
          firstName: first,
          lastName: last,
          agency: agency || "",
          phone: phone || "",
          email: email || "",
          notes: notesHtml || "",
          sizing: notesPlain,
          url: url || "",
          gender: gender || "",
          name,
          shotIds: [],
          projectIds: [projectId],
          headshotPath: null,
          galleryImages: [],
          measurements: measurementData,
          createdAt: serverTimestamp(),
          createdBy: user?.uid || null,
        })
      );

      if (headshotFile) {
        const { path } = await uploadImageFile(headshotFile, { folder: "talent", id: docRef.id });
        await updateDoc(doc(db, ...talentPath(clientId), docRef.id), { headshotPath: path });
      }

      if (Array.isArray(galleryImages) && galleryImages.length) {
        const { finalGallery } = await buildTalentGalleryUpdate(docRef.id, galleryImages, []);
        await updateDoc(doc(db, ...talentPath(clientId), docRef.id), { galleryImages: finalGallery });
      }

      toast.success({ title: `${name} added to project talent` });
    } catch (error) {
      const { code, message } = describeFirebaseError(error, "Unable to create talent.");
      throw new Error(`${code}: ${message}`);
    } finally {
      setTalentAddBusy(false);
    }
  };

  const addExistingTalentToProject = async (ids) => {
    if (!clientId || !projectId) throw new Error("Missing project");
    setTalentAddBusy(true);
    try {
      await Promise.all(
        ids.map((id) => updateDoc(doc(db, ...talentPath(clientId), id), { projectIds: arrayUnion(projectId) }))
      );
      toast.success({ title: `Added ${ids.length} talent to project` });
    } catch (e) {
      console.error("[CataloguePeoplePage] addExistingTalentToProject failed", e);
      toast.error({ title: "Failed to add talent", description: e?.message });
      throw e;
    } finally {
      setTalentAddBusy(false);
    }
  };

  const handleEditPerson = (person) => {
    if (!person?.id || !person?.type) return;
    if (person.type === "talent") {
      const talentRecord = projectTalentById.get(person.id);
      if (!talentRecord) {
        toast.error({ title: "Talent record not found" });
        return;
      }
      setEditTalentTarget(talentRecord);
      return;
    }

    if (person.type === "crew") {
      const crewRecord = crewById.get(person.id);
      if (!crewRecord) {
        toast.error({ title: "Crew record not found" });
        return;
      }
      setEditCrewRolesTarget(crewRecord);
    }
  };

  const handleSaveTalent = async ({ updates, newImageFile, removeImage }) => {
    if (!clientId) throw new Error("Missing client");
    if (!canManageTalentRecords) throw new Error("You do not have permission to edit talent.");
    if (!editTalentTarget?.id) throw new Error("No talent selected for editing.");

    const talentId = editTalentTarget.id;
    const docRef = doc(db, ...talentPath(clientId), talentId);

    setTalentEditBusy(true);
    try {
      const patch = { ...updates };

      if (Object.prototype.hasOwnProperty.call(updates, "notes")) {
        const notesHtml = updates.notes || "";
        patch.notes = notesHtml;
        patch.sizing = stripHtmlToText(notesHtml);
      }

      if (Object.prototype.hasOwnProperty.call(updates, "measurements")) {
        patch.measurements = normalizeMeasurementsMap(updates.measurements);
      }

      let removedGallery = [];
      if (Object.prototype.hasOwnProperty.call(updates, "galleryImages")) {
        const previousGallery = Array.isArray(editTalentTarget.galleryImages) ? editTalentTarget.galleryImages : [];
        const nextGallery = Array.isArray(updates.galleryImages) ? updates.galleryImages : [];
        const { finalGallery, removed } = await buildTalentGalleryUpdate(talentId, nextGallery, previousGallery);
        patch.galleryImages = finalGallery;
        removedGallery = removed;
      }

      await updateDoc(docRef, patch);

      if (newImageFile) {
        const { path } = await uploadImageFile(newImageFile, { folder: "talent", id: talentId });
        await updateDoc(docRef, { headshotPath: path });
        if (editTalentTarget.headshotPath) {
          await deleteImageByPath(editTalentTarget.headshotPath).catch(() => {});
        }
      } else if (removeImage && editTalentTarget.headshotPath) {
        await updateDoc(docRef, { headshotPath: null });
        await deleteImageByPath(editTalentTarget.headshotPath).catch(() => {});
      }

      if (removedGallery.length) {
        await Promise.all(
          removedGallery.map((item) => (item.path ? deleteImageByPath(item.path).catch(() => {}) : Promise.resolve()))
        );
      }

      const name = updates?.name || `${updates?.firstName || ""} ${updates?.lastName || ""}`.trim() || "talent";
      toast.success({ title: `Saved changes for ${name}` });
    } catch (error) {
      toast.error({ title: "Unable to update talent", description: error?.message });
      throw error;
    } finally {
      setTalentEditBusy(false);
    }
  };

  const handleSaveCrew = async ({ updates }) => {
    if (!canManageCrew) throw new Error("You do not have permission to manage crew.");
    if (!editCrewTarget?.id) throw new Error("No crew member selected for editing.");

    setCrewEditBusy(true);
    try {
      await updateCrewMember.mutateAsync({
        crewMemberId: editCrewTarget.id,
        updates,
      });
      const displayName =
        `${updates?.firstName ?? editCrewTarget.firstName ?? ""} ${updates?.lastName ?? editCrewTarget.lastName ?? ""}`.trim() ||
        "crew member";
      toast.success({ title: `Saved changes for ${displayName}` });
    } finally {
      setCrewEditBusy(false);
    }
  };

  const handleSaveCrewRoles = async ({ crewMemberId, roles }) => {
    if (!clientId || !projectId) throw new Error("Missing project");
    if (!canManageCrew) throw new Error("You do not have permission to manage crew.");
    if (!crewMemberId) throw new Error("Missing crew member");

    const existing = crewAssignmentsByCrewId.get(crewMemberId) || [];
    const existingById = new Map(existing.map((assignment) => [assignment.id, assignment]));

    const deduped = [];
    const seen = new Set();
    (roles || []).forEach((role) => {
      const departmentId = (role.departmentId || "").trim();
      const positionId = (role.positionId || "").trim();
      if (!departmentId || !positionId) return;
      const scope = projectDepartmentIds.has(departmentId) ? "project" : "org";
      const key = `${scope}:${departmentId}:${positionId}`;
      if (seen.has(key)) return;
      seen.add(key);
      deduped.push({
        assignmentId: role.assignmentId || null,
        departmentId,
        positionId,
        scope,
      });
    });

    if (!deduped.length) throw new Error("Assign at least one role.");

    setCrewRolesBusy(true);
    try {
      const keepIds = new Set(deduped.map((role) => role.assignmentId).filter(Boolean));
      const toDelete = existing.filter((assignment) => !keepIds.has(assignment.id));
      await Promise.all(toDelete.map((assignment) => deleteAssignment.mutateAsync(assignment.id)));

      for (const role of deduped) {
        if (role.assignmentId) {
          const prev = existingById.get(role.assignmentId);
          if (!prev) continue;
          const updates = {};
          if (prev.departmentId !== role.departmentId) updates.departmentId = role.departmentId;
          if (prev.positionId !== role.positionId) updates.positionId = role.positionId;
          if (prev.departmentScope !== role.scope) updates.departmentScope = role.scope;
          if (prev.positionScope !== role.scope) updates.positionScope = role.scope;
          if (Object.keys(updates).length) {
            await updateAssignment.mutateAsync({ assignmentId: role.assignmentId, updates });
          }
        } else {
          await createAssignment.mutateAsync({
            crewMemberId,
            departmentId: role.departmentId,
            departmentScope: role.scope,
            positionId: role.positionId,
            positionScope: role.scope,
          });
        }
      }

      toast.success({ title: "Roles updated" });
    } finally {
      setCrewRolesBusy(false);
    }
  };

  const handleCreateProjectPosition = async ({ departmentId, title }) => {
    if (!projectDepartmentIds.has(departmentId)) {
      throw new Error("New positions can only be created in project departments.");
    }
    const result = await createPosition.mutateAsync({ departmentId, title });
    return result;
  };

  const handleRemoveFromProject = async (selectedPeople = []) => {
    if (!clientId || !projectId) throw new Error("Missing project");
    if (!selectedPeople.length) return;

    const crewIds = selectedPeople.filter((p) => p.type === "crew").map((p) => p.id);
    const talentIds = selectedPeople.filter((p) => p.type === "talent").map((p) => p.id);

    const message = `Remove ${selectedPeople.length} people from this project?`;
    if (!confirm(message)) return;

    if (crewIds.length) {
      if (!canManageCrew) throw new Error("You do not have permission to manage crew.");
      const assignmentIds = crewAssignments
        .filter((assignment) => assignment.crewMemberId && crewIds.includes(assignment.crewMemberId))
        .map((assignment) => assignment.id);
      await Promise.all(assignmentIds.map((id) => deleteAssignment.mutateAsync(id)));
    }

    if (talentIds.length) {
      if (!canManageTalentRecords) throw new Error("You do not have permission to manage talent.");
      await Promise.all(
        talentIds.map((id) =>
          updateDoc(doc(db, ...talentPath(clientId), id), { projectIds: arrayRemove(projectId) })
        )
      );
    }

    toast.success({ title: "Removed from project" });
  };

  // Handle group selection from sidebar
  const handleSelectGroup = (group) => {
    const basePath = `/projects/${projectId}/catalogue/people`;
    switch (group) {
      case "talent":
        navigate(`${basePath}/talent`);
        break;
      case "crew":
        navigate(`${basePath}/crew`);
        break;
      default:
        navigate(basePath);
        break;
    }
  };

  if (!projectId) {
    return (
      <div className="flex items-center justify-center min-h-[400px] text-sm text-slate-600 dark:text-slate-400">
        Select a project to view its catalogue.
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Secondary Sidebar */}
      <CataloguePeopleSidebar
        selectedGroup={filterGroup}
        onSelectGroup={handleSelectGroup}
        counts={counts}
      />

      {/* Main Content */}
	      <CataloguePeopleContent
	        people={people}
	        selectedGroup={filterGroup}
	        searchQuery={searchQuery}
	        onSearchChange={setSearchQuery}
	        loading={loading}
	        error={error}
	        addMenuItems={addMenuItems}
	        canEditCrew={canManageCrew}
	        canEditTalent={canManageTalentRecords}
	        onEditPerson={handleEditPerson}
	        onRemoveFromProject={handleRemoveFromProject}
	      />

      {openCrewAddModal && (
        <AddPersonModal
          open={openCrewAddModal}
          busy={crewAddBusy}
          onClose={() => setOpenCrewAddModal(false)}
          onAddPerson={addCrewToProject}
          onCreatePosition={async ({ departmentId, title }) => {
            const result = await createPosition.mutateAsync({ departmentId, title });
            return result;
          }}
          orgCrew={orgCrew}
          projectDepartments={projectDepartments}
          existingCrewIds={existingCrewIds}
        />
      )}

	      {canManageTalentRecords && (
	        <TalentCreateModal
	          open={openTalentAddModal}
	          busy={talentAddBusy}
	          onClose={() => setOpenTalentAddModal(false)}
          onCreate={createProjectTalent}
          existingTalent={allTalent}
          existingDisabledIds={projectTalentIds}
	          onSelectExisting={async (talent) => addExistingTalentToProject([talent.id])}
	        />
	      )}

	      {editTalentTarget && (
	        <TalentEditModal
	          open={Boolean(editTalentTarget)}
	          talent={editTalentTarget}
	          busy={talentEditBusy}
	          onClose={() => setEditTalentTarget(null)}
	          onSave={handleSaveTalent}
	        />
	      )}

	      {editCrewTarget && (
	        <CrewEditModal
	          open={Boolean(editCrewTarget)}
	          crewMember={editCrewTarget}
	          busy={crewEditBusy}
	          onClose={() => setEditCrewTarget(null)}
	          onSave={handleSaveCrew}
	        />
	      )}

	      {editCrewRolesTarget && (
	        <ProjectCrewRolesModal
	          open={Boolean(editCrewRolesTarget)}
	          crewMember={editCrewRolesTarget}
	          assignments={crewAssignmentsByCrewId.get(editCrewRolesTarget.id) || []}
	          departments={combinedDepartments}
	          busy={crewRolesBusy}
	          onClose={() => setEditCrewRolesTarget(null)}
	          onSaveRoles={handleSaveCrewRoles}
	          onEditDetails={() => {
	            setEditCrewTarget(editCrewRolesTarget);
	            setEditCrewRolesTarget(null);
	          }}
	          onRemoveFromProject={async (crewMember) => {
	            await handleRemoveFromProject([{ id: crewMember?.id, type: "crew" }]);
	            setEditCrewRolesTarget(null);
	          }}
	          onCreatePosition={handleCreateProjectPosition}
	        />
	      )}
	    </div>
	  );
	}
