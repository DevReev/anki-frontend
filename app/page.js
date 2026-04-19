// app/page.js
"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { app } from "./lib/firebase";
import Navbar from "../components/NavBar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

export default function HomePage() {
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

  // Auth check
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

  // Handle file upload
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

    // Get page count
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
    } catch (err) {
      setError("Failed to read PDF");
    }
  };

  // Start generation
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

  // Poll job status
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
      } catch (err) {
        console.error("Poll error:", err);
      }
    }, 2000);
  };

  // Card navigation
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

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  const currentCard = previewCards[currentCardIndex];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Main Grid */}
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Left: Upload & Settings */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Create Anki Deck</CardTitle>
                <CardDescription>
                  Upload a PDF and generate flashcards using AI
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* File Upload */}
                <div>
                  <label className="flex items-center justify-center w-full px-6 py-8 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:border-blue-400 transition">
                    <div className="text-center">
                      <FileUp className="w-8 h-8 mx-auto text-slate-400 mb-2" />
                      <p className="text-sm font-medium text-slate-700">
                        Click to upload PDF
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        or drag and drop
                      </p>
                    </div>
                    <input
                      type="file"
                      accept=".pdf"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>
                </div>

                {/* File Info */}
                {file && (
                  <Alert>
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <AlertDescription>
                      {file.name} • {pageCount} pages
                    </AlertDescription>
                  </Alert>
                )}

                {/* Page Range Selector */}
                {pageCount > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <label className="text-sm font-medium text-slate-700">
                        Page Range
                      </label>
                      <span className="text-sm text-slate-600">
                        {pageRange[0]} - {pageRange[1]}
                      </span>
                    </div>
                    <div className="space-y-3">
                      <Slider
                        min={1}
                        max={pageCount}
                        step={1}
                        value={[pageRange[0]]}
                        onValueChange={(val) =>
                          setPageRange([val[0], pageRange[1]])
                        }
                        className="w-full"
                      />
                      <Slider
                        min={1}
                        max={pageCount}
                        step={1}
                        value={[pageRange[1]]}
                        onValueChange={(val) =>
                          setPageRange([pageRange[0], val[0]])
                        }
                        className="w-full"
                      />
                    </div>
                  </div>
                )}

                {/* Error Alert */}
                {error && (
                  <Alert className="border-red-200 bg-red-50">
                    <AlertCircle className="h-4 w-4 text-red-600" />
                    <AlertDescription className="text-red-700">
                      {error}
                    </AlertDescription>
                  </Alert>
                )}

                {/* Generate Button */}
                <Button
                  onClick={handleGenerate}
                  disabled={!file || loading || pageRange[0] > pageRange[1]}
                  className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4 mr-2" />
                      Generate Deck
                    </>
                  )}
                </Button>

                {/* Status */}
                {jobStatus && (
                  <div className="p-4 bg-slate-100 rounded-lg">
                    <div className="text-sm font-medium text-slate-700 mb-2">
                      Status: {jobStatus.status}
                    </div>
                    {jobStatus.card_count && (
                      <div className="text-sm text-slate-600">
                        Cards generated: {jobStatus.card_count}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right: Preview */}
          <div>
            {previewCards.length > 0 ? (
              <Card className="overflow-hidden">
                <CardHeader className="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Preview ({previewCards.length})</CardTitle>
                      <CardDescription className="text-blue-100">
                        Card {currentCardIndex + 1} of {previewCards.length}
                      </CardDescription>
                    </div>
                    {jobStatus?.download_url && (
                      <Button
                        asChild
                        size="sm"
                        variant="secondary"
                        className="bg-white text-blue-600 hover:bg-blue-50"
                      >
                        <a
                          href={jobStatus.download_url}
                          download
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Download
                        </a>
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="pt-6">
                  {/* Flashcard */}
                  <div
                    onClick={() => setCardFlipped(!cardFlipped)}
                    className={`min-h-[300px] rounded-2xl p-8 cursor-pointer transition-all duration-300 ${
                      cardFlipped
                        ? "bg-emerald-50 border-2 border-emerald-200"
                        : "bg-blue-50 border-2 border-blue-200"
                    } flex flex-col justify-center`}
                  >
                    <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
                      {cardFlipped ? "Answer" : "Question"}
                    </div>
                    <div
                      className="text-lg leading-relaxed text-slate-800 mb-6"
                      dangerouslySetInnerHTML={{
                        __html: cardFlipped
                          ? currentCard.back
                          : currentCard.front,
                      }}
                    />
                    {currentCard.tags?.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-4">
                        {currentCard.tags.slice(0, 3).map((tag, i) => (
                          <Badge key={i} variant="outline">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                    <div className="text-xs text-slate-400 mt-6">
                      Click to {cardFlipped ? "show question" : "reveal answer"}
                    </div>
                  </div>

                  {/* Navigation */}
                  <div className="flex items-center justify-between mt-6">
                    <Button
                      onClick={prevCard}
                      disabled={currentCardIndex === 0}
                      variant="outline"
                    >
                      <ChevronLeft className="w-4 h-4 mr-2" />
                      Previous
                    </Button>

                    <div className="flex gap-1">
                      {previewCards.map((_, i) => (
                        <button
                          key={i}
                          onClick={() => {
                            setCurrentCardIndex(i);
                            setCardFlipped(false);
                          }}
                          className={`w-2 h-2 rounded-full transition ${
                            i === currentCardIndex
                              ? "bg-blue-600 scale-110"
                              : "bg-slate-300"
                          }`}
                        />
                      ))}
                    </div>

                    <Button
                      onClick={nextCard}
                      disabled={currentCardIndex === previewCards.length - 1}
                    >
                      Next
                      <ChevronRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="h-full flex items-center justify-center min-h-[500px]">
                <CardContent className="text-center">
                  <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <FileUp className="w-8 h-8 text-slate-400" />
                  </div>
                  <p className="text-slate-600 font-medium">
                    Upload a PDF to see preview
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
