// app/page.js
"use client";
import { useState, useRef, useEffect } from "react";
import { initializeApp } from "firebase/app";
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
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

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

export default function Home() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [file, setFile] = useState(null);
  const [pageCount, setPageCount] = useState(null);
  const [pageMode, setPageMode] = useState("all");
  const [firstN, setFirstN] = useState(1);
  const [lastN, setLastN] = useState(1);
  const [customStart, setCustomStart] = useState(1);
  const [customEnd, setCustomEnd] = useState(1);
  const [status, setStatus] = useState("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [jobId, setJobId] = useState(null);
  const [previewCards, setPreviewCards] = useState([]);
  const [showPreview, setShowPreview] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState("");
  const inputRef = useRef();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const t = await u.getIdToken();
        setToken(t);
      } else {
        setToken(null);
      }
    });
    return () => unsub();
  }, []);

  const handleLogin = () => signInWithPopup(auth, new GoogleAuthProvider());

  async function handleFileChange(e) {
    const selected = e.target.files[0];
    if (!selected || selected.type !== "application/pdf") {
      setErrorMsg("Please select a valid PDF file.");
      return;
    }
    setFile(selected);
    setStatus("idle");
    setErrorMsg("");
    setShowPreview(false);
    setPreviewCards([]);
    try {
      const form = new FormData();
      form.append("file", selected);
      const res = await fetch(`${API}/page-count`, {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (data.page_count) {
        setPageCount(data.page_count);
        setFirstN(Math.min(5, data.page_count));
        setLastN(Math.min(5, data.page_count));
        setCustomStart(1);
        setCustomEnd(data.page_count);
      }
    } catch {
      setErrorMsg("Failed to read PDF pages");
    }
  }

  function getPageRange() {
    if (!pageCount || pageMode === "all")
      return { page_start: 1, page_end: pageCount };
    if (pageMode === "first")
      return { page_start: 1, page_end: Math.min(firstN, pageCount) };
    if (pageMode === "last")
      return {
        page_start: Math.max(1, pageCount - lastN + 1),
        page_end: pageCount,
      };
    return { page_start: customStart, page_end: customEnd };
  }

  async function handleSubmit() {
    if (!file || !token) return;
    setStatus("uploading");
    setErrorMsg("");
    setShowPreview(false);
    try {
      const { page_start, page_end } = getPageRange();
      const formData = new FormData();
      formData.append("file", file);
      if (page_start) formData.append("page_start", page_start);
      if (page_end) formData.append("page_end", page_end);

      const res = await fetch(`${API}/generate`, {
        method: "POST",
        body: formData,
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error((await res.json()).error || "Upload failed");
      const { job_id } = await res.json();
      setJobId(job_id);
      setStatus("processing");
      pollStatus(job_id);
    } catch (err) {
      setStatus("error");
      setErrorMsg(err.message);
    }
  }

  function pollStatus(id) {
    let failures = 0;
    const interval = setInterval(async () => {
      try {
        // Refresh token before polling to avoid 401 on long runs
        const t = user ? await user.getIdToken() : token;
        const res = await fetch(`${API}/status/${id}`, {
          headers: { Authorization: `Bearer ${t}` },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        failures = 0;
        if (data.status === "done") {
          clearInterval(interval);
          setStatus("done");
          fetchPreview(id, t);
        } else if (data.status === "error") {
          clearInterval(interval);
          setStatus("error");
          setErrorMsg(data.error);
        }
      } catch (err) {
        failures++;
        if (failures >= 4) {
          clearInterval(interval);
          setStatus("error");
          setErrorMsg("Connection lost");
        }
      }
    }, 5000);
  }

  async function fetchPreview(id, t) {
    try {
      const res = await fetch(`${API}/preview/${id}`, {
        headers: { Authorization: `Bearer ${t || token}` },
      });
      const data = await res.json();
      setPreviewCards(data.cards || []);
      setDownloadUrl(data.download_url || "");
      setShowPreview(true);
    } catch {
      setErrorMsg("Failed to load preview");
    }
  }

  const isProcessing = status === "uploading" || status === "processing";

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 text-slate-800 p-6 font-sans">
      <div className="max-w-5xl mx-auto">
        {/* Header & Auth */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">
            PDF → Anki Deck
          </h1>
          {user ? (
            <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-full shadow-md">
              <img
                src={user.photoURL || "/default-avatar.png"}
                className="w-8 h-8 rounded-full"
                alt="avatar"
              />
              <span className="text-sm font-medium">{user.email}</span>
              <button
                onClick={() => auth.signOut()}
                className="text-xs text-red-500 hover:underline"
              >
                Logout
              </button>
            </div>
          ) : (
            <button
              onClick={handleLogin}
              className="px-5 py-2 bg-blue-600 text-white rounded-lg shadow hover:bg-blue-700 transition"
            >
              Sign in with Google
            </button>
          )}
        </div>

        {/* Persistent Page Selector */}
        <div className="sticky top-4 z-10 bg-white/90 backdrop-blur-md rounded-2xl p-5 shadow-lg border border-slate-100 mb-6">
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">
            Pages to Process
          </h3>
          <div className="flex flex-wrap gap-3 mb-4">
            {["all", "first", "last", "custom"].map((m) => (
              <button
                key={m}
                onClick={() => setPageMode(m)}
                className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${pageMode === m ? "bg-blue-600 text-white shadow-md scale-105" : "bg-slate-100 hover:bg-slate-200 text-slate-600"}`}
              >
                {m === "all"
                  ? `All (${pageCount || "?"})`
                  : m.charAt(0).toUpperCase() + m.slice(1)}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3 text-slate-700">
            {pageMode === "first" && (
              <span className="flex items-center gap-2">
                First{" "}
                <input
                  type="number"
                  min={1}
                  max={pageCount}
                  value={firstN}
                  onChange={(e) =>
                    setFirstN(Math.min(pageCount, Math.max(1, +e.target.value)))
                  }
                  className="w-16 border-2 border-slate-200 rounded-lg px-3 py-2 text-center font-medium focus:border-blue-500 outline-none"
                />{" "}
                pages
              </span>
            )}
            {pageMode === "last" && (
              <span className="flex items-center gap-2">
                Last{" "}
                <input
                  type="number"
                  min={1}
                  max={pageCount}
                  value={lastN}
                  onChange={(e) =>
                    setLastN(Math.min(pageCount, Math.max(1, +e.target.value)))
                  }
                  className="w-16 border-2 border-slate-200 rounded-lg px-3 py-2 text-center font-medium focus:border-blue-500 outline-none"
                />{" "}
                pages
              </span>
            )}
            {pageMode === "custom" && (
              <span className="flex items-center gap-2">
                Pages{" "}
                <input
                  type="number"
                  min={1}
                  max={pageCount}
                  value={customStart}
                  onChange={(e) =>
                    setCustomStart(
                      Math.min(customEnd, Math.max(1, +e.target.value)),
                    )
                  }
                  className="w-16 border-2 border-slate-200 rounded-lg px-3 py-2 text-center font-medium focus:border-blue-500 outline-none"
                />{" "}
                to{" "}
                <input
                  type="number"
                  min={customStart}
                  max={pageCount}
                  value={customEnd}
                  onChange={(e) =>
                    setCustomEnd(
                      Math.min(
                        pageCount,
                        Math.max(customStart, +e.target.value),
                      ),
                    )
                  }
                  className="w-16 border-2 border-slate-200 rounded-lg px-3 py-2 text-center font-medium focus:border-blue-500 outline-none"
                />{" "}
                of {pageCount}
              </span>
            )}
          </div>
        </div>

        {/* Upload Area */}
        <div
          onClick={() => !isProcessing && inputRef.current.click()}
          className={`border-2 border-dashed rounded-2xl p-10 text-center transition-all cursor-pointer mb-6 ${isProcessing ? "border-slate-200 bg-slate-50 cursor-not-allowed" : "border-blue-200 hover:border-blue-400 hover:bg-blue-50/50"}`}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={handleFileChange}
          />
          {file ? (
            <div>
              <p className="text-lg font-semibold">{file.name}</p>
              <p className="text-slate-500 text-sm mt-1">
                {(file.size / 1024 / 1024).toFixed(2)} MB • {pageCount} pages
              </p>
            </div>
          ) : (
            <p className="text-slate-500">Drop a PDF here or click to browse</p>
          )}
        </div>

        {/* Action Button */}
        <button
          onClick={handleSubmit}
          disabled={!file || isProcessing || !user}
          className="w-full py-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold text-lg shadow-lg hover:shadow-xl transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {status === "uploading"
            ? "Uploading..."
            : status === "processing"
              ? "Generating..."
              : "Generate Anki Deck"}
        </button>

        {/* Status & Preview */}
        {isProcessing && (
          <div className="mt-6 flex items-center justify-center gap-3 text-blue-600">
            <div className="animate-spin h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full"></div>
            <span>Processing pages...</span>
          </div>
        )}

        {status === "done" && showPreview && (
          <div className="mt-8 bg-white rounded-2xl shadow-xl p-6 border border-slate-100">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">
                Generated Cards Preview ({previewCards.length} shown)
              </h3>
              {downloadUrl && (
                <a
                  href={downloadUrl}
                  target="_blank"
                  rel="noopener"
                  className="px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium shadow"
                >
                  ⬇ Download .apkg
                </a>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
              {previewCards.map((c, i) => (
                <div
                  key={i}
                  className="border border-slate-200 rounded-xl p-4 bg-slate-50 hover:shadow-md transition"
                >
                  <div className="font-semibold text-blue-700 mb-2">
                    Front: {c.front}
                  </div>
                  <div className="text-slate-700 border-t border-slate-200 pt-2 mt-2">
                    Back: {c.back}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {status === "error" && (
          <div className="mt-6 bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">
            {errorMsg}
          </div>
        )}
      </div>
    </main>
  );
}
