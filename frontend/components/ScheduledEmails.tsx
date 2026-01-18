'use client';

import { useEffect, useState } from 'react';

interface Dispatch {
  id: string;
  recipientEmail: string;
  subject: string;
  scheduledTime: string;
  status: string;
  campaign: {
    id: string;
    subject: string;
  };
}

interface ScheduledEmailsProps {
  userId: string;
}

export default function ScheduledEmails({ userId }: ScheduledEmailsProps) {
  const [dispatches, setDispatches] = useState<Dispatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchScheduled();
  }, [userId]);

  const fetchScheduled = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/dispatches/scheduled?userId=${userId}`
      );
      const data = await response.json();
      if (data.success) {
        setDispatches(data.data);
      } else {
        setError('Failed to fetch scheduled emails');
      }
    } catch (err) {
      setError('Failed to fetch scheduled emails');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'SCHEDULED':
        return 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300';
      case 'PENDING':
        return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300';
      case 'RATE_LIMITED':
        return 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300';
      default:
        return 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300';
    }
  };

  if (loading) {
    return (
      <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md rounded-lg shadow-xl p-8 text-center border border-white/20">
        <div className="text-gray-500 dark:text-gray-400">Loading scheduled emails...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md rounded-lg shadow-xl p-8 text-center border border-white/20">
        <div className="text-red-500 dark:text-red-400">{error}</div>
      </div>
    );
  }

  if (dispatches.length === 0) {
    return (
      <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md rounded-lg shadow-xl p-8 text-center border border-white/20">
        <div className="text-gray-500 dark:text-gray-400">No scheduled emails yet.</div>
        <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
          Create a new campaign to schedule emails.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md rounded-lg shadow-xl overflow-hidden border border-white/20">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-zinc-700">
          <thead className="bg-gray-50/50 dark:bg-zinc-800/50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                Email
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                Subject
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                Scheduled Time
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="bg-white/50 dark:bg-zinc-900/50 divide-y divide-gray-200 dark:divide-zinc-700">
            {dispatches.map((dispatch) => (
              <tr key={dispatch.id} className="hover:bg-white/70 dark:hover:bg-zinc-800/50 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                  {dispatch.recipientEmail}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                  {dispatch.subject}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                  {new Date(dispatch.scheduledTime).toLocaleString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(
                      dispatch.status
                    )}`}
                  >
                    {dispatch.status.replace('_', ' ')}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
