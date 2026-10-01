/* ============================================================
   BẢN ĐỒ XANH — app.js
   UI: bản đồ Leaflet/OSM, marker mức độ, report card popover,
   tìm kiếm + bộ lọc, FAB camera, định vị, theme, a11y.
   ============================================================ */
'use strict';

/* ================== THAM CHIẾU DOM ================== */
const $ = (sel) => document.querySelector(sel);
const el = {
  mapEl: $('#mapEl'), mapStatus: $('#mapStatus'), mapStatusText: $('#mapStatusText'),
  retryMapBtn: $('#retryMapBtn'),
  searchInput: $('#searchInput'), clearSearchBtn: $('#clearSearchBtn'),
  themeBtn: $('#themeBtn'), filterToggleBtn: $('#filterToggleBtn'),
  filterPanel: $('#filterPanel'),
  filterTypes: $('#filterTypes'), filterLevels: $('#filterLevels'), filterSources: $('#filterSources'),
  resetFiltersBtn: $('#resetFiltersBtn'),
  resultRow: $('#resultRow'), resultText: $('#resultText'), clearResultBtn: $('#clearResultBtn'),
  legend: $('#legend'), legendBar: $('#legendBar'), locateBtn: $('#locateBtn'),
  addFab: $('#addFab'),
  card: $('#reportCard'),
  overlay: $('#addDialog'), sheetClose: $('#sheetClose'),
  addForm: $('#addForm'), photoBtn: $('#photoBtn'), photoInput: $('#photoInput'),
  photoPreview: $('#photoPreview'), photoPlaceholder: $('#photoPlaceholder'),
  photoRemoveBtn: $('#photoRemoveBtn'),
  typeGrid: $('#typeGrid'), levelGrid: $('#levelGrid'),
  descInput: $('#descInput'), descCount: $('#descCount'),
  locStatus: $('#locStatus'), locStatusText: $('#locStatusText'),
  submitBtn: $('#submitBtn'), submitLabel: $('#submitBtn .btn-label'),
  submitSpinner: $('#submitBtn .btn-spinner'),
  toastHost: $('#toastHost'), sensorPill: $('#sensorPill'), liveRegion: $('#liveRegion'),
  rcClose: $('#rcClose'), heatToggleBtn: $('#heatToggleBtn'),
  rcDetailBtn: $('#rcDetailBtn'),
  detailOverlay: $('#detailOverlay'), dtClose: $('#dtClose'),
  dtPhotoWrap: $('#dtPhotoWrap'), dtPhoto: $('#dtPhoto'),
  dtLevel: $('#dtLevel'), dtType: $('#dtType'), dtSource: $('#dtSource'), dtTime: $('#dtTime'),
  dtDesc: $('#dtDesc'), confirmBtn: $('#confirmBtn'), confirmCount: $('#confirmCount'),
  commentList: $('#commentList'), commentsHeader: $('#commentsHeader'),
  commentForm: $('#commentForm'), commentInput: $('#commentInput'),
};

/* ================== TRẠNG THÁI ================== */
const state = {
  map: null,
  markers: new Map(),       // id → L.Marker
  reports: [],
  filtered: [],
  filters: { q:'', types:new Set(), levels:new Set(), sources:new Set() },
  activeId: null,
  theme: null,
  me: null,                 // {lat,lng} vị trí người dùng
  meMarker: null,
  locating: false,
  watchId: null,
  photo: null,              // dataURL ảnh đang đính kèm
  formType: null, formLevel: null,
  coords: null,             // tọa độ cho form mới
  lastFocus: null,          // focus trap cho dialog
  heatOn: false,
  heatLegend: null,
  detailId: null,
};

/* ================== ICON SVG CHUNG ================== */
const ICONS = {
  geo: (s=14) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.5"/></svg>`,
  clock: (s=14) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>`,
  user: (s=13) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-3.3 3.6-5.5 8-5.5s8 2.2 8 5.5"/></svg>`,
};

