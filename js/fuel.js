const fuelApp = {
  currentSubtab: 'dispense',

  // Initialize fuel module
  init() {
    this.setupEventListeners();
    this.render();
  },

  setupEventListeners() {
    // Sub-tab filters
    document.querySelectorAll('#fuel-subtabs .filter-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const type = btn.getAttribute('data-subtab');
        this.switchSubtab(type);
      });
    });
  },

  switchSubtab(type) {
    this.currentSubtab = type;
    
    // Update button active state
    document.querySelectorAll('#fuel-subtabs .filter-btn').forEach(btn => {
      if (btn.getAttribute('data-subtab') === type) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Toggle tables
    document.getElementById('fuel-dispense-section').style.display = type === 'dispense' ? 'block' : 'none';
    document.getElementById('fuel-import-section').style.display = type === 'import' ? 'block' : 'none';
    document.getElementById('fuel-price-section').style.display = type === 'price' ? 'block' : 'none';
    document.getElementById('fuel-lookup-section').style.display = type === 'search' ? 'block' : 'none';

    // Rerender subtab data
    this.renderSubtabData();
  },

  // Main render function for fuel tab
  render() {
    this.renderTankStatusCard();
    this.renderSubtabData();
  },

  // Renders the overall tank metrics (indicator bar, liters, stats)
  renderTankStatusCard() {
    const status = this.getTankStatus();
    const capacity = 20000; // Tank max capacity (e.g. 20,000 Liters)
    const percentage = Math.min(100, Math.round((status.liters / capacity) * 100));

    // Update text
    document.getElementById('tank-liters-display').innerText = status.liters.toLocaleString('vi-VN') + ' Lít';
    document.getElementById('tank-mm-display').innerText = `Chiều cao đo bồn: ${status.mm || 0} mm`;
    document.getElementById('tank-percent-display').innerText = `${percentage}% thể tích`;
    
    // Visual progress/wave bar
    const progressEl = document.getElementById('tank-progress-bar');
    if (progressEl) {
      progressEl.style.height = `${percentage}%`;
      // Change color based on fuel level
      if (percentage < 20) {
        progressEl.style.background = 'linear-gradient(to top, var(--accent-rose), #f43f5e)';
      } else if (percentage < 50) {
        progressEl.style.background = 'linear-gradient(to top, var(--accent-amber), #fbbf24)';
      } else {
        progressEl.style.background = 'linear-gradient(to top, var(--accent-cyan), #06b6d4)';
      }
    }

    // Monthly summary stats
    const dispenses = EportStore.getFuelDispenses();
    const imports = EportStore.getFuelImports();
    
    // Sum for June 2026 (or last 30 days)
    const now = new Date('2026-06-28');
    const startOfMonth = new Date('2026-06-01');

    let monthDispensed = 0;
    dispenses.forEach(d => {
      const dDate = new Date(d.date);
      if (dDate >= startOfMonth && dDate <= now) {
        monthDispensed += Number(d.liters || 0);
      }
    });

    let monthImported = 0;
    imports.forEach(i => {
      const iDate = new Date(i.date);
      if (iDate >= startOfMonth && iDate <= now) {
        monthImported += Number(i.litersRefilled || 0);
      }
    });

    document.getElementById('stat-month-dispensed').innerText = monthDispensed.toLocaleString('vi-VN') + ' Lít';
    document.getElementById('stat-month-imported').innerText = monthImported.toLocaleString('vi-VN') + ' Lít';
  },

  renderSubtabData() {
    if (this.currentSubtab === 'dispense') {
      this.renderDispenses();
    } else if (this.currentSubtab === 'import') {
      this.renderImports();
    } else if (this.currentSubtab === 'price') {
      this.renderPrices();
    } else if (this.currentSubtab === 'search') {
      this.renderCalibrationLookup();
    }
  },

  // Renders Cấp phát đổ dầu (Dispenses)
  renderDispenses() {
    const dispenses = EportStore.getFuelDispenses();
    const tableBody = document.getElementById('fuel-dispense-table-body');
    if (!tableBody) return;

    tableBody.innerHTML = '';
    
    // Reverse to show newest first
    const sortedDispenses = [...dispenses].sort((a,b) => new Date(b.date) - new Date(a.date));

    sortedDispenses.forEach(d => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="font-weight: 600;">${d.date}</td>
        <td style="font-weight: 700; color: #fff;">${d.plate}</td>
        <td style="font-weight: bold; color: var(--accent-cyan);">${Number(d.liters).toLocaleString('vi-VN')} Lít</td>
        <td>${Number(d.price).toLocaleString('vi-VN')}đ</td>
        <td style="font-weight: 600;">${Number(d.total).toLocaleString('vi-VN')}đ</td>
        <td><span style="font-size: 13px; color: var(--text-secondary);">${d.mm ? d.mm + ' mm' : '---'}</span></td>
        <td><span style="font-size: 13px; color: var(--text-secondary);">${d.tankLiters ? d.tankLiters.toLocaleString('vi-VN') + ' Lít' : '---'}</span></td>
        <td><span class="text-muted" style="font-size: 12px;">${d.note || '---'}</span></td>
        <td style="text-align: right;">
          <button class="btn btn-danger" style="padding: 6px 10px;" onclick="fuelApp.deleteDispense(${d.id})" title="Xóa">
            <i class="fa-solid fa-trash"></i>
          </button>
        </td>
      `;
      tableBody.appendChild(tr);
    });

    if (sortedDispenses.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: var(--text-muted); padding: 32px;">Chưa có dữ liệu cấp phát đổ dầu.</td></tr>`;
    }
  },

  // Renders Nhập bồn (Imports)
  renderImports() {
    const imports = EportStore.getFuelImports();
    const tableBody = document.getElementById('fuel-import-table-body');
    if (!tableBody) return;

    tableBody.innerHTML = '';

    // Sort newest first
    const sortedImports = [...imports].sort((a,b) => new Date(b.date) - new Date(a.date));

    sortedImports.forEach(imp => {
      let varBadge = '';
      if (imp.variance < 0) {
        varBadge = `<span class="badge badge-danger">${imp.variance} Lít</span>`;
      } else if (imp.variance > 0) {
        varBadge = `<span class="badge badge-success">+${imp.variance} Lít</span>`;
      } else {
        varBadge = `<span class="badge badge-info">Khớp</span>`;
      }

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="font-weight: 600;">${imp.date}</td>
        <td>${imp.oldMm} mm ➡ <span style="color: var(--accent-cyan); font-weight: 600;">${this.getLitersFromMm(imp.oldMm).toLocaleString('vi-VN')} Lít</span></td>
        <td>${imp.newMm} mm ➡ <span style="color: var(--accent-cyan); font-weight: 600;">${this.getLitersFromMm(imp.newMm).toLocaleString('vi-VN')} Lít</span></td>
        <td style="font-weight: bold; color: #fff;">${Number(imp.litersRefilled).toLocaleString('vi-VN')} Lít</td>
        <td>${varBadge}</td>
        <td><span class="text-muted" style="font-size: 12px;">${imp.note || '---'}</span></td>
      `;
      tableBody.appendChild(tr);
    });

    if (sortedImports.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 32px;">Chưa có dữ liệu nhập dầu bồn.</td></tr>`;
    }
  },

  // Renders Lịch sử Giá (Prices)
  renderPrices() {
    const prices = EportStore.getFuelPrices();
    const tableBody = document.getElementById('fuel-price-table-body');
    if (!tableBody) return;

    tableBody.innerHTML = '';

    // Sort by fromDate descending
    const sortedPrices = [...prices].sort((a,b) => new Date(b.fromDate) - new Date(a.fromDate));

    sortedPrices.forEach(p => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${p.fromDate}</td>
        <td>${p.toDate || 'Hiện tại (Vô thời hạn)'}</td>
        <td style="font-weight: bold; color: var(--accent-emerald);">${Number(p.price).toLocaleString('vi-VN')}đ / Lít</td>
      `;
      tableBody.appendChild(tr);
    });

    if (sortedPrices.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="3" style="text-align: center; color: var(--text-muted); padding: 32px;">Chưa có dữ liệu giá xăng dầu.</td></tr>`;
    }
  },

  // Renders Bảng tra bồn (Calibration tool)
  renderCalibrationLookup() {
    const lookupContainer = document.getElementById('fuel-lookup-section');
    if (!lookupContainer) return;
    
    // We render a simple search box if not already present
    const outputEl = document.getElementById('lookup-result-output');
    if (outputEl) return; // already rendered
    
    const lookupBox = document.createElement('div');
    lookupBox.style.maxWidth = '400px';
    lookupBox.style.margin = '20px auto';
    lookupBox.className = 'card';
    lookupBox.innerHTML = `
      <h3 style="text-align: center; margin-bottom: 20px;">Hiệu chuẩn đo bồn chứa</h3>
      <div class="form-group">
        <label for="lookup-mm-input">Nhập chiều cao đo bồn (mm)</label>
        <input type="number" id="lookup-mm-input" class="form-control" placeholder="Ví dụ: 1641" oninput="fuelApp.handleQuickLookup(this.value)">
      </div>
      <div style="margin-top: 24px; text-align: center; padding: 16px; background: rgba(255,255,255,0.02); border-radius: 8px; border: 1px dashed var(--border-color);">
        <span style="font-size: 13px; color: var(--text-secondary); display: block; margin-bottom: 8px;">Thể tích dầu trong bồn tương ứng</span>
        <span id="lookup-result-liters" style="font-size: 32px; font-weight: 800; color: var(--accent-cyan);">0 Lít</span>
      </div>
    `;
    
    const sec = document.getElementById('fuel-lookup-section');
    sec.innerHTML = '';
    sec.appendChild(lookupBox);
  },

  handleQuickLookup(mm) {
    const output = document.getElementById('lookup-result-liters');
    if (!mm) {
      output.innerText = '0 Lít';
      return;
    }
    const liters = this.getLitersFromMm(Number(mm));
    output.innerText = liters.toLocaleString('vi-VN') + ' Lít';
  },

  // ================= FORM DIALOG ACTIONS =================
  openDispenseModal() {
    const modal = document.getElementById('fuel-dispense-modal-backdrop');
    const form = document.getElementById('fuel-dispense-form');
    
    form.reset();
    
    // Default date to today
    document.getElementById('fd-date').value = new Date('2026-06-28').toISOString().split('T')[0];
    
    // Auto-fill price
    this.handleDispenseDateChange(document.getElementById('fd-date').value);

    // Populate tractor plate list
    const tractors = EportStore.getTractors();
    const plateSelect = document.getElementById('fd-plate');
    plateSelect.innerHTML = '<option value="">-- Chọn xe --</option>';
    tractors.forEach(tr => {
      plateSelect.innerHTML += `<option value="${tr.plate}">${tr.plate} (${tr.brand})</option>`;
    });

    modal.classList.add('show');
  },

  closeDispenseModal() {
    document.getElementById('fuel-dispense-modal-backdrop').classList.remove('show');
  },

  handleDispenseDateChange(date) {
    const price = this.getPriceForDate(date);
    document.getElementById('fd-price').value = price;
    this.calculateDispenseTotal();
  },

  calculateDispenseTotal() {
    const liters = Number(document.getElementById('fd-liters').value || 0);
    const price = Number(document.getElementById('fd-price').value || 0);
    document.getElementById('fd-total').value = liters * price;
  },

  handleDispenseMmChange(mm) {
    const litersLabel = document.getElementById('fd-tank-liters-preview');
    if (!mm) {
      litersLabel.innerText = '';
      return;
    }
    const liters = this.getLitersFromMm(Number(mm));
    litersLabel.innerText = `➡ Tương ứng ${liters.toLocaleString('vi-VN')} Lít dầu bồn`;
  },

  handleDispenseSubmit(event) {
    event.preventDefault();
    
    const mm = document.getElementById('fd-mm').value;
    const tankLiters = mm ? this.getLitersFromMm(Number(mm)) : null;

    const dispenseData = {
      date: document.getElementById('fd-date').value,
      plate: document.getElementById('fd-plate').value,
      liters: Number(document.getElementById('fd-liters').value),
      price: Number(document.getElementById('fd-price').value),
      total: Number(document.getElementById('fd-total').value),
      note: document.getElementById('fd-note').value,
      mm: mm ? Number(mm) : null,
      tankLiters: tankLiters
    };

    EportStore.addFuelDispense(dispenseData);
    this.closeDispenseModal();
    this.render();
  },

  deleteDispense(id) {
    if (confirm('Bạn có chắc chắn muốn xóa lịch sử cấp phát đổ dầu này không?')) {
      EportStore.deleteFuelDispense(id);
      this.render();
    }
  },

  // Refill Modal
  openImportModal() {
    const modal = document.getElementById('fuel-import-modal-backdrop');
    const form = document.getElementById('fuel-import-form');
    
    form.reset();
    document.getElementById('fi-date').value = new Date('2026-06-28').toISOString().split('T')[0] + 'T12:00';
    document.getElementById('fi-old-liters-preview').innerText = '0 Lít';
    document.getElementById('fi-new-liters-preview').innerText = '0 Lít';
    document.getElementById('fi-variance-preview').innerText = '0 Lít';

    modal.classList.add('show');
  },

  closeImportModal() {
    document.getElementById('fuel-import-modal-backdrop').classList.remove('show');
  },

  handleImportMmChange() {
    const oldMm = Number(document.getElementById('fi-old-mm').value || 0);
    const newMm = Number(document.getElementById('fi-new-mm').value || 0);
    const refilled = Number(document.getElementById('fi-liters').value || 0);

    const oldLiters = this.getLitersFromMm(oldMm);
    const newLiters = this.getLitersFromMm(newMm);

    document.getElementById('fi-old-liters-preview').innerText = oldLiters.toLocaleString('vi-VN') + ' Lít';
    document.getElementById('fi-new-liters-preview').innerText = newLiters.toLocaleString('vi-VN') + ' Lít';

    if (oldMm && newMm && refilled) {
      // Variance = Volume after refilling - Volume before refilling - Quantity imported
      const variance = newLiters - oldLiters - refilled;
      const varEl = document.getElementById('fi-variance-preview');
      varEl.innerText = variance.toLocaleString('vi-VN') + ' Lít';
      if (variance < 0) {
        varEl.style.color = 'var(--accent-rose)';
      } else if (variance > 0) {
        varEl.style.color = 'var(--accent-emerald)';
      } else {
        varEl.style.color = '#fff';
      }
    }
  },

  handleImportSubmit(event) {
    event.preventDefault();
    const oldMm = Number(document.getElementById('fi-old-mm').value);
    const newMm = Number(document.getElementById('fi-new-mm').value);
    const refilled = Number(document.getElementById('fi-liters').value);

    const oldLiters = this.getLitersFromMm(oldMm);
    const newLiters = this.getLitersFromMm(newMm);
    const variance = newLiters - oldLiters - refilled;

    const importData = {
      date: document.getElementById('fi-date').value.replace('T', ' '),
      oldMm: oldMm,
      newMm: newMm,
      litersRefilled: refilled,
      variance: variance,
      beforeText: `${oldMm} mm ➡ ${oldLiters} lít`,
      afterText: `${newMm} mm ➡ ${newLiters} lít`,
      note: document.getElementById('fi-note').value
    };

    EportStore.addFuelImport(importData);
    this.closeImportModal();
    this.render();
  },

  // Price Modal
  openPriceModal() {
    const modal = document.getElementById('fuel-price-modal-backdrop');
    const form = document.getElementById('fuel-price-form');
    form.reset();
    document.getElementById('fp-from').value = new Date('2026-06-28').toISOString().split('T')[0];
    modal.classList.add('show');
  },

  closePriceModal() {
    document.getElementById('fuel-price-modal-backdrop').classList.remove('show');
  },

  handlePriceSubmit(event) {
    event.preventDefault();
    
    // We update the toDate of the previous active price if necessary
    const fromDate = document.getElementById('fp-from').value;
    const priceVal = Number(document.getElementById('fp-price').value);

    // Load prices and update previous active to end just before the new one
    const prices = EportStore.getFuelPrices();
    
    // Find the latest one that starts before the new one
    const sorted = [...prices].sort((a,b) => new Date(b.fromDate) - new Date(a.fromDate));
    const previous = sorted.find(p => new Date(p.fromDate) < new Date(fromDate));
    if (previous && !previous.toDate) {
      // End previous price day before fromDate
      const prevEnd = new Date(fromDate);
      prevEnd.setDate(prevEnd.getDate() - 1);
      previous.toDate = prevEnd.toISOString().split('T')[0];
      EportStore.saveFuelPrices(prices);
    }

    const priceData = {
      fromDate: fromDate,
      toDate: '', // active
      price: priceVal
    };

    EportStore.addFuelPrice(priceData);
    this.closePriceModal();
    this.render();
  },

  // ================= MATHEMATICAL MATHS =================
  
  // Linear interpolation calibration lookup
  getLitersFromMm(mm) {
    if (!window.EPORT_IMPORTED_DATA || !window.EPORT_IMPORTED_DATA.fuelCalibration) return 0;
    const cal = window.EPORT_IMPORTED_DATA.fuelCalibration;
    if (cal[mm]) return cal[mm];
    
    const keys = Object.keys(cal).map(Number).sort((a,b)=>a-b);
    if (keys.length === 0) return 0;
    if (mm <= keys[0]) return cal[keys[0]];
    if (mm >= keys[keys.length-1]) return cal[keys[keys.length-1]];
    
    for (let i = 0; i < keys.length - 1; i++) {
      if (mm >= keys[i] && mm <= keys[i+1]) {
        const x0 = keys[i], y0 = cal[x0];
        const x1 = keys[i+1], y1 = cal[x1];
        return Math.round(y0 + (mm - x0) * (y1 - y0) / (x1 - x0));
      }
    }
    return 0;
  },

  // Price lookup logic
  getPriceForDate(dateStr) {
    const prices = EportStore.getFuelPrices();
    if (prices.length === 0) return 19000;
    const target = new Date(dateStr);
    
    const sorted = [...prices].sort((a, b) => new Date(b.fromDate) - new Date(a.fromDate));
    
    for (const p of sorted) {
      const from = new Date(p.fromDate);
      const to = p.toDate ? new Date(p.toDate) : null;
      if (target >= from && (!to || target <= to)) {
        return p.price;
      }
    }
    return sorted[0] ? sorted[0].price : 19000;
  },

  // Calculates the current tank volume from latest transactions
  getTankStatus() {
    const imports = EportStore.getFuelImports();
    const dispenses = EportStore.getFuelDispenses();
    
    const logs = [];
    
    imports.forEach(imp => {
      logs.push({
        type: 'import',
        timestamp: new Date(imp.date),
        liters: imp.newMm ? this.getLitersFromMm(imp.newMm) : imp.litersRefilled,
        mm: imp.newMm
      });
    });
    
    dispenses.forEach(disp => {
      logs.push({
        type: 'dispense',
        timestamp: new Date(disp.date),
        liters: disp.tankLiters || 0,
        mm: disp.mm || 0
      });
    });
    
    // Sort newest first
    logs.sort((a, b) => b.timestamp - a.timestamp);
    
    if (logs.length > 0) {
      return {
        liters: logs[0].liters || 0,
        mm: logs[0].mm || 0
      };
    }
    
    // Fallback default
    return { liters: 16621, mm: 1641 };
  }
};
