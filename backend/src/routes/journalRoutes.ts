import express from 'express';
import { JournalService } from '../services/journalService.js';

const router = express.Router();
const journalService = new JournalService();

// Create journal entry
router.post('/', async (req, res) => {
  try {
    const entry = await journalService.create(req.body);
    res.json(entry);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Get journal entries by date range
router.get('/range', async (req, res) => {
  try {
    const { startDate, endDate, limit } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate are required' });
    }

    const entries = await journalService.findByDateRange(
      new Date(startDate as string),
      new Date(endDate as string),
      limit ? parseInt(limit as string) : undefined
    );
    
    res.json(entries);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get recent journal entries
router.get('/recent', async (req, res) => {
  try {
    const days = req.query.days ? parseInt(req.query.days as string) : 7;
    const entries = await journalService.getRecent(days);
    res.json(entries);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get journal entry by ID
router.get('/:id', async (req, res) => {
  try {
    const entry = await journalService.findById(req.params.id);
    if (!entry) {
      return res.status(404).json({ error: 'Journal entry not found' });
    }
    res.json(entry);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update journal entry
router.put('/:id', async (req, res) => {
  try {
    const entry = await journalService.update(req.params.id, req.body);
    res.json(entry);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Delete journal entry
router.delete('/:id', async (req, res) => {
  try {
    await journalService.delete(req.params.id);
    res.json({ message: 'Journal entry deleted' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
