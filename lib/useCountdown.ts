"use client";

import { useEffect, useState } from "react";
import { remainingSeconds } from "./time";

/**
 * Compte à rebours basé sur la valeur du serveur (`secondsLeft`) reçue à `receivedAt`.
 * `onZero` est appelé une fois quand le compteur atteint 0.
 */
export function useCountdown(secondsLeft: number, receivedAt: number, onZero?: () => void): number {
  const [left, setLeft] = useState(() => remainingSeconds(secondsLeft, receivedAt));

  useEffect(() => {
    setLeft(remainingSeconds(secondsLeft, receivedAt));
    let fired = false;
    const id = setInterval(() => {
      const l = remainingSeconds(secondsLeft, receivedAt);
      setLeft(l);
      if (l === 0 && !fired) {
        fired = true;
        onZero?.();
      }
    }, 500);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft, receivedAt]);

  return left;
}
