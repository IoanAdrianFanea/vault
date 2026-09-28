import { BadRequestException } from '@nestjs/common';
import { FilterType, type FilterDefinition, type Prisma } from '@prisma/client';

/** Raw value(s) a client may submit for one custom filter, before type validation. */
export interface RawFilterFilterValue {
  value?: string;
  from?: string;
  to?: string;
}

/**
 * Parse the JSON blob the client sends for upload-time filter values.
 * Shape: `{ [filterDefinitionId]: "raw string value" }`.
 * Returns an empty object (rather than throwing) for missing/blank input so callers
 * can treat "no filter values submitted" the same as "empty object".
 */
export function parseUploadFilterValues(
  raw: string | undefined,
): Record<string, string> {
  if (!raw || raw.trim() === '') return {};

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new BadRequestException('filterValues must be valid JSON');
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new BadRequestException(
      'filterValues must be a JSON object of filterDefinitionId to value',
    );
  }

  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(
    parsed as Record<string, unknown>,
  )) {
    if (typeof value === 'string' && value.trim() !== '') {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Parse the JSON blob the client sends for list/search-time filter queries.
 * Shape: `{ [filterDefinitionId]: { value?: string; from?: string; to?: string } }`.
 */
export function parseQueryCustomFilters(
  raw: string | undefined,
): Record<string, RawFilterFilterValue> {
  if (!raw || raw.trim() === '') return {};

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new BadRequestException('customFilters must be valid JSON');
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new BadRequestException(
      'customFilters must be a JSON object of filterDefinitionId to value',
    );
  }

  const result: Record<string, RawFilterFilterValue> = {};
  for (const [key, entry] of Object.entries(
    parsed as Record<string, unknown>,
  )) {
    if (typeof entry !== 'object' || entry === null) continue;
    const { value, from, to } = entry as Record<string, unknown>;
    const parsedEntry: RawFilterFilterValue = {};
    if (typeof value === 'string' && value.trim() !== '')
      parsedEntry.value = value;
    if (typeof from === 'string' && from.trim() !== '') parsedEntry.from = from;
    if (typeof to === 'string' && to.trim() !== '') parsedEntry.to = to;
    if (Object.keys(parsedEntry).length > 0) {
      result[key] = parsedEntry;
    }
  }
  return result;
}

/** A validated filter value, typed per its filter's declared type, not yet tied to a document. */
export type TypedFilterValue = {
  filterDefinitionId: string;
  valueText?: string;
  valueNumber?: number;
  valueDate?: Date;
};

/**
 * Validate and type-convert raw upload filter values against their filter definitions.
 * Throws BadRequestException on the first value that doesn't match its filter's type.
 * Safe to call before a document exists — the result is attached to a documentId later.
 */
export function validateFilterValues(
  filterDefinitions: FilterDefinition[],
  rawValues: Record<string, string>,
): TypedFilterValue[] {
  const definitionsById = new Map(
    filterDefinitions.map((def) => [def.id, def]),
  );
  const values: TypedFilterValue[] = [];

  for (const [filterDefinitionId, rawValue] of Object.entries(rawValues)) {
    const definition = definitionsById.get(filterDefinitionId);
    if (!definition) {
      // Unknown/stale filter id (e.g. deleted between page load and submit) — ignore.
      continue;
    }

    const value: TypedFilterValue = { filterDefinitionId };

    switch (definition.type) {
      case FilterType.TEXT:
        value.valueText = rawValue.trim();
        break;
      case FilterType.NUMBER: {
        const parsed = Number(rawValue);
        if (Number.isNaN(parsed)) {
          throw new BadRequestException(
            `"${definition.name}" must be a number`,
          );
        }
        value.valueNumber = parsed;
        break;
      }
      case FilterType.DATE: {
        const parsed = new Date(rawValue);
        if (Number.isNaN(parsed.getTime())) {
          throw new BadRequestException(
            `"${definition.name}" must be a valid date`,
          );
        }
        value.valueDate = parsed;
        break;
      }
    }

    values.push(value);
  }

  return values;
}

/** Attach a documentId to already-validated typed filter values, ready for createMany. */
export function toDocumentFilterValueCreateData(
  documentId: string,
  typedValues: TypedFilterValue[],
): Prisma.DocumentFilterValueUncheckedCreateInput[] {
  return typedValues.map((value) => ({ ...value, documentId }));
}

/**
 * Build the AND-list of Prisma where-clauses for the document list/search query,
 * one per submitted custom filter, using each filter's declared type to decide how to
 * interpret the raw value(s).
 */
export function buildCustomFilterWhereClauses(
  filterDefinitions: FilterDefinition[],
  customFilters: Record<string, RawFilterFilterValue>,
): Prisma.DocumentWhereInput[] {
  const definitionsById = new Map(
    filterDefinitions.map((def) => [def.id, def]),
  );
  const clauses: Prisma.DocumentWhereInput[] = [];

  for (const [filterDefinitionId, raw] of Object.entries(customFilters)) {
    const definition = definitionsById.get(filterDefinitionId);
    if (!definition) continue;

    switch (definition.type) {
      case FilterType.TEXT: {
        if (!raw.value) break;
        clauses.push({
          filterValues: {
            some: {
              filterDefinitionId,
              valueText: { contains: raw.value },
            },
          },
        });
        break;
      }
      case FilterType.NUMBER: {
        if (!raw.value) break;
        const parsed = Number(raw.value);
        if (Number.isNaN(parsed)) break;
        clauses.push({
          filterValues: {
            some: {
              filterDefinitionId,
              valueNumber: parsed,
            },
          },
        });
        break;
      }
      case FilterType.DATE: {
        const range: Prisma.DateTimeFilter = {};
        if (raw.from) {
          const from = new Date(raw.from);
          if (!Number.isNaN(from.getTime())) range.gte = from;
        }
        if (raw.to) {
          const to = new Date(raw.to);
          if (!Number.isNaN(to.getTime())) {
            to.setHours(23, 59, 59, 999);
            range.lte = to;
          }
        }
        if (Object.keys(range).length > 0) {
          clauses.push({
            filterValues: {
              some: {
                filterDefinitionId,
                valueDate: range,
              },
            },
          });
        }
        break;
      }
    }
  }

  return clauses;
}
