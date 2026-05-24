import { MdOutlineDocumentScanner } from "react-icons/md"
import { useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import { login, saveToken } from "../../lib/api"

function Login() {
  const [email,    setEmail]    = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error,    setError]    = useState("")
  const [loading,  setLoading]  = useState(false)
  const navigate = useNavigate()

  const handleLogin = async (e) => {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      const res = await login({ email, password })
      if (res.error) {
        setError(res.error)
        return
      }
      saveToken(res.token)
      navigate("/dashboard")
    } catch (err) {
      setError("เกิดข้อผิดพลาด ลองใหม่อีกครั้ง")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left Panel */}
      <div className="hidden md:flex w-1/2 flex-col p-12"
        style={{ background: "linear-gradient(160deg, #1e1b4b 0%, #312e81 50%, #1e1b4b 100%)" }}>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center"
            style={{ background: "rgba(255,255,255,0.12)" }}>
            <MdOutlineDocumentScanner className="text-4xl text-indigo-300" />
          </div>
          <span className="text-white font-semibold text-3xl tracking-tight">ScanGrade</span>
        </div>
        <div className="mt-16">
          <p className="text-white font-semibold text-2xl leading-relaxed mb-3">
            Grade smarter,<br />not harder.
          </p>
          <p className="text-sm leading-relaxed text-indigo-300">
            Scan, grade, and analyze exam sheets<br />in minutes — not hours.
          </p>
        </div>
        <div className="flex flex-col gap-4 mt-auto">
          {[
            { icon: "📄", title: "Batch scanning", desc: "Grade multiple sheets at once" },
            { icon: "📊", title: "Error analytics", desc: "See which questions students miss most" },
            { icon: "📤", title: "Export to Excel", desc: "Download scores instantly" },
          ].map((f) => (
            <div key={f.title} className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-sm"
                style={{ background: "rgba(165,180,252,0.15)" }}>
                {f.icon}
              </div>
              <div>
                <p className="text-white font-medium text-sm">{f.title}</p>
                <p className="text-xs text-indigo-400">{f.desc}</p>
              </div>
            </div>
          ))}
          <p className="text-xs mt-4 text-indigo-600">© 2025 ScanGrade · For instructors only</p>
        </div>
      </div>

      {/* Right Panel */}
      <div className="w-full md:w-1/2 flex items-center justify-center bg-white px-8">
        <div className="w-full max-w-sm">
          <p className="text-xl font-semibold text-slate-800 mb-1">Welcome back</p>
          <p className="text-sm text-slate-400 mb-8">Sign in to your account to continue</p>

          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-2.5 rounded-xl">
                {error}
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-600">Email</label>
              <input type="email" value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@example.com"
                className="h-11 px-3 rounded-xl border border-slate-200 bg-slate-50 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition" />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-600">Password</label>
              <div className="relative">
                <input type={showPassword ? "text" : "password"} value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-11 px-3 pr-10 rounded-xl border border-slate-200 bg-slate-50 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition" />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                  {showPassword ? "🙈" : "👁️"}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading}
              className="h-11 rounded-xl text-white text-sm font-semibold disabled:opacity-60 transition-all mt-1 shadow-md"
              style={{ background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)" }}>
              {loading ? "กำลังเข้าสู่ระบบ..." : "Sign in"}
            </button>

            <p className="text-center text-sm text-slate-400">
              ยังไม่มีบัญชี?{" "}
              <Link to="/register" className="text-indigo-600 font-medium hover:underline">
                สร้างบัญชีใหม่
              </Link>
            </p>

            <div className="flex items-center gap-3 mt-1">
              <div className="flex-1 h-px bg-slate-100" />
              <span className="text-xs text-slate-300">secured access</span>
              <div className="flex-1 h-px bg-slate-100" />
            </div>
            <p className="text-center text-xs text-slate-300">🔒 For authorized instructors only</p>
          </form>
        </div>
      </div>
    </div>
  )
}

export default Login