import { useState, useRef, useEffect, useCallback } from "react";
import {
  Upload, Camera, FileText, Trash2, Save,
  Lock, CheckCircle2, ChevronRight, Plus, BookOpen, Scan, Grid, X,
} from "lucide-react";
import { getSubjects, getTemplates, saveTemplate, detectAnswerWithBoxes } from "../../lib/api";

const HANDLE_SIZE = 8;
const HIT_AREA    = 10;

function getHandles({ x, y, w, h }) {
  return {
    tl:{x,y}, tm:{x:x+w/2,y}, tr:{x:x+w,y},
    ml:{x,y:y+h/2},            mr:{x:x+w,y:y+h/2},
    bl:{x,y:y+h}, bm:{x:x+w/2,y:y+h}, br:{x:x+w,y:y+h},
  };
}
function hitHandle(pos, handles) {
  for (const [key, h] of Object.entries(handles))
    if (Math.abs(pos.x-h.x)<=HIT_AREA && Math.abs(pos.y-h.y)<=HIT_AREA) return key;
  return null;
}
function normalize({ x, y, w, h, ...rest }) {
  if (w<0){x+=w;w=-w;} if (h<0){y+=h;h=-h;}
  return {...rest,x,y,w,h};
}
function isInside(pos, r) {
  const n=normalize(r);
  return pos.x>=n.x&&pos.x<=n.x+n.w&&pos.y>=n.y&&pos.y<=n.y+n.h;
}
function resizeR(r, handle, {x:dx,y:dy}) {
  let {x,y,w,h}=r;
  if(handle.includes('l')){x+=dx;w-=dx;} if(handle.includes('r'))w+=dx;
  if(handle.includes('t')){y+=dy;h-=dy;} if(handle.includes('b'))h+=dy;
  return {...r,x,y,w,h};
}
const cursorMap={tl:'nw-resize',tm:'n-resize',tr:'ne-resize',ml:'w-resize',mr:'e-resize',bl:'sw-resize',bm:'s-resize',br:'se-resize'};

let nextId = 1;
const inputCls = "w-full mt-1.5 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300 bg-slate-50 text-slate-800 transition placeholder:text-slate-400 disabled:opacity-40 disabled:cursor-not-allowed";

const EMPTY_FORM = {
  name:"", subjectCode:"", subject:"", year:"",
  semester:"ภาคเรียนที่ 1", examType:"ฝนคำตอบ",
  totalQuestions:"", totalScore:"",
};

