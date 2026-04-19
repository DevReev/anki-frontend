// app/review/ReviewClient.js
"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { app } from "../lib/firebase";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export default function ReviewClient() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [cards, setCards] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const searchParams = useSearchParams(); // ✅ Now safe inside client component
  const deckId = searchParams.get("deck");
  const router = useRouter();
  const cardRef = useRef(null);

  useEffect(() => {
    if (!app) {
      setError("Firebase not configured");
      setLoading(false);
      return;
    }
    const auth = getAuth(app);
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        router.push("/");
        return;
      }
      setUser(currentUser);
      const idToken = await currentUser.getIdToken(true);
      setToken(idToken);
      if (deckId) {
        fetchDeckCards(deckId, idToken);
      } else {
        setError("No deck selected");
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, [deckId, router]);

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === "ArrowLeft") prevCard();
      if (e.key === "ArrowRight") nextCard();
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        setFlipped((f) => !f);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [currentIndex, cards.length]);

  async function fetchDeckCards(id, currentToken) {
    try {
      const res = await fetch(`${API}/preview/${id}`, {
        headers: { Authorization: `Bearer ${currentToken}` },
      });
      if (!res.ok) throw new Error("Failed to load deck");
      const data = await res.json();
      if (!data.cards || data.cards.length === 0) {
        setError("No cards found in this deck");
      } else {
        setCards(data.cards);
      }
    } catch (err) {
      setError(err.message || "Could not load cards");
    } finally {
      setLoading(false);
    }
  }

  function nextCard() {
    if (currentIndex < cards.length - 1) {
      setCurrentIndex((i) => i + 1);
      setFlipped(false);
    }
  }

  function prevCard() {
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
      setFlipped(false);
    }
  }

  function handleCardClick() {
    setFlipped((f) => !f);
  }

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center">
        Loading cards...
      </div>
    );
  if (error)
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <p className="text-red-600 text-lg mb-4">Error: {error}</p>
        <button
          onClick={() => router.push("/account")}
          className="px-6 py-3 bg-blue-600 text-white rounded-xl"
        >
          Back to My Decks
        </button>
      </div>
    );

  const currentCard = cards[currentIndex];

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 py-6 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => router.back()}
            className="text-slate-600 hover:text-slate-900"
          >
            ← Back
          </button>
          <span className="text-sm text-slate-500">
            Card {currentIndex + 1} of {cards.length}
          </span>
          <button
            onClick={() => router.push("/account")}
            className="text-blue-600 hover:underline text-sm"
          >
            My Decks
          </button>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-slate-200 rounded-full h-2 mb-6">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${((currentIndex + 1) / cards.length) * 100}%` }}
          />
        </div>

        {/* Flip Card */}
        <div
          ref={cardRef}
          onClick={handleCardClick}
          className={`
            relative w-full min-h-[300px] bg-white rounded-3xl shadow-xl 
            border border-slate-200 p-8 cursor-pointer 
            transform transition-all duration-300 ease-in-out
            ${flipped ? "ring-4 ring-blue-200" : "hover:shadow-2xl"}
          `}
        >
          {/* Front */}
          <div
            className={`transition-opacity duration-200 ${flipped ? "opacity-0 absolute" : "opacity-100"}`}
          >
            <div className="text-sm font-medium text-blue-600 mb-3 uppercase tracking-wide">
              Front
            </div>
            <div
              className="text-xl leading-relaxed text-slate-800"
              dangerouslySetInnerHTML={{ __html: currentCard.front }}
            />
            {currentCard.tags?.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {currentCard.tags.slice(0, 3).map((tag, i) => (
                  <span
                    key={i}
                    className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
            <div className="mt-6 text-sm text-slate-400">
              Click to reveal answer →
            </div>
          </div>

          {/* Back */}
          <div
            className={`transition-opacity duration-200 ${!flipped ? "opacity-0 absolute" : "opacity-100"}`}
          >
            <div className="text-sm font-medium text-emerald-600 mb-3 uppercase tracking-wide">
              Answer
            </div>
            <div
              className="text-xl leading-relaxed text-slate-800"
              dangerouslySetInnerHTML={{ __html: currentCard.back }}
            />
            <div className="mt-6 text-sm text-slate-400">
              Click to show question ←
            </div>
          </div>
        </div>

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between mt-8">
          <button
            onClick={prevCard}
            disabled={currentIndex === 0}
            className={`
              px-6 py-3 rounded-xl font-medium transition flex items-center gap-2
              ${
                currentIndex === 0
                  ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                  : "bg-white text-slate-700 hover:bg-slate-50 shadow border border-slate-200"
              }
            `}
          >
            ← Previous
          </button>

          <div className="flex gap-2">
            {cards.map((_, i) => (
              <button
                key={i}
                onClick={() => {
                  setCurrentIndex(i);
                  setFlipped(false);
                }}
                className={`w-3 h-3 rounded-full transition ${
                  i === currentIndex
                    ? "bg-blue-600 scale-110"
                    : "bg-slate-300 hover:bg-slate-400"
                }`}
                aria-label={`Go to card ${i + 1}`}
              />
            ))}
          </div>

          <button
            onClick={nextCard}
            disabled={currentIndex === cards.length - 1}
            className={`
              px-6 py-3 rounded-xl font-medium transition flex items-center gap-2
              ${
                currentIndex === cards.length - 1
                  ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                  : "bg-blue-600 text-white hover:bg-blue-700 shadow"
              }
            `}
          >
            Next →
          </button>
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          Use ← → arrows to navigate • Space/Enter to flip
        </p>
      </div>
    </div>
  );
}
