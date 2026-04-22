// app/account/AccountClient.js
"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { app } from "../lib/firebase";
import Navbar from "../../components/NavBar";
import {
  Loader2,
  Download,
  Trash2,
  FileText,
  AlertCircle,
  Plus,
  CheckCircle2,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export default function AccountClient() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [decks, setDecks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [error, setError] = useState("");
  const router = useRouter();

  useEffect(() => {
    if (!app) {
      setError("Firebase not configured");
      setLoading(false);
      return;
    }
    const auth = getAuth(app);
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        router.push("/auth");
        return;
      }
      setUser(currentUser);
      const idToken = await currentUser.getIdToken(true);
      setToken(idToken);
      fetchDecks(idToken);
    });
    return () => unsubscribe();
  }, [router]);

  async function fetchDecks(currentToken) {
    try {
      const res = await fetch(`${API}/user/decks`, {
        headers: { Authorization: `Bearer ${currentToken}` },
      });
      if (!res.ok) throw new Error("Failed to fetch decks");
      const data = await res.json();
      setDecks(data.decks || []);
    } catch (err) {
      setError(err.message || "Could not load saved decks");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(deckId) {
    if (!token) return;
    setDeleting(deckId);
    setDeleteConfirm(null);
    try {
      const res = await fetch(`${API}/user/decks/${deckId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Delete failed");
      setDecks((prev) => prev.filter((d) => d.id !== deckId));
    } catch (err) {
      setError("Failed to delete: " + err.message);
    } finally {
      setDeleting(null);
    }
  }

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

  return (
    <>
      <style>{globalStyles}</style>
      <div style={S.root}>
        <Navbar />
        <div style={S.container}>
          {/* Header */}
          <div style={S.pageHeading}>
            <p style={S.eyebrow}>Personal Archive</p>
            <div style={S.headingRow}>
              <div>
                <h1 style={S.pageTitle}>
                  My Saved
                  <br />
                  <em style={S.pageTitleItalic}>Decks</em>
                </h1>
                <p style={S.pageSub}>
                  {user?.email}
                  {" · "}
                  <span style={{ color: "var(--burgundy)" }}>
                    {decks.length} deck{decks.length !== 1 ? "s" : ""}
                  </span>
                </p>
              </div>
              <button
                onClick={() => router.push("/")}
                style={S.newBtn}
                className="af-btn-primary"
              >
                <Plus size={14} style={{ marginRight: 6 }} />
                New Deck
              </button>
            </div>
          </div>
          <div style={S.headingRule} />

          {/* Error */}
          {error && (
            <div style={S.errorBanner}>
              <AlertCircle
                size={13}
                style={{ color: "var(--burgundy)", flexShrink: 0 }}
              />
              <span style={S.errorText}>{error}</span>
            </div>
          )}

          {/* Empty state */}
          {decks.length === 0 ? (
            <div style={S.emptyCard}>
              <div style={S.emptyIcon}>
                <FileText size={28} style={{ color: "var(--burgundy)" }} />
              </div>
              <p style={S.emptyTitle}>No saved decks yet</p>
              <p style={S.emptySub}>Generate your first deck from a PDF</p>
              <button
                onClick={() => router.push("/")}
                style={S.emptyBtn}
                className="af-btn-primary"
              >
                Create Your First Deck
              </button>
            </div>
          ) : (
            <div style={S.grid}>
              {decks.map((deck) => (
                <DeckCard
                  key={deck.id}
                  deck={deck}
                  onDeleteRequest={() => setDeleteConfirm(deck.id)}
                  isDeleting={deleting === deck.id}
                />
              ))}
            </div>
          )}
        </div>

        {/* Delete confirmation modal */}
        {deleteConfirm && (
          <div style={S.modalOverlay} onClick={() => setDeleteConfirm(null)}>
            <div style={S.modal} onClick={(e) => e.stopPropagation()}>
              <h3 style={S.modalTitle}>Delete this deck?</h3>
              <p style={S.modalBody}>
                &ldquo;{decks.find((d) => d.id === deleteConfirm)?.deck_name}
                &rdquo; and all its cards will be permanently removed. This
                cannot be undone.
              </p>
              <div style={S.modalActions}>
                <button
                  onClick={() => setDeleteConfirm(null)}
                  style={S.cancelBtn}
                  className="af-btn-ghost"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDelete(deleteConfirm)}
                  style={S.confirmDeleteBtn}
                  className="af-btn-delete"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function DeckCard({ deck, onDeleteRequest, isDeleting }) {
  const createdAt = new Date(deck.created_at).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div style={S.deckCard} className="af-deck-card">
      <div style={S.deckStripe} />
      <div style={S.deckBody}>
        <div style={S.deckMeta}>
          <span style={S.deckCount}>{deck.card_count} cards</span>
          <span style={S.deckDate}>{createdAt}</span>
        </div>
        <h3 style={S.deckName}>{deck.deck_name}</h3>

        {deck.cards_preview?.[0] && (
          <div style={S.previewBox}>
            <span style={S.previewLabel}>Preview</span>
            <div
              style={S.previewText}
              dangerouslySetInnerHTML={{
                __html: deck.cards_preview[0].front.slice(0, 100),
              }}
            />
          </div>
        )}

        {deck.cards_preview?.[0]?.tags?.length > 0 && (
          <div style={S.tagsRow}>
            {deck.cards_preview[0].tags.slice(0, 3).map((tag, i) => (
              <span key={i} style={S.tag}>
                {tag}
              </span>
            ))}
          </div>
        )}

        <div style={S.deckActions}>
          {deck.download_url && (
            <a
              href={deck.download_url}
              download
              target="_blank"
              rel="noopener noreferrer"
              style={S.downloadBtn}
              className="af-action-btn"
            >
              <Download size={12} style={{ marginRight: 6 }} />
              Download
            </a>
          )}
          <button
            onClick={onDeleteRequest}
            disabled={isDeleting}
            style={S.deleteBtn}
            className="af-delete-btn"
          >
            {isDeleting ? (
              <Loader2 size={13} className="af-spin" />
            ) : (
              <Trash2 size={13} />
            )}
          </button>
        </div>
      </div>
    </div>
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

  .af-btn-ghost { transition: all 0.15s; }
  .af-btn-ghost:hover { background: var(--cream-dark) !important; }

  .af-btn-delete { transition: all 0.15s; }
  .af-btn-delete:hover { background: var(--burgundy) !important; color: var(--cream) !important; border-color: var(--burgundy) !important; }

  .af-deck-card { transition: transform 0.2s, box-shadow 0.2s; animation: fadeUp 0.3s ease; }
  .af-deck-card:hover { transform: translateY(-2px); box-shadow: 0 8px 28px rgba(26,18,8,0.12) !important; }

  .af-action-btn { transition: all 0.15s; }
  .af-action-btn:hover { background: var(--ink) !important; color: var(--cream) !important; border-color: var(--ink) !important; }

  .af-delete-btn:hover { background: rgba(107,31,42,0.08) !important; border-color: var(--burgundy) !important; color: var(--burgundy) !important; }
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
  container: { maxWidth: 1200, margin: "0 auto", padding: "40px 24px 80px" },

  pageHeading: { paddingBottom: 24 },
  eyebrow: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 10,
    letterSpacing: "0.15em",
    textTransform: "uppercase",
    color: "var(--burgundy)",
    marginBottom: 10,
  },
  headingRow: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 16,
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
  pageSub: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 10,
    letterSpacing: "0.08em",
    color: "var(--ink-muted)",
    marginTop: 10,
  },
  newBtn: {
    display: "flex",
    alignItems: "center",
    padding: "11px 20px",
    background: "var(--ink)",
    border: "none",
    color: "var(--cream)",
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 10,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    cursor: "pointer",
    marginTop: 4,
  },
  headingRule: { borderTop: "2px solid var(--ink)", marginBottom: 32 },

  errorBanner: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    borderLeft: "2px solid var(--burgundy)",
    background: "rgba(107,31,42,0.05)",
    padding: "12px 16px",
    marginBottom: 24,
  },
  errorText: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 11,
    letterSpacing: "0.04em",
    color: "var(--burgundy)",
  },

  emptyCard: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    background: "var(--white)",
    border: "1px dashed var(--rule-strong)",
    padding: "64px 20px",
    textAlign: "center",
  },
  emptyIcon: {
    width: 60,
    height: 60,
    border: "1px solid var(--rule)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
    background: "var(--cream)",
  },
  emptyTitle: {
    fontFamily: "'Playfair Display', serif",
    fontSize: 20,
    fontWeight: 700,
    color: "var(--ink)",
    marginBottom: 8,
  },
  emptySub: {
    fontFamily: "'Crimson Pro', serif",
    fontStyle: "italic",
    fontSize: 15,
    color: "var(--ink-muted)",
    marginBottom: 24,
  },
  emptyBtn: {
    padding: "12px 24px",
    background: "var(--ink)",
    border: "none",
    color: "var(--cream)",
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 10,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    cursor: "pointer",
  },

  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
    gap: 0,
    borderTop: "2px solid var(--ink)",
  },

  deckCard: {
    background: "var(--white)",
    border: "1px solid var(--rule)",
    borderTop: "none",
    overflow: "hidden",
  },
  deckStripe: {
    height: 3,
    background: "var(--burgundy)",
  },
  deckBody: { padding: "18px 20px 20px" },
  deckMeta: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  deckCount: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 9,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    color: "var(--burgundy)",
  },
  deckDate: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 9,
    letterSpacing: "0.06em",
    color: "var(--ink-muted)",
  },
  deckName: {
    fontFamily: "'Playfair Display', serif",
    fontSize: 17,
    fontWeight: 700,
    color: "var(--ink)",
    marginBottom: 14,
    lineHeight: 1.3,
    letterSpacing: "-0.01em",
  },

  previewBox: {
    background: "var(--cream)",
    border: "1px solid var(--rule)",
    padding: "10px 12px",
    marginBottom: 12,
  },
  previewLabel: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 9,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    color: "var(--ink-muted)",
    display: "block",
    marginBottom: 6,
  },
  previewText: {
    fontFamily: "'Crimson Pro', serif",
    fontStyle: "italic",
    fontSize: 13,
    color: "var(--ink-soft)",
    lineHeight: 1.5,
    display: "-webkit-box",
    WebkitLineClamp: 3,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
  },

  tagsRow: { display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 14 },
  tag: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 9,
    letterSpacing: "0.08em",
    padding: "3px 9px",
    background: "var(--cream-dark)",
    border: "1px solid var(--rule)",
    color: "var(--ink-muted)",
  },

  deckActions: { display: "flex", gap: 8, marginTop: 4 },
  downloadBtn: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "9px 14px",
    background: "var(--white)",
    border: "1px solid var(--rule-strong)",
    color: "var(--ink-soft)",
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 9,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    textDecoration: "none",
    transition: "all 0.15s",
  },
  deleteBtn: {
    width: 36,
    height: 36,
    background: "var(--white)",
    border: "1px solid var(--rule)",
    color: "var(--ink-muted)",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "all 0.15s",
    flexShrink: 0,
  },

  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(26,18,8,0.75)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
    padding: 20,
  },
  modal: {
    background: "var(--cream)",
    border: "1px solid var(--rule)",
    borderTop: "3px solid var(--burgundy)",
    padding: 32,
    maxWidth: 420,
    width: "100%",
  },
  modalTitle: {
    fontFamily: "'Playfair Display', serif",
    fontSize: 20,
    fontWeight: 700,
    color: "var(--ink)",
    marginBottom: 12,
  },
  modalBody: {
    fontFamily: "'Crimson Pro', serif",
    fontStyle: "italic",
    fontSize: 15,
    color: "var(--ink-muted)",
    lineHeight: 1.6,
    marginBottom: 24,
  },
  modalActions: { display: "flex", gap: 10, justifyContent: "flex-end" },
  cancelBtn: {
    padding: "10px 18px",
    background: "var(--white)",
    border: "1px solid var(--rule-strong)",
    color: "var(--ink-soft)",
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 10,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    cursor: "pointer",
  },
  confirmDeleteBtn: {
    padding: "10px 18px",
    background: "rgba(107,31,42,0.08)",
    border: "1px solid rgba(107,31,42,0.35)",
    color: "var(--burgundy)",
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 10,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    fontWeight: 500,
    cursor: "pointer",
  },
};