/* ================== TIỆN ÍCH ================== */
const escapeHtml = (s) => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function timeAgo(ts) {
  const s = Math.max(1, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return 'vừa xong';
  const m = Math.round(s / 60);   if (m < 60) return m + ' phút trước';
  const h = Math.round(m / 60);   if (h < 24) return h + ' giờ trước';
  const d = Math.round(h / 24);   if (d < 7)  return d + ' ngày trước';
  return new Date(ts).toLocaleDateString('vi-VN');
}

function toast(msg, isError = false) {
  const t = document.createElement('div');
  t.className = 'toast' + (isError ? ' error' : '');
  t.textContent = msg;
  el.toastHost.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .3s'; }, 3400);
  setTimeout(() => t.remove(), 3800);
}
function announce(msg) { el.liveRegion.textContent = msg; }

/* ================== BẢN ĐỒ ================== */
function initMap() {
  state.map = L.map('mapEl', {
    center: [10.8522, 106.7680], // TP. Thủ Đức, TP.HCM (vùng demo)
    zoom: 14,
    zoomControl: false,
    attributionControl: true,
  });
  L.control.zoom({ position:'bottomright' }).addTo(state.map);
  L.control.scale({ imperial:false, position:'bottomright' }).addTo(state.map);

  const tiles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
  });

  let tileLoaded = false, errTimer = null;
  const onLoad = () => {
    tileLoaded = true;
    clearTimeout(errTimer);
    el.mapStatus.classList.add('done');
    setTimeout(() => { el.mapStatus.hidden = true; }, 350);
  };
  tiles.on('tileload', onLoad);
  // Lỗi 1 tile đơn lẻ (mạng chập chờn) chưa chắc là hỏng thật → chờ 1.5s xác nhận
  tiles.on('tileerror', () => {
    if (tileLoaded || errTimer) return;
    errTimer = setTimeout(() => { if (!tileLoaded) showMapError(); }, 1500);
  });

  // Timeout dự phòng: tile load chậm/quá 8s → báo lỗi
  setTimeout(() => { if (!tileLoaded) showMapError(); }, 8000);

  tiles.addTo(state.map);
  bindMapClose();
  if (state.heatOn) attachHeat();
}

function showMapError() {
  el.mapStatus.hidden = false;
  el.mapStatus.classList.remove('done');
  el.mapStatusText.textContent = 'Không tải được bản đồ. Kiểm tra kết nối mạng và thử lại.';
  el.retryMapBtn.hidden = false;
}

el.retryMapBtn.addEventListener('click', () => {
  el.retryMapBtn.hidden = true;
  el.mapStatusText.textContent = 'Đang tải lại bản đồ…';

  // Dọn map cũ trước khi khởi tạo lại (Leaflet cấm init 2 lần trên 1 container)
  closeCard({ restoreFocus: false });
  state.markers.forEach(m => m.remove());
  state.markers.clear();
  state.meMarker = null;
  HEAT.layer = null;
  if (state.map) state.map.remove();

  initMap();
  renderMarkers();
  if (state.me) showMeMarker();
});

/* ================== HEATMAP ================== */
const HEAT = { layer: null };

// Trọng số theo mức độ: khẩn cấp nặng nhất, ổn định gần như trong suốt
const HEAT_WEIGHT = { critical: 1, high: 0.72, medium: 0.45, low: 0.15 };

function heatPoints() {
  return state.filtered.map(r => [r.lat, r.lng, HEAT_WEIGHT[r.levelId] || 0.5]);
}

function attachHeat() {
  if (!state.map || !L.heatLayer) return;
  if (!HEAT.layer) {
    HEAT.layer = L.heatLayer(heatPoints(), {
      radius: 34,
      blur: 22,
      maxZoom: 16,
      max: 1,
      gradient: { 0.1:'#22C55E', 0.35:'#EAB308', 0.65:'#F97316', 0.9:'#DC2626' },
    }).addTo(state.map);
  } else {
    HEAT.layer.setLatLngs(heatPoints());
  }
}

function detachHeat() {
  if (HEAT.layer) { state.map.removeLayer(HEAT.layer); }
}

