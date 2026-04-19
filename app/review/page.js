// app/review/page.js
"use client";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { app } from "../lib/firebase";
import Navbar from "../../components/NavBar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Loader2,
  ChevronLeft,
  ChevronRight,
  Zap,
  Calendar,
  BarChart3,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export default function ReviewPage() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [decks, setDecks] = useState([]);
  const [selectedDeck, setSelectedDeck] = useState(null);
  const [stats, setStats] = useState(null);
  const [cards, setCards] = useState([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [cardFlipped, setCardFlipped] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const searchParams = useSearchParams();

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
      fetchDecksAndStats(idToken);
    });
    return () => unsubscribe();
  }, [router]);

  // Fetch decks and stats
  const fetchDecksAndStats = async (currentToken) => {
    try {
      const [decksRes, statsRes] = await Promise.all([
        fetch(`${API}/user/decks`, {
          headers: { Authorization: `Bearer ${currentToken}` },
        }),
        fetch(`${API}/review/stats`, {
          headers: { Authorization: `Bearer ${currentToken}` },
        }),
      ]);

      if (decksRes.ok) {
        const decksData = await decksRes.json();
        setDecks(decksData.decks || []);
      }

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  // Load cards for selected deck
  const loadDeckCards = async (deckId) => {
    setReviewing(true);
    setError("");
    try {
      const res = await fetch(`${API}/review/cards-due?deck_id=${deckId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.cards?.length === 0) {
        setError("No cards due for review right now!");
        setCards([]);
      } else {
        setCards(data.cards || []);
        setCurrentCardIndex(0);
        setCardFlipped(false);
      }
    } catch (err) {
      setError("Failed to load cards");
    } finally {
      setReviewing(false);
    }
  };

  // Submit review
  const submitReview = async (quality) => {
    if (!cards[currentCardIndex]) return;

    try {
      const res = await fetch(`${API}/review/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          card_id: cards[currentCardIndex].id,
          quality,
        }),
      });

      if (!res.ok) throw new Error("Submit failed");

      // Move to next card
      if (currentCardIndex < cards.length - 1) {
        setCurrentCardIndex((i) => i + 1);
        setCardFlipped(false);
      } else {
        setError("Review complete! 🎉");
        setCards([]);
      }
    } catch (err) {
      setError("Failed to submit review");
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e) => {
      if (!cards.length) return;
      if (e.key === "ArrowLeft") prevCard();
      if (e.key === "ArrowRight") nextCard();
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        setCardFlipped((f) => !f);
      }
      // Number keys for quality
      if (e.key >= "0" && e.key <= "5") {
        submitReview(parseInt(e.key));
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [currentCardIndex, cards]);

  const nextCard = () => {
    if (currentCardIndex < cards.length - 1) {
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 py-16 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      </div>
    );
  }

  const currentCard = cards[currentCardIndex];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <Navbar />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!reviewing && cards.length === 0 ? (
          // Deck Selection View
          <>
            {/* Stats Overview */}
            {stats && (
              <div className="grid md:grid-cols-3 gap-4 mb-8">
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-slate-600">Total Cards</p>
                        <p className="text-3xl font-bold text-slate-900">
                          {stats.total_cards}
                        </p>
                      </div>
                      <BarChart3 className="w-8 h-8 text-blue-600" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-slate-600">Due Today</p>
                        <p className="text-3xl font-bold text-slate-900">
                          {stats.cards_due}
                        </p>
                      </div>
                      <Calendar className="w-8 h-8 text-green-600" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-slate-600">Streak</p>
                        <p className="text-3xl font-bold text-slate-900">
                          {stats.review_streak}
                        </p>
                      </div>
                      <Zap className="w-8 h-8 text-yellow-600" />
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Decks List */}
            <Card>
              <CardHeader>
                <CardTitle>Select Deck to Review</CardTitle>
                <CardDescription>
                  Choose a deck to practice with spaced repetition
                </CardDescription>
              </CardHeader>
              <CardContent>
                {decks.length === 0 ? (
                  <div className="text-center py-12">
                    <AlertCircle className="w-8 h-8 mx-auto text-slate-400 mb-4" />
                    <p className="text-slate-600">No decks yet</p>
                    <Button asChild className="mt-4">
                      <a href="/">Create First Deck</a>
                    </Button>
                  </div>
                ) : (
                  <div className="grid md:grid-cols-2 gap-4">
                    {decks.map((deck) => (
                      <Card
                        key={deck.id}
                        className="cursor-pointer hover:shadow-lg transition"
                        onClick={() => {
                          setSelectedDeck(deck);
                          setReviewing(true);
                          loadDeckCards(deck.id);
                        }}
                      >
                        <CardHeader>
                          <CardTitle className="text-lg">
                            {deck.deck_name}
                          </CardTitle>
                          <CardDescription>
                            {deck.card_count} cards
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <Button className="w-full">
                            Review <Zap className="w-4 h-4 ml-2" />
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        ) : (
          // Review View
          <>
            {/* Header */}
            <div className="mb-8">
              <Button
                variant="ghost"
                onClick={() => {
                  setReviewing(false);
                  setCards([]);
                  setSelectedDeck(null);
                }}
              >
                ← Back to Decks
              </Button>
              <h1 className="text-3xl font-bold text-slate-900 mt-4">
                {selectedDeck?.deck_name}
              </h1>
            </div>

            {cards.length > 0 && currentCard ? (
              <>
                {/* Progress Bar */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-slate-700">
                      Progress
                    </span>
                    <span className="text-sm text-slate-600">
                      {currentCardIndex + 1} / {cards.length}
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{
                        width: `${((currentCardIndex + 1) / cards.length) * 100}%`,
                      }}
                    />
                  </div>
                </div>

                {/* Card Display */}
                <Card className="mb-8 overflow-hidden">
                  <div
                    onClick={() => setCardFlipped(!cardFlipped)}
                    className={`min-h-[400px] p-8 cursor-pointer transition-all duration-300 flex flex-col justify-center ${
                      cardFlipped
                        ? "bg-emerald-50 border-b-4 border-emerald-400"
                        : "bg-blue-50 border-b-4 border-blue-400"
                    }`}
                  >
                    <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-4">
                      {cardFlipped ? "Answer" : "Question"}
                    </div>
                    <div
                      className="text-2xl leading-relaxed text-slate-800 mb-8"
                      dangerouslySetInnerHTML={{
                        __html: cardFlipped
                          ? currentCard.card_back
                          : currentCard.card_front,
                      }}
                    />
                    {currentCard.card_tags?.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-4">
                        {currentCard.card_tags.map((tag, i) => (
                          <Badge key={i} variant="outline">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                    <div className="text-xs text-slate-400 mt-auto">
                      Press Space or click to{" "}
                      {cardFlipped ? "show question" : "reveal answer"}
                    </div>
                  </div>
                </Card>

                {/* Quality Buttons */}
                <div className="space-y-4">
                  <p className="text-sm text-slate-600 text-center font-medium">
                    How well did you remember this?
                  </p>
                  <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                    <Button
                      variant="outline"
                      onClick={() => submitReview(0)}
                      className="bg-red-50 hover:bg-red-100 border-red-200"
                      title="Press 0"
                    >
                      <div className="text-center">
                        <div className="text-xs font-bold">Again</div>
                        <div className="text-xs text-slate-500">0</div>
                      </div>
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => submitReview(1)}
                      className="bg-orange-50 hover:bg-orange-100 border-orange-200"
                      title="Press 1"
                    >
                      <div className="text-center">
                        <div className="text-xs font-bold">Hard</div>
                        <div className="text-xs text-slate-500">1</div>
                      </div>
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => submitReview(2)}
                      className="bg-yellow-50 hover:bg-yellow-100 border-yellow-200"
                      title="Press 2"
                    >
                      <div className="text-center">
                        <div className="text-xs font-bold">Tough</div>
                        <div className="text-xs text-slate-500">2</div>
                      </div>
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => submitReview(3)}
                      className="bg-green-50 hover:bg-green-100 border-green-200"
                      title="Press 3"
                    >
                      <div className="text-center">
                        <div className="text-xs font-bold">Good</div>
                        <div className="text-xs text-slate-500">3</div>
                      </div>
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => submitReview(4)}
                      className="bg-emerald-50 hover:bg-emerald-100 border-emerald-200"
                      title="Press 4"
                    >
                      <div className="text-center">
                        <div className="text-xs font-bold">Easy</div>
                        <div className="text-xs text-slate-500">4</div>
                      </div>
                    </Button>
                    <Button
                      onClick={() => submitReview(5)}
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                      title="Press 5"
                    >
                      <div className="text-center">
                        <div className="text-xs font-bold">Perfect</div>
                        <div className="text-xs">5</div>
                      </div>
                    </Button>
                  </div>
                </div>

                {/* Keyboard Help */}
                <p className="text-center text-xs text-slate-400 mt-6">
                  Press 0-5 keys for quick rating • Space to flip
                </p>
              </>
            ) : (
              <Card>
                <CardContent className="pt-12 pb-12 text-center">
                  {error === "Review complete! 🎉" ? (
                    <>
                      <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto mb-4" />
                      <p className="text-xl font-semibold text-slate-900 mb-4">
                        Review Complete!
                      </p>
                      <p className="text-slate-600 mb-6">
                        Great job! You'll see more cards when they're due.
                      </p>
                      <Button
                        onClick={() => {
                          setReviewing(false);
                          setCards([]);
                          setSelectedDeck(null);
                        }}
                      >
                        Back to Decks
                      </Button>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-12 h-12 text-blue-600 mx-auto mb-4" />
                      <p className="text-xl font-semibold text-slate-900 mb-4">
                        No Cards Due
                      </p>
                      <p className="text-slate-600">
                        Come back later when more cards are due for review.
                      </p>
                    </>
                  )}
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* Error Alert */}
        {error && error !== "Review complete! 🎉" && (
          <Alert className="mt-4 border-red-200 bg-red-50">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-700">
              {error}
            </AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  );
}
