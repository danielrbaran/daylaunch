/**
 * Planning Engine: gathers context and uses the local LLM to generate
 * a personalized daily plan based on journals, capacity, feedback, and categories.
 */

import { generate } from '../lib/ollama.js';
import prisma from '../lib/prisma.js';
import { DailyPlanService } from './dailyPlanService.js';
import { JournalService } from './journalService.js';
import { CategoryService } from './categoryService.js';

const planService = new DailyPlanService();
const journalService = new JournalService();
const categoryService = new CategoryService();

/** Context we pass to the LLM for planning */
export interface PlanningContext {
  date: string;
  dayOfWeek: string;
  capacityScore: string;
  capacityFactors: Record<string, string>;
  mentalStateSummary: string;
  recentFeedback: { rating: string; elaboration?: string }[];
  taskHistorySummary: string;
  categories: { id: string; name: string }[];
}

/** Single task as returned by LLM (category by name) */
export interface LLMTask {
  category: string;
  title: string;
  description?: string;
  time?: string; // e.g. "09:00" or "morning"
  duration_minutes?: number;
  priority?: number;
}

/** Parsed plan from LLM (we expect JSON in a code block) */
export interface LLMPlanOutput {
  capacity_notes?: string;
  mental_state_notes?: string;
  tasks: LLMTask[];
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export async function gatherContext(forDate: Date): Promise<PlanningContext> {
  const dateStr = forDate.toISOString().split('T')[0];
  const dayOfWeek = DAY_NAMES[forDate.getDay()];

  // Capacity indicators (reuse logic similar to MCP)
  const startDate = new Date(forDate);
  startDate.setDate(startDate.getDate() - 7);

  const entries = await prisma.journalEntry.findMany({
    where: { timestamp: { gte: startDate, lt: forDate } },
    orderBy: { timestamp: 'desc' },
  });

  const tasks = await prisma.task.findMany({
    where: {
      dailyPlan: { date: { gte: startDate, lt: forDate } },
    },
    include: { category: true },
  });

  const avgEnergy =
    entries.filter((e) => e.energyLevel != null).length > 0
      ? entries
          .filter((e) => e.energyLevel != null)
          .reduce((a, e) => a + (e.energyLevel ?? 0), 0) /
        entries.filter((e) => e.energyLevel != null).length
      : 5;
  const avgSleep =
    entries.filter((e) => e.sleepQuality != null).length > 0
      ? entries
          .filter((e) => e.sleepQuality != null)
          .reduce((a, e) => a + (e.sleepQuality ?? 0), 0) /
        entries.filter((e) => e.sleepQuality != null).length
      : 5;
  const completionRate =
    tasks.length > 0 ? tasks.filter((t) => t.status === 'completed').length / tasks.length : 0.5;

  let capacityScore: 'low' | 'medium' | 'high' = 'medium';
  const score = (avgEnergy / 10) * 0.4 + (avgSleep / 10) * 0.3 + completionRate * 0.3;
  if (score < 0.4) capacityScore = 'low';
  else if (score > 0.7) capacityScore = 'high';

  const capacityFactors: Record<string, string> = {
    energy: avgEnergy >= 7 ? 'good' : avgEnergy >= 4 ? 'moderate' : 'low',
    sleep: avgSleep >= 7 ? 'good' : avgSleep >= 4 ? 'moderate' : 'poor',
    recent_completion: completionRate >= 0.7 ? 'high' : completionRate >= 0.4 ? 'moderate' : 'low',
  };

  // Recent journal summary (last 3 entries)
  const recentEntries = entries.slice(0, 3);
  const mentalStateSummary =
    recentEntries.length === 0
      ? 'No recent journal entries.'
      : recentEntries
          .map(
            (e) =>
              `${e.timestamp.toISOString().split('T')[0]}: ${e.content.substring(0, 300)}${e.content.length > 300 ? '...' : ''}`
          )
          .join('\n');

  // Recent feedback
  const feedbackStart = new Date(forDate);
  feedbackStart.setDate(feedbackStart.getDate() - 14);
  const feedback = await prisma.dailyFeedback.findMany({
    where: { date: { gte: feedbackStart, lt: forDate } },
    orderBy: { date: 'desc' },
    take: 5,
  });
  const recentFeedback = feedback.map((f) => ({
    rating: f.overallRating,
    elaboration: f.textElaboration ? f.textElaboration.substring(0, 200) : undefined,
  }));

  // Task history summary
  const completedCount = tasks.filter((t) => t.status === 'completed').length;
  const taskHistorySummary = `Last 7 days: ${completedCount}/${tasks.length} tasks completed (${tasks.length ? Math.round(completionRate * 100) : 0}%).`;

  // Categories
  const categories = await categoryService.findAll(true);
  const categoryList = categories.map((c) => ({ id: c.id, name: c.name }));

  return {
    date: dateStr,
    dayOfWeek,
    capacityScore,
    capacityFactors,
    mentalStateSummary,
    recentFeedback,
    taskHistorySummary,
    categories: categoryList,
  };
}

function buildPrompt(ctx: PlanningContext): string {
  const categoriesList = ctx.categories.map((c) => c.name).join(', ');

  return `You are a supportive daily planning assistant. Create a realistic, kind daily plan for the user.

## Context
- Date: ${ctx.date} (${ctx.dayOfWeek})
- Capacity today: ${ctx.capacityScore} (energy: ${ctx.capacityFactors.energy}, sleep: ${ctx.capacityFactors.sleep}, recent completion: ${ctx.capacityFactors.recent_completion})
- Task history: ${ctx.taskHistorySummary}

## Recent mental state (from journal)
${ctx.mentalStateSummary}

## Recent plan feedback (what worked / didn't)
${ctx.recentFeedback.length ? ctx.recentFeedback.map((f) => `- ${f.rating}${f.elaboration ? `: ${f.elaboration}` : ''}`).join('\n') : 'No recent feedback.'}

## Available categories
${categoriesList}

## Your task
Generate a daily plan with 4–8 specific, actionable tasks. Respect the user's capacity: if capacity is low, suggest fewer/simpler tasks; if high, a fuller day is fine. Spread tasks across categories. Use only the categories listed. Be concrete (e.g. "30 min walk" not "exercise").

Respond with a single JSON object (no other text) in this exact format:
\`\`\`json
{
  "capacity_notes": "one sentence on how you're respecting their capacity",
  "mental_state_notes": "one sentence if relevant from journal, else null",
  "tasks": [
    {
      "category": "CategoryName",
      "title": "Short task title",
      "description": "Optional one-line detail",
      "time": "HH:MM or morning/afternoon/evening",
      "duration_minutes": 30,
      "priority": 3
    }
  ]
}
\`\`\`
`;
}

function parseLLMResponse(raw: string): LLMPlanOutput | null {
  const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonStr = jsonMatch ? jsonMatch[1].trim() : raw.trim();
  try {
    return JSON.parse(jsonStr) as LLMPlanOutput;
  } catch {
    return null;
  }
}

function timeToDate(dateStr: string, timeStr: string): Date {
  const d = new Date(dateStr);
  if (!timeStr || timeStr === 'morning') {
    d.setHours(9, 0, 0, 0);
    return d;
  }
  if (timeStr === 'afternoon') {
    d.setHours(14, 0, 0, 0);
    return d;
  }
  if (timeStr === 'evening') {
    d.setHours(18, 0, 0, 0);
    return d;
  }
  const [h, m] = timeStr.split(':').map(Number);
  d.setHours(h ?? 9, m ?? 0, 0, 0);
  return d;
}

export async function generatePlan(forDate: Date): Promise<{ planId: string; taskCount: number }> {
  const ctx = await gatherContext(forDate);
  const prompt = buildPrompt(ctx);

  const response = await generate({
    prompt,
    options: { temperature: 0.6, num_predict: 2048 },
  });

  const parsed = parseLLMResponse(response);
  if (!parsed || !Array.isArray(parsed.tasks) || parsed.tasks.length === 0) {
    throw new Error('LLM did not return a valid plan with tasks. Raw response: ' + response.slice(0, 500));
  }

  const mentalStateSummary = [parsed.capacity_notes, parsed.mental_state_notes]
    .filter(Boolean)
    .join(' ');

  const plan = await planService.create({
    date: forDate,
    capacityScore: ctx.capacityScore,
    mentalStateSummary: mentalStateSummary || undefined,
  });

  const categoryByName = new Map(ctx.categories.map((c) => [c.name, c.id]));
  const dateStr = forDate.toISOString().split('T')[0];

  for (const t of parsed.tasks) {
    const categoryId = categoryByName.get(t.category);
    if (!categoryId) continue;

    const scheduledTime = t.time ? timeToDate(dateStr, t.time) : undefined;

    await planService.addTask({
      dailyPlanId: plan.id,
      categoryId,
      title: t.title,
      description: t.description,
      scheduledTime,
      durationMinutes: t.duration_minutes ?? undefined,
      priority: t.priority ?? 3,
    });
  }

  const taskCount = parsed.tasks.filter((t) => categoryByName.has(t.category)).length;
  return { planId: plan.id, taskCount };
}
