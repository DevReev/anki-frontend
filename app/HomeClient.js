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
  FileText,
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
        <Loader2
          size={28}
          className="af-spin"
          style={{ color: "var(--burgundy)" }}
        />
      </div>
    );

  const currentCard = previewCards[currentCardIndex];
  const showDownload = jobStatus?.download_url && previewCards.length > 0;

  return (
    <>
      <style>{globalStyles}</style>
      <div style={styles.root}>
        <Navbar />
        <div style={styles.container}>
          {/* Page heading */}
          <div style={styles.pageHeading}>
            <p style={styles.eyebrow}>New Deck</p>
            <h1 style={styles.pageTitle}>
              Generate Flashcards
              <br />
              <em style={styles.pageTitleItalic}>from a PDF</em>
            </h1>
          </div>
          <div style={styles.headingRule} />

          <div style={styles.grid}>
            {/* LEFT: Upload & Settings */}
            <div style={styles.leftCol}>
              <div style={styles.card}>
                <div style={styles.cardHeader}>
                  <p style={styles.cardEyebrow}>Upload</p>
                  <h2 style={styles.cardTitle}>Source Document</h2>
                  <p style={styles.cardSubtitle}>
                    Upload a PDF and generate flashcards using AI
                  </p>
                </div>
                <div style={styles.cardBody}>
                  {/* Drop Zone */}
                  <label style={styles.dropZone} className="af-drop-zone">
                    <FileUp
                      size={24}
                      style={{ color: "var(--burgundy)", marginBottom: 10 }}
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
                        size={14}
                        style={{ color: "var(--green)", flexShrink: 0 }}
                      />
                      <span style={styles.infoText}>
                        {file.name} · {pageCount} pages
                      </span>
                    </div>
                  )}

                  {/* Page Range */}
                  {pageCount > 0 && (
                    <div style={styles.rangeSection}>
                      <div style={styles.rangeRule} />
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
                        size={14}
                        style={{ color: "var(--burgundy)", flexShrink: 0 }}
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
                      opacity: !file || loading ? 0.45 : 1,
                      cursor: !file || loading ? "not-allowed" : "pointer",
                    }}
                    className="af-btn-primary"
                  >
                    {loading ? (
                      <>
                        <Loader2
                          size={15}
                          className="af-spin"
                          style={{ marginRight: 8 }}
                        />
                        Generating…
                      </>
                    ) : (
                      <>
                        <Zap size={15} style={{ marginRight: 8 }} />
                        Generate Deck
                      </>
                    )}
                  </button>

                  {/* Download Button */}
                  {showDownload && (
                    <a
                      href={jobStatus.download_url}
                      download
                      target="_blank"
                      rel="noopener noreferrer"
                      style={styles.bigDownloadBtn}
                      className="af-btn-download"
                    >
                      <Download size={16} style={{ marginRight: 8 }} />
                      Download Full Deck
                    </a>
                  )}

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

            {/* RIGHT: Preview Area */}
            <div style={styles.rightCol}>
              {previewCards.length > 0 ? (
                <div style={styles.card}>
                  <div
                    style={{ ...styles.cardHeader, ...styles.previewHeader }}
                  >
                    <div>
                      <p style={styles.cardEyebrow}>Preview</p>
                      <h2 style={styles.cardTitle}>
                        Generated Cards{" "}
                        <span style={styles.previewCount}>
                          {previewCards.length}
                        </span>
                      </h2>
                      <p style={styles.cardSubtitle}>
                        Card {currentCardIndex + 1} of {previewCards.length}
                      </p>
                    </div>
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
                        <ChevronLeft size={15} />
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
                        <ChevronRight size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                /* PDF Preview placeholder */
                <div style={{ ...styles.card, ...styles.pdfPreviewCard }}>
                  <div style={styles.pdfPreviewContent}>
                    <div style={styles.pdfIconWrap}>
                      <FileText
                        size={36}
                        style={{ color: "var(--burgundy)" }}
                      />
                    </div>
                    {file ? (
                      <>
                        <h3 style={styles.pdfTitle}>{file.name}</h3>
                        <p style={styles.pdfInfo}>
                          {pageCount} pages · Selected: {pageRange[0]}–
                          {pageRange[1]}
                        </p>
                        <p style={styles.pdfHint}>
                          Click "Generate Deck" to create flashcards from this
                          PDF
                        </p>
                      </>
                    ) : (
                      <>
                        <h3
                          style={{
                            ...styles.pdfTitle,
                            color: "var(--rule-strong)",
                          }}
                        >
                          No document uploaded
                        </h3>
                        <p style={styles.pdfHint}>
                          Upload a PDF to see a preview
                        </p>
                      </>
                    )}
                  </div>
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

  .af-slider {
    -webkit-appearance: none;
    appearance: none;
    width: 100%;
    height: 2px;
    background: var(--rule);
    outline: none;
    cursor: pointer;
  }
  .af-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 14px; height: 14px;
    border-radius: 50%;
    background: var(--burgundy);
    border: 2px solid var(--cream);
    box-shadow: 0 0 0 1px var(--burgundy);
    cursor: pointer;
  }
  .af-slider::-moz-range-thumb {
    width: 14px; height: 14px;
    border-radius: 50%;
    background: var(--burgundy);
    border: 2px solid var(--cream);
    cursor: pointer;
  }

  .af-drop-zone:hover { border-color: var(--burgundy) !important; background: var(--cream-dark) !important; }

  .af-btn-primary { transition: all 0.15s ease !important; }
  .af-btn-primary:hover:not(:disabled) { background: var(--ink-soft) !important; }

  .af-btn-download { transition: all 0.15s ease; }
  .af-btn-download:hover { background: var(--ink-soft) !important; }

  .af-nav-btn:hover:not(:disabled) { background: var(--cream-dark) !important; border-color: var(--rule-strong) !important; }
  .af-nav-btn:disabled { opacity: 0.25; cursor: not-allowed; }

  .af-flashcard { transition: all 0.2s ease; }
  .af-flashcard:hover { transform: translateY(-2px); }

  @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
  .af-spin { animation: spin 1s linear infinite; }

  @keyframes fadeIn { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
`;

const styles = {
  root: {
    minHeight: "100vh",
    background: "var(--cream)",
    fontFamily: "'Crimson Pro', Georgia, serif",
  },
  loadingScreen: {
    minHeight: "100vh",
    background: "var(--cream)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
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
  pageTitle: {
    fontFamily: "'Playfair Display', Georgia, serif",
    fontSize: "clamp(28px, 4vw, 44px)",
    fontWeight: 900,
    lineHeight: 1.1,
    letterSpacing: "-0.02em",
    color: "var(--ink)",
  },
  pageTitleItalic: {
    fontStyle: "italic",
    fontWeight: 700,
  },
  headingRule: {
    borderTop: "2px solid var(--ink)",
    marginBottom: 32,
  },

  grid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 24,
  },
  leftCol: { display: "flex", flexDirection: "column", gap: 16 },
  rightCol: { display: "flex", flexDirection: "column" },

  card: {
    background: "var(--white)",
    border: "1px solid var(--rule)",
    borderTop: "2px solid var(--ink)",
    overflow: "hidden",
    animation: "fadeIn 0.3s ease",
  },
  cardHeader: { padding: "24px 24px 0" },
  previewHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  cardEyebrow: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 10,
    letterSpacing: "0.15em",
    textTransform: "uppercase",
    color: "var(--burgundy)",
    marginBottom: 6,
  },
  cardTitle: {
    fontFamily: "'Playfair Display', Georgia, serif",
    fontSize: 20,
    fontWeight: 700,
    color: "var(--ink)",
    letterSpacing: "-0.01em",
  },
  cardSubtitle: {
    fontFamily: "'Crimson Pro', serif",
    fontSize: 15,
    color: "var(--ink-muted)",
    fontStyle: "italic",
    marginTop: 4,
  },
  cardBody: { padding: 24 },

  previewCount: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    background: "var(--burgundy)",
    color: "var(--cream)",
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 10,
    letterSpacing: "0.06em",
    padding: "2px 8px",
    marginLeft: 8,
    verticalAlign: "middle",
  },

  dropZone: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    border: "1.5px dashed var(--rule-strong)",
    padding: "32px 20px",
    cursor: "pointer",
    transition: "border-color 0.15s, background 0.15s",
    marginBottom: 16,
    background: "var(--cream)",
  },
  dropZoneText: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 11,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    color: "var(--ink-soft)",
    marginBottom: 4,
  },
  dropZoneHint: {
    fontFamily: "'Crimson Pro', serif",
    fontSize: 13,
    color: "var(--ink-muted)",
    fontStyle: "italic",
  },

  infoRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    background: "rgba(42,122,74,0.06)",
    borderLeft: "2px solid var(--green)",
    padding: "10px 14px",
    marginBottom: 16,
  },
  infoText: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 11,
    letterSpacing: "0.06em",
    color: "var(--ink-soft)",
  },

  rangeRule: { borderTop: "1px solid var(--rule)", marginBottom: 16 },
  rangeSection: { marginBottom: 20 },
  rangeHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  label: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 10,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    color: "var(--ink-muted)",
  },
  rangeValue: {
    fontFamily: "'Playfair Display', serif",
    fontSize: 16,
    fontWeight: 700,
    color: "var(--burgundy)",
  },
  sliderWrap: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  sliderLabel: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 9,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "var(--ink-muted)",
    width: 28,
  },
  slider: { flex: 1 },

  errorRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: 8,
    background: "rgba(107,31,42,0.05)",
    borderLeft: "2px solid var(--burgundy)",
    padding: "10px 14px",
    marginBottom: 16,
  },
  errorText: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 11,
    letterSpacing: "0.04em",
    color: "var(--burgundy)",
  },

  generateBtn: {
    width: "100%",
    padding: "14px 20px",
    background: "var(--ink)",
    border: "none",
    color: "var(--cream)",
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 11,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    fontWeight: 500,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "background 0.15s",
  },

  bigDownloadBtn: {
    width: "100%",
    marginTop: 12,
    padding: "14px 20px",
    background: "var(--burgundy)",
    border: "none",
    color: "var(--cream)",
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 11,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    fontWeight: 500,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    textDecoration: "none",
    transition: "background 0.15s",
  },

  statusBox: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    borderTop: "1px solid var(--rule)",
    padding: "12px 0 0",
    marginTop: 12,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: "50%",
    background: "var(--green)",
    flexShrink: 0,
  },
  statusText: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 10,
    letterSpacing: "0.08em",
    color: "var(--ink-muted)",
  },

  flashcard: {
    background: "var(--cream)",
    border: "1px solid var(--rule)",
    borderTop: "2px solid var(--ink)",
    padding: "28px 24px",
    cursor: "pointer",
    minHeight: 260,
    display: "flex",
    flexDirection: "column",
    marginBottom: 20,
    transition: "all 0.2s ease",
  },
  flashcardFlipped: {
    borderTopColor: "var(--burgundy)",
    background: "rgba(107,31,42,0.03)",
  },
  flashSide: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 9,
    letterSpacing: "0.15em",
    textTransform: "uppercase",
    color: "var(--ink-muted)",
    marginBottom: 16,
  },
  flashContent: {
    fontFamily: "'Crimson Pro', serif",
    fontSize: 17,
    lineHeight: 1.65,
    color: "var(--ink)",
    flex: 1,
  },
  tagsRow: { display: "flex", flexWrap: "wrap", gap: 6, marginTop: 16 },
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
    marginTop: 16,
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
    width: 36,
    height: 36,
    background: "var(--white)",
    border: "1px solid var(--rule)",
    color: "var(--ink-soft)",
    cursor: "pointer",
    transition: "all 0.15s",
  },
  dots: { display: "flex", gap: 6, alignItems: "center" },
  dot: {
    width: 6,
    height: 6,
    borderRadius: "50%",
    background: "var(--rule)",
    border: "none",
    cursor: "pointer",
    padding: 0,
    transition: "all 0.2s",
  },
  dotActive: { width: 18, borderRadius: 2, background: "var(--burgundy)" },

  pdfPreviewCard: {
    minHeight: 420,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  pdfPreviewContent: {
    textAlign: "center",
    padding: "40px 24px",
  },
  pdfIconWrap: {
    width: 64,
    height: 64,
    border: "1px solid var(--rule)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "0 auto 24px",
    background: "var(--cream)",
  },
  pdfTitle: {
    fontFamily: "'Playfair Display', serif",
    fontSize: 17,
    fontWeight: 700,
    color: "var(--ink)",
    marginBottom: 8,
    wordBreak: "break-all",
  },
  pdfInfo: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 11,
    letterSpacing: "0.08em",
    color: "var(--burgundy)",
    marginBottom: 16,
  },
  pdfHint: {
    fontFamily: "'Crimson Pro', serif",
    fontStyle: "italic",
    fontSize: 14,
    color: "var(--ink-muted)",
  },
};
