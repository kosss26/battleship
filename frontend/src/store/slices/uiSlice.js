import { createSlice } from '@reduxjs/toolkit'

const initialState = {
  theme: 'light',
  language: 'ru',
  notifications: true,
  soundEnabled: false,
}

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setTheme: (state, action) => {
      state.theme = action.payload
    },
    setLanguage: (state, action) => {
      state.language = action.payload
    },
    toggleNotifications: (state) => {
      state.notifications = !state.notifications
    },
    toggleSound: (state) => {
      state.soundEnabled = !state.soundEnabled
    },
  },
})

export const { setTheme, setLanguage, toggleNotifications, toggleSound } = uiSlice.actions
export default uiSlice.reducer
