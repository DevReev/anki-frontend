// components/NavBar.jsx
"use client";
import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { getAuth, signOut, onAuthStateChanged } from "firebase/auth";
import { app } from "../app/lib/firebase";
import {
  BookOpen,
  LogOut,
  User,
  Menu,
  X,
  Layers,
  RotateCcw,
} from "lucide-react";

export default function Navbar() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!app) return;
    const auth = getAuth(app);
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const handleClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleLogout = async () => {
    try {
      const auth = getAuth(app);
      await signOut(auth);
      setDropdownOpen(false);
      router.push("/");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const navLinks = [
    { href: "/", label: "Create", icon: <BookOpen size={14} /> },
    { href: "/account", label: "My Decks", icon: <Layers size={14} /> },
    { href: "/review", label: "Review", icon: <RotateCcw size={14} /> },
  ];

  return (
    <>
      <style>{css}</style>
      <nav style={S.nav}>
        <div style={S.inner}>
          {/* Logo */}
          <Link href="/" style={S.logo}>
            <span style={S.logoText}>AnkiFlow</span>
          </Link>

          {/* Desktop nav links */}
          {user && (
            <div style={S.links}>
              {navLinks.map(({ href, label }) => {
                const active = pathname === href;
                return (
                  <Link
                    key={href}
                    href={href}
                    style={{ ...S.link, ...(active ? S.linkActive : {}) }}
                    className={active ? "af-link-active" : "af-link"}
                  >
                    {label}
                    {active && <span style={S.linkUnderline} />}
                  </Link>
                );
              })}
            </div>
          )}

          {/* Right side */}
          <div style={S.right}>
            {loading ? (
              <div style={S.avatarSkeleton} />
            ) : user ? (
              <div style={{ position: "relative" }} ref={dropdownRef}>
                <button
                  onClick={() => setDropdownOpen((o) => !o)}
                  style={S.avatarBtn}
                  className="af-avatar"
                >
                  <div style={S.avatar}>
                    {user.email?.[0].toUpperCase() || "U"}
                  </div>
                </button>

                {dropdownOpen && (
                  <div style={S.dropdown}>
                    <div style={S.dropEmail}>{user.email}</div>
                    <div style={S.dropDivider} />
                    {navLinks.map(({ href, label, icon }) => (
                      <Link
                        key={href}
                        href={href}
                        style={S.dropItem}
                        className="af-drop-item"
                        onClick={() => setDropdownOpen(false)}
                      >
                        <span style={S.dropIcon}>{icon}</span>
                        {label}
                      </Link>
                    ))}
                    <div style={S.dropDivider} />
                    <button
                      onClick={handleLogout}
                      style={{ ...S.dropItem, ...S.dropLogout }}
                      className="af-drop-item"
                    >
                      <span style={S.dropIcon}>
                        <LogOut size={14} />
                      </span>
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={() => router.push("/auth")}
                style={S.signInBtn}
                className="af-sign-in"
              >
                Sign In
              </button>
            )}

            {/* Mobile hamburger */}
            <button
              style={S.hamburger}
              className="af-hamburger"
              onClick={() => setMobileOpen((o) => !o)}
            >
              {mobileOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>

        {/* Mobile drawer */}
        {mobileOpen && user && (
          <div style={S.mobileMenu} className="af-mobile-menu">
            {navLinks.map(({ href, label, icon }) => {
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  style={{
                    ...S.mobileLink,
                    ...(active ? S.mobileLinkActive : {}),
                  }}
                  className="af-mobile-link"
                  onClick={() => setMobileOpen(false)}
                >
                  <span style={{ opacity: 0.5 }}>{icon}</span>
                  {label}
                </Link>
              );
            })}
            <div style={S.dropDivider} />
            <button
              onClick={handleLogout}
              style={{
                ...S.mobileLink,
                color: "var(--burgundy)",
                background: "none",
                border: "none",
                width: "100%",
                textAlign: "left",
                cursor: "pointer",
              }}
            >
              <LogOut size={14} style={{ opacity: 0.6 }} />
              Sign Out
            </button>
          </div>
        )}
      </nav>
    </>
  );
}

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,700&family=IBM+Plex+Mono:wght@400;500&family=Crimson+Pro:ital,wght@0,400;0,600;1,400&display=swap');

  :root {
    --cream: #F5F0E8;
    --cream-dark: #EDE6D6;
    --ink: #1A1208;
    --ink-soft: #3D3322;
    --ink-muted: #7A6E5A;
    --burgundy: #6B1F2A;
    --burgundy-light: #8B2F3D;
    --gold: #C4963A;
    --rule: #C8BFA8;
    --rule-strong: #8A7A62;
    --white: #FDFBF7;
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    background: var(--cream);
    color: var(--ink);
    font-family: 'Crimson Pro', Georgia, serif;
  }

  .af-link { text-decoration: none; transition: color 0.15s; }
  .af-link:hover { color: var(--ink) !important; }
  .af-link-active { text-decoration: none; }

  .af-avatar { transition: opacity 0.15s; }
  .af-avatar:hover { opacity: 0.75; }

  .af-drop-item { transition: background 0.12s; text-decoration: none; }
  .af-drop-item:hover { background: var(--cream-dark) !important; }

  .af-sign-in { transition: all 0.15s ease; }
  .af-sign-in:hover { background: var(--ink-soft) !important; }

  .af-hamburger { display: none; }
  @media (max-width: 768px) { .af-hamburger { display: flex !important; } }

  .af-mobile-menu { animation: slideDown 0.18s ease; }
  @keyframes slideDown { from { opacity:0; transform:translateY(-6px); } to { opacity:1; transform:translateY(0); } }
  .af-mobile-link { transition: background 0.12s; text-decoration: none; }
  .af-mobile-link:hover { background: var(--cream-dark) !important; }

  @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
  .af-spin { animation: spin 1s linear infinite; }
`;

const S = {
  nav: {
    position: "sticky",
    top: 0,
    zIndex: 50,
    background: "var(--ink)",
    borderBottom: "3px solid var(--burgundy)",
    fontFamily: "'Crimson Pro', Georgia, serif",
  },
  inner: {
    maxWidth: 1200,
    margin: "0 auto",
    padding: "0 24px",
    height: 56,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 24,
  },
  logo: {
    display: "flex",
    alignItems: "center",
    textDecoration: "none",
    flexShrink: 0,
  },
  logoText: {
    fontFamily: "'Playfair Display', Georgia, serif",
    fontSize: 20,
    fontWeight: 900,
    color: "var(--cream)",
    letterSpacing: "0.12em",
    textTransform: "uppercase",
  },
  links: { display: "flex", alignItems: "center", gap: 0 },
  link: {
    position: "relative",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "0 18px",
    height: 56,
    justifyContent: "center",
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 10,
    fontWeight: 500,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    color: "rgba(245,240,232,0.45)",
    textDecoration: "none",
    gap: 2,
  },
  linkActive: {
    color: "var(--cream)",
    background: "rgba(255,255,255,0.05)",
  },
  linkUnderline: {
    position: "absolute",
    bottom: 0,
    left: 18,
    right: 18,
    height: 2,
    background: "var(--gold)",
  },
  right: { display: "flex", alignItems: "center", gap: 12, flexShrink: 0 },
  avatarSkeleton: {
    width: 32,
    height: 32,
    borderRadius: "50%",
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.12)",
  },
  avatarBtn: {
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: 0,
    borderRadius: "50%",
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: "50%",
    background: "var(--burgundy)",
    border: "1.5px solid var(--burgundy-light)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "var(--cream)",
    fontFamily: "'Playfair Display', serif",
    fontSize: 13,
    fontWeight: 700,
  },
  dropdown: {
    position: "absolute",
    right: 0,
    top: "calc(100% + 8px)",
    background: "var(--white)",
    border: "1px solid var(--rule)",
    borderTop: "2px solid var(--burgundy)",
    padding: "6px",
    minWidth: 210,
    zIndex: 100,
    boxShadow: "0 8px 32px rgba(26,18,8,0.2)",
  },
  dropEmail: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 10,
    color: "var(--ink-muted)",
    letterSpacing: "0.06em",
    padding: "8px 12px 6px",
    wordBreak: "break-all",
  },
  dropDivider: { height: 1, background: "var(--rule)", margin: "4px 0" },
  dropItem: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "9px 12px",
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 10,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    fontWeight: 500,
    color: "var(--ink-soft)",
    cursor: "pointer",
    background: "transparent",
    border: "none",
    width: "100%",
  },
  dropLogout: { color: "var(--burgundy)" },
  dropIcon: { opacity: 0.5, display: "flex", alignItems: "center" },
  signInBtn: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 10,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    padding: "9px 20px",
    background: "var(--burgundy)",
    border: "none",
    color: "var(--cream)",
    cursor: "pointer",
  },
  hamburger: {
    background: "none",
    border: "1px solid rgba(255,255,255,0.15)",
    padding: "7px",
    color: "rgba(245,240,232,0.6)",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  mobileMenu: {
    borderTop: "1px solid rgba(255,255,255,0.08)",
    padding: "8px 12px 14px",
    display: "flex",
    flexDirection: "column",
    gap: 2,
    background: "var(--ink)",
  },
  mobileLink: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "11px 12px",
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 10,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    color: "rgba(245,240,232,0.7)",
  },
  mobileLinkActive: {
    color: "var(--gold)",
  },
};
