"use client";
import { useState } from "react";

const musicUrl = "https://www.youtube-nocookie.com/embed/SDTZ7iX4vTQ?autoplay=1&start=63&controls=0&playsinline=1&rel=0";

const pages = [
  "https://www.wikipedia.org/wiki/Special:Random",
  "https://www.nasa.gov/",
  "https://www.mozilla.org/",
  "https://www.openstreetmap.org/",
  "https://www.gutenberg.org/",
  "https://www.metmuseum.org/",
  "https://www.loc.gov/",
  "https://www.nationalgeographic.com/",
  "https://www.britannica.com/",
  "https://www.noaa.gov/"
];

export default function Home() {
  const [started, setStarted] = useState(false);

  function startExperience() {
    if (started) return;
    setStarted(true);

    const shuffled = [...pages].sort(() => Math.random() - 0.5);
    const opened: Window[] = [];

    shuffled.forEach((url, index) => {
      const popup = window.open(
        url,
        `sentinel_page_${index}`,
        "popup=yes,width=900,height=650,resizable=yes"
      );
      if (popup) opened.push(popup);
    });

    window.setTimeout(() => {
      opened.forEach((popup) => {
        try {
          if (!popup.closed) popup.close();
        } catch {
          // The browser may prevent closing a window it no longer controls.
        }
      });
    }, 20_000);
  }

  return (
    <main className="page" onClick={startExperience}>
      <img className="chart" src="/hypergamy.svg" alt="Hypergamy chart" draggable={false} />
      {!started ? (
        <div className="click-layer" aria-hidden="true" />
      ) : (
        <div className="audio-player" aria-hidden="true">
          <iframe
            title="Pumped Up Kicks"
            src={musicUrl}
            allow="autoplay; encrypted-media; picture-in-picture"
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
      )}
    </main>
  );
}
