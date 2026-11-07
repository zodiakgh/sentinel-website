"use client";

import { useEffect, useRef, useState } from "react";

const rickroll = "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1&mute=0&controls=1&playsinline=1";
const pumped = "https://www.youtube-nocookie.com/embed/SDTZ7iX4vTQ?autoplay=1&mute=0&controls=0&playsinline=1";

type Popup = { id: number; x: number; y: number; tilt: number; size: number };

export default function Home() {
  const [started, setStarted] = useState(false);
  const [popups, setPopups] = useState<Popup[]>([]);
  const [count, setCount] = useState(0);
  const nextId = useRef(0);

  useEffect(() => {
    if (!started) return;
    const add = () => {
      setPopups((current) => {
        const batch = Array.from({ length: 3 }, () => {
          const id = nextId.current++;
          return {
            id,
            x: Math.random() * Math.max(8, window.innerWidth - 330),
            y: Math.random() * Math.max(8, window.innerHeight - 230),
            tilt: Math.random() * 5 - 2.5,
            size: 230 + Math.random() * 100,
          };
        });
        return [...current, ...batch].slice(-18);
      });
      setCount((n) => n + 3);
    };
    add();
    const interval = window.setInterval(add, 950);
    return () => window.clearInterval(interval);
  }, [started]);

  function unleash() {
    if (started) return;
    setStarted(true);
    try {
      const audio = new Audio("/chaos.mp3");
      audio.loop = true;
      audio.volume = 0.45;
      void audio.play().catch(() => {});
    } catch {}
  }

  return (
    <main className="page" onClick={unleash}>
      <img className="chart" src="/hypergamy.svg" alt="Hypergamy chart" draggable={false} />
      {!started ? (
        <button className="invisible-trigger" aria-label="Start" onClick={unleash} />
      ) : (
        <>
          <div className="chaos-label">YOU CLICKED. {count} WINDOWS GENERATED.</div>
          <div className="player-stack" aria-hidden="true">
            <iframe title="Never Gonna Give You Up" src={rickroll} allow="autoplay; encrypted-media; picture-in-picture" />
            <iframe title="Pumped Up Kicks" src={pumped} allow="autoplay; encrypted-media; picture-in-picture" />
          </div>
          {popups.map((popup, index) => (
            <section
              className="fake-window"
              key={popup.id}
              style={{
                left: `clamp(0px, ${popup.x}px, calc(100vw - 290px))`,
                top: `clamp(0px, ${popup.y}px, calc(100vh - 170px))`,
                width: popup.size,
                transform: `rotate(${popup.tilt}deg)`,
                zIndex: 10 + index,
              }}
              onClick={(event) => event.stopPropagation()}
            >
              <header className="window-bar">
                <span>rickroll.exe</span>
                <span className="window-controls">— □ ×</span>
              </header>
              <div className="window-body">
                <div className="rick-icon">♪</div>
                <strong>NEVER GONNA GIVE YOU UP</strong>
                <span>You've been redirected.</span>
                <button onClick={() => setPopups((items) => items.filter((item) => item.id !== popup.id))}>Close</button>
              </div>
            </section>
          ))}
          <button className="stop-chaos" onClick={(event) => { event.stopPropagation(); setStarted(false); setPopups([]); setCount(0); }}>
            STOP THE CHAOS
          </button>
        </>
      )}
    </main>
  );
}
