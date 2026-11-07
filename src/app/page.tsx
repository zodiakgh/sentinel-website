"use client";

import { useEffect, useRef, useState } from "react";

const rickroll =
  "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1&mute=0&controls=0&playsinline=1&rel=0";
const pumpedUpKicks =
  "https://www.youtube-nocookie.com/embed/SDTZ7iX4vTQ?autoplay=1&mute=0&controls=0&playsinline=1&rel=0";

type FakeWindow = {
  id: number;
  x: number;
  y: number;
  tilt: number;
  width: number;
};

export default function Home() {
  const [started, setStarted] = useState(false);
  const [windows, setWindows] = useState<FakeWindow[]>([]);
  const [generated, setGenerated] = useState(0);
  const nextId = useRef(0);

  useEffect(() => {
    if (!started) return;

    const spawn = () => {
      const batch: FakeWindow[] = Array.from({ length: 2 }, () => {
        const id = nextId.current++;
        const width = 245 + Math.random() * 105;

        return {
          id,
          width,
          x: Math.random() * Math.max(8, window.innerWidth - width - 8),
          y: Math.random() * Math.max(8, window.innerHeight - 190),
          tilt: Math.random() * 5 - 2.5
        };
      });

      setWindows((current) => [...current, ...batch].slice(-28));
      setGenerated((current) => current + batch.length);
    };

    spawn();
    const interval = window.setInterval(spawn, 650);
    return () => window.clearInterval(interval);
  }, [started]);

  const unleash = () => {
    if (!started) setStarted(true);
  };

  return (
    <main className="page" onClick={unleash}>
      <img
        className="chart"
        src="/hypergamy.svg"
        alt="Hypergamy chart"
        draggable={false}
      />

      {!started ? (
        <div className="click-layer" aria-hidden="true" />
      ) : (
        <>
          <div className="chaos-label" aria-live="polite">
            YOU CLICKED. {generated.toLocaleString("en-US")} WINDOWS GENERATED.
          </div>

          <div className="audio-players" aria-hidden="true">
            <iframe
              title="Never Gonna Give You Up"
              src={rickroll}
              allow="autoplay; encrypted-media; picture-in-picture"
              referrerPolicy="strict-origin-when-cross-origin"
            />
            <iframe
              title="Pumped Up Kicks"
              src={pumpedUpKicks}
              allow="autoplay; encrypted-media; picture-in-picture"
              referrerPolicy="strict-origin-when-cross-origin"
            />
          </div>

          {windows.map((item, index) => (
            <section
              className="fake-window"
              key={item.id}
              style={{
                left: `clamp(0px, ${item.x}px, calc(100vw - 230px))`,
                top: `clamp(0px, ${item.y}px, calc(100vh - 155px))`,
                width: item.width,
                transform: `rotate(${item.tilt}deg)`,
                zIndex: 10 + index
              }}
              aria-label="Rickroll popup"
            >
              <header className="window-bar">
                <span>sentinel.exe</span>
                <span className="window-controls">— □ ×</span>
              </header>
              <div className="window-body">
                <div className="rick-icon">♪</div>
                <strong>NEVER GONNA GIVE YOU UP</strong>
                <span>Something went wrong. Or did it?</span>
                <div className="fake-progress">
                  <span />
                </div>
                <small>Loading your surprise…</small>
              </div>
            </section>
          ))}
        </>
      )}
    </main>
  );
}
