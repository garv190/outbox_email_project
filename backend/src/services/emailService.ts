import nodemailer from 'nodemailer';
import { config } from '../config';
import pool from '../db/client';
import { randomUUID } from 'crypto';

/**
 * Email service using Ethereal Email for testing
 */

let transporter: nodemailer.Transporter | null = null;

/**
 * Initialize email transporter with Ethereal credentials
 */
export async function initializeEmailService(): Promise<void> {
  try {
    // Always create a test account for Ethereal (it's a testing service)
    const testAccount = await nodemailer.createTestAccount();
    
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });

    console.log('Ethereal Email Test Account Created:');
    console.log('User:', testAccount.user);
    console.log('Pass:', testAccount.pass);
    console.log('Note: Save these credentials to view emails in Ethereal inbox');

    // Verify connection
    await transporter.verify();
    console.log('Email service initialized successfully');
  } catch (error) {
    console.error('Failed to initialize email service:', error);
    throw error;
  }
}

/**
 * Retrieves or creates a sender SMTP account from the database
 * 
 * We store sender accounts in the DB to support multiple senders.
 * For this demo, we use Ethereal (test SMTP), but in production
 * this would manage real SMTP credentials for different clients.
 * 
 * First active sender is used; if none exist, we create an Ethereal account.
 */
async function getSenderAccount(): Promise<{
  email: string;
  password: string;
}> {
  // Query for active sender account - supports rotating senders
  const [senders] = await pool.execute<Array<{
    id: string;
    email: string;
    password: string;
    smtpHost: string;
    smtpPort: number;
    isActive: boolean;
  }>>(
    'SELECT * FROM SenderAccount WHERE isActive = ? LIMIT 1',
    [true]
  );

  if (senders.length > 0) {
    return {
      email: senders[0].email,
      password: senders[0].password,
    };
  }

  // Create a test account using Ethereal
  const testAccount = await nodemailer.createTestAccount();
  const id = randomUUID();
  
  await pool.execute(
    'INSERT INTO SenderAccount (id, email, password, smtpHost, smtpPort, isActive) VALUES (?, ?, ?, ?, ?, ?)',
    [id, testAccount.user, testAccount.pass, 'smtp.ethereal.email', 587, true]
  );

  return {
    email: testAccount.user,
    password: testAccount.pass,
  };
}


export async function sendEmail(
  to: string,
  subject: string,
  body: string
): Promise<{ messageId: string; previewUrl?: string }> {
  if (!transporter) {
    throw new Error('Email service not initialized');
  }

  const info = await transporter.sendMail({
    from: '"ReachInbox Demo" <demo@reachinbox.local>',
    to,
    subject,
    html: body,
    text: body.replace(/<[^>]*>/g, ''),
  });

  const previewUrl = nodemailer.getTestMessageUrl(info);

  console.log('Message ID:', info.messageId);
  console.log('Preview URL:', previewUrl);

  return {
    messageId: info.messageId,
    previewUrl: previewUrl || undefined,
  };
}