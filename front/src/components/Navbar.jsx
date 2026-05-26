import { useState, useRef, useEffect } from "react";
import { MdOutlineDocumentScanner } from "react-icons/md";
import { IoIosArrowDown } from "react-icons/io";
import { HiMenuAlt3, HiX } from "react-icons/hi";
import { User, LogOut } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { clearToken } from "../lib/api";

const examDropdownItems = [
  { label: "สร้างเฉลยข้อสอบ", path: "/exam" },
  { label: "สแกนข้อสอบ",        path: "/scan" },
];

// ── ดึง user จาก JWT token ใน localStorage ──────────────────────────────────
function getUserFromToken() {
  try {
    const token = localStorage.getItem("token");
    if (!token) return null;
    const base64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(decodeURIComponent(
      atob(base64).split("").map(c =>
        "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2)
      ).join("")
    ));
    return payload;
  } catch {
    return null;
  }
}

function Navbar({ navItems }) {
  const navigate  = useNavigate();
  const location  = useLocation();

  const [menuOpen,       setMenuOpen]       = useState(false);
  const [examDropOpen,   setExamDropOpen]   = useState(false);
  const [profileOpen,    setProfileOpen]    = useState(false);
  const [showLogout,     setShowLogout]     = useState(false);
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [addForm,        setAddForm]        = useState({ email:"", password:"" });
  const [showAddPw,      setShowAddPw]      = useState(false);
  const [user,           setUser]           = useState(null);

  const examRef    = useRef(null);
  const profileRef = useRef(null);

  // โหลด user จาก token
  useEffect(() => {
    const u = getUserFromToken();
    if (u) {
      setUser(u);
    } else {
      // token ไม่มีหรือหมดอายุ redirect ไป login
      navigate("/login");
    }
  }, [navigate]);

  const handleNav = (path) => {
    navigate(path);
    setMenuOpen(false);
    setExamDropOpen(false);
    setProfileOpen(false);
  };

  const handleLogout = () => {
    clearToken();
    navigate("/login");
  };

  useEffect(() => {
    const h = (e) => {
      if (examRef.current    && !examRef.current.contains(e.target))    setExamDropOpen(false);
      if (profileRef.current && !profileRef.current.contains(e.target)) setProfileOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const isExamActive = location.pathname.startsWith("/exam") || location.pathname === "/scan";
  const displayName  = user ? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() : "...";
  const displayEmail = user?.email ?? "";

  return (
    <>
      <div className="sticky top-0 z-50 px-4 sm:px-8 lg:px-37 py-3">
        <div
          className="w-full bg-white/70 backdrop-blur-md flex items-center justify-between px-4 sm:px-6 h-16 rounded-2xl"
          style={{ border: "1px solid rgba(99,102,241,0.12)", boxShadow: "0 4px 24px rgba(99,102,241,0.10)" }}
        >
          {/* Logo + Desktop nav */}
          <div className="flex items-center gap-4 sm:gap-6">
            <div className="flex items-center gap-2 cursor-pointer shrink-0" onClick={() => handleNav("/dashboard")}>
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center"
                style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}>
                <MdOutlineDocumentScanner className="text-xl sm:text-2xl text-white" />
              </div>
              <span className="text-base sm:text-lg font-semibold text-slate-800">ScanGrade</span>
            </div>

            <div className="hidden md:flex items-center gap-1">
              <div className="w-px h-5 bg-slate-200 mr-2" />
              {navItems.map(item => {
                if (item.label === "Exams") return (
                  <div key="exams" className="relative" ref={examRef}>
                    <button
                      onClick={() => setExamDropOpen(v => !v)}
                      className="flex items-center gap-1 text-sm px-3 py-1.5 rounded-lg transition-all"
                      style={{ color: isExamActive ? "#4f46e5" : "#64748b", background: isExamActive ? "#eef2ff" : "transparent", fontWeight: isExamActive ? 600 : 400 }}
                    >
                      {item.label}
                      <IoIosArrowDown className="text-xs transition-transform duration-200"
                        style={{ transform: examDropOpen ? "rotate(180deg)" : "rotate(0deg)" }} />
                    </button>
                    {examDropOpen && (
                      <div className="absolute top-full left-0 mt-2 w-52 bg-white rounded-xl overflow-hidden"
                        style={{ border: "1px solid rgba(99,102,241,0.12)", boxShadow: "0 8px 24px rgba(99,102,241,0.12)" }}>
                        {examDropdownItems.map(d => (
                          <button key={d.path} onClick={() => handleNav(d.path)}
                            className="w-full text-left text-sm px-4 py-2.5 transition-colors hover:bg-indigo-50"
                            style={{ color: location.pathname === d.path ? "#4f46e5" : "#374151", fontWeight: location.pathname === d.path ? 600 : 400 }}>
                            {d.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
                const active = location.pathname.startsWith(item.path);
                return (
                  <span key={item.path} onClick={() => handleNav(item.path)}
                    className="text-sm px-3 py-1.5 rounded-lg cursor-pointer transition-all"
                    style={{ color: active ? "#4f46e5" : "#64748b", background: active ? "#eef2ff" : "transparent", fontWeight: active ? 600 : 400 }}>
                    {item.label}
                  </span>
                );
              })}
            </div>
          </div>

          {/* Right: profile */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:block relative" ref={profileRef}>
              <button
                onClick={() => setProfileOpen(v => !v)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all"
                style={{
                  border:     profileOpen ? "1px solid #a5b4fc" : "1px solid #e2e8f0",
                  background: profileOpen ? "#eef2ff" : "#f8fafc",
                }}
              >
                <span className="text-sm whitespace-nowrap"
                  style={{ color: profileOpen ? "#4f46e5" : "#374151", fontWeight: profileOpen ? 600 : 400 }}>
                  {displayName}
                </span>
                <IoIosArrowDown className="text-xs text-slate-400 transition-transform duration-200"
                  style={{ transform: profileOpen ? "rotate(180deg)" : "rotate(0deg)" }} />
              </button>

              {profileOpen && (
                <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl overflow-hidden z-50"
                  style={{ border: "1px solid rgba(99,102,241,0.12)", boxShadow: "0 12px 36px rgba(99,102,241,0.16)" }}>
                  <div className="px-4 py-4 border-b border-slate-100">
                    <p className="text-sm font-semibold text-slate-800">{displayName}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{displayEmail}</p>
                  </div>
                  <div className="px-4 pt-3 pb-1">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">บัญชี</p>
                  </div>
                  <div className="pb-1.5">
                    <button
                      onClick={() => { setProfileOpen(false); setShowAddAccount(true); setAddForm({ email:"", password:"" }); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors text-left"
                    >
                      <User size={14} className="text-slate-400 shrink-0" />
                      เพิ่มบัญชี
                    </button>
                  </div>
                  <div className="mx-3 border-t border-slate-100" />
                  <div className="py-1.5">
                    <button
                      onClick={() => { setProfileOpen(false); setShowLogout(true); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors text-left"
                    >
                      <LogOut size={14} className="text-red-400 shrink-0" />
                      ออกจากระบบ
                    </button>
                  </div>
                </div>
              )}
            </div>

            <button className="md:hidden p-2 rounded-lg text-indigo-600" onClick={() => setMenuOpen(v => !v)}>
              {menuOpen ? <HiX className="text-xl" /> : <HiMenuAlt3 className="text-xl" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden mt-2 bg-white rounded-2xl overflow-hidden"
            style={{ border: "1px solid rgba(99,102,241,0.12)", boxShadow: "0 8px 24px rgba(99,102,241,0.10)" }}>
            <div className="px-3 pt-3 pb-2 flex flex-col gap-1">
              {navItems.map(item => {
                if (item.label === "Exams") return (
                  <div key="exams-m">
                    <p className="text-xs font-semibold text-slate-400 px-4 pt-2 pb-1 uppercase tracking-wider">Exams</p>
                    {examDropdownItems.map(d => (
                      <span key={d.path} onClick={() => handleNav(d.path)}
                        className="block text-sm px-6 py-2 rounded-xl cursor-pointer transition-colors"
                        style={{ color: location.pathname === d.path ? "#4f46e5" : "#374151", background: location.pathname === d.path ? "#eef2ff" : "transparent", fontWeight: location.pathname === d.path ? 600 : 400 }}>
                        {d.label}
                      </span>
                    ))}
                  </div>
                );
                const active = location.pathname.startsWith(item.path);
                return (
                  <span key={item.path} onClick={() => handleNav(item.path)}
                    className="text-sm px-4 py-2.5 rounded-xl cursor-pointer transition-colors"
                    style={{ color: active ? "#4f46e5" : "#374151", background: active ? "#eef2ff" : "transparent", fontWeight: active ? 600 : 400 }}>
                    {item.label}
                  </span>
                );
              })}
            </div>
            <div className="mx-4 border-t border-slate-100" />
            <div className="px-4 py-3">
              <p className="text-xs text-slate-400 px-1 mb-2">{displayName}</p>
              <button onClick={() => { setMenuOpen(false); setShowLogout(true); }}
                className="flex items-center gap-2.5 px-1 py-2 text-sm text-red-500 hover:text-red-600 transition-colors">
                <LogOut size={15} /> ออกจากระบบ
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add Account modal */}
      {showAddAccount && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4"
          style={{ background: "rgba(15,23,42,0.4)", backdropFilter: "blur(4px)" }}>
          <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl">
            <div className="h-1.5 w-full" style={{ background: "linear-gradient(90deg,#6366f1,#8b5cf6,#06b6d4)" }}/>
            <div className="p-6">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-base font-semibold text-slate-800">เพิ่มบัญชี</h3>
                <button onClick={() => setShowAddAccount(false)}
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:bg-slate-100 transition-colors">
                  <HiX className="text-base" />
                </button>
              </div>
              <div className="flex flex-col gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1.5">อีเมล</label>
                  <input type="email" value={addForm.email}
                    onChange={e => setAddForm(p => ({ ...p, email: e.target.value }))}
                    placeholder="email@example.com"
                    className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 bg-slate-50 text-slate-800 transition placeholder:text-slate-400" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1.5">รหัสผ่าน</label>
                  <div className="relative">
                    <input type={showAddPw ? "text" : "password"} value={addForm.password}
                      onChange={e => setAddForm(p => ({ ...p, password: e.target.value }))}
                      placeholder="••••••••"
                      className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 bg-slate-50 text-slate-800 transition placeholder:text-slate-400" />
                    <button type="button" onClick={() => setShowAddPw(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors text-xs">
                      {showAddPw ? "🙈" : "👁️"}
                    </button>
                  </div>
                </div>
                <div className="flex gap-3 mt-1">
                  <button onClick={() => setShowAddAccount(false)}
                    className="flex-1 py-2.5 rounded-2xl border border-slate-200 text-sm font-medium text-slate-500 hover:bg-slate-50 transition-colors">
                    ยกเลิก
                  </button>
                  <button
                    disabled={!addForm.email || !addForm.password}
                    onClick={() => setShowAddAccount(false)}
                    className="flex-1 py-2.5 rounded-2xl text-sm font-semibold text-white disabled:opacity-40 transition-all"
                    style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}>
                    เข้าสู่ระบบ
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Logout dialog */}
      {showLogout && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4"
          style={{ background: "rgba(15,23,42,0.4)", backdropFilter: "blur(4px)" }}>
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
              <LogOut size={20} className="text-red-500" />
            </div>
            <h3 className="text-base font-semibold text-slate-800 text-center mb-1">ออกจากระบบ</h3>
            <p className="text-sm text-slate-400 text-center mb-6">ต้องการออกจากระบบใช่ไหม?</p>
            <div className="flex gap-3">
              <button onClick={() => setShowLogout(false)}
                className="flex-1 py-2.5 rounded-2xl border border-slate-200 text-sm font-medium text-slate-500 hover:bg-slate-50 transition-colors">
                ยกเลิก
              </button>
              <button onClick={handleLogout}
                className="flex-1 py-2.5 rounded-2xl text-sm font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors">
                ออกจากระบบ
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default Navbar;