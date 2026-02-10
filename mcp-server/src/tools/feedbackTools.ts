import prisma from '../services/database.js';

export async function getRecentFeedback(args: any) {
  const { days = 14, category_id } = args;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const feedback = await prisma.dailyFeedback.findMany({
    where: {
      date: {
        gte: startDate,
      },
      ...(category_id ? { affectedCategoryId: category_id } : {}),
    },
    include: {
      affectedCategory: true,
      dailyPlan: true,
    },
    orderBy: {
      date: 'desc',
    },
  });

  return {
    period: `${days} days`,
    feedback: feedback.map(f => ({
      id: f.id,
      date: f.date.toISOString().split('T')[0],
      overallRating: f.overallRating,
      affectedCategory: f.affectedCategory?.name,
      textElaboration: f.textElaboration,
      activityLog: f.activityLog,
      extractedInsights: f.extractedInsights ? JSON.parse(f.extractedInsights) : null,
      sentiment: f.sentiment,
    })),
    count: feedback.length,
    ratingDistribution: {
      about_right: feedback.filter(f => f.overallRating === 'about_right').length,
      too_much: feedback.filter(f => f.overallRating === 'too_much').length,
      one_area: feedback.filter(f => f.overallRating === 'one_area').length,
    },
  };
}

export async function saveDailyFeedback(args: any) {
  const {
    daily_plan_id,
    overall_rating,
    affected_category_id,
    text_elaboration,
    activity_log,
  } = args;

  // Get the plan to get the date
  const plan = await prisma.dailyPlan.findUnique({
    where: { id: daily_plan_id },
  });

  if (!plan) {
    throw new Error(`Daily plan with id ${daily_plan_id} not found`);
  }

  // Create feedback
  const feedback = await prisma.dailyFeedback.create({
    data: {
      dailyPlanId: daily_plan_id,
      date: plan.date,
      overallRating: overall_rating,
      affectedCategoryId: affected_category_id || null,
      textElaboration: text_elaboration || null,
      activityLog: activity_log || null,
      // Extracted insights will be added by LLM analysis later
    },
    include: {
      affectedCategory: true,
    },
  });

  return {
    id: feedback.id,
    date: feedback.date.toISOString().split('T')[0],
    overallRating: feedback.overallRating,
    affectedCategory: feedback.affectedCategory?.name,
    message: 'Feedback saved successfully. Insights can be extracted and updated later.',
  };
}

export async function getPatternInsights(args: any) {
  const { pattern_type, min_confidence = 0 } = args;

  const insights = await prisma.patternInsight.findMany({
    where: {
      isActive: true,
      ...(pattern_type ? { patternType: pattern_type } : {}),
      confidence: {
        gte: min_confidence,
      },
    },
    orderBy: {
      confidence: 'desc',
    },
  });

  return {
    insights: insights.map(i => ({
      id: i.id,
      patternType: i.patternType,
      patternData: JSON.parse(i.patternData),
      confidence: i.confidence,
      firstObserved: i.firstObserved.toISOString().split('T')[0],
      lastObserved: i.lastObserved.toISOString().split('T')[0],
    })),
    count: insights.length,
  };
}
