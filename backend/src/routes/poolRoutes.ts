import express from 'express';
import { PoolService } from '../services/poolService.js';

const router = express.Router();
const poolService = new PoolService();

// Get all pool items (with optional filters)
router.get('/', async (req, res) => {
  try {
    const { type, status, categoryId } = req.query;
    const items = await poolService.findAll({
      ...(type ? { type: type as 'task' | 'event' | 'aspiration' } : {}),
      ...(status ? { status: status as 'active' | 'paused' | 'completed' } : {}),
      ...(categoryId ? { categoryId: categoryId as string } : {}),
    });
    res.json(items);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get pool items available for a specific date (respects cooldown)
router.get('/available/:date', async (req, res) => {
  try {
    const date = new Date(req.params.date);
    if (isNaN(date.getTime())) {
      return res.status(400).json({ error: 'Invalid date' });
    }
    const available = await poolService.getAvailableForDate(date);
    res.json(available);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get pool item by ID
router.get('/:id', async (req, res) => {
  try {
    const item = await poolService.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ error: 'Pool item not found' });
    }
    res.json(item);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create pool item
router.post('/', async (req, res) => {
  try {
    const item = await poolService.create(req.body);
    res.status(201).json(item);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Update pool item
router.put('/:id', async (req, res) => {
  try {
    const item = await poolService.update(req.params.id, req.body);
    res.json(item);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Delete pool item
router.delete('/:id', async (req, res) => {
  try {
    await poolService.delete(req.params.id);
    res.json({ message: 'Pool item deleted' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