function setHeat(on) {
  state.heatOn = on;
  el.heatToggleBtn.setAttribute('aria-pressed', String(on));
  if (on) {
    attachHeat();
    el.legend.hidden = true;
    el.heatLegend.hidden = false;
    toast('🌡️ Chế độ xem nhiệt: BẬT');
    announce('Chế độ xem nhiệt bật');
  } else {
    detachHeat();
    el.legend.hidden = false;
    el.heatLegend.hidden = true;
    toast('Chế độ xem nhiệt: TẮT');
  }
}
el.heatToggleBtn.addEventListener('click', () => setHeat(!state.heatOn));

/* ================== MARKERS ================== */
function makeIcon(report) {
  const color = LEVELS[report.levelId].color;
  const cls = 'bdx-dot' + (report.mine ? ' mine' : '');
  return L.divIcon({
    className: '',
    html: `<span class="${cls}"><span class="dot" style="--c:${color}"></span></span>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
}

function renderMarkers() {
  if (!state.map) return;
  const seen = new Set();

  for (const r of state.filtered) {
    seen.add(r.id);
    const pos = L.latLng(r.lat, r.lng);
    const existing = state.markers.get(r.id);
    if (existing) {
      existing.setLatLng(pos);
      existing.setIcon(makeIcon(r));
      continue;
    }
    const marker = L.marker(pos, { icon: makeIcon(r), keyboard: true, riseOnHover: true });
    marker.addTo(state.map);
    marker.on('click', () => openCard(r.id, { focus: true }));
    marker.on('keydown', (e) => {
      if (e.originalEvent.key === 'Enter' || e.originalEvent.key === ' ') {
        e.originalEvent.preventDefault();
        openCard(r.id, { focus: true });
      }
    });
    state.markers.set(r.id, marker);
  }

  // Xóa marker không còn trong kết quả lọc
  for (const [id, marker] of state.markers) {
    if (!seen.has(id)) {
      marker.remove();
      state.markers.delete(id);
    }
  }
}

/* ================== REPORT CARD (popover cạnh chấm) ================== */
function positionCard(latlng) {
  const map = state.map, card = el.card;
  const pad = 14;
  const p = map.latLngToContainerPoint(latlng);
  const cw = card.offsetWidth, ch = card.offsetHeight;
  const size = map.getSize();

  let left = p.x + 18;                       // mặc định: bên phải chấm
  if (left + cw + pad > size.x) left = p.x - cw - 18;
  left = Math.max(pad, Math.min(left, size.x - cw - pad));

  let top = p.y - ch / 2;                    // căn giữa dọc so với chấm
  top = Math.max(pad, Math.min(top, size.y - ch - pad - 90));

  card.style.left = left + 'px';
  card.style.top = Math.max(pad, top) + 'px';
}

function openCard(id, { focus = false } = {}) {
  const r = state.reports.find(x => x.id === id);
  if (!r) return;
  state.activeId = id;

  $('#rcTitle').textContent = r.title;
  $('#rcMeta').innerHTML = `${ICONS.geo(13)} ${escapeHtml(TYPE_MAP[r.typeId].label)}${r.mine ? ' · ' + ICONS.user(12) + ' của bạn' : ''}`;
  $('#rcDesc').textContent = r.desc || 'Không có mô tả.';
  $('#rcTime').textContent = timeAgo(r.ts);

  const photo = $('#rcPhoto');
  if (r.photo) {
    photo.src = r.photo;
    photo.alt = 'Ảnh báo cáo: ' + r.title;
    photo.style.display = '';
    $('.rc-photo-wrap').style.display = '';
  } else {
    photo.src = '';
    photo.style.display = 'none';
    $('.rc-photo-wrap').style.display = 'none';
  }

  const badge = $('#rcLevelBadge');
  badge.dataset.level = r.levelId;
  badge.textContent = LEVELS[r.levelId].label;

  const src = $('#rcSource');
  src.dataset.source = r.source;
  src.textContent = r.source === 'user' ? 'Người dùng' : 'Cảm biến';

  // Đổi icon nguồn (kèm trạng thái camera khi có ảnh)
  const hasPhoto = Boolean(r.photo);
  src.title = hasPhoto ? 'Báo cáo có ảnh' : 'Báo cáo không có ảnh';

  el.card.hidden = false;
  positionCard(L.latLng(r.lat, r.lng));
  el.card.dataset.activeId = id;

  // Focus cho bàn phím, khôi phục khi đóng
  if (focus) {
    state.lastFocus = document.activeElement;
    $('#rcClose').focus();
  }
  announce(`Đã mở báo cáo: ${r.title}`);
}

function closeCard({ restoreFocus = true } = {}) {
  if (el.card.hidden) return;
  el.card.hidden = true;
  state.activeId = null;
  if (restoreFocus && state.lastFocus && document.contains(state.lastFocus)) {
    state.lastFocus.focus();
    state.lastFocus = null;
  }
}

el.rcClose.addEventListener('click', () => closeCard());

/* ================== TRANG CHI TIẾT + CỘNG ĐỒNG ================== */
function fmtCount(n) { return n > 99 ? '99+' : String(n); }

function renderComments(reportId) {
  const c = CommunityStore.get(reportId);
  el.commentList.innerHTML = c.comments.length
    ? c.comments.map(cm => `
      <li class="comment">
        <span class="c-avatar" aria-hidden="true">${escapeHtml(cm.author.charAt(0))}</span>
        <div class="c-bubble">
          <div class="c-head"><b>${escapeHtml(cm.author)}</b><time>${timeAgo(cm.ts)}</time></div>
          <p>${escapeHtml(cm.text)}</p>
        </div>
      </li>`).join('')
    : '<li class="comment-empty">Chưa có bình luận — hãy là người đầu tiên!</li>';
  el.commentsHeader.textContent = `Thảo luận (${c.comments.length})`; 
}

function openDetail(id) {
  const r = state.reports.find(x => x.id === id);
  if (!r) return;
  state.detailId = id;
  state.lastFocus = document.activeElement;

  el.dtTitle.textContent = r.title;
  el.dtDesc.textContent = r.desc || 'Không có mô tả.';
  el.dtType.textContent = `${TYPE_MAP[r.typeId].icon} ${TYPE_MAP[r.typeId].label}`;
  el.dtTime.textContent = timeAgo(r.ts);
  el.dtLevel.dataset.level = r.levelId;
  el.dtLevel.textContent = LEVELS[r.levelId].label;
  el.dtSource.dataset.source = r.source;
  el.dtSource.textContent = r.source === 'user' ? 'Người dùng' : 'Cảm biến';

  if (r.photo) {
    el.dtPhoto.src = r.photo;
    el.dtPhoto.alt = 'Ảnh báo cáo: ' + r.title;
    el.dtPhotoWrap.hidden = false;
  } else {
    el.dtPhotoWrap.hidden = true;
    el.dtPhoto.src = '';
  }

  syncConfirmUI(r.id);
  renderComments(r.id);

  el.detailOverlay.hidden = false;
  document.body.style.overflow = 'hidden';
  setTimeout(() => el.dtClose.focus(), 60);
  announce('Đã mở chi tiết báo cáo: ' + r.title);
}

function closeDetail() {
  if (el.detailOverlay.hidden) return;
  el.detailOverlay.hidden = true;
  document.body.style.overflow = '';
  if (state.lastFocus && document.contains(state.lastFocus)) {
    state.lastFocus.focus();
    state.lastFocus = null;
  }
}

function syncConfirmUI(reportId) {
  const c = CommunityStore.get(reportId);
  el.confirmCount.textContent = `${c.confirms} xác nhận`;
  el.confirmBtn.setAttribute('aria-pressed', String(c.confirmedByMe));
}

el.confirmBtn.addEventListener('click', () => {
  if (!state.detailId) return;
  const entry = CommunityStore.toggleConfirm(state.detailId);
  if (!entry) return toast('Không lưu được xác nhận.', true);
  syncConfirmUI(state.detailId);
  announce(entry.confirmedByMe ? 'Đã xác nhận báo cáo' : 'Đã bỏ xác nhận');
});

el.commentForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = el.commentInput.value.trim();
  if (!text || !state.detailId) return;
  const entry = CommunityStore.addComment(state.detailId, text);
  if (!entry) return toast('Không lưu được bình luận.', true);
  el.commentInput.value = '';
  renderComments(state.detailId);
  announce('Đã gửi bình luận');
});

el.dtClose.addEventListener('click', closeDetail);
el.detailOverlay.addEventListener('pointerdown', (e) => {
  if (e.target === el.detailOverlay) closeDetail();
});
el.rcDetailBtn.addEventListener('click', () => {
  if (state.activeId) openDetail(state.activeId);
});

// Đóng thẻ khi bấm vào vùng trống của bản đồ
function bindMapClose() {
  state.map.on('click', () => closeCard({ restoreFocus: false }));
}

/* ================== TÌM KIẾM + BỘ LỌC ================== */
function applyFilters() {
  const q = state.filters.q.trim().toLowerCase();
  const { types, levels, sources } = state.filters;

  state.filtered = state.reports.filter(r => {
    if (types.size && !types.has(r.typeId)) return false;
    if (levels.size && !levels.has(r.levelId)) return false;
    if (sources.size && !sources.has(r.source)) return false;
    if (q) {
      const hay = `${r.title} ${r.desc} ${TYPE_MAP[r.typeId].label}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  renderMarkers();

  // Cập nhật dòng kết quả
  const qActive = q.length > 0;
  el.resultRow.hidden = !qActive;
  if (qActive) {
    el.resultText.textContent = state.filtered.length
      ? `Tìm thấy ${state.filtered.length} báo cáo cho "${state.filters.q.trim()}"`
      : `Không tìm thấy báo cáo nào cho "${state.filters.q.trim()}"`;
  }

  // Heatmap luôn đồng bộ với kết quả lọc hiện tại
  if (state.heatOn) attachHeat();

  // Cập nhật trạng thái nút lọc
  const active = types.size + levels.size + sources.size;
  el.filterToggleBtn.setAttribute('aria-expanded', String(!el.filterPanel.hidden));
  el.filterToggleBtn.classList.toggle('has-filters', active > 0);
}

function buildChips() {
  // Loại
  el.filterTypes.innerHTML = POLLUTION_TYPES.map(t =>
    `<button type="button" class="chip" data-type="${t.id}" aria-pressed="false">${t.icon} ${escapeHtml(t.label)}</button>`
  ).join('');
  // Mức độ
  el.filterLevels.innerHTML = LEVEL_IDS.map(id =>
    `<button type="button" class="chip" data-level="${id}" aria-pressed="false"><span class="dot" style="background:${LEVELS[id].color}"></span>${LEVELS[id].label}</button>`
  ).join('');
  // Nguồn
  el.filterSources.innerHTML = `
    <button type="button" class="chip" data-source="user" aria-pressed="false">👤 Người dùng</button>
    <button type="button" class="chip" data-source="sensor" aria-pressed="false">📡 Cảm biến</button>`;

  el.filterPanel.addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    const on = chip.getAttribute('aria-pressed') === 'true';
    chip.setAttribute('aria-pressed', String(!on));

    const set = chip.dataset.type ? state.filters.types
      : chip.dataset.level ? state.filters.levels
      : state.filters.sources;
    const key = chip.dataset.type || chip.dataset.level || chip.dataset.source;
    on ? set.delete(key) : set.add(key);
    applyFilters();
  });

  el.resetFiltersBtn.addEventListener('click', () => {
    state.filters.types.clear();
    state.filters.levels.clear();
    state.filters.sources.clear();
    el.filterPanel.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-pressed', 'false'));
    applyFilters();
    toast('Đã đặt lại bộ lọc');
  });
}

