import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import journalRoutes from './routes/journalRoutes.js';
import categoryRoutes from './routes/categoryRoutes.js';
import planRoutes from './routes/planRoutes.js';
import { isAvailable as ollamaAvailable } from './lib/ollama.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'DayLaunch API is running' });
});

// Ollama availability (for plan generation)
app.get('/health/ollama', async (req, res) => {
  const available = await ollamaAvailable();
  res.json({ ollama: available, message: available ? 'Ollama is reachable' : 'Ollama is not reachable' });
});

// API Routes
app.use('/api/journals', journalRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/plans', planRoutes);

// Start server
app.listen(PORT, () => {
  console.log(`🚀 DayLaunch backend running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`📝 API endpoints:`);
  console.log(`   - Journals: http://localhost:${PORT}/api/journals`);
  console.log(`   - Categories: http://localhost:${PORT}/api/categories`);
  console.log(`   - Plans: http://localhost:${PORT}/api/plans`);
});
