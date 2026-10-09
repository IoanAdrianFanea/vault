/*
Manages the admin-defined custom filter fields: list, create (up to
MAX_ACTIVE_FILTERS), rename, change type and delete. Changing a filter's type
discards the values already entered for it.
*/


import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFilterDefinitionDto } from './dto/create-filter-definition.dto';
import { UpdateFilterDefinitionDto } from './dto/update-filter-definition.dto';
import { MAX_ACTIVE_FILTERS } from './filters.constants';

// Custom filter fields (Phase 3) — admin-configurable, available to every user for
// filtering the document list and entering values on upload.
@Injectable()
export class FiltersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * List every filter definition, in display order.
   * Readable by any authenticated user — filters are shown on upload forms and the
   * document list for everyone, not just admins.
   */
  async list() {
    const definitions = await this.prisma.filterDefinition.findMany({
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    });

    return definitions.map((definition) => ({
      id: definition.id,
      name: definition.name,
      type: definition.type,
      order: definition.order,
      createdAt: definition.createdAt,
      updatedAt: definition.updatedAt,
    }));
  }

  /**
   * Create a new filter definition. ADMIN ONLY (enforced by the controller).
   * Capped at MAX_ACTIVE_FILTERS — the admin must delete one before adding another.
   */
  async create(dto: CreateFilterDefinitionDto, userId: string) {
    const count = await this.prisma.filterDefinition.count();
    if (count >= MAX_ACTIVE_FILTERS) {
      throw new BadRequestException(
        `You have reached the limit of ${MAX_ACTIVE_FILTERS} active custom filters. Delete an existing filter before creating a new one.`,
      );
    }

    const trimmedName = dto.name.trim();

    const existing = await this.prisma.filterDefinition.findUnique({
      where: { name: trimmedName },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException('A filter with this name already exists');
    }

    const maxOrder = await this.prisma.filterDefinition.aggregate({
      _max: { order: true },
    });

    const definition = await this.prisma.filterDefinition.create({
      data: {
        name: trimmedName,
        type: dto.type,
        order: (maxOrder._max.order ?? -1) + 1,
        createdById: userId,
      },
    });

    return {
      id: definition.id,
      name: definition.name,
      type: definition.type,
      order: definition.order,
      createdAt: definition.createdAt,
      updatedAt: definition.updatedAt,
    };
  }

  /**
   * Update a filter's name and/or type. ADMIN ONLY.
   * Changing the type invalidates previously entered values for this filter — they
   * were stored in a type-specific column and can no longer be interpreted safely, so
   * they are discarded along with the change.
   */
  async update(id: string, dto: UpdateFilterDefinitionDto) {
    const definition = await this.prisma.filterDefinition.findUnique({
      where: { id },
    });
    if (!definition) {
      throw new NotFoundException('Filter not found');
    }

    if (dto.name) {
      const trimmedName = dto.name.trim();
      const existing = await this.prisma.filterDefinition.findUnique({
        where: { name: trimmedName },
        select: { id: true },
      });
      if (existing && existing.id !== id) {
        throw new ConflictException('A filter with this name already exists');
      }
    }

    const typeChanged = dto.type !== undefined && dto.type !== definition.type;

    const updated = await this.prisma.$transaction(async (tx) => {
      if (typeChanged) {
        await tx.documentFilterValue.deleteMany({
          where: { filterDefinitionId: id },
        });
      }

      return tx.filterDefinition.update({
        where: { id },
        data: {
          ...(dto.name && { name: dto.name.trim() }),
          ...(dto.type && { type: dto.type }),
        },
      });
    });

    return {
      id: updated.id,
      name: updated.name,
      type: updated.type,
      order: updated.order,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }

  /**
   * Delete a filter definition. ADMIN ONLY.
   * Cascades to every DocumentFilterValue referencing it (schema-level onDelete: Cascade).
   */
  async remove(id: string): Promise<void> {
    const definition = await this.prisma.filterDefinition.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!definition) {
      throw new NotFoundException('Filter not found');
    }

    await this.prisma.filterDefinition.delete({ where: { id } });
  }
}
