const app = {
  currentTab: 'dashboard',
  currentFleetSubtab: 'tractor',
  activeTripFilter: 'Tất cả',
  mapTimer: null,
  currentMapTargetIndex: 0,
  
  // Coordinates for GPS simulation
  mapCoords: [
    { name: 'Cảng Cát Lái', top: '65%', left: '25%' },
    { name: 'ICD Sóng Thần', top: '25%', left: '42%' },
    { name: 'Cảng Cái Mép', top: '75%', left: '75%' }
  ],

  // Initialize Application
  init() {
    this.setupEventListeners();
    this.switchTab('dashboard');
    this.startMapSimulation();
    
    // If firebase is active, color the cloud icon in footer green
    if (EportStore.isFirebaseActive) {
      const cloudBtn = document.querySelector('.sidebar-footer button');
      if (cloudBtn) {
        cloudBtn.style.borderColor = 'rgba(16, 185, 129, 0.4)';
        cloudBtn.querySelector('i').style.color = 'var(--accent-emerald)';
      }
    }
    
    // Initial Render
    this.refreshAll();
  },

  // Setup UI event listeners
  setupEventListeners() {
    // Tab switching
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', () => {
        const tabId = item.getAttribute('data-tab');
        this.switchTab(tabId);
      });
    });
  },

  // Switch between tabs
  switchTab(tabId) {
    this.currentTab = tabId;
    
    // Update sidebar active class
    document.querySelectorAll('.nav-item').forEach(item => {
      if (item.getAttribute('data-tab') === tabId) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    // Toggle content views
    document.querySelectorAll('.tab-content').forEach(content => {
      if (content.getAttribute('id') === tabId) {
        content.classList.add('active');
      } else {
        content.classList.remove('active');
      }
    });

    // Specialized tab entry actions
    if (tabId === 'dashboard') {
      this.updateDashboardMetrics();
      this.renderMaintenanceAlerts();
      EportChart.init(EportStore.getTrips());
    } else if (tabId === 'trips') {
      this.renderTrips();
    } else if (tabId === 'fleet') {
      this.renderFleet();
    } else if (tabId === 'drivers') {
      this.renderDrivers();
    } else if (tabId === 'salary') {
      salaryApp.render();
    } else if (tabId === 'fuel') {
      fuelApp.init();
    }
  },

  // Refresh all tables and data
  refreshAll() {
    this.syncResourceStatuses();
    this.updateDashboardMetrics();
    this.renderMaintenanceAlerts();
    this.renderTrips();
    this.renderFleet();
    this.renderDrivers();
    salaryApp.render();
    if (window.fuelApp) {
      fuelApp.render();
    }
    EportChart.update(EportStore.getTrips());
  },

  refreshDashboard() {
    this.refreshAll();
  },

  // Switch Fleet sub-tabs (Tractor/Trailer)
  switchFleetSubtab(type) {
    this.currentFleetSubtab = type;
    const btnTractor = document.getElementById('fleet-tab-tractor');
    const btnTrailer = document.getElementById('fleet-tab-trailer');
    const secTractor = document.getElementById('tractor-section');
    const secTrailer = document.getElementById('trailer-section');
    const btnAdd = document.getElementById('btn-add-vehicle');

    if (type === 'tractor') {
      btnTractor.classList.add('active');
      btnTrailer.classList.remove('active');
      secTractor.style.display = 'block';
      secTrailer.style.display = 'none';
      btnAdd.innerHTML = '<i class="fa-solid fa-plus"></i> Thêm đầu kéo';
    } else {
      btnTractor.classList.remove('active');
      btnTrailer.classList.add('active');
      secTractor.style.display = 'none';
      secTrailer.style.display = 'block';
      btnAdd.innerHTML = '<i class="fa-solid fa-plus"></i> Thêm rơ-moóc';
    }
  },

  // ================= DASHBOARD ACTIONS =================
  updateDashboardMetrics() {
    const trips = EportStore.getTrips();
    const tractors = EportStore.getTractors();
    const trailers = EportStore.getTrailers();
    const drivers = EportStore.getDrivers();

    // Stats
    const activeTripsCount = trips.filter(t => t.status === 'Đang chạy').length;
    const completedTrips = trips.filter(t => t.status === 'Hoàn thành');

    let totalRevenue = 0;
    let totalCosts = 0;
    let totalSalaries = 0;

    // Calculate financials for completed trips
    completedTrips.forEach(t => {
      totalRevenue += Number(t.revenue || 0);
      totalSalaries += Number(t.driverSalary || 0);
      
      const c = t.costs || {};
      totalCosts += Number(c.fuel || 0) + Number(c.bot || 0) + Number(c.driverAllowance || 0) + Number(c.others || 0);
    });

    const netProfit = totalRevenue - (totalCosts + totalSalaries);

    // Update main cards
    document.getElementById('stat-active-trips').innerText = activeTripsCount;
    document.getElementById('stat-trips-desc').innerText = `${trips.filter(t => t.status === 'Mới tạo').length} chuyến chờ xác nhận`;
    document.getElementById('stat-revenue').innerText = totalRevenue.toLocaleString('vi-VN') + 'đ';
    document.getElementById('stat-costs').innerText = (totalCosts + totalSalaries).toLocaleString('vi-VN') + 'đ';
    document.getElementById('stat-profit').innerText = netProfit.toLocaleString('vi-VN') + 'đ';

    // Status details
    const activeTractors = tractors.filter(t => t.status === 'Đang chạy').length;
    const maintTractors = tractors.filter(t => t.status === 'Bảo dưỡng').length;
    document.getElementById('dash-active-tractors').innerText = `${activeTractors}/${tractors.length}`;
    document.getElementById('dash-maint-tractors').innerText = `${maintTractors}/${tractors.length}`;

    const activeTrailers = trailers.filter(t => t.status === 'Đang chạy').length;
    document.getElementById('dash-active-trailers').innerText = `${activeTrailers}/${trailers.length}`;

    const readyDrivers = drivers.filter(d => d.status === 'Sẵn sàng').length;
    document.getElementById('dash-ready-drivers').innerText = `${readyDrivers}/${drivers.length}`;
  },

  renderMaintenanceAlerts() {
    const tractors = EportStore.getTractors();
    const alertList = document.getElementById('maintenance-alerts-list');
    if (!alertList) return;

    alertList.innerHTML = '';
    const today = new Date('2026-06-28'); // Current system local date

    let alertCount = 0;

    tractors.forEach(tr => {
      if (!tr.regExp) return;
      
      const expDate = new Date(tr.regExp);
      const diffTime = expDate - today;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays <= 30) {
        alertCount++;
        const alertCard = document.createElement('div');
        alertCard.className = 'dispatch-mini-card';
        
        let statusClass = 'badge-warning';
        let statusText = `Còn ${diffDays} ngày`;
        
        if (diffDays < 0) {
          statusClass = 'badge-danger';
          statusText = `Quá hạn ${Math.abs(diffDays)} ngày`;
        } else if (diffDays === 0) {
          statusClass = 'badge-danger';
          statusText = `Hết hạn hôm nay`;
        }

        alertCard.innerHTML = `
          <div class="dispatch-mini-info">
            <h4>${tr.plate} (${tr.brand})</h4>
            <p>Hạn ĐK: ${tr.regExp}</p>
          </div>
          <span class="badge ${statusClass}"><span class="badge-dot"></span>${statusText}</span>
        `;
        alertList.appendChild(alertCard);
      }
    });

    if (alertCount === 0) {
      alertList.innerHTML = `<div style="text-align: center; color: var(--text-muted); font-size: 13px; padding: 12px 0;">Không có cảnh báo đăng kiểm nào (Mọi thứ đều ổn)</div>`;
    }
  },

  startMapSimulation() {
    const marker = document.querySelector('.map-marker');
    const markerLabel = document.getElementById('marker-truck-1');
    if (!marker) return;

    // Smooth transition
    marker.style.transition = 'all 4.5s ease-in-out';

    const updateSimulation = () => {
      const trips = EportStore.getTrips();
      const activeTrips = trips.filter(t => t.status === 'Đang chạy');
      const tractors = EportStore.getTractors();

      // Get plate number
      let activePlate = '51C-678.90';
      if (activeTrips.length > 0) {
        const randomActiveTrip = activeTrips[Math.floor(Math.random() * activeTrips.length)];
        const assignedTractor = tractors.find(tr => tr.id === Number(randomActiveTrip.tractorId));
        if (assignedTractor) {
          activePlate = assignedTractor.plate;
        }
      }

      markerLabel.innerText = activePlate;

      // Select next coordinate
      this.currentMapTargetIndex = (this.currentMapTargetIndex + 1) % this.mapCoords.length;
      const targetCoord = this.mapCoords[this.currentMapTargetIndex];
      
      marker.style.top = targetCoord.top;
      marker.style.left = targetCoord.left;
    };

    // Trigger initial positioning
    updateSimulation();

    // Loop
    if (this.mapTimer) clearInterval(this.mapTimer);
    this.mapTimer = setInterval(updateSimulation, 5000);
  },

  // ================= TRIP DISPATCHING ACTIONS =================
  renderTrips() {
    const trips = EportStore.getTrips();
    const drivers = EportStore.getDrivers();
    const tractors = EportStore.getTractors();
    const trailers = EportStore.getTrailers();
    const tableBody = document.getElementById('trips-table-body');
    if (!tableBody) return;

    tableBody.innerHTML = '';

    // Filter
    let filteredTrips = trips;
    if (this.activeTripFilter !== 'Tất cả') {
      filteredTrips = trips.filter(t => t.status === this.activeTripFilter);
    }

    filteredTrips.forEach(trip => {
      const driver = drivers.find(d => d.id === Number(trip.driverId));
      const tractor = tractors.find(t => t.id === Number(trip.tractorId));
      const trailer = trailers.find(t => t.id === Number(trip.trailerId));

      const driverName = driver ? driver.name : 'N/A';
      const tractorPlate = tractor ? tractor.plate : 'N/A';
      const trailerPlate = trailer ? trailer.plate : 'N/A';

      // Status styling
      let statusBadge = '';
      if (trip.status === 'Mới tạo') {
        statusBadge = '<span class="badge badge-warning"><span class="badge-dot"></span>Chờ chạy</span>';
      } else if (trip.status === 'Đang chạy') {
        statusBadge = '<span class="badge badge-info"><span class="badge-dot"></span>Đang chạy</span>';
      } else {
        statusBadge = '<span class="badge badge-success"><span class="badge-dot"></span>Hoàn thành</span>';
      }

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="font-weight: 700; color: #fff;">${trip.tripCode}</td>
        <td>
          <div style="font-weight: 600;">${driverName}</div>
          <div style="font-size: 11px; color: var(--text-muted);">${driver ? driver.phone : ''}</div>
        </td>
        <td>
          <div>${tractorPlate}</div>
          <div style="font-size: 12px; color: var(--text-secondary);">${trailerPlate}</div>
        </td>
        <td>
          <div style="font-weight: 500;">${trip.pickup} → ${trip.delivery}</div>
          <div style="font-size: 11px; color: var(--text-muted);">Trả vỏ: ${trip.returnPoint}</div>
        </td>
        <td>
          <div>${trip.contNo || '---'}</div>
          <div style="font-size: 11px; color: var(--text-muted);">Seal: ${trip.sealNo || '---'}</div>
        </td>
        <td style="font-weight: 600; color: var(--accent-cyan);">${Number(trip.revenue || 0).toLocaleString('vi-VN')}đ</td>
        <td>${statusBadge}</td>
        <td style="text-align: right;">
          <div class="flex-gap-12" style="justify-content: flex-end;">
            <button class="btn btn-secondary" style="padding: 6px 10px;" onclick="app.openTripModal(${trip.id})" title="Sửa lệnh điều xe">
              <i class="fa-solid fa-pen-to-square"></i>
            </button>
            <button class="btn btn-danger" style="padding: 6px 10px;" onclick="app.handleDeleteTrip(${trip.id})" title="Xóa chuyến đi">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        </td>
      `;
      tableBody.appendChild(tr);
    });

    if (filteredTrips.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 32px;">Không có chuyến đi nào phù hợp với bộ lọc.</td></tr>`;
    }
  },

  filterTrips(status, element) {
    this.activeTripFilter = status;
    document.querySelectorAll('#trips .filter-btn').forEach(btn => btn.classList.remove('active'));
    element.classList.add('active');
    this.renderTrips();
  },

  openTripModal(id = null) {
    const modal = document.getElementById('trip-modal-backdrop');
    const form = document.getElementById('trip-form');
    const title = document.getElementById('trip-modal-title');
    
    form.reset();
    document.getElementById('trip-id').value = '';
    
    // Populate select lists dynamically with free resources
    this.populateTripDropdowns(id);

    if (id) {
      title.innerText = 'Chỉnh Sửa Lệnh Điều Xe';
      const trip = EportStore.getTrips().find(t => t.id === Number(id));
      if (trip) {
        document.getElementById('trip-id').value = trip.id;
        document.getElementById('trip-pickup').value = trip.pickup;
        document.getElementById('trip-delivery').value = trip.delivery;
        document.getElementById('trip-return').value = trip.returnPoint;
        document.getElementById('trip-date').value = trip.date;
        document.getElementById('trip-cont-no').value = trip.contNo || '';
        document.getElementById('trip-seal-no').value = trip.sealNo || '';
        document.getElementById('trip-revenue').value = trip.revenue || 0;
        
        const c = trip.costs || {};
        document.getElementById('cost-fuel').value = c.fuel || 0;
        document.getElementById('cost-bot').value = c.bot || 0;
        document.getElementById('cost-allowance').value = c.driverAllowance || 0;
        document.getElementById('cost-others').value = c.others || 0;
        document.getElementById('trip-status').value = trip.status;

        // Force dropdown bindings (even if they were busy, populateTripDropdowns includes current trip resources)
        document.getElementById('trip-driver').value = trip.driverId;
        document.getElementById('trip-tractor').value = trip.tractorId;
        document.getElementById('trip-trailer').value = trip.trailerId;
        
        // Show salary preview
        document.getElementById('trip-salary-preview').value = Number(trip.driverSalary || 0).toLocaleString('vi-VN') + 'đ';
      }
    } else {
      title.innerText = 'Điều Phối Chuyến Đi Mới';
      document.getElementById('trip-date').value = new Date('2026-06-28').toISOString().split('T')[0];
      document.getElementById('trip-salary-preview').value = '0đ';
    }

    modal.classList.add('show');
  },

  closeTripModal() {
    document.getElementById('trip-modal-backdrop').classList.remove('show');
  },

  populateTripDropdowns(editingTripId = null) {
    const drivers = EportStore.getDrivers();
    const tractors = EportStore.getTractors();
    const trailers = EportStore.getTrailers();
    const trips = EportStore.getTrips();

    const dSelect = document.getElementById('trip-driver');
    const trSelect = document.getElementById('trip-tractor');
    const tlSelect = document.getElementById('trip-trailer');

    dSelect.innerHTML = '<option value="">-- Chọn tài xế --</option>';
    trSelect.innerHTML = '<option value="">-- Chọn đầu kéo --</option>';
    tlSelect.innerHTML = '<option value="">-- Chọn rơ-moóc --</option>';

    // Track currently occupied resources in OTHER trips
    const busyDrivers = new Set();
    const busyTractors = new Set();
    const busyTrailers = new Set();

    trips.forEach(t => {
      if (t.id !== Number(editingTripId) && (t.status === 'Đang chạy' || t.status === 'Mới tạo')) {
        if (t.driverId) busyDrivers.add(Number(t.driverId));
        if (t.tractorId) busyTractors.add(Number(t.tractorId));
        if (t.trailerId) busyTrailers.add(Number(t.trailerId));
      }
    });

    // Populate Drivers
    drivers.forEach(d => {
      if (!busyDrivers.has(d.id) && d.status !== 'Xin nghỉ') {
        dSelect.innerHTML += `<option value="${d.id}">${d.name} (${d.phone})</option>`;
      } else if (editingTripId && trips.find(t => t.id === Number(editingTripId) && Number(t.driverId) === d.id)) {
        // Include currently assigned driver in edit mode
        dSelect.innerHTML += `<option value="${d.id}">${d.name} (Đang gán chuyến này)</option>`;
      }
    });

    // Populate Tractors
    tractors.forEach(tr => {
      if (!busyTractors.has(tr.id) && tr.status !== 'Bảo dưỡng') {
        trSelect.innerHTML += `<option value="${tr.id}">${tr.plate} - ${tr.brand}</option>`;
      } else if (editingTripId && trips.find(t => t.id === Number(editingTripId) && Number(t.tractorId) === tr.id)) {
        trSelect.innerHTML += `<option value="${tr.id}">${tr.plate} (Đang gán chuyến này)</option>`;
      }
    });

    // Populate Trailers
    trailers.forEach(tl => {
      if (!busyTrailers.has(tl.id)) {
        tlSelect.innerHTML += `<option value="${tl.id}">${tl.plate} - ${tl.type}</option>`;
      } else if (editingTripId && trips.find(t => t.id === Number(editingTripId) && Number(t.trailerId) === tl.id)) {
        tlSelect.innerHTML += `<option value="${tl.id}">${tl.plate} (Đang gán chuyến này)</option>`;
      }
    });
  },

  handleTripDriverChange(driverId) {
    this.calculateDynamicSalary();
  },

  calculateDynamicSalary() {
    const driverId = document.getElementById('trip-driver').value;
    const revenue = Number(document.getElementById('trip-revenue').value || 0);
    const salaryPreview = document.getElementById('trip-salary-preview');

    if (!driverId) {
      salaryPreview.value = '0đ';
      return;
    }

    const driver = EportStore.getDrivers().find(d => d.id === Number(driverId));
    if (!driver) {
      salaryPreview.value = '0đ';
      return;
    }

    const calculated = salaryApp.calculateSalary(driver, revenue);
    salaryPreview.value = calculated.toLocaleString('vi-VN') + 'đ';
  },

  handleTripSubmit(event) {
    event.preventDefault();
    const id = document.getElementById('trip-id').value;
    const driverId = Number(document.getElementById('trip-driver').value);
    const revenue = Number(document.getElementById('trip-revenue').value || 0);

    const driver = EportStore.getDrivers().find(d => d.id === driverId);
    const calculatedSalary = salaryApp.calculateSalary(driver, revenue);

    const tripData = {
      pickup: document.getElementById('trip-pickup').value,
      delivery: document.getElementById('trip-delivery').value,
      returnPoint: document.getElementById('trip-return').value,
      date: document.getElementById('trip-date').value,
      contNo: document.getElementById('trip-cont-no').value,
      sealNo: document.getElementById('trip-seal-no').value,
      driverId: driverId,
      tractorId: Number(document.getElementById('trip-tractor').value),
      trailerId: Number(document.getElementById('trip-trailer').value),
      revenue: revenue,
      driverSalary: calculatedSalary,
      costs: {
        fuel: Number(document.getElementById('cost-fuel').value || 0),
        bot: Number(document.getElementById('cost-bot').value || 0),
        driverAllowance: Number(document.getElementById('cost-allowance').value || 0),
        others: Number(document.getElementById('cost-others').value || 0)
      },
      status: document.getElementById('trip-status').value
    };

    if (id) {
      // Editing
      EportStore.updateTrip(id, tripData);
    } else {
      // Adding new
      tripData.isSalaryPaid = false; // default unpaid
      EportStore.addTrip(tripData);
    }

    this.closeTripModal();
    this.refreshAll();
  },

  handleDeleteTrip(id) {
    if (confirm('Bạn có chắc chắn muốn xóa lệnh điều động chuyến đi này không?')) {
      EportStore.deleteTrip(id);
      this.refreshAll();
    }
  },

  // ================= FLEET ACTIONS =================
  renderFleet() {
    const tractors = EportStore.getTractors();
    const trailers = EportStore.getTrailers();
    const trBody = document.getElementById('tractors-table-body');
    const tlBody = document.getElementById('trailers-table-body');

    // Render Tractors
    trBody.innerHTML = '';
    tractors.forEach(tr => {
      let statusBadge = '';
      if (tr.status === 'Sẵn sàng') {
        statusBadge = '<span class="badge badge-success"><span class="badge-dot"></span>Sẵn sàng</span>';
      } else if (tr.status === 'Đang chạy') {
        statusBadge = '<span class="badge badge-info"><span class="badge-dot"></span>Đang chạy</span>';
      } else {
        statusBadge = '<span class="badge badge-danger"><span class="badge-dot"></span>Bảo dưỡng</span>';
      }

      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${tr.id}</td>
        <td style="font-weight: 700; color: #fff;">${tr.plate}</td>
        <td>${tr.brand || '---'}</td>
        <td>${tr.regExp || '---'}</td>
        <td>${statusBadge}</td>
        <td style="text-align: right;">
          <div class="flex-gap-12" style="justify-content: flex-end;">
            <button class="btn btn-secondary" style="padding: 6px 10px;" onclick="app.openVehicleModal('tractor', ${tr.id})">
              <i class="fa-solid fa-pen-to-square"></i>
            </button>
            <button class="btn btn-danger" style="padding: 6px 10px;" onclick="app.handleDeleteVehicle('tractor', ${tr.id})">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        </td>
      `;
      trBody.appendChild(row);
    });

    // Render Trailers
    tlBody.innerHTML = '';
    trailers.forEach(tl => {
      let statusBadge = '';
      if (tl.status === 'Sẵn sàng') {
        statusBadge = '<span class="badge badge-success"><span class="badge-dot"></span>Sẵn sàng</span>';
      } else if (tl.status === 'Đang chạy') {
        statusBadge = '<span class="badge badge-info"><span class="badge-dot"></span>Đang chạy</span>';
      } else {
        statusBadge = '<span class="badge badge-danger"><span class="badge-dot"></span>Bảo dưỡng</span>';
      }

      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${tl.id}</td>
        <td style="font-weight: 700; color: #fff;">${tl.plate}</td>
        <td>${tl.type}</td>
        <td>${statusBadge}</td>
        <td style="text-align: right;">
          <div class="flex-gap-12" style="justify-content: flex-end;">
            <button class="btn btn-secondary" style="padding: 6px 10px;" onclick="app.openVehicleModal('trailer', ${tl.id})">
              <i class="fa-solid fa-pen-to-square"></i>
            </button>
            <button class="btn btn-danger" style="padding: 6px 10px;" onclick="app.handleDeleteVehicle('trailer', ${tl.id})">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        </td>
      `;
      tlBody.appendChild(row);
    });
  },

  openVehicleModal(type = 'tractor', id = null) {
    const modal = document.getElementById('vehicle-modal-backdrop');
    const form = document.getElementById('vehicle-form');
    const title = document.getElementById('vehicle-modal-title');
    const tractorFields = document.getElementById('tractor-fields');
    const trailerFields = document.getElementById('trailer-fields');
    
    form.reset();
    document.getElementById('vehicle-id').value = '';
    document.getElementById('vehicle-mode').value = type;

    if (type === 'tractor') {
      title.innerText = id ? 'Chỉnh Sửa Đầu Kéo' : 'Thêm Đầu Kéo Mới';
      tractorFields.style.display = 'block';
      trailerFields.style.display = 'none';
      
      if (id) {
        const vehicle = EportStore.getTractors().find(t => t.id === Number(id));
        if (vehicle) {
          document.getElementById('vehicle-id').value = vehicle.id;
          document.getElementById('vehicle-plate').value = vehicle.plate;
          document.getElementById('vehicle-brand').value = vehicle.brand || '';
          document.getElementById('vehicle-reg').value = vehicle.regExp || '';
          document.getElementById('vehicle-status').value = vehicle.status;
        }
      }
    } else {
      title.innerText = id ? 'Chỉnh Sửa Rơ-moóc' : 'Thêm Rơ-moóc Mới';
      tractorFields.style.display = 'none';
      trailerFields.style.display = 'block';
      
      if (id) {
        const vehicle = EportStore.getTrailers().find(t => t.id === Number(id));
        if (vehicle) {
          document.getElementById('vehicle-id').value = vehicle.id;
          document.getElementById('vehicle-plate').value = vehicle.plate;
          document.getElementById('vehicle-type').value = vehicle.type;
          document.getElementById('vehicle-status').value = vehicle.status;
        }
      }
    }

    modal.classList.add('show');
  },

  closeVehicleModal() {
    document.getElementById('vehicle-modal-backdrop').classList.remove('show');
  },

  handleVehicleSubmit(event) {
    event.preventDefault();
    const id = document.getElementById('vehicle-id').value;
    const mode = document.getElementById('vehicle-mode').value;
    
    const plate = document.getElementById('vehicle-plate').value;
    const status = document.getElementById('vehicle-status').value;

    if (mode === 'tractor') {
      const tractorData = {
        plate: plate,
        brand: document.getElementById('vehicle-brand').value,
        regExp: document.getElementById('vehicle-reg').value,
        status: status
      };

      if (id) {
        EportStore.updateTractor(id, tractorData);
      } else {
        EportStore.addTractor(tractorData);
      }
    } else {
      const trailerData = {
        plate: plate,
        type: document.getElementById('vehicle-type').value,
        status: status
      };

      if (id) {
        EportStore.updateTrailer(id, trailerData);
      } else {
        EportStore.addTrailer(trailerData);
      }
    }

    this.closeVehicleModal();
    this.refreshAll();
  },

  handleDeleteVehicle(type, id) {
    const itemType = type === 'tractor' ? 'đầu kéo' : 'rơ-moóc';
    if (confirm(`Bạn có chắc chắn muốn xóa ${itemType} này không?`)) {
      if (type === 'tractor') {
        EportStore.deleteTractor(id);
      } else {
        EportStore.deleteTrailer(id);
      }
      this.refreshAll();
    }
  },

  // ================= DRIVER ACTIONS =================
  renderDrivers() {
    const drivers = EportStore.getDrivers();
    const body = document.getElementById('drivers-table-body');
    if (!body) return;

    body.innerHTML = '';
    drivers.forEach(d => {
      let statusBadge = '';
      if (d.status === 'Sẵn sàng') {
        statusBadge = '<span class="badge badge-success"><span class="badge-dot"></span>Sẵn sàng</span>';
      } else if (d.status === 'Đang chạy') {
        statusBadge = '<span class="badge badge-info"><span class="badge-dot"></span>Đang chạy</span>';
      } else {
        statusBadge = '<span class="badge badge-danger"><span class="badge-dot"></span>Xin nghỉ</span>';
      }

      // Display Rate format
      let rateDisplay = '';
      if (d.salaryType === 'trip_percentage') {
        rateDisplay = `${d.salaryRate}% doanh thu`;
      } else {
        rateDisplay = `${Number(d.salaryRate).toLocaleString('vi-VN')}đ/chuyến`;
      }

      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${d.id}</td>
        <td style="font-weight: 700; color: #fff;">${d.name}</td>
        <td>${d.phone}</td>
        <td><span class="badge badge-info">${d.license}</span></td>
        <td>${d.salaryType === 'trip_percentage' ? 'Theo % doanh số' : 'Tiền cố định'}</td>
        <td style="font-weight: 600; color: var(--accent-cyan);">${rateDisplay}</td>
        <td>${statusBadge}</td>
        <td style="text-align: right;">
          <div class="flex-gap-12" style="justify-content: flex-end;">
            <button class="btn btn-secondary" style="padding: 6px 10px;" onclick="app.openDriverModal(${d.id})">
              <i class="fa-solid fa-pen-to-square"></i>
            </button>
            <button class="btn btn-danger" style="padding: 6px 10px;" onclick="app.handleDeleteDriver(${d.id})">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        </td>
      `;
      body.appendChild(row);
    });

    if (drivers.length === 0) {
      body.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 32px;">Không có tài xế nào được tạo.</td></tr>`;
    }
  },

  openDriverModal(id = null) {
    const modal = document.getElementById('driver-modal-backdrop');
    const form = document.getElementById('driver-form');
    const title = document.getElementById('driver-modal-title');
    
    form.reset();
    document.getElementById('driver-id').value = '';

    if (id) {
      title.innerText = 'Chỉnh Sửa Hồ Sơ Tài Xế';
      const d = EportStore.getDrivers().find(dr => dr.id === Number(id));
      if (d) {
        document.getElementById('driver-id').value = d.id;
        document.getElementById('driver-name').value = d.name;
        document.getElementById('driver-phone').value = d.phone;
        document.getElementById('driver-license').value = d.license;
        document.getElementById('driver-salary-type').value = d.salaryType;
        document.getElementById('driver-salary-rate').value = d.salaryRate;
        document.getElementById('driver-status').value = d.status;

        this.toggleSalaryRateLabel(d.salaryType);
      }
    } else {
      title.innerText = 'Thêm Tài Xế Mới';
      this.toggleSalaryRateLabel('fixed_per_trip');
    }

    modal.classList.add('show');
  },

  closeDriverModal() {
    document.getElementById('driver-modal-backdrop').classList.remove('show');
  },

  toggleSalaryRateLabel(type) {
    const label = document.getElementById('salary-rate-label');
    const input = document.getElementById('driver-salary-rate');
    
    if (type === 'trip_percentage') {
      label.innerText = 'Tỷ lệ % doanh thu cước chuyến đi (%) *';
      input.placeholder = 'Ví dụ: 10 (nghĩa là 10% doanh thu)';
    } else {
      label.innerText = 'Mức lương cố định trên mỗi chuyến (VND/chuyến) *';
      input.placeholder = 'Ví dụ: 500000';
    }
  },

  handleDriverSubmit(event) {
    event.preventDefault();
    const id = document.getElementById('driver-id').value;
    
    const driverData = {
      name: document.getElementById('driver-name').value,
      phone: document.getElementById('driver-phone').value,
      license: document.getElementById('driver-license').value,
      salaryType: document.getElementById('driver-salary-type').value,
      salaryRate: Number(document.getElementById('driver-salary-rate').value),
      status: document.getElementById('driver-status').value
    };

    if (id) {
      EportStore.updateDriver(id, driverData);
    } else {
      EportStore.addDriver(driverData);
    }

    this.closeDriverModal();
    this.refreshAll();
  },

  handleDeleteDriver(id) {
    if (confirm('Bạn có chắc chắn muốn xóa tài xế này khỏi danh sách công tác không?')) {
      EportStore.deleteDriver(id);
      this.refreshAll();
    }
  },

  // ================= UTILITIES =================
  // Scans active trips and updates tractor, trailer, and driver statuses to 'Đang chạy' dynamically
  syncResourceStatuses() {
    const trips = EportStore.getTrips();
    const tractors = EportStore.getTractors();
    const trailers = EportStore.getTrailers();
    const drivers = EportStore.getDrivers();

    const busyTractors = new Set();
    const busyTrailers = new Set();
    const busyDrivers = new Set();

    trips.forEach(t => {
      if (t.status === 'Đang chạy' || t.status === 'Mới tạo') {
        if (t.tractorId) busyTractors.add(Number(t.tractorId));
        if (t.trailerId) busyTrailers.add(Number(t.trailerId));
        if (t.driverId) busyDrivers.add(Number(t.driverId));
      }
    });

    // Tractors sync
    let tractorsChanged = false;
    tractors.forEach(tr => {
      if (busyTractors.has(tr.id)) {
        if (tr.status !== 'Đang chạy') {
          tr.status = 'Đang chạy';
          tractorsChanged = true;
        }
      } else {
        if (tr.status === 'Đang chạy') {
          tr.status = 'Sẵn sàng';
          tractorsChanged = true;
        }
      }
    });
    if (tractorsChanged) EportStore.saveTractors(tractors);

    // Trailers sync
    let trailersChanged = false;
    trailers.forEach(tl => {
      if (busyTrailers.has(tl.id)) {
        if (tl.status !== 'Đang chạy') {
          tl.status = 'Đang chạy';
          trailersChanged = true;
        }
      } else {
        if (tl.status === 'Đang chạy') {
          tl.status = 'Sẵn sàng';
          trailersChanged = true;
        }
      }
    });
    if (trailersChanged) EportStore.saveTrailers(trailers);

    // Drivers sync
    let driversChanged = false;
    drivers.forEach(d => {
      if (busyDrivers.has(d.id)) {
        if (d.status !== 'Đang chạy') {
          d.status = 'Đang chạy';
          driversChanged = true;
        }
      } else {
        if (d.status === 'Đang chạy') {
          d.status = 'Sẵn sàng';
          driversChanged = true;
        }
      }
    });
    if (driversChanged) EportStore.saveDrivers(drivers);
  },

  // ================= CLOUD SYNC CONFIGURATION =================
  openCloudSettings() {
    const modal = document.getElementById('cloud-modal-backdrop');
    const configInput = document.getElementById('cloud-config-input');
    const badge = document.getElementById('cloud-status-badge');
    const syncActions = document.getElementById('cloud-sync-actions');

    const config = localStorage.getItem('eport_firebase_config');
    if (config) {
      configInput.value = JSON.stringify(JSON.parse(config), null, 2);
    } else {
      configInput.value = '';
    }

    if (EportStore.isFirebaseActive) {
      badge.className = 'badge badge-success';
      badge.innerHTML = '<span class="badge-dot"></span>Đang đồng bộ Cloud (Real-time)';
      syncActions.style.display = 'block';
    } else {
      badge.className = 'badge badge-warning';
      badge.innerHTML = '<span class="badge-dot"></span>Chưa kết nối Cloud';
      syncActions.style.display = 'none';
    }

    modal.classList.add('show');
  },

  closeCloudSettings() {
    document.getElementById('cloud-modal-backdrop').classList.remove('show');
  },

  handleCloudSubmit(event) {
    event.preventDefault();
    let configInput = document.getElementById('cloud-config-input').value.trim();
    
    try {
      // Extract what is inside { ... } if they pasted standard Javascript const assignment
      if (configInput.includes('{')) {
        configInput = configInput.substring(configInput.indexOf('{'), configInput.lastIndexOf('}') + 1);
      }
      
      // Use new Function evaluation to safely parse JavaScript object literal syntax
      // (handles unquoted keys, single quotes, trailing commas perfectly)
      const parseJsObject = (str) => {
        return new Function(`return (${str})`)();
      };
      
      const config = parseJsObject(configInput);
      
      if (!config.apiKey || !config.projectId) {
        throw new Error('Cấu hình Firebase thiếu apiKey hoặc projectId.');
      }

      localStorage.setItem('eport_firebase_config', JSON.stringify(config));
      alert('Đã lưu cấu hình! Ứng dụng sẽ tự động tải lại trang để thiết lập kết nối Firebase.');
      window.location.reload();
    } catch (err) {
      alert('Cấu hình không hợp lệ! Vui lòng dán lại cấu hình chính xác.\nLỗi: ' + err.message);
    }
  },

  async uploadLocalDataToCloud() {
    if (!EportStore.isFirebaseActive) {
      alert('Vui lòng kết nối Firebase thành công trước.');
      return;
    }

    if (confirm('Tác vụ này sẽ đẩy toàn bộ dữ liệu xe, tài xế, Chuyến đi và Bồn dầu hiện tại trên máy của bạn lên Cloud. Bạn có chắc chắn muốn đẩy dữ liệu lên không?')) {
      const badge = document.getElementById('cloud-status-badge');
      try {
        badge.innerHTML = '<span class="badge-dot"></span>Đang đẩy dữ liệu lên...';
        await EportStore.uploadAllDataToCloud();
        alert('Tải dữ liệu lên Cloud thành công! Kể từ bây giờ, tất cả thiết bị khác kết nối vào Firebase của bạn sẽ nhìn thấy dữ liệu này.');
        this.closeCloudSettings();
        window.location.reload();
      } catch (err) {
        alert('Đẩy dữ liệu thất bại: ' + err.message);
        this.openCloudSettings(); // refresh status
      }
    }
  }
};

// Start application when window loads
window.addEventListener('DOMContentLoaded', () => {
  app.init();
});
