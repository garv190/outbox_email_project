import { Router, Request, Response } from 'express';
import { z } from 'zod';
import pool from '../db/client';
import { enqueueOutgoingMail, OutgoingMailTask } from '../queue/reachinboxScheduler';
import { config } from '../config';
import { randomUUID } from 'crypto';

const router = Router();

/**
 * Schema for creating a new campaign
 */
const createCampaignSchema = z.object({
  userId: z.string().uuid(),
  subject: z.string().min(1),
  body: z.string().min(1),
  recipientEmails: z.array(z.string().email()),
  startTime: z.string().datetime(),
  delayBetweenMs: z.number().int().min(0).optional(),
  hourlyLimit: z.number().int().min(1).optional(),
});

/**
 * POST /api/campaigns
 * Creates a new email campaign and schedules individual email delivery tasks
 * 
 * This endpoint handles the full flow: validation -> DB writes -> job scheduling.
 * We process dispatches sequentially to avoid race conditions with the unique
 * constraint on (campaignId, recipientEmail).
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const data = createCampaignSchema.parse(req.body);

    // Validate at least one recipient - empty campaigns don't make sense
    if (!data.recipientEmails || data.recipientEmails.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'At least one recipient email is required',
      });
    }

    // Deduplicate emails - if CSV has duplicates, we filter them out
    // We use Set here, but DB unique constraint also prevents duplicates
    const uniqueEmails = Array.from(new Set(data.recipientEmails));
    if (uniqueEmails.length !== data.recipientEmails.length) {
      console.log(`Removed ${data.recipientEmails.length - uniqueEmails.length} duplicate emails`);
    }

    // Double-check email format (Zod validates, but we add extra safety)
    const invalidEmails = uniqueEmails.filter(
      (email) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    );
    if (invalidEmails.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Invalid email addresses: ${invalidEmails.join(', ')}`,
      });
    }

    // Use unique emails for processing
    const emailsToProcess = uniqueEmails;

    const campaignId = randomUUID();
    const startTime = new Date(data.startTime);
    const delayBetweenMs = data.delayBetweenMs || config.rateLimiting.minDelayBetweenEmailsMs;
    const hourlyLimit = data.hourlyLimit || config.rateLimiting.maxEmailsPerHourPerSender;

    // Validate start time - allow 1 minute buffer for clock drift between client/server
    const now = Date.now();
    const startTimeMs = startTime.getTime();
    if (startTimeMs < now - 60000) { // Allow 1 minute tolerance
      return res.status(400).json({
        success: false,
        error: 'Start time cannot be in the past',
      });
    }

    // Create campaign
    await pool.execute(
      `INSERT INTO MailCampaign (id, userId, subject, body, startTime, delayBetweenMs, hourlyLimit, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'SCHEDULED')`,
      [campaignId, data.userId, data.subject, data.body, startTime, delayBetweenMs, hourlyLimit]
    );

    // Calculate base delay from start time, then add per-email delays
    // We use Math.max(0, ...) to handle edge case where start time is slightly in past
    const baseDelay = Math.max(0, startTimeMs - now);

    // Process dispatches one-by-one to safely handle unique constraint violations
    // (unique constraint on campaignId + recipientEmail prevents duplicates)
    const dispatchResults = [];
    for (let index = 0; index < emailsToProcess.length; index++) {
      const email = emailsToProcess[index];
      const delay = baseDelay + index * delayBetweenMs;
      const scheduledTime = new Date(now + delay);
      const dispatchId = randomUUID();

      try {
        // Create dispatch record (with duplicate check via unique constraint)
        await pool.execute(
          `INSERT INTO MailDispatch (id, campaignId, recipientEmail, subject, body, scheduledTime, status)
           VALUES (?, ?, ?, ?, ?, ?, 'SCHEDULED')`,
          [dispatchId, campaignId, email, data.subject, data.body, scheduledTime]
        );

        // Create task payload with all delivery details
        // We include campaignId for debugging/tracing even though it's in dispatchId
        const mailTask: OutgoingMailTask = {
          dispatchId,
          campaignId,
          recipientEmail: email,
          subject: data.subject,
          body: data.body,
          scheduledTime: scheduledTime.toISOString(),
        };

        // Enqueue task with calculated delay - BullMQ will execute at the right time
        await enqueueOutgoingMail(mailTask, delay);
        dispatchResults.push({ email, success: true });
      } catch (error: any) {
        // Handle duplicate email error gracefully
        if (error.code === 'ER_DUP_ENTRY') {
          console.warn(`Duplicate email skipped: ${email} for campaign ${campaignId}`);
          dispatchResults.push({ email, success: false, error: 'Duplicate email' });
        } else {
          console.error(`Failed to create dispatch for ${email}:`, error);
          dispatchResults.push({ email, success: false, error: error.message });
        }
      }
    }

    // Check if at least one dispatch was created
    const successfulDispatches = dispatchResults.filter((r) => r.success);
    if (successfulDispatches.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Failed to create any email dispatches. All emails may be duplicates.',
      });
    }

    // Update campaign status
    await pool.execute(
      'UPDATE MailCampaign SET status = ? WHERE id = ?',
      ['IN_PROGRESS', campaignId]
    );

    // Fetch created campaign
    const [campaigns] = await pool.query<Array<{
      id: string;
      userId: string;
      subject: string;
      body: string;
      startTime: Date;
      delayBetweenMs: number;
      hourlyLimit: number;
      status: string;
      createdAt: Date;
      updatedAt: Date;
    }>>(
      'SELECT * FROM MailCampaign WHERE id = ?',
      [campaignId]
    );

    res.status(201).json({
      success: true,
      data: {
        campaign: campaigns[0],
        dispatchCount: successfulDispatches.length,
        totalEmails: emailsToProcess.length,
        failed: dispatchResults.filter((r) => !r.success).length,
      },
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors,
      });
    }

    console.error('Error creating campaign:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create campaign',
      message: error.message,
    });
  }
});

/**
 * GET /api/campaigns/:campaignId/dispatches
 * Get all dispatches for a campaign
 */
