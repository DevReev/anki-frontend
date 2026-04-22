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
    color: "rgba(107,31,42,0.07)",
    border: "rgba(107,31,42,0.25)",
    text: "var(--burgundy)",
  },
  {
    label: "Hard",
    score: 1,
    color: "rgba(139,47,61,0.06)",
    border: "rgba(139,47,61,0.2)",
    text: "var(--burgundy-light)",
  },
  {
    label: "Tough",
    score: 2,
    color: "rgba(196,150,58,0.07)",
    border: "rgba(196,150,58,0.25)",
    text: "var(--gold)",
  },
  {
    label: "Good",
    score: 3,
    color: "rgba(42,122,74,0.07)",
    border: "rgba(42,122,74,0.25)",
    text: "var(--green)",
  },
  {
    label: "Easy",
    score: 4,
    color: "rgba(26,18,8,0.04)",
    border: "rgba(26,18,8,0.15)",
    text: "var(--ink-soft)",
  },
  {
    label: "Perfect",
    score: 5,
    color: "rgba(26,18,8,0.08)",
    border: "rgba(26,18,8,0.25)",
    text: "var(--ink)",
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
              size={26}
              className="af-spin"
              style={{ color: "var(--burgundy)" }}
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
              {/* Page heading */}
              <div style={S.pageHeading}>
                <p style={S.eyebrow}>Spaced Repetition</p>
                <h1 style={S.pageTitle}>
                  Review
                  <br />
                  <em style={S.pageTitleItalic}>Session</em>
                </h1>
              </div>
              <div style={S.headingRule} />

              {/* Stats strip */}
              {stats && (
                <div style={S.statsStrip}>
                  {[
                    {
                      icon: <BarChart3 size={16} />,
                      label: "Total Cards",
                      value: stats.total_cards,
                    },
                    {
                      icon: <Calendar size={16} />,
                      label: "Due Today",
                      value: stats.cards_due,
                    },
                    {
                      icon: <Zap size={16} />,
                      label: "Day Streak",
                      value: stats.review_streak,
                    },
                  ].map((s, i) => (
                    <div key={i} style={S.statCard}>
                      <div style={S.statIcon}>{s.icon}</div>
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
                  <p style={S.cardEyebrow}>Select</p>
                  <h2 style={S.cardTitle}>Choose a Deck to Review</h2>
                  <p style={S.cardSub}>Practice with spaced repetition</p>
                </div>
                <div style={S.cardBody}>
                  {decks.length === 0 ? (
                    <div style={S.noDeckEmpty}>
                      <AlertCircle
                        size={24}
                        style={{
                          color: "var(--rule-strong)",
                          marginBottom: 12,
                        }}
                      />
                      <p style={S.noDeckText}>No decks yet</p>
                      <a
                        href="/"
                        style={S.createLink}
                        className="af-btn-primary"
                      >
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
                              Review <Zap size={11} style={{ marginLeft: 5 }} />
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
                  <ChevronLeft size={14} style={{ marginRight: 4 }} />
                  Back
                </button>
                <div style={S.reviewTitleBlock}>
                  <p style={S.eyebrow}>Reviewing</p>
                  <h1 style={S.reviewTitle}>{selectedDeck?.deck_name}</h1>
                </div>
              </div>
              <div style={S.headingRule} />

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
                          size={40}
                          style={{ color: "var(--green)", marginBottom: 16 }}
                        />
                        <h3 style={{ ...S.cardTitle, marginBottom: 10 }}>
                          Review Complete!
                        </h3>
                        <p
                          style={{
                            fontFamily: "'Crimson Pro',serif",
                            fontStyle: "italic",
                            fontSize: 15,
                            color: "var(--ink-muted)",
                            marginBottom: 24,
                          }}
                        >
                          Great work. You'll see more cards when they're due.
                        </p>
                        <button
                          onClick={() => {
                            setReviewing(false);
                            setCards([]);
                            setSelectedDeck(null);
                            setError("");
                          }}
                          style={S.backToDecksBtn}
                          className="af-btn-primary"
                        >
                          Back to Decks
                        </button>
                      </>
                    ) : (
                      <>
                        <AlertCircle
                          size={40}
                          style={{
                            color: "var(--rule-strong)",
                            marginBottom: 16,
                          }}
                        />
                        <h3 style={{ ...S.cardTitle, marginBottom: 10 }}>
                          No Cards Due
                        </h3>
                        <p
                          style={{
                            fontFamily: "'Crimson Pro',serif",
                            fontStyle: "italic",
                            fontSize: 15,
                            color: "var(--ink-muted)",
                          }}
                        >
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
                size={13}
                style={{ color: "var(--burgundy)", flexShrink: 0 }}
              />
              <span style={S.errorText}>{error}</span>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

const globalStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,700&family=IBM+Plex+Mono:wght@400;500&family=Crimson+Pro:ital,wght@0,300;0,400;0,600;1,300;1,400&display=swap');

  :root {
    --cream: #F5F0E8;
    --cream-dark: #EDE6D6;
    --ink: #1A1208;
    --ink-soft: #3D3322;
    --ink-muted: #7A6E5A;
    --burgundy: #6B1F2A;
    --burgundy-light: #8B2F3D;
    --gold: #C4963A;
    --rule: #C8BFA8;
    --rule-strong: #8A7A62;
    --white: #FDFBF7;
    --green: #2A7A4A;
    --red: #6B1F2A;
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    background: var(--cream);
    color: var(--ink);
    font-family: 'Crimson Pro', Georgia, serif;
  }

  @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
  .af-spin { animation: spin 1s linear infinite; }
  @keyframes fadeUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }

  .af-btn-primary { transition: background 0.15s !important; }
  .af-btn-primary:hover { background: var(--ink-soft) !important; }

  .af-flashcard { transition: all 0.2s ease; }
  .af-flashcard:hover { transform: translateY(-2px); }

  .af-quality-btn { transition: all 0.15s ease; cursor: pointer; }
  .af-quality-btn:hover { transform: translateY(-1px); filter: brightness(0.95); }

  .af-deck-btn { transition: transform 0.2s, box-shadow 0.2s; animation: fadeUp 0.3s ease; }
  .af-deck-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(26,18,8,0.12) !important; }

  .af-back-btn:hover { background: var(--cream-dark) !important; border-color: var(--rule-strong) !important; }
`;

const S = {
  root: {
    minHeight: "100vh",
    background: "var(--cream)",
    fontFamily: "'Crimson Pro', Georgia, serif",
  },
  loadingCenter: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "60vh",
  },
  container: { maxWidth: 900, margin: "0 auto", padding: "40px 24px 80px" },

  pageHeading: { paddingBottom: 24 },
  eyebrow: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 10,
    letterSpacing: "0.15em",
    textTransform: "uppercase",
    color: "var(--burgundy)",
    marginBottom: 10,
  },
  pageTitle: {
    fontFamily: "'Playfair Display', Georgia, serif",
    fontSize: "clamp(28px, 4vw, 44px)",
    fontWeight: 900,
    lineHeight: 1.1,
    letterSpacing: "-0.02em",
    color: "var(--ink)",
  },
  pageTitleItalic: { fontStyle: "italic", fontWeight: 700 },
  headingRule: { borderTop: "2px solid var(--ink)", marginBottom: 32 },

  statsStrip: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 0,
    borderTop: "2px solid var(--ink)",
    borderBottom: "1px solid var(--rule)",
    marginBottom: 28,
  },
  statCard: {
    padding: "18px 20px",
    borderRight: "1px solid var(--rule)",
    display: "flex",
    alignItems: "center",
    gap: 14,
    background: "var(--white)",
  },
  statIcon: {
    width: 36,
    height: 36,
    border: "1px solid var(--rule)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    color: "var(--burgundy)",
    background: "var(--cream)",
  },
  statValue: {
    fontFamily: "'Playfair Display', serif",
    fontSize: 28,
    fontWeight: 900,
    color: "var(--ink)",
    lineHeight: 1,
  },
  statLabel: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 9,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    color: "var(--ink-muted)",
    marginTop: 4,
  },

  card: {
    background: "var(--white)",
    border: "1px solid var(--rule)",
    borderTop: "2px solid var(--ink)",
    overflow: "hidden",
  },
  cardHeader: { padding: "24px 24px 0" },
  cardEyebrow: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 10,
    letterSpacing: "0.15em",
    textTransform: "uppercase",
    color: "var(--burgundy)",
    marginBottom: 6,
  },
  cardTitle: {
    fontFamily: "'Playfair Display', serif",
    fontSize: 20,
    fontWeight: 700,
    color: "var(--ink)",
    letterSpacing: "-0.01em",
  },
  cardSub: {
    fontFamily: "'Crimson Pro', serif",
    fontStyle: "italic",
    fontSize: 15,
    color: "var(--ink-muted)",
    marginTop: 4,
  },
  cardBody: { padding: 24 },

  noDeckEmpty: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "40px 20px",
    textAlign: "center",
  },
  noDeckText: {
    fontFamily: "'Crimson Pro', serif",
    fontStyle: "italic",
    fontSize: 15,
    color: "var(--ink-muted)",
    marginBottom: 16,
  },
  createLink: {
    padding: "11px 22px",
    background: "var(--ink)",
    border: "none",
    color: "var(--cream)",
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 10,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    textDecoration: "none",
    display: "inline-block",
    cursor: "pointer",
  },

  deckGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
    gap: 0,
    borderTop: "1px solid var(--rule)",
  },
  deckBtn: {
    background: "var(--white)",
    border: "none",
    borderBottom: "1px solid var(--rule)",
    borderRight: "1px solid var(--rule)",
    overflow: "hidden",
    cursor: "pointer",
    textAlign: "left",
    padding: 0,
    transition: "background 0.15s",
  },
  deckBtnStripe: {
    height: 3,
    background: "var(--burgundy)",
  },
  deckBtnBody: { padding: "16px 18px" },
  deckBtnName: {
    fontFamily: "'Playfair Display', serif",
    fontSize: 15,
    fontWeight: 700,
    color: "var(--ink)",
    marginBottom: 4,
    letterSpacing: "-0.01em",
    textAlign: "left",
  },
  deckBtnMeta: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 10,
    letterSpacing: "0.08em",
    color: "var(--ink-muted)",
    marginBottom: 14,
  },
  deckBtnReview: {
    display: "inline-flex",
    alignItems: "center",
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 9,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    color: "var(--burgundy)",
    background: "rgba(107,31,42,0.06)",
    border: "1px solid rgba(107,31,42,0.2)",
    padding: "5px 10px",
  },

  reviewHeader: { marginBottom: 16 },
  reviewTitleBlock: { marginTop: 8 },
  backBtn: {
    display: "inline-flex",
    alignItems: "center",
    padding: "8px 14px",
    background: "var(--white)",
    border: "1px solid var(--rule)",
    color: "var(--ink-muted)",
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 10,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    cursor: "pointer",
    marginBottom: 16,
    transition: "all 0.15s",
  },
  reviewTitle: {
    fontFamily: "'Playfair Display', serif",
    fontSize: "clamp(24px, 3vw, 36px)",
    fontWeight: 900,
    color: "var(--ink)",
    letterSpacing: "-0.02em",
    fontStyle: "italic",
  },

  progressWrap: { marginBottom: 24 },
  progressHead: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  progressLabel: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 10,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    color: "var(--ink-muted)",
  },
  progressCount: {
    fontFamily: "'Playfair Display', serif",
    fontSize: 15,
    fontWeight: 700,
    color: "var(--burgundy)",
  },
  progressTrack: {
    height: 2,
    background: "var(--rule)",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    background: "var(--burgundy)",
    transition: "width 0.4s ease",
  },

  flashcard: {
    background: "var(--white)",
    border: "1px solid var(--rule)",
    borderTop: "2px solid var(--ink)",
    padding: "36px 32px",
    minHeight: 320,
    display: "flex",
    flexDirection: "column",
    marginBottom: 28,
    cursor: "pointer",
    transition: "all 0.2s ease",
  },
  flashcardBack: {
    borderTopColor: "var(--burgundy)",
    background: "rgba(107,31,42,0.03)",
  },
  flashSide: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 9,
    letterSpacing: "0.15em",
    textTransform: "uppercase",
    color: "var(--ink-muted)",
    marginBottom: 20,
  },
  flashContent: {
    fontFamily: "'Crimson Pro', serif",
    fontSize: 18,
    lineHeight: 1.7,
    color: "var(--ink)",
    flex: 1,
  },
  tagsRow: { display: "flex", flexWrap: "wrap", gap: 6, marginTop: 20 },
  tag: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 9,
    letterSpacing: "0.08em",
    padding: "3px 9px",
    background: "var(--cream-dark)",
    border: "1px solid var(--rule)",
    color: "var(--ink-muted)",
  },
  flipHint: {
    fontFamily: "'Crimson Pro', serif",
    fontStyle: "italic",
    fontSize: 12,
    color: "var(--rule-strong)",
    marginTop: 20,
  },

  qualitySection: { marginBottom: 8 },
  qualityLabel: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 10,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    color: "var(--ink-muted)",
    textAlign: "center",
    marginBottom: 14,
  },
  qualityGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(6, 1fr)",
    gap: 0,
    border: "1px solid var(--rule)",
    marginBottom: 12,
  },
  qualityBtn: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "14px 6px",
    borderRight: "1px solid var(--rule)",
    border: "none",
    borderRight: "1px solid rgba(200,191,168,0.5)",
    fontFamily: "'Crimson Pro', serif",
    transition: "all 0.15s",
  },
  qualityName: {
    fontFamily: "'Playfair Display', serif",
    fontSize: 13,
    fontWeight: 700,
    marginBottom: 2,
  },
  qualityNum: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 9,
    letterSpacing: "0.1em",
    opacity: 0.5,
  },
  keyboardHint: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 9,
    letterSpacing: "0.08em",
    textAlign: "center",
    color: "var(--rule-strong)",
  },

  errorBanner: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    borderLeft: "2px solid var(--burgundy)",
    background: "rgba(107,31,42,0.05)",
    padding: "12px 16px",
  },
  errorText: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 11,
    letterSpacing: "0.04em",
    color: "var(--burgundy)",
  },

  backToDecksBtn: {
    padding: "12px 28px",
    background: "var(--ink)",
    border: "none",
    color: "var(--cream)",
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 10,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    cursor: "pointer",
  },
};