/* ================== ĐỊNH VỊ ================== */
function getMyLocation({ pan = true, silent = false } = {}) {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      const err = new Error('Thiết bị không hỗ trợ định vị.');
      if (!silent) toast(err.message, true);
      return reject(err);
    }
    state.locating = true;
    el.locateBtn.classList.add('loading');

    navigator.geolocation.getCurrentPosition(pos => {
      state.locating = false;
      el.locateBtn.classList.remove('loading');
      state.me = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      showMeMarker();
      if (pan) state.map.setView([state.me.lat, state.me.lng], 16, { animate: true });
      resolve(state.me);
    }, err => {
      state.locating = false;
      el.locateBtn.classList.remove('loading');
      if (!silent) {
        const msgs = {
          1: 'Bạn đã từ chối quyền vị trí. Bật lại trong cài đặt trình duyệt.',
          2: 'Không xác định được vị trí. Thử lại sau.',
          3: 'Hết thời gian chờ GPS. Thử lại nhé.',
        };
        toast(msgs[err.code] || 'Không lấy được vị trí.', true);
      }
      reject(err);
    }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 });
  });
}

function showMeMarker() {
  if (!state.me) return;
  const icon = L.divIcon({
    className: '',
    html: '<span class="bdx-dot me"><span class="dot"></span></span>',
    iconSize: [20, 20], iconAnchor: [10, 10],
  });
  if (state.meMarker) state.meMarker.setLatLng([state.me.lat, state.me.lng]);
  else {
    state.meMarker = L.marker([state.me.lat, state.me.lng], { icon, interactive: false });
    state.meMarker.addTo(state.map);
  }
}

