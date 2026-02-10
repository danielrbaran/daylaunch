import prisma from '../lib/prisma.js';
import { Category } from '@prisma/client';

export interface CreateCategoryInput {
  name: string;
  color?: string;
  icon?: string;
  priority?: number;
  timePreferences?: Record<string, any>;
  frequency?: string;
  enabled?: boolean;
}

export interface UpdateCategoryInput {
  name?: string;
  color?: string;
  icon?: string;
  priority?: number;
  timePreferences?: Record<string, any>;
  frequency?: string;
  enabled?: boolean;
}

export class CategoryService {
  async create(data: CreateCategoryInput): Promise<Category> {
    return prisma.category.create({
      data: {
        name: data.name,
        color: data.color || '#10b981', // Default dark green
        icon: data.icon,
        priority: data.priority || 0,
        timePreferences: data.timePreferences ? JSON.stringify(data.timePreferences) : null,
        frequency: data.frequency,
        enabled: data.enabled !== undefined ? data.enabled : true,
      },
    });
  }

  async findAll(enabledOnly: boolean = false): Promise<Category[]> {
    return prisma.category.findMany({
      where: enabledOnly ? { enabled: true } : undefined,
      orderBy: [
        { priority: 'desc' },
        { name: 'asc' },
      ],
    });
  }

  async findById(id: string): Promise<Category | null> {
    return prisma.category.findUnique({
      where: { id },
    });
  }

  async findByName(name: string): Promise<Category | null> {
    return prisma.category.findUnique({
      where: { name },
    });
  }

  async update(id: string, data: UpdateCategoryInput): Promise<Category> {
    const updateData: any = { ...data };
    if (data.timePreferences) {
      updateData.timePreferences = JSON.stringify(data.timePreferences);
    }
    
    return prisma.category.update({
      where: { id },
      data: updateData,
    });
  }

  async delete(id: string): Promise<void> {
    await prisma.category.delete({
      where: { id },
    });
  }

  async initializeDefaultCategories(): Promise<void> {
    const defaults = [
      { name: 'Exercise', color: '#10b981', priority: 1 },
      { name: 'Diet', color: '#10b981', priority: 2 },
      { name: 'Work', color: '#10b981', priority: 3 },
      { name: 'Social', color: '#10b981', priority: 4 },
      { name: 'Debt', color: '#10b981', priority: 5 },
      { name: 'Learning', color: '#10b981', priority: 6 },
      { name: 'Personal', color: '#10b981', priority: 7 },
    ];

    for (const cat of defaults) {
      const existing = await this.findByName(cat.name);
      if (!existing) {
        await this.create(cat);
      }
    }
  }
}
