// ===== CONFIGURATION =====
const API_URL = '/api/v1';
let authToken = localStorage.getItem('token');
let currentUser = JSON.parse(localStorage.getItem('user') || 'null');
let socket = null;
let currentPage = 1;
let currentFilter = 'all';
let currentPriority = '';
let charts = {};

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    const loader = document.getElementById('loader');
    loader.classList.add('fade-out');
    setTimeout(() => {
      loader.style.display = 'none';
      if (authToken && currentUser) {
        initApp();
      } else {
        showAuthPage();
      }
    }, 500);
  }, 1800);

  setupFormListeners();
  setupCostCalculator();
});

// ===== AUTH =====
function showAuthPage() {
  document.getElementById('auth-page').classList.remove('hidden');
  document.getElementById('app').classList.add('hidden');
}

function showLogin() {
  document.getElementById('login-form').classList.remove('hidden');
  document.getElementById('register-form').classList.add('hidden');
}

function showRegister() {
  document.getElementById('register-form').classList.remove('hidden');
  document.getElementById('login-form').classList.add('hidden');
}

function loginDemo(email, password) {
  document.getElementById('loginEmail').value = email;
  document.getElementById('loginPassword').value = password;
  document.getElementById('loginForm').dispatchEvent(new Event('submit'));
}

function setupFormListeners() {
  document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errEl = document.getElementById('loginError');
    errEl.classList.add('hidden');
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: document.getElementById('loginEmail').value,
          password: document.getElementById('loginPassword').value
        })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      authToken = data.token;
      currentUser = data.user;
      localStorage.setItem('token', authToken);
      localStorage.setItem('user', JSON.stringify(currentUser));
      initApp();
    } catch (err) {
      errEl.textContent = err.message;
      errEl.classList.remove('hidden');
    }
  });

  document.getElementById('registerForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errEl = document.getElementById('registerError');
    errEl.classList.add('hidden');
    try {
      const res = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: document.getElementById('regName').value,
          email: document.getElementById('regEmail').value,
          password: document.getElementById('regPassword').value,
          role: document.getElementById('regRole').value,
          company: document.getElementById('regCompany').value
        })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || JSON.stringify(data.errors?.[0]?.msg));
      authToken = data.token;
      currentUser = data.user;
      localStorage.setItem('token', authToken);
      localStorage.setItem('user', JSON.stringify(currentUser));
      initApp();
    } catch (err) {
      errEl.textContent = err.message;
      errEl.classList.remove('hidden');
    }
  });
}

function logout() {
  authToken = null; currentUser = null;
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  if (socket) socket.disconnect();
  document.getElementById('app').classList.add('hidden');
  showAuthPage();
  showLogin();
  showToast('Logged out successfully', '', 'info');
}

// ===== APP INIT =====
function initApp() {
  document.getElementById('auth-page').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  updateUserUI();
  setupRBAC();
  initSocket();
  loadDashboard();
  loadNotifications();
  navigate('dashboard');
}

function updateUserUI() {
  if (!currentUser) return;
  document.getElementById('sidebarName').textContent = currentUser.name;
  document.getElementById('sidebarRole').textContent = currentUser.role;
  document.getElementById('sidebarAvatar').textContent = currentUser.name.charAt(0).toUpperCase();
}

function setupRBAC() {
  if (!currentUser) return;
  const adminNavEl = document.getElementById('adminNav');
  const createNavEl = document.getElementById('createShipmentNav');
  const newShipmentBtnEl = document.getElementById('newShipmentBtn');

  if (currentUser.role === 'customer' || currentUser.role === 'driver') {
    adminNavEl?.classList.add('hidden');
  }
  if (currentUser.role === 'customer') {
    createNavEl?.classList.add('hidden');
    newShipmentBtnEl?.classList.add('hidden');
  }
}

// ===== SOCKET.IO =====
function initSocket() {
  socket = io();
  socket.on('connect', () => {
    socket.emit('user:join', currentUser?.id);
    addLiveFeed('System', 'Connected to live tracking', 'system');
  });
  socket.on('users:online', (count) => {
    const el = document.getElementById('onlineUsers');
    if (el) el.textContent = `${count} online`;
  });
  socket.on('shipment:new', ({ shipment }) => {
    addLiveFeed('New Shipment', `${shipment.trackingNumber} created`, 'new');
    showToast('New shipment created', shipment.trackingNumber, 'success');
    loadDashboardStats();
  });
  socket.on('shipment:updated', ({ trackingNumber, status }) => {
    addLiveFeed('Status Update', `${trackingNumber} → ${formatStatus(status)}`, 'update');
  });
  socket.on('tracking:update', (data) => {
    updateTrackingUI(data);
  });
  socket.on('driver:assigned', ({ shipment }) => {
    showToast('New assignment', `Shipment ${shipment.trackingNumber} assigned to you`, 'info');
    addLiveFeed('Assignment', `Shipment ${shipment.trackingNumber} assigned`, 'assignment');
  });
  socket.on('disconnect', () => {
    addLiveFeed('System', 'Disconnected from live tracking', 'system');
  });
}

