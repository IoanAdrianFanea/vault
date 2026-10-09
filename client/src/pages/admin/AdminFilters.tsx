/*
Admin tab for the custom filter fields users can tag documents with: add,
rename, change the type and delete, up to the maximum number allowed.
*/


import { Fragment, useEffect, useState, type FormEvent } from 'react';
import {
  filtersService,
  MAX_ACTIVE_FILTERS,
  type FilterDefinition,
  type FilterType,
} from '../../api/filters';
import { AdminSection } from '../../components/admin/AdminSection';
import {
  Badge,
  Button,
  ConfirmDialog,
  DataTable,
  EmptyState,
  FormField,
  IconButton,
  InlineAlert,
  Input,
  Select,
  TableCell,
  TableHeaderCell,
  TableRow,
} from '../../components/ui';
import { formatDate } from '../../utils/format';

const FILTER_TYPE_LABELS: Record<FilterType, string> = {
  TEXT: 'Text',
  NUMBER: 'Number',
  DATE: 'Date',
};

export default function AdminFilters() {
  const [filters, setFilters] = useState<FilterDefinition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [pageAlert, setPageAlert] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState<FilterType>('TEXT');
  const [editError, setEditError] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<FilterType>('TEXT');
  const [createError, setCreateError] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<FilterDefinition | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const atCapacity = filters.length >= MAX_ACTIVE_FILTERS;

  useEffect(() => {
    filtersService
      .listFilters()
      .then(setFilters)
      .catch((err) =>
        setLoadError(err instanceof Error ? err.message : 'Failed to load filters'),
      )
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
      const updated = await filtersService.updateFilter(id, {
        name: trimmed,
        type: editType,
      });
      setFilters((prev) => prev.map((f) => (f.id === id ? updated : f)));
      setEditingId(null);
    } catch (err) {
      setEditError(
        err instanceof Error ? err.message : 'Failed to update filter',
      );
    } finally {
      setIsSavingEdit(false);
    }
  };

  const requestDelete = (filter: FilterDefinition) => {
    setDeleteTarget(filter);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const filter = deleteTarget;
    setDeletingId(filter.id);
    setPageAlert(null);

    try {
      await filtersService.deleteFilter(filter.id);
      setFilters((prev) => prev.filter((f) => f.id !== filter.id));
      setDeleteTarget(null);
    } catch (err) {
      setPageAlert(
        err instanceof Error ? err.message : "Couldn't delete the filter",
      );
      setDeleteTarget(null);
    } finally {
      setDeletingId(null);
    }
  };

  const handleCreate = async (e: FormEvent) => {
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
      setCreateError(
        err instanceof Error ? err.message : 'Failed to create filter',
      );
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <AdminSection>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-section text-ink">Custom filters</h2>
          <p className="mt-0.5 max-w-2xl text-body text-ink-muted">
            Manage the custom filter fields available on the upload form and
            document list. Once created, a filter is available to every user.
          </p>
        </div>
        <span className="text-small text-ink-muted tabular-nums shrink-0">
          {filters.length} / {MAX_ACTIVE_FILTERS} filters
        </span>
      </div>

      {pageAlert && (
        <InlineAlert tone="error" onDismiss={() => setPageAlert(null)}>
          {pageAlert}
        </InlineAlert>
      )}

      {atCapacity && (
        <InlineAlert tone="warning">
          Maximum of {MAX_ACTIVE_FILTERS} filters reached. Delete a filter to add
          a new one.
        </InlineAlert>
      )}

      {loadError && <InlineAlert tone="error">{loadError}</InlineAlert>}

      {isLoading && filters.length === 0 ? null : !loadError && filters.length === 0 ? (
        <EmptyState
          className="rounded border border-line"
          icon="tune"
          title="No custom filters yet"
          description="Add fields like Supplier or Order no. so users can tag and filter documents."
        />
      ) : (
        <DataTable label="Custom filters" fixed busy={isLoading}>
          <thead>
            <TableRow>
              <TableHeaderCell>Name</TableHeaderCell>
              <TableHeaderCell className="w-[140px]">Type</TableHeaderCell>
              <TableHeaderCell className="w-[120px]">Created</TableHeaderCell>
              <TableHeaderCell align="end" className="w-[180px]">
                Actions
              </TableHeaderCell>
            </TableRow>
          </thead>
          <tbody>
            {filters.map((filter) => {
                const isEditing = editingId === filter.id;

                if (isEditing) {
                  return (
                    <Fragment key={filter.id}>
                      <TableRow>
                        <TableCell>
                          <Input
                            size="sm"
                            aria-label="Filter name"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveEdit(filter.id);
                              if (e.key === 'Escape') {
                                e.stopPropagation();
                                cancelEdit();
                              }
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <Select
                            size="sm"
                            aria-label="Filter type"
                            value={editType}
                            onChange={(e) =>
                              setEditType(e.target.value as FilterType)
                            }
                          >
                            <option value="TEXT">Text</option>
                            <option value="NUMBER">Number</option>
                            <option value="DATE">Date</option>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <span className="whitespace-nowrap text-small text-ink-muted tabular-nums">
                            {formatDate(filter.createdAt)}
                          </span>
                        </TableCell>
                        <TableCell align="end">
                          <div className="inline-flex items-center gap-1">
                            <Button
                              variant="primary"
                              size="sm"
                              loading={isSavingEdit}
                              onClick={() => saveEdit(filter.id)}
                            >
                              Save
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={cancelEdit}
                            >
                              Cancel
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      {(editType !== filter.type || editError) && (
                        <TableRow>
                          <TableCell colSpan={4}>
                            <div className="space-y-2 py-1">
                              {editType !== filter.type && (
                                <InlineAlert tone="warning">
                                  Changing the type removes the values already
                                  entered for this filter on every document.
                                </InlineAlert>
                              )}
                              {editError && (
                                <InlineAlert tone="error">
                                  {editError}
                                </InlineAlert>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                }

                return (
                  <TableRow key={filter.id}>
                    <TableCell>
                      <span className="font-medium text-ink">{filter.name}</span>
                    </TableCell>
                    <TableCell>
                      <Badge tone="slate">{FILTER_TYPE_LABELS[filter.type]}</Badge>
                    </TableCell>
                    <TableCell>
                      <span className="whitespace-nowrap text-small text-ink-muted tabular-nums">
                        {formatDate(filter.createdAt)}
                      </span>
                    </TableCell>
                    <TableCell align="end">
                      <div className="inline-flex items-center gap-1">
                        <IconButton
                          size="sm"
                          icon="edit"
                          label={`Edit ${filter.name}`}
                          onClick={() => startEdit(filter)}
                        />
                        <IconButton
                          size="sm"
                          icon="delete"
                          label={`Delete ${filter.name}`}
                          disabled={deletingId === filter.id}
                          onClick={() => requestDelete(filter)}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
          </tbody>
        </DataTable>
      )}

      <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-2 pt-2">
        <fieldset disabled={atCapacity || isCreating} className="contents">
          <FormField
            label="Filter name"
            htmlFor="new-filter-name"
            error={createError}
            className="w-64"
          >
            <Input
              id="new-filter-name"
              size="sm"
              placeholder="e.g. Supplier"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
          </FormField>
          <FormField
            label="Type"
            htmlFor="new-filter-type"
            className="w-40"
          >
            <Select
              id="new-filter-type"
              size="sm"
              value={newType}
              onChange={(e) => setNewType(e.target.value as FilterType)}
            >
              <option value="TEXT">Text</option>
              <option value="NUMBER">Number</option>
              <option value="DATE">Date</option>
            </Select>
          </FormField>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            icon="add"
            loading={isCreating}
          >
            Add filter
          </Button>
        </fieldset>
      </form>

      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title="Delete filter?"
        message={`Delete the "${deleteTarget?.name ?? ''}" filter? It will be removed from the upload form, the document filters and every document that has a value for it.`}
        confirmLabel="Delete"
        isConfirming={deletingId !== null}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </AdminSection>
  );
}
