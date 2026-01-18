'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { AuroraBackground } from '@/components/ui/aurora-background';
import Header from '@/components/Header';
import ScheduledEmails from '@/components/ScheduledEmails';
import SentEmails from '@/components/SentEmails';
import ComposeModal from '@/components/ComposeModal';

interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
}

type Tab = 'scheduled' | 'sent';

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('scheduled');
  const [showCompose, setShowCompose] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const userStr = localStorage.getItem('user');
    if (!userStr) {
      router.push('/');
      return;
    }
    setUser(JSON.parse(userStr));
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    router.push('/');
  };

  const handleComposeSuccess = () => {
    setShowCompose(false);
    setRefreshKey((prev) => prev + 1);
  };

  if (!user) {
    return (
      <AuroraBackground>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-gray-500 dark:text-gray-400">Loading...</div>
        </div>
      </AuroraBackground>
    );
  }

  return (
    <AuroraBackground>
      <div className="min-h-screen">
        <Header user={user} onLogout={handleLogout} />
        
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-6 flex justify-between items-center"
        >
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Email Campaigns</h2>
          <button
            onClick={() => setShowCompose(true)}
            className="bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700 transition-colors font-medium shadow-lg hover:shadow-xl"
          >
            Compose New Email
          </button>
        </motion.div>

        {/* Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="border-b border-white/20 dark:border-zinc-700/50 mb-6"
        >
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('scheduled')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'scheduled'
                  ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              Scheduled Emails
            </button>
            <button
              onClick={() => setActiveTab('sent')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'sent'
                  ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              Sent Emails
            </button>
          </nav>
        </motion.div>

        {/* Tab Content */}
        {activeTab === 'scheduled' && (
          <ScheduledEmails userId={user.id} key={refreshKey} />
        )}
        {activeTab === 'sent' && (
          <SentEmails userId={user.id} key={refreshKey} />
        )}
        </main>

        {showCompose && (
          <ComposeModal
            userId={user.id}
            onClose={() => setShowCompose(false)}
            onSuccess={handleComposeSuccess}
          />
        )}
      </div>
    </AuroraBackground>
  );
}


