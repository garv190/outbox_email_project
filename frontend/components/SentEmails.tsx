'use client';

import { useEffect, useState } from 'react';

interface Dispatch {
  id: string;
  recipientEmail: string;
  subject: string;
  sentTime: string | null;
  status: string;
  errorMessage?: string;
  campaign: {
    id: string;
    subject: string;
  };
}

interface SentEmailsProps {
  userId: string;
}

export default function SentEmails({ userId }: SentEmailsProps) {
  const [dispatches, setDispatches] = useState<Dispatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSent();
  }, [userId]);

  const fetchSent = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/dispatches/sent?userId=${userId}`
      );
      const data = await response.json();
      if (data.success) {
        setDispatches(data.data);
      } else {
        setError('Failed to fetch sent emails');
      }
    } catch (err) {
      setError('Failed to fetch sent emails');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'SENT':
        return 'bg-green-100 text-green-800';
      case 'FAILED':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center">
        <div className="text-gray-500">Loading sent emails...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center">
        <div className="text-red-500">{error}</div>
      </div>
    );
  }

  if (dispatches.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center">
        <div className="text-gray-500">No sent emails yet.</div>
        <p className="text-sm text-gray-400 mt-2">
          Sent emails will appear here once campaigns are processed.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Email
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Subject
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Sent Time
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {dispatches.map((dispatch) => (
              <tr key={dispatch.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {dispatch.recipientEmail}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {dispatch.subject}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {dispatch.sentTime
                    ? new Date(dispatch.sentTime).toLocaleString()
                    : '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(
                      dispatch.status
                    )}`}
                  >
                    {dispatch.status}
                  </span>
                  {dispatch.errorMessage && (
                    <div className="text-xs text-red-600 mt-1">
                      {dispatch.errorMessage}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}


