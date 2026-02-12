import prisma from '../lib/prisma.js';
import { DailyPlan, Task } from '@prisma/client';

export interface CreateDailyPlanInput {
  date: Date;
  capacityScore: 'low' | 'medium' | 'high';
  mentalStateSummary?: string;
}

export interface CreateTaskInput {
  dailyPlanId: string;
  categoryId: string;
  poolItemId?: string; // Optional: if this task came from the Pool
  title: string;
  description?: string;
  scheduledTime?: Date;
  durationMinutes?: number;
  priority?: number;
}

export class DailyPlanService {
  async create(data: CreateDailyPlanInput): Promise<DailyPlan> {
    return prisma.dailyPlan.create({
      data: {
        date: data.date,
        capacityScore: data.capacityScore,
        mentalStateSummary: data.mentalStateSummary,
      },
    });
  }

  async findByDate(date: Date): Promise<DailyPlan | null> {
    // Normalize date to start of day for comparison
    const normalizedDate = new Date(date);
    normalizedDate.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(normalizedDate);
    endOfDay.setHours(23, 59, 59, 999);

    return prisma.dailyPlan.findFirst({
      where: {
        date: {
          gte: normalizedDate,
          lte: endOfDay,
        },
      },
      include: {
        tasks: {
          include: {
            category: true,
            poolItem: true,
          },
          orderBy: [
            { scheduledTime: 'asc' },
            { priority: 'desc' },
          ],
        },
        feedback: true,
      },
    });
  }

  async findById(id: string): Promise<DailyPlan | null> {
    return prisma.dailyPlan.findUnique({
      where: { id },
      include: {
        tasks: {
          include: {
            category: true,
            poolItem: true,
          },
        },
        feedback: true,
      },
    });
  }

  async addTask(data: CreateTaskInput): Promise<Task> {
    return prisma.task.create({
      data: {
        dailyPlanId: data.dailyPlanId,
        categoryId: data.categoryId,
        poolItemId: data.poolItemId || null,
        title: data.title,
        description: data.description,
        scheduledTime: data.scheduledTime,
        durationMinutes: data.durationMinutes,
        priority: data.priority || 3,
      },
      include: {
        category: true,
        poolItem: true,
      },
    });
  }

  async updateTaskStatus(
    taskId: string,
    status: 'pending' | 'in_progress' | 'completed' | 'skipped',
    notes?: string
  ): Promise<Task> {
    const updateData: any = {
      status,
      notes,
    };

    if (status === 'completed') {
      updateData.completedAt = new Date();
    }

    return prisma.task.update({
      where: { id: taskId },
      data: updateData,
    });
  }

  async getTaskHistory(categoryId?: string, days: number = 30): Promise<any[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    return prisma.task.findMany({
      where: {
        dailyPlan: {
          date: {
            gte: startDate,
          },
        },
        ...(categoryId ? { categoryId } : {}),
      },
      include: {
        category: true,
        dailyPlan: true,
        completionHistory: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }
}
