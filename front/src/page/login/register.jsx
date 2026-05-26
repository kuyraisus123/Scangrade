import { MdOutlineDocumentScanner } from "react-icons/md"
import { useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import { saveToken } from "../../lib/api"

const API = import.meta.env.VITE_API_URL || "http://localhost:3001"

function Register() {
  const [firstName, setFirstName] = useState("")
  const [lastName,  setLastName]  = useState("")
  const [email,     setEmail]     = useState("")
  const [password,  setPassword]  = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error,   setError]   = useState("")
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleRegister = async (e) => {
    e.preventDefault()
    setError("")
    if (password !== confirmPassword) {
      setError("รหัสผ่านไม่ตรงกัน")
      return
    }
    if (password.length < 6) {
      setError("รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร")
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`${API}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName, lastName, email, password }),
      }).then(r => r.json())
      if (res.error) {
        setError(res.error)
        return
      }
      saveToken(res.token)
      navigate("/dashboard")
    } catch {
      setError("เกิดข้อผิดพลาด ลองใหม่อีกครั้ง")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left Panel */}
      <div className="hidden md:flex w-1/2 flex-col p-12"
        style={{ background: "linear-gradient(90deg, #e4dbfe 0%, #ac88ff 40%, #fff)" }}>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center"
            style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}>
            <MdOutlineDocumentScanner className="text-4xl" style={{ color: "#ffffff" }} />
          </div>
          <span className="text-white font-semibold text-3xl tracking-tight">ScanGrade</span>
        </div>
        <div className="mt-16">
          <p className="text-white font-semibold text-2xl leading-relaxed mb-3">
            Grade smarter,<br />not harder.
          </p>
          <p style={{ color: "#4f46e5" }} className="text-sm leading-relaxed">
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
                style={{ background: "linear-gradient(135deg ,#6366f1 ,#8b5cf6 130%)" }}>
                {f.icon}
              </div>
              <div>
                <p className="text-white font-medium text-sm">{f.title}</p>
                <p style={{ color: "#4f46e5" }} className="text-xs">{f.desc}</p>
              </div>
            </div>
          ))}
          <p className="text-xs mt-4 text-indigo-600">© 2026 ScanGrade · For instructors only</p>
        </div>
      </div>

      {/* Right Panel */}
      <div className="w-full md:w-1/2 flex items-center justify-center bg-white px-8 py-10">
        <div className="w-full max-w-sm">
          <p className="text-xl font-semibold text-slate-800 mb-1">สร้างบัญชีใหม่</p>
          <p className="text-sm text-slate-400 mb-6">กรอกข้อมูลเพื่อลงทะเบียนใช้งาน ScanGrade</p>

          <form onSubmit={handleRegister} className="flex flex-col gap-4">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-2.5 rounded-xl">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <div className="flex flex-col gap-1.5 flex-1">
                <label className="text-sm font-medium text-slate-600">ชื่อ</label>
                <input type="text" value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  placeholder="ชื่อ" required
                  className="h-11 px-3 rounded-xl border border-slate-200 bg-slate-50 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition" />
              </div>
              <div className="flex flex-col gap-1.5 flex-1">
                <label className="text-sm font-medium text-slate-600">นามสกุล</label>
                <input type="text" value={lastName}
                  onChange={e => setLastName(e.target.value)}
                  placeholder="นามสกุล" required
                  className="h-11 px-3 rounded-xl border border-slate-200 bg-slate-50 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition" />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-600">Email</label>
              <input type="email" value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="email@example.com" required
                className="h-11 px-3 rounded-xl border border-slate-200 bg-slate-50 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition" />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-600">รหัสผ่าน</label>
              <div className="relative">
                <input type={showPassword ? "text" : "password"} value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="อย่างน้อย 6 ตัวอักษร" required
                  className="w-full h-11 px-3 pr-10 rounded-xl border border-slate-200 bg-slate-50 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition" />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                  {showPassword ? "🙈" : "👁️"}
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-600">ยืนยันรหัสผ่าน</label>
              <input type={showPassword ? "text" : "password"} value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="••••••••" required
                className="h-11 px-3 rounded-xl border border-slate-200 bg-slate-50 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition" />
            </div>

            <button type="submit" disabled={loading}
              className="h-11 rounded-xl text-white text-sm font-semibold disabled:opacity-60 transition-all mt-1 shadow-md"
              style={{ background: "linear-gradient(135deg, #4f46e5 0%, #a24cd1 100%)" }}>
              {loading ? "กำลังสร้างบัญชี..." : "สร้างบัญชี"}
            </button>

            <p className="text-center text-sm text-slate-400">
              มีบัญชีอยู่แล้ว?{" "}
              <Link to="/login" className="text-indigo-600 font-medium hover:underline">
                เข้าสู่ระบบ
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  )
}

export default Register