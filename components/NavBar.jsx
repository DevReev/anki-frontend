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
          <Link href="/" style={S.logo} className="af-logo">
            <div style={S.logoIcon}>
              <BookOpen size={16} style={{ color: "var(--accent)" }} />
            </div>
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
                    className={active ? "" : "af-link"}
                  >
                    {label}
                    {active && <span style={S.linkDot} />}
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
                  <div style={S.dropdown} className="af-dropdown">
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
                className="af-btn-glow"
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
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
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
                  <span style={{ opacity: 0.6 }}>{icon}</span>
                  {label}
                </Link>
              );
            })}
            <div style={S.dropDivider} />
            <button
              onClick={handleLogout}
              style={{
                ...S.mobileLink,
                color: "var(--red)",
                background: "none",
                border: "none",
                width: "100%",
                textAlign: "left",
                cursor: "pointer",
              }}
            >
              <LogOut size={14} style={{ opacity: 0.7 }} />
              Sign Out
            </button>
          </div>
        )}
      </nav>
    </>
  );
}

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500&display=swap');
  :root {
    --bg: #0d1117;
    --surface: rgba(255,255,255,0.04);
    --border: rgba(255,255,255,0.08);
    --border-strong: rgba(255,255,255,0.14);
    --text: #e8eaf0;
    --muted: #6b7280;
    --accent: #4f8ef7;
    --accent-glow: rgba(79,142,247,0.35);
    --red: #f87171;
  }

  .af-logo { transition: opacity 0.2s; text-decoration: none; }
  .af-logo:hover { opacity: 0.8; }

  .af-link { transition: color 0.2s; text-decoration: none; }
  .af-link:hover { color: var(--text) !important; }

  .af-avatar { transition: transform 0.15s, box-shadow 0.15s; }
  .af-avatar:hover { transform: scale(1.05); box-shadow: 0 0 0 3px rgba(79,142,247,0.3); border-radius: 50%; }

  .af-dropdown { animation: dropIn 0.15s ease; }
  @keyframes dropIn { from { opacity:0; transform: translateY(-6px); } to { opacity:1; transform: translateY(0); } }

  .af-drop-item { transition: background 0.15s; text-decoration: none; }
  .af-drop-item:hover { background: rgba(255,255,255,0.06) !important; }

  .af-btn-glow { transition: all 0.2s ease; }
  .af-btn-glow:hover { box-shadow: 0 0 18px var(--accent-glow); transform: translateY(-1px); }

  .af-hamburger { display: none; }
  @media (max-width: 768px) {
    .af-hamburger { display: flex !important; }
  }

  .af-mobile-menu { animation: slideDown 0.2s ease; }
  @keyframes slideDown { from { opacity:0; transform:translateY(-8px); } to { opacity:1; transform:translateY(0); } }

  .af-mobile-link { transition: background 0.15s, color 0.15s; text-decoration: none; }
  .af-mobile-link:hover { background: rgba(255,255,255,0.05) !important; }
`;

const S = {
  nav: {
    position: "sticky",
    top: 0,
    zIndex: 50,
    background: "rgba(13,17,23,0.85)",
    backdropFilter: "blur(16px)",
    borderBottom: "1px solid var(--border)",
    fontFamily: "'DM Sans', sans-serif",
  },
  inner: {
    maxWidth: 1100,
    margin: "0 auto",
    padding: "0 20px",
    height: 60,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 24,
  },

  logo: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    textDecoration: "none",
    flexShrink: 0,
  },
  logoIcon: {
    width: 32,
    height: 32,
    borderRadius: 9,
    background: "rgba(79,142,247,0.12)",
    border: "1px solid rgba(79,142,247,0.25)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  logoText: {
    fontFamily: "'Syne', sans-serif",
    fontSize: 17,
    fontWeight: 800,
    color: "var(--text)",
    letterSpacing: "-0.03em",
  },

  links: { display: "flex", alignItems: "center", gap: 4 },
  link: {
    position: "relative",
    display: "flex",
    alignItems: "center",
    flexDirection: "column",
    padding: "6px 14px",
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 500,
    color: "var(--muted)",
    textDecoration: "none",
    gap: 3,
  },
  linkActive: { color: "var(--text)", background: "rgba(255,255,255,0.05)" },
  linkDot: {
    display: "block",
    width: 4,
    height: 4,
    borderRadius: "50%",
    background: "var(--accent)",
    position: "absolute",
    bottom: 4,
  },

  right: { display: "flex", alignItems: "center", gap: 10, flexShrink: 0 },

  avatarSkeleton: {
    width: 36,
    height: 36,
    borderRadius: "50%",
    background: "var(--surface)",
    border: "1px solid var(--border)",
  },

  avatarBtn: {
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: 0,
    borderRadius: "50%",
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: "50%",
    background: "linear-gradient(135deg, #4f8ef7, #7b5ea7)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#fff",
    fontSize: 14,
    fontWeight: 700,
    fontFamily: "'Syne', sans-serif",
  },

  dropdown: {
    position: "absolute",
    right: 0,
    top: "calc(100% + 10px)",
    background: "#161b24",
    border: "1px solid var(--border-strong)",
    borderRadius: 14,
    padding: "6px",
    minWidth: 200,
    zIndex: 100,
    boxShadow: "0 16px 48px rgba(0,0,0,0.5)",
  },
  dropEmail: {
    fontSize: 12,
    color: "var(--muted)",
    padding: "8px 12px 6px",
    wordBreak: "break-all",
  },
  dropDivider: { height: 1, background: "var(--border)", margin: "4px 0" },
  dropItem: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "9px 12px",
    borderRadius: 9,
    fontSize: 13,
    fontWeight: 500,
    color: "var(--text)",
    cursor: "pointer",
    background: "transparent",
    border: "none",
    width: "100%",
    fontFamily: "'DM Sans', sans-serif",
  },
  dropLogout: { color: "var(--red)" },
  dropIcon: { opacity: 0.6, display: "flex", alignItems: "center" },

  signInBtn: {
    padding: "8px 18px",
    borderRadius: 10,
    background: "var(--accent)",
    border: "none",
    color: "#fff",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "'Syne', sans-serif",
  },

  hamburger: {
    background: "none",
    border: "1px solid var(--border)",
    borderRadius: 9,
    padding: "7px",
    color: "var(--muted)",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },

  mobileMenu: {
    borderTop: "1px solid var(--border)",
    padding: "10px 12px 14px",
    display: "flex",
    flexDirection: "column",
    gap: 2,
  },
  mobileLink: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "11px 12px",
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 500,
    color: "var(--text)",
  },
  mobileLinkActive: {
    background: "rgba(255,255,255,0.05)",
    color: "var(--accent)",
  },
};
