/**
 * Planning Engine: gathers context and uses the local LLM to generate
 * a personalized daily plan based on journals, capacity, feedback, and categories.
 *
 * PHILOSOPHY (immutable): Curiosity, not goals. "I wonder, not I will."
 * Plans are invitations to explore—not targets to hit. Any action taken is celebrated.
 * See DAYLAUNCH_V1_PLAN.md §1.4.
 */

import { generate } from '../lib/ollama.js';
import prisma from '../lib/prisma.js';
import { DailyPlanService } from './dailyPlanService.js';
import { JournalService } from './journalService.js';
import { CategoryService } from './categoryService.js';
import { PoolService } from './poolService.js';
import { PoolItem } from '@prisma/client';

const planService = new DailyPlanService();
const journalService = new JournalService();
const categoryService = new CategoryService();
const poolService = new PoolService();

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
  poolItems: {
    tasks: PoolItem[];
    aspirations: PoolItem[];
    events: PoolItem[]; // Already placed on this date
  };
}

/** Single task as returned by LLM (category by name) */
export interface LLMTask {
  category: string;
  title: string;
  description?: string;
  time?: string; // e.g. "09:00" or "morning"
  duration_minutes?: number;
  priority?: number;
  pool_item_id?: string; // Optional: if this task came from a Pool item
  is_i_wonder?: boolean; // true if this is an LLM-generated "I wonder..." idea (not from Pool)
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

  // Pool items available for this date (respects cooldown)
  const poolItems = await poolService.getAvailableForDate(forDate);

  return {
    date: dateStr,
    dayOfWeek,
    capacityScore,
    capacityFactors,
    mentalStateSummary,
    recentFeedback,
    taskHistorySummary,
    categories: categoryList,
    poolItems,
  };
}

