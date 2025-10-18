import React, { useState, useEffect } from "react";
import { AlertTriangle } from "lucide-react"; // npm install lucide-react

export default function CountdownTimer({ expiryDate, onExpire }) {
  const calculateTimeLeft = () => {
    const now = new Date();
    const difference = new Date(expiryDate) - now;

    if (difference <= 0) {
      return null; // expired
    }

    return {
      days: Math.floor(difference / (1000 * 60 * 60 * 24)),
      hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
      minutes: Math.floor((difference / (1000 * 60)) % 60),
      seconds: Math.floor((difference / 1000) % 60),
    };
  };

  const [timeLeft, setTimeLeft] = useState(calculateTimeLeft());
  const [expired, setExpired] = useState(!timeLeft); // start expired if already passed

  useEffect(() => {
    const timer = setInterval(() => {
      const updated = calculateTimeLeft();
      setTimeLeft(updated);

      if (!updated) {
        setExpired(true);
        if (onExpire) onExpire();
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [expiryDate, onExpire]);

  // 🔒 Expired UI - blocks app
  if (expired) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black/80 z-50">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md text-center">
          <AlertTriangle className="mx-auto text-red-600" size={48} />
          <h1 className="text-2xl font-bold text-red-700 mt-4">
            License Expired
          </h1>
          <p className="mt-2 text-gray-600">
            Your software license has expired. Please renew your license to
            continue using the application.
          </p>
        </div>
      </div>
    );
  }

  // ✅ Only render countdown when valid
  return (
    <div className="text-sm font-medium text-gray-800 bg-gray-100 px-4 py-2 rounded-lg">
      <span className="font-bold mr-1 text-red-600">License Expires In:</span>
      <span>{timeLeft?.days}d</span> :<span>{timeLeft?.hours}h</span> :
      <span>{timeLeft?.minutes}m</span> :<span>{timeLeft?.seconds}s</span>
    </div>
  );
}
