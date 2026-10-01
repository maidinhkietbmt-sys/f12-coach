/* ============================================================
   BẢN ĐỒ XANH — data.js
   Tầng dữ liệu tách biệt 2 nguồn:
   - UserReports : báo cáo do người dùng tạo (localStorage)
   - SensorApi   : dữ liệu trạm quan trắc / cảm biến (fetch)
   Cả hai trả về Report cùng shape → dễ thêm nguồn mới.
   ============================================================ */
'use strict';

/* ---------- Taxonomy ---------- */
const LEVELS = {
  critical: { id:'critical', label:'Khẩn cấp',       color:'#DC2626', rank:4 },
  high:     { id:'high',     label:'Nghiêm trọng',   color:'#EA580C', rank:3 },
  medium:   { id:'medium',   label:'Cảnh báo',       color:'#D9A404', rank:2 },
  low:      { id:'low',      label:'Ổn định',        color:'#16A34A', rank:1 },
};
const LEVEL_IDS = Object.keys(LEVELS);

const POLLUTION_TYPES = [
  { id:'trash',    label:'Rác thải',        icon:'🗑️' },
  { id:'water',    label:'Nước thải',       icon:'💧' },
  { id:'air',      label:'Khí / mùi',       icon:'🌫️' },
  { id:'noise',    label:'Tiếng ồn',        icon:'🔊' },
  { id:'chemical', label:'Hóa chất',        icon:'⚗️' },
  { id:'other',    label:'Khác',            icon:'📍' },
];
const TYPE_MAP = Object.fromEntries(POLLUTION_TYPES.map(t => [t.id, t]));

/* ---------- Chuẩn hóa Report ----------
   { id, source:'user'|'sensor', typeId, levelId, lat, lng,
     title, desc, photo(dataURL|null), ts, mine } */
