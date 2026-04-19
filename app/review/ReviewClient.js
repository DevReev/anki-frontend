// app/review/ReviewClient.js
"use client";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { app } from "../lib/firebase";
import Navbar from "../../components/NavBar";
import {
  Loader2,
  ChevronLeft,
  ChevronRight,
  Zap,
  Calendar,
  BarChart3,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

const QUALITY = [
  {
    label: "Again",
    score: 0,
    color: "rgba(248,113,113,0.15)",
    border: "rgba(248,113,113,0.3)",
    text: "#f87171",
  },
  {
    label: "Hard",
    score: 1,
    color: "rgba(251,146,60,0.12)",
    border: "rgba(251,146,60,0.3)",
    text: "#fb923c",
  },
  {
    label: "Tough",
    score: 2,
    color: "rgba(251,191,36,0.1)",
    border: "rgba(251,191,36,0.25)",
    text: "#fbbf24",
  },
  {
    label: "Good",
    score: 3,
    color: "rgba(52,211,153,0.1)",
    border: "rgba(52,211,153,0.25)",
    text: "#34d399",
  },
  {
    label: "Easy",
    score: 4,
    color: "rgba(79,142,247,0.1)",
    border: "rgba(79,142,247,0.25)",
    text: "#4f8ef7",
  },
  {
    label: "Perfect",
    score: 5,
    color: "rgba(79,142,247,0.2)",
    border: "rgba(79,142,247,0.5)",
    text: "#4f8ef7",
  },
];

export default function ReviewClient() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [decks, setDecks] = useState([]);
  const [selectedDeck, setSelectedDeck] = useState(null);
  const [stats, setStats] = useState(null);
  const [cards, setCards] = useState([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [cardFlipped, setCardFlipped] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!app) return;
    const auth = getAuth(app);
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        router.push("/auth");
        return;
      }
      setUser(currentUser);
      const idToken = await currentUser.getIdToken(true);
      setToken(idToken);
      fetchDecksAndStats(idToken);
    });
    return () => unsubscribe();
  }, [router]);

  const fetchDecksAndStats = async (currentToken) => {
    try {
      const [decksRes, statsRes] = await Promise.all([
        fetch(`${API}/user/decks`, {
          headers: { Authorization: `Bearer ${currentToken}` },
        }),
        fetch(`${API}/review/stats`, {
          headers: { Authorization: `Bearer ${currentToken}` },
        }),
      ]);
      if (decksRes.ok) setDecks((await decksRes.json()).decks || []);
      if (statsRes.ok) setStats(await statsRes.json());
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadDeckCards = async (deckId) => {
    setReviewing(true);
    setError("");
    try {
      const res = await fetch(`${API}/review/cards-due?deck_id=${deckId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.cards?.length === 0) {
        setError("No cards due for review right now!");
        setCards([]);
      } else {
        setCards(data.cards || []);
        setCurrentCardIndex(0);
        setCardFlipped(false);
      }
    } catch {
      setError("Failed to load cards");
    } finally {
      setReviewing(false);
    }
  };

  const submitReview = async (quality) => {
    if (!cards[currentCardIndex]) return;
    try {
      const res = await fetch(`${API}/review/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ card_id: cards[currentCardIndex].id, quality }),
      });
      if (!res.ok) throw new Error("Submit failed");
      if (currentCardIndex < cards.length - 1) {
        setCurrentCardIndex((i) => i + 1);
        setCardFlipped(false);
      } else {
        setError("Review complete! 🎉");
        setCards([]);
      }
    } catch {
      setError("Failed to submit review");
    }
  };

  useEffect(() => {
    const handleKey = (e) => {
      if (!cards.length) return;
      if (e.key === "ArrowLeft") {
        if (currentCardIndex > 0) {
          setCurrentCardIndex((i) => i - 1);
          setCardFlipped(false);
        }
      }
      if (e.key === "ArrowRight") {
        if (currentCardIndex < cards.length - 1) {
          setCurrentCardIndex((i) => i + 1);
          setCardFlipped(false);
        }
      }
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        setCardFlipped((f) => !f);
      }
      if (e.key >= "0" && e.key <= "5") submitReview(parseInt(e.key));
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [currentCardIndex, cards]);

  if (loading)
    return (
      <>
        <style>{globalStyles}</style>
        <div style={S.root}>
          <Navbar />
          <div style={S.loadingCenter}>
            <Loader2
              size={28}
              className="af-spin"
              style={{ color: "var(--accent)" }}
            />
          </div>
        </div>
      </>
    );

  const currentCard = cards[currentCardIndex];
  const isDeckView = !reviewing && cards.length === 0;

  return (
    <>
      <style>{globalStyles}</style>
      <div style={S.root}>
        <Navbar />
        <div style={S.container}>
          {isDeckView ? (
            <>
              {/* Stats strip */}
              {stats && (
                <div style={S.statsStrip}>
                  {[
                    {
                      icon: <BarChart3 size={18} />,
                      label: "Total Cards",
                      value: stats.total_cards,
                      color: "var(--accent)",
                    },
                    {
                      icon: <Calendar size={18} />,
                      label: "Due Today",
                      value: stats.cards_due,
                      color: "var(--green)",
                    },
                    {
                      icon: <Zap size={18} />,
                      label: "Streak",
                      value: stats.review_streak,
                      color: "var(--yellow)",
                    },
                  ].map((s, i) => (
                    <div key={i} style={S.statCard}>
                      <div style={{ ...S.statIcon, color: s.color }}>
                        {s.icon}
                      </div>
                      <div>
                        <div style={S.statValue}>{s.value}</div>
                        <div style={S.statLabel}>{s.label}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Decks */}
              <div style={S.card}>
                <div style={S.cardHeader}>
                  <h2 style={S.cardTitle}>Select Deck to Review</h2>
                  <p style={S.cardSub}>
                    Choose a deck to practice with spaced repetition
                  </p>
                </div>
                <div style={S.cardBody}>
                  {decks.length === 0 ? (
                    <div style={S.noDeckEmpty}>
                      <AlertCircle
                        size={28}
                        style={{ color: "var(--muted)", marginBottom: 12 }}
                      />
                      <p
                        style={{
                          fontSize: 14,
                          color: "var(--muted)",
                          marginBottom: 16,
                        }}
                      >
                        No decks yet
                      </p>
                      <a href="/" style={S.createLink}>
                        Create First Deck
                      </a>
                    </div>
                  ) : (
                    <div style={S.deckGrid}>
                      {decks.map((deck) => (
                        <button
                          key={deck.id}
                          style={S.deckBtn}
                          className="af-deck-btn"
                          onClick={() => {
                            setSelectedDeck(deck);
                            setReviewing(true);
                            loadDeckCards(deck.id);
                          }}
                        >
                          <div style={S.deckBtnStripe} />
                          <div style={S.deckBtnBody}>
                            <div style={S.deckBtnName}>{deck.deck_name}</div>
                            <div style={S.deckBtnMeta}>
                              {deck.card_count} cards
                            </div>
                            <div style={S.deckBtnReview}>
                              Review <Zap size={12} style={{ marginLeft: 5 }} />
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Back button + title */}
              <div style={S.reviewHeader}>
                <button
                  onClick={() => {
                    setReviewing(false);
                    setCards([]);
                    setSelectedDeck(null);
                  }}
                  style={S.backBtn}
                  className="af-back-btn"
                >
                  <ChevronLeft size={16} style={{ marginRight: 4 }} />
                  Back
                </button>
                <h1 style={S.reviewTitle}>{selectedDeck?.deck_name}</h1>
              </div>

              {cards.length > 0 && currentCard ? (
                <>
                  {/* Progress bar */}
                  <div style={S.progressWrap}>
                    <div style={S.progressHead}>
                      <span style={S.progressLabel}>Progress</span>
                      <span style={S.progressCount}>
                        {currentCardIndex + 1} / {cards.length}
                      </span>
                    </div>
                    <div style={S.progressTrack}>
                      <div
                        style={{
                          ...S.progressFill,
                          width: `${((currentCardIndex + 1) / cards.length) * 100}%`,
                        }}
                      />
                    </div>
                  </div>

                  {/* Card */}
                  <div
                    onClick={() => setCardFlipped(!cardFlipped)}
                    style={{
                      ...S.flashcard,
                      ...(cardFlipped ? S.flashcardBack : {}),
                    }}
                    className="af-flashcard"
                  >
                    <div style={S.flashSide}>
                      {cardFlipped ? "Answer" : "Question"}
                    </div>
                    <div
                      style={S.flashContent}
                      dangerouslySetInnerHTML={{
                        __html: cardFlipped
                          ? currentCard.card_back
                          : currentCard.card_front,
                      }}
                    />
                    {currentCard.card_tags?.length > 0 && (
                      <div style={S.tagsRow}>
                        {currentCard.card_tags.map((tag, i) => (
                          <span key={i} style={S.tag}>
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    <div style={S.flipHint}>
                      Press Space or click to{" "}
                      {cardFlipped ? "show question" : "reveal answer"}
                    </div>
                  </div>

                  {/* Quality buttons */}
                  <div style={S.qualitySection}>
                    <p style={S.qualityLabel}>
                      How well did you remember this?
                    </p>
                    <div style={S.qualityGrid}>
                      {QUALITY.map((q) => (
                        <button
                          key={q.score}
                          onClick={() => submitReview(q.score)}
                          style={{
                            ...S.qualityBtn,
                            background: q.color,
                            borderColor: q.border,
                            color: q.text,
                          }}
                          className="af-quality-btn"
                          title={`Press ${q.score}`}
                        >
                          <span style={S.qualityName}>{q.label}</span>
                          <span style={S.qualityNum}>{q.score}</span>
                        </button>
                      ))}
                    </div>
                    <p style={S.keyboardHint}>
                      Press 0–5 to rate · Space to flip
                    </p>
                  </div>
                </>
              ) : (
                <div style={S.card}>
                  <div
                    style={{
                      ...S.cardBody,
                      textAlign: "center",
                      padding: "64px 24px",
                    }}
                  >
                    {error === "Review complete! 🎉" ? (
                      <>
                        <CheckCircle2
                          size={44}
                          style={{ color: "var(--green)", marginBottom: 16 }}
                        />
                        <h3 style={{ ...S.cardTitle, marginBottom: 10 }}>
                          Review Complete!
                        </h3>
                        <p
                          style={{
                            fontSize: 14,
                            color: "var(--muted)",
                            marginBottom: 24,
                          }}
                        >
                          Great job! You'll see more cards when they're due.
                        </p>
                        <button
                          onClick={() => {
                            setReviewing(false);
                            setCards([]);
                            setSelectedDeck(null);
                            setError("");
                          }}
                          style={S.backToDecksBtn}
                          className="af-btn-glow"
                        >
                          Back to Decks
                        </button>
                      </>
                    ) : (
                      <>
                        <AlertCircle
                          size={44}
                          style={{ color: "var(--accent)", marginBottom: 16 }}
                        />
                        <h3 style={{ ...S.cardTitle, marginBottom: 10 }}>
                          No Cards Due
                        </h3>
                        <p style={{ fontSize: 14, color: "var(--muted)" }}>
                          Come back later when more cards are due for review.
                        </p>
                      </>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Error banner (non-completion) */}
          {error && error !== "Review complete! 🎉" && (
            <div style={{ ...S.errorBanner, marginTop: 16 }}>
              <AlertCircle
                size={15}
                style={{ color: "var(--red)", flexShrink: 0 }}
              />
              <span style={{ fontSize: 13, color: "var(--red)" }}>{error}</span>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

const globalStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500&display=swap');
  :root {
    --bg: #0d1117; --surface: rgba(255,255,255,0.04); --surface-hover: rgba(255,255,255,0.07);
    --border: rgba(255,255,255,0.08); --border-strong: rgba(255,255,255,0.14);
    --text: #e8eaf0; --muted: #6b7280;
    --accent: #4f8ef7; --accent-glow: rgba(79,142,247,0.35);
    --green: #34d399; --red: #f87171; --yellow: #fbbf24;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: var(--bg); color: var(--text); font-family: 'DM Sans', sans-serif; }

  @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
  .af-spin { animation: spin 1s linear infinite; }
  @keyframes fadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }

  .af-btn-glow { transition: all 0.2s ease !important; }
  .af-btn-glow:hover { box-shadow: 0 0 20px var(--accent-glow) !important; transform: translateY(-1px); }

  .af-flashcard { cursor: pointer; transition: transform 0.2s, box-shadow 0.2s; }
  .af-flashcard:hover { transform: translateY(-2px); box-shadow: 0 16px 48px rgba(0,0,0,0.4); }

  .af-quality-btn { transition: all 0.15s ease; cursor: pointer; }
  .af-quality-btn:hover { transform: translateY(-2px); filter: brightness(1.15); }

  .af-deck-btn { transition: transform 0.2s, box-shadow 0.2s; animation: fadeUp 0.3s ease; }
  .af-deck-btn:hover { transform: translateY(-3px); box-shadow: 0 12px 36px rgba(0,0,0,0.4) !important; }

  .af-back-btn:hover { background: var(--surface-hover) !important; }
`;

const S = {
  root: {
    minHeight: "100vh",
    background: "var(--bg)",
    fontFamily: "'DM Sans', sans-serif",
  },
  loadingCenter: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "60vh",
  },
  container: { maxWidth: 860, margin: "0 auto", padding: "36px 20px" },

  statsStrip: {
    display: "grid",
    gridTemplateColumns: "repeat(3,1fr)",
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    background: "rgba(255,255,255,0.03)",
    border: "1px solid var(--border)",
    borderRadius: 16,
    padding: "18px 20px",
    display: "flex",
    alignItems: "center",
    gap: 14,
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    background: "rgba(255,255,255,0.05)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  statValue: {
    fontFamily: "'Syne', sans-serif",
    fontSize: 24,
    fontWeight: 800,
    color: "var(--text)",
    letterSpacing: "-0.03em",
  },
  statLabel: { fontSize: 12, color: "var(--muted)", marginTop: 2 },

  card: {
    background: "rgba(255,255,255,0.03)",
    border: "1px solid var(--border)",
    borderRadius: 20,
    overflow: "hidden",
  },
  cardHeader: { padding: "24px 24px 0" },
  cardTitle: {
    fontFamily: "'Syne', sans-serif",
    fontSize: 18,
    fontWeight: 700,
    color: "var(--text)",
    letterSpacing: "-0.02em",
  },
  cardSub: { fontSize: 13, color: "var(--muted)", marginTop: 4 },
  cardBody: { padding: 24 },

  noDeckEmpty: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "40px 20px",
    textAlign: "center",
  },
  createLink: {
    padding: "11px 22px",
    borderRadius: 10,
    background: "var(--accent)",
    color: "#fff",
    fontSize: 14,
    fontWeight: 600,
    textDecoration: "none",
  },

  deckGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
    gap: 12,
  },
  deckBtn: {
    background: "rgba(255,255,255,0.03)",
    border: "1px solid var(--border)",
    borderRadius: 16,
    overflow: "hidden",
    cursor: "pointer",
    textAlign: "left",
    padding: 0,
  },
  deckBtnStripe: {
    height: 3,
    background: "linear-gradient(90deg, var(--accent), rgba(79,142,247,0.2))",
  },
  deckBtnBody: { padding: "16px 18px" },
  deckBtnName: {
    fontFamily: "'Syne', sans-serif",
    fontSize: 15,
    fontWeight: 700,
    color: "var(--text)",
    marginBottom: 4,
    letterSpacing: "-0.02em",
  },
  deckBtnMeta: { fontSize: 12, color: "var(--muted)", marginBottom: 14 },
  deckBtnReview: {
    display: "inline-flex",
    alignItems: "center",
    fontSize: 12,
    fontWeight: 600,
    color: "var(--accent)",
    background: "rgba(79,142,247,0.1)",
    border: "1px solid rgba(79,142,247,0.25)",
    borderRadius: 8,
    padding: "5px 12px",
  },

  reviewHeader: { marginBottom: 24 },
  backBtn: {
    display: "inline-flex",
    alignItems: "center",
    padding: "8px 14px",
    borderRadius: 10,
    background: "var(--surface)",
    border: "1px solid var(--border)",
    color: "var(--muted)",
    fontSize: 13,
    cursor: "pointer",
    marginBottom: 16,
    transition: "background 0.2s",
  },
  reviewTitle: {
    fontFamily: "'Syne', sans-serif",
    fontSize: 26,
    fontWeight: 800,
    color: "var(--text)",
    letterSpacing: "-0.03em",
  },

  progressWrap: { marginBottom: 24 },
  progressHead: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  progressLabel: { fontSize: 13, fontWeight: 500, color: "var(--muted)" },
  progressCount: { fontSize: 13, color: "var(--accent)", fontWeight: 600 },
  progressTrack: {
    height: 4,
    background: "var(--border)",
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    background: "var(--accent)",
    borderRadius: 2,
    transition: "width 0.4s ease",
    boxShadow: "0 0 8px var(--accent-glow)",
  },

  flashcard: {
    background: "rgba(79,142,247,0.05)",
    border: "1px solid rgba(79,142,247,0.18)",
    borderRadius: 20,
    padding: "36px 32px",
    minHeight: 320,
    display: "flex",
    flexDirection: "column",
    marginBottom: 28,
  },
  flashcardBack: {
    background: "rgba(52,211,153,0.05)",
    border: "1px solid rgba(52,211,153,0.18)",
  },
  flashSide: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    color: "var(--muted)",
    marginBottom: 18,
  },
  flashContent: {
    fontSize: 18,
    lineHeight: 1.7,
    color: "var(--text)",
    flex: 1,
  },
  tagsRow: { display: "flex", flexWrap: "wrap", gap: 6, marginTop: 20 },
  tag: {
    fontSize: 11,
    padding: "3px 10px",
    borderRadius: 20,
    background: "var(--surface)",
    border: "1px solid var(--border)",
    color: "var(--muted)",
  },
  flipHint: {
    fontSize: 11,
    color: "var(--muted)",
    marginTop: 20,
    opacity: 0.5,
  },

  qualitySection: { marginBottom: 8 },
  qualityLabel: {
    fontSize: 13,
    color: "var(--muted)",
    textAlign: "center",
    marginBottom: 14,
  },
  qualityGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(6,1fr)",
    gap: 8,
    marginBottom: 16,
  },
  qualityBtn: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "12px 6px",
    borderRadius: 12,
    border: "1px solid",
    fontFamily: "'DM Sans', sans-serif",
  },
  qualityName: { fontSize: 12, fontWeight: 600, marginBottom: 2 },
  qualityNum: { fontSize: 11, opacity: 0.6 },
  keyboardHint: {
    textAlign: "center",
    fontSize: 11,
    color: "var(--muted)",
    opacity: 0.5,
  },

  errorBanner: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    background: "rgba(248,113,113,0.08)",
    border: "1px solid rgba(248,113,113,0.2)",
    borderRadius: 12,
    padding: "12px 16px",
  },

  backToDecksBtn: {
    padding: "12px 28px",
    borderRadius: 12,
    background: "var(--accent)",
    border: "none",
    color: "#fff",
    fontFamily: "'Syne', sans-serif",
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
  },
};
