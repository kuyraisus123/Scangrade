// ─── Shared in-memory template store with subscriber support ─────────────────
// Components call templateStore.subscribe(fn) to get notified on save.

export const templateStore = {
  _data:       [],
  _listeners:  [],

  subscribe(fn) {
    this._listeners.push(fn);
    return () => { this._listeners = this._listeners.filter(l => l !== fn); };
  },

  _notify() {
    this._listeners.forEach(fn => fn([...this._data]));
  },

  save(template) {
    const idx = this._data.findIndex(t => t.id === template.id);
    if (idx >= 0) this._data[idx] = template;
    else this._data.push(template);
    this._notify();
  },

  getAll() {
    return [...this._data];
  },

  getById(id) {
    return this._data.find(t => t.id === id) || null;
  },
};

export const SUBJECT_OPTIONS = [
  { code: "001101",  name: "ภาษาไทยในชีวิตประจำวัน"               },
  { code: "001103",  name: "ภาษาอังกฤษสำหรับชีวิตประจำวัน"         },
  { code: "002101",  name: "การใช้เทคโนโลยีเพื่อชีวิตยุคดิจิทัล"  },
  { code: "226111",  name: "การเขียนโปรแกรมเชิงขั้นตอนคำสั่ง"     },
  { code: "226192",  name: "เปิดโลกวิศวกรรมคอมพิวเตอร์"           },
  { code: "244107",  name: "ฟิสิกส์เชิงไฟฟ้า"                     },
  { code: "226112", name: "การจำลองและเขียนโปรแกรมเชิงวัตถุ"     },
  { code: "226252",  name: "หลักการเครือข่ายคอมพิวเตอร์"          },
  { code: "226297",  name: "เทคโนโลยีการเขียนโปรแกรมเว็บไซต์"    },
  { code: "226344",  name: "วิทยาการหุ่นยนต์"                     },
  { code: "226372",  name: "การประมวลสัญญาณดิจิทัล"               },
  { code: "226372",  name: "การวิเคราะห์และจัดการข้อมูลเซ็นเซอร์" },
];