function normalizeReport(raw, fallbackSource) {
  const typeId  = TYPE_MAP[raw.typeId] ? raw.typeId : 'other';
  const levelId = LEVELS[raw.levelId] ? raw.levelId : 'medium';
  const lat = Number(raw.lat), lng = Number(raw.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return {
    id: String(raw.id || genId()),
    source: raw.source === 'sensor' ? 'sensor' : (raw.source === 'user' ? 'user' : fallbackSource),
    typeId, levelId, lat, lng,
    title: String(raw.title || TYPE_MAP[typeId].label).slice(0, 120),
    desc: String(raw.desc || '').slice(0, 500),
    photo: typeof raw.photo === 'string' ? raw.photo : null,
    ts: Number(raw.ts) || Date.now(),
    mine: Boolean(raw.mine),
  };
}
function genId() {
  return 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/* ---------- Nguồn 1: báo cáo người dùng (localStorage) ---------- */
const UserReports = (() => {
  const KEY = 'bdx_user_reports_v1';

  function load() {
    try {
      const arr = JSON.parse(localStorage.getItem(KEY) || '[]');
      if (!Array.isArray(arr)) return [];
      return arr.map(r => normalizeReport(r, 'user')).filter(Boolean);
    } catch { return []; }
  }
  function save(list) {
    try { localStorage.setItem(KEY, JSON.stringify(list)); return true; }
    catch { return false; } // có thể fail khi vượt hạn mức lưu trữ (ảnh lớn)
  }

  return {
    async fetchAll() { return load(); },
    add({ typeId, levelId, lat, lng, desc, photo }) {
      const list = load();
      const report = normalizeReport({
        id: genId(), source:'user', mine:true,
        typeId, levelId, lat, lng, desc, photo, ts: Date.now(),
        title: (TYPE_MAP[typeId] || TYPE_MAP.other).label,
      }, 'user');
      list.push(report);
      return save(list) ? report : null;
    },
    clear() { try { localStorage.removeItem(KEY); } catch {} },
  };
})();

/* ---------- Nguồn 2: cảm biến / trạm quan trắc ---------- */
const SensorApi = (() => {
  // Đổi URL này khi có backend thật; trả về mảng report thô.
  const ENDPOINT = 'data/sensors.json';

  // Dữ liệu demo khi chưa có backend (khu vực TP. Thủ Đức, TP.HCM).
  const DEMO = [
    { id:'s1', source:'sensor', typeId:'water', levelId:'critical', lat:10.8510, lng:106.7600, title:'Kênh nước đen nghiêm trọng', desc:'Cảm biến pH=3.8, DO<1 mg/L — nước đen, bốc mùi hôi nặng.', ts:Date.now()-2*3600e3 },
    { id:'s2', source:'sensor', typeId:'air',  levelId:'high',     lat:10.8565, lng:106.7530, title:'PM2.5 vượt ngưỡng',        desc:'Chỉ số PM2.5 = 138 µg/m³ (vượt 4 lần chuẩn ngày).', ts:Date.now()-5*3600e3 },
    { id:'s3', source:'sensor', typeId:'trash',levelId:'medium',   lat:10.8462, lng:106.7705, title:'Rác tích tụ bên kênh',     desc:'Camera trạm ghi nhận đống rác lớn tích tụ 3 ngày.', ts:Date.now()-9*3600e3 },
    { id:'s4', source:'sensor', typeId:'noise',levelId:'low',      lat:10.8601, lng:106.7662, title:'Ồn trong ngưỡng',          desc:'Mức ồn 58 dB — trong giới hạn cho phép.', ts:Date.now()-14*3600e3 },
    { id:'s5', source:'sensor', typeId:'air',  levelId:'critical', lat:10.8420, lng:106.7440, title:'Khí lạ nồng độ cao',       desc:'Cảm biến VOC báo động: 2.4 ppm — đề nghị tránh khu vực.', ts:Date.now()-40*60e3 },
    { id:'s6', source:'sensor', typeId:'water',levelId:'high',     lat:10.8688, lng:106.7825, title:'Nước đục NTU cao',         desc:'Độ đục 85 NTU sau mưa — nguy cơ nhiễm bẩn nguồn.', ts:Date.now()-26*3600e3 },
  ];

  return {
    async fetchAll({ signal } = {}) {
      try {
        const res = await fetch(ENDPOINT, { signal });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();
        const arr = Array.isArray(data) ? data : (Array.isArray(data.reports) ? data.reports : []);
        return arr.map(r => normalizeReport(r, 'sensor')).filter(Boolean);
      } catch (err) {
        if (err && err.name === 'AbortError') throw err;
        // Chưa có backend → dùng dữ liệu demo để app vẫn dùng được.
        return DEMO.map(r => normalizeReport(r, 'sensor')).filter(Boolean);
      }
    },
  };
})();

/* ---------- Nguồn 3: tương tác cộng đồng (bình luận + xác nhận) ----------
   Lưu localStorage theo id báo cáo. Khi có backend, chỉ cần thay
   phần load/save bằng API — shape giữ nguyên. */
const CommunityStore = (() => {
  const KEY = 'bdx_community_v1'; // { [reportId]: { comments:[], confirms: n, confirmedByMe: bool } }

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; }
  }
  function save(db) {
    try { localStorage.setItem(KEY, JSON.stringify(db)); return true; } catch { return false; }
  }

  return {
    get(id) {
      const db = load();
      return db[id] || { comments: [], confirms: 0, confirmedByMe: false };
    },
    addComment(id, text) {
      const db = load();
      const entry = db[id] || { comments: [], confirms: 0, confirmedByMe: false };
      entry.comments.push({
        id: genId(),
        author: 'Bạn',
        text: String(text).slice(0, 300),
        ts: Date.now(),
      });
      db[id] = entry;
      return save(db) ? entry : null;
    },
    toggleConfirm(id) {
      const db = load();
      const entry = db[id] || { comments: [], confirms: 0, confirmedByMe: false };
      entry.confirmedByMe = !entry.confirmedByMe;
      entry.confirms += entry.confirmedByMe ? 1 : -1;
      if (entry.confirms < 0) entry.confirms = 0;
      db[id] = entry;
      return save(db) ? entry : null;
    },
    counts() {
      const db = load();
      const map = new Map();
      for (const [id, v] of Object.entries(db)) {
        map.set(id, { comments: v.comments.length, confirms: v.confirms });
      }
      return map;
  },
  };
})();

/* ---------- Bus hợp nhất + cache ---------- */
const DataBus = (() => {
  let cache = { user:[], sensor:[] };
  const listeners = new Set();

  function all() { return [...cache.user, ...cache.sensor]; }

  return {
    all,
    onReload(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    emit() { listeners.forEach(fn => fn(all())); },
    async loadAll() {
      const [user, sensor] = await Promise.all([
        UserReports.fetchAll(),
        SensorApi.fetchAll().catch(() => []),
      ]);
      cache = { user, sensor };
      this.emit();
      return all();
    },
    addUserReport(input) {
      const report = UserReports.add(input);
      if (report) {
        cache.user = [...cache.user, report];
        this.emit();
      }
      return report;
    },
    sensorCount() { return cache.sensor.length; },
  };
})();
