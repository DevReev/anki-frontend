"use client";

import { useState, useRef } from "react";

const API = process.env.NEXT_PUBLIC_API_URL;

export default function Home() {
  const [file, setFile] = useState(null);
  const [pageCount, setPageCount] = useState(null);
  const [pageMode, setPageMode] = useState("all"); // "all" | "first" | "last" | "custom"
  const [firstN, setFirstN] = useState(1);
  const [lastN, setLastN] = useState(1);
  const [customStart, setCustomStart] = useState(1);
  const [customEnd, setCustomEnd] = useState(1);
  const [status, setStatus] = useState("idle");
  const [cardCount, setCardCount] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [downloadUrl, setDownloadUrl] = useState("");
  const [downloadName, setDownloadName] = useState("anki_deck.apkg");
  const inputRef = useRef();

  async function handleFileChange(e) {
    const selected = e.target.files[0];
    if (!selected || selected.type !== "application/pdf") {
      setErrorMsg("Please select a valid PDF file.");
      return;
    }
    setFile(selected);
    setStatus("idle");
    setErrorMsg("");
    setDownloadUrl("");
    setCardCount(null);
    setPageCount(null);
    setPageMode("all");

    // Fetch page count
    try {
      const form = new FormData();
      form.append("file", selected);
      const res = await fetch(`${API}/page-count`, { method: "POST", body: form });
      const data = await res.json();
      if (data.page_count) {
        setPageCount(data.page_count);
        setFirstN(Math.min(5, data.page_count));
        setLastN(Math.min(5, data.page_count));
        setCustomStart(1);
        setCustomEnd(data.page_count);
      }
    } catch {
      // non-fatal — page selector stays hidden
    }
  }

  function getPageRange() {
    if (!pageCount || pageMode === "all") return { page_start: 1, page_end: pageCount };
    if (pageMode === "first") return { page_start: 1, page_end: Math.min(firstN, pageCount) };
    if (pageMode === "last") return { page_start: Math.max(1, pageCount - lastN + 1), page_end: pageCount };
    if (pageMode === "custom") return { page_start: customStart, page_end: customEnd };
    return {};
  }

  async function handleSubmit() {
    if (!file) return;
    setStatus("uploading");
    setErrorMsg("");
    setCardCount(null);

    try {
      const { page_start, page_end } = getPageRange();
      const formData = new FormData();
      formData.append("file", file);
      if (page_start) formData.append("page_start", page_start);
      if (page_end) formData.append("page_end", page_end);

      const res = await fetch(`${API}/generate`, { method: "POST", body: formData });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Upload failed");
      }

      const { job_id } = await res.json();
      setStatus("processing");
      pollStatus(job_id);
    } catch (err) {
      setStatus("error");
      setErrorMsg(err.message);
    }
  }

  function pollStatus(job_id) {
    let failures = 0;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API}/status/${job_id}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        failures = 0;

        if (data.status === "done") {
          clearInterval(interval);
          setCardCount(data.card_count);
          // Build download URL — filename is randomized server-side
          setDownloadUrl(`${API}/download/${job_id}`);
          setDownloadName(`anki_${job_id.slice(0, 8)}.apkg`);
          setStatus("done");
        } else if (data.status === "error") {
          clearInterval(interval);
          setStatus("error");
          setErrorMsg(data.error || "Generation failed");
        }
      } catch (err) {
        failures++;
        if (failures >= 4) {
          clearInterval(interval);
          setStatus("error");
          setErrorMsg(`Connection lost after ${failures} retries: ${err.message}`);
        }
      }
    }, 6000);
  }

  const isProcessing = status === "uploading" || status === "processing";

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 w-full max-w-lg p-8">
        <h1 className="text-2xl font-semibold text-gray-900 mb-1">PDF → Anki Deck</h1>
        <p className="text-gray-500 text-sm mb-8">
          Upload a PDF and get a downloadable Anki deck (.apkg).
        </p>

        {/* Drop zone */}
        <div
          onClick={() => !isProcessing && inputRef.current.click()}
          className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors mb-4 ${
            isProcessing
              ? "border-gray-100 bg-gray-50 cursor-not-allowed"
              : "border-gray-200 cursor-pointer hover:border-blue-400 hover:bg-blue-50"
          }`}
        >
          <input ref={inputRef} type="file" accept=".pdf" className="hidden" onChange={handleFileChange} />
          {file ? (
            <div>
              <p className="text-gray-800 font-medium">{file.name}</p>
              <p className="text-gray-400 text-sm mt-1">
                {(file.size / 1024 / 1024).toFixed(2)} MB
                {pageCount ? ` · ${pageCount} pages` : ""}
                {!isProcessing && " — click to change"}
              </p>
            </div>
          ) : (
            <div>
              <p className="text-gray-500">Click to select a PDF</p>
              <p className="text-gray-400 text-xs mt-1">or drag and drop</p>
            </div>
          )}
        </div>

        {/* Page range selector */}
        {pageCount && !isProcessing && status !== "done" && (
          <div className="mb-6 border border-gray-100 rounded-xl p-4 bg-gray-50">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Pages to process
            </p>
            <div className="flex flex-wrap gap-2 mb-3">
              {["all", "first", "last", "custom"].map((m) => (
                <button
                  key={m}
                  onClick={() => setPageMode(m)}
                  className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                    pageMode === m
                      ? "bg-blue-600 text-white"
                      : "bg-white border border-gray-200 text-gray-600 hover:border-blue-400"
                  }`}
                >
                  {m === "all" ? `All (${pageCount})` : m.charAt(0).toUpperCase() + m.slice(1)}
                </button>
              ))}
            </div>

            {pageMode === "first" && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span>First</span>
                <input
                  type="number" min={1} max={pageCount} value={firstN}
                  onChange={(e) => setFirstN(Math.min(pageCount, Math.max(1, +e.target.value)))}
                  className="w-16 border border-gray-200 rounded-lg px-2 py-1 text-center"
                />
                <span>pages</span>
              </div>
            )}
            {pageMode === "last" && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span>Last</span>
                <input
                  type="number" min={1} max={pageCount} value={lastN}
                  onChange={(e) => setLastN(Math.min(pageCount, Math.max(1, +e.target.value)))}
                  className="w-16 border border-gray-200 rounded-lg px-2 py-1 text-center"
                />
                <span>pages</span>
              </div>
            )}
            {pageMode === "custom" && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span>Pages</span>
                <input
                  type="number" min={1} max={pageCount} value={customStart}
                  onChange={(e) => setCustomStart(Math.min(customEnd, Math.max(1, +e.target.value)))}
                  className="w-16 border border-gray-200 rounded-lg px-2 py-1 text-center"
                />
                <span>to</span>
                <input
                  type="number" min={customStart} max={pageCount} value={customEnd}
                  onChange={(e) => setCustomEnd(Math.min(pageCount, Math.max(customStart, +e.target.value)))}
                  className="w-16 border border-gray-200 rounded-lg px-2 py-1 text-center"
                />
                <span className="text-gray-400">of {pageCount}</span>
              </div>
            )}
          </div>
        )}

        {/* Generate button */}
        <button
          onClick={handleSubmit}
          disabled={!file || isProcessing}
          className="w-full py-3 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {status === "uploading" ? "Uploading..." : status === "processing" ? "Generating cards..." : "Generate Anki Deck"}
        </button>

        {/* Processing spinner */}
        {status === "processing" && (
          <div className="mt-6 flex items-center gap-3 text-blue-600">
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            <span className="text-sm">Processing your PDF — this may take a few minutes.</span>
          </div>
        )}

        {/* Download — only shown when status === "done" */}
        {status === "done" && (
          <div className="mt-6">
            <a
              href={downloadUrl}
              download={downloadName}
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-green-600 text-white font-medium text-center hover:bg-green-700 transition-colors"
            >
              ⬇ Download Anki Deck (.apkg)
            </a>
            {cardCount && (
              <p className="text-gray-400 text-xs text-center mt-2">
                {cardCount} cards generated · import directly into Anki on any device
              </p>
            )}
          </div>
        )}

        {/* Error */}
        {status === "error" && (
          <div className="mt-6 bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="text-red-700 text-sm font-medium">Something went wrong</p>
            <p className="text-red-500 text-xs mt-1">{errorMsg}</p>
          </div>
        )}
      </div>
    </main>
  );
}