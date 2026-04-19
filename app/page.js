"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
} from "firebase/auth";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const hasFirebaseConfig = Object.values(firebaseConfig).every(Boolean);
const app = hasFirebaseConfig
  ? getApps().length
    ? getApp()
    : initializeApp(firebaseConfig)
  : null;
const auth = app ? getAuth(app) : null;

function clampNumber(value, min, max) {
  const num = Number(value);
  if (Number.isNaN(num)) return min;
  return Math.min(max, Math.max(min, num));
}

export default function Home() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState("");

  const [file, setFile] = useState(null);
  const [pageCount, setPageCount] = useState(null);
  const [pageMode, setPageMode] = useState("all");
  const [firstN, setFirstN] = useState(5);
  const [lastN, setLastN] = useState(5);
  const [customStart, setCustomStart] = useState(1);
  const [customEnd, setCustomEnd] = useState(1);

  const [status, setStatus] = useState("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [jobId, setJobId] = useState(null);
  const [previewCards, setPreviewCards] = useState([]);
  const [showPreview, setShowPreview] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState("");

  const pollRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!auth) {
      setAuthLoading(false);
      setAuthError(
        "Firebase is not configured. Add all NEXT_PUBLIC_FIREBASE_* values to .env.local.",
      );
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser || null);
      setAuthError("");

      if (currentUser) {
        try {
          const idToken = await currentUser.getIdToken(true);
          setToken(idToken);
        } catch {
          setToken(null);
          setAuthError("Signed in, but failed to retrieve auth token.");
        }
      } else {
        setToken(null);
      }

      setAuthLoading(false);
    });

    getRedirectResult(auth).catch((error) => {
      setAuthError(getReadableAuthError(error));
      setAuthLoading(false);
    });

    return () => {
      unsubscribe();
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const pageRangeText = useMemo(() => {
    if (!pageCount) return "";
    const { pageStart, pageEnd } = getPageRange(
      pageMode,
      pageCount,
      firstN,
      lastN,
      customStart,
      customEnd,
    );
    return `Pages ${pageStart}-${pageEnd} of ${pageCount}`;
  }, [pageMode, pageCount, firstN, lastN, customStart, customEnd]);

  async function handleLogin() {
    if (!auth) {
      setAuthError(
        "Firebase auth is unavailable. Check your environment variables.",
      );
      return;
    }

    setAuthError("");
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });

    try {
      const result = await signInWithPopup(auth, provider);
      const idToken = await result.user.getIdToken(true);
      setUser(result.user);
      setToken(idToken);
    } catch (error) {
      const code = error?.code || "";
      const popupFallbackCodes = [
        "auth/popup-blocked",
        "auth/popup-closed-by-user",
        "auth/cancelled-popup-request",
        "auth/operation-not-supported-in-this-environment",
      ];

      if (popupFallbackCodes.includes(code)) {
        try {
          await signInWithRedirect(auth, provider);
          return;
        } catch (redirectError) {
          setAuthError(getReadableAuthError(redirectError));
          return;
        }
      }

      setAuthError(getReadableAuthError(error));
    }
  }

  async function handleLogout() {
    if (!auth) return;
    try {
      await auth.signOut();
      setUser(null);
      setToken(null);
    } catch {
      setAuthError("Failed to sign out cleanly.");
    }
  }

  async function handleFileChange(event) {
    const selected = event.target.files?.[0];
    if (!selected) return;

    if (selected.type !== "application/pdf") {
      setErrorMsg("Please select a valid PDF file.");
      setFile(null);
      setPageCount(null);
      return;
    }

    resetJobState();
    setFile(selected);

    try {
      const formData = new FormData();
      formData.append("file", selected);

      const response = await fetch(`${API}/page-count`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const message = await safeErrorMessage(
          response,
          "Failed to read PDF pages.",
        );
        throw new Error(message);
      }

      const data = await response.json();
      const count = Number(data.page_count ?? data.pagecount ?? data.pages);

      if (!count || Number.isNaN(count)) {
        throw new Error("Server did not return a valid page count.");
      }

      setPageCount(count);
      setFirstN(Math.min(5, count));
      setLastN(Math.min(5, count));
      setCustomStart(1);
      setCustomEnd(count);
    } catch (error) {
      setErrorMsg(error.message || "Failed to read PDF pages.");
      setPageCount(null);
    }
  }

  function resetJobState() {
    setStatus("idle");
    setErrorMsg("");
    setJobId(null);
    setPreviewCards([]);
    setShowPreview(false);
    setDownloadUrl("");
    if (pollRef.current) clearInterval(pollRef.current);
  }

  async function handleSubmit() {
    if (!file) {
      setErrorMsg("Please choose a PDF first.");
      return;
    }

    if (!user || !token) {
      setErrorMsg("Please sign in before generating the deck.");
      return;
    }

    setStatus("uploading");
    setErrorMsg("");
    setShowPreview(false);

    try {
      const freshToken = await user.getIdToken(true);
      setToken(freshToken);

      const { pageStart, pageEnd } = getPageRange(
        pageMode,
        pageCount,
        firstN,
        lastN,
        customStart,
        customEnd,
      );

      const formData = new FormData();
      formData.append("file", file);
      formData.append("page_start", String(pageStart));
      formData.append("page_end", String(pageEnd));

      const response = await fetch(`${API}/generate`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${freshToken}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const message = await safeErrorMessage(response, "Upload failed.");
        throw new Error(message);
      }

      const data = await response.json();
      const nextJobId = data.job_id ?? data.jobid ?? data.id;

      if (!nextJobId) {
        throw new Error("Server did not return a job ID.");
      }

      setJobId(nextJobId);
      setStatus("processing");
      startPolling(nextJobId);
    } catch (error) {
      setStatus("error");
      setErrorMsg(error.message || "Failed to start generation.");
    }
  }

  function startPolling(id) {
    if (pollRef.current) clearInterval(pollRef.current);

    let failures = 0;

    pollRef.current = setInterval(async () => {
      try {
        const freshToken = user ? await user.getIdToken(true) : token;
        if (freshToken) setToken(freshToken);

        const response = await fetch(`${API}/status/${id}`, {
          headers: freshToken
            ? {
                Authorization: `Bearer ${freshToken}`,
              }
            : {},
        });

        if (!response.ok) {
          const message = await safeErrorMessage(
            response,
            `Status check failed (${response.status}).`,
          );
          throw new Error(message);
        }

        const data = await response.json();
        failures = 0;

        if (data.status === "done") {
          clearInterval(pollRef.current);
          pollRef.current = null;
          setStatus("done");
          await fetchPreview(id, freshToken || token);
        } else if (data.status === "error") {
          clearInterval(pollRef.current);
          pollRef.current = null;
          setStatus("error");
          setErrorMsg(data.error || "Generation failed.");
        } else {
          setStatus("processing");
        }
      } catch (error) {
        failures += 1;
        if (failures >= 4) {
          clearInterval(pollRef.current);
          pollRef.current = null;
          setStatus("error");
          setErrorMsg(
            error.message || "Connection lost while polling job status.",
          );
        }
      }
    }, 5000);
  }

  async function fetchPreview(id, currentToken) {
    try {
      const response = await fetch(`${API}/preview/${id}`, {
        headers: currentToken
          ? {
              Authorization: `Bearer ${currentToken}`,
            }
          : {},
      });

      if (!response.ok) {
        const message = await safeErrorMessage(
          response,
          "Failed to load preview.",
        );
        throw new Error(message);
      }

      const data = await response.json();
      setPreviewCards(Array.isArray(data.cards) ? data.cards : []);
      setDownloadUrl(data.download_url ?? data.downloadurl ?? "");
      setShowPreview(true);
    } catch (error) {
      setErrorMsg(error.message || "Failed to load preview.");
    }
  }

  const isProcessing = status === "uploading" || status === "processing";

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 text-slate-800 p-6 font-sans">
      <div className="max-w-5xl mx-auto">
        <header className="flex flex-col gap-4 md:flex-row md:justify-between md:items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">
              PDF Anki Deck
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Upload a PDF, choose page ranges, and generate an Anki deck.
            </p>
          </div>

          <div>
            {user ? (
              <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-full shadow-md">
                <img
                  src={user.photoURL || "/default-avatar.png"}
                  className="w-8 h-8 rounded-full"
                  alt="User avatar"
                />
                <span className="text-sm font-medium">{user.email}</span>
                <button
                  onClick={() => router.push("/account")}
                  className="text-xs text-blue-600 hover:underline"
                >
                  My Decks
                </button>
                <button
                  onClick={handleLogout}
                  className="text-xs text-red-500 hover:underline"
                  type="button"
                >
                  Logout
                </button>
              </div>
            ) : (
              <button
                onClick={handleLogin}
                className="px-5 py-2 bg-blue-600 text-white rounded-lg shadow hover:bg-blue-700 transition disabled:opacity-60"
                disabled={authLoading || !hasFirebaseConfig}
                type="button"
              >
                {authLoading ? "Checking session..." : "Sign in with Google"}
              </button>
            )}
          </div>
        </header>

        {(authError || !hasFirebaseConfig) && (
          <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-800">
            {authError || "Firebase configuration is incomplete."}
          </div>
        )}

        <section className="sticky top-4 z-10 bg-white/90 backdrop-blur-md rounded-2xl p-5 shadow-lg border border-slate-100 mb-6">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">
            Pages to Process
          </h2>

          <div className="flex flex-wrap gap-3 mb-4">
            {["all", "first", "last", "custom"].map((mode) => (
              <button
                key={mode}
                onClick={() => setPageMode(mode)}
                type="button"
                className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  pageMode === mode
                    ? "bg-blue-600 text-white shadow-md scale-105"
                    : "bg-slate-100 hover:bg-slate-200 text-slate-600"
                }`}
              >
                {mode === "all"
                  ? "All"
                  : mode.charAt(0).toUpperCase() + mode.slice(1)}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3 text-slate-700">
            {pageMode === "first" && (
              <span className="flex items-center gap-2">
                First
                <input
                  type="number"
                  min="1"
                  max={pageCount || 1}
                  value={firstN}
                  onChange={(e) =>
                    setFirstN(clampNumber(e.target.value, 1, pageCount || 1))
                  }
                  className="w-20 border-2 border-slate-200 rounded-lg px-3 py-2 text-center font-medium focus:border-blue-500 outline-none"
                />
                pages
              </span>
            )}

            {pageMode === "last" && (
              <span className="flex items-center gap-2">
                Last
                <input
                  type="number"
                  min="1"
                  max={pageCount || 1}
                  value={lastN}
                  onChange={(e) =>
                    setLastN(clampNumber(e.target.value, 1, pageCount || 1))
                  }
                  className="w-20 border-2 border-slate-200 rounded-lg px-3 py-2 text-center font-medium focus:border-blue-500 outline-none"
                />
                pages
              </span>
            )}

            {pageMode === "custom" && (
              <span className="flex flex-wrap items-center gap-2">
                Pages
                <input
                  type="number"
                  min="1"
                  max={pageCount || 1}
                  value={customStart}
                  onChange={(e) => {
                    const nextStart = clampNumber(
                      e.target.value,
                      1,
                      pageCount || 1,
                    );
                    setCustomStart(nextStart);
                    setCustomEnd((prev) => Math.max(nextStart, prev));
                  }}
                  className="w-20 border-2 border-slate-200 rounded-lg px-3 py-2 text-center font-medium focus:border-blue-500 outline-none"
                />
                to
                <input
                  type="number"
                  min={customStart}
                  max={pageCount || 1}
                  value={customEnd}
                  onChange={(e) =>
                    setCustomEnd(
                      clampNumber(e.target.value, customStart, pageCount || 1),
                    )
                  }
                  className="w-20 border-2 border-slate-200 rounded-lg px-3 py-2 text-center font-medium focus:border-blue-500 outline-none"
                />
              </span>
            )}

            {pageCount && (
              <span className="text-sm text-slate-500">{pageRangeText}</span>
            )}
          </div>
        </section>

        <section
          onClick={() => !isProcessing && inputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-10 text-center transition-all cursor-pointer mb-6 ${
            isProcessing
              ? "border-slate-200 bg-slate-50 cursor-not-allowed"
              : "border-blue-200 hover:border-blue-400 hover:bg-blue-50/50"
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,application/pdf"
            className="hidden"
            onChange={handleFileChange}
            disabled={isProcessing}
          />

          {file ? (
            <div>
              <p className="text-lg font-semibold">{file.name}</p>
              <p className="text-slate-500 text-sm mt-1">
                {(file.size / 1024 / 1024).toFixed(2)} MB{" "}
                {pageCount ? `• ${pageCount} pages` : ""}
              </p>
            </div>
          ) : (
            <p className="text-slate-500">
              Drop a PDF here or click to browse.
            </p>
          )}
        </section>

        <button
          onClick={handleSubmit}
          disabled={!file || !user || isProcessing || authLoading}
          type="button"
          className="w-full py-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold text-lg shadow-lg hover:shadow-xl transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {status === "uploading"
            ? "Uploading..."
            : status === "processing"
              ? "Generating..."
              : "Generate Anki Deck"}
        </button>

        {isProcessing && (
          <div className="mt-6 flex items-center justify-center gap-3 text-blue-600">
            <div className="animate-spin h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full" />
            <span>Processing pages...</span>
          </div>
        )}

        {status === "done" && showPreview && (
          <section className="mt-8 bg-white rounded-2xl shadow-xl p-6 border border-slate-100">
            <div className="flex flex-col gap-3 md:flex-row md:justify-between md:items-center mb-4">
              <h3 className="text-xl font-bold">
                Generated Cards Preview ({previewCards.length} shown)
              </h3>
              {downloadUrl && (
                <a
                  href={downloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium shadow text-center"
                >
                  Download .apkg
                </a>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[500px] overflow-y-auto pr-2">
              {previewCards.map((card, index) => (
                <article
                  key={index}
                  className="border border-slate-200 rounded-xl p-4 bg-slate-50 hover:shadow-md transition"
                >
                  <div className="font-semibold text-blue-700 mb-2">Front</div>
                  <div>{card.front}</div>
                  <div className="font-semibold text-emerald-700 mt-4 mb-2 border-t border-slate-200 pt-3">
                    Back
                  </div>
                  <div>{card.back}</div>
                </article>
              ))}
            </div>
          </section>
        )}

        {status === "error" && (
          <div className="mt-6 bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">
            {errorMsg || "Something went wrong."}
          </div>
        )}

        {!status || status === "idle" ? (
          errorMsg ? (
            <div className="mt-6 bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">
              {errorMsg}
            </div>
          ) : null
        ) : null}

        {jobId && status === "processing" && (
          <p className="mt-4 text-center text-sm text-slate-500">
            Job ID: {jobId}
          </p>
        )}
      </div>
    </main>
  );
}

function getPageRange(
  pageMode,
  pageCount,
  firstN,
  lastN,
  customStart,
  customEnd,
) {
  if (!pageCount) return { pageStart: 1, pageEnd: 1 };

  if (pageMode === "first") {
    return {
      pageStart: 1,
      pageEnd: Math.min(firstN, pageCount),
    };
  }

  if (pageMode === "last") {
    return {
      pageStart: Math.max(1, pageCount - lastN + 1),
      pageEnd: pageCount,
    };
  }

  if (pageMode === "custom") {
    return {
      pageStart: clampNumber(customStart, 1, pageCount),
      pageEnd: clampNumber(customEnd, 1, pageCount),
    };
  }

  return {
    pageStart: 1,
    pageEnd: pageCount,
  };
}

async function safeErrorMessage(response, fallback) {
  try {
    const data = await response.json();
    return data?.error || data?.message || fallback;
  } catch {
    return fallback;
  }
}

function getReadableAuthError(error) {
  const code = error?.code || "";

  switch (code) {
    case "auth/popup-blocked":
      return "Popup was blocked. The app will try redirect sign-in instead.";
    case "auth/popup-closed-by-user":
      return "Sign-in popup was closed before completion.";
    case "auth/unauthorized-domain":
      return "This domain is not authorized in Firebase. Add it in Firebase Authentication settings.";
    case "auth/operation-not-allowed":
      return "Google sign-in is not enabled in Firebase Authentication.";
    case "auth/network-request-failed":
      return "Network error while signing in. Check your connection and try again.";
    case "auth/invalid-api-key":
      return "Firebase API key is invalid. Check your NEXT_PUBLIC_FIREBASE_API_KEY value.";
    default:
      return (
        error?.message ||
        "Sign-in failed. Check Firebase configuration and authorized domains."
      );
  }
}
