"use client";

import { useEffect, useRef, useState } from "react";

type Point = { x: number; y: number };

const initialEvents = [
  "CORE INITIALIZED",
  "LOCAL SESSION READY",
  "AWAITING USER INPUT",
];

export default function Home() {
  const [running, setRunning] = useState(false);
  const [sequence, setSequence] = useState(false);
  const [glitch, setGlitch] = useState(false);
  const [gravity, setGravity] = useState(false);
  const [cursorEcho, setCursorEcho] = useState(false);
  const [pointer, setPointer] = useState<Point>({ x: -100, y: -100 });
  const [events, setEvents] = useState(initialEvents);
  const sequenceTimer = useRef<ReturnType<typeof window.setTimeout> | null>(null);

  const addEvent = (message: string) => {
    setEvents((current) => [message, ...current].slice(0, 5));
  };

  useEffect(() => {
    return () => {
      if (sequenceTimer.current) window.clearTimeout(sequenceTimer.current);
    };
  }, []);

  const startSequence = () => {
    if (sequenceTimer.current) window.clearTimeout(sequenceTimer.current);
    setRunning(true);
    setSequence(true);
    addEvent("VISUAL SEQUENCE STARTED");
    sequenceTimer.current = window.setTimeout(() => {
      setSequence(false);
      addEvent("SEQUENCE COMPLETE");
    }, 4200);
  };

  const stopExperience = () => {
    if (sequenceTimer.current) window.clearTimeout(sequenceTimer.current);
    setRunning(false);
    setSequence(false);
    setGlitch(false);
    setGravity(false);
    setCursorEcho(false);
    setPointer({ x: -100, y: -100 });
    addEvent("EXPERIMENT RESET BY USER");
  };

  const toggle = (
    name: string,
    value: boolean,
    setter: (next: boolean) => void,
  ) => {
    setter(!value);
    addEvent(`${name} ${value ? "DISABLED" : "ENABLED"}`);
  };

  return (
    <main
      className={`site-shell ${running ? "is-running" : ""} ${sequence ? "sequence-on" : ""} ${glitch ? "glitch-on" : ""} ${gravity ? "gravity-on" : ""}`}
      onPointerMove={(event) => {
        if (cursorEcho) setPointer({ x: event.clientX, y: event.clientY });
      }}
    >
      <div className="noise-layer" aria-hidden="true" />
      <div className="scanlines" aria-hidden="true" />
      {cursorEcho && (
        <div
          className="cursor-echo"
          style={{ transform: `translate3d(${pointer.x}px, ${pointer.y}px, 0)` }}
          aria-hidden="true"
        />
      )}

      <header className="topbar">
        <a className="brand" href="#top" aria-label="Sentinel home">
          <span className="brand-mark">S</span>
          <span>SENTINEL<span className="brand-dot">.</span></span>
        </a>
        <nav className="top-nav" aria-label="Main navigation">
          <a href="#experiment">EXPERIMENT</a>
          <a href="#controls">CONTROLS</a>
          <a href="#about">ABOUT</a>
        </nav>
        <div className="top-status"><span className="status-light" /> SYSTEM ONLINE</div>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <div className="eyebrow"><span className="eyebrow-line" /> AN INTERACTIVE WEB EXPERIMENT / 001</div>
          <h1>
            THE WEB
            <span className="title-outline">HAS A</span>
            <span className="title-last">MIND OF ITS OWN<span className="title-period">.</span></span>
          </h1>
          <p className="hero-description">
            A little controlled chaos, built for the browser. Start the sequence,
            change the signals, and see what happens — all inside this page.
          </p>
          <div className="hero-actions">
            <button className="primary-button" onClick={startSequence}>
              <span className="button-icon">↗</span> {sequence ? "SEQUENCE RUNNING" : "RUN THE SEQUENCE"}
            </button>
            <a className="text-link" href="#experiment">EXPLORE THE CONTROLS <span>↓</span></a>
          </div>
          <div className="hero-footnote"><span>01</span> NO POPUPS. NO DOWNLOADS. JUST YOUR BROWSER.</div>
        </div>

        <div className="hero-visual" aria-label="Abstract animated signal illustration">
          <div className="visual-topline"><span>LIVE SIGNAL</span><span>0x00{running ? "A7" : "01"}</span></div>
          <div className="visual-core">
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <div className="orbit orbit-three" />
            <div className="core-cross cross-horizontal" />
            <div className="core-cross cross-vertical" />
            <div className="core-square"><span>S</span></div>
            <div className="signal-point point-one" />
            <div className="signal-point point-two" />
            <div className="signal-point point-three" />
          </div>
          <div className="visual-bottomline"><span>LOCAL ENVIRONMENT</span><span className="visual-wave">▂▅▃▆▂▇▃▅▁▆</span></div>
          <div className="visual-index">FIG. 001 — SIGNAL STUDY</div>
        </div>
        <div className="hero-index">S / 001</div>
      </section>

      <div className="ticker" aria-label="Experience safety information">
        <div className="ticker-track">
          {Array.from({ length: 4 }, (_, index) => (
            <span key={index}>LOCAL ONLY <b>✳</b> USER CONTROLLED <b>✳</b> ONE TAB ONLY <b>✳</b> NO EXTERNAL ACTIONS <b>✳</b></span>
          ))}
        </div>
      </div>

      <section className="experiment-section section-wrap" id="experiment">
        <div className="section-heading">
          <div><div className="eyebrow"><span className="eyebrow-line" /> THE PLAYGROUND</div><h2>MAKE SOME<br /><span>NOISE.</span></h2></div>
          <p>Three small experiments. Each one is optional, reversible, and runs only while you have this page open.</p>
        </div>

        <div className="experiment-grid">
          <article className={`experiment-card card-distortion ${glitch ? "card-active" : ""}`}>
            <div className="card-number">EXP / 01</div>
            <div className="card-art distortion-art"><span>ERROR</span><i /><i /><i /></div>
            <div className="card-info"><h3>Signal distortion</h3><p>Give the interface a temporary digital interference effect.</p></div>
            <button className="switch-button" aria-pressed={glitch} onClick={() => toggle("SIGNAL DISTORTION", glitch, setGlitch)}><span />{glitch ? "ON" : "OFF"}</button>
          </article>

          <article className={`experiment-card card-gravity ${gravity ? "card-active" : ""}`}>
            <div className="card-number">EXP / 02</div>
            <div className="card-art gravity-art"><span className="gravity-orb orb-a" /><span className="gravity-orb orb-b" /><span className="gravity-orb orb-c" /><span className="gravity-ring" /></div>
            <div className="card-info"><h3>Gravity field</h3><p>Let the interface elements drift in a slow, floating motion.</p></div>
            <button className="switch-button" aria-pressed={gravity} onClick={() => toggle("GRAVITY FIELD", gravity, setGravity)}><span />{gravity ? "ON" : "OFF"}</button>
          </article>

          <article className={`experiment-card card-cursor ${cursorEcho ? "card-active" : ""}`}>
            <div className="card-number">EXP / 03</div>
            <div className="card-art cursor-art"><span className="cursor-symbol">↖</span><span className="cursor-ring" /><span className="cursor-coord">X: 128 / Y: 064</span></div>
            <div className="card-info"><h3>Cursor echo</h3><p>Add a soft visual echo that follows your pointer. Your normal cursor stays visible.</p></div>
            <button className="switch-button" aria-pressed={cursorEcho} onClick={() => toggle("CURSOR ECHO", cursorEcho, setCursorEcho)}><span />{cursorEcho ? "ON" : "OFF"}</button>
          </article>
        </div>
      </section>

      <section className="control-section" id="controls">
        <div className="section-wrap control-layout">
          <div className="control-copy">
            <div className="eyebrow"><span className="eyebrow-line" /> CONTROL ROOM</div>
            <h2>YOU ARE<br /><span>IN CONTROL.</span></h2>
            <p>Nothing starts without your input. Stop the experience at any time to return every effect to its default state.</p>
            <button className="reset-button" onClick={stopExperience}>↺ &nbsp; RESET ALL EFFECTS</button>
          </div>
          <div className="terminal">
            <div className="terminal-header"><div className="terminal-lights"><i /><i /><i /></div><span>sentinel://local-console</span><span>LIVE</span></div>
            <div className="terminal-body">
              <div className="terminal-intro"><span className="terminal-prompt">›</span> STATUS REPORT</div>
              <div className="terminal-state"><span>EXPERIENCE</span><b className={running ? "state-active" : ""}>{running ? "RUNNING" : "STANDBY"}</b></div>
              <div className="terminal-state"><span>VISUAL SEQUENCE</span><b className={sequence ? "state-active" : ""}>{sequence ? "IN PROGRESS" : "IDLE"}</b></div>
              <div className="terminal-divider" />
              <div className="terminal-intro"><span className="terminal-prompt">›</span> EVENT LOG</div>
              <div className="event-list" aria-live="polite">
                {events.map((event, index) => <div className="event-row" key={`${event}-${index}`}><span>{String(index + 1).padStart(2, "0")}</span>{event}</div>)}
              </div>
              <div className="terminal-footer"><span>SESSION: LOCAL</span><span>SECURE BY DESIGN <b>●</b></span></div>
            </div>
          </div>
        </div>
      </section>

      <section className="about-section section-wrap" id="about">
        <div className="about-label">WHY SENTINEL?</div>
        <p>Inspired by experimental corners of the internet. Rebuilt with one rule: <span>the user stays in control.</span></p>
        <div className="about-stats"><div><b>01</b><span>BROWSER TAB</span></div><div><b>0</b><span>FORCED POPUPS</span></div><div><b>100%</b><span>OPT-IN EFFECTS</span></div></div>
      </section>

      <footer className="footer">
        <a className="brand" href="#top"><span className="brand-mark">S</span><span>SENTINEL<span className="brand-dot">.</span></span></a>
        <span>AN EXPERIMENT IN CONTROLLED CHAOS.</span>
        <a href="#top" className="back-top">BACK TO TOP ↑</a>
        <span className="copyright">© {new Date().getFullYear()} SENTINEL</span>
      </footer>
    </main>
  );
}
