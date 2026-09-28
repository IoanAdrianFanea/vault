import { useEffect, useState } from 'react';
import { AdminTabs } from '../../components/admin/AdminTabs';
import {
  filtersService,
  MAX_ACTIVE_FILTERS,
  type FilterDefinition,
  type FilterType,
} from '../../api/filters';

const FILTER_TYPE_LABELS: Record<FilterType, string> = {
  TEXT: 'Text',
  NUMBER: 'Number',
  DATE: 'Date Range',
};

const FILTER_TYPE_OPTIONS: FilterType[] = ['TEXT', 'NUMBER', 'DATE'];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function AdminFilters() {
  const [filters, setFilters] = useState<FilterDefinition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState<FilterType>('TEXT');
  const [editError, setEditError] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<FilterType>('TEXT');
  const [createError, setCreateError] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const atCapacity = filters.length >= MAX_ACTIVE_FILTERS;

  useEffect(() => {
    filtersService
      .listFilters()
      .then(setFilters)
      .catch((err) => setLoadError(err instanceof Error ? err.message : 'Failed to load filters'))
      .finally(() => setIsLoading(false));
  }, []);

  const startEdit = (filter: FilterDefinition) => {
    setEditingId(filter.id);
    setEditName(filter.name);
    setEditType(filter.type);
    setEditError('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditError('');
  };

  const saveEdit = async (id: string) => {
    const trimmed = editName.trim();
    if (!trimmed) {
      setEditError('Filter name cannot be empty.');
      return;
    }
    setIsSavingEdit(true);
    setEditError('');
    try {
      const updated = await filtersService.updateFilter(id, { name: trimmed, type: editType });
      setFilters((prev) => prev.map((f) => (f.id === id ? updated : f)));
      setEditingId(null);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Failed to update filter');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDelete = async (filter: FilterDefinition) => {
    if (!confirm(`Delete the "${filter.name}" filter? Existing documents will lose this value.`)) {
      return;
    }
    setDeletingId(filter.id);
    try {
      await filtersService.deleteFilter(filter.id);
      setFilters((prev) => prev.filter((f) => f.id !== filter.id));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete filter');
    } finally {
      setDeletingId(null);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed) {
      setCreateError('Filter name cannot be empty.');
      return;
    }
    setIsCreating(true);
    setCreateError('');
    try {
      const created = await filtersService.createFilter(trimmed, newType);
      setFilters((prev) => [...prev, created]);
      setNewName('');
      setNewType('TEXT');
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create filter');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <main className="flex-1 flex flex-col min-w-0 bg-white dark:bg-slate-900 overflow-hidden">
      <div className="bg-surface pt-6 px-10 shrink-0 sticky top-0 z-10">
        <AdminTabs />
      </div>

      <div className="flex-1 overflow-y-auto p-12">
        <div className="max-w-4xl">
          <div className="mb-8">
            <h1 className="text-headline-sm font-headline font-bold text-on-surface mb-2">Filter Settings</h1>
            <p className="text-body-md font-body text-on-surface-variant">
              Manage the custom filter fields available on the upload form and document list. Once created, a filter
              is available to every user.
            </p>
          </div>

          {atCapacity && (
            <div className="bg-error-container/20 border-l-4 border-error text-on-error-container p-4 rounded-r-xl mb-8 flex items-start gap-3">
              <span className="material-symbols-outlined text-error mt-0.5">warning</span>
              <div>
                <h3 className="font-label font-bold text-sm mb-1">Maximum Capacity Reached</h3>
                <p className="text-body-md font-body opacity-90">
                  You have reached the limit of {MAX_ACTIVE_FILTERS} active custom filters. Delete an existing filter
                  before creating a new one.
                </p>
              </div>
            </div>
          )}

          {loadError && (
            <div className="bg-error-container/20 border-l-4 border-error text-on-error-container p-4 rounded-r-xl mb-8">
              <p className="text-body-md font-body">{loadError}</p>
            </div>
          )}

          <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant/10 overflow-hidden mb-8">
            <div className="px-6 py-4 border-b border-surface-container-low bg-surface-bright flex justify-between items-center">
              <h2 className="font-headline font-semibold text-on-surface">
                Active Custom Filters ({filters.length}/{MAX_ACTIVE_FILTERS})
              </h2>
            </div>
            <div className="divide-y divide-surface-container-low">
              {isLoading ? (
                <div className="p-6 text-center text-on-surface-variant text-body-md">Loading filters...</div>
              ) : filters.length === 0 ? (
                <div className="p-6 text-center text-on-surface-variant text-body-md">
                  No custom filters yet. Add one below.
                </div>
              ) : (
                filters.map((filter) =>
                  editingId === filter.id ? (
                    <div key={filter.id} className="p-4 bg-surface-container-low/60">
                      <div className="grid grid-cols-2 gap-4 mb-3">
                        <div>
                          <label className="block text-xs font-label text-on-surface-variant mb-1">Filter Name</label>
                          <input
                            className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-lg px-3 py-2 text-body-md font-body text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            maxLength={60}
                            autoFocus
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-label text-on-surface-variant mb-1">Filter Type</label>
                          <select
                            className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-lg px-3 py-2 text-body-md font-body text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40"
                            value={editType}
                            onChange={(e) => setEditType(e.target.value as FilterType)}
                          >
                            {FILTER_TYPE_OPTIONS.map((type) => (
                              <option key={type} value={type}>
                                {FILTER_TYPE_LABELS[type]}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      {editError && <p className="text-error text-label-sm mb-3">{editError}</p>}
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => saveEdit(filter.id)}
                          disabled={isSavingEdit}
                          className="px-4 py-2 rounded-lg text-label-md font-semibold bg-primary text-on-primary hover:opacity-90 transition-opacity disabled:opacity-50"
                        >
                          {isSavingEdit ? 'Saving...' : 'Save'}
                        </button>
                        <button
                          type="button"
                          onClick={cancelEdit}
                          disabled={isSavingEdit}
                          className="px-4 py-2 rounded-lg text-label-md font-semibold text-on-surface-variant hover:bg-surface-container-high transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      key={filter.id}
                      className="p-4 hover:bg-surface-container-low transition-colors flex items-center justify-between group"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-lg bg-surface-container flex items-center justify-center text-primary">
                          <span className="material-symbols-outlined">filter_alt</span>
                        </div>
                        <div>
                          <h4 className="font-label font-semibold text-on-surface">{filter.name}</h4>
                          <div className="flex items-center gap-2 text-xs font-body text-on-surface-variant mt-1">
                            <span className="bg-surface-container-high px-2 py-0.5 rounded">
                              {FILTER_TYPE_LABELS[filter.type]}
                            </span>
                            <span>•</span>
                            <span>Created {formatDate(filter.createdAt)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                        <button
                          onClick={() => startEdit(filter)}
                          className="text-outline hover:text-primary transition-colors p-2 rounded-lg hover:bg-primary-container/20"
                          title="Rename or change type"
                        >
                          <span className="material-symbols-outlined">edit</span>
                        </button>
                        <button
                          onClick={() => handleDelete(filter)}
                          disabled={deletingId === filter.id}
                          className="text-outline hover:text-error transition-colors p-2 rounded-lg hover:bg-error-container/10 disabled:opacity-50"
                          title="Delete filter"
                        >
                          <span className="material-symbols-outlined">delete</span>
                        </button>
                      </div>
                    </div>
                  ),
                )
              )}
            </div>
          </div>

          <div className={`bg-surface-container rounded-xl p-6 border border-outline-variant/10 ${atCapacity ? 'opacity-60' : ''}`}>
            <div className="flex items-center gap-2 mb-4">
              <span className="material-symbols-outlined text-outline">add_circle</span>
              <h3 className="font-headline font-semibold text-on-surface">Add New Filter</h3>
            </div>
            <form className="space-y-4" onSubmit={handleCreate}>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-label text-on-surface-variant mb-1">Filter Name</label>
                  <input
                    className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-3 py-2 text-body-md font-body text-on-surface disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-primary/40"
                    disabled={atCapacity || isCreating}
                    placeholder="e.g. Supplier"
                    type="text"
                    maxLength={60}
                    value={newName}
                    onChange={(e) => {
                      setNewName(e.target.value);
                      setCreateError('');
                    }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-label text-on-surface-variant mb-1">Filter Type</label>
                  <select
                    className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-3 py-2 text-body-md font-body text-on-surface disabled:opacity-50 disabled:cursor-not-allowed appearance-none focus:outline-none focus:ring-2 focus:ring-primary/40"
                    disabled={atCapacity || isCreating}
                    value={newType}
                    onChange={(e) => setNewType(e.target.value as FilterType)}
                  >
                    {FILTER_TYPE_OPTIONS.map((type) => (
                      <option key={type} value={type}>
                        {FILTER_TYPE_LABELS[type]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {createError && <p className="text-error text-label-sm">{createError}</p>}
              <div className="pt-2">
                <button
                  className="bg-primary text-on-primary font-label text-label-md px-4 py-2 rounded-lg hover:opacity-90 transition-opacity disabled:bg-outline-variant/20 disabled:text-on-surface-variant disabled:cursor-not-allowed"
                  disabled={atCapacity || isCreating || !newName.trim()}
                  type="submit"
                >
                  {isCreating ? 'Creating...' : 'Create Filter'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}
