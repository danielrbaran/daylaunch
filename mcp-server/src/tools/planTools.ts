import prisma from '../services/database.js';

export async function createDailyPlan(args: any) {
  const { date, plan_data } = args;
  
  // Create the daily plan
  const plan = await prisma.dailyPlan.create({
    data: {
      date: new Date(date),
      capacityScore: plan_data.capacity_score || 'medium',
      mentalStateSummary: plan_data.mental_state_summary,
    },
  });

  // Create tasks if provided
  const tasks = [];
  if (plan_data.tasks && Array.isArray(plan_data.tasks)) {
    for (const taskData of plan_data.tasks) {
      const task = await prisma.task.create({
        data: {
          dailyPlanId: plan.id,
          categoryId: taskData.category_id,
          title: taskData.title,
          description: taskData.description,
          scheduledTime: taskData.scheduled_time ? new Date(taskData.scheduled_time) : null,
          durationMinutes: taskData.duration_minutes,
          priority: taskData.priority || 3,
        },
        include: {
          category: true,
        },
      });
      tasks.push(task);
    }
  }

  return {
    plan: {
      id: plan.id,
      date: plan.date.toISOString().split('T')[0],
      capacityScore: plan.capacityScore,
      mentalStateSummary: plan.mentalStateSummary,
    },
    tasks: tasks.map(t => ({
      id: t.id,
      title: t.title,
      category: t.category.name,
      scheduledTime: t.scheduledTime?.toISOString(),
      priority: t.priority,
    })),
    taskCount: tasks.length,
  };
}

export async function getTaskHistory(args: any) {
  const { category_id, days = 30 } = args;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const tasks = await prisma.task.findMany({
    where: {
      dailyPlan: {
        date: {
          gte: startDate,
        },
      },
      ...(category_id ? { categoryId: category_id } : {}),
    },
    include: {
      category: true,
      dailyPlan: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  // Calculate completion statistics
  const total = tasks.length;
  const completed = tasks.filter(t => t.status === 'completed').length;
  const skipped = tasks.filter(t => t.status === 'skipped').length;
  const pending = tasks.filter(t => t.status === 'pending').length;

  // Group by category
  const byCategory: Record<string, any> = {};
  tasks.forEach(task => {
    const catName = task.category.name;
    if (!byCategory[catName]) {
      byCategory[catName] = { total: 0, completed: 0, skipped: 0, pending: 0 };
    }
    byCategory[catName].total++;
    if (task.status === 'completed') byCategory[catName].completed++;
    if (task.status === 'skipped') byCategory[catName].skipped++;
    if (task.status === 'pending') byCategory[catName].pending++;
  });

  return {
    period: `${days} days`,
    total,
    completed,
    skipped,
    pending,
    completionRate: total > 0 ? (completed / total) * 100 : 0,
    byCategory,
  };
}

export async function queryCapacityIndicators(args: any) {
  const { date } = args;
  const targetDate = new Date(date);
  
  // Get recent journal entries (last 7 days)
  const startDate = new Date(targetDate);
  startDate.setDate(startDate.getDate() - 7);

  const entries = await prisma.journalEntry.findMany({
    where: {
      timestamp: {
        gte: startDate,
        lt: targetDate,
      },
    },
    orderBy: {
      timestamp: 'desc',
    },
  });

  // Get recent task completion (last 7 days)
  const tasks = await prisma.task.findMany({
    where: {
      dailyPlan: {
        date: {
          gte: startDate,
          lt: targetDate,
        },
      },
    },
  });

  // Calculate capacity indicators
  const avgEnergy = entries
    .filter(e => e.energyLevel !== null)
    .map(e => e.energyLevel!)
    .reduce((a, b, _, arr) => a + b / arr.length, 0) || 5;

  const avgSleep = entries
    .filter(e => e.sleepQuality !== null)
    .map(e => e.sleepQuality!)
    .reduce((a, b, _, arr) => a + b / arr.length, 0) || 5;

  const completionRate = tasks.length > 0
    ? tasks.filter(t => t.status === 'completed').length / tasks.length
    : 0.5;

  // Determine capacity score
  let capacityScore: 'low' | 'medium' | 'high' = 'medium';
  const score = (avgEnergy / 10) * 0.4 + (avgSleep / 10) * 0.3 + completionRate * 0.3;
  
  if (score < 0.4) capacityScore = 'low';
  else if (score > 0.7) capacityScore = 'high';

  return {
    date: targetDate.toISOString().split('T')[0],
    capacityScore,
    indicators: {
      averageEnergyLevel: avgEnergy,
      averageSleepQuality: avgSleep,
      recentCompletionRate: completionRate,
      recentTaskCount: tasks.length,
      recentJournalEntries: entries.length,
    },
    factors: {
      energyLevel: avgEnergy >= 7 ? 'positive' : avgEnergy >= 4 ? 'neutral' : 'negative',
      sleepQuality: avgSleep >= 7 ? 'positive' : avgSleep >= 4 ? 'neutral' : 'negative',
      completionRate: completionRate >= 0.7 ? 'positive' : completionRate >= 0.4 ? 'neutral' : 'negative',
    },
  };
}
