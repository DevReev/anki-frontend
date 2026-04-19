// components/Navbar.jsx
"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getAuth, signOut, onAuthStateChanged } from "firebase/auth";
import { app } from "../app/lib/firebase";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { BookOpen, LogOut, Settings, User, Menu, X } from "lucide-react";

export default function Navbar() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!app) return;
    const auth = getAuth(app);
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    try {
      const auth = getAuth(app);
      await signOut(auth);
      router.push("/");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  return (
    <nav className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 font-bold text-xl">
            <BookOpen className="w-6 h-6 text-blue-600" />
            <span className="text-slate-900">AnkiGen</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            {user && (
              <>
                <Link
                  href="/"
                  className="text-slate-600 hover:text-slate-900 transition"
                >
                  Create
                </Link>
                <Link
                  href="/account"
                  className="text-slate-600 hover:text-slate-900 transition"
                >
                  My Decks
                </Link>
                <Link
                  href="/review"
                  className="text-slate-600 hover:text-slate-900 transition"
                >
                  Review
                </Link>
              </>
            )}
          </div>

          {/* User Menu */}
          <div className="flex items-center gap-4">
            {loading ? (
              <div className="w-8 h-8 rounded-full bg-slate-200 animate-pulse" />
            ) : user ? (
              <>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="rounded-full w-10 h-10 p-0"
                    >
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold">
                        {user.email?.[0].toUpperCase() || "U"}
                      </div>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <div className="px-2 py-2 text-sm text-slate-600">
                      {user.email}
                    </div>
                    <DropdownMenuItem asChild>
                      <Link href="/account" className="cursor-pointer">
                        <User className="w-4 h-4 mr-2" />
                        My Decks
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/review" className="cursor-pointer">
                        <Settings className="w-4 h-4 mr-2" />
                        Review Stats
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleLogout}>
                      <LogOut className="w-4 h-4 mr-2" />
                      Sign Out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <Button
                onClick={() => router.push("/auth")}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Sign In
              </Button>
            )}

            {/* Mobile Menu Button */}
            <button
              className="md:hidden"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileOpen && user && (
          <div className="md:hidden border-t border-slate-200 py-4 flex flex-col gap-4">
            <Link
              href="/"
              className="text-slate-600 hover:text-slate-900 transition"
              onClick={() => setMobileOpen(false)}
            >
              Create
            </Link>
            <Link
              href="/account"
              className="text-slate-600 hover:text-slate-900 transition"
              onClick={() => setMobileOpen(false)}
            >
              My Decks
            </Link>
            <Link
              href="/review"
              className="text-slate-600 hover:text-slate-900 transition"
              onClick={() => setMobileOpen(false)}
            >
              Review
            </Link>
          </div>
        )}
      </div>
    </nav>
  );
}
