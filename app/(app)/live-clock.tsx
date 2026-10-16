"use client";

import { useEffect, useState } from "react";

export default function LiveClock({ timeZone }: { timeZone: string }) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 1_000);
    return () => clearInterval(timer);
  }, []);

  if (!now) return <div className="clock-time" aria-label="Current time">--:--:--</div>;
  return <time className="clock-time" dateTime={now.toISOString()}>
    {new Intl.DateTimeFormat("en", {
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      timeZone,
    }).format(now)}
  </time>;
}
