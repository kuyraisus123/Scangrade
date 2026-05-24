import * as XLSX from 'xlsx'

/**
 * Export ผลการสอบเป็น Excel
 * @param {object} subject - ข้อมูลวิชา { name, code, year, term }
 * @param {array}  sheets  - รายการกระดาษ [{ name, score, totalScore, wrongItems, student }]
 */
export function exportExcel(subject, sheets) {
  const wb = XLSX.utils.book_new()

  // ── Sheet 1: สรุปรายวิชา ──────────────────────────────────────────────────
  const totalStudents = sheets.length
  const totalScore    = sheets[0]?.totalScore || 100
  const passThreshold = totalScore * 0.6
  const passCount     = sheets.filter(s => s.score >= passThreshold).length
  const avgScore      = totalStudents > 0
    ? (sheets.reduce((a, s) => a + s.score, 0) / totalStudents).toFixed(1)
    : 0

  const summaryData = [
    ['สรุปผลการสอบ'],
    [],
    ['วิชา',         subject.name],
    ['รหัสวิชา',     subject.code],
    ['ปีการศึกษา',   subject.year],
    ['เทอม',         subject.term],
    [],
    ['จำนวนทั้งหมด', totalStudents, 'แผ่น'],
    ['คะแนนเต็ม',    totalScore],
    ['คะแนนเฉลี่ย',  avgScore],
    ['ผ่าน',         passCount, `(${totalStudents > 0 ? Math.round(passCount/totalStudents*100) : 0}%)`],
    ['ไม่ผ่าน',      totalStudents - passCount],
  ]

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryData)
  wsSummary['!cols'] = [{ wch: 16 }, { wch: 30 }, { wch: 10 }]
  XLSX.utils.book_append_sheet(wb, wsSummary, 'สรุป')

  // ── Sheet 2: รายละเอียดแต่ละแผ่น ─────────────────────────────────────────
  const headers = ['ลำดับ', 'รหัสนักศึกษา', 'ชื่อ-นามสกุล', 'คะแนน', 'คะแนนเต็ม', '%', 'สถานะ', 'ข้อที่ผิด']

  const rows = sheets.map((s, i) => {
    const pct    = totalScore > 0 ? Math.round((s.score / totalScore) * 100) : 0
    const status = pct >= 60 ? 'ผ่าน' : pct >= 50 ? 'เกือบผ่าน' : 'ไม่ผ่าน'
    const wrong  = s.wrongItems?.length > 0 ? s.wrongItems.join(', ') : '-'
    return [
      i + 1,
      s.student?.studentId || s.detectedStudentId || '-',
      s.student?.name      || s.name || '-',
      s.score,
      totalScore,
      pct,
      status,
      wrong,
    ]
  })

  const wsDetail = XLSX.utils.aoa_to_sheet([headers, ...rows])
  wsDetail['!cols'] = [
    { wch: 6 },   // ลำดับ
    { wch: 14 },  // รหัส
    { wch: 24 },  // ชื่อ
    { wch: 8 },   // คะแนน
    { wch: 10 },  // คะแนนเต็ม
    { wch: 6 },   // %
    { wch: 12 },  // สถานะ
    { wch: 30 },  // ข้อที่ผิด
  ]

  // จัดสี header row
  const headerRange = XLSX.utils.decode_range(wsDetail['!ref'])
  for (let c = headerRange.s.c; c <= headerRange.e.c; c++) {
    const cell = XLSX.utils.encode_cell({ r: 0, c })
    if (!wsDetail[cell]) continue
    wsDetail[cell].s = {
      font:    { bold: true, color: { rgb: 'FFFFFF' } },
      fill:    { fgColor: { rgb: '6366F1' } },
      alignment: { horizontal: 'center' },
    }
  }

  XLSX.utils.book_append_sheet(wb, wsDetail, 'รายละเอียด')

  // ── Sheet 3: การกระจายคะแนน ──────────────────────────────────────────────
  const distHeaders = ['ช่วงคะแนน', 'จำนวน', '%']
  const ranges = [
    ['90–100%', sheets.filter(s => (s.score/totalScore)*100 >= 90).length],
    ['80–89%',  sheets.filter(s => { const p=(s.score/totalScore)*100; return p>=80&&p<90 }).length],
    ['70–79%',  sheets.filter(s => { const p=(s.score/totalScore)*100; return p>=70&&p<80 }).length],
    ['60–69%',  sheets.filter(s => { const p=(s.score/totalScore)*100; return p>=60&&p<70 }).length],
    ['50–59%',  sheets.filter(s => { const p=(s.score/totalScore)*100; return p>=50&&p<60 }).length],
    ['<50%',    sheets.filter(s => (s.score/totalScore)*100 < 50).length],
  ]

  const distRows = ranges.map(([label, count]) => [
    label,
    count,
    totalStudents > 0 ? Math.round(count/totalStudents*100) : 0,
  ])

  const wsDist = XLSX.utils.aoa_to_sheet([distHeaders, ...distRows])
  wsDist['!cols'] = [{ wch: 12 }, { wch: 8 }, { wch: 6 }]
  XLSX.utils.book_append_sheet(wb, wsDist, 'การกระจายคะแนน')

  // ── Download ──────────────────────────────────────────────────────────────
  const filename = `ผลสอบ_${subject.code}_ปี${subject.year}_เทอม${subject.term}_${new Date().toLocaleDateString('th-TH').replace(/\//g, '-')}.xlsx`
  XLSX.writeFile(wb, filename)
}