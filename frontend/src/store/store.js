import { configureStore } from '@reduxjs/toolkit'
import userReducer from './slices/userSlice.js'
import gameReducer from './slices/gameSlice.js'
import uiReducer from './slices/uiSlice.js'

export const store = configureStore({
  reducer: {
    user: userReducer,
    game: gameReducer,
    ui: uiReducer,
  },
})
