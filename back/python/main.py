from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import cv2
import numpy as np
import base64
import math
from collections import Counter
from typing import List, Optional

app = FastAPI(title="ScanGrade Grader API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

class BoundingBox(BaseModel):
    questionNumber: int
    x: float
    y: float
    w: float
    h: float
    isAnswer: bool = False
    type: str = "answer"

class GradeRequest(BaseModel):
    image: str
    answer_key: List[BoundingBox]
    total_score: float = 100
    score_per_question: float = 2
    choices: int = 5

class GradeResponse(BaseModel):
    score: float
    total_score: float
    wrong_items: List[int]
    unfilled_items: List[int]
    correct_count: int
    total_questions: int
    detected_student_id: Optional[str] = None
    detected_set_number: Optional[int] = None
    filled_questions: dict

class DetectAnswerRequest(BaseModel):
    image: str
    bounding_boxes: List[BoundingBox]

class DetectAnswerResponse(BaseModel):
    answer_key: List[dict]

def decode_image(image_b64: str):
    img_bytes = base64.b64decode(image_b64)
    img_array = np.frombuffer(img_bytes, np.uint8)
    img = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("อ่านรูปภาพไม่ได้")
    return img

def preprocess(img):
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    blur = cv2.bilateralFilter(gray, 9, 75, 75)
    _, thresh = cv2.threshold(blur, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    return thresh

def crop_region(img, x, y, w, h):
    h_img, w_img = img.shape[:2]
    x1 = max(0, int(x))
    y1 = max(0, int(y))
    x2 = min(w_img, int(x + w))
    y2 = min(h_img, int(y + h))
    return img[y1:y2, x1:x2]

def get_density(thresh, x, y, w, h):
    x, y, w, h = int(x), int(y), int(w), int(h)
    h_img, w_img = thresh.shape[:2]
    x1 = max(0, min(x, w_img - 1))
    y1 = max(0, min(y, h_img - 1))
    x2 = max(0, min(x + w, w_img))
    y2 = max(0, min(y + h, h_img))
    if x2 <= x1 or y2 <= y1:
        return 0.0
    roi = thresh[y1:y2, x1:x2]
    if roi.size == 0:
        return 0.0
    margin_x = max(1, int(roi.shape[1] * 0.15))
    margin_y = max(1, int(roi.shape[0] * 0.15))
    inner = roi[margin_y:roi.shape[0]-margin_y, margin_x:roi.shape[1]-margin_x]
    if inner.size == 0:
        inner = roi
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    inner = cv2.erode(inner, kernel, iterations=1)
    return float(np.count_nonzero(inner)) / inner.size

def is_filled(thresh, x, y, w, h, threshold=0.08):
    return get_density(thresh, x, y, w, h) > threshold

def read_student_id_from_region(img, box: BoundingBox, all_boxes: list = None) -> Optional[str]:
    try:
        # คำนวณ num_digits จาก bounding boxes จริงๆ
        num_digits = 5  # default
        if all_boxes:
            sid_boxes = [b for b in all_boxes if b.type == "student_id"]
            if sid_boxes:
                # หา unique qNum (หลัก) = จำนวนหลักจริง
                # qn = (digit-1)*10 + row + 1 → digit = ceil(qn/10)
                unique_digits = set(math.ceil(b.questionNumber / 10) for b in sid_boxes if b.questionNumber > 0)
                num_digits = len(unique_digits)

        roi = crop_region(img, box.x, box.y, box.w, box.h)
        if roi.size == 0:
            return None
        gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
        _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
        h, w = thresh.shape
        col_w = w / num_digits
        row_h = h / 10
        # แมป row index → ตัวเลข (กระดาษเรียง 1,2,3,4,5,6,7,8,9,0)
        ROW_TO_DIGIT = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
        digits = []
        for col in range(num_digits):
            x1 = int(col * col_w)
            x2 = int((col + 1) * col_w)
            best_density = 0.0
            best_row = 0
            for row in range(10):
                y1 = int(row * row_h)
                y2 = int((row + 1) * row_h)
                cell = thresh[y1:y2, x1:x2]
                if cell.size == 0:
                    continue
                density = float(np.count_nonzero(cell)) / cell.size
                if density > best_density:
                    best_density = density
                    best_row = row
            if best_density > 0.08:
                digits.append(str(ROW_TO_DIGIT[best_row]))
        print(f"OCR digits={digits} num_digits={num_digits}")
        return "".join(digits) if digits else None
    except Exception as e:
        print(f"OCR error: {e}")
        return None

@app.get("/health")
def health():
    return {"status": "ok", "service": "ScanGrade Grader"}


@app.post("/detect-answer", response_model=DetectAnswerResponse)
def detect_answer(req: DetectAnswerRequest):
    try:
        img    = decode_image(req.image)
        thresh = preprocess(img)

        answer_boxes = []
        for i, box in enumerate(req.bounding_boxes):
            if box.type == "answer" or not box.type:
                density = get_density(thresh, box.x, box.y, box.w, box.h)
                answer_boxes.append((i, box, density))

        print(f"TOTAL ANSWER BOXES: {len(answer_boxes)}")
        print(f"QNUMS: {[b[1].questionNumber for b in answer_boxes[:10]]}")

        if answer_boxes:
            qnums = sorted(set(b[1].questionNumber for b in answer_boxes if b[1].questionNumber > 0))
            if len(qnums) >= 2:
                steps = [qnums[k+1] - qnums[k] for k in range(len(qnums)-1)]
                choices = Counter(steps).most_common(1)[0][0]
            else:
                choices = 5
        else:
            choices = 5

        print(f"CHOICES DETECTED: {choices}")

        qnum_groups = {}
        for i, box, density in answer_boxes:
            if box.questionNumber <= 0:
                continue
            qnum = math.ceil(box.questionNumber / choices)
            if qnum not in qnum_groups:
                qnum_groups[qnum] = []
            qnum_groups[qnum].append((i, box, density))

        for qnum in sorted(qnum_groups.keys())[:3]:
            group = qnum_groups[qnum]
            for i, box, density in sorted(group, key=lambda x: x[1].questionNumber):
                print(f"  qnum={qnum} qN={box.questionNumber} density={density:.3f}")

        MIN_DENSITY = 0.08
        best_choice_indices = set()
        for qnum, group in qnum_groups.items():
            best = max(group, key=lambda x: x[2])
            if best[2] >= MIN_DENSITY:
                best_choice_indices.add(best[0])

        answer_key = []
        for i, box in enumerate(req.bounding_boxes):
            if box.type == "student_id":
                student_id = read_student_id_from_region(img, box, req.bounding_boxes)
                answer_key.append({
                    "questionNumber": box.questionNumber,
                    "x": box.x, "y": box.y, "w": box.w, "h": box.h,
                    "isAnswer": False,
                    "type": "student_id",
                    "studentId": student_id,
                })
            elif box.type == "set_number":
                filled = is_filled(thresh, box.x, box.y, box.w, box.h)
                answer_key.append({
                    "questionNumber": box.questionNumber,
                    "x": box.x, "y": box.y, "w": box.w, "h": box.h,
                    "isAnswer": filled,
                    "type": "set_number",
                })
            else:
                is_best = i in best_choice_indices
                answer_key.append({
                    "questionNumber": box.questionNumber,
                    "x": box.x, "y": box.y, "w": box.w, "h": box.h,
                    "isAnswer": is_best,
                    "type": "answer",
                })

        return DetectAnswerResponse(answer_key=answer_key)

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/grade", response_model=GradeResponse)
def grade(req: GradeRequest):
    try:
        img    = decode_image(req.image)
        thresh = preprocess(img)
        detected_student_id = None

        answer_boxes_raw = [(box, get_density(thresh, box.x, box.y, box.w, box.h))
                            for box in req.answer_key
                            if box.type == "answer" or not box.type]

        choices = req.choices if req.choices > 0 else 5
        print(f"GRADE: total_score={req.total_score} score_per_question={req.score_per_question} choices={choices} answer_boxes={len(answer_boxes_raw)}")
        print(f"sample isAnswer qnums: {[b.questionNumber for b in req.answer_key if b.isAnswer and b.type=='answer'][:5]}")
        print(f"sample answer_boxes qnums: {[b.questionNumber for b in answer_boxes_raw[:5][0][0:1]]}")

        qnum_groups = {}
        for box, density in answer_boxes_raw:
            if box.questionNumber <= 0:
                continue
            qnum = math.ceil(box.questionNumber / choices)
            if qnum not in qnum_groups:
                qnum_groups[qnum] = []
            qnum_groups[qnum].append((box, density))

        detected_set_number = None
        # OCR เลขนิสิตจาก individual boxes แทนการ crop กรอบใหญ่
        sid_boxes = [(box, get_density(thresh, box.x, box.y, box.w, box.h))
                     for box in req.answer_key if box.type == "student_id"]
        if sid_boxes:
            # group ตาม digit (หลัก): digit = ceil(qn/10)
            digit_groups = {}
            for box, density in sid_boxes:
                digit = math.ceil(box.questionNumber / 10)
                if digit not in digit_groups:
                    digit_groups[digit] = []
                digit_groups[digit].append((box, density))
            # เรียง row จาก y น้อยไปมาก แมปกับ ROW_TO_DIGIT
            ROW_TO_DIGIT = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
            student_id_digits = []
            for digit in sorted(digit_groups.keys()):
                group = digit_groups[digit]
                # sort ตาม y เพื่อหา row ที่ฝน
                group_sorted = sorted(group, key=lambda x: x[0].y)
                best = max(group, key=lambda x: x[1])
                if best[1] > 0.08:
                    row_idx = next((i for i, (b, _) in enumerate(group_sorted) if b.y == best[0].y), 0)
                    row_idx = min(row_idx, 9)
                    student_id_digits.append(str(ROW_TO_DIGIT[row_idx]))
            detected_student_id = "".join(student_id_digits) if student_id_digits else None
            print(f"OCR result: {detected_student_id}")

        # detect ชุดข้อสอบจาก set_number boxes
        set_boxes = [(box, get_density(thresh, box.x, box.y, box.w, box.h))
                     for box in req.answer_key if box.type == "set_number"]
        if set_boxes:
            # sort ตาม y จากบนลงล่าง แล้ว assign ชุดที่ 1,2,3,4,5
            set_boxes_sorted = sorted(set_boxes, key=lambda x: x[0].x)
            x_to_set = {b.x: idx+1 for idx, (b, _) in enumerate(set_boxes_sorted)}

            MIN_SET_DENSITY = 0.25
            best_set = None
            best_set_density = MIN_SET_DENSITY
            for box, density in set_boxes:
                if density > best_set_density:
                    best_set_density = density
                    best_set = x_to_set[box.x]
            detected_set_number = best_set
            print(f"DETECTED SET: {detected_set_number} (densities: {[(x_to_set[b.x], round(d,3)) for b,d in set_boxes_sorted]})")

        answer_qnums = [math.ceil(box.questionNumber / choices) for box in req.answer_key if box.isAnswer and box.type == 'answer']
        print(f"answer qnums: {sorted(set(answer_qnums))[:10]}")
        print(f"student qnums: {sorted(qnum_groups.keys())[:10]}")

        wrong_items = []
        unfilled_items = []
        correct_count = 0
        MIN_DENSITY = 0.08

        for qnum, group in qnum_groups.items():
            answer_box = next((box for box, _ in group if box.isAnswer), None)
            best = max(group, key=lambda x: x[1])
            student_filled = best[1] >= MIN_DENSITY
            student_box = best[0] if student_filled else None

            # debug log 5 ข้อแรก
            if qnum <= 5:
                print(f"qnum={qnum} answer_qN={answer_box.questionNumber if answer_box else None} best_qN={best[0].questionNumber} density={best[1]:.3f} filled={student_filled}")

            if qnum == 23:
                print(f"qnum=23 best_density={best[1]:.3f} student_filled={student_filled} answer_box={answer_box}")

            if answer_box is None:
                # ไม่มีเฉลยข้อนี้ — ถ้าไม่ได้ฝนก็ถือว่า unfilled
                if not student_filled:
                    unfilled_items.append(qnum)
                continue

            if not student_filled:
                unfilled_items.append(qnum)
            elif student_box and student_box.questionNumber == answer_box.questionNumber:
                correct_count += 1
            else:
                wrong_items.append(answer_box.questionNumber)

        score = correct_count * req.score_per_question

        return GradeResponse(
            score               = score,
            total_score         = req.total_score,
            wrong_items         = sorted(set(wrong_items)),
            unfilled_items      = sorted(set(unfilled_items)),
            correct_count       = correct_count,
            total_questions     = len(qnum_groups),
            detected_student_id = detected_student_id,
            detected_set_number = detected_set_number,
            filled_questions    = {},
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5000)