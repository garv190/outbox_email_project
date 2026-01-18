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


app.use(cors({
  origin: ['http://localhost:3000'], 
  credentials: true
}));
app.use(express.json());


app.use('/api/campaigns', campaignRoutes);
app.use('/api/dispatches', dispatchRoutes);
app.use('/api/users', userRoutes);
app.use('/api/status', statusRoutes);


app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});


async function initialize() {
  try {
    
    await initializeEmailService();

   
    startWorker();

    
    app.listen(config.server.port, () => {
      console.log(`Server running on port ${config.server.port}`);
      console.log(`Environment: ${config.server.nodeEnv}`);
    });
  } catch (error) {
    console.error('Failed to initialize:', error);
    process.exit(1);
  }
}


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


