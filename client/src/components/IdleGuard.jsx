import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';

// Events that count as "the user is active". Any of them resets the idle countdown.
const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click', 'focus'];

export default function IdleGuard() {
  const { user, logout, idleSeconds } = useAuth();
  const deadlineRef = useRef(0);
  const [remaining, setRemaining] = useState(idleSeconds);

  const resetIdle = useCallback(() => {
    deadlineRef.current = Date.now() + idleSeconds * 1000;
    setRemaining(idleSeconds);
  }, [idleSeconds]);

  useEffect(() => {
    if (!user) return undefined;

    resetIdle();

    const handleActivity = () => resetIdle();
    ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, handleActivity, { passive: true }));

    const tick = setInterval(() => {
      const secs = Math.max(0, Math.ceil((deadlineRef.current - Date.now()) / 1000));
      setRemaining(secs);
      if (secs <= 0) {
        clearInterval(tick);
        logout();
      }
    }, 1000);

    return () => {
      ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, handleActivity));
      clearInterval(tick);
    };
  }, [user, resetIdle, logout]);

  if (!user) return null;

  // Show the warning modal for the last few seconds before auto-logout.
  const warningWindow = Math.max(5, Math.min(10, Math.floor(idleSeconds / 3)));
  const showWarning = remaining <= warningWindow;

  if (!showWarning) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 text-center shadow-2xl">
        <p className="text-xs font-bold uppercase tracking-wider text-amber-600">Still there?</p>
        <h2 className="mt-1 text-2xl font-bold text-gray-900">You will be logged out</h2>
        <p className="mt-2 text-sm text-gray-600">
          For your security, the session ends after {idleSeconds} second{idleSeconds === 1 ? '' : 's'} of inactivity.
        </p>
        <p className="my-4 text-4xl font-extrabold tabular-nums text-gray-900">{remaining}s</p>
        <div className="flex justify-center gap-3">
          <button type="button" onClick={() => { resetIdle(); }} className="btn btn-primary">Stay signed in</button>
          <button type="button" onClick={logout} className="btn border border-gray-300 bg-white text-gray-700">Log out now</button>
        </div>
      </div>
    </div>
  );
}