export default function ExamPage() {
  const [savedTemplates, setSavedTemplates] = useState([]);
  const [subjects,       setSubjects]       = useState([]);

  useEffect(() => {
    getTemplates().then(setSavedTemplates).catch(() => {});
    getSubjects().then(setSubjects).catch(() => {});
  }, []);

  const [form,          setForm]          = useState(EMPTY_FORM);
  const [examId,        setExamId]        = useState(null);
  const [creating,      setCreating]      = useState(false);
  const [sets,          setSets]          = useState([]);
  const [activeSet,     setActiveSet]     = useState(null);
  const [saving,        setSaving]        = useState(false);
  const [saved,         setSaved]         = useState(false);
  const [detecting,     setDetecting]     = useState(false);
  const [detected,      setDetected]      = useState(false);
  const [answerPreview, setAnswerPreview] = useState(null);
  const [confirmedAnswerKey, setConfirmedAnswerKey] = useState([]);

  const canvasRef      = useRef(null);
  const containerRef   = useRef(null);
  const imgRef         = useRef(null);
  const scaleMapRef    = useRef({}); // เก็บ {scaleX, scaleY, offsetX, offsetY} ของแต่ละ set
  const fileInputRef   = useRef(null);
  const cameraRef      = useRef(null);
  const stateRef       = useRef({});
  const interactionRef = useRef(null);
  const activeSetRef   = useRef(null);
  activeSetRef.current = activeSet;

  const locked     = examId === null;
  const currentSet = sets.find(s => s.id === activeSet) || null;

  useEffect(() => {
    stateRef.current.rectangles = currentSet?.rectangles || [];
    stateRef.current.selectedId = currentSet?.selectedId ?? null;
  });

  const handleNewExam = () => {
    setForm(EMPTY_FORM);
    setExamId(null);
    setCreating(false);
    setSets([]);
    setActiveSet(null);
    setSaved(false);
    setSaving(false);
    setDetected(false);
    setAnswerPreview(null);
    setConfirmedAnswerKey([]);
    imgRef.current = null;
  };

  const handleEditTemplate = (t) => {
    setForm({
      name:             t.name,
      subjectCode:      t.subject?.code || "",
      subject:          t.subject?.name || "",
      year:             t.year,
      semester:         t.semester,
      examType:         t.examType,
      totalQuestions:   t.totalQuestions,
      totalScore:       t.totalScore,
    });
    setExamId(t.id);
    setSets(t.sets.map(s => ({
      ...s,
      previewUrl: "",
      selectedId: null,
      rectangles: s.boundingBoxes?.map(b => ({
        id:        b.id,
        x:         b.x,
        y:         b.y,
        w:         b.w,
        h:         b.h,
        isAnswer:  b.isAnswer,
        type:      b.type || 'answer',
        // ถอดรหัส encoded questionNumber กลับเป็น qNum + choiceIdx
        // encoded = (qNum-1)*choices + choiceIdx + 1
        // choices สำหรับ answer box = จำนวนตัวเลือก (default 5)
        qNum:      b.type === 'answer' || !b.type
          ? Math.ceil(b.questionNumber / 5)
          : b.type === 'set_number'
          ? b.questionNumber
          : undefined,
        choiceIdx: b.type === 'answer' || !b.type
          ? (b.questionNumber - 1) % 5
          : undefined,
      })) || [],
    })));
    setActiveSet(t.sets[0]?.id || null);
    setSaved(true);
    setDetected(t.sets[0]?.boundingBoxes?.some(b => b.isAnswer) || false);
    setAnswerPreview(null);
    imgRef.current = null;
  };

  const handleFormChange = (e) => setForm(p => ({...p, [e.target.name]: e.target.value}));
  const handleSubjectSelect = (e) => {
    const [code, ...rest] = e.target.value.split("|");
    setForm(p => ({...p, subjectCode:code, subject:rest.join("|")}));
  };
  const handleCreate = async () => {
    if (!form.name || !form.subject) return;
    setCreating(true);
    await new Promise(r => setTimeout(r, 400));
    setExamId(Date.now());
    setCreating(false);
    setSaved(false);
  };

  const addSet = () => {
    const s = { id:Date.now(), label:`ชุดที่ ${sets.length+1}`, fileName:"", previewUrl:"", rectangles:[], selectedId:null };
    setSets(p => [...p, s]);
    setActiveSet(s.id);
    setDetected(false);
    setAnswerPreview(null);
    imgRef.current = null;
  };
  const updateSet = (id, patch) => setSets(p => p.map(s => s.id===id ? {...s,...patch} : s));

  // ── Auto Grid ─────────────────────────────────────────────────────────────
  const [showGridModal, setShowGridModal] = useState(false);
  const [gridConfig, setGridConfig] = useState({
    questions: "", choices: "5", layout: "horizontal",
    zone: "answer", replaceAll: false, startQuestion: "1",
  });
  const gridConfigRef = useRef({ choices: "5" });
  useEffect(() => { gridConfigRef.current = gridConfig; }, [gridConfig]);

  const generateGrid = () => {
    if (!currentSet) return;
    const q      = parseInt(gridConfig.questions);
    const c      = parseInt(gridConfig.choices);
    const startQ = parseInt(gridConfig.startQuestion) || 1;
    if (!q || !c || q < 1 || c < 1) return;

    if (currentSet.selectedId == null) {
      alert('กรุณาวาดกรอบใหญ่คลุมพื้นที่ที่ต้องการ แล้วคลิกเลือกกรอบนั้นก่อนกด "แบ่ง Grid"');
      return;
    }

    const base = normalize(currentSet.rectangles.find(r => r.id === currentSet.selectedId));
    if (!base) return;

    const GAP = 1;
    const newBoxes = [];
    let idCounter = Date.now();

    if (gridConfig.layout === 'horizontal') {
      const cellW = (base.w - GAP * (c - 1)) / c;
      const cellH = (base.h - GAP * (q - 1)) / q;
      for (let row = 0; row < q; row++) {
        for (let col = 0; col < c; col++) {
          newBoxes.push({
            id: idCounter++,
            x:  base.x + col * (cellW + GAP),
            y:  base.y + row * (cellH + GAP),
            w:  cellW, h: cellH,
            type:      gridConfig.zone,
            qNum:      startQ + row,
            choiceIdx: col,
          });
        }
      }
    } else {
      const cellW = (base.w - GAP * (q - 1)) / q;
      const cellH = (base.h - GAP * (c - 1)) / c;
      for (let col = 0; col < q; col++) {
        for (let row = 0; row < c; row++) {
          newBoxes.push({
            id: idCounter++,
            x:  base.x + col * (cellW + GAP),
            y:  base.y + row * (cellH + GAP),
            w:  cellW, h: cellH,
            type:      gridConfig.zone,
            qNum:      startQ + col,
            choiceIdx: row,
          });
        }
      }
    }

    let baseRects;
    if (gridConfig.replaceAll) {
      baseRects = currentSet.rectangles.filter(
        r => r.id !== currentSet.selectedId && r.type !== gridConfig.zone
      );
    } else {
      baseRects = currentSet.rectangles.filter(r => r.id !== currentSet.selectedId);
    }

    updateSet(activeSet, {
      rectangles: [...baseRects, ...newBoxes],
      selectedId: null,
    });
    setShowGridModal(false);
  };

  const handleDeleteTemplate = async (id) => {
    if (!confirm('ต้องการลบ template นี้ออกหรือไม่?')) return;
    try {
      await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/templates/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
      });
      await getTemplates().then(setSavedTemplates);
      if (examId === id) handleNewExam();
    } catch {
      alert('ลบไม่สำเร็จ');
    }
  };

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    const aid  = activeSetRef.current;
    if (!file || !aid) return;
    imgRef.current = null;
    updateSet(aid, { fileName:file.name, previewUrl:URL.createObjectURL(file), rectangles:[], selectedId:null });
    setDetected(false);
    setAnswerPreview(null);
    e.target.value = "";
  };

  // ── FIX 1: handleDetectAnswer ─────────────────────────────────────────────
  // ใช้ qNum + choiceIdx ที่เก็บในกรอบโดยตรง encode เป็น questionNumber unique
  const handleDetectAnswer = async () => {
    if (!currentSet?.previewUrl || !currentSet?.rectangles?.length) return;
    setDetecting(true);
    try {
      const response = await fetch(currentSet.previewUrl);
      const blob     = await response.blob();
      const file     = new File([blob], currentSet.fileName || 'answer.jpg', { type: blob.type });

      // coordinate เป็น image space แล้ว ไม่ต้องแปลง
      const setNumberRects = currentSet.rectangles
        .filter(r => r.type === 'set_number')
        .sort((a, b) => a.y - b.y);
      const setNumQMap = new Map(setNumberRects.map((r, idx) => [r.id, idx + 1]));

      const choices = parseInt(gridConfigRef.current?.choices) || 5;
      let fallbackIdx = 0;
      const boundingBoxes = currentSet.rectangles.map((r) => {
        if (r.type === 'answer' || !r.type) fallbackIdx++;
        let qNumber = fallbackIdx;
        if ((r.type === 'answer' || !r.type) && r.qNum != null && r.choiceIdx != null) {
          qNumber = (r.qNum - 1) * choices + r.choiceIdx + 1;
        }
        let qNum = 0;
        if (r.type === 'answer' || !r.type) qNum = qNumber;
        else if (r.type === 'set_number') qNum = r.qNum ?? setNumQMap.get(r.id) ?? 0;
        else if (r.type === 'student_id') qNum = 0;
        return {
          questionNumber: qNum,
          x: r.x, y: r.y, w: r.w, h: r.h,
          isAnswer: false,
          type: r.type || 'answer',
        };
      });

      const result = await detectAnswerWithBoxes(file, boundingBoxes);
      setAnswerPreview(result.answer_key);
    } catch (err) {
      alert('ตรวจเฉลยไม่สำเร็จ: ' + err.message);
    } finally {
      setDetecting(false);
    }
  };

  const handleConfirmAnswer = () => {
    if (!answerPreview) return;
    const setIndex = sets.findIndex(s => s.id === activeSet);
    const keyWithIndex = answerPreview.map(box => ({ ...box, setIndex }));
    setConfirmedAnswerKey(prev => {
      const filtered = prev.filter(k => k.setIndex !== setIndex);
      return [...filtered, ...keyWithIndex];
    });
    setDetected(true);
    setAnswerPreview(null);
  };

  const drawAll = useCallback((rects, selId, img, preview = null) => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0,0,canvas.width,canvas.height);
    let sc=1, offX=0, offY=0;
    if (img) {
      sc = Math.min(canvas.width/img.width, canvas.height/img.height);
      offX = (canvas.width-img.width*sc)/2;
      offY = (canvas.height-img.height*sc)/2;
      ctx.drawImage(img, offX, offY, img.width*sc, img.height*sc);
    }

    // แปลง image coordinate → canvas coordinate
    const toCanvas = (x, y, w, h) => ({
      x: x*sc + offX,
      y: y*sc + offY,
      w: w*sc,
      h: h*sc,
    });

    const TYPE_COLORS = {
      answer:     { stroke: "#a5b4fc", fill: "rgba(165,180,252,0.04)", sel: "#6366f1", selFill: "rgba(99,102,241,0.10)" },
      student_id: { stroke: "#60a5fa", fill: "rgba(96,165,250,0.04)",  sel: "#2563eb", selFill: "rgba(37,99,235,0.10)"  },
      set_number: { stroke: "#f59e0b", fill: "rgba(245,158,11,0.04)",  sel: "#d97706", selFill: "rgba(217,119,6,0.10)"  },
    };

    const CHOICE_LABELS = ['ก','ข','ค','ง','จ','ฉ','ช','ซ','ฌ','ญ'];
    const choices = parseInt(gridConfigRef.current?.choices) || 5;

    // สร้าง map: encoded questionNumber → rect (เหมือนใน handleDetectAnswer)
    let fallbackIdx = 0;
    const encodedMap = {};
    rects.forEach(r => {
      if (!r.type || r.type === 'answer') {
        fallbackIdx++;
        let qNumber = fallbackIdx;
        if (r.qNum != null && r.choiceIdx != null) {
          qNumber = (r.qNum - 1) * choices + r.choiceIdx + 1;
        }
        encodedMap[r.id] = qNumber;
      }
    });

    rects.forEach((rect) => {
      const ni  = normalize(rect);
      const n   = toCanvas(ni.x, ni.y, ni.w, ni.h);
      const sel = rect.id === selId;
      const tc  = TYPE_COLORS[rect.type] || TYPE_COLORS.answer;

      let strokeColor = sel ? tc.sel : tc.stroke;
      let fillColor   = sel ? tc.selFill : tc.fill;
      let labelText   = rect.type === 'student_id' ? 'ID' : rect.type === 'set_number' ? 'ชุด' : '';

      if (!rect.type || rect.type === 'answer') {
        const choiceIdx = rect.choiceIdx != null ? rect.choiceIdx : (encodedMap[rect.id] - 1) % choices;
        labelText = CHOICE_LABELS[choiceIdx] ?? String(choiceIdx + 1);

        if (preview && preview.length > 0) {
          const encodedQ = encodedMap[rect.id];
          const previewBox = preview.find(p => p.questionNumber === encodedQ);
          if (previewBox) {
            strokeColor = previewBox.isAnswer ? "#10b981" : "#fca5a5";
            fillColor   = previewBox.isAnswer ? "rgba(16,185,129,0.22)" : "rgba(252,165,165,0.07)";
          }
        }
      }

      ctx.strokeStyle = strokeColor;
      ctx.lineWidth   = sel ? 2 : 1;
      ctx.setLineDash(sel ? [] : (rect.type && rect.type !== 'answer' ? [4,2] : []));
      ctx.strokeRect(n.x, n.y, n.w, n.h);
      ctx.setLineDash([]);
      ctx.fillStyle = fillColor;
      ctx.fillRect(n.x, n.y, n.w, n.h);

      if (sel) Object.values(getHandles(n)).forEach(({x,y}) => {
        ctx.fillStyle="#fff"; ctx.strokeStyle=tc.sel; ctx.lineWidth=1.5;
        ctx.beginPath(); ctx.rect(x-HANDLE_SIZE/2,y-HANDLE_SIZE/2,HANDLE_SIZE,HANDLE_SIZE); ctx.fill(); ctx.stroke();
      });

      if (labelText && n.w > 8 && n.h > 7) {
        const fontSize = Math.min(Math.max(n.h * 0.55, 7), 11);
        ctx.font = `bold ${fontSize}px sans-serif`;
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle    = strokeColor;
        ctx.fillText(labelText, n.x + n.w / 2, n.y + n.h / 2);
        ctx.textAlign    = 'left';
        ctx.textBaseline = 'alphabetic';
      }
    });
  }, []);

  useEffect(() => {
    if (!currentSet?.previewUrl) return;
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      const c=canvasRef.current, co=containerRef.current; if(!c||!co) return;
      c.width=co.clientWidth; c.height=co.clientHeight;
      // บันทึก scale ของ set นี้ใน scaleMapRef และ set state
      const sc = Math.min(c.width / img.width, c.height / img.height);
      const scaleData = {
        scaleX: sc, scaleY: sc,
        offsetX: (c.width - img.width * sc) / 2,
        offsetY: (c.height - img.height * sc) / 2,
      };
      scaleMapRef.current[activeSet] = scaleData;
      // เก็บ scale ใน set state ด้วย
      updateSet(activeSet, { scale: scaleData });
      drawAll(currentSet.rectangles, currentSet.selectedId, img, answerPreview);
    };
    img.src = currentSet.previewUrl;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSet?.id, currentSet?.previewUrl]);

  useEffect(() => {
    if (currentSet) drawAll(currentSet.rectangles, currentSet.selectedId, imgRef.current, answerPreview);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSet?.rectangles, currentSet?.selectedId, answerPreview]);

  const getPos = (e) => {
    const r=canvasRef.current.getBoundingClientRect();
    const canvasX = (e.touches?e.touches[0].clientX:e.clientX)-r.left;
    const canvasY = (e.touches?e.touches[0].clientY:e.clientY)-r.top;
    // แปลงเป็น image coordinate โดยตรง
    const img = imgRef.current;
    const canvas = canvasRef.current;
    if (img && canvas) {
      const sc = Math.min(canvas.width/img.width, canvas.height/img.height);
      const offX = (canvas.width - img.width*sc)/2;
      const offY = (canvas.height - img.height*sc)/2;
      return { x: (canvasX-offX)/sc, y: (canvasY-offY)/sc };
    }
    return { x: canvasX, y: canvasY };
  };

  const handlePDown = (e) => {
    if (!currentSet) return; e.preventDefault();
    const pos=getPos(e), {rectangles:rects,selectedId:selId}=stateRef.current;
    if (selId!=null) {
      const sel=rects.find(r=>r.id===selId);
      if (sel) {
        const n=normalize(sel), h=hitHandle(pos,getHandles(n));
        if(h){interactionRef.current={type:'resize',id:selId,handle:h,lastPos:pos};return;}
        if(isInside(pos,n)){interactionRef.current={type:'move',id:selId,lastPos:pos};return;}
      }
    }
    for(let i=rects.length-1;i>=0;i--){
      if(isInside(pos,normalize(rects[i]))){
        updateSet(activeSet,{selectedId:rects[i].id});
        interactionRef.current={type:'move',id:rects[i].id,lastPos:pos}; return;
      }
    }
    updateSet(activeSet,{selectedId:null});
    const nid=nextId++;
    interactionRef.current={type:'draw',id:nid};
    updateSet(activeSet,{rectangles:[...(currentSet?.rectangles||[]),{id:nid,x:pos.x,y:pos.y,w:0,h:0,type:'answer'}]});
  };

  const handlePMove = (e) => {
    e.preventDefault();
    const ia=interactionRef.current;
    if(!ia||!currentSet){updateCursor(e);return;}
    const pos=getPos(e);
    if(ia.type==='draw')
      updateSet(activeSet,{rectangles:currentSet.rectangles.map(r=>r.id===ia.id?{...r,w:pos.x-r.x,h:pos.y-r.y}:r)});
    else if(ia.type==='move'){
      const dx=pos.x-ia.lastPos.x,dy=pos.y-ia.lastPos.y; ia.lastPos=pos;
      updateSet(activeSet,{rectangles:currentSet.rectangles.map(r=>r.id===ia.id?{...r,x:r.x+dx,y:r.y+dy}:r)});
    } else if(ia.type==='resize'){
      const dx=pos.x-ia.lastPos.x,dy=pos.y-ia.lastPos.y; ia.lastPos=pos;
      updateSet(activeSet,{rectangles:currentSet.rectangles.map(r=>r.id===ia.id?resizeR(r,ia.handle,{x:dx,y:dy}):r)});
    }
  };

  const handlePUp = () => {
    const ia=interactionRef.current; if(!ia||!currentSet) return;
    if(ia.type==='draw'){
      const rect=currentSet.rectangles.find(r=>r.id===ia.id);
      const cleaned=(Math.abs(rect?.w||0)<5&&Math.abs(rect?.h||0)<5)
        ? currentSet.rectangles.filter(r=>r.id!==ia.id)
        : currentSet.rectangles.map(r=>r.id===ia.id?normalize(r):r);
      updateSet(activeSet,{rectangles:cleaned,selectedId:ia.id});
    } else if(ia.type==='resize')
      updateSet(activeSet,{rectangles:currentSet.rectangles.map(r=>r.id===ia.id?normalize(r):r)});
    interactionRef.current=null;
  };

  const updateCursor = (e) => {
    const canvas=canvasRef.current; if(!canvas) return;
    const pos=getPos(e), {rectangles:rects,selectedId:selId}=stateRef.current;
    if(selId!=null){
      const sel=rects.find(r=>r.id===selId);
      if(sel){const h=hitHandle(pos,getHandles(normalize(sel)));if(h){canvas.style.cursor=cursorMap[h]||'default';return;}}
    }
    for(let i=rects.length-1;i>=0;i--) if(isInside(pos,normalize(rects[i]))){canvas.style.cursor='move';return;}
    canvas.style.cursor='crosshair';
  };

  useEffect(() => {
    const onKey=(e)=>{
      if(e.key==='Delete'||e.key==='Backspace'){
        if(['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)) return;
        if(currentSet?.selectedId!=null)
          updateSet(activeSet,{rectangles:currentSet.rectangles.filter(r=>r.id!==currentSet.selectedId),selectedId:null});
      }
      if(e.key==='Escape'&&currentSet) updateSet(activeSet,{selectedId:null});
    };
    window.addEventListener('keydown',onKey);
    return ()=>window.removeEventListener('keydown',onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSet,activeSet]);

  const canSave = !locked && sets.length>0 && sets.some(s=>s.rectangles.length>0) && detected;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const result = await saveTemplate({
        id:               examId ? String(examId) : undefined,
        examName:         form.name,
        subjectCode:      form.subjectCode,
        subjectName:      form.subject,
        subjectId:        subjects.find(s => s.name === form.subject)?.id,
        year:             form.year,
        semester:         form.semester,
        examType:         form.examType,
        totalQuestions:   form.totalQuestions,
        totalScore:       form.totalScore,
        sets: sets.map((s, i) => {
          // coordinate ถูกเก็บเป็น image space แล้วตั้งแต่วาด ไม่ต้องแปลงอีก
          return {
            id:         String(s.id),
            label:      s.label,
            order:      i + 1,
            choices:    parseInt(gridConfigRef.current?.choices) || 5,
            rectangles: s.rectangles.map(r => ({
              ...r,
              type: r.type || 'answer',
            })),
          };
        }),
      });

      const savedTemplateId = result.id;
      if (savedTemplateId) setExamId(savedTemplateId);

      if (confirmedAnswerKey.length > 0) {
        const freshTemplates = await getTemplates();
        const savedTemplate  = freshTemplates.find((t) => t.id === savedTemplateId);
        if (savedTemplate) {
          for (let i = 0; i < sets.length; i++) {
            const dbSet = savedTemplate.sets[i];
            if (!dbSet) continue;
            const setAnswerKey = confirmedAnswerKey.filter(k => k.setIndex === i);
            if (setAnswerKey.length === 0) continue;
            await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/templates/confirm-answer`, {
              method:  'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
              },
              body: JSON.stringify({ setId: dbSet.id, answerKey: setAnswerKey }),
            });
          }
        }
        setConfirmedAnswerKey([]);
      }

      await getTemplates().then(setSavedTemplates);
      setSaved(true);
    } catch (err) {
      alert('บันทึกไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
    <div className="px-4 sm:px-8 lg:px-20 min-h-screen py-6 flex flex-col gap-5">

      {/* Templates */}
      <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden" style={{ boxShadow:"0 4px 20px rgba(99,102,241,0.07)" }}>
        <div className="h-1.5 w-full rounded-t-3xl" style={{ background:"linear-gradient(90deg,#6366f1,#8b5cf6,#06b6d4)" }}/>
        <div className="p-4 sm:p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-800">Template ที่บันทึกไว้</h2>
              <p className="text-xs text-slate-400 mt-0.5">คลิกเพื่อแก้ไข หรือสร้างใหม่</p>
            </div>
            <button onClick={handleNewExam}
              className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold px-3 sm:px-4 py-2 rounded-xl text-white transition-all shadow-sm hover:shadow-md"
              style={{ background:"linear-gradient(135deg,#6366f1,#8b5cf6)" }}>
              <Plus size={14}/> สร้างใหม่
            </button>
          </div>
          {savedTemplates.length === 0 ? (
            <div className="border-2 border-dashed border-slate-200 rounded-2xl py-8 flex flex-col items-center gap-2 text-slate-300">
              <FileText size={28}/>
              <p className="text-sm text-center px-4">ยังไม่มี template — กรอกข้อมูลด้านล่างแล้วบันทึก</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {savedTemplates.map(t => (
                <TemplateCard key={t.id} template={t} isActive={examId === t.id} onEdit={() => handleEditTemplate(t)} onDelete={() => handleDeleteTemplate(t.id)} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Editor */}
      <div className="flex flex-col lg:flex-row gap-5 items-start">

        {/* LEFT — Form */}
        <div className="w-full lg:w-96 lg:shrink-0">
          <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden lg:sticky lg:top-24" style={{ boxShadow:"0 8px 32px rgba(99,102,241,0.09)" }}>
            <div className="h-1.5 w-full rounded-t-3xl" style={{ background:"linear-gradient(90deg,#6366f1,#8b5cf6,#06b6d4)" }}/>
            <div className="p-5 space-y-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${examId?"bg-emerald-100 text-emerald-600":"bg-indigo-100 text-indigo-600"}`}>
                    {examId ? <CheckCircle2 size={14}/> : "1"}
                  </span>
                  <span className="text-sm font-semibold text-slate-700">{examId ? "ข้อมูลชุดข้อสอบ" : "สร้างชุดข้อสอบ"}</span>
                </div>
                {examId && (
                  <button onClick={handleNewExam} className="text-xs flex items-center gap-1 text-indigo-500 hover:text-indigo-700 border border-indigo-200 hover:border-indigo-400 px-2.5 py-1 rounded-lg transition-all">
                    <Plus size={11}/> ใหม่
                  </button>
                )}
              </div>
              {examId && (
                <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
                  <CheckCircle2 size={14} className="text-emerald-500 shrink-0"/>
                  <span className="text-xs text-emerald-700 font-medium">ปลดล็อกแล้ว — วาดกรอบและตรวจเฉลย</span>
                </div>
              )}
              <div>
                <label className="text-xs font-semibold text-slate-600">ชื่อชุดข้อสอบ</label>
                <input name="name" value={form.name} onChange={handleFormChange} disabled={!!examId} placeholder="เช่น สอบกลางภาค ครั้งที่ 1" className={inputCls}/>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">รายวิชา</label>
                <select onChange={handleSubjectSelect} disabled={!!examId} value={form.subjectCode && form.subject ? `${form.subjectCode}|${form.subject}` : ""} className={inputCls}>
                  <option value="" disabled>เลือกรายวิชา...</option>
                  {Array.from(new Map(subjects.map(s => [`${s.code}|${s.name}`, s])).values()).map(s=>(
                    <option key={s.id} value={`${s.code}|${s.name}`}>{s.code} — {s.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-slate-600">ปีการศึกษา</label>
                  <select name="year" value={form.year} onChange={handleFormChange} disabled={!!examId} className={inputCls}>
                    <option value="" disabled>เลือกปี...</option>
                    {["2569","2568","2567","2566","2565"].map(y=><option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">ภาคเรียน</label>
                  <select name="semester" value={form.semester} onChange={handleFormChange} disabled={!!examId} className={inputCls}>
                    <option>ภาคเรียนที่ 1</option><option>ภาคเรียนที่ 2</option><option>ภาคฤดูร้อน</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600">รูปแบบข้อสอบ</label>
                <select name="examType" value={form.examType} onChange={handleFormChange} disabled={!!examId} className={inputCls}>
                  <option>ฝนคำตอบ</option><option>กาเครื่องหมาย</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[["totalQuestions","จำนวนข้อ","50"],["totalScore","คะแนนเต็ม","100"]].map(([n,l,ph])=>(
                  <div key={n}>
                    <label className="text-xs font-semibold text-slate-600">{l}</label>
                    <input type="number" name={n} value={form[n]} onChange={handleFormChange} disabled={!!examId} placeholder={ph} className={inputCls}/>
                  </div>
                ))}
              </div>
              {!examId && (
                <button onClick={handleCreate} disabled={creating||!form.name||!form.subject}
                  className="w-full py-3 rounded-2xl text-white text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  style={{ background:"linear-gradient(135deg,#6366f1,#8b5cf6)" }}>
                  {creating?"กำลังสร้าง...":(<>สร้างชุดข้อสอบ <ChevronRight size={16}/></>)}
                </button>
              )}
              {examId && (
                <div className="pt-2 border-t border-slate-100 space-y-2">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">ขั้นตอน</p>
                  {[
                    [sets.some(s=>s.rectangles.length>0), "วาดกรอบคำตอบ"],
                    [detected, "ตรวจและยืนยันเฉลย"],
                    [saved, "บันทึก Template"],
                  ].map(([done, label], i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${done ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-400"}`}>
                        {done ? "✓" : i+1}
                      </span>
                      <span className={done ? "text-emerald-700" : "text-slate-500"}>{label}</span>
                    </div>
                  ))}
                </div>
              )}
              {examId && saved && detected && (
                <div className="pt-2 border-t border-slate-100">
                  <p className="text-xs text-slate-400 mb-2 text-center">ต้องการเพิ่มวิชาอื่นต่อไปหรือไม่?</p>
                  <button onClick={handleNewExam} className="w-full py-3 rounded-2xl text-sm font-semibold transition-all flex items-center justify-center gap-2 border-2 border-indigo-300 text-indigo-600 hover:bg-indigo-50 hover:border-indigo-500">
                    <Plus size={15}/> สร้างชุดข้อสอบใหม่
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT — Canvas */}
        <div className="w-full lg:flex-1 min-w-0">
          <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden transition-all duration-300"
            style={{ boxShadow:locked?"none":"0 8px 32px rgba(99,102,241,0.09)", opacity:locked?0.55:1 }}>
            <div className="h-1.5 w-full" style={{ background:locked?"#e2e8f0":"linear-gradient(90deg,#6366f1,#8b5cf6,#06b6d4)" }} className="h-1.5 w-full rounded-t-3xl"/>
            <div className="p-4 sm:p-6">
              <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${locked?"bg-slate-100 text-slate-400":saved&&detected?"bg-emerald-100 text-emerald-600":"bg-indigo-100 text-indigo-600"}`}>
                    {locked ? <Lock size={12}/> : saved && detected ? <CheckCircle2 size={14}/> : "2"}
                  </span>
                  <div>
                    <h2 className="text-sm font-semibold text-slate-800">กำหนดกรอบคำตอบ</h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {locked ? "กรอกข้อมูลด้านซ้ายให้ครบก่อน" : !detected ? "วาดกรอบ → ตรวจเฉลย → ยืนยัน → บันทึก" : "ตรวจและยืนยันเฉลยแล้ว พร้อมบันทึก"}
                    </p>
                  </div>
                </div>
                {!locked && (
                  <div className="flex items-center gap-2 flex-wrap">
                    {currentSet?.previewUrl && currentSet?.rectangles?.length > 0 && (
                      <button onClick={handleDetectAnswer} disabled={detecting}
                        className="flex items-center gap-1.5 text-xs px-3.5 py-2.5 rounded-2xl font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed text-white"
                        style={{ background: detected ? "linear-gradient(135deg,#10b981,#059669)" : "linear-gradient(135deg,#f59e0b,#d97706)" }}>
                        <Scan size={13}/>
                        {detecting ? "กำลังตรวจ..." : detected ? "ตรวจเฉลยแล้ว ✓" : "ตรวจเฉลยอัตโนมัติ"}
                      </button>
                    )}
                    <button onClick={handleSave} disabled={saving || !canSave}
                      className="flex items-center gap-2 text-white text-sm px-5 py-2.5 rounded-2xl transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow"
                      style={{ background: saved && detected ? "linear-gradient(135deg,#10b981,#059669)" : "linear-gradient(135deg,#6366f1,#8b5cf6)" }}>
                      {saving ? "กำลังบันทึก..." : saved && detected ? (<><CheckCircle2 size={15}/> บันทึกแล้ว</>) : (<><Save size={15}/> บันทึก Template</>)}
                    </button>
                  </div>
                )}
              </div>

              {locked && (
                <div className="border-2 border-dashed border-slate-200 rounded-3xl h-[280px] sm:h-[380px] flex flex-col items-center justify-center gap-3">
                  <div className="bg-slate-100 p-5 rounded-full"><Lock className="text-slate-300 w-8 h-8"/></div>
                  <p className="text-sm text-slate-400 text-center">กรอกข้อมูลด้านซ้ายให้ครบ<br/>แล้วกด <span className="font-semibold text-slate-500">สร้างชุดข้อสอบ</span></p>
                </div>
              )}

              {!locked && (
                <>
                  <div className="flex items-center gap-2 mb-5 flex-wrap">
                    {sets.map(s=>(
                      <button key={s.id}
                        onClick={()=>{setActiveSet(s.id);imgRef.current=null;setDetected(false);setAnswerPreview(null);}}
                        className={`text-xs px-3.5 py-1.5 rounded-xl font-medium border transition-all ${activeSet===s.id?"bg-indigo-600 text-white border-indigo-600":"bg-white text-slate-500 border-slate-200 hover:border-indigo-300"}`}>
                        {s.label}{s.rectangles.length>0&&<span className="ml-1.5 opacity-70">{s.rectangles.length} กรอบ</span>}
                      </button>
                    ))}
                    <button onClick={addSet} disabled={sets.length>=4}
                      className="text-xs px-3.5 py-1.5 rounded-xl font-medium border border-dashed border-slate-300 text-slate-400 hover:border-indigo-300 hover:text-indigo-500 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                      + เพิ่มชุด
                    </button>
                    <span className="text-xs text-slate-400">(สูงสุด 4 ชุด)</span>
                  </div>

                  {!currentSet && (
                    <div className="border-2 border-dashed border-slate-200 rounded-3xl h-[280px] sm:h-[360px] flex flex-col items-center justify-center gap-4">
                      <div className="bg-slate-50 p-5 rounded-full"><FileText className="text-slate-300 w-10 h-10"/></div>
                      <p className="text-sm text-slate-400">กด <span className="font-semibold text-indigo-500">+ เพิ่มชุด</span> เพื่อเริ่ม</p>
                    </div>
                  )}

                  {currentSet && (
                    <>
                      {currentSet.rectangles.length>0&&(
                        <div className="flex items-center gap-2 mb-3 flex-wrap">
                          <span className="text-xs text-indigo-500 font-medium bg-indigo-50 px-3 py-1 rounded-full">{currentSet.rectangles.length} กรอบ</span>

                          {currentSet.selectedId != null && (
                            <button
                              onClick={() => {
                                const existingQNums = currentSet?.rectangles?.filter(r=>r.type==='answer'||!r.type)?.map(r=>r.qNum)?.filter(Boolean)||[];
                                const nextStart = existingQNums.length>0 ? Math.max(...existingQNums)+1 : 1;
                                setGridConfig(g => ({ ...g, questions:"10", startQuestion:String(nextStart) }));
                                setShowGridModal(true);
                              }}
                              className="flex items-center gap-1.5 text-xs px-3 py-1 rounded-full border border-purple-200 bg-purple-50 text-purple-600 hover:bg-purple-100 transition-all font-medium">
                              <Grid size={11}/> แบ่ง Grid อัตโนมัติ
                            </button>
                          )}

                          {currentSet.selectedId != null && (() => {
                            const sel = currentSet.rectangles.find(r => r.id === currentSet.selectedId);
                            if (!sel) return null;
                            const types = [
                              { value: 'answer',     label: 'คำตอบ',     color: 'bg-indigo-50 text-indigo-600 border-indigo-200' },
                              { value: 'student_id', label: 'เลขนิสิต',  color: 'bg-blue-50 text-blue-600 border-blue-200' },
                              { value: 'set_number', label: 'ชุดข้อสอบ', color: 'bg-amber-50 text-amber-600 border-amber-200' },
                            ];
                            return (
                              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2 py-1">
                                <span className="text-xs text-slate-400 mr-1">ประเภท:</span>
                                {types.map(t => (
                                  <button key={t.value}
                                    onClick={() => updateSet(activeSet, { rectangles: currentSet.rectangles.map(r => r.id===currentSet.selectedId ? {...r,type:t.value} : r) })}
                                    className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-all ${sel.type===t.value ? t.color : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'}`}>
                                    {t.label}
                                  </button>
                                ))}
                              </div>
                            );
                          })()}

                          {currentSet.selectedId!=null&&(
                            <button onClick={()=>updateSet(activeSet,{rectangles:currentSet.rectangles.filter(r=>r.id!==currentSet.selectedId),selectedId:null})}
                              className="flex items-center gap-1 text-xs text-red-500 border border-red-200 bg-red-50 hover:bg-red-100 px-3 py-1 rounded-full transition-all">
                              <Trash2 size={11}/> ลบที่เลือก
                            </button>
                          )}
                          <button onClick={()=>updateSet(activeSet,{rectangles:[],selectedId:null})}
                            className="text-xs text-slate-400 hover:text-red-400 border border-slate-200 hover:border-red-200 px-3 py-1 rounded-full transition-all">
                            ล้างทั้งหมด
                          </button>
                          <div className="flex items-center gap-2 ml-auto flex-wrap">
                            {[['border-indigo-400 bg-indigo-50','คำตอบ'],['border-blue-400 bg-blue-50','เลขนิสิต'],['border-amber-400 bg-amber-50','ชุดข้อสอบ']].map(([cls,label])=>(
                              <span key={label} className="flex items-center gap-1 text-xs text-slate-400">
                                <span className={`w-3 h-3 rounded border-2 ${cls} inline-block`}/>{label}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* FIX 2: Preview panel — ใช้ qnMap จาก rectangles ถอดรหัส questionNumber กลับ */}
                      {answerPreview && (() => {
                        const choices       = parseInt(gridConfigRef.current?.choices) || 5;
                        const CHOICE_LABELS = ['ก','ข','ค','ง','จ','ฉ','ช','ซ','ฌ','ญ'];

                        // สร้าง map: encoded questionNumber → { qNum, choiceIdx }
                        const qnMap = {};
                        let fallbackIdx = 0;
                        currentSet?.rectangles?.forEach(r => {
                          if (r.type === 'answer' || !r.type) {
                            fallbackIdx++;
                            let qNumber = fallbackIdx;
                            if (r.qNum != null && r.choiceIdx != null) {
                              qNumber = (r.qNum - 1) * choices + r.choiceIdx + 1;
                            }
                            qnMap[qNumber] = {
                              qNum:      r.qNum      ?? fallbackIdx,
                              choiceIdx: r.choiceIdx ?? (fallbackIdx - 1) % choices,
                            };
                          }
                        });

                        const questionMap = {};
                        answerPreview.forEach(box => {
                          if (box.type === 'student_id' || box.type === 'set_number') return;
                          const info = qnMap[box.questionNumber];
                          if (!info) return;
                          const { qNum, choiceIdx } = info;
                          if (!questionMap[qNum]) questionMap[qNum] = { filled: null };
                          if (box.isAnswer) questionMap[qNum].filled = choiceIdx;
                        });

                        const totalQ  = Object.keys(questionMap).length;
                        const filledQ = Object.values(questionMap).filter(q => q.filled !== null).length;
                        const studentBoxes = answerPreview.filter(b=>b.type==='student_id'&&b.isAnswer).sort((a,b)=>a.questionNumber-b.questionNumber);

                        return (
                          <div className="mb-4 bg-slate-50 border border-slate-200 rounded-2xl p-4">
                            <p className="text-xs font-semibold text-slate-700 mb-1">ผลการตรวจเฉลย</p>
                            <p className="text-xs text-slate-400 mb-3">กรอบสีเขียว = ฝนแล้ว · ตรวจสอบบน canvas แล้วยืนยัน</p>

                            {studentBoxes.length > 0 && (
                              <div className="flex items-center gap-2 mb-3 bg-blue-50 border border-blue-200 rounded-xl px-3 py-2">
                                <span className="text-xs font-semibold text-blue-600">เลขที่:</span>
                                <span className="text-sm font-bold text-blue-700 tracking-widest">
                                  {studentBoxes.map(b=>(b.questionNumber-1)%10).join('')}
                                </span>
                              </div>
                            )}

                            <div className="flex flex-wrap gap-1.5 mb-3 max-h-40 overflow-y-auto">
                              {Object.entries(questionMap).sort((a,b)=>Number(a[0])-Number(b[0])).map(([qNum,{filled}])=>(
                                <span key={qNum} className={`text-xs px-2 py-0.5 rounded-full font-medium ${filled!==null ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-400 border border-slate-200'}`}>
                                  {filled!==null ? `ข้อ ${qNum} = ${CHOICE_LABELS[filled]??filled+1}` : `ข้อ ${qNum} ไม่ได้ฝน`}
                                </span>
                              ))}
                            </div>

                            <div className="flex items-center gap-3 text-xs text-slate-500 mb-3">
                              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0"/>ฝนแล้ว {filledQ} / {totalQ} ข้อ</span>
                              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-slate-300 shrink-0"/>ไม่ได้ฝน {totalQ-filledQ} ข้อ</span>
                            </div>

                            <div className="flex gap-2">
                              <button onClick={()=>{setAnswerPreview(null);setDetecting(false);}}
                                className="flex-1 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-500 hover:bg-slate-100 transition-colors">ตรวจใหม่</button>
                              <button onClick={handleConfirmAnswer}
                                className="flex-1 py-2 rounded-xl text-xs font-semibold text-white transition-colors"
                                style={{ background:"linear-gradient(135deg,#10b981,#059669)" }}>ยืนยันเฉลย ✓</button>
                            </div>
                          </div>
                        );
                      })()}

                      <div ref={containerRef}
                        className="border-2 border-dashed border-indigo-200 rounded-3xl h-[360px] sm:h-[520px] flex flex-col items-center justify-center relative overflow-hidden hover:border-indigo-300 hover:bg-indigo-50/20 transition-all">
                        {!currentSet.previewUrl&&(
                          <div className="flex flex-col items-center gap-3 pointer-events-none">
                            <div className="bg-indigo-50 p-5 rounded-full"><FileText className="text-indigo-400 w-10 h-10"/></div>
                            <p className="text-sm font-semibold text-slate-700">อัปโหลดกระดาษเฉลย</p>
                            <p className="text-xs text-slate-400">รองรับ JPG, PNG</p>
                          </div>
                        )}
                        {currentSet.previewUrl&&(
                          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" style={{cursor:"crosshair"}}
                            onMouseDown={handlePDown} onMouseMove={handlePMove} onMouseUp={handlePUp}
                            onTouchStart={handlePDown} onTouchMove={handlePMove} onTouchEnd={handlePUp}/>
                        )}
                        {currentSet.fileName&&(
                          <div className="absolute bottom-20 left-1/2 -translate-x-1/2 text-xs text-indigo-600 font-medium bg-white px-3 py-1.5 rounded-xl shadow pointer-events-none">
                            {currentSet.fileName}
                          </div>
                        )}
                        <div className="absolute bottom-5 flex gap-3 z-20">
                          <button onClick={()=>fileInputRef.current?.click()} className="bg-indigo-500 hover:bg-indigo-600 text-white px-5 py-2.5 rounded-2xl flex items-center gap-2 text-sm shadow-md transition-all">
                            <Upload size={16}/> เลือกไฟล์
                          </button>
                          <button onClick={()=>cameraRef.current?.click()} className="border border-indigo-200 bg-white hover:border-indigo-400 text-indigo-600 px-5 py-2.5 rounded-2xl flex items-center gap-2 text-sm transition-all">
                            <Camera size={16}/> เปิดกล้อง
                          </button>
                        </div>
                        <input type="file" accept=".jpg,.jpeg,.png" ref={fileInputRef} onChange={handleFile} className="hidden"/>
                        <input type="file" accept="image/*" capture="environment" ref={cameraRef} onChange={handleFile} className="hidden"/>
                      </div>
                      <p className="text-xs text-slate-400 mt-3 text-center">
                        ลากเพื่อวาดกรอบ · คลิกกรอบเพื่อเลือก · ลาก handle เพื่อปรับขนาด · กด Delete เพื่อลบ
                      </p>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>

    {/* Auto Grid Modal */}
    {showGridModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center px-4"
        style={{ background:"rgba(15,23,42,0.45)", backdropFilter:"blur(4px)" }}>
        <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl">
          <div className="h-1.5 w-full rounded-t-3xl" style={{ background:"linear-gradient(90deg,#7c3aed,#6366f1,#06b6d4)" }}/>
          <div className="p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-purple-50 flex items-center justify-center"><Grid size={16} className="text-purple-600"/></div>
                <div>
                  <h2 className="text-sm font-semibold text-slate-800">แบ่ง Grid อัตโนมัติ</h2>
                  <p className="text-xs text-slate-400 mt-0.5">ระบบจะแบ่งกรอบที่เลือกเป็น grid ย่อย</p>
                </div>
              </div>
              <button onClick={()=>setShowGridModal(false)} className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:bg-slate-100"><X size={16}/></button>
            </div>

            <div className="bg-purple-50 border border-purple-100 rounded-xl px-3.5 py-3 mb-5 text-xs text-purple-700 leading-relaxed">
              <strong>วิธีใช้:</strong> วาดกรอบใหญ่คลุมพื้นที่ → คลิกเลือกกรอบ → กด "แบ่ง Grid" → ระบบแบ่งให้อัตโนมัติ
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-2">ประเภทกรอบ</label>
                <div className="flex gap-2">
                  {[['answer','คำตอบ','border-indigo-300 bg-indigo-50 text-indigo-700'],['student_id','เลขนิสิต','border-blue-300 bg-blue-50 text-blue-700'],['set_number','ชุดข้อสอบ','border-amber-300 bg-amber-50 text-amber-700']].map(([v,l,cls])=>(
                    <button key={v} onClick={()=>setGridConfig(g=>({...g,zone:v}))}
                      className={`flex-1 py-2 rounded-xl text-xs font-medium border transition-all ${gridConfig.zone===v ? cls : 'border-slate-200 bg-white text-slate-400 hover:border-slate-300'}`}>{l}</button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1.5">เริ่มที่ข้อ</label>
                  <input type="number" min="1" value={gridConfig.startQuestion}
                    onChange={e=>setGridConfig(g=>({...g,startQuestion:e.target.value}))}
                    className="w-full border border-indigo-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-200 bg-indigo-50 font-semibold text-slate-800"/>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1.5">
                    {gridConfig.zone==='answer'?'จำนวนข้อ':gridConfig.zone==='student_id'?'จำนวนหลัก':'จำนวนชุด'}
                  </label>
                  <input type="number" min="1" max="200" value={gridConfig.questions}
                    onChange={e=>setGridConfig(g=>({...g,questions:e.target.value}))}
                    placeholder="10"
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-200 bg-slate-50 text-slate-800"/>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1.5">
                    {gridConfig.zone==='answer'?'ตัวเลือก':gridConfig.zone==='student_id'?'ตัวเลข':'ตัวเลือก'}
                  </label>
                  <input type="number" min="1" max="26" value={gridConfig.choices}
                    onChange={e=>setGridConfig(g=>({...g,choices:e.target.value}))}
                    placeholder="5"
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-200 bg-slate-50 text-slate-800"/>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-2">เรียงแบบ</label>
                <div className="grid grid-cols-2 gap-2">
                  {[['horizontal','แนวนอน','ข้อ = แถว · ตัวเลือก = คอลัมน์'],['vertical','แนวตั้ง','ข้อ = คอลัมน์ · ตัวเลือก = แถว']].map(([v,l,sub])=>(
                    <button key={v} onClick={()=>setGridConfig(g=>({...g,layout:v}))}
                      className={`py-3 rounded-xl text-xs border transition-all ${gridConfig.layout===v ? 'border-purple-300 bg-purple-50 text-purple-700 font-semibold' : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'}`}>
                      {l}<div className="text-slate-400 font-normal mt-0.5">{sub}</div>
                    </button>
                  ))}
                </div>
              </div>

              {gridConfig.questions && gridConfig.choices && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-600 text-center">
                  จะสร้าง <span className="font-bold text-purple-600 text-sm">{parseInt(gridConfig.questions)*parseInt(gridConfig.choices)}</span> กรอบ
                  (ข้อ {gridConfig.startQuestion}–{parseInt(gridConfig.startQuestion)+parseInt(gridConfig.questions)-1} × {gridConfig.choices} ตัวเลือก)
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button onClick={()=>setShowGridModal(false)} className="flex-1 py-2.5 rounded-2xl border border-slate-200 text-sm font-medium text-slate-500 hover:bg-slate-50 transition-colors">ยกเลิก</button>
                <button onClick={generateGrid} disabled={!gridConfig.questions||!gridConfig.choices||currentSet?.selectedId==null}
                  className="flex-1 py-2.5 rounded-2xl text-sm font-semibold text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                  style={{ background:"linear-gradient(135deg,#7c3aed,#6366f1)" }}>
                  <Grid size={14}/> แบ่ง Grid
                </button>
              </div>

              <div onClick={()=>setGridConfig(g=>({...g,replaceAll:!g.replaceAll}))}
                className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 cursor-pointer hover:bg-slate-100 transition-colors">
                <div className={`w-8 h-4 rounded-full transition-colors relative shrink-0 ${gridConfig.replaceAll?'bg-red-400':'bg-slate-300'}`}>
                  <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${gridConfig.replaceAll?'translate-x-4':'translate-x-0.5'}`}/>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-700">{gridConfig.replaceAll?'🗑️ ล้างกรอบเดิมทั้งหมดก่อนสร้างใหม่':'➕ เพิ่มกรอบต่อจากเดิม'}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{gridConfig.replaceAll?'แนะนำ: ป้องกันกรอบซ้อนกัน':'ใช้เมื่อต้องการวาดหลายโซนแยกกัน'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )}
    </>
  );
}

function TemplateCard({ template: t, isActive, onEdit, onDelete }) {
  return (
    <div
      className="bg-white border rounded-2xl p-3 sm:p-4 cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md relative group"
      style={{ borderColor: isActive ? "#6366f1" : "#e2e8f0", boxShadow: isActive ? "0 0 0 2px rgba(99,102,241,0.2)" : "none" }}>
      {/* ปุ่มลบ — โผล่เมื่อ hover */}
      <button
        onClick={e => { e.stopPropagation(); onDelete(); }}
        className="absolute top-2 right-2 w-6 h-6 rounded-lg flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100">
        <Trash2 size={12}/>
      </button>

      <div onClick={onEdit}>
        <div className="flex items-start justify-between gap-2 mb-2 sm:mb-3">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
            <BookOpen size={14} className="text-indigo-500"/>
          </div>
          {isActive && (<span className="text-xs bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full font-medium shrink-0">แก้ไข</span>)}
        </div>
        <p className="text-xs sm:text-sm font-semibold text-slate-800 truncate">{t.name}</p>
        <p className="text-xs text-slate-600 truncate mt-0.5">{t.subject?.name || ''}</p>
        <p className="text-xs text-slate-400 font-mono mt-0.5 truncate">{t.subject?.code}</p>
        <div className="flex items-center justify-between mt-2 sm:mt-3 pt-2 sm:pt-3 border-t border-slate-100">
          <span className="text-xs text-slate-400">ปี {t.year}</span>
          <div className="flex items-center gap-1.5">
            {t.sets?.some(s=>s.boundingBoxes?.some(b=>b.isAnswer)) && (<span className="text-xs bg-emerald-100 text-emerald-600 px-1.5 py-0.5 rounded-full">มีเฉลย</span>)}
            <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{t.sets?.length||0} ชุด</span>
          </div>
        </div>
      </div>
    </div>
  );
}