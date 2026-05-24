import { useState, useRef, useEffect } from "react";
import { Plus, X, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { getSubjects, createSubject, updateSubject, deleteSubject, getTemplates } from "../../lib/api";

const EMPTY_FORM = { name: "", code: "", year: "", term: "1" };

const inputCls = "w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300 bg-slate-50 text-slate-800 transition placeholder:text-slate-400";

function SubjectModal({ initial, onSave, onClose }) {
  const [form, setForm] = useState(initial || EMPTY_FORM);
  const isEdit = !!initial;
  const handleChange = (e) => setForm(p => ({ ...p, [e.target.name]: e.target.value }));
  const valid = form.name.trim() && form.code.trim() && form.year;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: "rgba(15,23,42,0.35)", backdropFilter: "blur(4px)" }}>
      <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl"
        style={{ boxShadow: "0 24px 64px rgba(99,102,241,0.18)" }}>
        <div className="h-1.5 w-full"
          style={{ background: "linear-gradient(90deg,#6366f1,#8b5cf6,#06b6d4)" }} />
        <div className="p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-semibold text-slate-800">
              {isEdit ? "แก้ไขรายวิชา" : "เพิ่มรายวิชาใหม่"}
            </h2>
            <button onClick={onClose}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:bg-slate-100 transition-colors">
              <X size={16} />
            </button>
          </div>
          <div className="space-y-3.5">
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1.5">ชื่อวิชา</label>
              <input name="name" value={form.name} onChange={handleChange}
                placeholder="เช่น ภาษาไทยในชีวิตประจำวัน" className={inputCls} />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1.5">รหัสวิชา</label>
              <input name="code" value={form.code} onChange={handleChange}
                placeholder="เช่น 001101" className={inputCls} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1.5">ปีการศึกษา</label>
                <select name="year" value={form.year} onChange={handleChange} className={inputCls}>
                  <option value="" disabled>เลือกปี...</option>
                  {["2569","2568","2567","2566","2565"].map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1.5">เทอม</label>
                <select name="term" value={form.term} onChange={handleChange} className={inputCls}>
                  <option value="1">เทอม 1</option>
                  <option value="2">เทอม 2</option>
                  <option value="3">เทอม 3 (ฤดูร้อน)</option>
                </select>
              </div>
            </div>
          </div>
          <div className="flex gap-3 mt-6">
            <button onClick={onClose}
              className="flex-1 py-2.5 rounded-2xl border border-slate-200 text-sm font-medium text-slate-500 hover:bg-slate-50 transition-colors">
              ยกเลิก
            </button>
            <button disabled={!valid} onClick={() => valid && onSave(form)}
              className="flex-1 py-2.5 rounded-2xl text-sm font-semibold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}>
              {isEdit ? "บันทึกการแก้ไข" : "เพิ่มรายวิชา"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DeleteConfirm({ subject, onConfirm, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: "rgba(15,23,42,0.35)", backdropFilter: "blur(4px)" }}>
      <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl">
        <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
          <Trash2 size={20} className="text-red-500" />
        </div>
        <h3 className="text-base font-semibold text-slate-800 text-center mb-1">ลบรายวิชา</h3>
        <p className="text-sm text-slate-400 text-center mb-5">
          ต้องการลบ <span className="font-semibold text-slate-600">{subject.name}</span> ออกหรือไม่? ไม่สามารถกู้คืนได้
        </p>
        <div className="flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-2xl border border-slate-200 text-sm font-medium text-slate-500 hover:bg-slate-50 transition-colors">
            ยกเลิก
          </button>
          <button onClick={onConfirm}
            className="flex-1 py-2.5 rounded-2xl text-sm font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors">
            ลบออก
          </button>
        </div>
      </div>
    </div>
  );
}

