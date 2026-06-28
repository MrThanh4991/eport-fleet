const EportChart = {
  chartInstance: null,

  init(trips) {
    const ctx = document.getElementById('financialChart');
    if (!ctx) return;

    // Get last 5 trips for display
    const recentTrips = [...trips].slice(-5);
    const labels = recentTrips.map(t => t.tripCode);
    const revenueData = recentTrips.map(t => t.revenue);
    const costData = recentTrips.map(t => {
      const c = t.costs || {};
      const fuel = Number(c.fuel || 0);
      const bot = Number(c.bot || 0);
      const allowance = Number(c.driverAllowance || 0);
      const others = Number(c.others || 0);
      const salary = Number(t.driverSalary || 0);
      return fuel + bot + allowance + others + salary;
    });

    if (this.chartInstance) {
      this.chartInstance.destroy();
    }

    this.chartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Doanh thu cước (VND)',
            data: revenueData,
            backgroundColor: 'rgba(16, 185, 129, 0.65)',
            borderColor: '#10b981',
            borderWidth: 1,
            borderRadius: 6
          },
          {
            label: 'Tổng chi phí & Lương (VND)',
            data: costData,
            backgroundColor: 'rgba(244, 63, 94, 0.65)',
            borderColor: '#f43f5e',
            borderWidth: 1,
            borderRadius: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: {
              color: '#9ca3af',
              font: {
                family: 'Outfit',
                size: 12
              }
            }
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                let label = context.dataset.label || '';
                if (label) {
                  label += ': ';
                }
                if (context.raw !== null) {
                  label += new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(context.raw);
                }
                return label;
              }
            }
          }
        },
        scales: {
          x: {
            grid: {
              color: 'rgba(255, 255, 255, 0.05)'
            },
            ticks: {
              color: '#9ca3af',
              font: {
                family: 'Inter',
                size: 11
              }
            }
          },
          y: {
            grid: {
              color: 'rgba(255, 255, 255, 0.05)'
            },
            ticks: {
              color: '#9ca3af',
              font: {
                family: 'Inter',
                size: 11
              },
              callback: function(value) {
                if (value >= 1e6) {
                  return (value / 1e6) + ' Tr';
                }
                return value.toLocaleString('vi-VN');
              }
            }
          }
        }
      }
    });
  },

  update(trips) {
    if (!this.chartInstance) {
      this.init(trips);
      return;
    }

    const recentTrips = [...trips].slice(-5);
    const labels = recentTrips.map(t => t.tripCode);
    const revenueData = recentTrips.map(t => t.revenue);
    const costData = recentTrips.map(t => {
      const c = t.costs || {};
      const fuel = Number(c.fuel || 0);
      const bot = Number(c.bot || 0);
      const allowance = Number(c.driverAllowance || 0);
      const others = Number(c.others || 0);
      const salary = Number(t.driverSalary || 0);
      return fuel + bot + allowance + others + salary;
    });

    this.chartInstance.data.labels = labels;
    this.chartInstance.data.datasets[0].data = revenueData;
    this.chartInstance.data.datasets[1].data = costData;
    this.chartInstance.update();
  }
};
