import { useRef, useState, useEffect } from "react";
import {
  Upload, Camera, Trash2, FileText,
  CheckCircle, XCircle, AlertCircle, ChevronDown, BookOpen, X, ZoomIn,
} from "lucide-react";
import { getTemplates, createSession, saveSheet } from "../../lib/api";

let nextSheetId = 1;

function flattenToSetEntries(templates) {
  const entries = [];
  templates.forEach(t => {
    if (!t.sets || t.sets.length === 0) return;
    t.sets.forEach(s => {
      const hasAnswerKey = s.boundingBoxes?.some(b => b.isAnswer === true);
      if (!hasAnswerKey) return;

      entries.push({
        key:              `${t.id}__${s.id}`,
        templateId:       t.id,
        setId:            s.id,
        examName:         t.name,
        subjectCode:      t.subject?.code  || "",
        subjectName:      t.subject?.name  || "",
        year:             t.year,
        semester:         t.semester,
        examType:         t.examType,
        totalQuestions:   t.totalQuestions,
        totalScore:       t.totalScore,
        scorePerQuestion: t.scorePerQuestion,
        choices: t.totalQuestions > 0
          ? Math.round((s.boundingBoxes?.filter((b) => b.type === 'answer' || !b.type).length || 0) / t.totalQuestions) || 5
          : 5,
        set:              s,
        label:    `${t.subject?.code || ""}-${t.subject?.name || ""} / ${s.label}`,
        sublabel: `${t.name} · ปี ${t.year} ${t.semester}`,
      });
    });
  });
  return entries;
}