function CardMenu({ onEdit, onDelete }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={e => { e.stopPropagation(); setOpen(v => !v); }}
        className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-300 hover:text-slate-500 hover:bg-slate-100 transition-colors"
      >
        <MoreHorizontal size={16} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-36 bg-white rounded-xl overflow-hidden z-30"
          style={{ border:"1px solid rgba(99,102,241,0.12)", boxShadow:"0 8px 24px rgba(99,102,241,0.14)" }}>
          <button
            onClick={e => { e.stopPropagation(); setOpen(false); onEdit(); }}
            className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors text-left"
          >
            <Pencil size={13} className="text-slate-400" /> แก้ไข
          </button>
          <div className="mx-3 border-t border-slate-100" />
          <button
            onClick={e => { e.stopPropagation(); setOpen(false); onDelete(); }}
            className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors text-left"
          >
            <Trash2 size={13} className="text-red-400" /> ลบ
          </button>
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const [subjects,    setSubjects]    = useState([]);
  const [templates,   setTemplates]   = useState([]);
  const [totalSheets, setTotalSheets] = useState(0);
  const [loading,     setLoading]     = useState(true);
  const [filterYear,  setFilterYear]  = useState("");
  const [filterTerm,  setFilterTerm]  = useState("");
  const [search,      setSearch]      = useState("");
  const [showAdd,     setShowAdd]     = useState(false);
  const [editTarget,  setEditTarget]  = useState(null);
  const [delTarget,   setDelTarget]   = useState(null);

  useEffect(() => {
    Promise.all([getSubjects(), getTemplates()])
      .then(([subs, tmps]) => {
        setSubjects(subs);
        setTemplates(tmps);
        // นับกระดาษทั้งหมดจากทุก template → set → session → sheet
        const sheets = tmps.reduce((acc, t) =>
          acc + (t.sets || []).reduce((a, s) =>
            a + (s.scanSessions || []).reduce((b, sess) =>
              b + (sess.sheets?.length || 0), 0), 0), 0);
        setTotalSheets(sheets);
      })
      .catch(() => { setSubjects([]); setTemplates([]); })
      .finally(() => setLoading(false));
  }, []);

  const filtered = subjects.filter(s =>
    (!filterYear || s.year === filterYear) &&
    (!filterTerm || s.term === filterTerm) &&
    (!search || s.name.toLowerCase().includes(search.toLowerCase()) || s.code.toLowerCase().includes(search.toLowerCase()))
  );

  const handleAdd = async (form) => {
    try {
      const newSubject = await createSubject(form)
      setSubjects(p => [...p, newSubject])
      setShowAdd(false)
    } catch (err) {
      alert('เพิ่มไม่สำเร็จ')
    }
  }

  const handleEdit = async (form) => {
    try {
      const updated = await updateSubject(editTarget.id, form)
      setSubjects(p => p.map(s => s.id === editTarget.id ? updated : s))
      setEditTarget(null)
    } catch (err) {
      alert('แก้ไขไม่สำเร็จ')
    }
  }

  const handleDelete = async () => {
    try {
      await deleteSubject(delTarget.id)
      setSubjects(p => p.filter(s => s.id !== delTarget.id))
      setDelTarget(null)
    } catch (err) {
      alert('ลบไม่สำเร็จ')
    }
  }

  const totalSets = templates.reduce((a, t) => a + (t.sets?.length || 0), 0);

  const stats = [
    { label: "รายวิชาทั้งหมด", value: String(subjects.length), sub: "วิชา" },
    { label: "ชุดข้อสอบ",       value: String(totalSets),       sub: "รวมทุกเทอม" },
    { label: "กระดาษตรวจแล้ว", value: String(totalSheets),     sub: "ใบ" },
  ];

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-slate-400 text-sm">กำลังโหลด...</p>
    </div>
  );

  return (
    <div className="min-h-screen p-6 font-sans">
      <div className="flex justify-center gap-5 mb-6 flex-wrap">
        {stats.map(s => (
          <div key={s.label} className="bg-white rounded-2xl border border-slate-100 p-4 w-52"
            style={{ boxShadow: "0 4px 20px rgba(99,102,241,0.08)" }}>
            <div className="text-xs text-slate-400 mb-2 text-center">{s.label}</div>
            <div className="text-3xl font-bold text-slate-800 text-center leading-none">{s.value}</div>
            <div className="text-xs text-slate-400 mt-1 text-center">{s.sub}</div>
          </div>
        ))}
      </div>

      <div className="px-4 sm:px-8 lg:px-20 flex items-center gap-3 mb-6 flex-wrap">
        <span className="text-sm text-slate-400">กรอง:</span>
        <select className="border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200 transition"
          value={filterYear} onChange={e => setFilterYear(e.target.value)}>
          <option value="">ทุกปีการศึกษา</option>
          {["2569","2568","2567","2566","2565"].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <select className="border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200 transition"
          value={filterTerm} onChange={e => setFilterTerm(e.target.value)}>
          <option value="">ทุกเทอม</option>
          <option value="1">เทอม 1</option>
          <option value="2">เทอม 2</option>
          <option value="3">เทอม 3 (ฤดูร้อน)</option>
        </select>
        <input
          className="min-w-44 border border-slate-200 rounded-xl px-4 py-2 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200 transition placeholder:text-slate-400"
          placeholder="ค้นหาวิชา หรือรหัสวิชา..."
          value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="px-4 sm:px-8 lg:px-20 flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-slate-800">รายวิชาทั้งหมด</h2>
        <span className="text-xs text-slate-400">แสดง {filtered.length} รายการ</span>
      </div>

      <div className="px-4 sm:px-8 lg:px-20 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(s => (
          <div key={s.id} className="bg-white rounded-2xl border border-slate-100"
            style={{ boxShadow: "0 2px 12px rgba(99,102,241,0.06)" }}>
            <div className="p-5">
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-800 leading-snug">{s.name}</div>
                  <div className="text-xs text-slate-400 font-mono mt-0.5">{s.code}</div>
                </div>
                <CardMenu onEdit={() => setEditTarget(s)} onDelete={() => setDelTarget(s)} />
              </div>
              <div className="flex gap-2">
                <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-indigo-50 text-indigo-600">
                  ปี {s.year}
                </span>
                <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-slate-100 text-slate-500">
                  เทอม {s.term}
                </span>
              </div>
            </div>
          </div>
        ))}

        <div onClick={() => setShowAdd(true)}
          className="bg-white rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all hover:border-indigo-300 hover:bg-indigo-50/30 min-h-[110px]">
          <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center">
            <Plus size={18} className="text-slate-400" />
          </div>
          <span className="text-sm font-medium text-slate-400">เพิ่มรายวิชาใหม่</span>
        </div>
      </div>

      {showAdd && <SubjectModal initial={null} onSave={handleAdd} onClose={() => setShowAdd(false)} />}
      {editTarget && (
        <SubjectModal
          initial={{ name: editTarget.name, code: editTarget.code, year: editTarget.year, term: editTarget.term }}
          onSave={handleEdit}
          onClose={() => setEditTarget(null)}
        />
      )}
      {delTarget && <DeleteConfirm subject={delTarget} onConfirm={handleDelete} onClose={() => setDelTarget(null)} />}
    </div>
  );
}