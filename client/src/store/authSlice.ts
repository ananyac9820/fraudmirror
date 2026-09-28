import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { api, TOKEN_KEY, USER_KEY } from '../lib/api';
import type { User } from '../lib/types';

interface AuthState {
  token: string | null;
  user: User | null;
  status: 'idle' | 'loading' | 'error';
  error: string | null;
}

const readUser = (): User | null => {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || 'null');
  } catch {
    return null;
  }
};

const initialState: AuthState = {
  token: localStorage.getItem(TOKEN_KEY),
  user: readUser(),
  status: 'idle',
  error: null,
};

export const login = createAsyncThunk(
  'auth/login',
  async (creds: { email: string; password: string }, { rejectWithValue }) => {
    try {
      return await api<{ token: string; user: User }>('/auth/login', { method: 'POST', body: creds });
    } catch (e) {
      return rejectWithValue((e as Error).message);
    }
  }
);

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    logout(state) {
      state.token = null;
      state.user = null;
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    },
  },
  extraReducers: (b) => {
    b.addCase(login.pending, (s) => {
      s.status = 'loading';
      s.error = null;
    })
      .addCase(login.fulfilled, (s, a) => {
        s.status = 'idle';
        s.token = a.payload.token;
        s.user = a.payload.user;
        localStorage.setItem(TOKEN_KEY, a.payload.token);
        localStorage.setItem(USER_KEY, JSON.stringify(a.payload.user));
      })
      .addCase(login.rejected, (s, a) => {
        s.status = 'error';
        s.error = (a.payload as string) || 'Login failed';
      });
  },
});

export const { logout } = authSlice.actions;
export default authSlice.reducer;
