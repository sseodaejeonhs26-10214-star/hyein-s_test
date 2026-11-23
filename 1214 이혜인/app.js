'use strict';

// 서버 없이 사용하는 연습용 앱: 현재 브라우저의 localStorage에만 저장합니다.
const KEY = 'pet-finder-v1';
const $ = (selector) => document.querySelector(selector);
const escapeHTML = (value) => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let pets = [];
try {
  const saved = JSON.parse(localStorage.getItem(KEY) || '[]');
  if (Array.isArray(saved)) pets = saved.filter(p => p && typeof p.id === 'string' && Number.isFinite(p.lat) && Number.isFinite(p.lng) && Array.isArray(p.reports));
} catch { toast('저장 정보를 읽지 못했습니다. 브라우저 저장 설정을 확인해주세요.'); }
let map, markers, pickMap, pickMarker;
let selectedId = null;

function toast(message) {
  $('#toast').textContent = message;
  $('#toast').style.display = 'block';
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { $('#toast').style.display = 'none'; }, 4500);
}
function persist(next) {
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
    pets = next;
    render();
    return true;
  } catch { toast('저장 공간이 부족하거나 저장이 차단되었습니다. 더 작은 사진을 사용해주세요.'); return false; }
}
function photo(pet) {
  return /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(pet.photo || '')
    ? `<img class="pet-image" src="${pet.photo}" alt="${escapeHTML(pet.name)} 사진">`
    : `<div class="pet-image placeholder" role="img" aria-label="사진 없음">${pet.type === '고양이' ? '🐱' : '🐶'}</div>`;
}
function date(value) { const d = new Date(value); return Number.isNaN(d.getTime()) ? '미입력' : d.toLocaleString('ko-KR'); }
function badge(pet) { return `<span class="badge ${pet.status === 'found' ? 'found' : ''}">${pet.status === 'found' ? '찾았어요' : '찾고 있어요'}</span>`; }
function render() {
  const term = $('#search').value.trim().toLowerCase();
  const type = $('#type-filter').value;
  const status = $('#status-filter').value;
  const days = Number($('#date-filter').value);
  const filtered = pets.filter(p => (!type || p.type === type) && (!status || p.status === status)
    && (!days || Date.now() - p.createdAt <= days * 86400000)
    && [p.name,p.region,p.breed,p.color].join(' ').toLowerCase().includes(term)).sort((a,b) => b.createdAt - a.createdAt);
  $('#count').textContent = `${filtered.length}마리`;
  $('#list').innerHTML = filtered.length ? filtered.map(p => `<article class="card">${photo(p)}<div class="card-body">${badge(p)}<h3>${escapeHTML(p.name)}</h3><p>${escapeHTML(p.type)} · ${escapeHTML(p.breed || '품종 모름')}</p><p>📍 ${escapeHTML(p.region)}</p><p>실종: ${escapeHTML(date(p.lostAt))}</p><button data-detail="${escapeHTML(p.id)}" class="secondary">상세 정보 · 목격 제보</button></div></article>`).join('') : '<div class="empty">조건에 맞는 등록 글이 없습니다.<br>실종 동물을 등록하거나 검색 조건을 바꿔보세요.</div>';
  if (markers) {
    markers.clearLayers();
    filtered.forEach(p => {
      const button = document.createElement('button');
      button.textContent = `${p.name} · 상세 보기`;
      button.addEventListener('click', () => showDetail(p.id));
      L.circleMarker([p.lat,p.lng], {radius:10,color:p.status === 'found' ? '#687c72' : '#246b53',fillOpacity:.85}).addTo(markers).bindPopup(button);
    });
  }
}
function createMap(id) {
  const instance = L.map(id).setView([37.5665,126.978],12);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).addTo(instance);
  return instance;
}
if (window.L) {
  map = createMap('map');
  markers = L.layerGroup().addTo(map);
} else {
  $('#map').textContent = '지도를 불러오지 못했습니다. 인터넷 연결을 확인해주세요.';
  $('#map-note').textContent = '지도 없이도 위도·경도를 입력해 등록할 수 있습니다.';
}
$('#new-post').addEventListener('click', () => {
  $('#register-form').reset();
  $('#form-error').textContent = '';
  $('#register-dialog').showModal();
  if (window.L && !pickMap) {
    pickMap = createMap('pick-map');
    pickMap.on('click', ({latlng}) => {
      $('#register-form').elements.lat.value = latlng.lat.toFixed(6);
      $('#register-form').elements.lng.value = latlng.lng.toFixed(6);
      if (pickMarker) pickMap.removeLayer(pickMarker);
      pickMarker = L.marker(latlng).addTo(pickMap);
    });
  }
  if (pickMarker) { pickMap.removeLayer(pickMarker); pickMarker = null; }
  if (!window.L) $('#pick-map').textContent = '지도 연결 실패 · 아래에 위도·경도를 입력해주세요.';
  requestAnimationFrame(() => pickMap?.invalidateSize());
});
document.querySelectorAll('.close').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));
['#search','#type-filter','#status-filter','#date-filter'].forEach(selector => $(selector).addEventListener('input', render));
$('#list').addEventListener('click', e => { const button = e.target.closest('[data-detail]'); if (button) showDetail(button.dataset.detail); });
$('#my-location').addEventListener('click', () => {
  if (!map) return toast('지도를 먼저 불러와주세요.');
  if (!navigator.geolocation) return toast('이 브라우저는 위치 기능을 지원하지 않습니다.');
  navigator.geolocation.getCurrentPosition(({coords}) => {
    map.setView([coords.latitude,coords.longitude],14);
    toast('현재 위치 주변으로 지도를 이동했습니다.');
  }, () => toast('위치를 가져오지 못했습니다. 위치 권한을 확인해주세요.'), {timeout:10000});
});
function readPhoto(file) {
  return new Promise((resolve,reject) => {
    if (!file || !file.size) return resolve('');
    if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024) return reject(new Error('JPG·PNG·WebP 사진을 2MB 이하로 선택해주세요.'));
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('사진을 읽지 못했습니다.'));
    reader.readAsDataURL(file);
  });
}
$('#register-form').addEventListener('submit', async e => {
  e.preventDefault();
  const form = e.currentTarget;
  const data = Object.fromEntries(new FormData(form));
  if (!data.name.trim() || !data.region.trim()) { $('#form-error').textContent = '이름과 실종 장소를 입력해주세요.'; return; }
  if (new Date(data.lostAt).getTime() > Date.now()) { $('#form-error').textContent = '실종 일시는 현재보다 이전으로 입력해주세요.'; return; }
  $('#save-post').disabled = true;
  try {
    const pet = {...data,name:data.name.trim(),region:data.region.trim(),photo:await readPhoto(data.photo),id:crypto.randomUUID(),lat:Number(data.lat),lng:Number(data.lng),status:'missing',createdAt:Date.now(),reports:[]};
    if (persist([...pets,pet])) {
      $('#search').value = ''; $('#type-filter').value = ''; $('#status-filter').value = 'missing'; $('#date-filter').value = '';
      render();
      $('#register-dialog').close();
      map?.setView([pet.lat,pet.lng],14);
      toast('이 브라우저에 실종 동물을 등록했습니다.');
    }
  } catch (error) { $('#form-error').textContent = error.message; }
  finally { $('#save-post').disabled = false; }
});
function showDetail(id) {
  selectedId = id;
  const p = pets.find(p => p.id === id);
  if (!p) return;
  const fields = {종류:p.type,품종:p.breed || '모름','털 색':p.color || '모름',나이:p.age === '' ? '모름' : `${p.age}세`,성별:p.sex,특징:p.features || '미입력','실종 일시':date(p.lostAt),장소:p.region,등록일:date(p.createdAt)};
  $('#detail').innerHTML = `${photo(p)}<h2>${escapeHTML(p.name)} ${badge(p)}</h2><dl>${Object.entries(fields).map(([k,v]) => `<dt>${k}</dt><dd>${escapeHTML(v)}</dd>`).join('')}</dl><button id="toggle-status" class="secondary">${p.status === 'found' ? '다시 찾고 있어요' : '찾았어요 처리'}</button><h3>목격 제보 ${p.reports.length}건</h3><p class="muted">제보는 이 브라우저에서만 확인할 수 있습니다. 주인에게 전송되지 않습니다.</p><div>${p.reports.map(r => `<div class="reports"><small>${escapeHTML(date(r.at))}</small><p>${escapeHTML(r.text)}</p></div>`).join('') || '<p class="muted">아직 제보가 없습니다.</p>'}</div>${p.status === 'missing' ? '<form id="report-form"><label>목격 정보<textarea name="text" required maxlength="1000" placeholder="언제, 어디서 보았는지 남겨주세요."></textarea></label><button>제보 저장</button></form>' : '<p class="muted">찾은 동물은 제보 접수가 종료됩니다.</p>'}`;
  $('#toggle-status').addEventListener('click', () => {
    if (persist(pets.map(p => p.id === selectedId ? {...p,status:p.status === 'found' ? 'missing' : 'found'} : p))) showDetail(selectedId);
  });
  $('#report-form')?.addEventListener('submit', e => {
    e.preventDefault();
    const text = new FormData(e.currentTarget).get('text').trim();
    if (!text) return toast('목격 정보를 입력해주세요.');
    if (persist(pets.map(p => p.id === selectedId ? {...p,reports:[...p.reports,{text,at:Date.now()}]} : p))) { showDetail(selectedId); toast('제보를 이 브라우저에 저장했습니다.'); }
  });
  if (!$('#detail-dialog').open) $('#detail-dialog').showModal();
}
render();