el.locateBtn.addEventListener('click', () => getMyLocation().catch(() => {}));

/* ================== FORM THÊM BÁO CÁO ================== */
function buildFormOptions() {
  el.typeGrid.innerHTML = POLLUTION_TYPES.map(t => `
    <button type="button" class="type-opt" role="radio" aria-checked="false" data-type="${t.id}">
      <span>${t.icon}</span>${escapeHtml(t.label)}
    </button>`).join('');

  el.levelGrid.innerHTML = LEVEL_IDS.map(id => `
    <button type="button" class="level-opt" role="radio" aria-checked="false" data-level="${id}">
      <span class="dot" aria-hidden="true"></span>${LEVELS[id].label}
    </button>`).join('');

  el.typeGrid.addEventListener('click', (e) => {
    const b = e.target.closest('.type-opt');
    if (!b) return;
    state.formType = b.dataset.type;
    el.typeGrid.querySelectorAll('.type-opt').forEach(x =>
      x.setAttribute('aria-checked', String(x === b)));
  });

  el.levelGrid.addEventListener('click', (e) => {
    const b = e.target.closest('.level-opt');
    if (!b) return;
    state.formLevel = b.dataset.level;
    el.levelGrid.querySelectorAll('.level-opt').forEach(x =>
      x.setAttribute('aria-checked', String(x === b)));
  });
}

