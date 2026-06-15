import { useState, useEffect } from 'react';

/**
 * Game resolution = the overlay window's inner size.
 * In Borderless mode the Dota window fills the monitor, and our Electron
 * overlay window is sized to that same monitor, so window.innerWidth/Height
 * equals the game resolution (at scaleFactor 1, the typical gaming setup).
 */
export function useGameResolution() {
  const [res, setRes] = useState({
    width:  typeof window !== 'undefined' ? window.innerWidth  : 1920,
    height: typeof window !== 'undefined' ? window.innerHeight : 1080,
  });

  useEffect(() => {
    const onResize = () => setRes({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return res;
}
