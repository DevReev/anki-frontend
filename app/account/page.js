// app/account/page.js
"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { app } from "../lib/firebase"; // Adjust path to your firebase config

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export default function AccountPage() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [decks, setDecks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const router = useRouter();

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
      fetchDecks(idToken);
    });
    return () => unsubscribe();
  }, [router]);

  async function fetchDecks(currentToken) {
    try {
      const res = await fetch(`${API}/user/decks`, {
        headers: { Authorization: `Bearer ${currentToken}` },
      });
      if (!res.ok) throw new Error("Failed to fetch decks");
      const data = await res.json();
      setDecks(data.decks || []);
    } catch (err) {
      setError(err.message || "Could not load saved decks");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(deckId) {
    if (!confirm("Delete this deck from your profile?")) return;
    try {
      const res = await fetch(`${API}/user/decks/${deckId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Delete failed");
      setDecks((prev) => prev.filter((d) => d.id !== deckId));
    } catch (err) {
      alert("Failed to delete: " + err.message);
    }
  }

  if (loading)
    return <div className="p-8 text-center">Loading your decks...</div>;
  if (error) return <div className="p-8 text-red-600">Error: {error}</div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 py-8 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-800">My Decks</h1>
            <p className="text-slate-500 mt-1">
              {user?.email} • {decks.length} saved deck
              {decks.length !== 1 ? "s" : ""}
            </p>
          </div>
          <button
            onClick={() => router.push("/")}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            ← Create New Deck
          </button>
        </div>

        {/* Decks Grid */}
        {decks.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl shadow-sm border border-slate-100">
            <p className="text-slate-500 text-lg">No saved decks yet.</p>
            <button
              onClick={() => router.push("/")}
              className="mt-4 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition"
            >
              Generate Your First Deck
            </button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {decks.map((deck) => (
              <DeckCard
                key={deck.id}
                deck={deck}
                onDelete={() => handleDelete(deck.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Deck Card Component
function DeckCard({ deck, onDelete }) {
  const router = useRouter();
  const createdAt = new Date(deck.created_at).toLocaleDateString();

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 hover:shadow-md transition">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="font-semibold text-lg text-slate-800">
            {deck.deck_name}
          </h3>
          <p className="text-sm text-slate-500 mt-1">
            {deck.card_count} cards • {createdAt}
          </p>
        </div>
        <button
          onClick={onDelete}
          className="text-red-500 hover:text-red-700 text-sm font-medium"
        >
          Delete
        </button>
      </div>

      <div className="mt-4 flex gap-2">
        {deck.download_url && (
          <a
            href={deck.download_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg text-center text-sm font-medium hover:bg-green-700 transition"
          >
            Download .apkg
          </a>
        )}
        {deck.cards_preview?.length > 0 && (
          <button
            onClick={() => router.push(`/review?deck=${deck.id}`)}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition"
          >
            Review Cards
          </button>
        )}
      </div>

      {/* Preview snippet */}
      {deck.cards_preview?.[0] && (
        <div className="mt-4 p-3 bg-slate-50 rounded-lg text-sm text-slate-600">
          <span className="font-medium text-blue-700">Preview:</span>{" "}
          {deck.cards_preview[0].front.slice(0, 80)}...
        </div>
      )}
    </div>
  );
}
