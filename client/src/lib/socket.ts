import { useEffect } from 'react';
import { io } from 'socket.io-client';
import { useAppDispatch, useAppSelector } from '../store';
import { alertReceived, attackUpdate, received, setConnected } from '../store/feedSlice';
import { DEMO_MODE } from './api';
import type { AttackRun, Tx } from './types';

/** Opens one authenticated live connection while the user is signed in. */
export function useLiveSocket() {
  const token = useAppSelector((s) => s.auth.token);
  const dispatch = useAppDispatch();

  useEffect(() => {
    if (!token) return;
    const handle = (event: string, payload: unknown) => {
      if (event === 'tx') dispatch(received(payload as Tx[]));
      else if (event === 'alert') dispatch(alertReceived());
      else if (event === 'attack:update') dispatch(attackUpdate(payload as AttackRun));
    };

    if (DEMO_MODE) {
      // Static build: subscribe to the in-browser simulator instead of Socket.io
      let unsubscribe: (() => void) | undefined;
      let cancelled = false;
      import('../demo/backend').then(({ subscribe }) => {
        if (cancelled) return;
        const off = subscribe(token, handle);
        unsubscribe = () => void off();
        dispatch(setConnected(true));
      });
      return () => {
        cancelled = true;
        unsubscribe?.();
        dispatch(setConnected(false));
      };
    }

    const s = io({ auth: { token } });
    s.on('connect', () => dispatch(setConnected(true)));
    s.on('disconnect', () => dispatch(setConnected(false)));
    s.on('tx', (batch: Tx[]) => handle('tx', batch));
    s.on('alert', (a: unknown) => handle('alert', a));
    s.on('attack:update', (run: AttackRun) => handle('attack:update', run));
    return () => {
      s.disconnect();
    };
  }, [token, dispatch]);
}