async function compressImage(file) {
  const dataUrl = await new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });
  const img = await new Promise((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = reject;
    im.src = dataUrl;
  });
  const max = 900;
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.72);
}

async function onPickPhoto(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  try {
    state.photo = await compressImage(file);
    el.photoPreview.src = state.photo;
    el.photoPreview.hidden = false;
    el.photoPlaceholder.style.display = 'none';
    el.photoRemoveBtn.hidden = false;
  } catch {
    toast('Không đọc được ảnh. Thử ảnh khác nhé.', true);
  }
  e.target.value = '';
}

function clearPhoto() {
  state.photo = null;
  el.photoPreview.hidden = true;
  el.photoPreview.src = '';
  el.photoPlaceholder.style.display = '';
  el.photoRemoveBtn.hidden = true;
}

function updateSubmitState() {
  el.submitBtn.disabled = !(state.formType && state.formLevel && state.coords);
  el.locStatus.classList.toggle('ok', Boolean(state.coords));
  if (state.coords) {
    el.locStatusText.textContent = `📍 Vị trí: ${state.coords.lat.toFixed(5)}, ${state.coords.lng.toFixed(5)}`;
  }
}

function openSheet() {
  state.lastFocus = document.activeElement;
  el.overlay.hidden = false;
  document.body.style.overflow = 'hidden';

  // Reset lựa chọn (giữ ảnh nếu người dùng vừa chụp trước đó? → reset hết cho sạch)
  state.formType = null; state.formLevel = null;
  el.typeGrid.querySelectorAll('.type-opt').forEach(x => x.setAttribute('aria-checked', 'false'));
  el.levelGrid.querySelectorAll('.level-opt').forEach(x => x.setAttribute('aria-checked', 'false'));
  el.descInput.value = '';
  el.descCount.textContent = '0';
  clearPhoto();

  state.coords = null;
  el.locStatus.classList.remove('ok', 'error');
  el.locStatusText.textContent = 'Đang lấy vị trí GPS…';
  el.submitBtn.disabled = true;

  getMyLocation({ pan: false, silent: true })
    .then(me => { state.coords = me; updateSubmitState(); })
    .catch(() => {
      el.locStatus.classList.add('error');
      el.locStatusText.textContent = 'Không lấy được vị trí — cho phép quyền GPS để gửi báo cáo.';
    });

  setTimeout(() => el.photoBtn.focus(), 60);
}