function PreviewModal({ sheet, index, onClose }) {
  const handleBackdrop = (e) => { if (e.target === e.currentTarget) onClose(); };
  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: "rgba(15,23,42,0.7)", backdropFilter: "blur(6px)" }}
      onClick={handleBackdrop}>
      <div className="bg-white rounded-3xl overflow-hidden max-w-2xl w-full shadow-2xl"
        style={{ boxShadow: "0 32px 80px rgba(0,0,0,0.3)" }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <p className="text-sm font-semibold text-slate-800">แผ่นที่ {index + 1}</p>
            <p className="text-xs text-slate-400 mt-0.5 truncate max-w-xs">{sheet.file.name}</p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:bg-slate-100 transition-colors">
            <X size={16} />
          </button>
        </div>
        <div className="bg-slate-50 flex items-center justify-center p-4" style={{ maxHeight: "60vh" }}>
          <img src={sheet.cloudinaryUrl || sheet.previewUrl} alt={`sheet-${index + 1}`}
            className="max-w-full max-h-full object-contain rounded-xl"
            style={{ maxHeight: "60vh" }} />
        </div>
        {sheet.result && (
          <div className="px-5 py-4 border-t border-slate-100">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex items-center gap-1.5">
                {sheet.result.wrongItems.length === 0
                  ? <CheckCircle size={15} className="text-emerald-500" />
                  : <AlertCircle size={15} className="text-amber-500" />}
                <span className="text-sm font-bold text-slate-800">
                  {sheet.result.score}/{sheet.result.totalScore}
                </span>
                <span className="text-xs text-slate-400">
                  ({Math.round((sheet.result.score / sheet.result.totalScore) * 100)}%)
                </span>
              </div>
              {sheet.result.wrongItems.length === 0 && (
                <span className="text-sm text-emerald-500 font-medium">ถูกทุกข้อ 🎉</span>
              )}
            </div>
            <div className="flex flex-wrap gap-1 max-h-40 overflow-y-auto">
              {Array.from({ length: sheet.result.totalQuestions || 30 }, (_, i) => i + 1).map(q => {
                const isWrong    = sheet.result.wrongItems?.includes(q);
                const isUnfilled = sheet.result.unfilledItems?.includes(q);
                return (
                  <span key={q} className={`text-xs px-1.5 py-0.5 rounded font-medium border ${
                    isUnfilled
                      ? 'bg-slate-100 text-slate-400 border-slate-200'
                      : isWrong
                        ? 'bg-red-50 text-red-500 border-red-200'
                        : 'bg-emerald-50 text-emerald-600 border-emerald-200'
                  }`}>
                    {q}{isUnfilled ? ' ?' : isWrong ? ' ✗' : ' ✓'}
                  </span>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


export default function ScanExam() {
  const fileInputRef = useRef(null);
  const cameraRef    = useRef(null);

  const [templates,  setTemplates]  = useState([]);
  const [dropOpen,   setDropOpen]   = useState(false);
  const [selected,   setSelected]   = useState(null);
  const [sheets,     setSheets]     = useState([]);
  const [processing, setProcessing] = useState(false);
  const [preview,    setPreview]    = useState(null);
  const [sessionId,  setSessionId]  = useState(null);
  const [inputKey, setInputKey] = useState(0);

  useEffect(() => {
    getTemplates().then(setTemplates).catch(() => {});
  }, []);

  const entries = flattenToSetEntries(templates);
  const hasTemplates    = templates.length > 0;
  const hasReadyEntries = entries.length > 0;
  const canScan = !!selected;

  const handleSelect = (entry) => {
    setSelected(entry);
    setDropOpen(false);
    setSheets([]);
    setSessionId(null);
  };

  const handleFiles = async (files) => {
    if (!selected) return;

    let currentSessionId = sessionId;
    if (!currentSessionId) {
      try {
        const session = await createSession({
          templateId: selected.templateId,
          setId:      selected.setId,
        });
        currentSessionId = session.id;
        setSessionId(session.id);
      } catch (err) {
        console.error('สร้าง session ไม่สำเร็จ:', err);
        return;
      }
    }

    const newSheets = Array.from(files).map(file => ({
      id: nextSheetId++, file,
      previewUrl: URL.createObjectURL(file),
      status: "processing", result: null,
    }));
    setSheets(prev => [...prev, ...newSheets]);
    setProcessing(true);

    for (let i = 0; i < newSheets.length; i++) {
      try {
        // หมุนภาพถ้าเป็นแนวนอน
      
      const data = await saveSheet(
      currentSessionId,
      selected.setId,
      newSheets[i].file
    );
        console.log('scan response:', data);

        setSheets(prev => prev.map(s =>
          s.id === newSheets[i].id
            ? {
                ...s,
                status: 'done',
                cloudinaryUrl: data.imageUrl ?? null,
                result: {
                  score:              data.score,
                  totalScore:         data.gradeDetail?.total_score ?? selected.totalScore ?? 100,
                  totalQuestions:     selected.totalQuestions || 30,
                  wrongItems:         (() => {
                    const choices = selected.choices || 5;
                    const encoded = data.wrongItems?.map(w => w.questionNumber) ?? [];
                    const realQNums = [...new Set(encoded.map(n => Math.ceil(n / choices)))];
                    return realQNums.sort((a, b) => a - b);
                  })(),
                  unfilledItems:      data.gradeDetail?.unfilled_items ?? [],
                  detectedStudentId:  data.detectedStudentId  ?? null,
                  matchedStudent:     data.matchedStudent      ?? null,
                }
              }
            : s
        ));
      } catch (err) {
        console.error('ตรวจไม่สำเร็จ:', err);
        const errMsg = err?.message || 'ตรวจไม่สำเร็จ';
        setSheets(prev => prev.map(s =>
          s.id === newSheets[i].id
            ? { ...s, status: 'error', errorMessage: errMsg, result: { score: 0, totalScore: selected.totalScore ?? 100, wrongItems: [], totalQuestions: selected.totalQuestions || 30, unfilledItems: [] } }
            : s
        ));
      }
    }
    setProcessing(false);
  };

  const handleFileInput = (e) => {
  const files = e.target.files;
  if (files?.length) handleFiles(files);
  setInputKey(k => k + 1);
};
  const handleDrop  = (e) => { e.preventDefault(); if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files); };
  const rotateSheet = (id) => {
  const sheet = sheets.find(s => s.id === id);
  if (!sheet?.previewUrl) return;
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = img.height;
    canvas.height = img.width;
    const ctx = canvas.getContext('2d');
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.drawImage(img, -img.width / 2, -img.height / 2);
    canvas.toBlob(blob => {
      const newFile = new File([blob], sheet.file.name, { type: sheet.file.type });
      const newUrl = URL.createObjectURL(blob);
      setSheets(prev => prev.map(s => s.id === id ? { ...s, file: newFile, previewUrl: newUrl } : s));
    }, sheet.file.type);
  };
  img.src = sheet.previewUrl;
};

  const doneCount       = sheets.filter(s => s.status === "done").length;
  const processingCount = sheets.filter(s => s.status === "processing").length;

  return (
    <div className="px-4 sm:px-8 lg:px-20 min-h-screen py-6 flex flex-col gap-6">
      <div className="bg-white rounded-3xl border border-slate-100"
        style={{ boxShadow: "0 4px 24px rgba(99,102,241,0.08)" }}>
        <div className="h-1.5 w-full rounded-t-3xl"
          style={{ background: "linear-gradient(90deg,#6366f1,#8b5cf6,#06b6d4)" }} />
        <div className="p-6">
          <div className="flex items-center gap-3 mb-5">
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0
              ${canScan ? "bg-emerald-100 text-emerald-600" : "bg-indigo-100 text-indigo-600"}`}>
              {canScan ? <CheckCircle size={14} /> : "1"}
            </span>
            <div>
              <h2 className="text-sm font-semibold text-slate-800">เลือกเฉลยกระดาษคำตอบ</h2>
              <p className="text-xs text-slate-400 mt-0.5">เลือกชุดข้อสอบที่ต้องการตรวจ (แต่ละชุดแยกกัน)</p>
            </div>
          </div>

          {!hasTemplates && (
            <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
              <AlertCircle size={16} className="text-amber-500 shrink-0" />
              <p className="text-sm text-amber-700">
                ยังไม่มี template — ไปที่ <span className="font-semibold">Exams → สร้าง / กำหนดกรอบ</span> แล้วกด <span className="font-semibold">บันทึก Template</span> ก่อน
              </p>
            </div>
          )}

          {hasTemplates && !hasReadyEntries && (
            <div className="flex items-center gap-3 bg-indigo-50 border border-indigo-200 rounded-2xl px-4 py-3">
              <AlertCircle size={16} className="text-indigo-500 shrink-0" />
              <p className="text-sm text-indigo-700">
                มี template แล้ว แต่ยังไม่มีชุดที่ยืนยันเฉลย — ไปที่ <span className="font-semibold">Exams → สร้าง / กำหนดกรอบ</span> แล้วกด <span className="font-semibold">ตรวจเฉลยอัตโนมัติ → ยืนยันเฉลย</span> ก่อน
              </p>
            </div>
          )}

          {hasReadyEntries && (
            <div className="flex flex-col gap-4">
              <div>
                <p className="text-xs font-semibold text-slate-500 mb-1.5">ชุดข้อสอบ</p>
                <div className="relative w-full max-w-xl">
                  <button onClick={() => setDropOpen(v => !v)}
                    className="w-full flex items-center justify-between gap-3 border border-slate-200 rounded-2xl px-4 py-3 bg-slate-50 hover:bg-indigo-50/50 hover:border-indigo-300 transition-all text-left">
                    {selected ? (
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
                          <BookOpen size={14} className="text-indigo-500" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-800 truncate">{selected.label}</p>
                          <p className="text-xs text-slate-400 truncate">{selected.sublabel}</p>
                        </div>
                      </div>
                    ) : (
                      <span className="text-sm text-slate-400">เลือกชุดข้อสอบ...</span>
                    )}
                    <ChevronDown size={16}
                      className={`text-slate-400 shrink-0 transition-transform duration-200 ${dropOpen ? "rotate-180" : ""}`} />
                  </button>

                  {dropOpen && (
                    <div className="absolute top-full left-0 mt-2 w-full bg-white rounded-2xl z-50"
                      style={{ border:"1px solid rgba(99,102,241,0.15)", boxShadow:"0 16px 48px rgba(99,102,241,0.18)", minWidth:"320px" }}>
                      {entries.map((entry, idx) => {
                        const isActive  = selected?.key === entry.key;
                        const prevExam  = idx > 0 ? entries[idx - 1].examName : null;
                        const showDivider = entry.examName !== prevExam;
                        return (
                          <div key={entry.key}>
                            {showDivider && (
                              <div className="px-4 pt-3 pb-1">
                                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{entry.examName}</p>
                              </div>
                            )}
                            <button onClick={() => handleSelect(entry)}
                              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-indigo-50 transition-colors text-left"
                              style={{ background: isActive ? "#eef2ff" : "transparent" }}>
                              <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
                                <BookOpen size={13} className="text-indigo-400" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium truncate"
                                  style={{ color: isActive ? "#4f46e5" : "#1e293b" }}>{entry.label}</p>
                                <p className="text-xs text-slate-400 truncate">{entry.sublabel}</p>
                              </div>
                              {isActive && <CheckCircle size={14} className="text-indigo-500 shrink-0" />}
                            </button>
                          </div>
                        );
                      })}
                      <div className="h-1.5" />
                    </div>
                  )}
                </div>
              </div>

              {selected && (
                <div className="flex flex-wrap gap-2">
                  <span className="text-xs px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-full font-semibold border border-indigo-100">
                    {selected.label}
                  </span>
                  {[
                    ["ปีการศึกษา", `${selected.year} / ${selected.semester}`],
                    ["รูปแบบ",     selected.examType],
                    ["จำนวนข้อ",  selected.totalQuestions || "—"],
                    ["คะแนนเต็ม", selected.totalScore     || "—"],
                  ].map(([k, v]) => (
                    <span key={k} className="text-xs px-3 py-1.5 bg-slate-100 text-slate-600 rounded-full">
                      <span className="text-slate-400">{k}: </span>{v}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden transition-all duration-300"
        style={{ boxShadow: !canScan ? "none" : "0 4px 24px rgba(99,102,241,0.08)", opacity: !canScan ? 0.5 : 1 }}>
        <div className="h-1.5 w-full rounded-t-3xl"
          style={{ background: !canScan ? "#e2e8f0" : "linear-gradient(90deg,#6366f1,#8b5cf6,#06b6d4)" }} />
        <div className="p-6">
          <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0
                ${!canScan ? "bg-slate-100 text-slate-400" : "bg-indigo-100 text-indigo-600"}`}>2</span>
              <div>
                <h2 className="text-sm font-semibold text-slate-800">แสกนกระดาษคำตอบ</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {!canScan ? "เลือกชุดข้อสอบก่อน" : `กำลังตรวจ: ${selected.label}`}
                </p>
              </div>
            </div>
            {sheets.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-medium text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">{sheets.length} แผ่น</span>
                {doneCount > 0       && <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">ตรวจแล้ว {doneCount}</span>}
                {processingCount > 0 && <span className="text-xs font-medium text-amber-600 bg-amber-50 px-3 py-1 rounded-full animate-pulse">กำลังตรวจ {processingCount}</span>}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[2fr_3fr] gap-5">
            <div className="flex flex-col gap-4">
              <div onDrop={handleDrop} onDragOver={e => e.preventDefault()}
                onClick={() => canScan && fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-3xl min-h-[220px] flex flex-col items-center justify-center gap-3 transition-all
                  ${canScan ? "border-indigo-200 hover:border-indigo-400 hover:bg-indigo-50/30 cursor-pointer" : "border-slate-200 cursor-not-allowed"}`}>
                <div className={`p-4 rounded-full ${canScan ? "bg-indigo-50" : "bg-slate-50"}`}>
                  <Upload className={`w-7 h-7 ${canScan ? "text-indigo-400" : "text-slate-300"}`} />
                </div>
                <p className={`text-sm font-medium ${canScan ? "text-slate-700" : "text-slate-300"}`}>ลากไฟล์มาวางที่นี่</p>
                <p className={`text-xs ${canScan ? "text-slate-400" : "text-slate-300"}`}>JPG, PNG · เลือกได้หลายไฟล์</p>
              </div>
              <div className="flex gap-3">
                <button disabled={!canScan} onClick={() => fileInputRef.current?.click()}
                  className="flex-1 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed text-white py-3 rounded-2xl flex items-center justify-center gap-2 text-sm transition-all shadow">
                  <Upload size={15} /> เลือกไฟล์
                </button>
                <button disabled={!canScan} onClick={() => cameraRef.current?.click()}
                  className="flex-1 border border-indigo-200 bg-white hover:border-indigo-400 disabled:opacity-40 disabled:cursor-not-allowed text-indigo-600 py-3 rounded-2xl flex items-center justify-center gap-2 text-sm transition-all">
                  <Camera size={15} /> ถ่ายภาพ
                </button>
              </div>
              <input key={`file-${inputKey}`} type="file" accept=".jpg,.jpeg,.png" multiple ref={fileInputRef} onChange={handleFileInput} className="hidden" />
              <input key={`camera-${inputKey}`} type="file" accept="image/*" capture="environment" ref={cameraRef} onChange={handleFileInput} className="hidden" />
            </div>

            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                รายการกระดาษคำตอบ
                {sheets.length > 0 && <span className="ml-2 normal-case font-normal text-slate-400 tracking-normal">({sheets.length} แผ่น)</span>}
              </p>
              {sheets.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-14 text-slate-300 gap-2">
                  <FileText className="w-10 h-10" />
                  <p className="text-sm">ยังไม่มีกระดาษคำตอบ</p>
                </div>
              ) : (
                <div className="flex flex-col gap-3 max-h-[460px] overflow-y-auto pr-1">
                  {sheets.map((sheet, idx) => (
                    <SheetCard key={sheet.id} sheet={sheet} index={idx}
                    onRemove={() => removeSheet(sheet.id)}
                    onPreview={() => setPreview({ sheet, index: idx })}
                    onRotate={() => rotateSheet(sheet.id)} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {preview && (
        <PreviewModal sheet={preview.sheet} index={preview.index} onClose={() => setPreview(null)} />
      )}
    </div>
  );
}

function SheetCard({ sheet, index, onRemove, onPreview, onRotate }) {
  
  const isProcessing = sheet.status === "processing";
  const isError      = sheet.status === "error";
  const { result }   = sheet;
  return (
    <div className="flex gap-3 border rounded-2xl p-4 transition-all"
      style={{
        background:  isProcessing ? "#fafafa" : "#fff",
        borderColor: isProcessing ? "#e9d5ff" : result?.wrongItems?.length === 0 ? "#d1fae5" : "#fee2e2",
      }}>
      <div className="w-12 h-16 rounded-xl overflow-hidden border border-slate-100 bg-slate-50 shrink-0 cursor-pointer relative group"
        onClick={onPreview} title="คลิกเพื่อดูรูปเต็ม">
        <img src={sheet.cloudinaryUrl || sheet.previewUrl} alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-indigo-600/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <ZoomIn size={14} className="text-white drop-shadow" />
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <button onClick={onPreview}
            className="text-sm font-medium text-slate-800 hover:text-indigo-600 transition-colors text-left flex items-center gap-1.5">
            แผ่นที่ {index + 1}
            <ZoomIn size={12} className="text-slate-300" />
          </button>
          <button onClick={onRotate} className="text-slate-300 hover:text-indigo-400 transition-colors shrink-0" title="หมุน 90°">
              ↻
            </button>
            <button onClick={onRemove} className="text-slate-300 hover:text-red-400 transition-colors shrink-0">
              <Trash2 size={13} />
            </button>
        </div>
        <p className="text-xs text-slate-400 truncate mt-0.5">{sheet.file.name}</p>

        {result?.matchedStudent && (
          <div className="mt-1.5 flex items-center gap-1.5">
            <span className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-100 px-2 py-0.5 rounded-full font-medium">
              {result.matchedStudent.studentId}
            </span>
            <span className="text-xs text-slate-600 font-medium">{result.matchedStudent.name}</span>
          </div>
        )}
        {result && !result.matchedStudent && result.detectedStudentId && (
          <div className="mt-1.5 flex items-center gap-1.5">
            <span className="text-xs bg-amber-50 text-amber-700 border border-amber-100 px-2 py-0.5 rounded-full">
              อ่านได้: {result.detectedStudentId}
            </span>
            <span className="text-xs text-slate-400">ไม่พบในระบบ</span>
          </div>
        )}
        {result && !result.matchedStudent && !result.detectedStudentId && (
          <div className="mt-1.5">
            <span className="text-xs text-slate-300">ไม่มีกรอบเลขนิสิต</span>
          </div>
        )}

        {isProcessing ? (
          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1 bg-indigo-100 rounded-full h-1.5 overflow-hidden">
              <div className="bg-indigo-400 h-full rounded-full animate-pulse w-2/3" />
            </div>
            <span className="text-xs text-indigo-400 whitespace-nowrap">กำลังตรวจ...</span>
          </div>
        ) : isError ? (
          <div className="mt-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
            <p className="text-xs text-red-600 font-medium">⚠️ {sheet.errorMessage || 'ตรวจไม่สำเร็จ'}</p>
          </div>
        ) : result ? (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <div className="flex items-center gap-1">
              {result.wrongItems?.length === 0
                ? <CheckCircle size={13} className="text-emerald-500" />
                : <AlertCircle size={13} className="text-amber-500" />}
              <span className="text-sm font-semibold text-slate-800">{result.score}/{result.totalScore}</span>
              <span className="text-xs text-slate-400">({Math.round((result.score / result.totalScore) * 100)}%)</span>
            </div>
            {result.wrongItems?.length > 0 ? (
              <div className="mt-2">
                <div className="flex flex-wrap gap-1">
                  {Array.from({ length: result.totalQuestions || 30 }, (_, i) => i + 1).map(q => {
                    const isWrong = result.wrongItems.includes(q);
                    return (
                      <span key={q} className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                        isWrong
                          ? 'bg-red-50 text-red-500 border border-red-200'
                          : 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                      }`}>
                        {q}{isWrong ? ' ✗' : ' ✓'}
                      </span>
                    );
                  })}
                </div>
              </div>
            ) : (
              <span className="text-xs text-emerald-500 font-medium">ถูกทุกข้อ 🎉</span>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}