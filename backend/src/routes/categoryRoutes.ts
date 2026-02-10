import express from 'express';
import { CategoryService } from '../services/categoryService.js';

const router = express.Router();
const categoryService = new CategoryService();

// Initialize default categories
router.post('/initialize', async (req, res) => {
  try {
    await categoryService.initializeDefaultCategories();
    res.json({ message: 'Default categories initialized' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get all categories
router.get('/', async (req, res) => {
  try {
    const enabledOnly = req.query.enabled === 'true';
    const categories = await categoryService.findAll(enabledOnly);
    res.json(categories);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get category by ID
router.get('/:id', async (req, res) => {
  try {
    const category = await categoryService.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }
    res.json(category);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create category
router.post('/', async (req, res) => {
  try {
    const category = await categoryService.create(req.body);
    res.json(category);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Update category
router.put('/:id', async (req, res) => {
  try {
    const category = await categoryService.update(req.params.id, req.body);
    res.json(category);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Delete category
router.delete('/:id', async (req, res) => {
  try {
    await categoryService.delete(req.params.id);
    res.json({ message: 'Category deleted' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