function closeSheet() {
  if (el.overlay.hidden) return;
  el.overlay.hidden = true;
  document.body.style.overflow = '';
  if (state.lastFocus && document.contains(state.lastFocus)) {
    state.lastFocus.focus();
    state.lastFocus = null;
  }
}

async function submitReport(e) {
  e.preventDefault();
  if (!state.formType || !state.formLevel || !state.coords) return;

  el.submitBtn.disabled = true;
  el.submitLabel.textContent = 'Đang gửi…';
  el.submitSpinner.hidden = false;
  // Giả lập độ trễ mạng — thay bằng API thực khi có backend
  await new Promise(r => setTimeout(r, 550));

  const report = DataBus.addUserReport({
    typeId: state.formType,
    levelId: state.formLevel,
    lat: state.coords.lat,
    lng: state.coords.lng,
    desc: el.descInput.value.trim(),
    photo: state.photo,
  });

  el.submitLabel.textContent = 'Gửi báo cáo';
  el.submitSpinner.hidden = true;

  if (!report) {
    toast('Lưu báo cáo thất bại — bộ nhớ đầy. Thử ảnh nhỏ hơn.', true);
    el.submitBtn.disabled = false;
    return;
  }

  closeSheet();
  toast('✅ Đã gửi báo cáo. Cảm ơn bạn!');
  announce('Báo cáo đã được gửi');
  state.map.setView([report.lat, report.lng], Math.max(state.map.getZoom(), 16));
  setTimeout(() => openCard(report.id, { focus: false }), 450);
}

/* ================== THEME ================== */
function applyTheme(theme) {
  state.theme = theme;
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem('bdx_theme', theme); } catch {}
}
function initTheme() {
  let saved = null;
  try { saved = localStorage.getItem('bdx_theme'); } catch {}
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  applyTheme(saved || (prefersDark ? 'dark' : 'light'));
}
el.themeBtn.addEventListener('click', () => {
  applyTheme(state.theme === 'dark' ? 'light' : 'dark');
});

