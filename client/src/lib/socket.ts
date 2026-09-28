import { useEffect } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useAppDispatch, useAppSelector } from '../store';
import { alertReceived, attackUpdate, received, setConnected } from '../store/feedSlice';
import type { AttackRun, Tx } from './types';

let socket: Socket | null = null;
export const getSocket = () => socket;

/** Opens one authenticated Socket.io connection while the user is logged in. */
export function useLiveSocket() {
  const token = useAppSelector((s) => s.auth.token);
  const dispatch = useAppDispatch();

  useEffect(() => {
    if (!token) return;
    const s = io({ auth: { token } });
    socket = s;
    s.on('connect', () => dispatch(setConnected(true)));
    s.on('disconnect', () => dispatch(setConnected(false)));
    s.on('tx', (batch: Tx[]) => dispatch(received(batch)));
    s.on('alert', () => dispatch(alertReceived()));
    s.on('attack:update', (run: AttackRun) => dispatch(attackUpdate(run)));
    return () => {
      s.disconnect();
      socket = null;
    };
  }, [token, dispatch]);
}