router.get('/:campaignId/dispatches', async (req: Request, res: Response) => {
  try {
    const { campaignId } = req.params;
    const { status, page = '1', limit = '50' } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const offset = (pageNum - 1) * limitNum;

    let query = 'SELECT * FROM MailDispatch WHERE campaignId = ?';
    const params: any[] = [campaignId];

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }

    query += ' ORDER BY scheduledTime ASC LIMIT ? OFFSET ?';
    params.push(limitNum, offset);

    // Use query instead of execute for LIMIT/OFFSET
    const [dispatches] = await pool.query(query, params);

    res.json({
      success: true,
      data: dispatches,
    });
  } catch (error: any) {
    console.error('Error fetching dispatches:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch dispatches',
    });
  }
});

/**
 * GET /api/campaigns
 * Get all campaigns for a user
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { userId, status, page = '1', limit = '20' } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId is required',
      });
    }

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const offset = (pageNum - 1) * limitNum;

    let query = 'SELECT * FROM MailCampaign WHERE userId = ?';
    const params: any[] = [userId];

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }

    query += ' ORDER BY createdAt DESC LIMIT ? OFFSET ?';
    params.push(limitNum, offset);

    // Use query instead of execute for LIMIT/OFFSET
    const [campaigns] = await pool.query(query, params);

    // Get dispatch counts for each campaign
    const campaignsWithCounts = await Promise.all(
      (campaigns as Array<{ id: string }>).map(async (campaign) => {
        const [countResult] = await pool.query<Array<{ count: number }>>(
          'SELECT COUNT(*) as count FROM MailDispatch WHERE campaignId = ?',
          [campaign.id]
        );
        return {
          ...campaign,
          _count: {
            mailDispatches: (countResult[0] as any)?.count || 0,
          },
        };
      })
    );

    res.json({
      success: true,
      data: campaignsWithCounts,
    });
  } catch (error: any) {
    console.error('Error fetching campaigns:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch campaigns',
    });
  }
});

export default router;
