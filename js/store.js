const EportStore = {
  // Key names in LocalStorage
  KEYS: {
    TRACTORS: 'eport_tractors',
    TRAILERS: 'eport_trailers',
    DRIVERS: 'eport_drivers',
    TRIPS: 'eport_trips',
    FUEL_PRICES: 'eport_fuel_prices',
    FUEL_IMPORTS: 'eport_fuel_imports',
    FUEL_DISPENSES: 'eport_fuel_dispenses'
  },

  isFirebaseActive: false,
  db: null,

  // Mock initial data (fallback)
  INITIAL_DATA: {
    tractors: [
      { id: 1, plate: '51C-123.45', brand: 'Hyundai Xcient', status: 'Sẵn sàng', regExp: '2026-12-15' },
      { id: 2, plate: '51C-678.90', brand: 'Howo A7', status: 'Đang chạy', regExp: '2026-08-20' },
      { id: 3, plate: '51D-999.99', brand: 'International ProStar', status: 'Bảo dưỡng', regExp: '2026-06-30' }
    ],
    trailers: [
      { id: 1, plate: '51R-111.11', type: 'Moóc Xương 40ft', status: 'Sẵn sàng' },
      { id: 2, plate: '51R-222.22', type: 'Moóc Sàn 40ft', status: 'Đang chạy' },
      { id: 3, plate: '51R-333.33', type: 'Moóc Xương 20ft', status: 'Sẵn sàng' }
    ],
    drivers: [
      { id: 1, name: 'Nguyễn Văn Hùng', phone: '0901234567', license: 'FC', status: 'Sẵn sàng', salaryType: 'trip_percentage', salaryRate: 10 },
      { id: 2, name: 'Trần Thanh Hải', phone: '0918765432', license: 'FC', status: 'Đang chạy', salaryType: 'fixed_per_trip', salaryRate: 500000 },
      { id: 3, name: 'Lê Hoàng Nam', phone: '0987654321', license: 'FC', status: 'Xin nghỉ', salaryType: 'fixed_per_trip', salaryRate: 450000 }
    ],
    trips: [
      { 
        id: 1, 
        tripCode: 'TRIP-001', 
        pickup: 'Cảng Cát Lái', 
        delivery: 'Kho ICD Sóng Thần', 
        returnPoint: 'Cảng Cát Lái', 
        contNo: 'MSKU1234567', 
        sealNo: 'SL998877', 
        tractorId: 2, 
        trailerId: 2, 
        driverId: 2, 
        status: 'Đang chạy', 
        revenue: 4500000, 
        costs: { fuel: 1200000, bot: 240000, driverAllowance: 100000, others: 50000 }, 
        driverSalary: 500000, 
        date: '2026-06-28',
        isSalaryPaid: false
      }
    ]
  },

  // Initialize Store
  init() {
    // 1. Try to connect to Firebase if config exists
    const cloudConfigStr = localStorage.getItem('eport_firebase_config');
    if (cloudConfigStr) {
      try {
        const config = JSON.parse(cloudConfigStr);
        // Only initialize if not already initialized
        if (firebase.apps.length === 0) {
          firebase.initializeApp(config);
        }
        this.db = firebase.firestore();
        this.isFirebaseActive = true;
        console.log('Firebase connected! Activating Real-time Sync...');
        this.initRealtimeListeners();
      } catch (err) {
        console.error('Firebase initialization failed, falling back to LocalStorage:', err);
        this.isFirebaseActive = false;
      }
    }

    // 2. Import Excel Data into local cache if not already done (Runs once)
    if (window.EPORT_IMPORTED_DATA && localStorage.getItem('eport_fuel_imported') !== 'true') {
      localStorage.setItem(this.KEYS.TRACTORS, JSON.stringify(window.EPORT_IMPORTED_DATA.tractors));
      localStorage.setItem(this.KEYS.TRAILERS, JSON.stringify(window.EPORT_IMPORTED_DATA.trailers));
      localStorage.setItem(this.KEYS.DRIVERS, JSON.stringify(window.EPORT_IMPORTED_DATA.drivers));
      localStorage.setItem(this.KEYS.TRIPS, JSON.stringify(window.EPORT_IMPORTED_DATA.trips));
      localStorage.setItem(this.KEYS.FUEL_PRICES, JSON.stringify(window.EPORT_IMPORTED_DATA.fuelPrices));
      localStorage.setItem(this.KEYS.FUEL_IMPORTS, JSON.stringify(window.EPORT_IMPORTED_DATA.fuelImports));
      localStorage.setItem(this.KEYS.FUEL_DISPENSES, JSON.stringify(window.EPORT_IMPORTED_DATA.fuelDispenses));
      localStorage.setItem('eport_excel_imported', 'true');
      localStorage.setItem('eport_fuel_imported', 'true');
      console.log('Local Cache: Successfully populated Excel & Fuel data.');
    }

    // 3. Fallback check for each key in LocalStorage
    if (!localStorage.getItem(this.KEYS.TRACTORS)) {
      localStorage.setItem(this.KEYS.TRACTORS, JSON.stringify(this.INITIAL_DATA.tractors));
    }
    if (!localStorage.getItem(this.KEYS.TRAILERS)) {
      localStorage.setItem(this.KEYS.TRAILERS, JSON.stringify(this.INITIAL_DATA.trailers));
    }
    if (!localStorage.getItem(this.KEYS.DRIVERS)) {
      localStorage.setItem(this.KEYS.DRIVERS, JSON.stringify(this.INITIAL_DATA.drivers));
    }
    if (!localStorage.getItem(this.KEYS.TRIPS)) {
      localStorage.setItem(this.KEYS.TRIPS, JSON.stringify(this.INITIAL_DATA.trips));
    }
    if (!localStorage.getItem(this.KEYS.FUEL_PRICES)) {
      localStorage.setItem(this.KEYS.FUEL_PRICES, JSON.stringify([]));
    }
    if (!localStorage.getItem(this.KEYS.FUEL_IMPORTS)) {
      localStorage.setItem(this.KEYS.FUEL_IMPORTS, JSON.stringify([]));
    }
    if (!localStorage.getItem(this.KEYS.FUEL_DISPENSES)) {
      localStorage.setItem(this.KEYS.FUEL_DISPENSES, JSON.stringify([]));
    }
  },

  // Setup Real-time Listeners for Firestore
  initRealtimeListeners() {
    if (!this.isFirebaseActive || !this.db) return;

    const bindCollection = (collectionName, localStorageKey) => {
      this.db.collection(collectionName).onSnapshot((snapshot) => {
        // If snapshot is empty, don't overwrite if we just initialized (let user sync first)
        if (snapshot.empty) {
          console.log(`Cloud Collection [${collectionName}] is empty.`);
          return;
        }
        
        const items = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          const docId = doc.id;
          // Map string ID back to number if applicable
          const numericId = isNaN(docId) ? docId : Number(docId);
          items.push({ id: numericId, ...data });
        });

        // Update local cache
        localStorage.setItem(localStorageKey, JSON.stringify(items));
        console.log(`Real-time Sync: Updated [${collectionName}] collection.`);

        // Trigger UI Refresh
        if (window.app && window.app.refreshAll) {
          window.app.refreshAll();
        }
      }, (error) => {
        console.error(`Firestore listener error on [${collectionName}]:`, error);
      });
    };

    // Bind all collections
    bindCollection('tractors', this.KEYS.TRACTORS);
    bindCollection('trailers', this.KEYS.TRAILERS);
    bindCollection('drivers', this.KEYS.DRIVERS);
    bindCollection('trips', this.KEYS.TRIPS);
    bindCollection('fuel_prices', this.KEYS.FUEL_PRICES);
    bindCollection('fuel_imports', this.KEYS.FUEL_IMPORTS);
    bindCollection('fuel_dispenses', this.KEYS.FUEL_DISPENSES);
  },

  // Push all local cache data onto Firestore (Migration Tool)
  async uploadAllDataToCloud() {
    if (!this.isFirebaseActive || !this.db) {
      throw new Error('Chưa kết nối đám mây Firebase!');
    }

    const uploadKey = async (localStorageKey, collectionName) => {
      const items = JSON.parse(localStorage.getItem(localStorageKey)) || [];
      const batch = this.db.batch();
      
      items.forEach(item => {
        const docRef = this.db.collection(collectionName).doc(String(item.id));
        // Remove ID from document body
        const itemCopy = { ...item };
        delete itemCopy.id;
        batch.set(docRef, itemCopy);
      });
      
      await batch.commit();
      console.log(`Uploaded ${items.length} items to [${collectionName}].`);
    };

    await uploadKey(this.KEYS.TRACTORS, 'tractors');
    await uploadKey(this.KEYS.TRAILERS, 'trailers');
    await uploadKey(this.KEYS.DRIVERS, 'drivers');
    await uploadKey(this.KEYS.TRIPS, 'trips');
    await uploadKey(this.KEYS.FUEL_PRICES, 'fuel_prices');
    await uploadKey(this.KEYS.FUEL_IMPORTS, 'fuel_imports');
    await uploadKey(this.KEYS.FUEL_DISPENSES, 'fuel_dispenses');
  },

  // General CRUD helper (local cache read)
  get(key) {
    return JSON.parse(localStorage.getItem(key)) || [];
  },

  save(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
  },

  // ================= TRACTORS API =================
  getTractors() {
    return this.get(this.KEYS.TRACTORS);
  },
  saveTractors(tractors) {
    this.save(this.KEYS.TRACTORS, tractors);
  },
  addTractor(tractor) {
    const tractors = this.getTractors();
    tractor.id = tractors.length > 0 ? Math.max(...tractors.map(t => t.id)) + 1 : 1;
    tractors.push(tractor);
    this.saveTractors(tractors);

    if (this.isFirebaseActive) {
      const copy = { ...tractor }; delete copy.id;
      this.db.collection('tractors').doc(String(tractor.id)).set(copy);
    }
    return tractor;
  },
  updateTractor(id, updatedTractor) {
    const tractors = this.getTractors();
    const index = tractors.findIndex(t => t.id === Number(id));
    if (index !== -1) {
      tractors[index] = { ...tractors[index], ...updatedTractor };
      this.saveTractors(tractors);

      if (this.isFirebaseActive) {
        const copy = { ...tractors[index] }; delete copy.id;
        this.db.collection('tractors').doc(String(id)).set(copy);
      }
      return true;
    }
    return false;
  },
  deleteTractor(id) {
    let tractors = this.getTractors();
    tractors = tractors.filter(t => t.id !== Number(id));
    this.saveTractors(tractors);

    if (this.isFirebaseActive) {
      this.db.collection('tractors').doc(String(id)).delete();
    }
  },

  // ================= TRAILERS API =================
  getTrailers() {
    return this.get(this.KEYS.TRAILERS);
  },
  saveTrailers(trailers) {
    this.save(this.KEYS.TRAILERS, trailers);
  },
  addTrailer(trailer) {
    const trailers = this.getTrailers();
    trailer.id = trailers.length > 0 ? Math.max(...trailers.map(t => t.id)) + 1 : 1;
    trailers.push(trailer);
    this.saveTrailers(trailers);

    if (this.isFirebaseActive) {
      const copy = { ...trailer }; delete copy.id;
      this.db.collection('trailers').doc(String(trailer.id)).set(copy);
    }
    return trailer;
  },
  updateTrailer(id, updatedTrailer) {
    const trailers = this.getTrailers();
    const index = trailers.findIndex(t => t.id === Number(id));
    if (index !== -1) {
      trailers[index] = { ...trailers[index], ...updatedTrailer };
      this.saveTrailers(trailers);

      if (this.isFirebaseActive) {
        const copy = { ...trailers[index] }; delete copy.id;
        this.db.collection('trailers').doc(String(id)).set(copy);
      }
      return true;
    }
    return false;
  },
  deleteTrailer(id) {
    let trailers = this.getTrailers();
    trailers = trailers.filter(t => t.id !== Number(id));
    this.saveTrailers(trailers);

    if (this.isFirebaseActive) {
      this.db.collection('trailers').doc(String(id)).delete();
    }
  },

  // ================= DRIVERS API =================
  getDrivers() {
    return this.get(this.KEYS.DRIVERS);
  },
  saveDrivers(drivers) {
    this.save(this.KEYS.DRIVERS, drivers);
  },
  addDriver(driver) {
    const drivers = this.getDrivers();
    driver.id = drivers.length > 0 ? Math.max(...drivers.map(d => d.id)) + 1 : 1;
    drivers.push(driver);
    this.saveDrivers(drivers);

    if (this.isFirebaseActive) {
      const copy = { ...driver }; delete copy.id;
      this.db.collection('drivers').doc(String(driver.id)).set(copy);
    }
    return driver;
  },
  updateDriver(id, updatedDriver) {
    const drivers = this.getDrivers();
    const index = drivers.findIndex(d => d.id === Number(id));
    if (index !== -1) {
      drivers[index] = { ...drivers[index], ...updatedDriver };
      this.saveDrivers(drivers);

      if (this.isFirebaseActive) {
        const copy = { ...drivers[index] }; delete copy.id;
        this.db.collection('drivers').doc(String(id)).set(copy);
      }
      return true;
    }
    return false;
  },
  deleteDriver(id) {
    let drivers = this.getDrivers();
    drivers = drivers.filter(d => d.id !== Number(id));
    this.saveDrivers(drivers);

    if (this.isFirebaseActive) {
      this.db.collection('drivers').doc(String(id)).delete();
    }
  },

  // ================= TRIPS API =================
  getTrips() {
    return this.get(this.KEYS.TRIPS);
  },
  saveTrips(trips) {
    this.save(this.KEYS.TRIPS, trips);
  },
  addTrip(trip) {
    const trips = this.getTrips();
    trip.id = trips.length > 0 ? Math.max(...trips.map(t => t.id)) + 1 : 1;
    trip.tripCode = `TRIP-${String(trip.id).padStart(3, '0')}`;
    trips.push(trip);
    this.saveTrips(trips);

    if (this.isFirebaseActive) {
      const copy = { ...trip }; delete copy.id;
      this.db.collection('trips').doc(String(trip.id)).set(copy);
    }
    return trip;
  },
  updateTrip(id, updatedTrip) {
    const trips = this.getTrips();
    const index = trips.findIndex(t => t.id === Number(id));
    if (index !== -1) {
      trips[index] = { ...trips[index], ...updatedTrip };
      this.saveTrips(trips);

      if (this.isFirebaseActive) {
        const copy = { ...trips[index] }; delete copy.id;
        this.db.collection('trips').doc(String(id)).set(copy);
      }
      return true;
    }
    return false;
  },
  deleteTrip(id) {
    let trips = this.getTrips();
    trips = trips.filter(t => t.id !== Number(id));
    this.saveTrips(trips);

    if (this.isFirebaseActive) {
      this.db.collection('trips').doc(String(id)).delete();
    }
  },

  // ================= FUEL PRICES =================
  getFuelPrices() {
    return this.get(this.KEYS.FUEL_PRICES);
  },
  saveFuelPrices(prices) {
    this.save(this.KEYS.FUEL_PRICES, prices);
  },
  addFuelPrice(price) {
    const prices = this.getFuelPrices();
    price.id = prices.length > 0 ? Math.max(...prices.map(p => p.id)) + 1 : 1;
    prices.push(price);
    this.saveFuelPrices(prices);

    if (this.isFirebaseActive) {
      const copy = { ...price }; delete copy.id;
      this.db.collection('fuel_prices').doc(String(price.id)).set(copy);
    }
    return price;
  },

  // ================= FUEL IMPORTS =================
  getFuelImports() {
    return this.get(this.KEYS.FUEL_IMPORTS);
  },
  saveFuelImports(imports) {
    this.save(this.KEYS.FUEL_IMPORTS, imports);
  },
  addFuelImport(imp) {
    const imports = this.getFuelImports();
    imp.id = imports.length > 0 ? Math.max(...imports.map(i => i.id)) + 1 : 1;
    imports.push(imp);
    this.saveFuelImports(imports);

    if (this.isFirebaseActive) {
      const copy = { ...imp }; delete copy.id;
      this.db.collection('fuel_imports').doc(String(imp.id)).set(copy);
    }
    return imp;
  },

  // ================= FUEL DISPENSES =================
  getFuelDispenses() {
    return this.get(this.KEYS.FUEL_DISPENSES);
  },
  saveFuelDispenses(dispenses) {
    this.save(this.KEYS.FUEL_DISPENSES, dispenses);
  },
  addFuelDispense(dispense) {
    const dispenses = this.getFuelDispenses();
    dispense.id = dispenses.length > 0 ? Math.max(...dispenses.map(d => d.id)) + 1 : 1;
    dispenses.push(dispense);
    this.saveFuelDispenses(dispenses);

    if (this.isFirebaseActive) {
      const copy = { ...dispense }; delete copy.id;
      this.db.collection('fuel_dispenses').doc(String(dispense.id)).set(copy);
    }
    return dispense;
  },
  deleteFuelDispense(id) {
    let dispenses = this.getFuelDispenses();
    dispenses = dispenses.filter(d => d.id !== Number(id));
    this.saveFuelDispenses(dispenses);

    if (this.isFirebaseActive) {
      this.db.collection('fuel_dispenses').doc(String(id)).delete();
    }
  }
};

// Initialize the store immediately
EportStore.init();
