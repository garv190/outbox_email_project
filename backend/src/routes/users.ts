import { Router, Request, Response } from 'express';
import { z } from 'zod';
import pool from '../db/client';
import { randomUUID } from 'crypto';

const router = Router();

const createUserSchema = z.object({
  googleId: z.string(),
  email: z.string().email(),
  name: z.string(),
  avatar: z.string().optional(),
});

/**
 * POST /api/users
 * Create or update a user from Google OAuth
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const data = createUserSchema.parse(req.body);

    // Check if user exists
    const [existingUsers] = await pool.execute<Array<{
      id: string;
      googleId: string;
      email: string;
      name: string;
      avatar: string | null;
    }>>(
      'SELECT * FROM `User` WHERE googleId = ?',
      [data.googleId]
    );

    let user;
    if (existingUsers.length > 0) {
      // Update existing user
      await pool.execute(
        'UPDATE `User` SET email = ?, name = ?, avatar = ? WHERE googleId = ?',
        [data.email, data.name, data.avatar || null, data.googleId]
      );
      user = {
        ...existingUsers[0],
        email: data.email,
        name: data.name,
        avatar: data.avatar || null,
      };
    } else {
      // Create new user
      const id = randomUUID();
      await pool.execute(
        'INSERT INTO `User` (id, googleId, email, name, avatar) VALUES (?, ?, ?, ?, ?)',
        [id, data.googleId, data.email, data.name, data.avatar || null]
      );
      user = {
        id,
        googleId: data.googleId,
        email: data.email,
        name: data.name,
        avatar: data.avatar || null,
      };
    }

    res.json({
      success: true,
      data: user,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors,
      });
    }

    console.error('Error creating/updating user:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create/update user',
    });
  }
});

/**
 * GET /api/users/:userId
 * Get user by ID
 */
router.get('/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const [users] = await pool.execute<Array<{
      id: string;
      googleId: string;
      email: string;
      name: string;
      avatar: string | null;
    }>>(
      'SELECT * FROM `User` WHERE id = ?',
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    res.json({
      success: true,
      data: users[0],
    });
  } catch (error: any) {
    console.error('Error fetching user:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user',
    });
  }
});

export default router;
