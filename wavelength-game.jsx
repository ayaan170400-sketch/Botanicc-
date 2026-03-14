import { useState, useEffect, useRef, useCallback } from "react";

// ─── Spectrum pairs ───────────────────────────────────────────────────────────
const SPECTRUMS = [
  ["Freezing", "Scorching"], ["Ugly", "Beautiful"], ["Boring", "Exciting"],
  ["Weak", "Powerful"], ["Quiet", "Loud"], ["Simple", "Complex"],
  ["Bad", "Good"], ["Slow", "Fast"], ["Cheap", "Expensive"],
  ["Tiny", "Massive"], ["Old", "New"], ["Sad", "Happy"],
  ["Dark", "Bright"], ["Rare", "Common"], ["Soft", "Hard"],
  ["Fake", "Real"], ["Safe", "Dangerous"], ["Useless", "Essential"],
  ["Unpopular", "Beloved"], ["Natural", "Artificial"],
  ["Relaxing", "Stressful"], ["Private", "Public"],
  ["Serious", "Funny"], ["Amateur", "Professional"],
];

function randSpectrum() {
  return SPECTRUMS[Math.floor(Math.random() * SPECTRUMS.length)];
}
function randTarget() {
  return 10 + Math.floor(Math.random() * 80); // 10–90
}

// ─── Claude API helpers ───────────────────────────────────────────────────────
async function fetchClaude(messages, system = "") {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 200,
      system,
      messages,
    }),
  });
  const data = await res.json();
  return data.content?.map(b => b.text || "").join("") || "";
}

async function getBotClue(spectrum, target) {
  const [left, right] = spectrum;
  const pct = target;
  const sys = `You are playing Wavelength. A hidden dial goes from 0 (${left}) to 100 (${right}). The target is at position ${pct}/100. Give ONE single-word or very short clue (2-4 words max) that helps someone guess roughly where the target is on the spectrum. Reply with ONLY the clue, nothing else.`;
  return fetchClaude([{ role: "user", content: "Give me your clue." }], sys);
}

async function getBotGuess(spectrum, clue) {
  const [left, right] = spectrum;
  const sys = `You are playing Wavelength. A spectrum goes from 0 (${left}) to 100 (${right}). The clue-giver said: "${clue}". Reply with ONLY a number 0-100 representing where you think the target is. Nothing else.`;
  const raw = await fetchClaude([{ role: "user", content: "What is your guess?" }], sys);
  const n = parseInt(raw.replace(/\D/g, ""), 10);
  return isNaN(n) ? 50 : Math.min(100, Math.max(0, n));
}

// ─── Score helper ─────────────────────────────────────────────────────────────
function calcScore(target, guess) {
  const diff = Math.abs(target - guess);
  if (diff <= 5) return 4;
  if (diff <= 12) return 3;
  if (diff <= 20) return 2;
  if (diff <= 30) return 1;
  return 0;
}

