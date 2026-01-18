"use client";

import { motion } from "framer-motion";

export function EmailDeliveryChart() {
  // Sample data for email delivery over time
  const deliveryData = [
    { day: "Mon", sent: 120, delivered: 115, opened: 45 },
    { day: "Tue", sent: 180, delivered: 175, opened: 72 },
    { day: "Wed", sent: 150, delivered: 148, opened: 60 },
    { day: "Thu", sent: 200, delivered: 195, opened: 85 },
    { day: "Fri", sent: 170, delivered: 168, opened: 68 },
    { day: "Sat", sent: 90, delivered: 88, opened: 35 },
    { day: "Sun", sent: 110, delivered: 108, opened: 42 },
  ];

  const maxValue = Math.max(...deliveryData.map(d => d.sent));

  return (
    <div className="w-full h-full p-6 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 rounded-xl">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-1">
          Email Delivery Analytics
        </h3>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Weekly performance overview
        </p>
      </div>

      <div className="flex items-end justify-between h-48 gap-2">
        {deliveryData.map((data, index) => (
          <motion.div
            key={data.day}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "100%", opacity: 1 }}
            transition={{
              duration: 0.5,
              delay: index * 0.1,
              ease: "easeOut",
            }}
            className="flex-1 flex flex-col items-center gap-1"
          >
            <div className="w-full flex flex-col items-center justify-end gap-1 h-full">
              {/* Opened emails (green) */}
              <motion.div
                initial={{ height: 0 }}
                animate={{
                  height: `${(data.opened / maxValue) * 100}%`,
                }}
                transition={{
                  duration: 0.5,
                  delay: index * 0.1 + 0.3,
                  ease: "easeOut",
                }}
                className="w-full bg-gradient-to-t from-green-500 to-green-400 rounded-t"
                style={{ minHeight: "4px" }}
              />
              {/* Delivered emails (blue) */}
              <motion.div
                initial={{ height: 0 }}
                animate={{
                  height: `${((data.delivered - data.opened) / maxValue) * 100}%`,
                }}
                transition={{
                  duration: 0.5,
                  delay: index * 0.1 + 0.2,
                  ease: "easeOut",
                }}
                className="w-full bg-gradient-to-t from-blue-500 to-blue-400"
              />
              {/* Sent emails (purple) */}
              <motion.div
                initial={{ height: 0 }}
                animate={{
                  height: `${((data.sent - data.delivered) / maxValue) * 100}%`,
                }}
                transition={{
                  duration: 0.5,
                  delay: index * 0.1 + 0.1,
                  ease: "easeOut",
                }}
                className="w-full bg-gradient-to-t from-purple-500 to-purple-400 rounded-b"
                style={{ minHeight: "4px" }}
              />
            </div>
            <div className="text-xs font-medium text-slate-700 dark:text-slate-300 mt-2">
              {data.day}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {data.sent}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 mt-6 pt-4 border-t border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-purple-500"></div>
          <span className="text-xs text-slate-600 dark:text-slate-400">Sent</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-blue-500"></div>
          <span className="text-xs text-slate-600 dark:text-slate-400">Delivered</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-green-500"></div>
          <span className="text-xs text-slate-600 dark:text-slate-400">Opened</span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mt-4">
        <div className="text-center">
          <div className="text-2xl font-bold text-slate-800 dark:text-slate-200">
            {deliveryData.reduce((sum, d) => sum + d.sent, 0)}
          </div>
          <div className="text-xs text-slate-600 dark:text-slate-400">Total Sent</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {Math.round(
              (deliveryData.reduce((sum, d) => sum + d.delivered, 0) /
                deliveryData.reduce((sum, d) => sum + d.sent, 0)) *
                100
            )}%
          </div>
          <div className="text-xs text-slate-600 dark:text-slate-400">Delivery Rate</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">
            {Math.round(
              (deliveryData.reduce((sum, d) => sum + d.opened, 0) /
                deliveryData.reduce((sum, d) => sum + d.delivered, 0)) *
                100
            )}%
          </div>
          <div className="text-xs text-slate-600 dark:text-slate-400">Open Rate</div>
        </div>
      </div>
    </div>
  );
}

