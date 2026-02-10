import express from 'express';
import { DailyPlanService } from '../services/dailyPlanService.js';
import { CategoryService } from '../services/categoryService.js';
import { generatePlan } from '../services/planningEngine.js';
import prisma from '../lib/prisma.js';

const router = express.Router();
const planService = new DailyPlanService();
const categoryService = new CategoryService();

// Generate a new daily plan using the LLM (Phase 3)
router.post('/generate', async (req, res) => {
  try {
    const dateStr = (req.body?.date ?? req.query.date) as string;
    if (!dateStr) {
      return res.status(400).json({ error: 'date is required (YYYY-MM-DD)' });
    }
    const forDate = new Date(dateStr);
    if (isNaN(forDate.getTime())) {
      return res.status(400).json({ error: 'Invalid date' });
    }

    // Normalize to start of day
    forDate.setHours(0, 0, 0, 0);

    // Optional: prevent overwriting existing plan (set replace: true in body to allow)
    const replace = req.body?.replace === true;
    const existing = await planService.findByDate(forDate);
    if (existing && !replace) {
      return res.status(409).json({
        error: 'A plan already exists for this date',
        planId: existing.id,
        message: 'Use replace: true in body to regenerate.',
      });
    }

    if (existing && replace) {
      await prisma.task.deleteMany({ where: { dailyPlanId: existing.id } });
      await prisma.dailyFeedback.deleteMany({ where: { dailyPlanId: existing.id } }).catch(() => {});
      await prisma.dailyPlan.delete({ where: { id: existing.id } });
    }

    // Ensure default categories exist for the LLM to use
    await categoryService.initializeDefaultCategories();

    const { planId, taskCount } = await generatePlan(forDate);
    const plan = await planService.findById(planId);
    res.status(201).json({
      message: 'Plan generated successfully',
      planId,
      taskCount,
      plan,
    });
  } catch (error: any) {
    console.error('Plan generation error:', error);
    res.status(500).json({
      error: error.message || 'Plan generation failed',
      hint: 'Ensure Ollama is running and the model is available (e.g. ollama pull llama3.1:70b)',
    });
  }
});

// Get plan by date
router.get('/date/:date', async (req, res) => {
  try {
    const date = new Date(req.params.date);
    const plan = await planService.findByDate(date);
    
    if (!plan) {
      return res.status(404).json({ error: 'Plan not found for this date' });
    }
    
    res.json(plan);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get plan by ID
router.get('/:id', async (req, res) => {
  try {
    const plan = await planService.findById(req.params.id);
    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }
    res.json(plan);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create daily plan
router.post('/', async (req, res) => {
  try {
    const plan = await planService.create(req.body);
    res.json(plan);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Add task to plan
router.post('/:planId/tasks', async (req, res) => {
  try {
    const task = await planService.addTask({
      ...req.body,
      dailyPlanId: req.params.planId,
    });
    res.json(task);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Update task status
router.patch('/tasks/:taskId/status', async (req, res) => {
  try {
    const { status, notes } = req.body;
    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }
    
    const task = await planService.updateTaskStatus(req.params.taskId, status, notes);
    res.json(task);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Get task history
router.get('/tasks/history', async (req, res) => {
  try {
    const { categoryId, days } = req.query;
    const history = await planService.getTaskHistory(
      categoryId as string | undefined,
      days ? parseInt(days as string) : 30
    );
    res.json(history);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