function buildPrompt(ctx: PlanningContext): string {
  const categoriesList = ctx.categories.map((c) => c.name).join(', ');

  // Format Pool items for the prompt
  const poolTasksList =
    ctx.poolItems.tasks.length > 0
      ? ctx.poolItems.tasks
          .map((item) => `- ${item.title}${item.notes ? ` (${item.notes})` : ''} [category: ${item.category?.name || 'uncategorized'}]`)
          .join('\n')
      : '(none)';

  const poolAspirationsList =
    ctx.poolItems.aspirations.length > 0
      ? ctx.poolItems.aspirations
          .map((item) => `- ${item.title}${item.notes ? ` (${item.notes})` : ''} [category: ${item.category?.name || 'uncategorized'}]`)
          .join('\n')
      : '(none)';

  const eventsList =
    ctx.poolItems.events.length > 0
      ? ctx.poolItems.events
          .map((item) => {
            const time = item.scheduledAt ? new Date(item.scheduledAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '';
            return `- ${item.title}${time ? ` at ${time}` : ''}${item.notes ? ` (${item.notes})` : ''}`;
          })
          .join('\n')
      : '(none)';

  return `You are a supportive daily planning assistant. You create plans based on CURIOSITY, not goals. The user's day is guided by "I wonder…" — invitations to explore, try, or notice — not "I will achieve X." Any action they take is a success. There is no pass/fail.

## CRITICAL: Curiosity, not goals
- Do NOT use goal language: no "goal", "target", "achieve", "complete X by Y", "must", "should hit".
- DO use invitation/curiosity language: "I wonder…", "you might try…", "what if you…", "see how it feels to…".
- Frame each suggestion as something to explore or try. The user is not being measured. Any amount they do is enough.
- "priority" in the JSON is only for suggested order (what to try first/second). It does NOT mean "more important" or "must do".

## Context
- Date: ${ctx.date} (${ctx.dayOfWeek})
- Capacity today: ${ctx.capacityScore} (energy: ${ctx.capacityFactors.energy}, sleep: ${ctx.capacityFactors.sleep}, recent completion: ${ctx.capacityFactors.recent_completion})
- What they've tended to try lately: ${ctx.taskHistorySummary}

## Recent mental state (from journal)
${ctx.mentalStateSummary}

## Recent plan feedback (what felt right / too much)
${ctx.recentFeedback.length ? ctx.recentFeedback.map((f) => `- ${f.rating}${f.elaboration ? `: ${f.elaboration}` : ''}`).join('\n') : 'No recent feedback.'}

## Available categories (areas of curiosity)
${categoriesList}

## Pool items (raw materials to select from)
**Tasks available:**
${poolTasksList}

**Aspirations available:**
${poolAspirationsList}

**Events already on this day (work around these):**
${eventsList}

## Your task
Build today's plan by selecting, adapting, and sequencing from the Pool items above. You can:
- Use Pool tasks/aspirations as-is or adapt them (e.g. simplify if capacity is low)
- Optionally add **0–2 "I wonder…" ideas** of your own (not from the Pool) to keep curiosity alive
- Respect capacity: if low, fewer/simpler items; if high, a fuller day
- Spread across categories
- Work around the events listed above

Generate 4–8 invitations total (mix of Pool items + optional "I wonder…" ideas). Each is something to explore—not a target. Be concrete and kind.

Respond with a single JSON object (no other text) in this exact format:
\`\`\`json
{
  "capacity_notes": "one sentence on how you're respecting their capacity",
  "mental_state_notes": "one sentence if relevant from journal, else null",
  "tasks": [
    {
      "category": "CategoryName",
      "title": "Short invitation (curiosity-led, not a target)",
      "description": "Optional one-line: what they might notice or try",
      "time": "HH:MM or morning/afternoon/evening",
      "duration_minutes": 30,
      "priority": 3,
      "pool_item_id": "uuid-if-from-pool-or-null",
      "is_i_wonder": false
    }
  ]
}
\`\`\`
- If a task comes from the Pool, include its pool_item_id (match by title or description).
- If a task is your own "I wonder…" idea (not from Pool), set is_i_wonder: true and pool_item_id: null.
- priority is only for suggested order, 1=first suggestion, not importance.
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

  // Use Prisma transaction to ensure atomicity: plan + tasks + Pool updates
  return await prisma.$transaction(async (tx) => {
    // 1. Auto-place events (they go on their scheduled_at date/time)
    const eventsToPlace: Array<{ poolItem: PoolItem; scheduledTime: Date }> = [];
    for (const event of ctx.poolItems.events) {
      if (event.scheduledAt) {
        eventsToPlace.push({
          poolItem: event,
          scheduledTime: new Date(event.scheduledAt),
        });
      }
    }

    // 2. Build prompt with Pool items (excluding events, which we'll place directly)
    const prompt = buildPrompt(ctx);

    // 3. Generate plan from LLM
    const response = await generate({
      prompt,
      options: { temperature: 0.6, num_predict: 2048 },
    });

    const parsed = parseLLMResponse(response);
    if (!parsed || !Array.isArray(parsed.tasks)) {
      throw new Error('LLM did not return a valid plan with tasks. Raw response: ' + response.slice(0, 500));
    }

    const mentalStateSummary = [parsed.capacity_notes, parsed.mental_state_notes]
      .filter(Boolean)
      .join(' ');

    // 4. Create plan
    const plan = await tx.dailyPlan.create({
      data: {
        date: forDate,
        capacityScore: ctx.capacityScore,
        mentalStateSummary: mentalStateSummary || undefined,
      },
    });

    const categoryByName = new Map(ctx.categories.map((c) => [c.name, c.id]));
    const dateStr = forDate.toISOString().split('T')[0];
    const poolItemIdsToMark: string[] = [];

    // Build a map of Pool items by title (for matching LLM response to Pool items)
    const poolItemsByTitle = new Map<string, PoolItem>();
    [...ctx.poolItems.tasks, ...ctx.poolItems.aspirations].forEach((item) => {
      poolItemsByTitle.set(item.title.toLowerCase().trim(), item);
    });

    // 5. Create tasks from LLM response (Pool items + "I wonder..." ideas)
    for (const t of parsed.tasks) {
      const categoryId = categoryByName.get(t.category);
      if (!categoryId) continue;

      // Match Pool item by title (if not marked as "I wonder...")
      let matchedPoolItem: PoolItem | null = null;
      if (!t.is_i_wonder) {
        const titleKey = t.title.toLowerCase().trim();
        matchedPoolItem = poolItemsByTitle.get(titleKey) || null;
        
        // Also try matching by pool_item_id if LLM provided it
        if (!matchedPoolItem && t.pool_item_id) {
          const byId = [...ctx.poolItems.tasks, ...ctx.poolItems.aspirations].find(
            (item) => item.id === t.pool_item_id
          );
          if (byId) matchedPoolItem = byId;
        }
      }

      const scheduledTime = t.time ? timeToDate(dateStr, t.time) : undefined;

      await tx.task.create({
        data: {
          dailyPlanId: plan.id,
          categoryId,
          poolItemId: matchedPoolItem?.id || null,
          title: t.title,
          description: t.description,
          scheduledTime,
          durationMinutes: t.duration_minutes ?? undefined,
          priority: t.priority ?? 3,
        },
      });

      // Track Pool items that were used
      if (matchedPoolItem) {
        poolItemIdsToMark.push(matchedPoolItem.id);
      }
    }

    // 6. Auto-place events as tasks
    for (const { poolItem, scheduledTime } of eventsToPlace) {
      const categoryId = poolItem.categoryId || ctx.categories[0]?.id; // Fallback to first category if none
      if (!categoryId) continue;

      await tx.task.create({
        data: {
          dailyPlanId: plan.id,
          categoryId,
          poolItemId: poolItem.id,
          title: poolItem.title,
          description: poolItem.notes,
          scheduledTime,
          priority: 1, // Events get high priority (early in order)
        },
      });
      poolItemIdsToMark.push(poolItem.id);
    }

    // 7. Update Pool items: mark as used (same transaction)
    if (poolItemIdsToMark.length > 0) {
      await tx.poolItem.updateMany({
        where: {
          id: { in: poolItemIdsToMark },
        },
        data: {
          lastUsedAt: forDate,
          useCount: { increment: 1 },
        },
      });
    }

    const totalTasks = parsed.tasks.filter((t) => categoryByName.has(t.category)).length + eventsToPlace.length;
    return { planId: plan.id, taskCount: totalTasks };
  });
}
