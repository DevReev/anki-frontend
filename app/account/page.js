// app/account/page.js
"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { app } from "../lib/firebase";
// import Navbar from "../../components/Navbar";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Loader2,
  Download,
  Trash2,
  Eye,
  FileText,
  AlertCircle,
  Plus,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export default function AccountPage() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [decks, setDecks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(null);
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
        router.push("/auth");
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
    if (!token) return;
    setDeleting(deckId);
    try {
      const res = await fetch(`${API}/user/decks/${deckId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Delete failed");
      setDecks((prev) => prev.filter((d) => d.id !== deckId));
    } catch (err) {
      setError("Failed to delete: " + err.message);
    } finally {
      setDeleting(null);
    }
  }

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <Navbar />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">My Decks</h1>
            <p className="text-slate-600 mt-1">
              {user?.email} • {decks.length} deck{decks.length !== 1 ? "s" : ""}
            </p>
          </div>
          <Button
            onClick={() => router.push("/")}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create New Deck
          </Button>
        </div>

        {/* Error Alert */}
        {error && (
          <Alert className="mb-6 border-red-200 bg-red-50">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-700">
              {error}
            </AlertDescription>
          </Alert>
        )}

        {/* Decks Grid */}
        {decks.length === 0 ? (
          <Card>
            <CardContent className="pt-12 pb-12 text-center">
              <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-600 text-lg font-medium mb-4">
                No saved decks yet
              </p>
              <Button
                onClick={() => router.push("/")}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Create Your First Deck
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {decks.map((deck) => (
              <DeckCard
                key={deck.id}
                deck={deck}
                onDelete={() => handleDelete(deck.id)}
                isDeleting={deleting === deck.id}
                router={router}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function DeckCard({ deck, onDelete, isDeleting, router }) {
  const createdAt = new Date(deck.created_at).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <Card className="overflow-hidden hover:shadow-lg transition flex flex-col">
      <CardHeader className="bg-gradient-to-r from-blue-50 to-blue-100">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="line-clamp-2">{deck.deck_name}</CardTitle>
            <CardDescription className="mt-1">
              {deck.card_count} cards • {createdAt}
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-4 flex-1 flex flex-col">
        {/* Preview */}
        {deck.cards_preview?.[0] && (
          <div className="mb-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
            <div className="text-xs font-semibold text-slate-600 mb-2">
              Preview
            </div>
            <div
              className="text-sm text-slate-700 line-clamp-3"
              dangerouslySetInnerHTML={{
                __html: deck.cards_preview[0].front.slice(0, 100),
              }}
            />
          </div>
        )}

        {/* Tags Preview */}
        {deck.cards_preview?.[0]?.tags?.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-1">
            {deck.cards_preview[0].tags.slice(0, 2).map((tag, i) => (
              <Badge key={i} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 mt-auto">
          {deck.download_url && (
            <Button variant="outline" size="sm" asChild className="flex-1">
              <a
                href={deck.download_url}
                download
                target="_blank"
                rel="noopener noreferrer"
              >
                <Download className="w-4 h-4 mr-1" />
                Download
              </a>
            </Button>
          )}

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogTitle>Delete Deck?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete "{deck.deck_name}" and all its
                cards. This action cannot be undone.
              </AlertDialogDescription>
              <div className="flex gap-2 justify-end">
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={onDelete}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  Delete
                </AlertDialogAction>
              </div>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
}
