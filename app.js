(() => {
  const CONFIG = window.EXSEARCH_CONFIG || {};
  const API_URL = String(CONFIG.API_URL || '').trim();
  const isApiMode = /^https:\/\//i.test(API_URL);

  const state = {
    records: [],
    filtered: [],
    adminPassword: '',
    adminUnlocked: false,
    editingId: null,
    mode: isApiMode ? 'sheet' : 'demo'
  };

  const $ = (id) => document.getElementById(id);
  const els = {
    searchInput: $('searchInput'),
    teamFilter: $('teamFilter'),
    wingFilter: $('wingFilter'),
    clearBtn: $('clearBtn'),
    resultsGrid: $('resultsGrid'),
    resultsTitle: $('resultsTitle'),
    resultsMeta: $('resultsMeta'),
    emptyState: $('emptyState'),
    statusStrip: $('statusStrip'),
    dataModeLabel: $('dataModeLabel'),
    toast: $('toast'),
    adminDialog: $('adminDialog'),
    adminOpenBtn: $('adminOpenBtn'),
    adminCloseBtn: $('adminCloseBtn'),
    adminLoginView: $('adminLoginView'),
    adminPanelView: $('adminPanelView'),
    adminLoginForm: $('adminLoginForm'),
    adminPasswordInput: $('adminPasswordInput'),
    adminLoginMessage: $('adminLoginMessage'),
    adminSearchInput: $('adminSearchInput'),
    adminTableBody: $('adminTableBody'),
    adminModeNotice: $('adminModeNotice'),
    addRecordBtn: $('addRecordBtn'),
    recordDialog: $('recordDialog'),
    recordForm: $('recordForm'),
    recordDialogTitle: $('recordDialogTitle'),
    recordId: $('recordId'),
    recordName: $('recordName'),
    recordExtension: $('recordExtension'),
    recordTeam: $('recordTeam'),
    recordWing: $('recordWing'),
    recordCloseBtn: $('recordCloseBtn'),
    cancelRecordBtn: $('cancelRecordBtn'),
    deleteRecordBtn: $('deleteRecordBtn'),
    recordFormMessage: $('recordFormMessage')
  };

  function normalize(value) {
    return String(value ?? '')
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[._/\\-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function sortRecords(records) {
    return [...records].sort((a, b) => {
      const team = a.team.localeCompare(b.team, undefined, { sensitivity: 'base' });
      if (team !== 0) return team;
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    });
  }

  function getSearchScore(record, q) {
    if (!q) return 100;
    const name = normalize(record.name);
    const team = normalize(record.team);
    const ext = normalize(record.extension);
    const wing = normalize(record.wing);
    if (ext === q) return 0;
    if (name === q) return 1;
    if (team === q) return 2;
    if (name.startsWith(q)) return 3;
    if (team.startsWith(q)) return 4;
    if (name.includes(q)) return 5;
    if (team.includes(q)) return 6;
    if (ext.includes(q)) return 7;
    if (wing.includes(q)) return 8;
    return 999;
  }

  async function loadDirectory() {
    setStatus('Loading directory…');
    try {
      let records;
      if (isApiMode) {
        const res = await fetch(`${API_URL}?action=list&_=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) throw new Error(`Directory API returned ${res.status}`);
        const payload = await res.json();
        if (!payload.ok || !Array.isArray(payload.data)) throw new Error(payload.error || 'Invalid API response');
        records = payload.data;
        els.dataModeLabel.textContent = 'Live Google Sheet';
        setStatus('<strong>Live:</strong> synced with Google Sheet');
      } else {
        const base = Array.isArray(window.EXSEARCH_SEED_DATA) ? window.EXSEARCH_SEED_DATA : [];
        const saved = localStorage.getItem('exsearch-demo-records');
        records = saved ? JSON.parse(saved) : base;
        els.dataModeLabel.textContent = 'Demo data';
        setStatus('<strong>Preview mode:</strong> connect Google Apps Script to make edits sync to the Sheet');
      }
      state.records = records.map(cleanRecord).filter(Boolean);
      populateFilters();
      applyFilters();
      if (state.adminUnlocked) renderAdminTable();
    } catch (error) {
      console.error(error);
      els.resultsMeta.textContent = 'Directory could not be loaded.';
      setStatus(`<strong>Connection issue:</strong> ${escapeHtml(error.message)}`);
      state.records = [];
      applyFilters();
    }
  }

  function cleanRecord(r) {
    if (!r || !r.name || !r.extension) return null;
    return {
      id: String(r.id || `ex-${Math.random().toString(36).slice(2, 9)}`),
      name: String(r.name).trim(),
      extension: String(r.extension).trim(),
      team: String(r.team || 'Unassigned').trim(),
      wing: String(r.wing || 'Common').trim()
    };
  }

  function populateFilters() {
    const currentTeam = els.teamFilter.value;
    const currentWing = els.wingFilter.value;
    const teams = [...new Set(state.records.map(r => r.team))].sort((a,b) => a.localeCompare(b));
    const wings = [...new Set(state.records.map(r => r.wing))].sort((a,b) => a.localeCompare(b));
    els.teamFilter.innerHTML = '<option value="">All teams</option>' + teams.map(t => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join('');
    els.wingFilter.innerHTML = '<option value="">All wings</option>' + wings.map(w => `<option value="${escapeHtml(w)}">${escapeHtml(w)}</option>`).join('');
    if (teams.includes(currentTeam)) els.teamFilter.value = currentTeam;
    if (wings.includes(currentWing)) els.wingFilter.value = currentWing;
  }

  function applyFilters() {
    const raw = els.searchInput.value.trim();
    const q = normalize(raw);
    const teamFilter = els.teamFilter.value;
    const wingFilter = els.wingFilter.value;
    const ranked = state.records
      .map(record => ({ record, score: getSearchScore(record, q) }))
      .filter(x => x.score < 999)
      .filter(x => !teamFilter || x.record.team === teamFilter)
      .filter(x => !wingFilter || x.record.wing === wingFilter)
      .sort((a, b) => a.score - b.score || a.record.name.localeCompare(b.record.name));

    state.filtered = ranked.map(x => x.record);
    renderResults(raw, teamFilter, wingFilter);
  }

  function renderResults(rawQuery, teamFilter, wingFilter) {
    const records = state.filtered;
    const exactTeam = rawQuery && state.records.find(r => normalize(r.team) === normalize(rawQuery))?.team;
    const contextTeam = teamFilter || exactTeam;
    const contextWing = wingFilter;

    if (contextTeam && contextWing) els.resultsTitle.textContent = `${contextTeam} · ${contextWing}`;
    else if (contextTeam) els.resultsTitle.textContent = contextTeam;
    else if (contextWing) els.resultsTitle.textContent = contextWing;
    else if (rawQuery) els.resultsTitle.textContent = `Results for “${rawQuery}”`;
    else els.resultsTitle.textContent = 'Directory';

    els.resultsMeta.textContent = `${records.length} ${records.length === 1 ? 'entry' : 'entries'} found`;
    els.emptyState.classList.toggle('hidden', records.length !== 0);
    els.resultsGrid.innerHTML = records.map(renderCard).join('');

    els.resultsGrid.querySelectorAll('[data-copy-ext]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const ext = btn.dataset.copyExt;
        try {
          await navigator.clipboard.writeText(ext);
          showToast(`Extension ${ext} copied`);
        } catch {
          showToast(`Extension: ${ext}`);
        }
      });
    });
  }

  function renderCard(r) {
    return `
      <article class="person-card">
        <div class="card-top">
          <div>
            <h3 class="person-name">${escapeHtml(r.name)}</h3>
            <div class="chips">
              <span class="chip">${escapeHtml(r.team)}</span>
              <span class="chip">${escapeHtml(r.wing)}</span>
            </div>
          </div>
          <button type="button" class="extension-btn" data-copy-ext="${escapeHtml(r.extension)}" title="Copy extension ${escapeHtml(r.extension)}">${escapeHtml(r.extension)}</button>
        </div>
        <div class="team-line">Extension for <strong>${escapeHtml(r.name)}</strong></div>
      </article>`;
  }

  function setStatus(html) {
    els.statusStrip.innerHTML = html;
  }

  let toastTimer;
  function showToast(message) {
    els.toast.textContent = message;
    els.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => els.toast.classList.remove('show'), 1800);
  }

  function resetSearch() {
    els.searchInput.value = '';
    els.teamFilter.value = '';
    els.wingFilter.value = '';
    applyFilters();
    els.searchInput.focus();
  }

  async function apiPost(body) {
    if (!isApiMode) throw new Error('API is not configured');
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body),
      redirect: 'follow'
    });
    if (!res.ok) throw new Error(`API returned ${res.status}`);
    const payload = await res.json();
    if (!payload.ok) throw new Error(payload.error || 'Request failed');
    return payload;
  }

  function openAdmin() {
    if (!isApiMode) {
      showToast('Connect the Google Sheet backend to use Admin');
      return;
    }
    els.adminDialog.showModal();
    if (state.adminUnlocked) {
      showAdminPanel();
    } else {
      els.adminLoginView.classList.remove('hidden');
      els.adminPanelView.classList.add('hidden');
      els.adminPasswordInput.value = '';
      els.adminLoginMessage.textContent = '';
      setTimeout(() => els.adminPasswordInput.focus(), 30);
    }
  }

  async function loginAdmin(password) {
    els.adminLoginMessage.textContent = '';
    if (!password) return;
    try {
      if (!isApiMode) throw new Error('Google Sheet backend is not connected');
      await apiPost({ action: 'auth', password });
      state.adminPassword = password;
      state.adminUnlocked = true;
      showAdminPanel();
    } catch (error) {
      els.adminLoginMessage.textContent = error.message;
    }
  }

  function showAdminPanel() {
    els.adminLoginView.classList.add('hidden');
    els.adminPanelView.classList.remove('hidden');
    els.adminModeNotice.textContent = 'Live mode: saved changes are written to the Google Sheet.';
    renderAdminTable();
  }

  function renderAdminTable() {
    const q = normalize(els.adminSearchInput.value);
    const records = sortRecords(state.records).filter(r => !q || [r.name,r.extension,r.team,r.wing].some(v => normalize(v).includes(q)));
    els.adminTableBody.innerHTML = records.map(r => `
      <tr>
        <td><strong>${escapeHtml(r.name)}</strong></td>
        <td>${escapeHtml(r.extension)}</td>
        <td>${escapeHtml(r.team)}</td>
        <td>${escapeHtml(r.wing)}</td>
        <td><div class="row-actions"><button class="small-btn" type="button" data-edit-id="${escapeHtml(r.id)}">Edit</button></div></td>
      </tr>`).join('');
    els.adminTableBody.querySelectorAll('[data-edit-id]').forEach(btn => btn.addEventListener('click', () => openRecordEditor(btn.dataset.editId)));
  }

  function openRecordEditor(id = null) {
    state.editingId = id;
    const record = id ? state.records.find(r => r.id === id) : null;
    els.recordDialogTitle.textContent = record ? 'Edit record' : 'Add record';
    els.recordId.value = record?.id || '';
    els.recordName.value = record?.name || '';
    els.recordExtension.value = record?.extension || '';
    els.recordTeam.value = record?.team || '';
    els.recordWing.value = record?.wing || '';
    els.recordFormMessage.textContent = '';
    els.deleteRecordBtn.classList.toggle('hidden', !record);
    els.recordDialog.showModal();
    setTimeout(() => els.recordName.focus(), 30);
  }

  async function saveRecordFromForm() {
    const record = {
      id: els.recordId.value || '',
      name: els.recordName.value.trim(),
      extension: els.recordExtension.value.trim(),
      team: els.recordTeam.value.trim(),
      wing: els.recordWing.value.trim()
    };
    if (!record.name || !record.team || !record.wing || !/^\d{3,6}$/.test(record.extension)) {
      els.recordFormMessage.textContent = 'Please complete all fields. Extension must be 3–6 digits.';
      return;
    }

    try {
      if (isApiMode) {
        const action = record.id ? 'update' : 'add';
        await apiPost({ action, password: state.adminPassword, record });
        await loadDirectory();
      } else {
        if (record.id) {
          const index = state.records.findIndex(r => r.id === record.id);
          if (index >= 0) state.records[index] = record;
        } else {
          record.id = `local-${Date.now()}`;
          state.records.push(record);
        }
        persistDemo();
        populateFilters();
        applyFilters();
        renderAdminTable();
      }
      els.recordDialog.close();
      showToast(record.id ? 'Record saved' : 'Record added');
    } catch (error) {
      els.recordFormMessage.textContent = error.message;
    }
  }

  async function deleteCurrentRecord() {
    const id = els.recordId.value;
    if (!id) return;
    const record = state.records.find(r => r.id === id);
    if (!record) return;
    if (!confirm(`Delete ${record.name} (${record.extension})?`)) return;
    try {
      if (isApiMode) {
        await apiPost({ action: 'delete', password: state.adminPassword, id });
        await loadDirectory();
      } else {
        state.records = state.records.filter(r => r.id !== id);
        persistDemo();
        populateFilters();
        applyFilters();
        renderAdminTable();
      }
      els.recordDialog.close();
      showToast('Record deleted');
    } catch (error) {
      els.recordFormMessage.textContent = error.message;
    }
  }

  function persistDemo() {
    localStorage.setItem('exsearch-demo-records', JSON.stringify(state.records));
  }

  els.searchInput.addEventListener('input', applyFilters);
  els.teamFilter.addEventListener('change', applyFilters);
  els.wingFilter.addEventListener('change', applyFilters);
  els.clearBtn.addEventListener('click', resetSearch);

  els.adminOpenBtn.addEventListener('click', openAdmin);
  els.adminCloseBtn.addEventListener('click', () => els.adminDialog.close());
  els.adminLoginForm.addEventListener('submit', (event) => {
    event.preventDefault();
    loginAdmin(els.adminPasswordInput.value);
  });
  els.adminSearchInput.addEventListener('input', renderAdminTable);
  els.addRecordBtn.addEventListener('click', () => openRecordEditor());

  els.recordCloseBtn.addEventListener('click', () => els.recordDialog.close());
  els.cancelRecordBtn.addEventListener('click', () => els.recordDialog.close());
  els.recordForm.addEventListener('submit', (event) => {
    event.preventDefault();
    saveRecordFromForm();
  });
  els.deleteRecordBtn.addEventListener('click', deleteCurrentRecord);

  document.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      if (!els.adminDialog.open && !els.recordDialog.open) els.searchInput.focus();
    }
    if (event.key === 'Escape') {
      if (els.recordDialog.open) els.recordDialog.close();
      else if (els.adminDialog.open) els.adminDialog.close();
    }
  });

  loadDirectory();
})();