function addLiveFeed(title, desc, type) {
  const feedEl = document.getElementById('liveFeed');
  if (!feedEl) return;
  const colors = { new: '#00E5A0', update: '#3B82F6', system: '#555E77', assignment: '#F97316' };
  const item = document.createElement('div');
  item.className = 'feed-item';
  item.style.borderLeftColor = colors[type] || '#00E5A0';
  item.innerHTML = `
    <div class="feed-item-title">${title}</div>
    <div class="feed-item-desc">${desc}</div>
    <div class="feed-item-time">${new Date().toLocaleTimeString()}</div>
  `;
  feedEl.insertBefore(item, feedEl.firstChild);
  if (feedEl.children.length > 20) feedEl.removeChild(feedEl.lastChild);
}

// ===== NAVIGATION =====
function navigate(page) {
  document.querySelectorAll('.page').forEach(p => {
    p.classList.remove('active');
    p.classList.add('hidden');
  });
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const pageEl = document.getElementById(`page-${page}`);
  if (pageEl) {
    pageEl.classList.remove('hidden');
    pageEl.classList.add('active');
  }

  const navLinks = document.querySelectorAll('.nav-item');
  navLinks.forEach(link => {
    if (link.getAttribute('onclick')?.includes(page)) {
      link.classList.add('active');
    }
  });

  const titles = {
    'dashboard': 'Dashboard',
    'shipments': 'Shipments',
    'create-shipment': 'New Shipment',
    'tracking': 'Live Tracking',
    'users': 'User Management',
    'analytics': 'Analytics'
  };
  document.getElementById('pageTitle').textContent = titles[page] || page;

  if (page === 'dashboard') loadDashboard();
  else if (page === 'shipments') loadShipments();
  else if (page === 'tracking') initTracking();
  else if (page === 'users') loadUsers();
  else if (page === 'analytics') loadAnalytics();

  window.scrollTo(0, 0);
}

