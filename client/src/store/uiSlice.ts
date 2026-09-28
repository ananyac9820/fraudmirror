import { createSlice } from '@reduxjs/toolkit';
import type { Mode } from '../lib/types';

const saved = (localStorage.getItem('fm_mode') as Mode) || 'defender';

const uiSlice = createSlice({
  name: 'ui',
  initialState: { mode: saved as Mode, sweepKey: 0 },
  reducers: {
    toggleMode(state) {
      state.mode = state.mode === 'defender' ? 'attacker' : 'defender';
      state.sweepKey += 1;
      localStorage.setItem('fm_mode', state.mode);
    },
  },
});

export const { toggleMode } = uiSlice.actions;
export default uiSlice.reducer;
