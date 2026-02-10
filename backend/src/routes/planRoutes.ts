import express from 'express';
import { DailyPlanService } from '../services/dailyPlanService.js';

const router = express.Router();
const planService = new DailyPlanService();

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
