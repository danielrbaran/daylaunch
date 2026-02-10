import prisma from '../services/database.js';

export async function getJournalEntries(args: any) {
  const { start_date, end_date, limit } = args;
  
  const entries = await prisma.journalEntry.findMany({
    where: {
      timestamp: {
        gte: new Date(start_date),
        lte: new Date(end_date),
      },
    },
    orderBy: {
      timestamp: 'desc',
    },
    take: limit ? parseInt(limit) : undefined,
  });

  return {
    entries: entries.map(entry => ({
      id: entry.id,
      timestamp: entry.timestamp.toISOString(),
      content: entry.content,
      mood: entry.mood,
      energyLevel: entry.energyLevel,
      sleepQuality: entry.sleepQuality,
    })),
    count: entries.length,
  };
}

export async function getRecentMentalState(args: any) {
  const days = args.days || 7;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const entries = await prisma.journalEntry.findMany({
    where: {
      timestamp: {
        gte: startDate,
      },
    },
    orderBy: {
      timestamp: 'desc',
    },
  });

  // Calculate averages
  const energyLevels = entries.filter(e => e.energyLevel !== null).map(e => e.energyLevel!);
  const sleepQualities = entries.filter(e => e.sleepQuality !== null).map(e => e.sleepQuality!);
  
  const avgEnergy = energyLevels.length > 0
    ? energyLevels.reduce((a, b) => a + b, 0) / energyLevels.length
    : null;
  const avgSleep = sleepQualities.length > 0
    ? sleepQualities.reduce((a, b) => a + b, 0) / sleepQualities.length
    : null;

  // Count moods
  const moodCounts: Record<string, number> = {};
  entries.forEach(entry => {
    if (entry.mood) {
      moodCounts[entry.mood] = (moodCounts[entry.mood] || 0) + 1;
    }
  });

  return {
    period: `${days} days`,
    entryCount: entries.length,
    averageEnergyLevel: avgEnergy,
    averageSleepQuality: avgSleep,
    moodDistribution: moodCounts,
    recentEntries: entries.slice(0, 5).map(e => ({
      date: e.timestamp.toISOString().split('T')[0],
      content: e.content.substring(0, 200) + (e.content.length > 200 ? '...' : ''),
      mood: e.mood,
    })),
  };
}
