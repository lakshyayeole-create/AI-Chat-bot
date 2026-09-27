import { useState, useRef } from 'react';
import Transition, { ModelConfig, TransitionHandle } from './components/Transition';
import Navbar from './components/Navbar';
import IntroOverlay from './components/ui/IntroOverlay';

const ironManConfig: ModelConfig = {
  modelPath: 'assets/iron_man_detailed_web.glb',
  bgImagePath: 'assets/iron_man_background.jpeg',
  rotationX: 0,
  targetHeight: 1.5,
  assemblyAnimation: true,
  autoStartAssembly: false,
  lighting: {
    ambientColor: 0xd5e6ff,
    ambientIntensity: 0.8,
    keyColor: 0xfff7e6,
    keyIntensity: 1.8,
    rimColor: 0x00f0ff,
    rimIntensity: 1.5,
    fillColor: 0xff2244,
    fillIntensity: 0.9,
    topColor: 0xffffff,
    topIntensity: 0.8,
  },
};

const antManConfig: ModelConfig = {
  modelPath: 'assets/marvel_ant-man_helmet.glb',
  bgImagePath: 'assets/ant_man_bg.jpeg',
  targetHeight: 1.5,
  lighting: {
    ambientColor: 0xd5e6ff,
    ambientIntensity: 0.8,
    keyColor: 0xfff7e6,
    keyIntensity: 1.8,
    rimColor: 0xff2244,
    rimIntensity: 1.5,
    fillColor: 0x00f0ff,
    fillIntensity: 0.9,
    topColor: 0xffffff,
    topIntensity: 0.8,
  },
};

export default function App() {
  const transitionRef = useRef<TransitionHandle>(null);
  const [hasEntered, setHasEntered] = useState(false);

  const handleEnter = () => {
    setHasEntered(true);
    // Trigger helmet assembly sequence when user enters
    transitionRef.current?.triggerAssembly();
  };

  return (
    <main style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden' }}>
      {/* Brand Logo & GSAP Intro Screen */}
      {!hasEntered && <IntroOverlay onEnter={handleEnter} />}

      {/* Top Center Compact Floating Navbar */}
      <Navbar />

      {/* 3D Dual-Model Transition Canvas */}
      <Transition
        ref={transitionRef}
        fromModel={ironManConfig}
        toModel={antManConfig}
        enableScroll={true}
      />
    </main>
  );
}



