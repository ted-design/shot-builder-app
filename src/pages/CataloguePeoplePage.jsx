import React, { useState, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useProjectScope } from "../context/ProjectScopeContext";
import { useAuth } from "../context/AuthContext";
import { useProjectCataloguePeople } from "../hooks/useProjectCataloguePeople";
import { useTalent } from "../hooks/useFirestoreQuery";
import { useOrganizationCrew } from "../hooks/useOrganizationCrew";
import { useProjectCrew } from "../hooks/useProjectCrew";
import { useProjectDepartments } from "../hooks/useProjectDepartments";
import CataloguePeopleSidebar from "../components/catalogue/CataloguePeopleSidebar";
import CataloguePeopleContent from "../components/catalogue/CataloguePeopleContent";
import AddPersonModal from "../components/crew/AddPersonModal";
import TalentCreateModal from "../components/talent/TalentCreateModal";
import { addDoc, collection, serverTimestamp, updateDoc, doc, arrayUnion } from "../lib/demoSafeFirestore";
import { db, uploadImageFile } from "../lib/firebase";
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
  const { currentProjectId } = useProjectScope();
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
  });

  const canManageCrew = canManageProjects(globalRole);
  const canManageTalentRecords = canManageTalent(globalRole);

  const [openCrewAddModal, setOpenCrewAddModal] = useState(false);
  const [crewAddBusy, setCrewAddBusy] = useState(false);

  const [openTalentAddModal, setOpenTalentAddModal] = useState(false);
  const [talentAddBusy, setTalentAddBusy] = useState(false);

  const { crew: orgCrew = [], createCrewMember } = useOrganizationCrew(clientId);
  const {
    assignments: crewAssignments = [],
    createAssignment,
  } = useProjectCrew(clientId, currentProjectId);
  const { departments: projectDepartments, createPosition } = useProjectDepartments(clientId, currentProjectId);

  const existingCrewIds = useMemo(() => new Set(crewAssignments.map((a) => a.crewMemberId).filter(Boolean)), [crewAssignments]);

  const { data: projectTalent = [] } = useTalent(clientId, {
    scope: "project",
    projectId: currentProjectId,
    enabled: Boolean(clientId && currentProjectId),
  });
  const { data: allTalent = [] } = useTalent(clientId, { scope: "all", enabled: Boolean(clientId) });

  const projectTalentIds = useMemo(() => new Set(projectTalent.map((t) => t.id)), [projectTalent]);

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
    if (!clientId || !currentProjectId) throw new Error("Missing project");
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
    if (!clientId || !currentProjectId) throw new Error("Missing project");
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
          projectIds: [currentProjectId],
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
    if (!clientId || !currentProjectId) throw new Error("Missing project");
    setTalentAddBusy(true);
    try {
      await Promise.all(
        ids.map((id) => updateDoc(doc(db, ...talentPath(clientId), id), { projectIds: arrayUnion(currentProjectId) }))
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

  // Handle group selection from sidebar
  const handleSelectGroup = (group) => {
    const basePath = `/projects/${currentProjectId}/catalogue/people`;
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

  if (!currentProjectId) {
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
    </div>
  );
}