// ===== API HELPER =====
async function apiCall(endpoint, method = 'GET', body = null) {
  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
    }
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${API_URL}${endpoint}`, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Request failed');
  return data;
}

// ===== DASHBOARD =====
async function loadDashboard() {
  await Promise.all([loadDashboardStats(), loadRecentShipments()]);
}

async function loadDashboardStats() {
  try {
    if (currentUser?.role === 'admin' || currentUser?.role === 'manager') {
      const data = await apiCall('/shipments/dashboard/stats');
      if (data.success) {
        animateCounter('stat-total', data.stats.total);
        animateCounter('stat-transit', data.stats.inTransit);
        animateCounter('stat-delivered', data.stats.delivered);
        animateCounter('stat-pending', data.stats.pending);
        updatePendingBadge(data.stats.pending);
        renderVolumeChart(data.monthlyData || []);
        renderStatusChart(data.stats);
      }
    } else {
      const data = await apiCall('/shipments?limit=5');
      animateCounter('stat-total', data.total || 0);
      const byStatus = (data.docs || []).reduce((acc, s) => { acc[s.status] = (acc[s.status]||0)+1; return acc; }, {});
      animateCounter('stat-transit', byStatus.in_transit || 0);
      animateCounter('stat-delivered', byStatus.delivered || 0);
      animateCounter('stat-pending', byStatus.pending || 0);
      renderStatusChart({ inTransit: byStatus.in_transit||0, delivered: byStatus.delivered||0, pending: byStatus.pending||0, failed: byStatus.failed||0 });
    }
  } catch (err) {
    console.error('Stats error:', err.message);
  }
}

function animateCounter(id, target) {
  const el = document.getElementById(id);
  if (!el) return;
  let current = 0;
  const step = Math.max(1, Math.floor(target / 30));
  const timer = setInterval(() => {
    current = Math.min(current + step, target);
    el.textContent = current.toLocaleString();
    if (current >= target) clearInterval(timer);
  }, 30);
}

function updatePendingBadge(count) {
  const badge = document.getElementById('pendingBadge');
  if (!badge) return;
  if (count > 0) { badge.textContent = count; badge.style.display = ''; }
  else badge.style.display = 'none';
}

async function loadRecentShipments() {
  try {
    const data = await apiCall('/shipments?limit=5');
    const container = document.getElementById('recentShipments');
    if (!container) return;
    if (!data.docs?.length) {
      container.innerHTML = `<div class="empty-state"><div class="empty-icon">📦</div><div class="empty-title">No shipments yet</div><div class="empty-desc">Create your first shipment to get started</div></div>`;
      return;
    }
    container.innerHTML = renderShipmentTable(data.docs, false);
  } catch (err) {
    document.getElementById('recentShipments').innerHTML = `<div class="empty-state">Failed to load shipments</div>`;
  }
}

function refreshDashboard() { loadDashboard(); showToast('Dashboard refreshed', '', 'success'); }

// ===== CHARTS =====
const chartDefaults = {
  color: '#E8EAF0',
  font: { family: 'DM Sans' }
};

function renderVolumeChart(monthlyData) {
  const ctx = document.getElementById('volumeChart');
  if (!ctx) return;
  if (charts.volume) charts.volume.destroy();

  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const counts = Array(12).fill(0);
  monthlyData.forEach(d => { if (d._id >= 1 && d._id <= 12) counts[d._id-1] = d.count; });

  charts.volume = new Chart(ctx, {
    type: 'line',
    data: {
      labels: months,
      datasets: [{
        label: 'Shipments',
        data: counts,
        borderColor: '#00E5A0',
        backgroundColor: 'rgba(0,229,160,0.08)',
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        pointBackgroundColor: '#00E5A0',
        pointRadius: 4,
        pointHoverRadius: 6
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false }, tooltip: { backgroundColor: '#13161E', borderColor: '#242838', borderWidth: 1, titleColor: '#E8EAF0', bodyColor: '#8B91A6' } },
      scales: {
        x: { grid: { color: '#242838' }, ticks: { color: '#8B91A6', font: { size: 12 } } },
        y: { grid: { color: '#242838' }, ticks: { color: '#8B91A6', font: { size: 12 } } }
      }
    }
  });
}

function renderStatusChart(stats) {
  const ctx = document.getElementById('statusChart');
  if (!ctx) return;
  if (charts.status) charts.status.destroy();

  charts.status = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Pending', 'In Transit', 'Delivered', 'Failed'],
      datasets: [{
        data: [stats.pending||0, stats.inTransit||0, stats.delivered||0, stats.failed||0],
        backgroundColor: ['rgba(234,179,8,0.8)', 'rgba(249,115,22,0.8)', 'rgba(0,229,160,0.8)', 'rgba(239,68,68,0.8)'],
        borderColor: '#13161E',
        borderWidth: 3
      }]
    },
    options: {
      responsive: true,
      cutout: '68%',
      plugins: {
        legend: { position: 'bottom', labels: { color: '#8B91A6', padding: 16, font: { size: 12 } } },
        tooltip: { backgroundColor: '#13161E', borderColor: '#242838', borderWidth: 1, titleColor: '#E8EAF0', bodyColor: '#8B91A6' }
      }
    }
  });
}

// ===== SHIPMENTS =====
async function loadShipments(page = 1) {
  currentPage = page;
  const container = document.getElementById('shipmentsTable');
  if (container) container.innerHTML = '<div class="loading-state">Loading shipments...</div>';
  try {
    let url = `/shipments?page=${page}&limit=10`;
    if (currentFilter !== 'all') url += `&status=${currentFilter}`;
    if (currentPriority) url += `&priority=${currentPriority}`;
    const search = document.getElementById('globalSearch')?.value;
    if (search) url += `&search=${encodeURIComponent(search)}`;

    const data = await apiCall(url);
    if (container) container.innerHTML = data.docs?.length ? renderShipmentTable(data.docs, true) : `<div class="empty-state"><div class="empty-icon">📦</div><div class="empty-title">No shipments found</div><div class="empty-desc">Try adjusting your filters</div></div>`;
    renderPagination(data.page, data.totalPages);
  } catch (err) {
    if (container) container.innerHTML = `<div class="empty-state">Error: ${err.message}</div>`;
  }
}

function renderShipmentTable(shipments, showActions) {
  const canEdit = currentUser?.role === 'admin' || currentUser?.role === 'manager' || currentUser?.role === 'driver';
  return `
    <table>
      <thead>
        <tr>
          <th>Tracking #</th>
          <th>Status</th>
          <th>Priority</th>
          <th>From → To</th>
          <th>Weight</th>
          <th>Est. Delivery</th>
          ${showActions && canEdit ? '<th>Actions</th>' : ''}
        </tr>
      </thead>
      <tbody>
        ${shipments.map(s => `
          <tr>
            <td class="td-mono td-primary">${s.trackingNumber}</td>
            <td><span class="badge badge-${s.status}">${formatStatus(s.status)}</span></td>
            <td><span class="priority-badge priority-${s.priority}">${s.priority.toUpperCase()}</span></td>
            <td class="td-primary">${s.sender?.address?.city || '—'} → ${s.recipient?.address?.city || '—'}</td>
            <td>${s.package?.weight} kg</td>
            <td>${s.estimatedDelivery ? new Date(s.estimatedDelivery).toLocaleDateString('en-IN') : '—'}</td>
            ${showActions && canEdit ? `
            <td>
              <button class="action-btn action-view" onclick="viewShipment('${s._id}')">View</button>
              ${(currentUser?.role === 'admin' || currentUser?.role === 'manager' || currentUser?.role === 'driver') ? `<button class="action-btn action-update" onclick="openUpdateStatus('${s._id}', '${s.status}')">Update</button>` : ''}
              ${currentUser?.role === 'admin' ? `<button class="action-btn action-delete" onclick="deleteShipment('${s._id}')">Delete</button>` : ''}
            </td>` : ''}
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function filterShipments(filter, btn) {
  currentFilter = filter;
  document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  loadShipments(1);
}

function applyFilters() {
  currentPriority = document.getElementById('priorityFilter')?.value || '';
  loadShipments(1);
}

function globalSearchHandler(e) {
  if (e.key === 'Enter') {
    const page = document.getElementById('page-shipments');
    if (!page.classList.contains('hidden')) loadShipments(1);
  }
}

function renderPagination(page, totalPages) {
  const el = document.getElementById('shipmentsPagination');
  if (!el || totalPages <= 1) { if (el) el.innerHTML = ''; return; }
  let html = `<button class="page-btn" onclick="loadShipments(${page-1})" ${page<=1?'disabled':''}>← Prev</button>`;
  const start = Math.max(1, page-2), end = Math.min(totalPages, page+2);
  for (let i = start; i <= end; i++) {
    html += `<button class="page-btn ${i===page?'active':''}" onclick="loadShipments(${i})">${i}</button>`;
  }
  html += `<button class="page-btn" onclick="loadShipments(${page+1})" ${page>=totalPages?'disabled':''}>Next →</button>`;
  el.innerHTML = html;
}

// ===== VIEW SHIPMENT MODAL =====
async function viewShipment(id) {
  try {
    const data = await apiCall(`/shipments/${id}`);
    const s = data.shipment;
    openModal('Shipment Details', `
      <div class="detail-grid">
        <div class="detail-item"><div class="detail-label">Tracking #</div><div class="detail-value td-mono">${s.trackingNumber}</div></div>
        <div class="detail-item"><div class="detail-label">Status</div><div class="detail-value"><span class="badge badge-${s.status}">${formatStatus(s.status)}</span></div></div>
        <div class="detail-item"><div class="detail-label">Priority</div><div class="detail-value"><span class="priority-badge priority-${s.priority}">${s.priority.toUpperCase()}</span></div></div>
        <div class="detail-item"><div class="detail-label">Weight</div><div class="detail-value">${s.package?.weight} kg</div></div>
        <div class="detail-item"><div class="detail-label">Sender</div><div class="detail-value">${s.sender?.name}<br><small style="color:var(--text-muted)">${s.sender?.address?.city}, ${s.sender?.address?.country||'India'}</small></div></div>
        <div class="detail-item"><div class="detail-label">Recipient</div><div class="detail-value">${s.recipient?.name}<br><small style="color:var(--text-muted)">${s.recipient?.address?.city}, ${s.recipient?.address?.country||'India'}</small></div></div>
        <div class="detail-item"><div class="detail-label">Driver</div><div class="detail-value">${s.assignedDriver?.name || 'Unassigned'}</div></div>
        <div class="detail-item"><div class="detail-label">Est. Delivery</div><div class="detail-value">${s.estimatedDelivery ? new Date(s.estimatedDelivery).toLocaleDateString('en-IN') : '—'}</div></div>
        ${s.cost ? `<div class="detail-item"><div class="detail-label">Cost</div><div class="detail-value">₹${s.cost?.total?.toLocaleString()}</div></div>` : ''}
        ${s.package?.description ? `<div class="detail-item"><div class="detail-label">Description</div><div class="detail-value">${s.package.description}</div></div>` : ''}
      </div>
      <div style="margin-top:24px">
        <div style="font-weight:600;font-size:14px;margin-bottom:12px">Tracking History</div>
        <div class="tracking-timeline">
          ${(s.trackingHistory || []).reverse().map((e, i) => `
            <div class="timeline-item ${i > 0 ? 'old' : ''}">
              <div class="timeline-status">${formatStatus(e.status)}</div>
              <div class="timeline-desc">${e.description || ''}</div>
              ${e.location?.city ? `<div class="timeline-loc">📍 ${e.location.city}</div>` : ''}
              <div class="timeline-time">${new Date(e.timestamp).toLocaleString('en-IN')}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `);
  } catch (err) {
    showToast('Error', err.message, 'error');
  }
}

// ===== UPDATE STATUS MODAL =====
function openUpdateStatus(id, currentStatus) {
  const statuses = ['pending', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered', 'failed', 'returned', 'cancelled'];
  openModal('Update Shipment Status', `
    <div class="form-group">
      <label>New Status</label>
      <select id="newStatusSelect">
        ${statuses.map(s => `<option value="${s}" ${s===currentStatus?'selected':''}>${formatStatus(s)}</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <label>Current Location (City)</label>
      <input type="text" id="statusCity" placeholder="e.g. Mumbai" />
    </div>
    <div class="form-group">
      <label>Description</label>
      <input type="text" id="statusDesc" placeholder="Status update description" />
    </div>
  `, [{
    text: 'Update Status',
    class: 'btn-primary',
    action: async () => {
      try {
        const status = document.getElementById('newStatusSelect').value;
        const city = document.getElementById('statusCity').value;
        const description = document.getElementById('statusDesc').value;
        await apiCall(`/shipments/${id}/status`, 'PATCH', {
          status,
          location: city ? { city } : undefined,
          description
        });
        closeModal();
        loadShipments(currentPage);
        loadDashboardStats();
        showToast('Status updated', `Shipment status changed to ${formatStatus(status)}`, 'success');
      } catch (err) {
        showToast('Error', err.message, 'error');
      }
    }
  }]);
}

// ===== DELETE SHIPMENT =====
async function deleteShipment(id) {
  if (!confirm('Are you sure you want to delete this shipment?')) return;
  try {
    await apiCall(`/shipments/${id}`, 'DELETE');
    loadShipments(currentPage);
    loadDashboardStats();
    showToast('Shipment deleted', '', 'success');
  } catch (err) {
    showToast('Error', err.message, 'error');
  }
}

// ===== CREATE SHIPMENT FORM =====
function setupCostCalculator() {
  document.addEventListener('change', (e) => {
    if (e.target.closest('#createShipmentForm')) updateCostPreview();
  });
  document.addEventListener('input', (e) => {
    if (e.target.closest('#createShipmentForm')) updateCostPreview();
  });
}

function updateCostPreview() {
  const form = document.getElementById('createShipmentForm');
  if (!form) return;
  const weight = parseFloat(form.querySelector('[name="package.weight"]')?.value) || 0;
  const priority = form.querySelector('[name="priority"]:checked')?.value || 'standard';
  const multiplier = { standard: 1, express: 1.5, urgent: 2.5 };
  const base = Math.round(weight * 50 * (multiplier[priority] || 1));
  const tax = Math.round(base * 0.18);
  const total = base + tax;
  const preview = document.getElementById('costPreview');
  if (preview && weight > 0) {
    preview.innerHTML = `Estimated Cost: <strong>₹${total.toLocaleString()}</strong> <span style="color:var(--text-muted);font-size:12px">(₹${base} + ₹${tax} GST)</span>`;
  }
}

document.addEventListener('submit', async (e) => {
  if (e.target.id === 'createShipmentForm') {
    e.preventDefault();
    try {
      const formData = {};
      const form = e.target;
      
      // Helper to set nested keys
      const setNested = (obj, path, value) => {
        const keys = path.split('.');
        let cur = obj;
        for (let i = 0; i < keys.length - 1; i++) {
          if (!cur[keys[i]]) cur[keys[i]] = {};
          cur = cur[keys[i]];
        }
        cur[keys[keys.length-1]] = value;
      };

      form.querySelectorAll('input, select, textarea').forEach(el => {
        if (!el.name) return;
        if (el.type === 'radio' && !el.checked) return;
        if (el.type === 'checkbox') { setNested(formData, el.name, el.checked); return; }
        if (el.value) setNested(formData, el.name, el.type === 'number' ? parseFloat(el.value) : el.value);
      });

      const data = await apiCall('/shipments', 'POST', formData);
      if (data.success) {
        form.reset();
        showToast('Shipment created!', `Tracking: ${data.shipment.trackingNumber}`, 'success');
        navigate('shipments');
      }
    } catch (err) {
      showToast('Error', err.message, 'error');
    }
  }
});

// ===== TRACKING =====
function initTracking() {
  if (!document.getElementById('liveFeed').children.length) {
    addLiveFeed('System', 'Live tracking active — monitoring all shipments', 'system');
  }
}

async function trackShipment() {
  const input = document.getElementById('trackingInput');
  const trackingNumber = input?.value?.trim();
  if (!trackingNumber) return showToast('Error', 'Enter a tracking number', 'error');

  const result = document.getElementById('trackingResult');
  result.innerHTML = '<div style="color:var(--text-muted);font-size:13px">Searching...</div>';

  try {
    const data = await apiCall(`/shipments/track/${trackingNumber}`);
    const s = data.shipment;
    if (socket) socket.emit('shipment:subscribe', s._id);
    result.innerHTML = `
      <div style="margin-bottom:16px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
          <div>
            <div style="font-family:'Syne',sans-serif;font-weight:700;font-size:16px">${s.trackingNumber}</div>
            <div style="font-size:13px;color:var(--text-secondary)">${s.recipient?.name} • ${s.recipient?.address?.city}</div>
          </div>
          <span class="badge badge-${s.status}">${formatStatus(s.status)}</span>
        </div>
        ${s.estimatedDelivery ? `<div style="font-size:13px;color:var(--text-muted)">Est. delivery: ${new Date(s.estimatedDelivery).toLocaleDateString('en-IN')}</div>` : ''}
      </div>
      <div class="tracking-timeline">
        ${(s.trackingHistory || []).reverse().map((e, i) => `
          <div class="timeline-item ${i > 0 ? 'old' : ''}">
            <div class="timeline-status">${formatStatus(e.status)}</div>
            <div class="timeline-desc">${e.description || ''}</div>
            ${e.location?.city ? `<div class="timeline-loc">📍 ${e.location.city}</div>` : ''}
            <div class="timeline-time">${new Date(e.timestamp).toLocaleString('en-IN')}</div>
          </div>
        `).join('')}
      </div>
    `;
  } catch (err) {
    result.innerHTML = `<div class="form-error">${err.message}</div>`;
  }
}

function updateTrackingUI(data) {
  const result = document.getElementById('trackingResult');
  if (!result?.innerHTML) return;
  const newItem = document.createElement('div');
  newItem.className = 'timeline-item';
  newItem.style.animationDuration = '0.4s';
  newItem.innerHTML = `
    <div class="timeline-status">${formatStatus(data.status)}</div>
    <div class="timeline-desc">${data.description || ''}</div>
    ${data.location?.city ? `<div class="timeline-loc">📍 ${data.location.city}</div>` : ''}
    <div class="timeline-time">${new Date().toLocaleString('en-IN')}</div>
  `;
  const timeline = result.querySelector('.tracking-timeline');
  if (timeline) timeline.insertBefore(newItem, timeline.firstChild);
}

async function publicTrack() {
  const input = document.getElementById('publicTrackInput');
  const trackingNumber = input?.value?.trim();
  if (!trackingNumber) return;
  const result = document.getElementById('publicTrackResult');
  result.classList.remove('hidden');
  result.innerHTML = '<div style="color:var(--text-muted);font-size:13px">Searching...</div>';
  try {
    const res = await fetch(`${API_URL}/shipments/track/${trackingNumber}`);
    const data = await res.json();
    if (!data.success) throw new Error(data.message);
    const s = data.shipment;
    result.innerHTML = `
      <div style="margin-bottom:12px;display:flex;align-items:center;justify-content:space-between">
        <strong>${s.trackingNumber}</strong>
        <span class="badge badge-${s.status}">${formatStatus(s.status)}</span>
      </div>
      <div style="font-size:13px;color:var(--text-secondary)">To: ${s.recipient?.name}, ${s.recipient?.address?.city}</div>
      ${s.estimatedDelivery ? `<div style="font-size:12px;color:var(--text-muted);margin-top:4px">Expected: ${new Date(s.estimatedDelivery).toLocaleDateString('en-IN')}</div>` : ''}
      <div class="tracking-timeline" style="margin-top:16px">
        ${(s.trackingHistory||[]).slice(-3).reverse().map((e,i) => `
          <div class="timeline-item ${i>0?'old':''}">
            <div class="timeline-status">${formatStatus(e.status)}</div>
            ${e.location?.city ? `<div class="timeline-loc">📍 ${e.location.city}</div>` : ''}
            <div class="timeline-time">${new Date(e.timestamp).toLocaleString('en-IN')}</div>
          </div>
        `).join('')}
      </div>
    `;
  } catch(err) {
    result.innerHTML = `<div style="color:var(--accent-red);font-size:13px">Tracking number not found</div>`;
  }
}

// ===== USERS PAGE =====
async function loadUsers() {
  const container = document.getElementById('usersTable');
  if (!container) return;
  container.innerHTML = '<div class="loading-state">Loading users...</div>';
  try {
    const data = await apiCall('/auth/users');
    if (!data.users?.length) {
      container.innerHTML = '<div class="empty-state"><div class="empty-icon">👥</div><div class="empty-title">No users found</div></div>';
      return;
    }
    container.innerHTML = `
      <table>
        <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Company</th><th>Status</th><th>Joined</th></tr></thead>
        <tbody>
          ${data.users.map(u => `
            <tr>
              <td class="td-primary">${u.name}</td>
              <td>${u.email}</td>
              <td><span class="badge badge-${u.role === 'admin' ? 'delivered' : u.role === 'driver' ? 'in_transit' : u.role === 'manager' ? 'out_for_delivery' : 'pending'}">${u.role}</span></td>
              <td>${u.company || '—'}</td>
              <td><span class="badge ${u.isActive ? 'badge-delivered' : 'badge-failed'}">${u.isActive ? 'Active' : 'Inactive'}</span></td>
              <td>${new Date(u.createdAt).toLocaleDateString('en-IN')}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } catch (err) {
    container.innerHTML = `<div class="empty-state">Error: ${err.message}</div>`;
  }
}

// ===== ANALYTICS =====
async function loadAnalytics() {
  try {
    const data = await apiCall('/shipments/dashboard/stats');
    if (!data.success) return;

    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const revenue = Array(12).fill(0);
    const counts = Array(12).fill(0);
    (data.monthlyData || []).forEach(d => {
      if (d._id >= 1 && d._id <= 12) {
        revenue[d._id-1] = d.revenue || 0;
        counts[d._id-1] = d.count || 0;
      }
    });

    // Revenue chart
    const rCtx = document.getElementById('revenueChart');
    if (rCtx) {
      if (charts.revenue) charts.revenue.destroy();
      charts.revenue = new Chart(rCtx, {
        type: 'bar',
        data: {
          labels: months,
          datasets: [{
            label: 'Revenue (₹)',
            data: revenue,
            backgroundColor: 'rgba(59,130,246,0.7)',
            borderColor: '#3B82F6',
            borderWidth: 1,
            borderRadius: 6
          }]
        },
        options: {
          responsive: true,
          plugins: { legend: { labels: { color: '#8B91A6' } }, tooltip: { backgroundColor: '#13161E', borderColor: '#242838', borderWidth: 1, titleColor: '#E8EAF0', bodyColor: '#8B91A6' } },
          scales: { x: { grid: { color: '#242838' }, ticks: { color: '#8B91A6' } }, y: { grid: { color: '#242838' }, ticks: { color: '#8B91A6' } } }
        }
      });
    }

    // Priority pie chart
    const pCtx = document.getElementById('priorityChart');
    if (pCtx) {
      if (charts.priority) charts.priority.destroy();
      charts.priority = new Chart(pCtx, {
        type: 'pie',
        data: {
          labels: ['Standard', 'Express', 'Urgent'],
          datasets: [{
            data: [60, 28, 12],
            backgroundColor: ['rgba(85,94,119,0.8)', 'rgba(59,130,246,0.8)', 'rgba(239,68,68,0.8)'],
            borderColor: '#13161E', borderWidth: 3
          }]
        },
        options: {
          responsive: true,
          plugins: { legend: { position: 'bottom', labels: { color: '#8B91A6', padding: 16 } }, tooltip: { backgroundColor: '#13161E', borderColor: '#242838', borderWidth: 1, titleColor: '#E8EAF0', bodyColor: '#8B91A6' } }
        }
      });
    }

    // Performance line chart
    const perfCtx = document.getElementById('performanceChart');
    if (perfCtx) {
      if (charts.performance) charts.performance.destroy();
      charts.performance = new Chart(perfCtx, {
        type: 'line',
        data: {
          labels: months,
          datasets: [
            { label: 'Total Shipments', data: counts, borderColor: '#3B82F6', backgroundColor: 'rgba(59,130,246,0.05)', tension: 0.4, fill: true, borderWidth: 2 },
            { label: 'Revenue (÷100)', data: revenue.map(r => Math.round(r/100)), borderColor: '#00E5A0', backgroundColor: 'rgba(0,229,160,0.05)', tension: 0.4, fill: true, borderWidth: 2 }
          ]
        },
        options: {
          responsive: true,
          plugins: { legend: { labels: { color: '#8B91A6' } }, tooltip: { backgroundColor: '#13161E', borderColor: '#242838', borderWidth: 1, titleColor: '#E8EAF0', bodyColor: '#8B91A6' } },
          scales: { x: { grid: { color: '#242838' }, ticks: { color: '#8B91A6' } }, y: { grid: { color: '#242838' }, ticks: { color: '#8B91A6' } } }
        }
      });
    }
  } catch (err) {
    console.error('Analytics error:', err.message);
  }
}

// ===== NOTIFICATIONS =====
async function loadNotifications() {
  try {
    const data = await apiCall('/notifications');
    if (!data.success) return;
    const count = data.unreadCount || 0;
    const countEl = document.getElementById('notifCount');
    if (countEl) {
      countEl.textContent = count;
      countEl.style.display = count > 0 ? '' : 'none';
    }
    const listEl = document.getElementById('notifList');
    if (listEl) {
      if (!data.notifications?.length) {
        listEl.innerHTML = '<div style="padding:24px;text-align:center;color:var(--text-muted);font-size:13px">No notifications</div>';
      } else {
        listEl.innerHTML = data.notifications.map(n => `
          <div class="notif-item ${!n.read ? 'unread' : ''}" onclick="readNotification('${n._id}')">
            <div class="notif-item-title">${n.title}</div>
            <div class="notif-item-msg">${n.message}</div>
            <div class="notif-item-time">${timeAgo(n.createdAt)}</div>
          </div>
        `).join('');
      }
    }
  } catch (err) { /* notifications optional */ }
}

async function readNotification(id) {
  try {
    await apiCall(`/notifications/${id}/read`, 'PATCH');
    loadNotifications();
  } catch(err) {}
}

async function markAllRead() {
  try {
    await apiCall('/notifications/mark-all-read', 'PATCH');
    loadNotifications();
    toggleNotifications();
  } catch(err) {}
}

function toggleNotifications() {
  const panel = document.getElementById('notifPanel');
  panel.classList.toggle('hidden');
}

document.addEventListener('click', (e) => {
  const panel = document.getElementById('notifPanel');
  if (panel && !panel.classList.contains('hidden') &&
      !panel.contains(e.target) &&
      !e.target.closest('.notif-btn')) {
    panel.classList.add('hidden');
  }
});

// ===== MODAL =====
function openModal(title, body, actions = []) {
  const actionsHtml = actions.map(a => `<button class="${a.class}" id="modal-action-${Math.random().toString(36).slice(2)}">${a.text}</button>`).join('');
  document.getElementById('modal-body').innerHTML = `
    <div class="modal-header">
      <span>${title}</span>
      <button class="modal-close" onclick="closeModal()">×</button>
    </div>
    <div class="modal-body">${body}</div>
    ${actionsHtml ? `<div class="modal-footer">${actionsHtml}</div>` : ''}
  `;
  document.getElementById('modal-overlay').classList.remove('hidden');
  actions.forEach((a, i) => {
    const btns = document.querySelectorAll('.modal-footer button');
    if (btns[i]) btns[i].addEventListener('click', a.action);
  });
}

function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
  document.getElementById('modal-body').innerHTML = '';
}

// ===== SIDEBAR TOGGLE =====
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  if (window.innerWidth <= 768) {
    sidebar.classList.toggle('mobile-open');
  } else {
    sidebar.classList.toggle('collapsed');
    const main = document.querySelector('.main-content');
    if (main) main.style.marginLeft = sidebar.classList.contains('collapsed') ? '0' : 'var(--sidebar-w)';
  }
}

// ===== TOAST =====
function showToast(title, msg, type = 'info') {
  const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <div class="toast-icon">${icons[type]}</div>
    <div class="toast-content">
      <div class="toast-title">${title}</div>
      ${msg ? `<div class="toast-msg">${msg}</div>` : ''}
    </div>
  `;
  const container = document.getElementById('toast-container');
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(20px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// ===== HELPERS =====
function formatStatus(status) {
  const map = {
    pending: 'Pending', picked_up: 'Picked Up', in_transit: 'In Transit',
    out_for_delivery: 'Out for Delivery', delivered: 'Delivered',
    failed: 'Failed', returned: 'Returned', cancelled: 'Cancelled'
  };
  return map[status] || status;
}

function timeAgo(dateStr) {
  const seconds = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds/60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds/3600)}h ago`;
  return `${Math.floor(seconds/86400)}d ago`;
}
