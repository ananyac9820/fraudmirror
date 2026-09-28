import { createSlice } from '@reduxjs/toolkit';
import type { Mode } from '../lib/types';

const saved = (localStorage.getItem('fm_mode') as Mode) || 'defender';

const uiSlice = createSlice({
  name: 'ui',
  initialState: { mode: saved as Mode },
  reducers: {
    setMode(state, a: { payload: Mode }) {
      state.mode = a.payload;
      localStorage.setItem('fm_mode', state.mode);
    },
  },
});

export const { setMode } = uiSlice.actions;
export default uiSlice.reducer;
