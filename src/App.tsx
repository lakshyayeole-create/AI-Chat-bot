import { useRef, useCallback } from 'react'
import { Scene } from './components/canvas/Scene'
import { Overlay } from './components/ui/Overlay'
import './App.css'

export default function App() {
  const triggerCubeAnim = useRef<(() => void) | null>(null)

  const handleRegisterTrigger = useCallback((trigger: () => void) => {
    triggerCubeAnim.current = trigger
  }, [])

  const handleAnimateCube = useCallback(() => {
    triggerCubeAnim.current?.()
  }, [])

  return (
    <div className="app-root">
      <Scene onRegisterTrigger={handleRegisterTrigger} />
      <Overlay onAnimateCube={handleAnimateCube} />
    </div>
  )
}
