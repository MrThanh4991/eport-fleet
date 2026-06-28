const salaryApp = {
  // Calculate salary for a single trip based on driver rate
  calculateSalary(driver, revenue) {
    if (!driver) return 0;
    const rate = Number(driver.salaryRate || 0);
    if (driver.salaryType === 'trip_percentage') {
      return Math.round((rate / 100) * Number(revenue));
    } else {
      // fixed_per_trip
      return rate;
    }
  },

  // Render the salary matching sheet
  render() {
    const trips = EportStore.getTrips();
    const drivers = EportStore.getDrivers();
    const tableBody = document.getElementById('salary-table-body');
    if (!tableBody) return;

    tableBody.innerHTML = '';
    
    // Filter trips that are "Hoàn thành" for salary audit
    const completedTrips = trips.filter(t => t.status === 'Hoàn thành');

    let totalPool = 0;
    let unpaidPool = 0;
    let unpaidCount = 0;
    let totalFuel = 0;
    
    // Track unpaid drivers count
    const unpaidDrivers = new Set();

    completedTrips.forEach(trip => {
      const driver = drivers.find(d => d.id === Number(trip.driverId));
      const driverName = driver ? driver.name : 'Chưa gán';
      
      // Calculate
      const salaryAmount = trip.driverSalary || 0;
      totalPool += salaryAmount;
      
      const isPaid = trip.isSalaryPaid === true;
      if (!isPaid) {
        unpaidPool += salaryAmount;
        if (driver) unpaidDrivers.add(driver.id);
      }

      // Add fuel cost
      totalFuel += Number((trip.costs && trip.costs.fuel) || 0);

      // Mechanism label
      let mechanism = 'N/A';
      if (driver) {
        mechanism = driver.salaryType === 'trip_percentage' 
          ? `${driver.salaryRate}% Doanh thu` 
          : `${Number(driver.salaryRate).toLocaleString('vi-VN')}đ/Chuyến`;
      }

      const routeText = `${trip.pickup} → ${trip.delivery} (Trả: ${trip.returnPoint})`;

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="font-weight: 600;">${driverName}</td>
        <td><span class="badge badge-info">${trip.tripCode}</span></td>
        <td style="max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${routeText}">
          ${routeText}
        </td>
        <td>${Number(trip.revenue || 0).toLocaleString('vi-VN')}đ</td>
        <td><span style="font-size: 13px; color: var(--text-secondary);">${mechanism}</span></td>
        <td style="font-weight: bold; color: var(--accent-cyan);">${Number(salaryAmount).toLocaleString('vi-VN')}đ</td>
        <td>${trip.date || '---'}</td>
        <td>
          <span class="badge ${isPaid ? 'badge-success' : 'badge-warning'}">
            <span class="badge-dot"></span>${isPaid ? 'Đã chi trả' : 'Chưa chi trả'}
          </span>
        </td>
        <td style="text-align: right;">
          ${!isPaid ? `
            <button class="btn btn-secondary" style="padding: 6px 12px; font-size: 12px; border-color: rgba(16, 185, 129, 0.3);" onclick="salaryApp.paySalary(${trip.id})">
              <i class="fa-solid fa-circle-check" style="color: var(--accent-emerald);"></i> Thanh toán
            </button>
          ` : `
            <button class="btn btn-secondary" style="padding: 6px 12px; font-size: 12px; opacity: 0.5; cursor: not-allowed;" disabled>
              <i class="fa-solid fa-circle-check"></i> Đã xong
            </button>
          `}
        </td>
      `;
      tableBody.appendChild(tr);
    });

    if (completedTrips.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: var(--text-muted); padding: 32px;">Chưa có chuyến đi nào được hoàn thành để kết toán lương.</td></tr>`;
    }

    // Update totals UI
    document.getElementById('salary-total-pool').innerText = totalPool.toLocaleString('vi-VN') + 'đ';
    document.getElementById('salary-unpaid-pool').innerText = unpaidPool.toLocaleString('vi-VN') + 'đ';
    document.getElementById('salary-unpaid-count').innerText = `${unpaidDrivers.size} tài xế chưa nhận lương`;
    document.getElementById('cost-total-fuel').innerText = totalFuel.toLocaleString('vi-VN') + 'đ';
  },

  // Mark a trip salary as paid
  paySalary(tripId) {
    const trips = EportStore.getTrips();
    const index = trips.findIndex(t => t.id === Number(tripId));
    if (index !== -1) {
      trips[index].isSalaryPaid = true;
      EportStore.saveTrips(trips);
      this.render();
      
      // Also update main dashboard metrics
      if (window.app) {
        window.app.updateDashboardMetrics();
      }
    }
  },

  // Export CSV of salaries
  exportSalary() {
    const trips = EportStore.getTrips().filter(t => t.status === 'Hoàn thành');
    const drivers = EportStore.getDrivers();
    
    if (trips.length === 0) {
      alert('Không có dữ liệu chuyến đi hoàn thành để xuất báo cáo.');
      return;
    }

    // Header row
    let csvContent = '\uFEFF'; // Add BOM for Excel UTF-8 display
    csvContent += 'Tài xế,Mã chuyến,Lộ trình,Doanh thu (VND),Cơ chế lương,Lương thực nhận (VND),Ngày hoàn thành,Trạng thái thanh toán\n';

    trips.forEach(trip => {
      const driver = drivers.find(d => d.id === Number(trip.driverId));
      const driverName = driver ? driver.name : 'Chưa gán';
      const routeText = `${trip.pickup} -> ${trip.delivery} (Trả cont: ${trip.returnPoint})`;
      const mechanism = driver 
        ? (driver.salaryType === 'trip_percentage' ? `${driver.salaryRate}%` : `${driver.salaryRate}đ`) 
        : 'N/A';
      const isPaid = trip.isSalaryPaid ? 'Đã chi trả' : 'Chưa chi trả';

      csvContent += `"${driverName}","${trip.tripCode}","${routeText}",${trip.revenue},"${mechanism}",${trip.driverSalary || 0},"${trip.date}","${isPaid}"\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Báo_cáo_lương_tài_xế_${new Date().toISOString().slice(0,10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};
