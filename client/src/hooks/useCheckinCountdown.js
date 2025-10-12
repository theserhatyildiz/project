import { useEffect, useState } from "react";

export function useCheckinCountdown({ macroCoachStartedAt, lastCheckInAt, macros }) {
  const [daysLeft, setDaysLeft] = useState(null);
  const [canCheckInNow, setCanCheckInNow] = useState(false);

  const toLocalMidnight = (dLike) => {
    const d = new Date(dLike);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
  };

  const computeEligibility = (markerLike) => {
    if (!markerLike) return { eligibleAt: null, daysLeft: null, canCheck: false };
    const base = toLocalMidnight(markerLike);
    const eligibleAt = new Date(base.getFullYear(), base.getMonth(), base.getDate() + 7, 0, 1, 0, 0);
    const now = new Date();
    const msDay = 24 * 60 * 60 * 1000;
    const raw = Math.ceil((eligibleAt - now) / msDay);
    const daysLeft = Math.max(0, raw);
    const canCheck = now >= eligibleAt;
    return { eligibleAt, daysLeft, canCheck };
  };

  useEffect(() => {
    const refreshCountdown = () => {
      const isInitialSnapshot =
        !!macros &&
        (macros.reason === "initial" || macros.reasonCode === "initial" || macros.isInitial === true);

      if (isInitialSnapshot && !macroCoachStartedAt && !lastCheckInAt) {
        setDaysLeft(7);
        setCanCheckInNow(false);
        return;
      }

      const marker = lastCheckInAt || macroCoachStartedAt;
      const { daysLeft, canCheck } = computeEligibility(marker);
      setDaysLeft(daysLeft);
      setCanCheckInNow(canCheck);
    };

    refreshCountdown();

    const interval = setInterval(refreshCountdown, 60 * 60 * 1000); // every hour
    return () => clearInterval(interval);
  }, [macroCoachStartedAt, lastCheckInAt, macros]);

  return { daysLeft, canCheckInNow };
}