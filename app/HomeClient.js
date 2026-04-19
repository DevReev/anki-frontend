// app/HomeClient.js
"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { app } from "./lib/firebase";
import Navbar from "../components/NavBar";
import {
  FileUp,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Download,
  ChevronLeft,
  ChevronRight,
  Zap,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export default function HomeClient() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [file, setFile] = useState(null);
  const [pageCount, setPageCount] = useState(0);
  const [pageRange, setPageRange] = useState([1, 1]);
  const [loading, setLoading] = useState(false);
  const [jobId, setJobId] = useState(null);
  const [jobStatus, setJobStatus] = useState(null);
  const [previewCards, setPreviewCards] = useState([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [cardFlipped, setCardFlipped] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

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
    });
    return () => unsubscribe();
  }, [router]);

  const handleFileChange = async (e) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    if (!selectedFile.name.endsWith(".pdf")) {
      setError("Please upload a PDF file");
      return;
    }
    setFile(selectedFile);
    setError("");
    setJobId(null);
    setJobStatus(null);
    setPreviewCards([]);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      const res = await fetch(`${API}/page-count`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      setPageCount(data.page_count);
      setPageRange([1, data.page_count]);
    } catch {
      setError("Failed to read PDF");
    }
  };

  const handleGenerate = async () => {
    if (!file || !token) return;
    setLoading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("page_start", pageRange[0]);
      formData.append("page_end", pageRange[1]);
      const res = await fetch(`${API}/generate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) throw new Error("Generation failed");
      const data = await res.json();
      setJobId(data.job_id);
      pollJobStatus(data.job_id);
    } catch (err) {
      setError(err.message || "Generation failed");
      setLoading(false);
    }
  };

  const pollJobStatus = async (id) => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API}/status/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        setJobStatus(data);
        if (data.status === "done") {
          clearInterval(interval);
          setPreviewCards(data.cards_preview || []);
          setCurrentCardIndex(0);
          setCardFlipped(false);
          setLoading(false);
        } else if (data.status === "error") {
          clearInterval(interval);
          setError(data.error || "Generation failed");
          setLoading(false);
        }
      } catch {
        console.error("Poll error");
      }
    }, 2000);
  };

  const nextCard = () => {
    if (currentCardIndex < previewCards.length - 1) {
      setCurrentCardIndex((i) => i + 1);
      setCardFlipped(false);
    }
  };
  const prevCard = () => {
    if (currentCardIndex > 0) {
      setCurrentCardIndex((i) => i - 1);
      setCardFlipped(false);
    }
  };

  if (!user)
    return (
      <div style={styles.loadingScreen}>
        <div style={styles.spinner}>
          <Loader2 size={32} style={{ animation: "spin 1s linear infinite" }} />
        </div>
      </div>
    );

  const currentCard = previewCards[currentCardIndex];

  return (
    <>
      <style>{globalStyles}</style>
      <div style={styles.root}>
        <Navbar />
        <div style={styles.container}>
          <div style={styles.grid}>
            {/* LEFT: Upload & Settings */}
            <div style={styles.leftCol}>
              <div style={styles.card}>
                <div style={styles.cardHeader}>
                  <h2 style={styles.cardTitle}>Create New Deck</h2>
                  <p style={styles.cardSubtitle}>
                    Upload a PDF and generate flashcards using AI
                  </p>
                </div>
                <div style={styles.cardBody}>
                  {/* Drop Zone */}
                  <label style={styles.dropZone}>
                    <FileUp
                      size={28}
                      style={{ color: "var(--accent)", marginBottom: 10 }}
                    />
                    <span style={styles.dropZoneText}>Click to upload PDF</span>
                    <span style={styles.dropZoneHint}>or drag and drop</span>
                    <input
                      type="file"
                      accept=".pdf"
                      onChange={handleFileChange}
                      style={{ display: "none" }}
                    />
                  </label>

                  {/* File Info */}
                  {file && (
                    <div style={styles.infoRow}>
                      <CheckCircle2
                        size={15}
                        style={{ color: "var(--green)" }}
                      />
                      <span style={styles.infoText}>
                        {file.name} · {pageCount} pages
                      </span>
                    </div>
                  )}

                  {/* Page Range */}
                  {pageCount > 0 && (
                    <div style={styles.rangeSection}>
                      <div style={styles.rangeHeader}>
                        <span style={styles.label}>Page Range</span>
                        <span style={styles.rangeValue}>
                          {pageRange[0]} – {pageRange[1]}
                        </span>
                      </div>
                      <div style={styles.sliderWrap}>
                        <span style={styles.sliderLabel}>Start</span>
                        <input
                          type="range"
                          min={1}
                          max={pageCount}
                          value={pageRange[0]}
                          onChange={(e) =>
                            setPageRange([+e.target.value, pageRange[1]])
                          }
                          style={styles.slider}
                          className="af-slider"
                        />
                      </div>
                      <div style={styles.sliderWrap}>
                        <span style={styles.sliderLabel}>End</span>
                        <input
                          type="range"
                          min={1}
                          max={pageCount}
                          value={pageRange[1]}
                          onChange={(e) =>
                            setPageRange([pageRange[0], +e.target.value])
                          }
                          style={styles.slider}
                          className="af-slider"
                        />
                      </div>
                    </div>
                  )}

                  {/* Error */}
                  {error && (
                    <div style={styles.errorRow}>
                      <AlertCircle
                        size={15}
                        style={{ color: "var(--red)", flexShrink: 0 }}
                      />
                      <span style={styles.errorText}>{error}</span>
                    </div>
                  )}

                  {/* Generate Button */}
                  <button
                    onClick={handleGenerate}
                    disabled={!file || loading || pageRange[0] > pageRange[1]}
                    style={{
                      ...styles.generateBtn,
                      opacity: !file || loading ? 0.5 : 1,
                    }}
                    className="af-btn-glow"
                  >
                    {loading ? (
                      <>
                        <Loader2
                          size={16}
                          className="af-spin"
                          style={{ marginRight: 8 }}
                        />
                        Generating…
                      </>
                    ) : (
                      <>
                        <Zap size={16} style={{ marginRight: 8 }} />
                        Generate Deck
                      </>
                    )}
                  </button>

                  {/* Status */}
                  {jobStatus && (
                    <div style={styles.statusBox}>
                      <span style={styles.statusDot} />
                      <span style={styles.statusText}>
                        {jobStatus.status}
                        {jobStatus.card_count
                          ? ` · ${jobStatus.card_count} cards`
                          : ""}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* RIGHT: Preview */}
            <div style={styles.rightCol}>
              {previewCards.length > 0 ? (
                <div style={styles.card}>
                  <div
                    style={{ ...styles.cardHeader, ...styles.previewHeader }}
                  >
                    <div>
                      <h2 style={styles.cardTitle}>
                        Preview{" "}
                        <span style={styles.previewCount}>
                          {previewCards.length}
                        </span>
                      </h2>
                      <p style={styles.cardSubtitle}>
                        Card {currentCardIndex + 1} of {previewCards.length}
                      </p>
                    </div>
                    {jobStatus?.download_url && (
                      <a
                        href={jobStatus.download_url}
                        download
                        target="_blank"
                        rel="noopener noreferrer"
                        style={styles.downloadBtn}
                      >
                        <Download size={14} style={{ marginRight: 6 }} />
                        Download
                      </a>
                    )}
                  </div>
                  <div style={styles.cardBody}>
                    {/* Flashcard */}
                    <div
                      onClick={() => setCardFlipped(!cardFlipped)}
                      style={{
                        ...styles.flashcard,
                        ...(cardFlipped ? styles.flashcardFlipped : {}),
                      }}
                      className="af-flashcard"
                    >
                      <div style={styles.flashSide}>
                        {cardFlipped ? "Answer" : "Question"}
                      </div>
                      <div
                        style={styles.flashContent}
                        dangerouslySetInnerHTML={{
                          __html: cardFlipped
                            ? currentCard.back
                            : currentCard.front,
                        }}
                      />
                      {currentCard.tags?.length > 0 && (
                        <div style={styles.tagsRow}>
                          {currentCard.tags.slice(0, 3).map((tag, i) => (
                            <span key={i} style={styles.tag}>
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                      <div style={styles.flipHint}>
                        Click to{" "}
                        {cardFlipped ? "show question" : "reveal answer"}
                      </div>
                    </div>

                    {/* Navigation */}
                    <div style={styles.navRow}>
                      <button
                        onClick={prevCard}
                        disabled={currentCardIndex === 0}
                        style={styles.navBtn}
                        className="af-nav-btn"
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <div style={styles.dots}>
                        {previewCards.map((_, i) => (
                          <button
                            key={i}
                            onClick={() => {
                              setCurrentCardIndex(i);
                              setCardFlipped(false);
                            }}
                            style={{
                              ...styles.dot,
                              ...(i === currentCardIndex
                                ? styles.dotActive
                                : {}),
                            }}
                          />
                        ))}
                      </div>
                      <button
                        onClick={nextCard}
                        disabled={currentCardIndex === previewCards.length - 1}
                        style={styles.navBtn}
                        className="af-nav-btn"
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ ...styles.card, ...styles.emptyPreview }}>
                  <div style={styles.emptyIcon}>
                    <FileUp size={32} style={{ color: "var(--accent)" }} />
                  </div>
                  <p style={styles.emptyText}>Upload a PDF to see preview</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

const globalStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=DM+Sans:wght@300;400;500&display=swap');

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
    --yellow: #fbbf24;
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    background: var(--bg);
    color: var(--text);
    font-family: 'DM Sans', sans-serif;
  }

  .af-slider {
    -webkit-appearance: none;
    appearance: none;
    width: 100%;
    height: 4px;
    border-radius: 2px;
    background: var(--border-strong);
    outline: none;
    cursor: pointer;
  }
  .af-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 16px; height: 16px;
    border-radius: 50%;
    background: var(--accent);
    box-shadow: 0 0 8px var(--accent-glow);
    cursor: pointer;
  }

  .af-btn-glow:hover:not(:disabled) {
    box-shadow: 0 0 24px var(--accent-glow) !important;
    transform: translateY(-1px);
  }
  .af-btn-glow { transition: all 0.2s ease !important; }

  .af-nav-btn:hover:not(:disabled) { background: var(--surface-hover) !important; }
  .af-nav-btn:disabled { opacity: 0.3; cursor: not-allowed; }

  .af-flashcard { transition: all 0.25s ease; }
  .af-flashcard:hover { transform: translateY(-2px); }

  @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
  .af-spin { animation: spin 1s linear infinite; }

  @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
`;

const styles = {
  root: {
    minHeight: "100vh",
    background: "var(--bg)",
    fontFamily: "'DM Sans', sans-serif",
  },
  loadingScreen: {
    minHeight: "100vh",
    background: "var(--bg)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  spinner: { color: "var(--accent)" },
  container: { maxWidth: 1100, margin: "0 auto", padding: "32px 20px" },
  grid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 24,
    "@media(maxWidth:768px)": { gridTemplateColumns: "1fr" },
  },
  leftCol: { display: "flex", flexDirection: "column", gap: 16 },
  rightCol: { display: "flex", flexDirection: "column" },

  card: {
    background: "rgba(255,255,255,0.03)",
    border: "1px solid var(--border)",
    borderRadius: 20,
    overflow: "hidden",
    backdropFilter: "blur(12px)",
    animation: "fadeIn 0.4s ease",
  },
  cardHeader: { padding: "24px 24px 0" },
  previewHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  cardTitle: {
    fontFamily: "'Syne', sans-serif",
    fontSize: 18,
    fontWeight: 700,
    color: "var(--text)",
    letterSpacing: "-0.02em",
  },
  cardSubtitle: { fontSize: 13, color: "var(--muted)", marginTop: 4 },
  cardBody: { padding: 24 },

  previewCount: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    background: "var(--accent)",
    color: "#fff",
    fontSize: 11,
    fontWeight: 700,
    borderRadius: 6,
    padding: "2px 7px",
    marginLeft: 8,
    verticalAlign: "middle",
  },

  dropZone: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    border: "1.5px dashed var(--border-strong)",
    borderRadius: 14,
    padding: "32px 20px",
    cursor: "pointer",
    transition: "border-color 0.2s, background 0.2s",
    marginBottom: 16,
  },
  dropZoneText: {
    fontSize: 14,
    fontWeight: 500,
    color: "var(--text)",
    marginBottom: 4,
  },
  dropZoneHint: { fontSize: 12, color: "var(--muted)" },

  infoRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    background: "rgba(52,211,153,0.08)",
    border: "1px solid rgba(52,211,153,0.2)",
    borderRadius: 10,
    padding: "10px 14px",
    marginBottom: 16,
  },
  infoText: { fontSize: 13, color: "var(--text)" },

  rangeSection: { marginBottom: 20 },
  rangeHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  label: { fontSize: 13, fontWeight: 500, color: "var(--text)" },
  rangeValue: { fontSize: 13, color: "var(--accent)", fontWeight: 600 },
  sliderWrap: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    marginBottom: 10,
  },
  sliderLabel: { fontSize: 11, color: "var(--muted)", width: 28 },
  slider: { flex: 1 },

  errorRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: 8,
    background: "rgba(248,113,113,0.08)",
    border: "1px solid rgba(248,113,113,0.2)",
    borderRadius: 10,
    padding: "10px 14px",
    marginBottom: 16,
  },
  errorText: { fontSize: 13, color: "var(--red)" },

  generateBtn: {
    width: "100%",
    padding: "14px 20px",
    borderRadius: 12,
    background: "var(--accent)",
    border: "none",
    color: "#fff",
    fontFamily: "'Syne', sans-serif",
    fontSize: 15,
    fontWeight: 700,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    letterSpacing: "0.01em",
  },

  statusBox: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 10,
    padding: "10px 14px",
    marginTop: 14,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: "var(--green)",
    boxShadow: "0 0 8px var(--green)",
    flexShrink: 0,
  },
  statusText: { fontSize: 13, color: "var(--muted)" },

  downloadBtn: {
    display: "flex",
    alignItems: "center",
    padding: "8px 14px",
    borderRadius: 10,
    background: "var(--surface)",
    border: "1px solid var(--border-strong)",
    color: "var(--text)",
    fontSize: 13,
    fontWeight: 500,
    textDecoration: "none",
    transition: "background 0.2s",
  },

  flashcard: {
    background: "rgba(79,142,247,0.06)",
    border: "1px solid rgba(79,142,247,0.2)",
    borderRadius: 16,
    padding: 28,
    cursor: "pointer",
    minHeight: 260,
    display: "flex",
    flexDirection: "column",
    marginBottom: 20,
  },
  flashcardFlipped: {
    background: "rgba(52,211,153,0.06)",
    border: "1px solid rgba(52,211,153,0.2)",
  },
  flashSide: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    color: "var(--muted)",
    marginBottom: 14,
  },
  flashContent: {
    fontSize: 16,
    lineHeight: 1.65,
    color: "var(--text)",
    flex: 1,
  },
  tagsRow: { display: "flex", flexWrap: "wrap", gap: 6, marginTop: 16 },
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
    marginTop: 16,
    opacity: 0.6,
  },

  navRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  navBtn: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 38,
    height: 38,
    borderRadius: 10,
    background: "var(--surface)",
    border: "1px solid var(--border)",
    color: "var(--text)",
    cursor: "pointer",
    transition: "background 0.2s",
  },
  dots: { display: "flex", gap: 6, alignItems: "center" },
  dot: {
    width: 6,
    height: 6,
    borderRadius: "50%",
    background: "var(--border-strong)",
    border: "none",
    cursor: "pointer",
    padding: 0,
    transition: "all 0.2s",
  },
  dotActive: { width: 18, borderRadius: 3, background: "var(--accent)" },

  emptyPreview: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 420,
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
    marginBottom: 16,
  },
  emptyText: { fontSize: 14, color: "var(--muted)" },
};