/* ================== SỰ KIỆN TOÀN CỤC ================== */
function bindGlobalEvents() {
  // Tìm kiếm
  let deb;
  el.searchInput.addEventListener('input', () => {
    clearTimeout(deb);
    deb = setTimeout(() => {
      state.filters.q = el.searchInput.value;
      el.clearSearchBtn.hidden = !el.searchInput.value;
      applyFilters();
    }, 220);
  });
  el.clearSearchBtn.addEventListener('click', () => {
    el.searchInput.value = '';
    state.filters.q = '';
    el.clearSearchBtn.hidden = true;
    applyFilters();
    el.searchInput.focus();
  });

  // Bộ lọc toggle
  el.filterToggleBtn.addEventListener('click', () => {
    const open = el.filterPanel.hidden;
    el.filterPanel.hidden = !open;
    el.filterToggleBtn.setAttribute('aria-expanded', String(open));
  });

  // Đóng panel/ card khi bấm ngoài
  document.addEventListener('pointerdown', (e) => {
    if (!el.filterPanel.hidden && !e.target.closest('#filterPanel, #filterToggleBtn')) {
      el.filterPanel.hidden = true;
      el.filterToggleBtn.setAttribute('aria-expanded', 'false');
    }
  });

  // FAB + sheet
  el.addFab.addEventListener('click', openSheet);
  el.sheetClose.addEventListener('click', closeSheet);
  el.overlay.addEventListener('pointerdown', (e) => {
    if (e.target === el.overlay) closeSheet();
  });

  // Photo
  el.photoBtn.addEventListener('click', () => el.photoInput.click());
  el.photoInput.addEventListener('change', onPickPhoto);
  el.photoRemoveBtn.addEventListener('click', clearPhoto);

  // Form
  el.addForm.addEventListener('submit', submitReport);
  el.descInput.addEventListener('input', () => {
    el.descCount.textContent = String(el.descInput.value.length);
  });

  // Nút đóng dòng kết quả tìm kiếm
  el.clearResultBtn.addEventListener('click', () => {
    el.resultRow.hidden = true;
  });
}

/* ================== KEYBOARD SHORTCUTS ================== */
function bindKeyboard() {
  document.addEventListener('keydown', (e) => {
    const inField = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '');
    if (e.key === 'Escape') {
      if (!el.overlay.hidden) closeSheet();
      else if (!el.detailOverlay.hidden) closeDetail();
      else if (!el.card.hidden) closeCard();
      else if (!el.filterPanel.hidden) { el.filterPanel.hidden = true; el.filterToggleBtn.setAttribute('aria-expanded', 'false'); }
      else if (inField) document.activeElement.blur();
    }
    if (inField || !el.overlay.hidden) return;
    if (e.key === 'a' || e.key === 'A') { e.preventDefault(); openSheet(); }
    if (e.key === 'l' || e.key === 'L') { e.preventDefault(); getMyLocation().catch(() => {}); }
    if (e.key === 'f' || e.key === 'F') { e.preventDefault(); el.filterToggleBtn.click(); }
    if (e.key === 'h' || e.key === 'H') { e.preventDefault(); el.heatToggleBtn.click(); }
    if (e.key === 't' || e.key === 'T') { e.preventDefault(); el.themeBtn.click(); }
    if (e.key === '/') { e.preventDefault(); el.searchInput.focus(); }
  });
}

/* ================== CHÚ THÍCH MÀU ================== */
function buildLegend() {
  el.legend.innerHTML = LEVEL_IDS.map(id => `
    <span class="legend-item" role="listitem" data-level="${id}" title="${escapeHtml(LEVELS[id].label)}">
      <span class="dot" aria-hidden="true"></span>${escapeHtml(LEVELS[id].label)}
    </span>`).join('');
}

/* ================== LEGEND NHIỆT ================== */
function buildHeatLegend() {
  const div = document.createElement('div');
  div.className = 'heat-legend';
  div.hidden = true;
  div.innerHTML = '<span class="lo">Thấp</span><span class="bar"></span><span class="hi">Cao</span>';
  el.legendBar.appendChild(div);
  el.heatLegend = div;
}

/* ================== SENSOR PILL ================== */
function updateSensorPill(count, ok) {
  el.sensorPill.classList.toggle('error', !ok);
  el.sensorPill.innerHTML = `<span class="dot"></span>${count} cảm biến trực tuyến`;
}

/* ================== KHỞI ĐỘNG ================== */
async function start() {
  initTheme();
  initMap();
  buildLegend();
  buildHeatLegend();
  buildChips();
  buildFormOptions();
  bindGlobalEvents();
  bindKeyboard();

  DataBus.onReload((reports) => {
    state.reports = reports;
    applyFilters();
    updateSensorPill(DataBus.sensorCount(), true);
  });

  try {
    await DataBus.loadAll();
  } catch {
    toast('Không tải được dữ liệu báo cáo.', true);
    updateSensorPill(0, false);
  }
}

start();
