import { request } from './socket.js'
import { useStore } from '../store/app.js'
import { haptic } from './telegram.js'

async function run(event, data) {
  const res = await request(event, data)
  if (res.error) {
    haptic.error()
    useStore.getState().toast(res.error, 'error')
  }
  return res
}

export const startAi = (difficulty) => run('ai:start', { difficulty })
export const startCampaign = (level) => run('ai:start', { level })
export const joinQueue = () => run('mm:join')
export const leaveQueue = () => request('mm:leave')
