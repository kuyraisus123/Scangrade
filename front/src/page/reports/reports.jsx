import { BookOpen } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { getSubjects, getTemplates } from "../../lib/api";

const statusStyle = {
  ดี:            { pill: "bg-emerald-50 text-emerald-700 border border-emerald-200", bar: "bg-emerald-500" },
  ปานกลาง:      { pill: "bg-amber-50 text-amber-700 border border-amber-200",        bar: "bg-amber-400"   },
  ต้องปรับปรุง: { pill: "bg-red-50 text-red-600 border border-red-200",              bar: "bg-red-400"     },
};

function getStatus(score) {
  if (score >= 75) return "ดี";
  if (score >= 55) return "ปานกลาง";
  return "ต้องปรับปรุง";
}

export default function Reports() {
  const navigate = useNavigate();
  const [subjects,   setSubjects]   = useState([]);
  const [templates,  setTemplates]  = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [filterYear, setFilterYear] = useState("");
  const [filterTerm, setFilterTerm] = useState("");

  useEffect(() => {
    Promise.all([getSubjects(), getTemplates()])
      .then(([subs, tmps]) => {
        setSubjects(subs);
        setTemplates(tmps);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const subjectData = subjects.map(sub => {
    const subTemplates = templates.filter(t => t.subjectId === sub.id);
    if (subTemplates.length === 0) return null;
    const allSheets    = subTemplates.flatMap(t =>
      t.sets?.flatMap(s => s.scanSessions?.flatMap(ss => ss.sheets || []) || []) || []
    );
    const totalSheets  = allSheets.length;
    const avgScore     = totalSheets > 0
      ? Math.round(allSheets.reduce((a, s) => a + (s.score || 0), 0) / totalSheets)
      : 0;
    const totalScore   = subTemplates[0]?.totalScore || 100;
    const scorePct     = totalScore > 0 ? Math.round((avgScore / totalScore) * 100) : 0;
    const passThreshold = totalScore * 0.6;
    const passCount    = allSheets.filter(s => (s.score || 0) >= passThreshold).length;
    const passRate     = totalSheets > 0 ? Math.round((passCount / totalSheets) * 100) : 0;
    const status       = getStatus(scorePct);
    const year         = subTemplates[0]?.year || sub.year || "";
    const term         = [...new Set(subTemplates.map(t => t.semester).filter(Boolean))].join(", ") || "";

    return {
      id:        sub.id,
      name:      sub.name,
      code:      sub.code,
      year,
      term,
      exams:     subTemplates.length,
      students:  totalSheets,
      score:     scorePct,
      passRate,
      passed:    passCount,
      status,
    };
  }).filter(Boolean);

  // unique years จาก templates
  const allYears = [...new Set(templates.map(t => t.year).filter(Boolean))].sort((a, b) => b - a);
  // unique semesters จาก templates
  const allTerms = [...new Set(templates.map(t => t.semester).filter(Boolean))];

  const filtered = subjectData.filter(s =>
    (!filterYear || s.year === filterYear) &&
    (!filterTerm || s.term.includes(filterTerm))
  );

  const handleCardClick = (s) => {
    navigate(`/reports/${encodeURIComponent(s.name)}`, { state: s });
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-slate-400 text-sm">กำลังโหลด...</p>
    </div>
  );

  return (
    <div className="min-h-screen px-4 sm:px-8 lg:px-20 py-6">
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <span className="text-sm text-slate-400">กรอง:</span>
        <select value={filterYear} onChange={e => setFilterYear(e.target.value)}
          className="border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200 transition">
          <option value="">ทุกปีการศึกษา</option>
          {allYears.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <select value={filterTerm} onChange={e => setFilterTerm(e.target.value)}
          className="border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200 transition">
          <option value="">ทุกภาคเรียน</option>
          {allTerms.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <span className="text-xs text-slate-400 ml-auto">แสดง {filtered.length} รายการ</span>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-400 text-sm">
          <div className="text-4xl mb-3">🔍</div>
          {subjects.length === 0 ? "ยังไม่มีรายวิชา — เพิ่มรายวิชาในหน้า Dashboard ก่อน" : "ไม่พบรายวิชา"}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((s) => {
            const st = statusStyle[s.status];
            return (
              <div key={s.id} onClick={() => handleCardClick(s)}
                className="bg-white rounded-2xl border border-slate-100 overflow-hidden cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md"
                style={{ boxShadow: "0 2px 12px rgba(99,102,241,0.06)" }}>
                <div className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 shrink-0">
                        <BookOpen size={18} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-800 leading-snug">{s.name}</p>
                        <p className="text-xs text-slate-400 font-mono mt-0.5">{s.code}</p>
                      </div>
                    </div>
                    <div className="shrink-0 text-right ml-2">
                      <p className="text-2xl font-bold text-slate-800">{s.score}%</p>
                      <span className={`inline-flex mt-1 px-2 py-0.5 rounded-full text-xs font-medium ${st.pill}`}>
                        {s.status}
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2 mb-3 flex-wrap">
                    {s.year && <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-indigo-50 text-indigo-600">ปี {s.year}</span>}
                    {s.term && <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-slate-100 text-slate-500">{s.term}</span>}
                  </div>

                  <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden mb-3">
                    <div className={`h-full rounded-full transition-all duration-700 ${st.bar}`} style={{ width: `${s.score}%` }} />
                  </div>

                  <div className="border-t border-slate-100 mb-3" />

                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <div className="flex gap-4">
                      <span>{s.exams} ชุดข้อสอบ</span>
                      <span>{s.students} แผ่น</span>
                    </div>
                    {s.students > 0
                      ? <span className="text-slate-500 font-medium">ผ่าน {s.passed} ({s.passRate}%)</span>
                      : <span className="text-slate-300">ยังไม่มีการสแกน</span>
                    }
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}