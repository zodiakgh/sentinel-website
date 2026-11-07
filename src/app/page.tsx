"use client";
import { useState } from "react";

const musicUrl = "https://www.youtube-nocookie.com/embed/SDTZ7iX4vTQ?autoplay=1&controls=0&playsinline=1&rel=0";
const popupUrl = "https://www.youtube.com/watch?v=SDTZ7iX4vTQ";

export default function Home() {
  const [started, setStarted] = useState(false);

  function startExperience() {
    if (started) return;
    window.open(popupUrl, "sentinel_music", "popup=yes,width=900,height=650,resizable=yes");
    setStarted(true);
  }

  return (
    <main className="page" onClick={startExperience}>
      <img className="chart" src="/hypergamy.svg" alt="Hypergamy chart" draggable={false} />
      {!started ? (
        <div className="click-layer" aria-hidden="true" />
      ) : (
        <div className="audio-player" aria-hidden="true">
          <iframe title="Pumped Up Kicks" src={musicUrl}
            allow="autoplay; encrypted-media; picture-in-picture"
            referrerPolicy="strict-origin-when-cross-origin" />
        </div>
      )}
    </main>
  );
}
