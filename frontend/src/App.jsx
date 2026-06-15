import { useWebSocket }       from './hooks/useWebSocket';
import { usePauseFreeze }      from './hooks/usePauseFreeze';
import { useGameResolution }   from './hooks/useGameResolution';
import { useDraggable }        from './hooks/useDraggable';
import { useOverlayStore }     from './store/overlayStore';
import { getMeasurements }     from './overlay/measurements';
import TopBarButtons                         from './components/TopBarButtons';
import RoshanPanel, { RoshanAegisBlock, GlyphBlock } from './components/RoshanPanel';
import TimerPanel                            from './components/TimerPanel';
import EnemyPanel              from './components/EnemyPanel';
import StatusBar               from './components/StatusBar';
import './App.css';

const isElectron = navigator.userAgent.toLowerCase().includes('electron');

function OverlayMode({ m }) {
  const inGame = useOverlayStore(s => s.inGame);
  const rg   = m.roshanGlyph;
  const cell = Math.round(rg.size / 2);

  // Default layout matches DotaCoach: Roshan/Aegis top, Glyph below it.
  const roshan = useDraggable('roshan', { x: rg.xPos, y: rg.yPos });
  const glyph  = useDraggable('glyph',  { x: rg.xPos, y: rg.yPos + cell });

  const anyReposition = roshan.repositioning || glyph.repositioning;

  const dragBox = (d) => ({
    position:'absolute', left:d.pos.x, top:d.pos.y, pointerEvents:'all',
    outline: d.repositioning ? '2px dashed #38bdf8' : 'none',
    cursor: d.repositioning ? 'grabbing' : 'default',
  });

  return (
    <div style={{ position:'fixed', inset:0, background:'transparent', pointerEvents:'none', overflow:'hidden' }}>
      {/* BB + Ult buttons under enemy portraits (only in-game) */}
      <TopBarButtons measurements={m} />

      {/* Roshan / Glyph — only in-game */}
      {inGame && (
        <>
          <div {...roshan.dragProps} style={dragBox(roshan)}>
            <RoshanAegisBlock cell={cell} />
          </div>
          <div {...glyph.dragProps} style={dragBox(glyph)}>
            <GlyphBlock cell={cell} />
          </div>
        </>
      )}

      {anyReposition && (
        <div style={{
          position:'absolute', top:8, left:'50%', transform:'translateX(-50%)',
          background:'rgba(2,6,23,.9)', color:'#38bdf8', padding:'6px 14px',
          borderRadius:8, fontSize:13, fontWeight:600, pointerEvents:'none',
        }}>
          Repositioning — release to save
        </div>
      )}
    </div>
  );
}

export default function App() {
  useWebSocket();
  usePauseFreeze();
  const { width, height } = useGameResolution();
  const m = getMeasurements(width, height);

  if (!isElectron) {
    // Browser dashboard (development without the game)
    return (
      <div style={{ display:'flex', flexDirection:'column', height:'100vh', background:'#090e17' }}>
        <StatusBar />
        <div style={{ flex:1, display:'grid', gridTemplateColumns:'1fr 240px', gap:10, padding:12, overflow:'auto' }}>
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            <EnemyPanel />
            <TimerPanel />
          </div>
          <div style={{ display:'flex', justifyContent:'center', paddingTop:20 }}>
            <RoshanPanel size={134} />
          </div>
        </div>
      </div>
    );
  }

  return <OverlayMode m={m} />;
}
