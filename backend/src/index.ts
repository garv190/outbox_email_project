import express from 'express';
import cors from 'cors';
import { config } from './config';
import { initializeEmailService } from './services/emailService';
import { startWorker } from './queue/worker';
import campaignRoutes from './routes/campaigns';
import dispatchRoutes from './routes/dispatches';
import userRoutes from './routes/users';
import statusRoutes from './routes/status';

const app = express();

app.use((req, res, next) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  next();
});

// Middleware
app.use(cors({
  origin: ['http://localhost:3000'], 
  credentials: true
}));
app.use(express.json());

// Routes
app.use('/api/campaigns', campaignRoutes);
app.use('/api/dispatches', dispatchRoutes);
app.use('/api/users', userRoutes);
app.use('/api/status', statusRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Initialize services
async function initialize() {
  try {
    // Initialize email service
    await initializeEmailService();

    // Start BullMQ worker
    startWorker();

    // Start server
    app.listen(config.server.port, () => {
      console.log(`Server running on port ${config.server.port}`);
      console.log(`Environment: ${config.server.nodeEnv}`);
    });
  } catch (error) {
    console.error('Failed to initialize:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  const { stopWorker } = await import('./queue/worker');
  await stopWorker();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');
  const { stopWorker } = await import('./queue/worker');
  await stopWorker();
  process.exit(0);
});

initialize();


