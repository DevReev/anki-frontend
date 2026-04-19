"use client";

import { useState, useRef } from "react";

const API = process.env.NEXT_PUBLIC_API_URL;

export default function Home() {
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState("idle"); // idle | uploading | processing | done | error
  const [errorMsg, setErrorMsg] = useState("");
  const [downloadUrl, setDownloadUrl] = useState("");
  const inputRef = useRef();

  function handleFileChange(e) {
    const selected = e.target.files[0];
    if (selected && selected.type === "application/pdf") {
      setFile(selected);
      setStatus("idle");
      setErrorMsg("");
      setDownloadUrl("");
    } else {
      setErrorMsg("Please select a valid PDF file.");
    }
  }

  async function handleSubmit() {
    if (!file) return;
    setStatus("uploading");
    setErrorMsg("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`${API}/generate`, {
        method: "POST",
        body: formData,
      });

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
        setDownloadUrl(`${API}/download/${job_id}`);
        setStatus("done");
      } else if (data.status === "error") {
        clearInterval(interval);
        setStatus("error");
        setErrorMsg(data.error || "Generation failed");
      }
    } catch (err) {
      failures++;
      console.warn(`Poll attempt failed (${failures}):`, err.message);
      if (failures >= 4) {
        clearInterval(interval);
        setStatus("error");
        setErrorMsg(`Connection lost after ${failures} retries: ${err.message}`);
      }
    }
  }, 6000);
}

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 w-full max-w-lg p-8">
        <h1 className="text-2xl font-semibold text-gray-900 mb-1">
          PDF → Anki Deck
        </h1>
        <p className="text-gray-500 text-sm mb-8">
          Upload a PDF and get a downloadable Anki deck (.apkg).
        </p>

        {/* Drop zone */}
        <div
          onClick={() => inputRef.current.click()}
          className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors mb-6"
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
              <p className="text-gray-800 font-medium">{file.name}</p>
              <p className="text-gray-400 text-sm mt-1">
                {(file.size / 1024 / 1024).toFixed(2)} MB — click to change
              </p>
            </div>
          ) : (
            <div>
              <p className="text-gray-500">Click to select a PDF</p>
              <p className="text-gray-400 text-xs mt-1">or drag and drop</p>
            </div>
          )}
        </div>

        {/* Generate button */}
        <button
          onClick={handleSubmit}
          disabled={!file || status === "uploading" || status === "processing"}
          className="w-full py-3 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {status === "uploading"
            ? "Uploading..."
            : status === "processing"
            ? "Generating cards..."
            : "Generate Anki Deck"}
        </button>

        {/* Status feedback */}
        {status === "processing" && (
          <div className="mt-6 flex items-center gap-3 text-blue-600">
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            <span className="text-sm">
              Processing your PDF — this can take a few minutes depending on size.
            </span>
          </div>
        )}

        {status === "done" && (
          <div className="mt-6">
            <a
              href={downloadUrl}
              download="anki_deck.apkg"
              className="block w-full py-3 rounded-xl bg-green-600 text-white font-medium text-center hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
            >
              ⬇ Download Anki Deck (.apkg)
            </a>
            <p className="text-gray-400 text-xs text-center mt-2">
              Import this file directly into Anki on any device.
            </p>
          </div>
        )}

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