import { useState, useMemo, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Download, TrendingUp, TrendingDown, Users, Award } from "lucide-react";
import { getResults, getTemplates } from "../../lib/api";
import { exportExcel } from '../../lib/exportExcel'

function scoreColor(p) {
  if (p >= 80) return "text-emerald-600";
  if (p >= 70) return "text-indigo-600";
  if (p >= 60) return "text-amber-600";
  if (p >= 50) return "text-orange-500";
  return "text-red-500";
}
function barColor(p) {
  if (p >= 80) return "bg-emerald-500";
  if (p >= 70) return "bg-indigo-400";
  if (p >= 60) return "bg-amber-400";
  if (p >= 50) return "bg-orange-400";
  return "bg-red-400";
}
function StatusPill({ p }) {
  if (p >= 60) return <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">ผ่าน</span>;
  if (p >= 50) return <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">เกือบผ่าน</span>;
  return <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-600 border border-red-200">ไม่ผ่าน</span>;
}

export default function InReports() {
  const location = useLocation();
  const subject  = location.state;
  const [sheets,   setSheets]   = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [filter,   setFilter]   = useState("all");
  const [sort,     setSort]     = useState("rank");
  const [search,   setSearch]   = useState("");

  useEffect(() => {
    if (!subject?.id) { setLoading(false); return; }
    getTemplates().then(templates => {
      const subTemplates = templates.filter(t => t.subjectId === subject.id);
      // สร้าง map จาก detectedStudentId → ชื่อนิสิต จาก sheets ที่มี student อยู่แล้ว
      const studentMap = {}
      subTemplates.forEach(t =>
        t.sets?.forEach(s =>
          (s.scanSessions || []).forEach(ss =>
            (ss.sheets || []).forEach((sheet) => {
              if (sheet.student?.name && sheet.detectedStudentId) {
                studentMap[sheet.detectedStudentId] = sheet.student.name
              }
            })
          )
        )
      )

      const allSheets = subTemplates.flatMap(t =>
        t.sets?.flatMap(s =>
          (s.scanSessions || []).flatMap(ss =>
            (ss.sheets || []).map((sheet, idx) => {
              const studentName = sheet.student?.name
                || studentMap[sheet.detectedStudentId]
                || sheet.detectedStudentId
                || `แผ่นที่ ${idx + 1}`
              return {
                id:                sheet.id,
                name:              studentName,
                score:             sheet.score || 0,
                totalScore:        t.totalScore || 100,
                status:            sheet.status,
                wrongItems:        sheet.wrongItems || [],
                detectedStudentId: sheet.detectedStudentId || null,
                choices:           Math.round((s.boundingBoxes?.filter((b) => b.type === 'answer').length || 0) / (t.totalQuestions || 1)) || 5,
              }
            })
          )
        ) || []
      );
      setSheets(allSheets);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [subject?.id]);

  const totalStudents = sheets.length;
  const totalScore    = sheets[0]?.totalScore || 100;
  const passThreshold = totalScore * 0.6;
  const passCount     = sheets.filter(s => s.score >= passThreshold).length;
  const failCount     = totalStudents - passCount;
  const avgScore      = totalStudents > 0
    ? (sheets.reduce((a, s) => a + s.score, 0) / totalStudents).toFixed(1)
    : 0;
  const avgPct = totalScore > 0 ? Math.round((parseFloat(avgScore) / totalScore) * 100) : 0;

  const dist = [
    { label: "90–100%", count: sheets.filter(s => (s.score/totalScore)*100 >= 90).length, color: "bg-emerald-500" },
    { label: "80–89%",  count: sheets.filter(s => { const p=(s.score/totalScore)*100; return p>=80&&p<90; }).length, color: "bg-emerald-400" },
    { label: "70–79%",  count: sheets.filter(s => { const p=(s.score/totalScore)*100; return p>=70&&p<80; }).length, color: "bg-indigo-400"  },
    { label: "60–69%",  count: sheets.filter(s => { const p=(s.score/totalScore)*100; return p>=60&&p<70; }).length, color: "bg-amber-400"   },
    { label: "50–59%",  count: sheets.filter(s => { const p=(s.score/totalScore)*100; return p>=50&&p<60; }).length, color: "bg-orange-400"  },
    { label: "<50%",    count: sheets.filter(s => (s.score/totalScore)*100 < 50).length,  color: "bg-red-400"     },
  ];
  const maxDist = Math.max(...dist.map(d => d.count), 1);

  const wrongFreq = {};
  sheets.forEach(s => s.wrongItems.forEach(w => {
    const q = w.questionNumber;
    wrongFreq[q] = (wrongFreq[q] || 0) + 1;
  }));
  const topWrong = Object.entries(wrongFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .filter(([, count]) => totalStudents > 0 && (count / totalStudents) >= 0.5);

  const filteredSheets = useMemo(() => {
    let data = [...sheets];
    if (filter === "pass") data = data.filter(s => s.score >= passThreshold);
    if (filter === "fail") data = data.filter(s => s.score < passThreshold);
    if (search.trim()) data = data.filter(s => s.name.toLowerCase().includes(search.trim().toLowerCase()));
    if (sort === "score-asc") data.sort((a, b) => a.score - b.score);
    if (sort === "score-desc") data.sort((a, b) => b.score - a.score);
    return data;
  }, [sheets, filter, sort, passThreshold, search]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-slate-400 text-sm">กำลังโหลด...</p>
    </div>
  );

      const handleExport = () => {
      if (!subject || totalStudents === 0) return
      const exportData = filteredSheets.map((s, i) => {
        const raw = s.wrongItems?.map(w => typeof w === 'object' ? w.questionNumber : w) ?? [];
        const choices = s.choices || 5;
        const decoded = [...new Set(raw.map(n => Math.ceil(n / choices)))].sort((a, b) => a - b);
        return {
          name:              s.name || `แผ่นที่ ${i + 1}`,
          score:             s.score,
          totalScore,
          wrongItems:        decoded,
          student:           s.student ?? null,
          detectedStudentId: s.detectedStudentId ?? null,
        }
      })
      exportExcel(subject, exportData)
    }

  return (
    <div className="min-h-screen px-4 sm:px-8 lg:px-20 py-6">
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          {subject ? (
            <>
              <h1 className="text-lg font-bold text-slate-800">{subject.name}</h1>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="text-xs font-mono text-slate-400">{subject.code}</span>
                {subject.year && <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 font-medium">ปี {subject.year}</span>}
                {subject.term && <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-medium">เทอม {subject.term}</span>}
              </div>
            </>
          ) : (
            <h1 className="text-lg font-bold text-slate-800">รายงานผลการสอบ</h1>
          )}
        </div>
        <button
          onClick={handleExport}
          disabled={totalStudents === 0}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
          <Download size={14} /> Export Excel
        </button>
      </div>

      {totalStudents === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <div className="text-4xl mb-3">📋</div>
          <p className="text-sm">ยังไม่มีข้อมูลการสแกน — ไปที่หน้า Scan เพื่อเริ่มตรวจกระดาษ</p>
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row gap-5 items-start">
          <div className="w-full lg:w-80 lg:shrink-0 flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-2xl border border-slate-100 p-4" style={{ boxShadow: "0 2px 12px rgba(99,102,241,0.06)" }}>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center"><Users size={14} className="text-indigo-500" /></div>
                  <span className="text-xs text-slate-400">ทั้งหมด</span>
                </div>
                <div className="text-2xl font-bold text-slate-800">{totalStudents}</div>
                <div className="text-xs text-slate-400 mt-0.5">แผ่น</div>
              </div>
              <div className="bg-white rounded-2xl border border-slate-100 p-4" style={{ boxShadow: "0 2px 12px rgba(99,102,241,0.06)" }}>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center"><Award size={14} className="text-amber-500" /></div>
                  <span className="text-xs text-slate-400">เฉลี่ย</span>
                </div>
                <div className="text-2xl font-bold text-amber-600">{avgPct}%</div>
                <div className="text-xs text-slate-400 mt-0.5">{avgScore} / {totalScore}</div>
              </div>
              <div className="bg-white rounded-2xl border border-slate-100 p-4" style={{ boxShadow: "0 2px 12px rgba(99,102,241,0.06)" }}>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center"><TrendingUp size={14} className="text-emerald-500" /></div>
                  <span className="text-xs text-slate-400">ผ่าน</span>
                </div>
                <div className="text-2xl font-bold text-emerald-600">{passCount}</div>
                <div className="text-xs text-slate-400 mt-0.5">แผ่น ({totalStudents > 0 ? Math.round((passCount/totalStudents)*100) : 0}%)</div>
              </div>
              <div className="bg-white rounded-2xl border border-slate-100 p-4" style={{ boxShadow: "0 2px 12px rgba(99,102,241,0.06)" }}>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center"><TrendingDown size={14} className="text-red-400" /></div>
                  <span className="text-xs text-slate-400">ไม่ผ่าน</span>
                </div>
                <div className="text-2xl font-bold text-red-500">{failCount}</div>
                <div className="text-xs text-slate-400 mt-0.5">แผ่น ต้องซ่อมเสริม</div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 p-5" style={{ boxShadow: "0 2px 12px rgba(99,102,241,0.06)" }}>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">การกระจายคะแนน</p>
              <div className="space-y-2.5">
                {dist.map(d => (
                  <div key={d.label} className="flex items-center gap-2.5">
                    <span className="text-xs text-slate-400 w-14 text-right shrink-0">{d.label}</span>
                    <div className="flex-1 h-5 bg-slate-100 rounded-lg overflow-hidden">
                      <div className={`h-full ${d.color} flex items-center px-2 transition-all duration-700`}
                        style={{ width: `${(d.count / maxDist) * 100}%`, minWidth: d.count > 0 ? "24px" : "0" }}>
                        {d.count > 0 && <span className="text-white text-xs font-bold">{d.count}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {(failCount > 0 || topWrong.length > 0) && (
              <div className="bg-white rounded-2xl border border-slate-100 p-5" style={{ boxShadow: "0 2px 12px rgba(99,102,241,0.06)" }}>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">จุดสนใจ</p>
                <div className="space-y-2">
                  {failCount > 0 && (
                    <div className="flex items-start gap-3 bg-red-50 border border-red-100 rounded-xl px-3.5 py-3">
                      <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 bg-red-400" />
                      <p className="text-xs text-red-700 leading-relaxed">{failCount} แผ่น คะแนนต่ำกว่าเกณฑ์ (&lt;60%)</p>
                    </div>
                  )}
                  {topWrong.length > 0 && (
                    <div className="flex items-start gap-3 bg-amber-50 border border-amber-100 rounded-xl px-3.5 py-3">
                      <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 bg-amber-400" />
                      <div>
                        <p className="text-xs text-amber-700 leading-relaxed">
                          ข้อ {topWrong.map(([q]) => q).join(", ")} ตอบผิดมากกว่า 50%
                        </p>
                        <p className="text-xs text-amber-500 mt-0.5">ควรทบทวนวิธีการสอน</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="bg-white rounded-2xl border border-slate-100" style={{ boxShadow: "0 2px 12px rgba(99,102,241,0.06)" }}>
              <div className="flex items-center justify-between flex-wrap gap-3 px-5 pt-5 pb-4 border-b border-slate-100">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  รายการกระดาษ
                  <span className="ml-2 normal-case font-normal text-slate-400 tracking-normal">({filteredSheets.length} แผ่น)</span>
                </p>
                <div className="flex items-center gap-2 flex-wrap">
                  <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="ค้นหาชื่อนิสิต..."
                    className="text-xs border border-slate-200 rounded-xl px-3 py-1.5 bg-white text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-200 w-40"
                  />
                  <div className="flex rounded-xl border border-slate-200 overflow-hidden text-xs">
                    {["all","pass","fail"].map(f => (
                      <button key={f} onClick={() => setFilter(f)}
                        className={`px-3 py-1.5 font-medium transition-colors ${filter === f ? "bg-indigo-600 text-white" : "bg-white text-slate-500 hover:bg-slate-50"}`}>
                        {f === "all" ? "ทั้งหมด" : f === "pass" ? "ผ่าน" : "ไม่ผ่าน"}
                      </button>
                    ))}
                  </div>
                  <select value={sort} onChange={e => setSort(e.target.value)}
                    className="text-xs border border-slate-200 rounded-xl px-2.5 py-1.5 bg-white text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-200">
                    <option value="rank">ลำดับ</option>
                    <option value="score-desc">คะแนนมาก → น้อย</option>
                    <option value="score-asc">คะแนนน้อย → มาก</option>
                  </select>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="text-left text-xs font-semibold text-slate-400 px-5 py-3 w-8">#</th>
                      <th className="text-left text-xs font-semibold text-slate-400 py-3 pr-3">นิสิต</th>
                      <th className="text-left text-xs font-semibold text-slate-400 py-3 pr-3 w-40">คะแนน</th>
                      <th className="text-left text-xs font-semibold text-slate-400 py-3 pr-3 w-16">%</th>
                      <th className="text-left text-xs font-semibold text-slate-400 py-3 pr-5 w-24">สถานะ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSheets.map((s, i) => {
                      const p = totalScore > 0 ? Math.round((s.score / totalScore) * 100) : 0;
                      return (
                        <tr key={s.id} className="border-b border-slate-50 hover:bg-indigo-50/20 transition-colors">
                          <td className="py-3 px-5 text-xs text-slate-300 font-mono">{i + 1}</td>
                          <td className="py-3 pr-3">
                            <div className="font-medium text-slate-700">{s.name}</div>
                            {s.detectedStudentId && s.detectedStudentId !== s.name && (
                              <div className="text-xs text-slate-400 font-mono">{s.detectedStudentId}</div>
                            )}
                          </td>
                          <td className="py-3 pr-3">
                            <div className="flex items-center gap-2.5">
                              <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full ${barColor(p)}`} style={{ width: `${p}%` }} />
                              </div>
                              <span className="text-xs text-slate-500 tabular-nums">{s.score}/{totalScore}</span>
                            </div>
                          </td>
                          <td className={`py-3 pr-3 text-xs font-bold tabular-nums ${scoreColor(p)}`}>{p}%</td>
                          <td className="py-3 pr-5"><StatusPill p={p} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {filteredSheets.length === 0 && (
                  <div className="text-center py-12 text-sm text-slate-400">ไม่มีข้อมูลในกลุ่มนี้</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}