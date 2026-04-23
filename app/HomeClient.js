// app/HomeClient.js
"use client";
import { useEffect, useState, useRef } from "react";
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
// REMOVED: import * as pdfjsLib from "pdfjs-dist";

// At the top of HomeClient.js, after the API constant:
const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

if (!process.env.NEXT_PUBLIC_API_URL) {
  console.warn(
    "⚠️ NEXT_PUBLIC_API_URL is not set. Falling back to http://localhost:5000",
  );
}

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

  // PDF preview states
  const [pdfPages, setPdfPages] = useState([]);
  const [currentPdfPageIndex, setCurrentPdfPageIndex] = useState(0);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploadingPdf, setIsUploadingPdf] = useState(false);

  // Store dynamically loaded PDF.js library
  const pdfjsLibRef = useRef(null);
  const router = useRouter();

  // Load PDF.js dynamically on client side
  // AFTER
  useEffect(() => {
    const load = async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjsLibRef.current = pdfjs;

        // Use the bundled worker — avoids CDN fetch and version mismatch
        const workerUrl = new URL(
          "pdfjs-dist/build/pdf.worker.min.mjs",
          import.meta.url,
        ).toString();
        pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
      } catch (err) {
        console.error("Failed to load PDF.js:", err);
        setError("Failed to initialize PDF renderer.");
      }
    };
    load();
  }, []);

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

    // Guard: Ensure PDF.js is loaded before processing
    if (!pdfjsLibRef.current) {
      setError("PDF renderer is still loading. Please wait a moment.");
      return;
    }

    setFile(selectedFile);
    setError(" ");
    setJobId(null);
    setJobStatus(null);
    setPreviewCards([]);
    setIsUploadingPdf(true);
    setUploadProgress(0);
    setPdfPages([]);
    setCurrentPdfPageIndex(0);

    try {
      // Extract PDF pages with actual rendering
      await extractPdfPages(selectedFile);

      // Get page count from backend
      const formData = new FormData();
      formData.append("file", selectedFile);

      // const res = await fetch(`${API}/page-count`, {
      //   method: "POST",
      //   body: formData,
      // });
      // Replace the fetch block in handleFileChange (line 116–121):
      let res;
      try {
        res = await fetch(`${API}/page-count`, {
          method: "POST",
          body: formData,
        });
      } catch (networkErr) {
        throw new Error(
          `Cannot reach backend at ${API}. Is the server running? (${networkErr.message})`,
        );
      }

      if (!res.ok)
        throw new Error(`Failed to read PDF: ${res.status} ${res.statusText}`);

      // if (!res.ok) throw new Error("Failed to read PDF");

      const data = await res.json();
      setPageCount(data.page_count);
      setPageRange([1, data.page_count]);

      setUploadProgress(100);

      // Complete the upload animation
      setTimeout(() => {
        setIsUploadingPdf(false);
      }, 600);
    } catch (err) {
      console.error("PDF processing error: ", err);
      setError(err.message || "Failed to process PDF");
      setIsUploadingPdf(false);
      setUploadProgress(0);
    }
  };

  const extractPdfPages = async (file) => {
    const pdfjsLib = pdfjsLibRef.current;
    if (!pdfjsLib) throw new Error("PDF.js not loaded");

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const pages = await Promise.all(
        Array.from({ length: pdf.numPages }, async (_, i) => {
          try {
            const page = await pdf.getPage(i + 1);

            // Set canvas scale for better quality
            const scale = 2;
            const viewport = page.getViewport({ scale });

            const canvas = document.createElement("canvas");
            canvas.width = viewport.width;
            canvas.height = viewport.height;

            const context = canvas.getContext("2d");
            if (!context) throw new Error("Failed to get canvas context");

            await page.render({
              canvasContext: context,
              viewport: viewport,
            }).promise;

            const imageData = canvas.toDataURL("image/png");

            // Update progress
            const progressPercent = Math.round(((i + 1) / pdf.numPages) * 90);
            setUploadProgress(progressPercent);

            return {
              pageNum: i + 1,
              data: imageData,
              width: viewport.width,
              height: viewport.height,
            };
          } catch (pageErr) {
            console.error(`Error rendering page ${i + 1}:`, pageErr);
            return {
              pageNum: i + 1,
              data: null,
              error: true,
            };
          }
        }),
      );

      setPdfPages(pages);
      return pages;
    } catch (err) {
      console.error("PDF extraction error: ", err);
      throw new Error("Failed to process PDF:  " + err.message);
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

      // Use XMLHttpRequest for real upload progress tracking
      const jobData = await uploadWithProgress(formData);

      setJobId(jobData.job_id);
      pollJobStatus(jobData.job_id);
    } catch (err) {
      setError(err.message || "Generation failed");
      setLoading(false);
    }
  };

  const uploadWithProgress = (formData) => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      // Track upload progress
      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) {
          const percentComplete = Math.round((e.loaded / e.total) * 100);
          console.log(`Upload progress: ${percentComplete}%`);
        }
      });

      xhr.addEventListener("load", () => {
        if (xhr.status === 200 || xhr.status === 202) {
          try {
            const data = JSON.parse(xhr.responseText);
            resolve(data);
          } catch (err) {
            reject(new Error("Invalid response format"));
          }
        } else {
          reject(new Error("Upload failed with status " + xhr.status));
        }
      });

      xhr.addEventListener("error", () => {
        reject(new Error("Network error during upload"));
      });

      xhr.addEventListener("abort", () => {
        reject(new Error("Upload cancelled"));
      });

      xhr.open("POST", `${API}/generate`);
      xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      xhr.send(formData);
    });
  };

  // const pollJobStatus = async (id) => {
  //   const interval = setInterval(async () => {
  //     try {
  //       const res = await fetch(`${API}/status/${id}`, {
  //         headers: { Authorization: `Bearer ${token}` },
  //       });
  //       const data = await res.json();
  //       setJobStatus(data);
  //       if (data.status === "done") {
  //         clearInterval(interval);
  //         setPreviewCards(data.cards_preview || []);
  //         setCurrentCardIndex(0);
  //         setCardFlipped(false);
  //         setLoading(false);
  //       } else if (data.status === "error") {
  //         clearInterval(interval);
  //         setError(data.error || "Generation failed");
  //         setLoading(false);
  //       }
  //     } catch {
  //       console.error("Poll error");
  //     }
  //   }, 2000);
  // };
  // AFTER
  const pollJobStatus = async (id) => {
    let retries = 0;
    const MAX_RETRIES = 3;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API}/status/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) {
          throw new Error(
            `Status check failed: ${res.status} ${res.statusText}`,
          );
        }

        const data = await res.json();
        retries = 0; // reset on success
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
      } catch (err) {
        const isNetworkError = err.message === "Failed to fetch";
        console.error(
          "Poll error:",
          isNetworkError ? `Cannot reach ${API}` : err.message,
        );
        retries += 1;
        if (retries >= MAX_RETRIES) {
          clearInterval(interval);
          setError(
            isNetworkError
              ? `Cannot reach backend at ${API}. Check server is running and CORS is configured.`
              : `Polling failed after ${MAX_RETRIES} attempts: ${err.message}`,
          );
          setLoading(false);
        }
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

  const nextPdfPage = () => {
    const displayPages = pdfPages.slice(pageRange[0] - 1, pageRange[1]);
    if (currentPdfPageIndex < displayPages.length - 1) {
      setCurrentPdfPageIndex((i) => i + 1);
    }
  };

  const prevPdfPage = () => {
    if (currentPdfPageIndex > 0) {
      setCurrentPdfPageIndex((i) => i - 1);
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
  // Get the currently visible PDF pages based on page range
  const displayPages = pdfPages.slice(pageRange[0] - 1, pageRange[1]);
  const currentPdfPage = displayPages[currentPdfPageIndex];
  const actualPageNum = currentPdfPageIndex + pageRange[0];

  return (
    <>
      <style>{globalStyles}</style>
      <Navbar />
      <div style={styles.root}>
        <div style={styles.container}>
          {/* Page heading */}
          <div style={styles.pageHeading}>
            <p style={styles.eyebrow}>New Deck</p>
            <h1 style={styles.pageTitle}>
              Generate Flashcards{" "}
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
                  {/* Drop Zone with Upload Progress Wheel */}
                  <div style={styles.uploadZoneWrapper}>
                    <label style={styles.dropZone} className="af-drop-zone">
                      {isUploadingPdf ? (
                        <div style={styles.progressWheelContainer}>
                          <svg
                            style={styles.progressSvg}
                            viewBox="0 0 100 100"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <circle
                              cx="50"
                              cy="50"
                              r="45"
                              fill="none"
                              stroke="var(--rule)"
                              strokeWidth="2"
                            />
                            <circle
                              cx="50"
                              cy="50"
                              r="45"
                              fill="none"
                              stroke="var(--burgundy)"
                              strokeWidth="2.5"
                              strokeDasharray={`${2 * Math.PI * 45}`}
                              strokeDashoffset={`${2 * Math.PI * 45 * (1 - uploadProgress / 100)}`}
                              strokeLinecap="round"
                              style={{
                                transform: "rotate(-90deg)",
                                transformOrigin: "50% 50%",
                                transition: "stroke-dashoffset 0.3s ease",
                              }}
                            />
                            <text
                              x="50"
                              y="50"
                              textAnchor="middle"
                              dy="0.3em"
                              style={styles.progressText}
                            >
                              {Math.round(uploadProgress)}%
                            </text>
                          </svg>
                          <span style={styles.uploadingText}>
                            {uploadProgress < 100
                              ? "Uploading PDF..."
                              : "Processing..."}
                          </span>
                        </div>
                      ) : (
                        <>
                          <FileUp
                            size={24}
                            style={{
                              color: "var(--burgundy)",
                              marginBottom: 10,
                            }}
                          />
                          <span style={styles.dropZoneText}>
                            Click to upload PDF
                          </span>
                          <span style={styles.dropZoneHint}>
                            or drag and drop
                          </span>
                        </>
                      )}
                      <input
                        type="file"
                        accept=".pdf"
                        onChange={handleFileChange}
                        disabled={isUploadingPdf || !pdfjsLibRef.current}
                        style={{ display: "none" }}
                      />
                    </label>
                  </div>

                  {/* File Info */}
                  {file && !isUploadingPdf && (
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
                  {pageCount > 0 && !isUploadingPdf && (
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
                  {!isUploadingPdf && (
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
                          Generating...
                        </>
                      ) : (
                        <>
                          <Zap size={15} style={{ marginRight: 8 }} />
                          Generate Flashcards
                        </>
                      )}
                    </button>
                  )}

                  {/* Download Button */}
                  {showDownload && (
                    <a
                      href={jobStatus.download_url}
                      download
                      style={styles.bigDownloadBtn}
                      className="af-btn-download"
                    >
                      <Download size={15} style={{ marginRight: 8 }} />
                      Download Deck
                    </a>
                  )}

                  {jobStatus?.status === "done" && (
                    <div style={styles.statusBox}>
                      <div style={styles.statusDot} />
                      <span style={styles.statusText}>
                        Generation Complete ({previewCards.length} cards)
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* RIGHT: Preview */}
            <div style={styles.rightCol}>
              {/* PDF Preview Section */}
              <div style={styles.card}>
                <div style={styles.cardHeader}>
                  <p style={styles.cardEyebrow}>Preview</p>
                  <h2 style={styles.cardTitle}>
                    {file ? "Document Pages" : "Ready to Preview"}
                  </h2>
                </div>
                <div style={styles.cardBody}>
                  {!file && !isUploadingPdf ? (
                    <div style={styles.pdfPreviewCard}>
                      <div style={styles.pdfPreviewContent}>
                        <div style={styles.pdfIconWrap}>
                          <FileText
                            size={32}
                            style={{ color: "var(--ink-muted)" }}
                          />
                        </div>
                        <p style={styles.pdfTitle}>No PDF Selected</p>
                        <p style={styles.pdfInfo}>
                          Upload a document to preview pages
                        </p>
                        <p style={styles.pdfHint}>
                          Selected pages will appear here
                        </p>
                      </div>
                    </div>
                  ) : isUploadingPdf ? (
                    <div style={styles.pdfPreviewCard}>
                      <div style={styles.pdfPreviewContent}>
                        <Loader2
                          size={36}
                          className="af-spin"
                          style={{ color: "var(--burgundy)", marginBottom: 20 }}
                        />
                        <p style={styles.pdfTitle}>Loading PDF</p>
                        <p style={styles.pdfHint}>
                          Please wait while we process your document...
                        </p>
                      </div>
                    </div>
                  ) : displayPages.length > 0 ? (
                    <>
                      <div style={styles.pdfPageContainer}>
                        <div style={styles.pdfPagePreview}>
                          <div style={styles.pdfPageNum}>
                            Page {actualPageNum}
                          </div>
                          {currentPdfPage?.data ? (
                            <img
                              src={currentPdfPage.data}
                              alt={`Page ${actualPageNum}`}
                              style={{
                                maxWidth: "100%",
                                maxHeight: "350px",
                                objectFit: "contain",
                                borderRadius: 2,
                              }}
                            />
                          ) : currentPdfPage?.error ? (
                            <div style={styles.pdfPageError}>
                              <AlertCircle
                                size={32}
                                style={{
                                  color: "var(--burgundy)",
                                  marginBottom: 8,
                                }}
                              />
                              <p style={styles.pdfPageErrorText}>
                                Failed to render page {actualPageNum}
                              </p>
                            </div>
                          ) : (
                            <div style={styles.pdfPagePlaceholder}>
                              <FileText
                                size={48}
                                style={{ color: "var(--rule-strong)" }}
                              />
                              <p style={styles.pdfPageText}>
                                {currentPdfPage?.pageNum || actualPageNum}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* PDF Navigation */}
                      {displayPages.length > 1 && (
                        <div style={styles.pdfNavContainer}>
                          <button
                            onClick={prevPdfPage}
                            disabled={currentPdfPageIndex === 0}
                            style={{
                              ...styles.navBtn,
                              opacity: currentPdfPageIndex === 0 ? 0.4 : 1,
                              cursor:
                                currentPdfPageIndex === 0
                                  ? "not-allowed"
                                  : "pointer",
                            }}
                          >
                            <ChevronLeft size={16} />
                          </button>

                          <div style={styles.pageIndicator}>
                            <span style={styles.pageIndicatorText}>
                              {currentPdfPageIndex + 1} of {displayPages.length}
                            </span>
                          </div>

                          <button
                            onClick={nextPdfPage}
                            disabled={
                              currentPdfPageIndex === displayPages.length - 1
                            }
                            style={{
                              ...styles.navBtn,
                              opacity:
                                currentPdfPageIndex === displayPages.length - 1
                                  ? 0.4
                                  : 1,
                              cursor:
                                currentPdfPageIndex === displayPages.length - 1
                                  ? "not-allowed"
                                  : "pointer",
                            }}
                          >
                            <ChevronRight size={16} />
                          </button>
                        </div>
                      )}

                      <div style={styles.pdfPageInfo}>
                        <span style={styles.pdfPageInfoText}>
                          Pages {pageRange[0]}–{pageRange[1]} selected for
                          generation
                        </span>
                      </div>
                    </>
                  ) : null}
                </div>
              </div>

              {/* Flashcards Preview Section */}
              {previewCards.length > 0 && (
                <div style={styles.card}>
                  <div style={styles.cardHeader}>
                    <p style={styles.cardEyebrow}>Cards</p>
                    <h2 style={styles.cardTitle}>Generated Preview</h2>
                  </div>
                  <div style={styles.cardBody}>
                    {currentCard && (
                      <>
                        <div
                          onClick={() => setCardFlipped(!cardFlipped)}
                          style={{
                            ...styles.flashcard,
                            ...(cardFlipped && styles.flashcardFlipped),
                          }}
                        >
                          <div style={styles.flashSide}>
                            {cardFlipped ? "Answer" : "Question"}
                          </div>
                          <div style={styles.flashContent}>
                            {cardFlipped
                              ? currentCard.answer
                              : currentCard.question}
                          </div>
                          <div style={styles.flipHint}>
                            click to {cardFlipped ? "unflip" : "flip"}
                          </div>
                        </div>

                        <div style={styles.navRow}>
                          <button
                            onClick={prevCard}
                            disabled={currentCardIndex === 0}
                            style={{
                              ...styles.navBtn,
                              opacity: currentCardIndex === 0 ? 0.4 : 1,
                              cursor:
                                currentCardIndex === 0
                                  ? "not-allowed"
                                  : "pointer",
                            }}
                          >
                            <ChevronLeft size={16} />
                          </button>

                          <div style={styles.dots}>
                            {previewCards.map((_, idx) => (
                              <button
                                key={idx}
                                onClick={() => {
                                  setCurrentCardIndex(idx);
                                  setCardFlipped(false);
                                }}
                                style={{
                                  ...styles.dot,
                                  ...(idx === currentCardIndex &&
                                    styles.dotActive),
                                }}
                              />
                            ))}
                          </div>

                          <button
                            onClick={nextCard}
                            disabled={
                              currentCardIndex === previewCards.length - 1
                            }
                            style={{
                              ...styles.navBtn,
                              opacity:
                                currentCardIndex === previewCards.length - 1
                                  ? 0.4
                                  : 1,
                              cursor:
                                currentCardIndex === previewCards.length - 1
                                  ? "not-allowed"
                                  : "pointer",
                            }}
                          >
                            <ChevronRight size={16} />
                          </button>
                        </div>
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
@import url("https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=Crimson+Pro:ital@0;1&family=Playfair+Display:wght@700&display=swap");
:root {
  --burgundy: #6b1f2a;
  --green: #2a7a4a;
  --cream: #f4f4f5;
  --cream-dark: #e6e6e7;
  --white: #ffffff;
  --ink: #0a0a0b;
  --ink-soft: #3a3a3b;
  --ink-muted: #6a6a6b;
  --rule: #d0d0d1;
  --rule-strong: #a0a0a1;
}
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; font-family: "IBM Plex Mono", monospace; background: var(--cream); color: var(--ink); }
.af-spin { animation: spin 1s linear infinite; }
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
.af-drop-zone:hover { border-color: var(--burgundy); background: rgba(107, 31, 42, 0.02); }
.af-slider { -webkit-appearance: none; appearance: none; width: 100%; height: 2px; background: var(--rule); outline: none; border-radius: 1px; }
.af-slider::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 12px; height: 12px; background: var(--burgundy); cursor: pointer; border-radius: 50%; }
.af-slider::-moz-range-thumb { width: 12px; height: 12px; background: var(--burgundy); cursor: pointer; border: none; border-radius: 50%; }
.af-btn-primary:hover:not(:disabled) { background: var(--ink-soft); }
.af-btn-download:hover { background: var(--burgundy); opacity: 0.9; }
`;

const styles = {
  root: { minHeight: "100vh", background: "var(--cream)" },
  container: { maxWidth: 1440, margin: "0 auto", padding: "48px 32px" },
  pageHeading: { marginBottom: 40 },
  eyebrow: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 10,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    color: "var(--ink-muted)",
    marginBottom: 8,
    margin: 0,
  },
  pageTitle: {
    fontFamily: "'Playfair Display', serif",
    fontSize: 40,
    fontWeight: 700,
    lineHeight: 1.1,
    margin: 0,
    marginBottom: 4,
  },
  pageTitleItalic: { fontStyle: "italic" },
  headingRule: { borderTop: "1px solid var(--rule)", marginBottom: 40 },
  grid: { display: "grid", gridTemplateColumns: "1fr 1.3fr", gap: 32 },
  leftCol: {},
  rightCol: { display: "flex", flexDirection: "column", gap: 24 },
  card: {
    background: "var(--white)",
    border: "1px solid var(--rule)",
    marginBottom: 20,
  },
  cardHeader: { borderBottom: "1px solid var(--rule)", padding: "24px" },
  cardEyebrow: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 9,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    color: "var(--ink-muted)",
    margin: "0 0 8px 0",
  },
  cardTitle: {
    fontFamily: "'Playfair Display', serif",
    fontSize: 20,
    fontWeight: 700,
    margin: "0 0 6px 0",
    color: "var(--ink)",
  },
  cardSubtitle: {
    fontFamily: "'Crimson Pro', serif",
    fontSize: 14,
    color: "var(--ink-muted)",
    fontStyle: "italic",
    margin: 0,
  },
  cardBody: { padding: "24px" },
  uploadZoneWrapper: { position: "relative", marginBottom: 16 },
  dropZone: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    border: "1.5px dashed var(--rule-strong)",
    padding: "32px 20px",
    cursor: "pointer",
    transition: "border-color 0.15s, background 0.15s",
    background: "var(--cream)",
  },
  progressWheelContainer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 16,
  },
  progressSvg: { width: 80, height: 80 },
  progressText: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 14,
    fontWeight: 500,
    fill: "var(--burgundy)",
    letterSpacing: "0.05em",
  },
  uploadingText: {
    fontFamily: "'Crimson Pro', serif",
    fontSize: 13,
    color: "var(--ink-soft)",
    fontStyle: "italic",
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
  pdfPreviewCard: {
    minHeight: 420,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "var(--cream)",
    borderRadius: 2,
  },
  pdfPreviewContent: { textAlign: "center", padding: "40px 24px" },
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
  pdfPageContainer: { marginBottom: 20 },
  pdfPagePreview: {
    position: "relative",
    background: "var(--cream)",
    border: "1px solid var(--rule)",
    borderRadius: 2,
    padding: "20px",
    minHeight: 300,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  pdfPageNum: {
    position: "absolute",
    top: 12,
    right: 12,
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 9,
    letterSpacing: "0.08em",
    color: "var(--ink-muted)",
    textTransform: "uppercase",
    background: "var(--white)",
    padding: "4px 8px",
    border: "1px solid var(--rule)",
  },
  pdfPagePlaceholder: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 16,
    width: "100%",
  },
  pdfPageError: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 8,
    padding: "20px",
    textAlign: "center",
  },
  pdfPageErrorText: {
    fontFamily: "'Crimson Pro', serif",
    fontSize: 14,
    color: "var(--burgundy)",
    margin: 0,
  },
  pdfPageText: {
    fontFamily: "'Playfair Display', serif",
    fontSize: 24,
    fontWeight: 700,
    color: "var(--ink-soft)",
    margin: 0,
  },
  pdfNavContainer: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 16,
  },
  pageIndicator: { flex: 1, textAlign: "center" },
  pageIndicatorText: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 11,
    letterSpacing: "0.08em",
    color: "var(--ink-soft)",
  },
  pdfPageInfo: {
    background: "rgba(107,31,42,0.03)",
    borderLeft: "2px solid var(--rule-strong)",
    padding: "10px 14px",
    borderRadius: 2,
  },
  pdfPageInfoText: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 10,
    letterSpacing: "0.06em",
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
    borderRadius: 2,
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
    gap: 12,
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
    borderRadius: 2,
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
  loadingScreen: {
    height: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "var(--cream)",
  },
};
