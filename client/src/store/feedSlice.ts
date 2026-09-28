import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { AttackRun, Tx } from '../lib/types';

const MAX_ROWS = 200;

interface FeedState {
  items: Tx[];
  buffered: Tx[]; // arrivals while paused
  paused: boolean;
  connected: boolean;
  newAlerts: number; // unseen alert counter for the sidebar badge
  attackRuns: Record<string, AttackRun>;
}

const initialState: FeedState = {
  items: [],
  buffered: [],
  paused: false,
  connected: false,
  newAlerts: 0,
  attackRuns: {},
};

const feedSlice = createSlice({
  name: 'feed',
  initialState,
  reducers: {
    setInitial(state, a: PayloadAction<Tx[]>) {
      state.items = a.payload.slice(0, MAX_ROWS);
      state.buffered = [];
    },
    received(state, a: PayloadAction<Tx[]>) {
      const incoming = [...a.payload].reverse(); // newest first
      if (state.paused) {
        state.buffered = [...incoming, ...state.buffered].slice(0, MAX_ROWS);
      } else {
        state.items = [...incoming, ...state.items].slice(0, MAX_ROWS);
      }
    },
    togglePause(state) {
      state.paused = !state.paused;
      if (!state.paused && state.buffered.length) {
        state.items = [...state.buffered, ...state.items].slice(0, MAX_ROWS);
        state.buffered = [];
      }
    },
    setConnected(state, a: PayloadAction<boolean>) {
      state.connected = a.payload;
    },
    alertReceived(state) {
      state.newAlerts += 1;
    },
    clearAlertBadge(state) {
      state.newAlerts = 0;
    },
    attackUpdate(state, a: PayloadAction<AttackRun>) {
      state.attackRuns[a.payload._id] = a.payload;
    },
  },
});

export const { setInitial, received, togglePause, setConnected, alertReceived, clearAlertBadge, attackUpdate } =
  feedSlice.actions;
export default feedSlice.reducer;
