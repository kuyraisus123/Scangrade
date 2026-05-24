import { useState, useEffect, useRef } from "react";
import { Plus, Trash2, Upload, Users, Pencil, X, CheckCircle2, AlertCircle } from "lucide-react";
import { getSubjects, getStudents, createStudent, updateStudent, deleteStudent, importStudents } from "../../lib/api";

const inputCls = "w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 bg-slate-50 text-slate-800 transition placeholder:text-slate-400";

// ── parse CSV ─────────────────────────────────────────────────────────────────
function parseCSV(text) {
  const lines = text.trim().split("\n").filter(Boolean);
  const results = [];
  for (const line of lines) {
    const [studentId, ...nameParts] = line.split(",").map(s => s.trim().replace(/^"|"$/g, ""));
    const name = nameParts.join(" ").trim();
    if (studentId && name) results.push({ studentId, name });
  }
  return results;
}

export default function Students() {
  const [subjects,       setSubjects]       = useState([]);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [students,       setStudents]       = useState([]);
  const [loading,        setLoading]        = useState(false);
  const [search,         setSearch]         = useState("");
  const [showAdd,        setShowAdd]        = useState(false);
  const [editTarget,     setEditTarget]     = useState(null);
  const [delTarget,      setDelTarget]      = useState(null);
  const [importResult,   setImportResult]   = useState(null);
  const [form,           setForm]           = useState({ studentId: "", name: "" });
  const fileRef = useRef(null);

  useEffect(() => {
    getSubjects().then(s => {
      setSubjects(s);
      if (s.length > 0) setSelectedSubject(s[0]);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedSubject) return;
    setLoading(true);
    getStudents(selectedSubject.id)
      .then(setStudents)
      .catch(() => setStudents([]))
      .finally(() => setLoading(false));
  }, [selectedSubject]);

  const filtered = students.filter(s =>
    !search ||
    s.studentId.includes(search) ||
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleAdd = async () => {
    if (!form.studentId || !form.name || !selectedSubject) return;
    try {
      const s = await createStudent({ ...form, subjectId: selectedSubject.id });
      setStudents(p => [...p, s]);
      setShowAdd(false);
      setForm({ studentId: "", name: "" });
    } catch (err) {
      alert("เพิ่มไม่สำเร็จ: " + err.message);
    }
  };

  const handleEdit = async () => {
    if (!editTarget || !form.studentId || !form.name) return;
    try {
      const s = await updateStudent(editTarget.id, { studentId: form.studentId, name: form.name });
      setStudents(p => p.map(x => x.id === editTarget.id ? s : x));
      setEditTarget(null);
    } catch (err) {
      alert("แก้ไขไม่สำเร็จ: " + err.message);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteStudent(delTarget.id);
      setStudents(p => p.filter(x => x.id !== delTarget.id));
      setDelTarget(null);
    } catch {
      alert("ลบไม่สำเร็จ");
    }
  };

  // ── Import CSV ──────────────────────────────────────────────────────────────
  const handleFileImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !selectedSubject) return;
    const text = await file.text();
    const rows = parseCSV(text);
    if (rows.length === 0) { alert("ไม่พบข้อมูลใน CSV"); return; }
    try {
      const result = await importStudents(selectedSubject.id, rows);
      setImportResult(result);
      // รีโหลดรายชื่อ
      const updated = await getStudents(selectedSubject.id);
      setStudents(updated);
    } catch (err) {
      alert("นำเข้าไม่สำเร็จ: " + err.message);
    }
    e.target.value = "";
  };

  const openEdit = (s) => {
    setEditTarget(s);
    setForm({ studentId: s.studentId, name: s.name });
  };

  return (
    <div className="min-h-screen px-4 sm:px-8 lg:px-20 py-6">

      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Users size={20} className="text-indigo-500" />
          <h1 className="text-base font-semibold text-slate-800">จัดการนักศึกษา</h1>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => fileRef.current?.click()}
            className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-xl border border-indigo-200 text-indigo-600 hover:bg-indigo-50 transition-colors">
            <Upload size={14} /> นำเข้า CSV
          </button>
          <button onClick={() => { setShowAdd(true); setForm({ studentId: "", name: "" }); }}
            disabled={!selectedSubject}
            className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-xl text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}>
            <Plus size={14} /> เพิ่มนักศึกษา
          </button>
          <input type="file" accept=".csv,.txt" ref={fileRef} onChange={handleFileImport} className="hidden" />
        </div>
      </div>

      {/* Import result banner */}
      {importResult && (
        <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-3 mb-4">
          <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
          <p className="text-sm text-emerald-700">
            นำเข้าสำเร็จ {importResult.succeeded} คน
            {importResult.failed > 0 && ` · ข้ามซ้ำ ${importResult.failed} คน`}
          </p>
          <button onClick={() => setImportResult(null)} className="ml-auto text-emerald-400 hover:text-emerald-600">
            <X size={14} />
          </button>
        </div>
      )}

      {/* CSV format hint */}
      <div className="flex items-start gap-2 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 mb-5 text-xs text-slate-500">
        <AlertCircle size={14} className="shrink-0 mt-0.5 text-slate-400" />
        <span>รูปแบบ CSV: <code className="bg-white px-1.5 py-0.5 rounded border border-slate-200">รหัสนักศึกษา,ชื่อ-นามสกุล</code> (ไม่ต้องมีหัวตาราง) เช่น <code className="bg-white px-1.5 py-0.5 rounded border border-slate-200">6500000,สมชาย ใจดี</code></span>
      </div>

      <div className="flex flex-col lg:flex-row gap-5">

        {/* Subject selector */}
        <div className="w-full lg:w-64 shrink-0">
          <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden"
            style={{ boxShadow: "0 2px 12px rgba(99,102,241,0.06)" }}>
            <div className="h-1 w-full" style={{ background: "linear-gradient(90deg,#6366f1,#8b5cf6)" }} />
            <div className="p-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">รายวิชา</p>
              <div className="flex flex-col gap-1">
                {subjects.map(s => (
                  <button key={s.id}
                    onClick={() => setSelectedSubject(s)}
                    className="text-left px-3 py-2.5 rounded-xl text-sm transition-all"
                    style={{
                      background: selectedSubject?.id === s.id ? "#eef2ff" : "transparent",
                      color:      selectedSubject?.id === s.id ? "#4f46e5" : "#374151",
                      fontWeight: selectedSubject?.id === s.id ? 600 : 400,
                    }}>
                    <div className="font-medium truncate">{s.name}</div>
                    <div className="text-xs text-slate-400 font-mono">{s.code}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Student table */}
        <div className="flex-1 min-w-0">
          <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden"
            style={{ boxShadow: "0 2px 12px rgba(99,102,241,0.06)" }}>
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-3">
              <p className="text-sm font-semibold text-slate-800">
                {selectedSubject ? `${selectedSubject.name}` : "เลือกวิชาด้านซ้าย"}
                {students.length > 0 && (
                  <span className="ml-2 text-xs font-normal text-slate-400">{students.length} คน</span>
                )}
              </p>
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="ค้นหารหัส หรือชื่อ..."
                className="border border-slate-200 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 bg-slate-50 w-52" />
            </div>

            {loading ? (
              <div className="py-16 text-center text-sm text-slate-400">กำลังโหลด...</div>
            ) : filtered.length === 0 ? (
              <div className="py-16 text-center">
                <Users size={32} className="mx-auto text-slate-200 mb-3" />
                <p className="text-sm text-slate-400">
                  {selectedSubject ? "ยังไม่มีนักศึกษา — กด \"เพิ่มนักศึกษา\" หรือ \"นำเข้า CSV\"" : "เลือกวิชาด้านซ้ายก่อน"}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="text-left text-xs font-semibold text-slate-400 px-5 py-3 w-8">#</th>
                      <th className="text-left text-xs font-semibold text-slate-400 py-3 pr-3">รหัสนักศึกษา</th>
                      <th className="text-left text-xs font-semibold text-slate-400 py-3 pr-3">ชื่อ-นามสกุล</th>
                      <th className="text-left text-xs font-semibold text-slate-400 py-3 pr-3">คะแนนล่าสุด</th>
                      <th className="py-3 pr-5 w-20" />
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((s, i) => {
                      const latestSheet = s.sheets?.sort((a, b) =>
                        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                      )[0];
                      return (
                        <tr key={s.id} className="border-b border-slate-50 hover:bg-indigo-50/20 transition-colors">
                          <td className="py-3 px-5 text-xs text-slate-300 font-mono">{i + 1}</td>
                          <td className="py-3 pr-3 font-mono text-sm text-slate-700">{s.studentId}</td>
                          <td className="py-3 pr-3 font-medium text-slate-800">{s.name}</td>
                          <td className="py-3 pr-3">
                            {latestSheet
                              ? <span className="text-xs text-slate-600">{latestSheet.score} คะแนน</span>
                              : <span className="text-xs text-slate-300">ยังไม่มีข้อมูล</span>}
                          </td>
                          <td className="py-3 pr-5">
                            <div className="flex items-center gap-2 justify-end">
                              <button onClick={() => openEdit(s)}
                                className="text-slate-300 hover:text-indigo-500 transition-colors">
                                <Pencil size={13} />
                              </button>
                              <button onClick={() => setDelTarget(s)}
                                className="text-slate-300 hover:text-red-400 transition-colors">
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Modal */}
      {showAdd && (
        <Modal title="เพิ่มนักศึกษา" onClose={() => setShowAdd(false)}>
          <div className="space-y-3.5">
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1.5">รหัสนักศึกษา</label>
              <input value={form.studentId} onChange={e => setForm(p => ({ ...p, studentId: e.target.value }))}
                placeholder="เช่น 6401234567" className={inputCls} />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1.5">ชื่อ-นามสกุล</label>
              <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                placeholder="เช่น สมชาย ใจดี" className={inputCls} />
            </div>
            <div className="flex gap-3 pt-1">
              <button onClick={() => setShowAdd(false)}
                className="flex-1 py-2.5 rounded-2xl border border-slate-200 text-sm font-medium text-slate-500 hover:bg-slate-50 transition-colors">
                ยกเลิก
              </button>
              <button onClick={handleAdd} disabled={!form.studentId || !form.name}
                className="flex-1 py-2.5 rounded-2xl text-sm font-semibold text-white disabled:opacity-40 transition-all"
                style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}>
                เพิ่ม
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Edit Modal */}
      {editTarget && (
        <Modal title="แก้ไขนักศึกษา" onClose={() => setEditTarget(null)}>
          <div className="space-y-3.5">
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1.5">รหัสนักศึกษา</label>
              <input value={form.studentId} onChange={e => setForm(p => ({ ...p, studentId: e.target.value }))}
                className={inputCls} />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1.5">ชื่อ-นามสกุล</label>
              <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                className={inputCls} />
            </div>
            <div className="flex gap-3 pt-1">
              <button onClick={() => setEditTarget(null)}
                className="flex-1 py-2.5 rounded-2xl border border-slate-200 text-sm font-medium text-slate-500 hover:bg-slate-50 transition-colors">
                ยกเลิก
              </button>
              <button onClick={handleEdit} disabled={!form.studentId || !form.name}
                className="flex-1 py-2.5 rounded-2xl text-sm font-semibold text-white disabled:opacity-40 transition-all"
                style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}>
                บันทึก
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Confirm */}
      {delTarget && (
        <Modal title="ลบนักศึกษา" onClose={() => setDelTarget(null)}>
          <p className="text-sm text-slate-500 mb-5 text-center">
            ต้องการลบ <span className="font-semibold text-slate-700">{delTarget.name}</span> ({delTarget.studentId}) ออกหรือไม่?
          </p>
          <div className="flex gap-3">
            <button onClick={() => setDelTarget(null)}
              className="flex-1 py-2.5 rounded-2xl border border-slate-200 text-sm font-medium text-slate-500 hover:bg-slate-50 transition-colors">
              ยกเลิก
            </button>
            <button onClick={handleDelete}
              className="flex-1 py-2.5 rounded-2xl text-sm font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors">
              ลบออก
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: "rgba(15,23,42,0.35)", backdropFilter: "blur(4px)" }}>
      <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl">
        <div className="h-1.5 w-full" style={{ background: "linear-gradient(90deg,#6366f1,#8b5cf6,#06b6d4)" }} />
        <div className="p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-semibold text-slate-800">{title}</h2>
            <button onClick={onClose}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:bg-slate-100 transition-colors">
              <X size={16} />
            </button>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}