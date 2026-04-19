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
              size={28}
              className="af-spin"
              style={{ color: "var(--accent)" }}
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
          <div style={S.header}>
            <div>
              <h1 style={S.pageTitle}>My Decks</h1>
              <p style={S.pageSub}>
                {user?.email} ·{" "}
                <span style={{ color: "var(--accent)" }}>{decks.length}</span>{" "}
                deck{decks.length !== 1 ? "s" : ""}
              </p>
            </div>
            <button
              onClick={() => router.push("/")}
              style={S.newBtn}
              className="af-btn-glow"
            >
              <Plus size={15} style={{ marginRight: 7 }} />
              New Deck
            </button>
          </div>

          {/* Error */}
          {error && (
            <div style={S.errorBanner}>
              <AlertCircle
                size={15}
                style={{ color: "var(--red)", flexShrink: 0 }}
              />
              <span style={{ fontSize: 13, color: "var(--red)" }}>{error}</span>
            </div>
          )}

          {/* Empty state */}
          {decks.length === 0 ? (
            <div style={S.emptyCard}>
              <div style={S.emptyIcon}>
                <FileText size={28} style={{ color: "var(--accent)" }} />
              </div>
              <p style={S.emptyTitle}>No saved decks yet</p>
              <p style={S.emptySub}>Generate your first deck from a PDF</p>
              <button
                onClick={() => router.push("/")}
                style={S.emptyBtn}
                className="af-btn-glow"
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
              <h3 style={S.modalTitle}>Delete Deck?</h3>
              <p style={S.modalBody}>
                This will permanently delete "
                {decks.find((d) => d.id === deleteConfirm)?.deck_name}" and all
                its cards. This cannot be undone.
              </p>
              <div style={S.modalActions}>
                <button
                  onClick={() => setDeleteConfirm(null)}
                  style={S.cancelBtn}
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDelete(deleteConfirm)}
                  style={S.confirmDeleteBtn}
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
      {/* Card top stripe */}
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
            >
              <Download size={13} style={{ marginRight: 6 }} />
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
              <Loader2 size={14} className="af-spin" />
            ) : (
              <Trash2 size={14} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

const globalStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500&display=swap');
  :root {
    --bg: #0d1117;
    --surface: rgba(255,255,255,0.04);
    --surface-hover: rgba(255,255,255,0.07);
    --border: rgba(255,255,255,0.08);
    --border-strong: rgba(255,255,255,0.14);
    --text: #e8eaf0;
    --muted: #6b7280;
    --accent: #4f8ef7;
    --accent-glow: rgba(79,142,247,0.35);
    --green: #34d399;
    --red: #f87171;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: var(--bg); color: var(--text); font-family: 'DM Sans', sans-serif; }

  @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
  .af-spin { animation: spin 1s linear infinite; }

  @keyframes fadeUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }

  .af-btn-glow { transition: all 0.2s ease !important; }
  .af-btn-glow:hover { box-shadow: 0 0 20px var(--accent-glow) !important; transform: translateY(-1px); }

  .af-deck-card { transition: transform 0.2s, box-shadow 0.2s; animation: fadeUp 0.35s ease; }
  .af-deck-card:hover { transform: translateY(-3px); box-shadow: 0 12px 40px rgba(0,0,0,0.4) !important; }

  .af-delete-btn:hover { background: rgba(248,113,113,0.15) !important; border-color: rgba(248,113,113,0.3) !important; color: var(--red) !important; }
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
  container: { maxWidth: 1080, margin: "0 auto", padding: "36px 20px" },

  header: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 32,
    flexWrap: "wrap",
    gap: 16,
  },
  pageTitle: {
    fontFamily: "'Syne', sans-serif",
    fontSize: 28,
    fontWeight: 800,
    color: "var(--text)",
    letterSpacing: "-0.03em",
  },
  pageSub: { fontSize: 14, color: "var(--muted)", marginTop: 5 },
  newBtn: {
    display: "flex",
    alignItems: "center",
    padding: "11px 20px",
    borderRadius: 12,
    background: "var(--accent)",
    border: "none",
    color: "#fff",
    fontFamily: "'Syne', sans-serif",
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
  },

  errorBanner: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    background: "rgba(248,113,113,0.08)",
    border: "1px solid rgba(248,113,113,0.2)",
    borderRadius: 12,
    padding: "12px 16px",
    marginBottom: 24,
  },

  emptyCard: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(255,255,255,0.03)",
    border: "1px solid var(--border)",
    borderRadius: 20,
    padding: "64px 20px",
    textAlign: "center",
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 18,
    background: "var(--surface)",
    border: "1px solid var(--border)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  emptyTitle: {
    fontFamily: "'Syne', sans-serif",
    fontSize: 18,
    fontWeight: 700,
    color: "var(--text)",
    marginBottom: 8,
  },
  emptySub: { fontSize: 14, color: "var(--muted)", marginBottom: 24 },
  emptyBtn: {
    padding: "12px 24px",
    borderRadius: 12,
    background: "var(--accent)",
    border: "none",
    color: "#fff",
    fontFamily: "'Syne', sans-serif",
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
  },

  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
    gap: 16,
  },

  deckCard: {
    background: "rgba(255,255,255,0.03)",
    border: "1px solid var(--border)",
    borderRadius: 18,
    overflow: "hidden",
  },
  deckStripe: {
    height: 4,
    background: "linear-gradient(90deg, var(--accent), rgba(79,142,247,0.3))",
  },
  deckBody: { padding: "18px 20px 20px" },
  deckMeta: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  deckCount: {
    fontSize: 11,
    fontWeight: 700,
    color: "var(--accent)",
    background: "rgba(79,142,247,0.1)",
    padding: "3px 9px",
    borderRadius: 20,
    letterSpacing: "0.05em",
  },
  deckDate: { fontSize: 11, color: "var(--muted)" },
  deckName: {
    fontFamily: "'Syne', sans-serif",
    fontSize: 16,
    fontWeight: 700,
    color: "var(--text)",
    marginBottom: 14,
    lineHeight: 1.3,
    letterSpacing: "-0.02em",
  },

  previewBox: {
    background: "rgba(255,255,255,0.03)",
    border: "1px solid var(--border)",
    borderRadius: 10,
    padding: "10px 12px",
    marginBottom: 12,
  },
  previewLabel: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    color: "var(--muted)",
    display: "block",
    marginBottom: 6,
  },
  previewText: {
    fontSize: 12,
    color: "var(--muted)",
    lineHeight: 1.5,
    display: "-webkit-box",
    WebkitLineClamp: 3,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
  },

  tagsRow: { display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 16 },
  tag: {
    fontSize: 11,
    padding: "3px 9px",
    borderRadius: 20,
    background: "var(--surface)",
    border: "1px solid var(--border)",
    color: "var(--muted)",
  },

  deckActions: { display: "flex", gap: 8, marginTop: 4 },
  downloadBtn: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "9px 14px",
    borderRadius: 10,
    background: "var(--surface)",
    border: "1px solid var(--border-strong)",
    color: "var(--text)",
    fontSize: 13,
    fontWeight: 500,
    textDecoration: "none",
    transition: "background 0.2s",
  },
  deleteBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    background: "var(--surface)",
    border: "1px solid var(--border)",
    color: "var(--muted)",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "all 0.2s",
    flexShrink: 0,
  },

  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.7)",
    backdropFilter: "blur(6px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
    padding: 20,
  },
  modal: {
    background: "#161b24",
    border: "1px solid var(--border-strong)",
    borderRadius: 20,
    padding: 28,
    maxWidth: 400,
    width: "100%",
  },
  modalTitle: {
    fontFamily: "'Syne', sans-serif",
    fontSize: 18,
    fontWeight: 700,
    color: "var(--text)",
    marginBottom: 12,
  },
  modalBody: {
    fontSize: 14,
    color: "var(--muted)",
    lineHeight: 1.6,
    marginBottom: 24,
  },
  modalActions: { display: "flex", gap: 10, justifyContent: "flex-end" },
  cancelBtn: {
    padding: "10px 18px",
    borderRadius: 10,
    background: "var(--surface)",
    border: "1px solid var(--border)",
    color: "var(--text)",
    fontSize: 14,
    cursor: "pointer",
  },
  confirmDeleteBtn: {
    padding: "10px 18px",
    borderRadius: 10,
    background: "rgba(248,113,113,0.15)",
    border: "1px solid rgba(248,113,113,0.3)",
    color: "var(--red)",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
  },
};
