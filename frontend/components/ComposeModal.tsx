'use client';

import { useState } from 'react';

interface ComposeModalProps {
  userId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ComposeModal({
  userId,
  onClose,
  onSuccess,
}: ComposeModalProps) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [emails, setEmails] = useState<string[]>([]);
  const [startTime, setStartTime] = useState('');
  const [delayBetweenMs, setDelayBetweenMs] = useState(2000);
  const [hourlyLimit, setHourlyLimit] = useState(50);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setError(null); // Clear previous errors

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      // Parse CSV or text file for email addresses
      // Better regex to match proper email format
      const emailRegex = /[\w\.-]+@[\w\.-]+\.[\w\.-]+/g;
      const foundEmails = text.match(emailRegex) || [];
      const uniqueEmails = Array.from(new Set(foundEmails));
      
      // Validate emails with proper format
      const validEmails = uniqueEmails.filter((email) => 
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
      );
      
      setEmails(validEmails);
      
      if (validEmails.length === 0) {
        setError('No valid email addresses found in the file. Please check the file format.');
      } else if (validEmails.length !== uniqueEmails.length) {
        const invalidCount = uniqueEmails.length - validEmails.length;
        setError(`${invalidCount} invalid email(s) were filtered out. ${validEmails.length} valid email(s) found.`);
      }
    };
    reader.onerror = () => {
      setError('Failed to read file. Please try again.');
      setEmails([]);
    };
    reader.readAsText(selectedFile);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!subject || !body || emails.length === 0) {
      setError('Please fill in all fields and upload a file with email addresses');
      return;
    }

    if (!startTime) {
      setError('Please select a start time');
      return;
    }

    // Validate start time is not in the past
    const selectedTime = new Date(startTime);
    const now = new Date();
    if (selectedTime < now) {
      setError('Start time cannot be in the past');
      return;
    }

    // Validate at least one valid email
    if (emails.length === 0) {
      setError('Please upload a file containing at least one valid email address');
      return;
    }

    try {
      setLoading(true);

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/campaigns`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId,
            subject,
            body,
            recipientEmails: emails,
            startTime: new Date(startTime).toISOString(),
            delayBetweenMs,
            hourlyLimit,
          }),
        }
      );

      const data = await response.json();

      if (data.success) {
        onSuccess();
      } else {
        setError(data.error || 'Failed to schedule emails');
      }
    } catch (err) {
      setError('Failed to schedule emails. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">
              Compose New Email
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl"
            >
              ×
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Subject
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-900"
                placeholder="Enter email subject"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Body
              </label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={6}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-900"
                placeholder="Enter email body"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Recipient Email Addresses
              </label>
              <p className="text-xs text-gray-500 mb-2">
                Upload a CSV or text file containing email addresses (one per line or comma-separated)
              </p>
              <input
                type="file"
                accept=".csv,.txt"
                onChange={handleFileChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                required
              />
              {emails.length > 0 && (
                <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
                  <p className="text-sm font-medium text-blue-900 mb-2">
                    ✓ Found {emails.length} recipient email(s):
                  </p>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {emails.map((email, index) => (
                      <div
                        key={index}
                        className="text-sm text-blue-700 px-2 py-1 bg-white rounded border border-blue-200 flex items-center justify-between"
                      >
                        <span>{email}</span>
                        <button
                          type="button"
                          onClick={() => {
                            setEmails(emails.filter((_, i) => i !== index));
                          }}
                          className="ml-2 text-red-600 hover:text-red-800 text-xs"
                          title="Remove email"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-blue-600 mt-2">
                    These are the recipients who will receive the email campaign.
                  </p>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Start Time
              </label>
              <input
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Delay Between Emails (ms)
                </label>
                <input
                  type="number"
                  value={delayBetweenMs}
                  onChange={(e) => setDelayBetweenMs(parseInt(e.target.value) || 0)}
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-900"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Hourly Limit
                </label>
                <input
                  type="number"
                  value={hourlyLimit}
                  onChange={(e) => setHourlyLimit(parseInt(e.target.value) || 1)}
                  min="1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-900"
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                {error}
              </div>
            )}

            <div className="flex justify-end space-x-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Scheduling...' : 'Schedule'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}


