import prisma from '../lib/prisma.js';
import { PoolItem } from '@prisma/client';

export interface CreatePoolItemInput {
  type: 'task' | 'event' | 'aspiration';
  title: string;
  notes?: string;
  categoryId?: string;
  scheduledAt?: Date; // Events only
  scheduledEnd?: Date; // Events only
  cooldownDays?: number; // Optional override
}

export interface UpdatePoolItemInput {
  title?: string;
  notes?: string;
  categoryId?: string;
  scheduledAt?: Date;
  scheduledEnd?: Date;
  status?: 'active' | 'paused' | 'completed';
  cooldownDays?: number;
}

// Global cooldown defaults (MVP)
const GLOBAL_COOLDOWN_DAYS = {
  task: 1,
  aspiration: 3,
  event: 0, // Events ignore cooldown
};

export class PoolService {
  async create(data: CreatePoolItemInput): Promise<PoolItem> {
    // Enforce: only events can have scheduledAt/scheduledEnd
    if (data.type !== 'event' && (data.scheduledAt || data.scheduledEnd)) {
      throw new Error('Only events can have scheduled_at or scheduled_end');
    }

    return prisma.poolItem.create({
      data: {
        type: data.type,
        title: data.title,
        notes: data.notes,
        categoryId: data.categoryId || null,
        scheduledAt: data.type === 'event' ? data.scheduledAt || null : null,
        scheduledEnd: data.type === 'event' ? data.scheduledEnd || null : null,
        status: 'active',
        cooldownDays: data.cooldownDays || null,
      },
      include: {
        category: true,
      },
    });
  }

  async findAll(filters?: {
    type?: 'task' | 'event' | 'aspiration';
    status?: 'active' | 'paused' | 'completed';
    categoryId?: string;
  }): Promise<PoolItem[]> {
    return prisma.poolItem.findMany({
      where: {
        ...(filters?.type ? { type: filters.type } : {}),
        ...(filters?.status ? { status: filters.status } : {}),
        ...(filters?.categoryId ? { categoryId: filters.categoryId } : {}),
      },
      include: {
        category: true,
      },
      orderBy: [
        { type: 'asc' },
        { createdAt: 'desc' },
      ],
    });
  }

  async findById(id: string): Promise<PoolItem | null> {
    return prisma.poolItem.findUnique({
      where: { id },
      include: {
        category: true,
      },
    });
  }

  async update(id: string, data: UpdatePoolItemInput): Promise<PoolItem> {
    const item = await prisma.poolItem.findUnique({ where: { id } });
    if (!item) throw new Error('Pool item not found');

    // Enforce: only events can have scheduledAt/scheduledEnd
    if (item.type !== 'event' && (data.scheduledAt || data.scheduledEnd)) {
      throw new Error('Only events can have scheduled_at or scheduled_end');
    }

    const updateData: any = { ...data };
    if (item.type !== 'event') {
      updateData.scheduledAt = null;
      updateData.scheduledEnd = null;
    }

    return prisma.poolItem.update({
      where: { id },
      data: updateData,
      include: {
        category: true,
      },
    });
  }

  async delete(id: string): Promise<void> {
    await prisma.poolItem.delete({
      where: { id },
    });
  }

  /**
   * Get active Pool items available for planning on a given date.
   * Respects cooldown (global defaults or item override).
   * Events are included if their scheduledAt matches the date.
   */
  async getAvailableForDate(forDate: Date): Promise<{
    tasks: PoolItem[];
    aspirations: PoolItem[];
    events: PoolItem[];
  }> {
    const dateStr = forDate.toISOString().split('T')[0];
    const startOfDay = new Date(dateStr);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(startOfDay);
    endOfDay.setHours(23, 59, 59, 999);

    // Get all active items
    const allActive = await prisma.poolItem.findMany({
      where: {
        status: 'active',
      },
      include: {
        category: true,
      },
    });

    // Separate by type
    const events = allActive.filter((item) => {
      if (item.type !== 'event') return false;
      if (!item.scheduledAt) return false;
      const eventDate = new Date(item.scheduledAt);
      return eventDate >= startOfDay && eventDate <= endOfDay;
    });

    const tasksAndAspirations = allActive.filter(
      (item) => item.type === 'task' || item.type === 'aspiration'
    );

    // Filter by cooldown
    const available: PoolItem[] = [];
    for (const item of tasksAndAspirations) {
      const cooldownDays =
        item.cooldownDays ?? GLOBAL_COOLDOWN_DAYS[item.type as 'task' | 'aspiration'];

      if (!item.lastUsedAt) {
        // Never used - available
        available.push(item);
      } else {
        const daysSinceUsed = Math.floor(
          (forDate.getTime() - new Date(item.lastUsedAt).getTime()) / (1000 * 60 * 60 * 24)
        );
        if (daysSinceUsed >= cooldownDays) {
          available.push(item);
        }
      }
    }

    return {
      tasks: available.filter((item) => item.type === 'task'),
      aspirations: available.filter((item) => item.type === 'aspiration'),
      events,
    };
  }

  /**
   * Update last_used_at and use_count for Pool items that were used in a plan.
   * Called as part of plan creation transaction.
   */
  async markUsed(poolItemIds: string[], usedDate: Date): Promise<void> {
    await prisma.poolItem.updateMany({
      where: {
        id: { in: poolItemIds },
      },
      data: {
        lastUsedAt: usedDate,
        useCount: { increment: 1 },
      },
    });
  }
}
