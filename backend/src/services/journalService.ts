import prisma from '../lib/prisma.js';
import { JournalEntry } from '@prisma/client';

export interface CreateJournalEntryInput {
  content: string;
  mood?: string;
  energyLevel?: number;
  sleepQuality?: number;
  timestamp?: Date;
}

export interface UpdateJournalEntryInput {
  content?: string;
  mood?: string;
  energyLevel?: number;
  sleepQuality?: number;
}

export class JournalService {
  async create(data: CreateJournalEntryInput): Promise<JournalEntry> {
    return prisma.journalEntry.create({
      data: {
        content: data.content,
        mood: data.mood,
        energyLevel: data.energyLevel,
        sleepQuality: data.sleepQuality,
        timestamp: data.timestamp || new Date(),
      },
    });
  }

  async findById(id: string): Promise<JournalEntry | null> {
    return prisma.journalEntry.findUnique({
      where: { id },
    });
  }

  async findByDateRange(startDate: Date, endDate: Date, limit?: number): Promise<JournalEntry[]> {
    return prisma.journalEntry.findMany({
      where: {
        timestamp: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: {
        timestamp: 'desc',
      },
      take: limit,
    });
  }

  async update(id: string, data: UpdateJournalEntryInput): Promise<JournalEntry> {
    return prisma.journalEntry.update({
      where: { id },
      data,
    });
  }

  async delete(id: string): Promise<void> {
    await prisma.journalEntry.delete({
      where: { id },
    });
  }

  async getRecent(days: number = 7): Promise<JournalEntry[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    return this.findByDateRange(startDate, new Date());
  }
}
