import { useEffect, useState } from 'react';
import { AdminTabs } from '../../components/admin/AdminTabs';
import { getProjects, type AdminProject } from '../../api/projects';
import { RenameProjectModal } from '../../components/admin/RenameProjectModal';
import { DeleteProjectModal } from '../../components/admin/DeleteProjectModal';
import { ArchiveProjectModal } from '../../components/admin/ArchiveProjectModal';
import { ManageMembersModal } from '../../components/admin/ManageMembersModal';
import { CreateProjectModal } from '../../components/admin/CreateProjectModal';

export default function AdminProjects() {
  const [projects, setProjects] = useState<AdminProject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [renamingProject, setRenamingProject] = useState<AdminProject | null>(null);
  const [deletingProject, setDeletingProject] = useState<AdminProject | null>(null);
  const [archivingProject, setArchivingProject] = useState<AdminProject | null>(null);
  const [managingProject, setManagingProject] = useState<AdminProject | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    getProjects()
      .then(setProjects)
      .finally(() => setIsLoading(false));
  }, []);

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const handleRenamed = (id: string, newName: string) => {
    setProjects((prev) => prev.map((p) => p.id === id ? { ...p, name: newName } : p));
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

  return (
    <main className="flex-1 flex flex-col min-w-0 bg-white dark:bg-slate-900 overflow-hidden">
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
        memberCount={deletingProject?._count.memberships ?? 0}
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
      <div className="bg-surface pt-6 px-10 shrink-0 sticky top-0 z-10">
        <AdminTabs />
      </div>

      <div className="flex-1 overflow-y-auto p-10 max-w-7xl mx-auto w-full">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-headline-sm font-headline font-bold text-on-surface">Projects</h1>
          <button onClick={() => setShowCreateModal(true)} className="bg-primary text-on-primary px-4 py-2 rounded-lg flex items-center gap-2 text-label-md font-semibold hover:opacity-90 transition-opacity">
            <span className="material-symbols-outlined text-sm">add</span>
            New Project
          </button>
        </div>

        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/10 overflow-hidden shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-outline-variant/10 bg-surface-container-low/50 text-label-md font-label uppercase tracking-wider text-outline">
                <th className="px-6 py-4 font-medium w-1/3">Project Name</th>
                <th className="px-6 py-4 font-medium w-1/6">Members</th>
                <th className="px-6 py-4 font-medium w-1/4">Created Date</th>
                <th className="px-6 py-4 font-medium w-1/4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="text-body-md text-on-surface divide-y divide-outline-variant/5">
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-5 text-center text-on-surface-variant">Loading...</td>
                </tr>
              ) : projects.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-5 text-center text-on-surface-variant">No projects yet</td>
                </tr>
              ) : projects.map((project) => (
              <tr key={project.id} className="hover:bg-surface-container-low/30 transition-colors group">
                <td className="px-6 py-5">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-primary-container text-primary flex items-center justify-center">
                      <span className="material-symbols-outlined text-sm">view_kanban</span>
                    </div>
                    <span className="font-semibold text-on-surface group-hover:text-primary transition-colors">
                      {project.name}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-5">
                  <span className="text-on-surface-variant">{project._count.memberships}</span>
                </td>
                <td className="px-6 py-5 text-on-surface-variant">{formatDate(project.createdAt)}</td>
                <td className="px-6 py-5 text-right">
                  <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => setManagingProject(project)} className="p-1.5 text-on-surface-variant hover:text-primary hover:bg-primary-container/50 rounded transition-colors" title="Manage Members">
                      <span className="material-symbols-outlined text-[18px]">group_add</span>
                    </button>
                    <button onClick={() => setRenamingProject(project)} className="p-1.5 text-on-surface-variant hover:text-primary hover:bg-primary-container/50 rounded transition-colors" title="Rename">
                      <span className="material-symbols-outlined text-[18px]">edit</span>
                    </button>
                    <button onClick={() => setArchivingProject(project)} className="p-1.5 text-on-surface-variant hover:text-primary hover:bg-primary-container/50 rounded transition-colors" title="Archive">
                      <span className="material-symbols-outlined text-[18px]">inventory_2</span>
                    </button>
                    <button onClick={() => setDeletingProject(project)} className="p-1.5 text-outline hover:text-error hover:bg-error-container/20 rounded transition-colors" title="Delete">
                      <span className="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                  </div>
                </td>
              </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
