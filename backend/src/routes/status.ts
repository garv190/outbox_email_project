import { Router, Request, Response } from 'express';
import { getSchedulerMetrics } from '../queue/reachinboxScheduler';
import pool from '../db/client';

const router = Router();

/**
 * GET /api/status
 * Get system status including worker, queue, and database health
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    // Check database connection
    let dbStatus = 'connected';
    try {
      await pool.query('SELECT 1');
    } catch (err) {
      dbStatus = 'disconnected';
    }

    // Get scheduler metrics
    const queueStats = await getSchedulerMetrics();

    res.json({
      success: true,
      data: {
        database: {
          status: dbStatus,
        },
        queue: queueStats,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error('Error fetching status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch status',
    });
  }
});

export default router;

