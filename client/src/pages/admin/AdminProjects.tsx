import { useCallback, useEffect, useState } from 'react';
import { getProjects, type AdminProject } from '../../api/projects';
import { RenameProjectModal } from '../../components/admin/RenameProjectModal';
import { DeleteProjectModal } from '../../components/admin/DeleteProjectModal';
import { ArchiveProjectModal } from '../../components/admin/ArchiveProjectModal';
import { ManageMembersModal } from '../../components/admin/ManageMembersModal';
import { CreateProjectModal } from '../../components/admin/CreateProjectModal';
import { AdminSection } from '../../components/admin/AdminSection';
import {
  Button,
  DataTable,
  EmptyState,
  IconButton,
  InlineAlert,
  Input,
  TableCell,
  TableHeaderCell,
  TableRow,
} from '../../components/ui';
import { formatCount, formatDate } from '../../utils/format';

export default function AdminProjects() {
  const [projects, setProjects] = useState<AdminProject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const [renamingProject, setRenamingProject] = useState<AdminProject | null>(null);
  const [deletingProject, setDeletingProject] = useState<AdminProject | null>(null);
  const [archivingProject, setArchivingProject] = useState<AdminProject | null>(null);
  const [managingProject, setManagingProject] = useState<AdminProject | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const fetchProjects = useCallback(() => {
    getProjects()
      .then((data) => {
        setProjects(data);
        setLoadError(null);
      })
      .catch((err) => {
        setLoadError(
          err instanceof Error ? err.message : 'Failed to load projects',
        );
      })
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const handleRetryLoad = () => {
    setIsLoading(true);
    fetchProjects();
  };

  const handleRenamed = (id: string, newName: string) => {
    setProjects((prev) =>
      prev.map((p) => (p.id === id ? { ...p, name: newName } : p)),
    );
  };

  const handleDeleted = (id: string) => {
    setProjects((prev) => prev.filter((p) => p.id !== id));
  };

  const handleArchived = (id: string) => {
    setProjects((prev) => prev.filter((p) => p.id !== id));
  };

  const handleMembersUpdated = (id: string, addedCount: number) => {
    setProjects((prev) =>
      prev.map((p) =>
        p.id === id
          ? { ...p, _count: { memberships: p._count.memberships + addedCount } }
          : p,
      ),
    );
  };

  const handleCreated = (project: AdminProject) => {
    setProjects((prev) => [...prev, project]);
  };

  const visibleProjects = projects.filter((p) =>
    p.name.toLowerCase().includes(search.trim().toLowerCase()),
  );

  return (
    <AdminSection
      toolbarStart={
        <Input
          size="sm"
          leadingIcon="search"
          placeholder="Search projects"
          aria-label="Search projects"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-64"
        />
      }
      toolbarEnd={
        <Button
          variant="primary"
          size="sm"
          icon="add"
          onClick={() => setShowCreateModal(true)}
        >
          New project
        </Button>
      }
    >
      <RenameProjectModal
        isOpen={renamingProject !== null}
        projectId={renamingProject?.id ?? ''}
        currentName={renamingProject?.name ?? ''}
        onClose={() => setRenamingProject(null)}
        onRenamed={handleRenamed}
      />
      <DeleteProjectModal
        isOpen={deletingProject !== null}
        projectId={deletingProject?.id ?? ''}
        projectName={deletingProject?.name ?? ''}
        onClose={() => setDeletingProject(null)}
        onDeleted={handleDeleted}
      />
      <CreateProjectModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={handleCreated}
      />
      <ManageMembersModal
        isOpen={managingProject !== null}
        projectId={managingProject?.id ?? ''}
        projectName={managingProject?.name ?? ''}
        onClose={() => setManagingProject(null)}
        onMembersUpdated={handleMembersUpdated}
      />
      <ArchiveProjectModal
        isOpen={archivingProject !== null}
        projectId={archivingProject?.id ?? ''}
        projectName={archivingProject?.name ?? ''}
        onClose={() => setArchivingProject(null)}
        onArchived={handleArchived}
      />

      {loadError && (
        <div className="flex flex-col items-start gap-2">
          <InlineAlert tone="error">
            <p className="font-medium">Couldn't load projects.</p>
            <p>{loadError}</p>
          </InlineAlert>
          <Button
            variant="secondary"
            size="sm"
            icon="refresh"
            onClick={handleRetryLoad}
          >
            Try again
          </Button>
        </div>
      )}

      {isLoading && projects.length === 0 ? null : !loadError && projects.length === 0 ? (
        <EmptyState
          className="rounded border border-line"
          icon="folder"
          title="No projects yet"
          description="Create a project, then add members so they can upload documents."
          action={
            <Button
              variant="primary"
              size="sm"
              icon="add"
              onClick={() => setShowCreateModal(true)}
            >
              New project
            </Button>
          }
        />
      ) : !loadError && visibleProjects.length === 0 ? (
        <EmptyState
          className="rounded border border-line"
          icon="search_off"
          title={`No projects match "${search.trim()}"`}
          action={
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setSearch('')}
            >
              Clear search
            </Button>
          }
        />
      ) : (
        <DataTable label="Projects" fixed busy={isLoading && projects.length > 0}>
          <thead>
            <TableRow>
              <TableHeaderCell>Project name</TableHeaderCell>
              <TableHeaderCell align="end" className="w-[100px]">
                Members
              </TableHeaderCell>
              <TableHeaderCell className="w-[130px]">Created</TableHeaderCell>
              <TableHeaderCell align="end" className="w-[152px]">
                Actions
              </TableHeaderCell>
            </TableRow>
          </thead>
          <tbody>
            {visibleProjects.map((project) => (
                <TableRow key={project.id}>
                  <TableCell>
                    <span
                      className="block truncate font-medium text-ink"
                      title={project.name}
                    >
                      {project.name}
                    </span>
                  </TableCell>
                  <TableCell align="end">
                    <span className="text-small text-ink-muted tabular-nums">
                      {formatCount(project._count.memberships)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="whitespace-nowrap text-small text-ink-muted tabular-nums">
                      {formatDate(project.createdAt)}
                    </span>
                  </TableCell>
                  <TableCell align="end">
                    <div className="inline-flex items-center gap-0.5">
                      <IconButton
                        size="sm"
                        icon="group"
                        label={`Manage members of ${project.name}`}
                        onClick={() => setManagingProject(project)}
                      />
                      <IconButton
                        size="sm"
                        icon="edit"
                        label={`Rename ${project.name}`}
                        onClick={() => setRenamingProject(project)}
                      />
                      <IconButton
                        size="sm"
                        icon="inventory_2"
                        label={`Archive ${project.name}`}
                        onClick={() => setArchivingProject(project)}
                      />
                      <IconButton
                        size="sm"
                        icon="delete"
                        label={`Delete ${project.name}`}
                        onClick={() => setDeletingProject(project)}
                      />
                    </div>
                  </TableCell>
                </TableRow>
            ))}
          </tbody>
        </DataTable>
      )}
    </AdminSection>
  );
}