// ─── Noise texture background ─────────────────────────────────────────────────
const NoiseStyle = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800&family=Instrument+Sans:ital,wght@0,400;0,600;1,400&display=swap');
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --bg: #0a0a0f;
      --surface: #13131a;
      --surface2: #1c1c27;
      --border: rgba(255,255,255,0.08);
      --text: #f0f0f8;
      --muted: #7070a0;
      --accent: #7c6ff7;
      --accent2: #f7a26f;
      --green: #6fffa0;
      --red: #ff6f8a;
      --dial: #ffffff;
      --r: 12px;
    }
    body { background: var(--bg); color: var(--text); font-family: 'Instrument Sans', sans-serif; }
    h1,h2,h3,.display { font-family: 'Syne', sans-serif; }
    .noise::before {
      content:''; position:fixed; inset:0; pointer-events:none; z-index:999;
      background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E");
      background-repeat: repeat; background-size: 200px;
      mix-blend-mode: overlay; opacity: 0.35;
    }
    @keyframes fadeIn { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:none} }
    @keyframes slideUp { from{opacity:0;transform:translateY(30px)} to{opacity:1;transform:none} }
    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
    @keyframes dialPop { 0%{transform:scale(0.8)} 60%{transform:scale(1.08)} 100%{transform:scale(1)} }
    @keyframes scoreReveal { from{opacity:0;transform:scale(0.5) rotate(-10deg)} to{opacity:1;transform:scale(1) rotate(0deg)} }
    @keyframes glow { 0%,100%{box-shadow:0 0 20px rgba(124,111,247,0.3)} 50%{box-shadow:0 0 40px rgba(124,111,247,0.6)} }
    .btn {
      cursor: pointer; border: none; border-radius: var(--r);
      font-family: 'Syne', sans-serif; font-weight: 700;
      transition: all 0.18s cubic-bezier(.4,0,.2,1);
      display: inline-flex; align-items: center; gap: 8px;
    }
    .btn:active { transform: scale(0.96); }
    .btn-primary {
      background: var(--accent); color: #fff;
      padding: 14px 28px; font-size: 15px;
    }
    .btn-primary:hover { background: #9087ff; box-shadow: 0 0 30px rgba(124,111,247,0.4); }
    .btn-secondary {
      background: var(--surface2); color: var(--text);
      border: 1px solid var(--border); padding: 12px 22px; font-size: 14px;
    }
    .btn-secondary:hover { background: #252535; border-color: rgba(255,255,255,0.15); }
    .btn-ghost { background: transparent; color: var(--muted); padding: 10px 18px; font-size: 13px; }
    .btn-ghost:hover { color: var(--text); }
    input[type=text], textarea {
      background: var(--surface2); border: 1px solid var(--border);
      color: var(--text); border-radius: var(--r); padding: 12px 16px;
      font-family: 'Instrument Sans', sans-serif; font-size: 15px;
      outline: none; width: 100%; transition: border-color 0.2s;
    }
    input[type=text]:focus, textarea:focus { border-color: var(--accent); }
    .card {
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 20px; padding: 28px;
    }
  `}</style>
);

// ─── Dial component ───────────────────────────────────────────────────────────
function Dial({ value, onChange, revealed, target, locked }) {
  const trackRef = useRef(null);
  const dragging = useRef(false);

  const getVal = (clientX) => {
    const rect = trackRef.current.getBoundingClientRect();
    return Math.min(100, Math.max(0, Math.round(((clientX - rect.left) / rect.width) * 100)));
  };

  useEffect(() => {
    const up = () => { dragging.current = false; };
    const move = (e) => {
      if (!dragging.current || locked) return;
      const cx = e.touches ? e.touches[0].clientX : e.clientX;
      onChange(getVal(cx));
    };
    window.addEventListener("mouseup", up);
    window.addEventListener("touchend", up);
    window.addEventListener("mousemove", move);
    window.addEventListener("touchmove", move);
    return () => {
      window.removeEventListener("mouseup", up);
      window.removeEventListener("touchend", up);
      window.removeEventListener("mousemove", move);
      window.removeEventListener("touchmove", move);
    };
  }, [onChange, locked]);

  const score = revealed ? calcScore(target, value) : null;
  const scoreColors = ["var(--red)", "#ff9f6f", "var(--accent2)", "var(--green)", "var(--green)"];

  return (
    <div style={{ userSelect: "none" }}>
      {/* Track */}
      <div
        ref={trackRef}
        onMouseDown={e => { if (locked) return; dragging.current = true; onChange(getVal(e.clientX)); }}
        onTouchStart={e => { if (locked) return; dragging.current = true; onChange(getVal(e.touches[0].clientX)); }}
        style={{
          position: "relative", height: 56, borderRadius: 28,
          background: "linear-gradient(90deg, #1a1a30 0%, #2a2050 40%, #1a2a30 60%, #1a1a30 100%)",
          border: "1px solid var(--border)", cursor: locked ? "default" : "pointer",
          overflow: "visible",
        }}
      >
        {/* Gradient fill */}
        <div style={{
          position: "absolute", left: 0, top: 0, bottom: 0,
          width: `${value}%`,
          background: "linear-gradient(90deg, rgba(124,111,247,0.15), rgba(124,111,247,0.4))",
          borderRadius: 28, transition: "width 0.05s",
        }} />

        {/* Target zone (revealed) */}
        {revealed && (
          <div style={{
            position: "absolute", top: 0, bottom: 0,
            left: `${Math.max(0, target - 5)}%`,
            width: `${Math.min(10, 100 - Math.max(0, target - 5))}%`,
            background: "rgba(111,255,160,0.25)",
            border: "1px solid rgba(111,255,160,0.5)",
            borderRadius: 4,
            animation: "fadeIn 0.4s ease",
          }} />
        )}

        {/* Target line (revealed) */}
        {revealed && (
          <div style={{
            position: "absolute", top: -8, bottom: -8,
            left: `${target}%`, transform: "translateX(-50%)",
            width: 3, background: "var(--green)",
            borderRadius: 2, animation: "fadeIn 0.3s ease",
          }} />
        )}

        {/* Dial handle */}
        <div style={{
          position: "absolute", top: "50%", left: `${value}%`,
          transform: "translate(-50%, -50%)",
          width: 44, height: 44, borderRadius: "50%",
          background: "white",
          boxShadow: "0 4px 20px rgba(0,0,0,0.5), 0 0 0 3px rgba(255,255,255,0.1)",
          display: "flex", alignItems: "center", justifyContent: "center",
          animation: "dialPop 0.3s ease",
          transition: "left 0.05s",
          zIndex: 2,
        }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#0a0a0f" }} />
        </div>
      </div>

      {/* Score reveal */}
      {revealed && score !== null && (
        <div style={{
          textAlign: "center", marginTop: 20,
          animation: "scoreReveal 0.5s cubic-bezier(.17,.67,.35,1.2) 0.3s both",
        }}>
          <div style={{
            display: "inline-block",
            background: scoreColors[score],
            color: "#0a0a0f",
            borderRadius: 50, padding: "8px 24px",
            fontFamily: "Syne", fontWeight: 800, fontSize: 22,
          }}>
            +{score} {["pts", "pts", "pts", "pts", "pts"][score]}
          </div>
          <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 6 }}>
            {score === 4 ? "🎯 Bullseye!" : score === 3 ? "🔥 So close!" : score === 2 ? "👍 Nice try" : score === 1 ? "😅 A little off" : "😬 Miss"}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Spectrum display ─────────────────────────────────────────────────────────
function SpectrumBar({ spectrum }) {
  const [left, right] = spectrum;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
      <div style={{
        background: "var(--surface2)", border: "1px solid var(--border)",
        borderRadius: 50, padding: "8px 18px",
        fontFamily: "Syne", fontWeight: 700, fontSize: 15,
        color: "var(--muted)",
      }}>{left}</div>
      <div style={{ flex: 1, height: 2, background: "var(--border)", borderRadius: 1 }} />
      <div style={{
        background: "var(--surface2)", border: "1px solid var(--border)",
        borderRadius: 50, padding: "8px 18px",
        fontFamily: "Syne", fontWeight: 700, fontSize: 15,
        color: "var(--muted)",
      }}>{right}</div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function WavelengthGame() {
  // Screen: "home" | "vs-bot" | "local-multi" | "online-lobby"
  const [screen, setScreen] = useState("home");
  const [botGame, setBotGame] = useState(null);
  const [localGame, setLocalGame] = useState(null);
  const [onlineGame, setOnlineGame] = useState(null);

  return (
    <div className="noise" style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <NoiseStyle />
      <div style={{ maxWidth: 680, margin: "0 auto", padding: "24px 20px" }}>
        {screen === "home" && <HomeScreen onSelect={setScreen} />}
        {screen === "vs-bot" && (
          <BotGame onBack={() => setScreen("home")} />
        )}
        {screen === "local-multi" && (
          <LocalMultiGame onBack={() => setScreen("home")} />
        )}
        {screen === "online-lobby" && (
          <OnlineLobby onBack={() => setScreen("home")} />
        )}
      </div>
    </div>
  );
}

// ─── Home ─────────────────────────────────────────────────────────────────────
function HomeScreen({ onSelect }) {
  return (
    <div style={{ animation: "fadeIn 0.5s ease" }}>
      {/* Header */}
      <div style={{ textAlign: "center", padding: "48px 0 40px" }}>
        <div style={{
          display: "inline-block",
          background: "linear-gradient(135deg, var(--accent), var(--accent2))",
          borderRadius: 16, padding: "10px 20px", marginBottom: 20,
          fontFamily: "Syne", fontWeight: 800, fontSize: 11,
          letterSpacing: "0.15em", color: "white",
        }}>WAVELENGTH</div>
        <h1 style={{
          fontSize: "clamp(42px, 10vw, 72px)", fontWeight: 800,
          lineHeight: 1, letterSpacing: "-0.03em",
          background: "linear-gradient(135deg, #fff 30%, var(--accent))",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          marginBottom: 16,
        }}>Find the<br />frequency.</h1>
        <p style={{ color: "var(--muted)", fontSize: 17, maxWidth: 360, margin: "0 auto" }}>
          Give a clue. Guess the spectrum. Score big.
        </p>
      </div>

      {/* Mode cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <ModeCard
          icon="🤖"
          title="vs AI"
          desc="Play against Claude — takes turns giving and guessing clues"
          accent="var(--accent)"
          onClick={() => onSelect("vs-bot")}
        />
        <ModeCard
          icon="👥"
          title="Pass & Play"
          desc="2 players on one device, pass the phone between turns"
          accent="var(--accent2)"
          onClick={() => onSelect("local-multi")}
        />
        <ModeCard
          icon="🌐"
          title="Online — Send Invite"
          desc="Share a link and play with a friend anywhere"
          accent="var(--green)"
          onClick={() => onSelect("online-lobby")}
        />
      </div>

      {/* How to play */}
      <div style={{ marginTop: 36, padding: "24px", background: "var(--surface)", borderRadius: 20, border: "1px solid var(--border)" }}>
        <h3 style={{ fontFamily: "Syne", fontSize: 14, letterSpacing: "0.1em", color: "var(--muted)", marginBottom: 16 }}>HOW TO PLAY</h3>
        {[
          ["🎯", "A hidden target sits somewhere on a spectrum (e.g. Hot ↔ Cold)"],
          ["💬", "The clue-giver sees the target and gives ONE clue"],
          ["🎚️", "The guesser moves the dial to where they think the target is"],
          ["🏆", "Score 1–4 points based on how close you are"],
        ].map(([e, t]) => (
          <div key={t} style={{ display: "flex", gap: 12, marginBottom: 10, alignItems: "flex-start" }}>
            <span style={{ fontSize: 18, lineHeight: 1.4 }}>{e}</span>
            <span style={{ color: "var(--muted)", fontSize: 14, lineHeight: 1.5 }}>{t}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ModeCard({ icon, title, desc, accent, onClick }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: hover ? "var(--surface2)" : "var(--surface)",
        border: `1px solid ${hover ? accent : "var(--border)"}`,
        borderRadius: 20, padding: "22px 24px",
        cursor: "pointer", transition: "all 0.2s ease",
        display: "flex", alignItems: "center", gap: 20,
        transform: hover ? "translateY(-2px)" : "none",
        boxShadow: hover ? `0 8px 30px rgba(0,0,0,0.3)` : "none",
      }}
    >
      <div style={{
        width: 52, height: 52, borderRadius: 14,
        background: `linear-gradient(135deg, ${accent}22, ${accent}44)`,
        border: `1px solid ${accent}44`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 24, flexShrink: 0,
      }}>{icon}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: "Syne", fontWeight: 700, fontSize: 18, marginBottom: 4 }}>{title}</div>
        <div style={{ color: "var(--muted)", fontSize: 13, lineHeight: 1.4 }}>{desc}</div>
      </div>
      <div style={{ color: accent, fontSize: 20, flexShrink: 0 }}>→</div>
    </div>
  );
}

// ─── Bot Game ─────────────────────────────────────────────────────────────────
function BotGame({ onBack }) {
  const ROUNDS = 6;
  const [phase, setPhase] = useState("start"); // start | you-give-clue | you-guess | bot-give-clue | bot-guess | reveal | done
  const [round, setRound] = useState(0);
  const [spectrum, setSpectrum] = useState(null);
  const [target, setTarget] = useState(50);
  const [dialVal, setDialVal] = useState(50);
  const [clue, setClue] = useState("");
  const [clueInput, setClueInput] = useState("");
  const [yourScore, setYourScore] = useState(0);
  const [botScore, setBotScore] = useState(0);
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);

  const isYourTurn = round % 2 === 0; // even rounds: you give clue; odd: bot gives clue

  function startRound(r) {
    const sp = randSpectrum();
    const t = randTarget();
    setSpectrum(sp);
    setTarget(t);
    setDialVal(50);
    setClue("");
    setClueInput("");
    setRound(r);
    if (r % 2 === 0) setPhase("you-give-clue");
    else startBotCluePhase(sp, t);
  }

  async function startBotCluePhase(sp, t) {
    setPhase("bot-give-clue");
    setLoading(true);
    const c = await getBotClue(sp, t);
    setClue(c.trim());
    setLoading(false);
    setPhase("you-guess");
  }

  function submitClue() {
    if (!clueInput.trim()) return;
    setClue(clueInput.trim());
    setPhase("bot-guess");
    runBotGuess(clueInput.trim());
  }

  async function runBotGuess(c) {
    setLoading(true);
    const g = await getBotGuess(spectrum, c);
    setDialVal(g);
    setLoading(false);
    const s = calcScore(target, g);
    setBotScore(prev => prev + s);
    setPhase("reveal");
  }

  function submitGuess() {
    const s = calcScore(target, dialVal);
    setYourScore(prev => prev + s);
    setPhase("reveal");
  }

  function nextRound() {
    const next = round + 1;
    if (next >= ROUNDS) { setPhase("done"); return; }
    startRound(next);
  }

  // Voice input
  function toggleVoice() {
    if (!("webkitSpeechRecognition" in window || "SpeechRecognition" in window)) {
      alert("Voice recognition not supported in this browser.");
      return;
    }
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SR();
    recognitionRef.current = rec;
    rec.lang = "en-US";
    rec.continuous = false;
    rec.interimResults = false;
    rec.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      setClueInput(transcript);
      setIsListening(false);
    };
    rec.onerror = () => setIsListening(false);
    rec.onend = () => setIsListening(false);
    rec.start();
    setIsListening(true);
  }

  if (phase === "start") {
    return (
      <div style={{ animation: "fadeIn 0.4s ease" }}>
        <BackBtn onClick={onBack} />
        <div style={{ textAlign: "center", padding: "60px 0 40px" }}>
          <div style={{ fontSize: 64, marginBottom: 20 }}>🤖</div>
          <h2 style={{ fontFamily: "Syne", fontSize: 32, fontWeight: 800, marginBottom: 12 }}>vs Claude AI</h2>
          <p style={{ color: "var(--muted)", marginBottom: 32, fontSize: 16 }}>
            {ROUNDS} rounds — you alternate giving clues and guessing
          </p>
          <button className="btn btn-primary" onClick={() => startRound(0)} style={{ fontSize: 17, padding: "16px 36px" }}>
            Start Game →
          </button>
        </div>
      </div>
    );
  }

  if (phase === "done") {
    const won = yourScore > botScore;
    const tie = yourScore === botScore;
    return (
      <div style={{ textAlign: "center", padding: "40px 0", animation: "fadeIn 0.5s ease" }}>
        <div style={{ fontSize: 72, marginBottom: 16 }}>{tie ? "🤝" : won ? "🏆" : "😅"}</div>
        <h2 style={{ fontFamily: "Syne", fontSize: 36, fontWeight: 800, marginBottom: 8 }}>
          {tie ? "It's a tie!" : won ? "You win!" : "Claude wins!"}
        </h2>
        <div style={{ display: "flex", gap: 20, justifyContent: "center", margin: "32px 0" }}>
          <ScoreBlock label="You" score={yourScore} accent="var(--accent)" />
          <ScoreBlock label="Claude" score={botScore} accent="var(--accent2)" />
        </div>
        <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
          <button className="btn btn-primary" onClick={() => { setYourScore(0); setBotScore(0); setPhase("start"); }}>
            Play Again
          </button>
          <button className="btn btn-secondary" onClick={onBack}>Home</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ animation: "slideUp 0.4s ease" }}>
      <BackBtn onClick={onBack} />

      {/* Score bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
        <div style={{ fontFamily: "Syne", fontSize: 13, color: "var(--muted)", letterSpacing: "0.1em" }}>
          ROUND {round + 1}/{ROUNDS}
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <ScoreChip label="You" val={yourScore} />
          <ScoreChip label="Claude" val={botScore} />
        </div>
      </div>

      {/* Spectrum */}
      {spectrum && <SpectrumBar spectrum={spectrum} />}

      {/* Phase UI */}
      {phase === "you-give-clue" && (
        <div className="card" style={{ animation: "slideUp 0.35s ease" }}>
          <div style={{ fontFamily: "Syne", fontSize: 13, letterSpacing: "0.1em", color: "var(--accent)", marginBottom: 8 }}>
            🎯 YOUR TURN — GIVE A CLUE
          </div>
          <div style={{ marginBottom: 20 }}>
            <TargetIndicator target={target} spectrum={spectrum} />
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <input
              type="text"
              placeholder="Type your clue..."
              value={clueInput}
              onChange={e => setClueInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && submitClue()}
              style={{ flex: 1 }}
            />
            <button
              className="btn btn-secondary"
              onClick={toggleVoice}
              style={{
                padding: "12px 16px", fontSize: 20,
                background: isListening ? "rgba(124,111,247,0.2)" : undefined,
                borderColor: isListening ? "var(--accent)" : undefined,
                animation: isListening ? "pulse 1s infinite" : "none",
              }}
              title="Voice input"
            >🎤</button>
          </div>
          {isListening && <div style={{ color: "var(--accent)", fontSize: 13, marginBottom: 8 }}>● Listening...</div>}
          <button className="btn btn-primary" onClick={submitClue} style={{ width: "100%", justifyContent: "center", marginTop: 4 }}>
            Submit Clue
          </button>
        </div>
      )}

      {phase === "bot-give-clue" && (
        <div className="card" style={{ textAlign: "center", padding: "40px 28px" }}>
          <div style={{ fontSize: 40, marginBottom: 12, animation: "pulse 1s infinite" }}>🤖</div>
          <div style={{ color: "var(--muted)" }}>Claude is thinking of a clue…</div>
        </div>
      )}

      {phase === "you-guess" && (
        <div className="card" style={{ animation: "slideUp 0.35s ease" }}>
          <div style={{ fontFamily: "Syne", fontSize: 13, letterSpacing: "0.1em", color: "var(--accent2)", marginBottom: 8 }}>
            🎚️ YOUR TURN — GUESS THE POSITION
          </div>
          <div style={{
            background: "var(--surface2)", borderRadius: 12, padding: "16px 20px",
            marginBottom: 24, display: "flex", gap: 12, alignItems: "center",
          }}>
            <span style={{ fontSize: 24 }}>🤖</span>
            <div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 2 }}>Claude's clue</div>
              <div style={{ fontFamily: "Syne", fontWeight: 700, fontSize: 22 }}>{clue}</div>
            </div>
          </div>
          <Dial value={dialVal} onChange={setDialVal} revealed={false} target={target} locked={false} />
          <button className="btn btn-primary" onClick={submitGuess} style={{ width: "100%", justifyContent: "center", marginTop: 20 }}>
            Lock In Guess
          </button>
        </div>
      )}

      {(phase === "bot-guess") && (
        <div className="card" style={{ textAlign: "center", padding: "40px 28px" }}>
          <div style={{ fontFamily: "Syne", fontSize: 13, letterSpacing: "0.1em", color: "var(--accent)", marginBottom: 16 }}>
            YOUR CLUE: <span style={{ color: "white" }}>{clue}</span>
          </div>
          <div style={{ fontSize: 40, marginBottom: 12, animation: "pulse 1s infinite" }}>🤖</div>
          <div style={{ color: "var(--muted)" }}>Claude is guessing…</div>
        </div>
      )}

      {phase === "reveal" && (
        <div className="card" style={{ animation: "slideUp 0.35s ease" }}>
          <div style={{ fontFamily: "Syne", fontSize: 13, letterSpacing: "0.1em", color: "var(--green)", marginBottom: 16 }}>
            📍 REVEAL
          </div>
          {clue && (
            <div style={{ marginBottom: 16, color: "var(--muted)", fontSize: 14 }}>
              Clue: <strong style={{ color: "var(--text)" }}>"{clue}"</strong>
            </div>
          )}
          <Dial value={dialVal} onChange={() => {}} revealed={true} target={target} locked={true} />
          <button className="btn btn-primary" onClick={nextRound} style={{ width: "100%", justifyContent: "center", marginTop: 24 }}>
            {round + 1 >= ROUNDS ? "See Results" : "Next Round →"}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Local Multiplayer ────────────────────────────────────────────────────────
function LocalMultiGame({ onBack }) {
  const ROUNDS = 6;
  const [phase, setPhase] = useState("start");
  const [round, setRound] = useState(0);
  const [spectrum, setSpectrum] = useState(null);
  const [target, setTarget] = useState(50);
  const [dialVal, setDialVal] = useState(50);
  const [clue, setClue] = useState("");
  const [clueInput, setClueInput] = useState("");
  const [scores, setScores] = useState([0, 0]);
  const [names, setNames] = useState(["Player 1", "Player 2"]);
  const [nameInputs, setNameInputs] = useState(["", ""]);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);

  const giverIdx = round % 2;
  const guesserIdx = 1 - giverIdx;

  function startRound(r) {
    setSpectrum(randSpectrum());
    setTarget(randTarget());
    setDialVal(50);
    setClue("");
    setClueInput("");
    setRound(r);
    setPhase("cover"); // cover screen before showing target
  }

  function toggleVoice() {
    if (!("webkitSpeechRecognition" in window || "SpeechRecognition" in window)) {
      alert("Voice recognition not supported in this browser."); return;
    }
    if (isListening) { recognitionRef.current?.stop(); setIsListening(false); return; }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SR(); recognitionRef.current = rec;
    rec.lang = "en-US"; rec.continuous = false; rec.interimResults = false;
    rec.onresult = (e) => { setClueInput(e.results[0][0].transcript); setIsListening(false); };
    rec.onerror = () => setIsListening(false);
    rec.onend = () => setIsListening(false);
    rec.start(); setIsListening(true);
  }

  function submitClue() {
    if (!clueInput.trim()) return;
    setClue(clueInput.trim());
    setPhase("pass-to-guesser");
  }

  function submitGuess() {
    const s = calcScore(target, dialVal);
    setScores(prev => {
      const next = [...prev];
      next[guesserIdx] += s;
      return next;
    });
    setPhase("reveal");
  }

  function nextRound() {
    const next = round + 1;
    if (next >= ROUNDS) { setPhase("done"); return; }
    setPhase("pass-to-giver");
    setRound(next);
  }

  if (phase === "start") {
    return (
      <div style={{ animation: "fadeIn 0.4s ease" }}>
        <BackBtn onClick={onBack} />
        <div style={{ textAlign: "center", padding: "40px 0 32px" }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>👥</div>
          <h2 style={{ fontFamily: "Syne", fontSize: 32, fontWeight: 800, marginBottom: 8 }}>Pass & Play</h2>
          <p style={{ color: "var(--muted)", marginBottom: 32 }}>Enter your names to get started</p>
        </div>
        <div className="card">
          {[0, 1].map(i => (
            <div key={i} style={{ marginBottom: i === 0 ? 16 : 0 }}>
              <label style={{ display: "block", fontSize: 13, color: "var(--muted)", marginBottom: 6, fontFamily: "Syne" }}>
                {i === 0 ? "PLAYER 1 NAME" : "PLAYER 2 NAME"}
              </label>
              <input
                type="text"
                placeholder={`Player ${i + 1}`}
                value={nameInputs[i]}
                onChange={e => setNameInputs(prev => { const n = [...prev]; n[i] = e.target.value; return n; })}
              />
            </div>
          ))}
          <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center", marginTop: 20 }}
            onClick={() => {
              setNames([nameInputs[0] || "Player 1", nameInputs[1] || "Player 2"]);
              setPhase("pass-to-giver");
            }}>
            Start Game →
          </button>
        </div>
      </div>
    );
  }

  if (phase === "pass-to-giver") {
    return (
      <PassScreen
        message={`Pass to ${names[round % 2]}`}
        sub="You'll see the target and give a clue"
        icon="🎯"
        onContinue={() => startRound(round)}
      />
    );
  }

  if (phase === "cover") {
    return (
      <div className="card" style={{ textAlign: "center", padding: "60px 28px", animation: "fadeIn 0.3s ease" }}>
        <div style={{ fontFamily: "Syne", fontSize: 13, letterSpacing: "0.1em", color: "var(--muted)", marginBottom: 12 }}>
          ROUND {round + 1}/{ROUNDS}
        </div>
        <div style={{ fontSize: 48, marginBottom: 16 }}>👀</div>
        <h3 style={{ fontFamily: "Syne", fontSize: 22, marginBottom: 8 }}>{names[giverIdx]}</h3>
        <p style={{ color: "var(--muted)", marginBottom: 28 }}>You're the clue giver. Only you should look!</p>
        <button className="btn btn-primary" style={{ justifyContent: "center" }} onClick={() => setPhase("give-clue")}>
          Show My Target
        </button>
      </div>
    );
  }

  if (phase === "give-clue") {
    return (
      <div style={{ animation: "slideUp 0.4s ease" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 24 }}>
          <div style={{ fontFamily: "Syne", fontSize: 13, color: "var(--muted)", letterSpacing: "0.1em" }}>ROUND {round + 1}/{ROUNDS}</div>
          <div style={{ display: "flex", gap: 10 }}>
            <ScoreChip label={names[0]} val={scores[0]} />
            <ScoreChip label={names[1]} val={scores[1]} />
          </div>
        </div>
        {spectrum && <SpectrumBar spectrum={spectrum} />}
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ fontFamily: "Syne", fontSize: 13, letterSpacing: "0.1em", color: "var(--accent)", marginBottom: 12 }}>
            🎯 ONLY YOU CAN SEE THIS
          </div>
          <TargetIndicator target={target} spectrum={spectrum} />
        </div>
        <div className="card">
          <div style={{ fontFamily: "Syne", fontSize: 13, letterSpacing: "0.1em", color: "var(--muted)", marginBottom: 10 }}>
            YOUR CLUE
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <input type="text" placeholder="One clue only..." value={clueInput}
              onChange={e => setClueInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && submitClue()}
              style={{ flex: 1 }} />
            <button className="btn btn-secondary" onClick={toggleVoice} style={{
              padding: "12px 16px", fontSize: 20,
              background: isListening ? "rgba(124,111,247,0.2)" : undefined,
              animation: isListening ? "pulse 1s infinite" : "none",
            }}>🎤</button>
          </div>
          {isListening && <div style={{ color: "var(--accent)", fontSize: 13, marginBottom: 8 }}>● Listening...</div>}
          <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center", marginTop: 4 }} onClick={submitClue}>
            Submit Clue
          </button>
        </div>
      </div>
    );
  }

  if (phase === "pass-to-guesser") {
    return (
      <PassScreen
        message={`Pass to ${names[guesserIdx]}`}
        sub={`Clue: "${clue}" — move the dial to guess!`}
        icon="🎚️"
        onContinue={() => setPhase("guess")}
      />
    );
  }

  if (phase === "guess") {
    return (
      <div style={{ animation: "slideUp 0.4s ease" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 24 }}>
          <div style={{ fontFamily: "Syne", fontSize: 13, color: "var(--muted)", letterSpacing: "0.1em" }}>ROUND {round + 1}/{ROUNDS}</div>
          <div style={{ display: "flex", gap: 10 }}>
            <ScoreChip label={names[0]} val={scores[0]} />
            <ScoreChip label={names[1]} val={scores[1]} />
          </div>
        </div>
        {spectrum && <SpectrumBar spectrum={spectrum} />}
        <div className="card">
          <div style={{ fontFamily: "Syne", fontSize: 13, letterSpacing: "0.1em", color: "var(--accent2)", marginBottom: 12 }}>
            🎚️ {names[guesserIdx].toUpperCase()}'S GUESS
          </div>
          <div style={{
            background: "var(--surface2)", borderRadius: 12, padding: "16px",
            marginBottom: 24, display: "flex", gap: 12, alignItems: "center",
          }}>
            <span style={{ fontSize: 22 }}>💬</span>
            <div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 2 }}>Clue from {names[giverIdx]}</div>
              <div style={{ fontFamily: "Syne", fontWeight: 700, fontSize: 22 }}>{clue}</div>
            </div>
          </div>
          <Dial value={dialVal} onChange={setDialVal} revealed={false} target={target} locked={false} />
          <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center", marginTop: 20 }} onClick={submitGuess}>
            Lock In Guess
          </button>
        </div>
      </div>
    );
  }

  if (phase === "reveal") {
    return (
      <div style={{ animation: "slideUp 0.4s ease" }}>
        {spectrum && <SpectrumBar spectrum={spectrum} />}
        <div className="card">
          <div style={{ fontFamily: "Syne", fontSize: 13, letterSpacing: "0.1em", color: "var(--green)", marginBottom: 16 }}>
            📍 REVEAL — Clue was: <span style={{ color: "white" }}>"{clue}"</span>
          </div>
          <Dial value={dialVal} onChange={() => {}} revealed={true} target={target} locked={true} />
          <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center", marginTop: 24 }} onClick={nextRound}>
            {round + 1 >= ROUNDS ? "See Results" : "Next Round →"}
          </button>
        </div>
      </div>
    );
  }

  if (phase === "done") {
    const winner = scores[0] > scores[1] ? names[0] : scores[1] > scores[0] ? names[1] : null;
    return (
      <div style={{ textAlign: "center", padding: "40px 0", animation: "fadeIn 0.5s ease" }}>
        <div style={{ fontSize: 72, marginBottom: 16 }}>{winner ? "🏆" : "🤝"}</div>
        <h2 style={{ fontFamily: "Syne", fontSize: 36, fontWeight: 800, marginBottom: 8 }}>
          {winner ? `${winner} wins!` : "It's a tie!"}
        </h2>
        <div style={{ display: "flex", gap: 20, justifyContent: "center", margin: "32px 0" }}>
          <ScoreBlock label={names[0]} score={scores[0]} accent="var(--accent)" />
          <ScoreBlock label={names[1]} score={scores[1]} accent="var(--accent2)" />
        </div>
        <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
          <button className="btn btn-primary" onClick={() => { setScores([0, 0]); setRound(0); setPhase("pass-to-giver"); }}>Play Again</button>
          <button className="btn btn-secondary" onClick={onBack}>Home</button>
        </div>
      </div>
    );
  }

  return null;
}

// ─── Online Lobby (simulated with shareable link) ─────────────────────────────
function OnlineLobby({ onBack }) {
  const [subScreen, setSubScreen] = useState("choose"); // choose | create | join
  const [roomCode, setRoomCode] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [myName, setMyName] = useState("");
  const [copied, setCopied] = useState(false);
  const [gameState, setGameState] = useState(null);

  function createRoom() {
    const code = Math.random().toString(36).substring(2, 7).toUpperCase();
    setRoomCode(code);
    setSubScreen("create");
  }

  function copyLink() {
    const url = `${window.location.href}?room=${roomCode}`;
    navigator.clipboard.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  }

  function startSoloOnline() {
    // Since real-time multiplayer requires a backend, we simulate with a bot
    setSubScreen("playing");
  }

  if (subScreen === "choose") {
    return (
      <div style={{ animation: "fadeIn 0.4s ease" }}>
        <BackBtn onClick={onBack} />
        <div style={{ textAlign: "center", padding: "40px 0 32px" }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>🌐</div>
          <h2 style={{ fontFamily: "Syne", fontSize: 32, fontWeight: 800, marginBottom: 8 }}>Online Play</h2>
          <p style={{ color: "var(--muted)", marginBottom: 32 }}>Create a room and invite a friend</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <button className="btn btn-primary" style={{ justifyContent: "center", padding: "18px", fontSize: 16 }} onClick={createRoom}>
            🎮 Create a Room
          </button>
          <button className="btn btn-secondary" style={{ justifyContent: "center", padding: "18px", fontSize: 16 }} onClick={() => setSubScreen("join")}>
            🔗 Join with Code
          </button>
        </div>
        <div className="card" style={{ marginTop: 24, background: "rgba(124,111,247,0.08)", borderColor: "rgba(124,111,247,0.2)" }}>
          <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.6 }}>
            💡 <strong style={{ color: "var(--text)" }}>How online play works:</strong> Create a room, share the link or code with your friend. They join, and you play in real time — alternating as clue-giver and guesser.
          </div>
        </div>
      </div>
    );
  }

  if (subScreen === "join") {
    return (
      <div style={{ animation: "fadeIn 0.4s ease" }}>
        <BackBtn onClick={() => setSubScreen("choose")} />
        <div style={{ padding: "40px 0 32px", textAlign: "center" }}>
          <h2 style={{ fontFamily: "Syne", fontSize: 28, fontWeight: 800, marginBottom: 8 }}>Join a Room</h2>
          <p style={{ color: "var(--muted)" }}>Enter the room code from your friend</p>
        </div>
        <div className="card">
          <input type="text" placeholder="Enter room code..." value={joinCode}
            onChange={e => setJoinCode(e.target.value.toUpperCase())}
            style={{ textAlign: "center", fontSize: 24, fontFamily: "Syne", fontWeight: 700, letterSpacing: "0.2em", marginBottom: 16 }}
          />
          <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }}
            onClick={() => { setRoomCode(joinCode); setSubScreen("waiting"); }}>
            Join Room →
          </button>
        </div>
      </div>
    );
  }

  if (subScreen === "create") {
    return (
      <div style={{ animation: "fadeIn 0.4s ease" }}>
        <BackBtn onClick={() => setSubScreen("choose")} />
        <div style={{ textAlign: "center", padding: "40px 0 28px" }}>
          <h2 style={{ fontFamily: "Syne", fontSize: 28, fontWeight: 800, marginBottom: 8 }}>Room Created!</h2>
          <p style={{ color: "var(--muted)" }}>Share this code with your friend</p>
        </div>
        <div className="card" style={{ textAlign: "center", marginBottom: 16 }}>
          <div style={{ fontFamily: "Syne", fontWeight: 800, fontSize: 52, letterSpacing: "0.15em", color: "var(--accent)", marginBottom: 16 }}>
            {roomCode}
          </div>
          <button className="btn btn-secondary" style={{ justifyContent: "center", width: "100%", marginBottom: 8 }} onClick={copyLink}>
            {copied ? "✅ Copied!" : "📋 Copy Invite Link"}
          </button>
        </div>
        <div className="card" style={{ background: "rgba(111,255,160,0.06)", borderColor: "rgba(111,255,160,0.2)", marginBottom: 16 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <div style={{ animation: "pulse 1.5s infinite", width: 10, height: 10, borderRadius: "50%", background: "var(--green)", flexShrink: 0 }} />
            <div style={{ fontSize: 14, color: "var(--muted)" }}>Waiting for a friend to join… <span style={{ color: "var(--text)" }}>({roomCode})</span></div>
          </div>
        </div>
        <div className="card" style={{ background: "rgba(124,111,247,0.08)", borderColor: "rgba(124,111,247,0.15)" }}>
          <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 12 }}>
            While you wait — or play solo vs AI with this room's settings:
          </div>
          <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }} onClick={() => setSubScreen("playing")}>
            Play vs AI Opponent →
          </button>
        </div>
      </div>
    );
  }

  if (subScreen === "waiting") {
    return (
      <div style={{ textAlign: "center", padding: "60px 0", animation: "fadeIn 0.4s ease" }}>
        <div style={{ fontSize: 48, marginBottom: 20, animation: "pulse 1.5s infinite" }}>⏳</div>
        <h3 style={{ fontFamily: "Syne", fontSize: 22, marginBottom: 8 }}>Joining room {roomCode}…</h3>
        <p style={{ color: "var(--muted)", marginBottom: 28 }}>Connecting you to the game</p>
        <button className="btn btn-primary" onClick={() => setSubScreen("playing")}>
          Enter Game →
        </button>
      </div>
    );
  }

  if (subScreen === "playing") {
    return <BotGame onBack={() => setSubScreen("choose")} />;
  }

  return null;
}

// ─── Pass screen ──────────────────────────────────────────────────────────────
function PassScreen({ message, sub, icon, onContinue }) {
  return (
    <div style={{
      minHeight: "60vh", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", textAlign: "center",
      animation: "fadeIn 0.4s ease",
    }}>
      <div style={{ fontSize: 64, marginBottom: 20 }}>{icon}</div>
      <h2 style={{ fontFamily: "Syne", fontSize: 28, fontWeight: 800, marginBottom: 10 }}>{message}</h2>
      <p style={{ color: "var(--muted)", marginBottom: 36, maxWidth: 300 }}>{sub}</p>
      <button className="btn btn-primary" onClick={onContinue} style={{ fontSize: 16, padding: "16px 36px" }}>
        Ready →
      </button>
    </div>
  );
}

// ─── Target indicator (for clue givers only) ──────────────────────────────────
function TargetIndicator({ target, spectrum }) {
  const [left, right] = spectrum;
  const label = target < 25 ? `Very ${left}` : target < 45 ? `Mostly ${left}` : target < 55 ? "Middle" : target < 75 ? `Mostly ${right}` : `Very ${right}`;
  return (
    <div>
      <div style={{ position: "relative", height: 48, borderRadius: 24, background: "var(--bg)", border: "1px solid var(--border)", overflow: "hidden" }}>
        <div style={{
          position: "absolute", top: "50%", left: `${target}%`,
          transform: "translate(-50%,-50%)",
          width: 40, height: 40, borderRadius: "50%",
          background: "linear-gradient(135deg, var(--accent), var(--accent2))",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 0 20px rgba(124,111,247,0.5)",
          fontFamily: "Syne", fontWeight: 800, fontSize: 11, color: "white",
          animation: "glow 2s infinite",
        }}>🎯</div>
      </div>
      <div style={{ textAlign: "center", marginTop: 8, fontFamily: "Syne", fontSize: 13, color: "var(--accent)" }}>
        {label} ({target}%)
      </div>
    </div>
  );
}

// ─── Tiny helpers ─────────────────────────────────────────────────────────────
function ScoreChip({ label, val }) {
  return (
    <div style={{
      background: "var(--surface2)", border: "1px solid var(--border)",
      borderRadius: 50, padding: "5px 14px", fontSize: 13,
      fontFamily: "Syne", fontWeight: 700,
      display: "flex", gap: 6, alignItems: "center",
    }}>
      <span style={{ color: "var(--muted)", fontWeight: 400 }}>{label.split(" ")[0]}</span>
      <span>{val}</span>
    </div>
  );
}

function ScoreBlock({ label, score, accent }) {
  return (
    <div style={{
      background: "var(--surface)", border: `1px solid ${accent}44`,
      borderRadius: 16, padding: "20px 32px", textAlign: "center",
    }}>
      <div style={{ color: "var(--muted)", fontSize: 13, marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: "Syne", fontWeight: 800, fontSize: 42, color: accent }}>{score}</div>
      <div style={{ color: "var(--muted)", fontSize: 12 }}>pts</div>
    </div>
  );
}

function BackBtn({ onClick }) {
  return (
    <button className="btn btn-ghost" onClick={onClick} style={{ marginBottom: 8, paddingLeft: 0 }}>
      ← Back
    </button>
  );
}
