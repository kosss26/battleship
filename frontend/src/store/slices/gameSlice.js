import { createSlice } from '@reduxjs/toolkit'

const initialState = {
  currentGame: null,
  playerBoard: null,
  enemyBoard: null,
  gameStatus: 'idle', // idle, placement, playing, finished
  currentPlayer: null,
  moves: [],
  loading: false,
  error: null,
}

const gameSlice = createSlice({
  name: 'game',
  initialState,
  reducers: {
    setGame: (state, action) => {
      state.currentGame = action.payload
      state.gameStatus = 'placement'
    },
    setPlayerBoard: (state, action) => {
      state.playerBoard = action.payload
    },
    setEnemyBoard: (state, action) => {
      state.enemyBoard = action.payload
    },
    setGameStatus: (state, action) => {
      state.gameStatus = action.payload
    },
    setCurrentPlayer: (state, action) => {
      state.currentPlayer = action.payload
    },
    addMove: (state, action) => {
      state.moves.push(action.payload)
    },
    setLoading: (state, action) => {
      state.loading = action.payload
    },
    setError: (state, action) => {
      state.error = action.payload
      state.loading = false
    },
    resetGame: (state) => {
      return initialState
    },
  },
})

export const {
  setGame,
  setPlayerBoard,
  setEnemyBoard,
  setGameStatus,
  setCurrentPlayer,
  addMove,
  setLoading,
  setError,
  resetGame,
} = gameSlice.actions
export default gameSlice.reducer
