// Owner Portal - Manjula Mobile World
class OwnerPortalApp {
  constructor() {
    this.currentPage = "admin-login"
    this.isAdminLoggedIn = localStorage.getItem('manjula_admin_logged_in') === 'true'
    this.editingProductId = null
    this.previousPage = "admin-products"
    this.otpSent = false
    this.loginPhoneSaved = ""
    this.loginPasswordSaved = ""
    this.adminSearch = ""
    this.trackingFilter = "all"
    this.trackingSearch = ""
    
    // Log admin login state on app start
    if (this.isAdminLoggedIn) {
      console.log('✅ Admin login state restored from localStorage')
      this.currentPage = "admin"
    }
    
    // MongoDB API URL - Auto-detect local vs production
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const baseURL = isLocalhost ? 'http://localhost:3001' : window.location.origin;
    this.API_URL = `${baseURL}/api`
    
    // Socket.IO connection for real-time updates with reconnection
    if (typeof io !== 'undefined') {
      this.socket = io(baseURL, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: 10
      })
      this.setupSocketListeners()
    } else {
      console.warn('⚠️ Socket.IO not loaded, real-time updates disabled');
      this.socket = null;
    }
    
    this.products = [];
    this.trackingData = [];
    this.orders = [];
    this.salesRecords = [];
    this.salesSearch = "";
    this.serviceRecords = [];
    this.serviceSearch = "";
    this.displayStock = [];
    this.stockSearch = "";
    this.sparePartsStock = [];
    this.sparePartsSearch = "";
    this.customCategories = JSON.parse(localStorage.getItem('manjula_custom_categories') || '[]');
    this.stockTotalValueUnlocked = false;
    this.spareTotalValueUnlocked = false;
    
    this.init()
  }

  // Socket.IO Real-time Listeners
  setupSocketListeners() {
    if (!this.socket) {
      console.warn('⚠️ No socket connection, skipping listeners');
      return;
    }
    
    this.socket.on('connect', () => {
      console.log('✅ Connected to server for real-time updates');
      console.log('Socket ID:', this.socket.id);
    });

    this.socket.on('disconnect', (reason) => {
      console.log('❌ Disconnected from server:', reason);
    });

    this.socket.on('reconnect', (attemptNumber) => {
      console.log('🔄 Reconnected to server after', attemptNumber, 'attempts');
      // Reload data after reconnection
      this.loadProductsFromStorage();
      this.loadTrackingFromStorage();
      this.loadOrdersFromStorage();
    });

    this.socket.on('connect_error', (error) => {
      console.error('❌ Connection error:', error.message);
    });

    this.socket.on('product-added', (product) => {
      console.log('📦 [OWNER PORTAL] New product added via socket:', product);
      const exists = this.products.find(p => 
        String(p.id) === String(product.id) || 
        String(p._id) === String(product._id) ||
        String(p.id) === String(product._id) ||
        String(p._id) === String(product.id)
      );
      if (!exists) {
        this.products.push(product);
        localStorage.setItem('manjula_products', JSON.stringify(this.products));
        console.log('✅ [OWNER PORTAL] Product added to local array, total products:', this.products.length);
        if (this.currentPage === 'admin' || this.currentPage === 'admin-products') {
          console.log('🔄 [OWNER PORTAL] Re-rendering admin page');
          this.renderPage(this.currentPage);
        }
      }
    });

    this.socket.on('product-updated', (product) => {
      console.log('🔄 Product updated:', product);
      const index = this.products.findIndex(p => p.id === product.id || p._id === product._id);
      if (index !== -1) {
        this.products[index] = product;
        localStorage.setItem('manjula_products', JSON.stringify(this.products));
        if (this.currentPage === 'admin' || this.currentPage === 'admin-products') {
          this.renderPage(this.currentPage);
        }
      } 
    });

    this.socket.on('product-deleted', (data) => {
      console.log('🗑️ Product deleted:', data.id);
      this.products = this.products.filter(p => p.id !== data.id && p._id !== data.id);
      localStorage.setItem('manjula_products', JSON.stringify(this.products));
      if (this.currentPage === 'admin' || this.currentPage === 'admin-products') {
        this.renderPage(this.currentPage);
      }
    });

    this.socket.on('tracking-added', (tracking) => {
      console.log('📍 New tracking added:', tracking);
      const exists = this.trackingData.find(t => t.qrId === tracking.qrId);
      if (!exists) {
        this.trackingData.push(tracking);
        if (this.currentPage === 'admin' || this.currentPage === 'admin-tracking') {
          this.renderPage(this.currentPage);
        }
      }
    });

    this.socket.on('tracking-updated', (tracking) => {
      console.log('🔄 Tracking updated:', tracking);
      const index = this.trackingData.findIndex(t => t.qrId === tracking.qrId);
      if (index !== -1) {
        this.trackingData[index] = tracking;
        if (this.currentPage === 'admin' || this.currentPage === 'admin-tracking') {
          this.renderPage(this.currentPage);
        }
      }
    });

    this.socket.on('tracking-deleted', (data) => {
      console.log('🗑️ Tracking deleted:', data.qrId);
      this.trackingData = this.trackingData.filter(t => t.qrId !== data.qrId);
      if (this.currentPage === 'admin' || this.currentPage === 'admin-tracking') {
        this.renderPage(this.currentPage);
      }
    });

    this.socket.on('order-added', (order) => {
      console.log('🛒 New order received:', order);
      const exists = this.orders.find(o => o.orderId === order.orderId);
      if (!exists) {
        this.orders.push(order);
        if (this.currentPage === 'admin' || this.currentPage === 'admin-orders') {
          this.renderPage(this.currentPage);
        }
      }
    });

    this.socket.on('order-updated', (order) => {
      console.log('🔄 Order updated:', order);
      const index = this.orders.findIndex(o => o.orderId === order.orderId);
      if (index !== -1) {
        this.orders[index] = order;
        if (this.currentPage === 'admin' || this.currentPage === 'admin-orders') {
          this.renderPage(this.currentPage);
        }
      }
    });

    this.socket.on('order-deleted', (data) => {
      console.log('🗑️ Order deleted:', data.orderId);
      this.orders = this.orders.filter(o => o.orderId !== data.orderId);
      if (this.currentPage === 'admin' || this.currentPage === 'admin-orders') {
        this.renderPage(this.currentPage);
      }
    });
  }

  async init() {
    try {
      console.log('🚀 Initializing Manjula Mobile World App...');
      
      // Setup event listeners first
      this.setupEventListeners();
      
      // Render login page immediately (don't wait for server)
      await this.renderPage(this.currentPage);
      
      // Load data in background without blocking UI
      this.loadDataInBackground();

      // Check for ?scan= URL parameter (from barcode scan on any device)
      const urlParams = new URLSearchParams(window.location.search);
      const scanId = urlParams.get('scan');
      if (scanId) {
        // Remove the param from URL without reload
        window.history.replaceState({}, '', window.location.pathname);
        // Wait for data to load then show the tracking record
        const tryLookup = async (attempts = 0) => {
          const t = this.trackingData.find(tr => tr.qrId === scanId);
          if (t) {
            // Navigate to tracking page and show the detail modal
            this.currentPage = 'admin-tracking';
            await this.renderPage('admin-tracking');
            setTimeout(() => this.showTrackingLookupResult(t), 300);
          } else if (attempts < 8) {
            setTimeout(() => tryLookup(attempts + 1), 600);
          }
        };
        setTimeout(() => tryLookup(), 800);
      }
      
    } catch (error) {
      console.error('❌ Error during initialization:', error);
      this.showErrorMessage('Failed to load application. Please refresh the page.');
    }
  }

  async loadDataInBackground() {
    try {
      console.log('📡 Loading data in background...');
      
      // Try to load data, but don't block the UI
      await Promise.all([
        this.loadProductsFromStorage().catch(err => {
          console.log('⚠️ Products load failed:', err.message);
          this.products = [];
        }),
        this.loadTrackingFromStorage().catch(err => {
          console.log('⚠️ Tracking load failed:', err.message);
          this.trackingData = [];
        }),
        this.loadOrdersFromStorage().catch(err => {
          console.log('⚠️ Orders load failed:', err.message);
          this.orders = [];
        }),
        this.loadSalesFromStorage().catch(err => {
          console.log('⚠️ Sales load failed:', err.message);
          this.salesRecords = [];
        }),
        this.loadServicesFromStorage().catch(err => {
          console.log('⚠️ Services load failed:', err.message);
          this.serviceRecords = [];
        }),
        this.loadDisplayStockFromStorage().catch(err => {
          console.log('⚠️ Display stock load failed:', err.message);
          this.displayStock = [];
        }),
        this.loadSparePartsFromStorage().catch(err => {
          console.log('⚠️ Spare parts load failed:', err.message);
          this.sparePartsStock = [];
        })
      ]);
      
      console.log('✅ Background data load complete');
      
      // Refresh the page if user is logged in to show loaded data
      if (this.isAdminLoggedIn && this.currentPage !== 'admin-login') {
        await this.renderPage(this.currentPage);
      }
    } catch (error) {
      console.error('❌ Background data load error:', error);
    }
  }

  async checkServerStatus() {
    try {
      const response = await fetch(`${this.API_URL}/health`, { 
        method: 'GET',
        timeout: 5000 
      });
      
      if (response.ok) {
        const health = await response.json();
        console.log('✅ Server is awake:', health.uptime, 'seconds uptime');
      }
    } catch (error) {
      console.log('⏰ Server might be waking up from sleep, but continuing...');
      // Don't block the UI - just log the issue
    }
  }

  showWakeUpMessage() {
    const app = document.getElementById("app");
    if (app) {
      app.innerHTML = `
        <div class="loading-screen">
          <div class="loading-container">
            <div class="mobile-icon-wrapper">
              <div class="mobile-phone">
                <div class="phone-screen">
                  <div class="loading-bars">
                    <div class="bar"></div>
                    <div class="bar"></div>
                    <div class="bar"></div>
                    <div class="bar"></div>
                  </div>
                </div>
                <div class="phone-button"></div>
              </div>
            </div>
            
            <div class="loading-text">
              <h2>Waking Up Server</h2>
              <p class="loading-subtitle">Please wait while we start the server...</p>
              <div class="loading-progress">
                <div class="progress-bar"></div>
              </div>
              <p class="loading-status">This may take 30-60 seconds on first visit</p>
              <p class="loading-time">Thank you for your patience! 🙏</p>
            </div>
          </div>
        </div>
      `;
    }
  }

  async loadDataWithRetry() {
    const maxRetries = 3;
    let retryCount = 0;
    
    while (retryCount < maxRetries) {
      try {
        await Promise.all([
          this.loadProductsFromStorage(),
          this.loadTrackingFromStorage(),
          this.loadOrdersFromStorage()
        ]);
        return; // Success, exit retry loop
      } catch (error) {
        retryCount++;
        console.log(`⚠️ Load attempt ${retryCount} failed:`, error.message);
        
        if (retryCount < maxRetries) {
          console.log(`🔄 Retrying in ${retryCount * 2} seconds...`);
          await new Promise(resolve => setTimeout(resolve, retryCount * 2000));
        } else {
          console.error('❌ All retry attempts failed');
          throw error;
        }
      }
    }
  }

  showLoadingScreen() {
    const app = document.getElementById("app");
    if (app) {
      app.innerHTML = `
        <div class="loading-screen">
          <div class="loading-container">
            <div class="mobile-icon-wrapper">
              <div class="mobile-phone">
                <div class="phone-screen">
                  <div class="loading-bars">
                    <div class="bar"></div>
                    <div class="bar"></div>
                    <div class="bar"></div>
                    <div class="bar"></div>
                  </div>
                </div>
                <div class="phone-button"></div>
              </div>
            </div>
            
            <div class="loading-text">
              <h2>Owner Portal</h2>
              <p class="loading-subtitle">Manjula Mobile World Management</p>
              <div class="loading-progress">
                <div class="progress-bar"></div>
              </div>
              <p class="loading-status">Loading admin data...</p>
            </div>
          </div>
        </div>
      `;
    }
  }

  setupEventListeners() {
    const app = document.getElementById("app")
    
    if (!app) {
      console.error('❌ App container not found!');
      return;
    }
    
    // Event delegation for all click events
    app.addEventListener("click", async (e) => {
      // Navigation and page routing
      const pageElement = e.target.closest('[data-page]');
      if (pageElement && pageElement.dataset.page) {
        e.preventDefault()
        console.log('📄 Navigating to page:', pageElement.dataset.page);
        await this.renderPage(pageElement.dataset.page)
      }
      
      // Filter buttons
      const filterElement = e.target.closest('[data-filter]');
      if (filterElement && filterElement.dataset.filter) {
        e.preventDefault();
        this.filterTracking(filterElement.dataset.filter);
      }
      
      // Admin actions
      const actionElement = e.target.closest('[data-action]');
      if (actionElement && actionElement.dataset.action === "admin-login") {
        this.handleAdminLogin()
      }
      if (actionElement && actionElement.dataset.action === "admin-request-otp") {
        this.requestAdminOtp()
      }
      if (actionElement && actionElement.dataset.action === "admin-logout") {
        this.handleAdminLogout()
      }
      if (actionElement && actionElement.dataset.action === "add-product-form") {
        this.previousPage = this.currentPage
        this.renderPage("admin-add-product")
      }
      if (actionElement && actionElement.dataset.action === "edit-product") {
        const productId = actionElement.dataset.productId
        this.editingProductId = productId
        this.previousPage = this.currentPage
        this.renderPage("admin-edit-product")
      }
      if (actionElement && actionElement.dataset.action === "delete-product") {
        const productId = actionElement.dataset.productId
        this.deleteProduct(productId)
      }
      if (actionElement && actionElement.dataset.action === "save-product") {
        this.saveProduct()
      }
      
      // Tracking actions
      if (actionElement && actionElement.dataset.action === "save-new-tracking") {
        this.saveNewTracking()
      }
      if (actionElement && actionElement.dataset.action === "toggle-tracking-form") {
        this.toggleTrackingForm()
      }
      if (actionElement && actionElement.dataset.action === "edit-tracking") {
        const qrId = actionElement.dataset.qrId
        this.editTracking(qrId)
      }
      if (actionElement && actionElement.dataset.action === "delete-tracking") {
        const qrId = actionElement.dataset.qrId
        this.deleteTracking(qrId)
      }
    })

    // Handle input events for search
    app.addEventListener('input', (e) => {
      if (e.target.id === 'trackingSearchInput') {
        // Just update the search value, debouncing will handle the rest
        this.handleTrackingSearch(e.target.value);
      }
      if (e.target.id === 'adminSearch') {
        this.adminSearch = e.target.value;
      }
    })

    // Handle Enter key in search inputs
    app.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        // Prevent Enter from navigating away on any search input
        if (e.target.id === 'adminSearch' || 
            e.target.id === 'trackingSearchInput' ||
            e.target.classList.contains('input')) {
          e.preventDefault();
        }
      }
    })

    // Global barcode scanner listener
    // When scanner fires on tracking page with nothing focused, route to globalScanInput
    this._scannerBuffer = '';
    this._scannerLastKey = 0;
    document.addEventListener('keydown', (e) => {
      if (this.currentPage !== 'admin-tracking') return;

      const activeId = document.activeElement?.id;
      const tag = document.activeElement?.tagName;
      const inInput = (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT');

      // If already in globalScanInput, let the input's own onkeydown handle it
      if (activeId === 'globalScanInput') return;

      // If in any other input, don't interfere
      if (inInput) return;

      // Nothing focused — capture scanner chars and route to globalScanInput
      const now = Date.now();
      const gap = now - this._scannerLastKey;
      this._scannerLastKey = now;

      if (e.key === 'Enter') {
        // Fire lookup with whatever is in the scan input
        const scanInput = document.getElementById('globalScanInput');
        const code = (scanInput?.value || this._scannerBuffer).trim();
        this._scannerBuffer = '';
        if (scanInput) scanInput.value = '';
        if (code.length >= 3) {
          this.lookupBarcode(code);
        }
      } else if (e.key.length === 1) {
        if (gap > 1200) this._scannerBuffer = ''; // generous reset for slow scanner guns
        this._scannerBuffer += e.key;

        // Route to scan input and focus it so user can see what's being scanned
        const scanInput = document.getElementById('globalScanInput');
        if (scanInput) {
          scanInput.value = this._scannerBuffer;
          scanInput.focus();
        }
      }
    });
  }

  async requestAdminOtp() {
    const phone    = document.getElementById("adminPhone")?.value || ""
    const password = document.getElementById("adminPassword")?.value || ""

    if (!phone || !password) {
      alert("Please enter both Phone Number and Password.");
      return;
    }

    try {
      const response = await fetch(`${this.API_URL}/admin/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, password })
      });

      const result = await response.json();

      if (response.ok && result.success) {
        this.otpSent = true;
        this.loginPhoneSaved = phone;
        this.loginPasswordSaved = password;
        if (result.warning) {
          alert(`⚠️ OTP Generated!\n\n${result.message}`);
        } else {
          alert("✅ OTP sent to your registered email address (keerthivasan98406@gmail.com)");
        }
        await this.renderPage("admin-login");
      } else {
        alert(result.message || "Invalid phone number or password. Please try again.");
      }
    } catch (error) {
      console.error('❌ OTP request failed:', error);
      alert("Request failed. Please check your connection and try again.");
    }
  }

  resetLoginFlow(e) {
    if (e) e.preventDefault();
    this.otpSent = false;
    this.loginPhoneSaved = "";
    this.loginPasswordSaved = "";
    this.renderPage("admin-login");
  }

  async handleAdminLogin() {
    const phone    = this.loginPhoneSaved || document.getElementById("adminPhone")?.value || ""
    const password = this.loginPasswordSaved || document.getElementById("adminPassword")?.value || ""
    const otp      = document.getElementById("adminOtp")?.value || ""

    if (!otp) {
      alert("Please enter the 6-digit OTP code.");
      return;
    }

    try {
      const response = await fetch(`${this.API_URL}/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, password, otp })
      });

      const result = await response.json();

      if (response.ok && result.success) {
        this.isAdminLoggedIn = true;
        localStorage.setItem('manjula_admin_logged_in', 'true');
        this.otpSent = false;
        this.loginPhoneSaved = "";
        this.loginPasswordSaved = "";
        console.log('✅ Admin logged in via server auth with OTP');
        await this.renderPage("admin");
      } else {
        alert(result.message || "Invalid OTP code. Please check and try again.");
      }
    } catch (error) {
      console.error('❌ Login request failed:', error);
      alert("Login failed. Please check your connection and try again.");
    }
  }

  async handleAdminLogout() {
    this.isAdminLoggedIn = false
    localStorage.removeItem('manjula_admin_logged_in')
    console.log('✅ Admin logged out - state removed from localStorage')
    await this.renderPage("admin-login")
  }

  // Product Management Methods - Database ONLY
  async loadProductsFromStorage() {
    try {
      console.log('📡 [OWNER PORTAL] Loading products from database...');
      
      const response = await fetch(`${this.API_URL}/products`);
      if (response.ok) {
        this.products = await response.json();
        console.log('✅ [OWNER PORTAL] Loaded products from database:', this.products.length);
      } else {
        console.log('⚠️ [OWNER PORTAL] Failed to load from database');
        this.products = [];
      }
    } catch (error) {
      console.error('❌ [OWNER PORTAL] Error loading products:', error);
      this.products = [];
    }
  }

  // Tracking Management Methods
  async loadTrackingFromStorage() {
    try {
      const response = await fetch(`${this.API_URL}/tracking`);
      if (response.ok) {
        this.trackingData = await response.json();
        console.log('✅ Loaded tracking from database:', this.trackingData.length);
      } else {
        this.trackingData = [];
      }
    } catch (error) {
      console.error('❌ Error loading tracking:', error);
      this.trackingData = [];
    }
  }

  // Orders Management Methods
  async loadOrdersFromStorage() {
    try {
      console.log('📡 [OWNER] Loading orders from database...');
      const response = await fetch(`${this.API_URL}/orders`);
      if (response.ok) {
        this.orders = await response.json();
        console.log('✅ [OWNER] Loaded orders from database:', this.orders.length);
        this.orders.forEach((order, index) => {
          console.log(`📋 [OWNER] Order ${index + 1}:`, {
            orderId: order.orderId,
            hasScreenshot: !!order.paymentScreenshot,
            screenshotDataLength: order.paymentScreenshot?.data?.length,
            paymentMethod: order.paymentMethod
          });
        });
      } else {
        console.log('⚠️ [OWNER] Failed to load orders from database');
        this.orders = [];
      }
    } catch (error) {
      console.error('❌ [OWNER] Error loading orders:', error);
      this.orders = [];
    }
  }

  async loadSalesFromStorage() {
    try {
      const response = await fetch(`${this.API_URL}/sales`);
      if (response.ok) {
        this.salesRecords = await response.json();
        console.log('✅ Loaded sales from database:', this.salesRecords.length);
      } else {
        this.salesRecords = [];
      }
    } catch (error) {
      console.error('❌ Error loading sales:', error);
      this.salesRecords = [];
    }
  }

  async loadServicesFromStorage() {
    try {
      const response = await fetch(`${this.API_URL}/services`);
      if (response.ok) {
        this.serviceRecords = await response.json();
        console.log('✅ Loaded services from database:', this.serviceRecords.length);
      } else {
        this.serviceRecords = [];
      }
    } catch (error) {
      console.error('❌ Error loading services:', error);
      this.serviceRecords = [];
    }
  }

  async loadDisplayStockFromStorage() {
    try {
      const response = await fetch(`${this.API_URL}/display-stock`);
      if (response.ok) {
        this.displayStock = await response.json();
        this.displayStock.sort((a, b) => {
          const nameA = (a.displayName || '').trim().toLowerCase();
          const nameB = (b.displayName || '').trim().toLowerCase();
          return nameA.localeCompare(nameB);
        });
        console.log('✅ Loaded display stock from database:', this.displayStock.length);
      } else {
        this.displayStock = [];
      }
    } catch (error) {
      console.error('❌ Error loading display stock:', error);
      this.displayStock = [];
    }
  }

  async loadSparePartsFromStorage() {
    try {
      const response = await fetch(`${this.API_URL}/spare-parts`);
      if (response.ok) {
        this.sparePartsStock = await response.json();
        console.log('✅ Loaded spare parts from database:', this.sparePartsStock.length);
      } else {
        this.sparePartsStock = [];
      }
    } catch (error) {
      console.error('❌ Error loading spare parts:', error);
      this.sparePartsStock = [];
    }
  }

  async renderPage(page) {
    const app = document.getElementById("app")
    this.currentPage = page

    if (page.startsWith("admin") && !this.isAdminLoggedIn) {
      page = "admin-login"
    }

    let html = this.renderNavigation()

    if (page === "admin-login") {
      html += this.renderAdminLogin()
    } else if (page === "admin") {
      html += this.renderAdmin()
    } else if (page === "admin-products") {
      html += this.renderAdminProducts()
    } else if (page === "admin-tracking") {
      html += this.renderAdminTracking()
    } else if (page === "admin-tracking-daily") {
      html += this.renderTrackingDailyIncome()
    } else if (page === "admin-tracking-monthly") {
      html += this.renderTrackingMonthlyIncome()
    } else if (page === "admin-orders") {
      html += this.renderAdminOrders()
    } else if (page === "admin-sales") {
      html += this.renderAdminSales()
    } else if (page === "admin-sales-monthly") {
      html += this.renderMonthlySales()
    } else if (page === "admin-services") {
      html += this.renderAdminServices()
    } else if (page === "admin-services-daily") {
      html += this.renderDailyServices()
    } else if (page === "admin-services-monthly") {
      html += this.renderMonthlyServices()
    } else if (page === "admin-display-stock") {
      html += this.renderDisplayStock()
    } else if (page === "admin-spare-parts") {
      html += this.renderSpareParts()
    } else if (page === "admin-add-product") {
      html += this.renderAddProductForm()
    } else if (page === "admin-edit-product") {
      html += this.renderEditProductForm()
    }

    html += this.renderFooter()

    app.innerHTML = html
  }

  renderNavigation() {
    return `
      <nav>
        <div class="nav-content">
          <div class="nav-brand" style="cursor: pointer; display: flex; align-items: center; gap: 12px;">
            <div class="nav-logo">
              <img src="https://i.pinimg.com/736x/e3/6f/79/e36f793e016dd6b35cd27f84030b7487.jpg" alt="Manjula Mobile World Logo" style="width: 50px; height: 50px; object-fit: contain; border-radius: 8px;">
            </div>
            <div class="nav-title" data-page="admin">
              <div style="font-size: 16px; font-weight: 700; white-space: nowrap;">OWNER PORTAL</div>
              <div style="font-size: 10px; font-weight: 500; margin-top: 1px;">Manjula Mobile World Management</div>
            </div>
          </div>
          
          <ul class="nav nav-pills">
            ${this.isAdminLoggedIn ? `
              <li class="nav-item">
                <a class="nav-link ${this.currentPage === 'admin' ? 'active' : ''}" data-page="admin">Dashboard</a>
              </li>
              <li class="nav-item">
                <a class="nav-link ${this.currentPage === 'admin-products' ? 'active' : ''}" data-page="admin-products">Products</a>
              </li>
              <li class="nav-item">
                <a class="nav-link ${this.currentPage === 'admin-tracking' ? 'active' : ''}" data-page="admin-tracking">Tracking</a>
              </li>
              <li class="nav-item">
                <a class="nav-link ${this.currentPage === 'admin-orders' ? 'active' : ''}" data-page="admin-orders">Orders</a>
              </li>
              <li class="nav-item">
                <a class="nav-link ${this.currentPage === 'admin-sales' || this.currentPage === 'admin-sales-monthly' ? 'active' : ''}" data-page="admin-sales">🛍️ Sales Records</a>
              </li>
              <li class="nav-item">
                <a class="nav-link ${this.currentPage === 'admin-display-stock' ? 'active' : ''}" data-page="admin-display-stock">📦 Display Stock</a>
              </li>
              <li class="nav-item">
                <a class="nav-link ${this.currentPage === 'admin-spare-parts' ? 'active' : ''}" data-page="admin-spare-parts">🔩 Spare Parts</a>
              </li>
              <li class="nav-item">
                <a class="nav-link" href="index.html">← Main Site</a>
              </li>
              <li class="nav-item">
                <a class="nav-link admin-pill" data-action="admin-logout">Logout</a>
              </li>
            ` : `
              <li class="nav-item">
                <a class="nav-link" href="index.html">← Back to Main Site</a>
              </li>
            `}
          </ul>
        </div>
      </nav>
    `
  }

  renderAdminLogin() {
    return `
      <div style="min-height: 100vh; background-color: #020617; padding-top: 96px; display: flex; align-items: center; justify-content: center;">
        <div style="background-color: rgba(30, 41, 59, 0.5); border: 1px solid #334155; border-radius: 12px; padding: 48px; max-width: 400px; width: 100%; margin: 0 16px;">
          <div style="text-align: center; margin-bottom: 32px;">
            <h1 style="font-size: 32px; font-weight: 700; margin-bottom: 8px;">Owner Portal</h1>
            <p style="color: #94a3b8;">Enter your credentials to access the management panel</p>
          </div>
          
          <div class="form-field">
            <label class="form-label">Phone Number</label>
            <input type="tel" class="input" placeholder="Enter phone number" id="adminPhone" 
              value="${this.loginPhoneSaved || ''}" 
              ${this.otpSent ? 'disabled style="background: rgba(255,255,255,0.05); color: #64748b;"' : ''}
              onkeydown="if(event.key === 'Enter') app.requestAdminOtp()">
          </div>
          
          <div class="form-field">
            <label class="form-label">Password</label>
            <input type="password" class="input" placeholder="Enter password" id="adminPassword" 
              value="${this.loginPasswordSaved || ''}" 
              ${this.otpSent ? 'disabled style="background: rgba(255,255,255,0.05); color: #64748b;"' : ''}
              onkeydown="if(event.key === 'Enter') app.requestAdminOtp()">
          </div>

          ${this.otpSent ? `
            <div class="form-field">
              <label class="form-label" style="color: #f43f5e; font-weight: 700;">Enter OTP (Sent to Email)</label>
              <input type="text" class="input" placeholder="Enter 6-digit OTP" id="adminOtp" maxlength="6" 
                style="border-color: #f43f5e; text-align: center; font-size: 20px; letter-spacing: 6px; font-weight: 900; background: #fff; color: #000;"
                onkeydown="if(event.key === 'Enter') app.handleAdminLogin()"
                autofocus>
            </div>
            
            <button class="btn btn-primary" style="width: 100%; padding: 12px; font-size: 16px; background-color: #f43f5e; border-color: #f43f5e;" data-action="admin-login">Verify &amp; Login</button>
            <div style="margin-top: 16px; text-align: center;">
              <a href="#" onclick="app.resetLoginFlow(event)" style="color: #94a3b8; text-decoration: none; font-size: 13px; font-weight: 600;">← Change Credentials</a>
            </div>
          ` : `
            <button class="btn btn-primary" style="width: 100%; padding: 12px; font-size: 16px;" data-action="admin-request-otp">Get OTP</button>
          `}
          
          <div style="margin-top: 24px; text-align: center;">
            <a href="index.html" style="color: #94a3b8; text-decoration: none; font-size: 14px;">← Back to Main Site</a>
          </div>
        </div>
      </div>
    `
  }
 
 renderAdmin() {
    return `
      <div style="min-height: 100vh; background-color: #f13e74fb; padding-top: 96px; padding-bottom: 80px;">
        <div class="container">
          <div style="margin-bottom: 32px;">
            <h1 style="font-size: 48px; font-weight: 700; margin-bottom: 8px;">Owner Dashboard</h1>
            <p style="color: #94a3b8;">Manage your products, repair tracking, and customer orders</p>
          </div>

          <!-- Navigation Buttons -->
          <div style="display: flex; gap: 16px; margin-bottom: 32px; flex-wrap: wrap;">
            <button class="btn btn-primary" data-page="admin-products" style="flex: 1; min-width: 200px; padding: 16px; font-size: 16px; display: flex; align-items: center; justify-content: center; gap: 8px;">
              <span style="font-size: 24px;">📦</span>
              <span>Products Management</span>
            </button>
            <button class="btn btn-primary" data-page="admin-tracking" style="flex: 1; min-width: 200px; padding: 16px; font-size: 16px; display: flex; align-items: center; justify-content: center; gap: 8px;">
              <span style="font-size: 24px;">🔧</span>
              <span>Tracking Management</span>
            </button>
            <button class="btn btn-primary" data-page="admin-orders" style="flex: 1; min-width: 200px; padding: 16px; font-size: 16px; display: flex; align-items: center; justify-content: center; gap: 8px;">
              <span style="font-size: 24px;">📋</span>
              <span>Orders Management</span>
            </button>
            <button class="btn btn-primary" data-page="admin-sales" style="flex: 1; min-width: 200px; padding: 16px; font-size: 16px; display: flex; align-items: center; justify-content: center; gap: 8px;">
              <span style="font-size: 24px;">🛍️</span>
              <span>Sales Records</span>
            </button>
            <button class="btn btn-primary" data-page="admin-display-stock" style="flex: 1; min-width: 200px; padding: 16px; font-size: 16px; display: flex; align-items: center; justify-content: center; gap: 8px;">
              <span style="font-size: 24px;">📦</span>
              <span>Display Stock</span>
            </button>
            <button class="btn btn-primary" data-page="admin-spare-parts" style="flex: 1; min-width: 200px; padding: 16px; font-size: 16px; display: flex; align-items: center; justify-content: center; gap: 8px;">
              <span style="font-size: 24px;">🔩</span>
              <span>Spare Parts</span>
            </button>
          </div>

          <!-- Quick Stats -->
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 32px;">
            <div style="background: linear-gradient(135deg, rgba(38, 162, 220, 0.4), rgba(185, 28, 28, 0.2)); border: 2px solid #dcca2691; border-radius: 12px; padding: 20px; text-align: center;">
              <div style="font-size: 32px; font-weight: 700; color: #f7f7f7ff; margin-bottom: 4px;">${this.products.length}</div>
              <div style="color: #000205ff; font-size: 14px;">Total Products</div>
            </div>
            <div style="background: linear-gradient(135deg, rgba(38, 162, 220, 0.4), rgba(185, 28, 28, 0.2)); border: 2px solid #dcca2691; border-radius: 12px; padding: 20px; text-align: center;">
              <div style="font-size: 32px; font-weight: 700; color: #fffffffd; margin-bottom: 4px;">${this.trackingData.length}</div>
              <div style="color: #000000ff; font-size: 14px;">Active Tracking</div>
            </div>
            <div style="background: linear-gradient(135deg, rgba(38, 162, 220, 0.4), rgba(185, 28, 28, 0.2)); border: 2px solid #dcca2691; border-radius: 12px; padding: 20px; text-align: center;">
              <div style="font-size: 32px; font-weight: 700; color: #ffffffff; margin-bottom: 4px;">${this.orders.length}</div>
              <div style="color: #000000ff; font-size: 14px;">Customer Orders</div>
            </div>
          </div>

          <!-- Welcome Section -->
          <div style="background: linear-gradient(135deg, rgba(220, 38, 38, 0.1), rgba(185, 28, 28, 0.1)); border: 2px solid #dc262673; border-radius: 16px; padding: 40px; text-align: center;">
            <div style="font-size: 64px; margin-bottom: 20px;">🎯</div>
            <h2 style="font-size: 32px; font-weight: 700; margin-bottom: 16px; color: #000000;">Welcome to Owner Portal</h2>
            <p style="font-size: 18px; color: #000000ff; margin-bottom: 32px;">Use the buttons above to manage your business</p>
            
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; max-width: 800px; margin: 0 auto;">
              <div style="background: rgba(255, 255, 255, 0.5); border: 2px solid #fecaca; border-radius: 12px; padding: 24px;">
                <div style="font-size: 36px; margin-bottom: 12px;">📦</div>
                <h3 style="font-size: 18px; font-weight: 600; margin-bottom: 8px; color: #000000;">Products</h3>
                <p style="font-size: 14px; color: #64748b;">Manage inventory and pricing</p>
              </div>
              
              <div style="background: rgba(255, 255, 255, 0.5); border: 2px solid #fecaca; border-radius: 12px; padding: 24px;">
                <div style="font-size: 36px; margin-bottom: 12px;">🔧</div>
                <h3 style="font-size: 18px; font-weight: 600; margin-bottom: 8px; color: #000000;">Tracking</h3>
                <p style="font-size: 14px; color: #64748b;">Monitor repair status</p>
              </div>
              
              <div style="background: rgba(255, 255, 255, 0.5); border: 2px solid #fecaca; border-radius: 12px; padding: 24px;">
                <div style="font-size: 36px; margin-bottom: 12px;">📋</div>
                <h3 style="font-size: 18px; font-weight: 600; margin-bottom: 8px; color: #000000;">Orders</h3>
                <p style="font-size: 14px; color: #64748b;">View customer orders</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    `
  }

  renderAdminProducts() {
    const searchTerm = (document.getElementById("adminSearch")?.value || "").toLowerCase();
    const filteredProducts = this.products.filter(
      (product) =>
        product.name.toLowerCase().includes(searchTerm) || product.category.toLowerCase().includes(searchTerm),
    );

    const outOfStock = this.products.filter(p => (Number(p.stock) || 0) === 0 && p.inStock !== false);
    const lowStock = this.products.filter(p => { const s = Number(p.stock) || 0; return s > 0 && s <= 3; });

    return `
      <div style="min-height: 100vh; background-color: #f13e74fb; padding-top: 96px; padding-bottom: 80px;">
        <div class="container">
          <button class="back-button" data-page="admin" style="margin-bottom: 20px;">&#8592; Dashboard</button>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 32px;">
            <div>
              <h1 style="font-size: 36px; font-weight: 700; margin-bottom: 8px;">Products Management</h1>
              <p style="color: #94a3b8;">Manage your product inventory</p>
            </div>
            <div style="display:flex; gap:10px; flex-wrap:wrap;">
              <button class="btn btn-primary" data-action="add-product-form" style="padding: 12px 24px; font-size: 16px;">+ Add Product</button>
              <button onclick="app.exportProductsPDF()" style="padding: 12px 24px; background:#1e293b; color:#fff; border:none; border-radius:8px; font-size:14px; font-weight:700; cursor:pointer;">📄 PDF</button>
            </div>
          </div>

          ${(outOfStock.length > 0 || lowStock.length > 0) ? `
          <div style="background: rgba(255,255,255,0.95); border-radius: 12px; padding: 16px 20px; margin-bottom: 20px; border: 2px solid #fca5a5;">
            <div style="font-weight:700; color:#111; font-size:14px; margin-bottom:10px;">⚠️ Stock Alerts</div>
            ${outOfStock.length > 0 ? `
              <div style="margin-bottom:8px;">
                <span style="background:#fee2e2; color:#dc2626; padding:3px 10px; border-radius:20px; font-size:12px; font-weight:700; margin-right:8px;">🔴 Out of Stock (${outOfStock.length})</span>
                <span style="font-size:13px; color:#dc2626; font-weight:600;">${outOfStock.map(p => p.name).join(' &nbsp;·&nbsp; ')}</span>
              </div>
            ` : ''}
            ${lowStock.length > 0 ? `
              <div>
                <span style="background:#fef3c7; color:#d97706; padding:3px 10px; border-radius:20px; font-size:12px; font-weight:700; margin-right:8px;">🟡 Low Stock ≤3 (${lowStock.length})</span>
                <span style="font-size:13px; color:#d97706; font-weight:600;">${lowStock.map(p => `${p.name} (${Number(p.stock)})`).join(' &nbsp;·&nbsp; ')}</span>
              </div>
            ` : ''}
          </div>
          ` : ''}

          <div style="margin-bottom: 24px; display: flex; gap: 16px; align-items: center;">
            <input 
              type="text" 
              class="input" 
              placeholder="Search products..." 
              id="adminSearch"
              style="flex: 1;"
              oninput="app.searchProducts(this.value)"
            >
            <span style="color: #94a3b8; font-size: 14px;">Total: ${filteredProducts.length} products</span>
          </div>

          <div class="admin-products-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px;">
            ${
              filteredProducts.length > 0
                ? filteredProducts.map((product) => this.renderAdminProductCard(product)).join("")
                : '<div style="grid-column: 1/-1; text-align: center; padding: 48px; color: #94a3b8;">No products found</div>'
            }
          </div>
        </div>
      </div>
    `
  }

  renderAdminProductCard(product) {
    const productId = product.id || product._id || 'unknown';
    const discountPercent = product.originalPrice && product.price ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100) : 0;
    const stock = Number(product.stock) || 0;
    const stockAlert = stock === 0
      ? `<span style="background:rgba(239,68,68,0.2);color:#ef4444;font-size:10px;padding:2px 7px;border-radius:4px;font-weight:700;">⚠️ Out of Stock</span>`
      : stock <= 3
      ? `<span style="background:rgba(245,158,11,0.2);color:#f59e0b;font-size:10px;padding:2px 7px;border-radius:4px;font-weight:700;">⚠️ Low Stock (${stock})</span>`
      : `<span style="background:rgba(16,185,129,0.15);color:#10b981;font-size:10px;padding:2px 7px;border-radius:4px;font-weight:700;">📦 Stock: ${stock}</span>`;
    
    return `
      <div class="admin-product-card" style="background-color: rgba(30, 41, 59, 0.5); border: 1px solid ${stock === 0 ? '#ef4444' : stock <= 3 ? '#f59e0b' : '#334155'}; border-radius: 8px; padding: 16px; margin-bottom: 16px; max-width: 300px;">
        <div class="admin-product-image" style="width: 100%; height: 120px; margin-bottom: 12px; display: flex; align-items: center; justify-content: center; background: rgba(51, 65, 85, 0.3); border-radius: 6px;">
          ${product.imageUrl ? 
            `<img src="${product.imageUrl}" alt="${product.name}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 6px;">` :
            `<span style="font-size: 32px;">${product.image || '📦'}</span>`
          }
        </div>
        <div class="admin-product-info">
          <h3 style="margin-bottom: 6px; font-size: 14px; font-weight: 600; color: #f8fafc;">${product.name}</h3>
          <div style="color: #94a3b8; font-size: 11px; margin-bottom: 6px;">${product.category}</div>
          <div style="margin-bottom: 4px;">
            <span style="font-weight: 700; color: #10b981; font-size: 14px;">₹${(product.price || 0).toLocaleString()}</span>
            <span style="color: #94a3b8; text-decoration: line-through; margin-left: 6px; font-size: 12px;">₹${(product.originalPrice || 0).toLocaleString()}</span>
            ${discountPercent > 0 ? `<span style="color: #f59e0b; font-size: 10px; margin-left: 6px;">${discountPercent}% off</span>` : ''}
          </div>
          ${product.ownerPrice ? `<div style="margin-bottom: 6px; font-size: 12px; color: #f59e0b; font-weight: 600;">🔒 Owner: ₹${Number(product.ownerPrice).toLocaleString()}</div>` : ''}
          <div style="margin-bottom: 8px; display:flex; gap:6px; flex-wrap:wrap; align-items:center;">
            <span class="stock-badge ${product.inStock ? 'in-stock' : 'out-of-stock'}" style="font-size: 10px; padding: 2px 6px; border-radius: 4px; ${product.inStock ? 'background: rgba(16, 185, 129, 0.2); color: #10b981;' : 'background: rgba(239, 68, 68, 0.2); color: #ef4444;'}">${product.inStock ? 'In Stock' : 'Out of Stock'}</span>
            ${stockAlert}
          </div>
          <div style="display: flex; gap: 6px;">
            <button class="btn btn-secondary" style="flex: 1; padding: 4px 8px; font-size: 11px;" data-action="edit-product" data-product-id="${productId}">Edit</button>
            <button class="btn" style="flex: 1; padding: 4px 8px; font-size: 11px; background: rgba(244, 63, 94, 0.1); color: #f87171; border: 1px solid #f87171; border-radius: 4px;" data-action="delete-product" data-product-id="${productId}">Delete</button>
          </div>
        </div>
      </div>
    `
  }

  renderAdminTracking() {
    // Daily Sales rule:
    // - Records saved WITH the new payment system: count advance + paid only (never full price or balance)
    // - Records saved BEFORE the new payment system (no advanceAmount field): count the stored amount
    //   so old data still shows correctly
    const calcReceived = (t) => {
      // If advanceAmount was never saved (old record), fall back to amount
      if (t.advanceAmount === undefined && t.paidAmount === undefined) {
        return Number(t.amount) || 0;
      }
      // New record — only advance + paid count toward daily sales
      return (Number(t.advanceAmount) || 0) + (Number(t.paidAmount) || 0);
    };

    // Calculate today's income
    const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const todayRecords = this.trackingData.filter(t => t.createdAt === today);
    const todayIncome = todayRecords.reduce((sum, t) => sum + calcReceived(t), 0);

    // Calculate this month's income
    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();
    const monthRecords = this.trackingData.filter(t => {
      if (!t.createdAt) return false;
      const parts = t.createdAt.split('/');
      if (parts.length !== 3) return false;
      const d = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
      return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
    });
    const monthIncome = monthRecords.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    const monthLabel = now.toLocaleString('en-IN', { month: 'long', year: 'numeric' });

    return `
      <div style="min-height: 100vh; background-color: #f13e74fb; padding-top: 96px; padding-bottom: 80px;">
        <div class="container">
          <button class="back-button" data-page="admin" style="margin-bottom: 20px;">&#8592; Dashboard</button>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; flex-wrap: wrap; gap: 12px;">
            <div>
              <h1 style="font-size: 36px; font-weight: 700; margin-bottom: 8px;">Tracking Management</h1>
              <p style="color: #94a3b8;">Manage repair tracking records</p>
            </div>
            <!-- Income widgets + Add button in one row -->
            <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
              <!-- Today's Income widget -->
              <div onclick="app.renderPage('admin-tracking-daily')" style="background: linear-gradient(135deg,#065f46,#047857); border: 2px solid #10b981; border-radius: 10px; padding: 10px 16px; cursor: pointer; min-width: 130px; transition: transform 0.2s;" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform=''">
                <div style="font-size: 10px; color: #6ee7b7; font-weight: 600; margin-bottom: 2px;">📅 Today</div>
                <div style="font-size: 20px; font-weight: 800; color: #fff; line-height:1;">₹${todayIncome.toLocaleString('en-IN')}</div>
                <div style="font-size: 10px; color: #a7f3d0; margin-top: 2px;">${todayRecords.length} record${todayRecords.length !== 1 ? 's' : ''} →</div>
              </div>
              <!-- Monthly Income widget -->
              <div onclick="app.renderPage('admin-tracking-monthly')" style="background: linear-gradient(135deg,#1e3a8a,#1d4ed8); border: 2px solid #3b82f6; border-radius: 10px; padding: 10px 16px; cursor: pointer; min-width: 130px; transition: transform 0.2s;" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform=''">
                <div style="font-size: 10px; color: #93c5fd; font-weight: 600; margin-bottom: 2px;">📆 ${monthLabel}</div>
                <div style="font-size: 20px; font-weight: 800; color: #fff; line-height:1;">₹${monthIncome.toLocaleString('en-IN')}</div>
                <div style="font-size: 10px; color: #bfdbfe; margin-top: 2px;">${monthRecords.length} record${monthRecords.length !== 1 ? 's' : ''} →</div>
              </div>
              <!-- Add Tracking button -->
              <button class="btn btn-primary" data-action="toggle-tracking-form" style="padding: 12px 24px; font-size: 16px; white-space: nowrap;">+ Add Tracking</button>
              <!-- Export buttons -->
              <button onclick="app.exportTrackingPDF()" style="padding: 10px 16px; background:#1e293b; color:#fff; border:none; border-radius:8px; font-size:13px; font-weight:700; cursor:pointer; white-space:nowrap;">📄 PDF</button>
              <button onclick="app.exportTrackingXL()" style="padding: 10px 16px; background:#16a34a; color:#fff; border:none; border-radius:8px; font-size:13px; font-weight:700; cursor:pointer; white-space:nowrap;">📊 XL Sheet</button>
            </div>
          </div>

          ${this.renderTrackingForm()}

          <!-- Permanent Barcode Scan Bar — always visible, works anytime -->
          <div id="persistentScanBar" style="background:rgba(16,185,129,0.12); border:1.5px solid #10b981; border-radius:10px; padding:10px 16px; margin-bottom:20px; display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
            <span style="font-size:13px; font-weight:700; color:#10b981; white-space:nowrap;">📷 Scan Barcode:</span>
            <input type="text" id="globalScanInput" placeholder="Scan barcode here to lookup any tracking record..."
              style="flex:1; min-width:200px; padding:8px 12px; border:1px solid #10b981; border-radius:6px; background:rgba(30,41,59,0.9); color:#fff; font-size:13px; outline:none;"
              autocomplete="off"
              onkeydown="if(event.key==='Enter'){ event.preventDefault(); const v=this.value.trim(); this.value=''; app._scannerBuffer=''; if(v.length>=3){ app.lookupBarcode(v); } }">
            <button onclick="const v=document.getElementById('globalScanInput').value.trim(); document.getElementById('globalScanInput').value=''; app._scannerBuffer=''; if(v.length>=3) app.lookupBarcode(v);"
              style="background:#10b981; color:#fff; border:none; border-radius:6px; padding:8px 16px; font-size:13px; font-weight:700; cursor:pointer; white-space:nowrap;">
              🔍 Lookup
            </button>
          </div>

          ${this.renderTrackingList()}
        </div>
      </div>
    `
  }

  renderTrackingDailyIncome() {
    // Group tracking records by date
    const groups = {};
    this.trackingData.forEach(t => {
      const key = t.createdAt || 'Unknown';
      if (!groups[key]) groups[key] = [];
      groups[key].push(t);
    });

    // Sort dates newest first (DD/MM/YYYY format)
    const sortedKeys = Object.keys(groups).sort((a, b) => {
      const parseDate = s => {
        const p = s.split('/');
        return p.length === 3 ? new Date(`${p[2]}-${p[1]}-${p[0]}`) : new Date(0);
      };
      return parseDate(b) - parseDate(a);
    });

    return `
      <div style="min-height:100vh; background-color:#f13e74fb; padding-top:96px; padding-bottom:80px;">
        <div class="container">
          <button class="back-button" data-page="admin-tracking" style="margin-bottom:20px;">&#8592; Tracking</button>
          <div style="margin-bottom:28px;">
            <h1 style="font-size:32px; font-weight:700; margin-bottom:4px;">📅 Daily Tracking Income</h1>
            <p style="color:#94a3b8;">Repair income grouped by day — ${this.trackingData.length} total records</p>
          </div>

          ${sortedKeys.length === 0 ? `
            <div style="text-align:center; padding:60px; color:#fff; font-size:16px;">No tracking records found</div>
          ` : sortedKeys.map(dateKey => {
            const recs = groups[dateKey];
            // Daily sales: old records (no advanceAmount/paidAmount saved) use amount
            // New records: only advance + paid count, never full price or balance
            const totalReceived = recs.reduce((s, t) => {
              if (t.advanceAmount === undefined && t.paidAmount === undefined) {
                return s + (Number(t.amount) || 0);
              }
              return s + (Number(t.advanceAmount)||0) + (Number(t.paidAmount)||0);
            }, 0);
            const totalBalance = recs.reduce((s, t) => s + (Number(t.balanceAmount) || 0), 0);
            return `
              <div style="background:rgba(255,255,255,0.95); border-radius:12px; margin-bottom:20px; overflow:hidden; box-shadow:0 2px 8px rgba(0,0,0,0.1);">
                <div style="background:linear-gradient(135deg,#065f46,#047857); padding:14px 20px; display:flex; justify-content:space-between; align-items:center;">
                  <div style="color:#fff; font-weight:700; font-size:16px;">📅 ${dateKey}</div>
                  <div style="text-align:right;">
                    <div style="color:#6ee7b7; font-size:12px;">${recs.length} record${recs.length !== 1 ? 's' : ''}</div>
                    <div style="color:#fff; font-weight:800; font-size:20px;">₹${totalReceived.toLocaleString('en-IN')} received</div>
                    ${totalBalance > 0 ? `<div style="color:#fcd34d; font-size:12px; font-weight:700;">Balance pending: ₹${totalBalance.toLocaleString('en-IN')}</div>` : ''}
                  </div>
                </div>
                <table style="width:100%; border-collapse:collapse; font-size:13px;">
                  <thead>
                    <tr style="background:#f1f5f9;">
                      <th style="padding:10px 14px; text-align:left; color:#374151; font-weight:700;">Service Code</th>
                      <th style="padding:10px 14px; text-align:left; color:#374151; font-weight:700;">Customer</th>
                      <th style="padding:10px 14px; text-align:right; color:#374151; font-weight:700;">Advance Received</th>
                      <th style="padding:10px 14px; text-align:right; color:#374151; font-weight:700;">Paid Amount</th>
                      <th style="padding:10px 14px; text-align:right; color:#374151; font-weight:700;">Total Received</th>
                      <th style="padding:10px 14px; text-align:right; color:#374151; font-weight:700;">Balance Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${recs.map((t, i) => {
                      const isOldRecord = t.advanceAmount === undefined && t.paidAmount === undefined;
                      const adv  = Number(t.advanceAmount) || 0;
                      const paid = Number(t.paidAmount)    || 0;
                      const bal  = Number(t.balanceAmount) || 0;
                      const full = Number(t.amount)        || 0;
                      // Old record (pre-payment-system): show full amount in Total Received
                      // New record: show advance+paid only
                      const tot  = isOldRecord ? full : (adv + paid);
                      const displayBal = bal > 0 ? bal : 0;
                      return `
                      <tr style="border-top:1px solid #e5e7eb; background:${i % 2 === 0 ? '#fff' : '#f9fafb'};">
                        <td style="padding:10px 14px; color:#1d4ed8; font-weight:700;">${t.qrId}</td>
                        <td style="padding:10px 14px; color:#111827; font-size:12px;">
                          <div style="font-weight:600;">${t.customerName}</div>
                          <div style="color:#6b7280; font-size:11px;">${t.productName || t.deviceModel || ''}</div>
                        </td>
                        <td style="padding:10px 14px; text-align:right; color:#f59e0b; font-weight:700;">
                          ${isOldRecord ? '<span style="color:#94a3b8;font-size:11px;">—</span>' : (adv > 0 ? `₹${adv.toLocaleString('en-IN')}` : '<span style="color:#d1d5db;">—</span>')}
                        </td>
                        <td style="padding:10px 14px; text-align:right; color:#059669; font-weight:700;">
                          ${isOldRecord ? '<span style="color:#94a3b8;font-size:11px;">—</span>' : (paid > 0 ? `₹${paid.toLocaleString('en-IN')}` : '<span style="color:#d1d5db;">—</span>')}
                        </td>
                        <td style="padding:10px 14px; text-align:right; color:#1d4ed8; font-weight:800;">
                          ${tot > 0 ? `₹${tot.toLocaleString('en-IN')}` : '<span style="color:#d1d5db;">—</span>'}
                        </td>
                        <td style="padding:10px 14px; text-align:right; font-weight:700;">
                          ${isOldRecord ? '<span style="color:#94a3b8;font-size:11px;">—</span>' : (displayBal > 0
                            ? `<span style="color:#dc2626; font-weight:800;">₹${displayBal.toLocaleString('en-IN')}</span>`
                            : `<span style="color:#10b981;">✓ Cleared</span>`)}
                        </td>
                      </tr>
                    `}).join('')}
                    <tr style="border-top:2px solid #10b981; background:#f0fdf4; font-weight:800; font-size:13px;">
                      <td colspan="2" style="padding:10px 14px; color:#065f46;">📊 Total</td>
                      <td style="padding:10px 14px; text-align:right; color:#f59e0b;">
                        ₹${recs.reduce((s,t)=>s+(Number(t.advanceAmount)||0),0).toLocaleString('en-IN')}
                      </td>
                      <td style="padding:10px 14px; text-align:right; color:#059669;">
                        ₹${recs.reduce((s,t)=>s+(Number(t.paidAmount)||0),0).toLocaleString('en-IN')}
                      </td>                      <td style="padding:10px 14px; text-align:right; color:#1d4ed8; font-size:15px;">
                        ₹${totalReceived.toLocaleString('en-IN')}
                      </td>
                      <td style="padding:10px 14px; text-align:right; color:#dc2626;">
                        ${totalBalance > 0 ? `₹${totalBalance.toLocaleString('en-IN')}` : '✓'}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  renderTrackingMonthlyIncome() {
    // Group tracking records by month (YYYY-MM)
    const groups = {};
    this.trackingData.forEach(t => {
      if (!t.createdAt) return;
      const parts = t.createdAt.split('/');
      const key = parts.length === 3 ? `${parts[2]}-${parts[1]}` : 'Unknown';
      if (!groups[key]) groups[key] = [];
      groups[key].push(t);
    });

    const sortedKeys = Object.keys(groups).sort((a, b) => b.localeCompare(a));

    const monthLabel = key => {
      if (key === 'Unknown') return 'Unknown Date';
      const [y, m] = key.split('-');
      return new Date(y, m - 1, 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' });
    };

    return `
      <div style="min-height:100vh; background-color:#f13e74fb; padding-top:96px; padding-bottom:80px;">
        <div class="container">
          <button class="back-button" data-page="admin-tracking" style="margin-bottom:20px;">&#8592; Tracking</button>
          <div style="margin-bottom:28px;">
            <h1 style="font-size:32px; font-weight:700; margin-bottom:4px;">📆 Monthly Tracking Income</h1>
            <p style="color:#94a3b8;">Repair income grouped by month — ${this.trackingData.length} total records</p>
          </div>

          ${sortedKeys.length === 0 ? `
            <div style="text-align:center; padding:60px; color:#fff; font-size:16px;">No tracking records found</div>
          ` : sortedKeys.map(monthKey => {
            const recs = groups[monthKey];
            const total = recs.reduce((s, t) => s + (Number(t.amount) || 0), 0);
            return `
              <div style="background:rgba(255,255,255,0.95); border-radius:12px; margin-bottom:20px; overflow:hidden; box-shadow:0 2px 8px rgba(0,0,0,0.1);">
                <div style="background:linear-gradient(135deg,#1e3a8a,#1d4ed8); padding:14px 20px; display:flex; justify-content:space-between; align-items:center;">
                  <div style="color:#fff; font-weight:700; font-size:16px;">📆 ${monthLabel(monthKey)}</div>
                  <div style="text-align:right;">
                    <div style="color:#93c5fd; font-size:12px;">${recs.length} record${recs.length !== 1 ? 's' : ''}</div>
                    <div style="color:#fff; font-weight:800; font-size:20px;">₹${total.toLocaleString('en-IN')}</div>
                  </div>
                </div>
                <table style="width:100%; border-collapse:collapse; font-size:13px;">
                  <thead>
                    <tr style="background:#f1f5f9;">
                      <th style="padding:10px 14px; text-align:left; color:#374151; font-weight:600;">Date</th>
                      <th style="padding:10px 14px; text-align:left; color:#374151; font-weight:600;">QR ID</th>
                      <th style="padding:10px 14px; text-align:left; color:#374151; font-weight:600;">Customer</th>
                      <th style="padding:10px 14px; text-align:left; color:#374151; font-weight:600;">Device</th>
                      <th style="padding:10px 14px; text-align:left; color:#374151; font-weight:600;">Status</th>
                      <th style="padding:10px 14px; text-align:right; color:#374151; font-weight:600;">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${recs.map((t, i) => `
                      <tr style="border-top:1px solid #e5e7eb; background:${i % 2 === 0 ? '#fff' : '#f9fafb'};">
                        <td style="padding:10px 14px; color:#374151; font-size:12px;">${t.createdAt}</td>
                        <td style="padding:10px 14px; color:#1d4ed8; font-weight:600;">${t.qrId}</td>
                        <td style="padding:10px 14px; color:#111827;">${t.customerName}</td>
                        <td style="padding:10px 14px; color:#374151;">${t.productName || t.deviceModel || '-'}</td>
                        <td style="padding:10px 14px;"><span style="background:#dbeafe; color:#1e40af; padding:2px 8px; border-radius:4px; font-size:11px; font-weight:600;">${t.status}</span></td>
                        <td style="padding:10px 14px; text-align:right; color:#1d4ed8; font-weight:700;">₹${(Number(t.amount) || 0).toLocaleString('en-IN')}</td>
                      </tr>
                    `).join('')}
                    <tr style="border-top:2px solid #3b82f6; background:#eff6ff;">
                      <td colspan="5" style="padding:10px 14px; font-weight:700; color:#1e3a8a;">Monthly Total</td>
                      <td style="padding:10px 14px; text-align:right; font-weight:800; color:#1e3a8a; font-size:15px;">₹${total.toLocaleString('en-IN')}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  renderTrackingForm() {
    return `
      <div id="trackingForm" style="display: none; background-color: rgba(30, 41, 59, 0.5); border: 1px solid #334155; border-radius: 12px; padding: 24px; margin-bottom: 32px;">
        <h3 style="margin-bottom: 24px;">Add New Tracking Record</h3>

        <!-- Barcode scan lookup -->
        <div style="background:rgba(16,185,129,0.1); border:1px solid #10b981; border-radius:8px; padding:12px 16px; margin-bottom:20px; display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
          <span style="font-size:13px; font-weight:700; color:#10b981; white-space:nowrap;">📷 Scan Barcode:</span>
          <input type="text" id="barcodeScanInput" placeholder="Scan or type barcode to lookup tracking..."
            style="flex:1; min-width:200px; padding:8px 12px; border:1px solid #334155; border-radius:6px; background:rgba(30,41,59,0.8); color:#fff; font-size:13px;"
            oninput="app.handleBarcodeScan(this.value)"
            onkeydown="if(event.key==='Enter'){app.lookupBarcode(this.value);}">
          <button onclick="app.lookupBarcode(document.getElementById('barcodeScanInput').value)"
            style="background:#10b981; color:#fff; border:none; border-radius:6px; padding:8px 16px; font-size:13px; font-weight:700; cursor:pointer; white-space:nowrap;">
            🔍 Lookup
          </button>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
          <div class="form-field">
            <label class="form-label">QR ID * <span style="font-size:11px; color:#10b981;">(auto-generated)</span></label>
            <input type="text" class="input" id="newTrackingQRId"
              oninput="app._renderFormBarcode(this.value)"
              placeholder="Auto-generated from 01518">
            <!-- Barcode display -->
            <div style="margin-top:10px; background:#fff; padding:8px; border-radius:6px; text-align:center; display:inline-block;">
              <canvas id="formBarcodeCanvas" style="display:none; max-width:100%;"></canvas>
            </div>
            <!-- Print Label button -->
            <div style="margin-top:8px; display:flex; gap:8px;">
              <button type="button" onclick="app.printTrackingLabel(document.getElementById('newTrackingQRId').value, document.getElementById('newTrackingCustomer')?.value, document.getElementById('newTrackingDevice')?.value)"
                style="background:#1e293b; color:#fff; border:none; border-radius:6px; padding:7px 16px; font-size:12px; font-weight:700; cursor:pointer;">
                🏷️ Print Label (Browser)
              </button>
              <button type="button" onclick="app.printTSCLabel(document.getElementById('newTrackingQRId').value, document.getElementById('newTrackingCustomer')?.value, document.getElementById('newTrackingDevice')?.value)"
                style="background:#ea580c; color:#fff; border:none; border-radius:6px; padding:7px 16px; font-size:12px; font-weight:700; cursor:pointer;">
                🖶 TSC Printer (.prn)
              </button>
            </div>
          </div>
          <div class="form-field">
            <label class="form-label">Password *</label>
            <input type="text" class="input" placeholder="Enter password" id="newTrackingPassword">
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
          <div class="form-field">
            <label class="form-label">Customer Name *</label>
            <input type="text" class="input" placeholder="Enter customer name" id="newTrackingCustomer">
          </div>
          <div class="form-field">
            <label class="form-label">Device Model *</label>
            <input type="text" class="input" placeholder="Enter device model" id="newTrackingDevice">
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
          <div class="form-field">
            <label class="form-label">Contact Number</label>
            <input type="tel" class="input" placeholder="Enter contact number" id="newTrackingContact">
          </div>
          <div class="form-field">
            <label class="form-label">Estimated Completion</label>
            <select class="input" id="newTrackingDays" style="background-color:rgba(51,65,85,0.5); color:#f8fafc;">
              <option value="0">📅 Same Day</option>
              <option value="1">1 Day</option>
              <option value="2">2 Days</option>
              <option value="3">3 Days</option>
              <option value="4">4 Days</option>
              <option value="5">5 Days</option>
              <option value="7">1 Week</option>
              <option value="10">10 Days</option>
              <option value="14">2 Weeks</option>
              <option value="30">1 Month</option>
            </select>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
          <div class="form-field">
            <label class="form-label">📥 Date In <span style="font-size:11px; color:#10b981;">(item received)</span></label>
            <input type="date" class="input" id="newTrackingDateIn"
              style="background-color:rgba(51,65,85,0.5); color:#f8fafc;">
          </div>
          <div class="form-field">
            <label class="form-label">📤 Date Out <span style="font-size:11px; color:#94a3b8;">(item returned)</span></label>
            <input type="date" class="input" id="newTrackingDateOut"
              style="background-color:rgba(51,65,85,0.5); color:#f8fafc;">
          </div>
        </div>

        <div class="form-field" style="margin-bottom: 16px;">
          <label class="form-label">Address</label>
          <input type="text" class="input" placeholder="Enter customer address" id="newTrackingAddress">
        </div>

        <!-- Amount Section -->
        <div style="background:rgba(16,185,129,0.08); border:1px solid rgba(16,185,129,0.3); border-radius:10px; padding:16px; margin-bottom:16px;">
          <div style="font-size:13px; font-weight:700; color:#10b981; margin-bottom:12px;">💰 Payment Details</div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom:12px;">
            <div class="form-field">
              <label class="form-label">Full Price (₹) *</label>
              <input type="number" class="input" placeholder="0" id="newTrackingAmount" min="0" step="1"
                oninput="
                  var full = Number(this.value)||0;
                  var adv  = Number(document.getElementById('newTrackingAdvance').value)||0;
                  var paid = Number(document.getElementById('newTrackingPaid').value)||0;
                  var tot  = adv + paid;
                  document.getElementById('newTrackingTotalReceived').value = tot;
                  document.getElementById('newTrackingBalance').value = Math.max(0, full - tot);
                ">
              <small style="color:#94a3b8;font-size:10px;">Owner reference only — not shown in sales</small>
            </div>
            <div class="form-field">
              <label class="form-label">Advance Received (₹)</label>
              <input type="number" class="input" placeholder="0" id="newTrackingAdvance" min="0" step="1"
                oninput="
                  var full = Number(document.getElementById('newTrackingAmount').value)||0;
                  var adv  = Number(this.value)||0;
                  var paid = Number(document.getElementById('newTrackingPaid').value)||0;
                  var tot  = adv + paid;
                  document.getElementById('newTrackingTotalReceived').value = tot;
                  document.getElementById('newTrackingBalance').value = Math.max(0, full - tot);
                ">
              <small style="color:#10b981;font-size:10px;">Shows in Today's Sales</small>
            </div>
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px;">
            <div class="form-field">
              <label class="form-label">Paid Amount (₹)</label>
              <input type="number" class="input" placeholder="0" id="newTrackingPaid" min="0" step="1"
                oninput="
                  var full = Number(document.getElementById('newTrackingAmount').value)||0;
                  var adv  = Number(document.getElementById('newTrackingAdvance').value)||0;
                  var paid = Number(this.value)||0;
                  var tot  = adv + paid;
                  document.getElementById('newTrackingTotalReceived').value = tot;
                  document.getElementById('newTrackingBalance').value = Math.max(0, full - tot);
                ">
              <small style="color:#94a3b8;font-size:10px;">Additional payment received</small>
            </div>
            <div class="form-field">
              <label class="form-label">Total Received (₹)</label>
              <input type="number" class="input" placeholder="0" id="newTrackingTotalReceived" min="0" step="1" readonly
                style="background:rgba(16,185,129,0.1); color:#10b981; font-weight:700;">
              <small style="color:#94a3b8;font-size:10px;">Advance + Paid</small>
            </div>
            <div class="form-field">
              <label class="form-label">Balance Amount (₹)</label>
              <input type="number" class="input" placeholder="0" id="newTrackingBalance" min="0" step="1" readonly
                style="background:rgba(239,68,68,0.1); color:#f87171; font-weight:700;">
              <small style="color:#94a3b8;font-size:10px;">Full − Total Received</small>
            </div>
          </div>
        </div>

        <div class="form-field" style="margin-bottom: 16px;">
          <label class="form-label">Issue Description *</label>
          <textarea class="input" placeholder="Describe the issue..." id="newTrackingIssue" rows="3"></textarea>
        </div>

        <div class="form-field" style="margin-bottom: 24px;">
          <label class="form-label">Initial Status</label>
          <select class="input" id="newTrackingStatus" style="background-color: rgba(51, 65, 85, 0.5); color: #f8fafc;">
            <option value="Received">📥 Received</option>
            <option value="Diagnostics">🔍 Diagnostics</option>
            <option value="Return">↩️ Return</option>
            <option value="In Progress">🔧 In Progress</option>
            <option value="Parts Ordered">📦 Parts Ordered</option>
            <option value="Quality Check">✅ Quality Check</option>
            <option value="Ready for Pickup">📢 Ready for Pickup</option>
            <option value="Completed">🎉 Completed</option>
            <option value="Delivered">🚀 Delivered</option>
          </select>
        </div>

        <div style="display: flex; gap: 12px;">
          <button class="btn btn-primary" data-action="save-new-tracking" style="flex: 1;">Save Tracking</button>
          <button class="btn btn-secondary" data-action="toggle-tracking-form" style="flex: 1;">Cancel</button>
        </div>
      </div>
    `
  }

  renderTrackingList() {
    // Get filter and search values
    const filterStatus = this.trackingFilter || 'all';
    const searchTerm = (this.trackingSearch || '').toLowerCase();
    
    // Filter tracking data
    let filteredTracking = this.trackingData;
    
    // Apply status filter
    if (filterStatus !== 'all') {
      filteredTracking = filteredTracking.filter(t => t.status === filterStatus);
    }
    
    // Apply search filter
    if (searchTerm) {
      filteredTracking = filteredTracking.filter(t => 
        t.customerName?.toLowerCase().includes(searchTerm) ||
        t.qrId?.toLowerCase().includes(searchTerm) ||
        t.productName?.toLowerCase().includes(searchTerm) ||
        t.contact?.toLowerCase().includes(searchTerm)
      );
    }

    // Sort newest first — by numeric QR ID descending, fallback to createdAt
    filteredTracking = [...filteredTracking].sort((a, b) => {
      const numA = parseInt(a.qrId, 10);
      const numB = parseInt(b.qrId, 10);
      if (!isNaN(numA) && !isNaN(numB)) return numB - numA;
      // Fallback: sort by createdAt date string (DD/MM/YYYY)
      const parseDate = s => {
        if (!s) return 0;
        const p = s.split('/');
        return p.length === 3 ? new Date(`${p[2]}-${p[1]}-${p[0]}`).getTime() : 0;
      };
      return parseDate(b.createdAt) - parseDate(a.createdAt);
    });
    
    return `
      <div class="tracking-list">
        <!-- Search Bar -->
        <div style="margin-bottom: 20px;">
          <input 
            type="text" 
            id="trackingSearchInput"
            placeholder="🔍 Search by customer name, QR ID, device, or phone..."
            style="width: 100%; padding: 12px 16px; background: rgba(30, 41, 59, 0.5); border: 2px solid #334155; border-radius: 8px; color: white; font-size: 14px;"
            value="${this.trackingSearch || ''}"
          >
        </div>
        
        <!-- Filter Buttons -->
        <div style="display: flex; gap: 12px; margin-bottom: 24px; flex-wrap: wrap;">
          <button 
            class="filter-btn ${filterStatus === 'all' ? 'active' : ''}"
            data-filter="all"
            style="padding: 10px 20px; border-radius: 8px; border: 2px solid ${filterStatus === 'all' ? '#10b981' : '#334155'}; background: ${filterStatus === 'all' ? '#10b981' : 'rgba(30, 41, 59, 0.5)'}; color: white; cursor: pointer; font-weight: 600; transition: all 0.3s;"
          >
            📋 All (${this.trackingData.length})
          </button>
          <button 
            class="filter-btn ${filterStatus === 'Received' ? 'active' : ''}"
            data-filter="Received"
            style="padding: 10px 20px; border-radius: 8px; border: 2px solid ${filterStatus === 'Received' ? '#3b82f6' : '#334155'}; background: ${filterStatus === 'Received' ? '#3b82f6' : 'rgba(30, 41, 59, 0.5)'}; color: white; cursor: pointer; font-weight: 600; transition: all 0.3s;"
          >
            📥 Received (${this.trackingData.filter(t => t.status === 'Received').length})
          </button>
          <button 
            class="filter-btn ${filterStatus === 'Return' ? 'active' : ''}"
            data-filter="Return"
            style="padding: 10px 20px; border-radius: 8px; border: 2px solid ${filterStatus === 'Return' ? '#ef4444' : '#334155'}; background: ${filterStatus === 'Return' ? '#ef4444' : 'rgba(30, 41, 59, 0.5)'}; color: white; cursor: pointer; font-weight: 600; transition: all 0.3s;"
          >
            ↩️ Return (${this.trackingData.filter(t => t.status === 'Return').length})
          </button>
          <button 
            class="filter-btn ${filterStatus === 'Ready for Pickup' ? 'active' : ''}"
            data-filter="Ready for Pickup"
            style="padding: 10px 20px; border-radius: 8px; border: 2px solid ${filterStatus === 'Ready for Pickup' ? '#f59e0b' : '#334155'}; background: ${filterStatus === 'Ready for Pickup' ? '#f59e0b' : 'rgba(30, 41, 59, 0.5)'}; color: white; cursor: pointer; font-weight: 600; transition: all 0.3s;"
          >
            📢 Ready for Pickup (${this.trackingData.filter(t => t.status === 'Ready for Pickup').length})
          </button>
          <button 
            class="filter-btn ${filterStatus === 'Completed' ? 'active' : ''}"
            data-filter="Completed"
            style="padding: 10px 20px; border-radius: 8px; border: 2px solid ${filterStatus === 'Completed' ? '#10b981' : '#334155'}; background: ${filterStatus === 'Completed' ? '#10b981' : 'rgba(30, 41, 59, 0.5)'}; color: white; cursor: pointer; font-weight: 600; transition: all 0.3s;"
          >
            🎉 Completed (${this.trackingData.filter(t => t.status === 'Completed').length})
          </button>
          <button 
            class="filter-btn ${filterStatus === 'Delivered' ? 'active' : ''}"
            data-filter="Delivered"
            style="padding: 10px 20px; border-radius: 8px; border: 2px solid ${filterStatus === 'Delivered' ? '#2563eb' : '#334155'}; background: ${filterStatus === 'Delivered' ? '#2563eb' : 'rgba(30, 41, 59, 0.5)'}; color: white; cursor: pointer; font-weight: 600; transition: all 0.3s;"
          >
            � Delivered (${this.trackingData.filter(t => t.status === 'Delivered').length})
          </button>
        </div>
        
        <!-- Results Count -->
        <div style="margin-bottom: 24px; display: flex; gap: 16px; align-items: center;">
          <h3 style="color: #e2e8f0; margin: 0;">
            ${filterStatus === 'all' ? 'All' : filterStatus} Tracking Records 
            <span style="color: #10b981;">(${filteredTracking.length})</span>
          </h3>
          ${searchTerm ? `<span style="color: #f59e0b; font-size: 14px;">Searching: "${searchTerm}"</span>` : ''}
        </div>
        
        <!-- Tracking Cards Grid (matching product grid) -->
        <div class="admin-tracking-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px;">
          ${
            filteredTracking.length > 0
              ? filteredTracking.map(tracking => this.renderTrackingCard(tracking)).join('')
              : `<div style="grid-column: 1/-1; text-align: center; padding: 48px; color: #94a3b8; background: rgba(30, 41, 59, 0.3); border-radius: 12px; border: 2px dashed #334155;">
                  <div style="font-size: 48px; margin-bottom: 16px;">🔍</div>
                  <div style="font-size: 18px; font-weight: 600; margin-bottom: 8px;">No tracking records found</div>
                  <div style="font-size: 14px;">Try adjusting your search or filter</div>
                </div>`
          }
        </div>
      </div>
    `
  }

  renderTrackingCard(tracking) {
    const statusColors = {
      'Received':         '#3b82f6',
      'Diagnostics':      '#8b5cf6',
      'Return':           '#ef4444',
      'In Progress':      '#f59e0b',
      'Parts Ordered':    '#ec4899',
      'Quality Check':    '#06b6d4',
      'Ready for Pickup': '#f59e0b',
      'Completed':        '#10b981',
      'Delivered':        '#2563eb'
    };
    const statusColor = statusColors[tracking.status] || '#10b981';
    const bcId = `bc_card_${tracking.qrId.replace(/[^a-zA-Z0-9]/g, '_')}`;

    // Schedule barcode render after this HTML is injected into DOM
    setTimeout(() => {
      const el = document.getElementById(bcId);
      if (el && typeof JsBarcode !== 'undefined') {
        try {
          JsBarcode(el, tracking.qrId, {
            format: 'CODE128', width: 2, height: 80,
            displayValue: true, fontSize: 12, margin: 4,
            background: '#ffffff', lineColor: '#000000',
            font: 'monospace', fontOptions: 'bold'
          });
          el.style.display = 'block';
          el.style.width = '100%';
          el.style.height = '100px';
          el.setAttribute('height', '100');
        } catch(e) {}
      }
    }, 50);

    return `
      <div class="admin-tracking-card" style="background-color: rgba(30, 41, 59, 0.5); border: 1px solid #334155; border-radius: 8px; padding: 12px; max-width: 300px;">

        <!-- Barcode at top — scan this to lookup details -->
        <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:6px; padding:6px 4px; margin-bottom:10px; text-align:center; width:100%; cursor:pointer; overflow:hidden; height:120px; display:flex; flex-direction:column; align-items:center; justify-content:center;"
             onclick="app.showTrackingLookupResult(app.trackingData.find(t=>t.qrId==='${tracking.qrId}'))"
             title="Click or scan to view full details">
          <svg id="${bcId}" style="display:none; width:100%; height:100px;"></svg>
          <div style="font-size:9px; color:#94a3b8; margin-top:2px;">📷 Scan or click to view details</div>
        </div>

        <!-- Status Badge -->
        <div style="margin-bottom: 10px;">
          <span style="display: inline-block; font-size: 10px; padding: 4px 8px; border-radius: 4px; background: rgba(16, 185, 129, 0.2); color: ${statusColor}; border: 1px solid ${statusColor};">
            ${this.getStatusEmoji(tracking.status)} ${tracking.status}
          </span>
        </div>
        
        <!-- QR ID -->
        <h3 style="margin-bottom: 6px; font-size: 14px; font-weight: 600; color: #f8fafc;">QR: ${tracking.qrId}</h3>
        
        <!-- Customer & Device -->
        <div style="color: #94a3b8; font-size: 11px; margin-bottom: 8px;">
          ${tracking.customerName} • ${tracking.productName}
        </div>
        
        <!-- Contact -->
        ${tracking.contact ? `<div style="color:#94a3b8; font-size:10px; margin-bottom:6px;">📞 ${tracking.contact}</div>` : ''}

        <!-- Dates -->
        <div style="color: #94a3b8; font-size: 10px; margin-bottom: 8px;">
          📅 ${tracking.createdAt}
          ${tracking.completedAt ? `<br>✅ Completed: ${tracking.completedAt}` : ''}
          ${tracking.deliveredAt ? `<br>🚀 Delivered: ${tracking.deliveredAt}` : ''}
          ${tracking.returnedAt  ? `<br>↩️ Returned: ${tracking.returnedAt}`  : ''}
        </div>
        
        ${tracking.status === 'Return' ? `
        <div style="background:#fef2f2; border:1px solid #fca5a5; border-radius:6px; padding:6px 10px; margin-bottom:8px; font-size:11px; font-weight:700; color:#dc2626; text-align:center;">
          ↩️ DEVICE RETURNED TO CUSTOMER
        </div>` : ''}
        
        <!-- Amount -->
        ${tracking.amount ? `
        <div style="margin-bottom: 8px; display:flex; flex-wrap:wrap; gap:6px; align-items:center;">
          <span style="font-weight: 700; color: #10b981; font-size: 14px;">₹${Number(tracking.amount).toLocaleString()}</span>
          <span style="color: #94a3b8; font-size: 10px;">Full Price</span>
          ${Number(tracking.advanceAmount) > 0 ? `
            <span style="color:#f59e0b; font-size:11px; font-weight:700;">Adv: ₹${Number(tracking.advanceAmount).toLocaleString()}</span>
            <span style="color:#f87171; font-size:11px; font-weight:700;">Bal: ₹${Number(tracking.balanceAmount || (tracking.amount - tracking.advanceAmount)).toLocaleString()}</span>
          ` : ''}
        </div>
        ` : ''}
        ${tracking.address ? `<div style="color:#94a3b8; font-size:10px; margin-bottom:6px;">📍 ${tracking.address}</div>` : ''}
        ${(tracking.dateIn || tracking.dateOut) ? `
        <div style="display:flex; gap:12px; margin-bottom:6px; font-size:10px;">
          ${tracking.dateIn  ? `<span style="color:#10b981;">📥 In: <strong>${tracking.dateIn}</strong></span>`  : ''}
          ${tracking.dateOut ? `<span style="color:#f59e0b;">📤 Out: <strong>${tracking.dateOut}</strong></span>` : ''}
        </div>` : ''}
        
        <!-- Issue Description -->
        <div style="margin-bottom: 10px; padding: 8px; background: rgba(51, 65, 85, 0.3); border-radius: 4px;">
          <div style="color: #cbd5e1; font-size: 10px; line-height: 1.4; max-height: 40px; overflow: hidden; text-overflow: ellipsis;">
            ${tracking.issue}
          </div>
        </div>
        
        <!-- Action Buttons -->
        <div style="display: flex; gap: 6px; flex-wrap: wrap;">
          <button onclick="app.showEditTrackingModal('${tracking.qrId}')" style="flex: 1; padding: 4px 8px; font-size: 11px; background:#f59e0b; color:#fff; border:none; border-radius:4px; cursor:pointer; font-weight:600;">✏️ Edit</button>
          <button class="btn btn-secondary" style="flex: 1; padding: 4px 8px; font-size: 11px;" data-action="edit-tracking" data-qr-id="${tracking.qrId}">🔄 Status</button>
          <button class="btn" style="flex: 1; padding: 4px 8px; font-size: 11px; background: rgba(244, 63, 94, 0.1); color: #f87171; border: 1px solid #f87171; border-radius: 4px;" data-action="delete-tracking" data-qr-id="${tracking.qrId}">Delete</button>
          <button onclick="app.printTrackingCard('${tracking.qrId}')" style="flex: 1; padding: 4px 8px; font-size: 11px; background: rgba(16,185,129,0.15); color: #10b981; border: 1px solid #10b981; border-radius: 4px; cursor: pointer; font-weight: 600;">🖨️ Print</button>
          <button onclick="app.printTrackingLabel('${tracking.qrId}','${(tracking.customerName||'').replace(/'/g,"\\'")}','${((tracking.productName||tracking.deviceModel||'')).replace(/'/g,"\\'")}');" style="flex: 1; padding: 4px 8px; font-size: 11px; background: rgba(30,41,59,0.8); color: #e2e8f0; border: 1px solid #475569; border-radius: 4px; cursor: pointer; font-weight: 600;">🏷️ Label</button>
          <button onclick="app.printTSCLabel('${tracking.qrId}','${(tracking.customerName||'').replace(/'/g,"\\'")}','${((tracking.productName||tracking.deviceModel||'')).replace(/'/g,"\\'")}');" style="flex: 1; padding: 4px 8px; font-size: 11px; background: rgba(234,88,12,0.15); color: #fb923c; border: 1px solid #fb923c; border-radius: 4px; cursor: pointer; font-weight: 600;">🖶 TSC</button>
        </div>
      </div>
    `
  }

  renderAdminOrders() {
    return `
      <div style="min-height: 100vh; background-color: #f13e74fb; padding-top: 96px; padding-bottom: 80px;">
        <div class="container">
          <button class="back-button" data-page="admin" style="margin-bottom: 20px;">&#8592; Dashboard</button>
          <div style="margin-bottom: 32px;">
            <h1 style="font-size: 36px; font-weight: 700; margin-bottom: 8px;">Orders Management</h1>
            <p style="color: #94a3b8;">View and manage customer orders</p>
          </div>

          <div style="margin-bottom: 24px;">
            <span style="color: #94a3b8; font-size: 14px;">Total Orders: ${this.orders.length}</span>
          </div>

          <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(420px, 1fr)); gap:10px;">
            ${
              this.orders.length > 0
                ? this.orders.map(order => this.renderOrderCard(order)).join('')
                : '<div style="grid-column:1/-1; text-align: center; padding: 48px; color: #94a3b8;">No orders found</div>'
            }
          </div>
        </div>
      </div>
    `
  }

  renderOrderCard(order) {
    // Fix order date formatting
    let formattedDate = 'Date not available';
    if (order.orderDate) {
      try {
        const date = new Date(order.orderDate);
        formattedDate = date.toLocaleString('en-IN', { 
          year: 'numeric', 
          month: 'short', 
          day: 'numeric', 
          hour: '2-digit', 
          minute: '2-digit',
          hour12: true,
          timeZone: 'Asia/Kolkata'
        });
      } catch (e) {
        console.error('Date formatting error:', e);
        formattedDate = order.orderDate.toString();
      }
    } else if (order.createdAt) {
      try {
        const date = new Date(order.createdAt);
        formattedDate = date.toLocaleString('en-IN', { 
          year: 'numeric', 
          month: 'short', 
          day: 'numeric', 
          hour: '2-digit', 
          minute: '2-digit',
          hour12: true,
          timeZone: 'Asia/Kolkata'
        });
      } catch (e) {
        console.error('Date formatting error:', e);
        formattedDate = order.createdAt.toString();
      }
    }

    return `
      <div class="order-card" style="background-color: rgba(30, 41, 59, 0.6); border: 1px solid #334155; border-radius: 6px; padding: 10px 12px; margin-bottom: 8px;">
        <!-- Header row -->
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
          <div>
            <span style="font-size:12px; font-weight:700; color:#f8fafc;">Order #${order.id || order.orderId}</span>
            <span style="font-size:10px; color:#94a3b8; margin-left:8px;">📅 ${formattedDate}</span>
          </div>
          <span style="font-size:9px; padding:2px 7px; border-radius:4px; background:rgba(16,185,129,0.2); color:#10b981; font-weight:600; white-space:nowrap;">${order.status}</span>
        </div>

        <!-- Customer + Items + Payment in one compact row -->
        <div style="display:grid; grid-template-columns:1fr 1fr auto; gap:8px; align-items:start; margin-bottom:8px;">
          <!-- Customer -->
          <div style="font-size:10px; color:#cbd5e1; line-height:1.5;">
            <div style="font-weight:600; color:#e2e8f0; margin-bottom:2px; font-size:11px;">👤 ${order.customer.name}</div>
            <div>${order.customer.phone}</div>
            <div style="color:#94a3b8;">${order.customer.email}</div>
            <div style="color:#94a3b8; font-size:9px;">${order.customer.address}</div>
          </div>

          <!-- Items -->
          <div style="background:rgba(51,65,85,0.4); border-radius:4px; padding:6px; font-size:10px;">
            ${order.items.map(item => `
              <div style="display:flex; justify-content:space-between; margin-bottom:2px;">
                <span style="color:#e2e8f0;">${item.name} ×${item.quantity}</span>
                <span style="color:#10b981; font-weight:600;">₹${(item.price * item.quantity).toLocaleString()}</span>
              </div>
            `).join('')}
            <div style="border-top:1px solid #334155; margin-top:4px; padding-top:4px; display:flex; justify-content:space-between; font-weight:700;">
              <span style="color:#e2e8f0;">Total</span>
              <span style="color:#10b981;">₹${order.total.toLocaleString()}</span>
            </div>
          </div>

          <!-- Screenshot thumbnail -->
          <div style="text-align:center;">
            ${order.paymentScreenshot && order.paymentScreenshot.data ? `
              <img src="${order.paymentScreenshot.data}" alt="Screenshot"
                style="width:60px; height:45px; object-fit:cover; border-radius:4px; border:1px solid #334155; cursor:pointer; display:block;"
                onclick="app.showScreenshotFromOrder('${order.orderId || order.id}')"
                onerror="this.style.display='none'">
              <div style="font-size:8px; color:#64748b; margin-top:2px;">📎 UPI</div>
            ` : `<div style="font-size:9px; color:#94a3b8; padding:4px;">${order.paymentMethod || 'COD'}</div>`}
          </div>
        </div>

        <!-- Action buttons -->
        <div style="display:flex; gap:6px;">
          <button class="btn btn-primary" style="flex:1; padding:5px 8px; font-size:10px; display:flex; align-items:center; justify-content:center; gap:3px;" onclick="app.printOrder('${order.id || order.orderId}')">
            🖨️ Print
          </button>
          <button class="btn" style="flex:1; padding:5px 8px; font-size:10px; background:rgba(244,63,94,0.1); color:#f87171; border:1px solid #f87171; border-radius:4px;" onclick="app.deleteOrder('${order.id || order.orderId}')">🗑️ Delete</button>
        </div>
      </div>
    `
  }

  showScreenshotFromOrder(orderId) {
    // Find the order by ID
    const order = this.orders.find(o => (o.orderId === orderId || o.id === orderId));
    
    if (!order || !order.paymentScreenshot || !order.paymentScreenshot.data) {
      alert('Screenshot not found for this order.');
      return;
    }
    
    // Use base64 data directly (same as product images)
    const imageSrc = order.paymentScreenshot.data || order.paymentScreenshot.imageUrl;
    
    // Show the screenshot modal
    this.showScreenshotModal(imageSrc, order.paymentScreenshot.fileName);
  }

  showScreenshotModal(imageSrc, fileName) {
    const modal = document.createElement('div');
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.8);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      padding: 20px;
      box-sizing: border-box;
    `;
    
    modal.innerHTML = `
      <div style="background: white; border-radius: 12px; padding: 24px; max-width: 600px; width: 100%; text-align: center;">
        <h3 style="margin-bottom: 16px; color: #000;">Payment Screenshot</h3>
        <img src="${imageSrc}" alt="Payment Screenshot" style="max-width: 100%; max-height: 400px; border-radius: 8px; margin-bottom: 16px; border: 2px solid #fecaca;">
        <p style="color: #666; font-size: 14px; margin-bottom: 20px;">File: ${fileName}</p>
        <button id="closeModal" style="background: #dc2626; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-weight: 600;">Close</button>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Handle close button
    document.getElementById('closeModal').onclick = () => {
      document.body.removeChild(modal);
    };
    
    // Close on background click
    modal.onclick = (e) => {
      if (e.target === modal) {
        document.body.removeChild(modal);
      }
    };
  }

  // Print Order functionality
  printOrder(orderId) {
    // Find the order by ID
    const order = this.orders.find(o => (o.orderId === orderId || o.id === orderId));
    
    if (!order) {
      alert('Order not found!');
      return;
    }

    // Format order date
    let formattedDate = 'Date not available';
    if (order.orderDate) {
      try {
        const date = new Date(order.orderDate);
        formattedDate = date.toLocaleString('en-IN', { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric', 
          hour: '2-digit', 
          minute: '2-digit',
          hour12: true,
          timeZone: 'Asia/Kolkata'
        });
      } catch (e) {
        formattedDate = order.orderDate.toString();
      }
    } else if (order.createdAt) {
      try {
        const date = new Date(order.createdAt);
        formattedDate = date.toLocaleString('en-IN', { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric', 
          hour: '2-digit', 
          minute: '2-digit',
          hour12: true,
          timeZone: 'Asia/Kolkata'
        });
      } catch (e) {
        formattedDate = order.createdAt.toString();
      }
    }

    // Create printable content
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Order #${order.orderId || order.id} - Manjula Mobile World</title>
        <style>
          body { 
            font-family: Arial, sans-serif; 
            margin: 20px; 
            color: #000; 
            background: white;
          }
          .header { 
            text-align: center; 
            border-bottom: 2px solid #dc2626; 
            padding-bottom: 20px; 
            margin-bottom: 30px; 
          }
          .logo { 
            font-size: 24px; 
            font-weight: bold; 
            color: #dc2626; 
            margin-bottom: 5px; 
          }
          .subtitle { 
            color: #666; 
            font-size: 14px; 
          }
          .order-info { 
            display: flex; 
            justify-content: space-between; 
            margin-bottom: 30px; 
          }
          .order-details, .customer-details { 
            width: 48%; 
          }
          .section-title { 
            font-weight: bold; 
            color: #dc2626; 
            margin-bottom: 10px; 
            border-bottom: 1px solid #eee; 
            padding-bottom: 5px; 
          }
          .items-table { 
            width: 100%; 
            border-collapse: collapse; 
            margin: 20px 0; 
          }
          .items-table th, .items-table td { 
            border: 1px solid #ddd; 
            padding: 12px; 
            text-align: left; 
          }
          .items-table th { 
            background-color: #f8f9fa; 
            font-weight: bold; 
          }
          .total-row { 
            font-weight: bold; 
            background-color: #f8f9fa; 
          }
          .payment-info { 
            background-color: #f0f9ff; 
            padding: 15px; 
            border-radius: 8px; 
            margin: 20px 0; 
            border-left: 4px solid #dc2626; 
          }
          .footer { 
            text-align: center; 
            margin-top: 40px; 
            padding-top: 20px; 
            border-top: 1px solid #eee; 
            color: #666; 
            font-size: 12px; 
          }
          @media print {
            body { margin: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo">📱 MANJULA MOBILE WORLD</div>
          <div class="subtitle">Mobile Repair & Parts • Ramapuram, Tamil Nadu</div>
          <div class="subtitle">📞 +91 82484 54841 • ✉️ manjulamobiles125@gmail.com</div>
        </div>

        <div class="order-info">
          <div class="order-details">
            <div class="section-title">Order Information</div>
            <p><strong>Order ID:</strong> #${order.orderId || order.id}</p>
            <p><strong>Date:</strong> ${formattedDate}</p>
            <p><strong>Status:</strong> ${order.status}</p>
            <p><strong>Payment Method:</strong> ${order.paymentMethod}</p>
          </div>
          
          <div class="customer-details">
            <div class="section-title">Customer Details</div>
            <p><strong>Name:</strong> ${order.customer.name}</p>
            <p><strong>Phone:</strong> ${order.customer.phone}</p>
            <p><strong>Email:</strong> ${order.customer.email}</p>
            <p><strong>Address:</strong> ${order.customer.address}</p>
          </div>
        </div>

        <div class="section-title">Order Items</div>
        <table class="items-table">
          <thead>
            <tr>
              <th>Item Name</th>
              <th>Quantity</th>
              <th>Unit Price</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            ${order.items.map(item => `
              <tr>
                <td>${item.name}</td>
                <td>${item.quantity}</td>
                <td>₹${item.price.toLocaleString()}</td>
                <td>₹${(item.price * item.quantity).toLocaleString()}</td>
              </tr>
            `).join('')}
            <tr class="total-row">
              <td colspan="3"><strong>Total Amount</strong></td>
              <td><strong>₹${order.total.toLocaleString()}</strong></td>
            </tr>
          </tbody>
        </table>

        <div class="payment-info">
          <div class="section-title">Payment Information</div>
          <p><strong>Payment Method:</strong> ${order.paymentMethod}</p>
          ${order.paymentScreenshot && order.paymentScreenshot.data ? 
            `<p><strong>Payment Screenshot:</strong> Attached (${order.paymentScreenshot.fileName})</p>` : 
            '<p><strong>Payment Screenshot:</strong> Not available</p>'
          }
        </div>

        <div class="footer">
          <p>Thank you for choosing Manjula Mobile World!</p>
          <p>For any queries, contact us at +91 82484 54841 or manjulamobiles125@gmail.com</p>
          <p>Printed on: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</p>
        </div>
      </body>
      </html>
    `;

    // Open print window
    const printWindow = window.open('', '_blank', 'width=800,height=900');
    printWindow.document.write(printContent);
    printWindow.document.close();
    
    // Wait for content to load then show printer dialog
    printWindow.onload = function() {
      printWindow.focus();
      printWindow.print();
      // Do NOT auto-close — let the user finish with the printer dialog
    };
  }

  renderAddProductForm() {
    return `
      <div style="min-height: 100vh; background-color: #f13e74fb; padding-top: 96px; padding-bottom: 80px;">
        <div class="container" style="max-width: 600px;">
          <button class="back-button" data-page="admin-products" style="margin-bottom:20px;">← Back to Products</button>
          <h1 style="font-size: 36px; font-weight: 700; margin-bottom: 32px; color: #fff;">Add New Product</h1>

          <div style="background-color: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 32px;">
            <div class="form-field">
              <label style="display:block; font-size:13px; font-weight:700; color:#1e293b; margin-bottom:6px;">Product Name *</label>
              <input type="text" class="input" placeholder="Enter product name" id="productName" style="background:#f8fafc; color:#111; border:1px solid #cbd5e1;">
            </div>

            <div class="form-field">
              <label style="display:block; font-size:13px; font-weight:700; color:#1e293b; margin-bottom:6px;">Category *</label>
              <select class="input" id="productCategory" style="background:#f8fafc; color:#111; border:1px solid #cbd5e1;" onchange="
                const custom = document.getElementById('customCategoryWrap');
                if(this.value === '__custom__') { custom.style.display='block'; document.getElementById('customCategoryInput').focus(); }
                else { custom.style.display='none'; }
              ">
                <option value="">Select category</option>
                <option value="Smartphones">Smartphones</option>
                <option value="Services">Services</option>
                <option value="Accessories">Accessories</option>
                <option value="Chargers">Chargers</option>
                <option value="Audio">Audio</option>
                <option value="Power">Power Banks</option>
                ${(this.customCategories || []).map(c => `<option value="${c}">${c}</option>`).join('')}
                <option value="__custom__">➕ Add Custom Category...</option>
              </select>
              <div id="customCategoryWrap" style="display:none; margin-top:8px;">
                <div style="display:flex; gap:8px;">
                  <input type="text" id="customCategoryInput" class="input" placeholder="Type new category name..." style="flex:1; background:#f8fafc; color:#111; border:1px solid #cbd5e1;">
                  <button type="button" onclick="
                    const val = document.getElementById('customCategoryInput').value.trim();
                    if(!val) return;
                    if(!app.customCategories) app.customCategories = [];
                    if(!app.customCategories.includes(val)) { app.customCategories.push(val); localStorage.setItem('manjula_custom_categories', JSON.stringify(app.customCategories)); }
                    const sel = document.getElementById('productCategory');
                    const existing = [...sel.options].find(o => o.value === val);
                    if(!existing) {
                      const opt = new Option(val, val);
                      sel.insertBefore(opt, sel.options[sel.options.length - 1]);
                    }
                    sel.value = val;
                    document.getElementById('customCategoryWrap').style.display='none';
                  " style="padding:8px 16px; background:#dc2626; color:#fff; border:none; border-radius:8px; cursor:pointer; font-weight:600; white-space:nowrap;">✓ Add</button>
                </div>
              </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
              <div class="form-field">
                <label style="display:block; font-size:13px; font-weight:700; color:#1e293b; margin-bottom:6px;">Customer Price (₹) *</label>
                <input type="number" class="input" placeholder="2999" id="productPrice" style="background:#f8fafc; color:#111; border:1px solid #cbd5e1;">
              </div>
              <div class="form-field">
                <label style="display:block; font-size:13px; font-weight:700; color:#1e293b; margin-bottom:6px;">Original / MRP Price (₹)</label>
                <input type="number" class="input" placeholder="3999" id="productOriginalPrice" style="background:#f8fafc; color:#111; border:1px solid #cbd5e1;">
              </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
              <div class="form-field">
                <label style="display:block; font-size:13px; font-weight:700; color:#1e293b; margin-bottom:6px;">Owner Price (₹) <span style="font-size:11px; color:#f59e0b;">🔒 Owner only</span></label>
                <input type="number" class="input" placeholder="2500" id="productOwnerPrice" style="background:#f8fafc; color:#111; border:1px solid #cbd5e1;">
              </div>
              <div class="form-field">
                <label style="display:block; font-size:13px; font-weight:700; color:#1e293b; margin-bottom:6px;">Stock Quantity</label>
                <input type="number" class="input" placeholder="0" id="productStock" min="0" style="background:#f8fafc; color:#111; border:1px solid #cbd5e1;">
              </div>
            </div>

            <div class="form-field">
              <label style="display:block; font-size:13px; font-weight:700; color:#1e293b; margin-bottom:6px;">Product Images</label>
              <div style="margin-bottom: 16px; padding: 16px; background: #f1f5f9; border-radius: 8px; border:1px solid #e2e8f0;">
                <p style="color: #475569; font-size: 12px; margin-bottom: 8px; font-weight: 600;">Image 1 (Main)</p>
                <input type="url" class="input" placeholder="https://example.com/image1.jpg" id="productImageUrl" style="margin-bottom: 8px; background:#fff; color:#111; border:1px solid #cbd5e1;">
                <input type="file" class="input" accept="image/*" id="productImageFile1" onchange="app.handleImageUpload(event, 1)" style="font-size: 12px; background:#fff; color:#111; border:1px solid #cbd5e1;">
              </div>
              <div style="margin-bottom: 16px; padding: 16px; background: #f1f5f9; border-radius: 8px; border:1px solid #e2e8f0;">
                <p style="color: #475569; font-size: 12px; margin-bottom: 8px; font-weight: 600;">Image 2 (Secondary)</p>
                <input type="url" class="input" placeholder="https://example.com/image2.jpg" id="productImageUrl2" style="margin-bottom: 8px; background:#fff; color:#111; border:1px solid #cbd5e1;">
                <input type="file" class="input" accept="image/*" id="productImageFile2" onchange="app.handleImageUpload(event, 2)" style="font-size: 12px; background:#fff; color:#111; border:1px solid #cbd5e1;">
              </div>
              <div style="margin-bottom: 12px;">
                <p style="color: #475569; font-size: 12px; margin-bottom: 8px; font-weight:600;">Emoji/Icon (if no images)</p>
                <input type="text" class="input" placeholder="📱 or 🔧 or 📦" id="productImage" maxlength="2" style="background:#f8fafc; color:#111; border:1px solid #cbd5e1;">
              </div>
            </div>

            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 24px;">
              <input type="checkbox" id="productInStock" checked style="width: 18px; height: 18px; cursor: pointer;">
              <label for="productInStock" style="cursor: pointer; color: #1e293b; font-weight:600; font-size:14px;">In Stock</label>
            </div>

            <button class="btn btn-primary" style="width: 100%; padding: 12px; font-size: 16px; margin-bottom: 12px;" data-action="save-product">Add Product</button>
            <button class="btn btn-secondary" style="width: 100%; padding: 12px; font-size: 16px;" data-page="admin-products">Cancel</button>
          </div>
        </div>
      </div>
    `
  }

  renderEditProductForm() {
    const editingIdStr = String(this.editingProductId);
    const product = this.products.find((p) => String(p.id) === editingIdStr || String(p._id) === editingIdStr)
    if (!product) return `<div>Product not found</div>`

    return `
      <div style="min-height: 100vh; background-color: #f13e74fb; padding-top: 96px; padding-bottom: 80px;">
        <div class="container" style="max-width: 600px;">
          <button class="back-button" data-page="admin-products" style="margin-bottom:20px;">← Back to Products</button>
          <h1 style="font-size: 36px; font-weight: 700; margin-bottom: 32px; color:#fff;">Edit Product</h1>

          <div style="background-color: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 32px;">
            <div class="form-field">
              <label style="display:block; font-size:13px; font-weight:700; color:#1e293b; margin-bottom:6px;">Product Name *</label>
              <input type="text" class="input" value="${product.name}" id="productName" style="background:#f8fafc; color:#111; border:1px solid #cbd5e1;">
            </div>

            <div class="form-field">
              <label style="display:block; font-size:13px; font-weight:700; color:#1e293b; margin-bottom:6px;">Category *</label>
              <select class="input" id="productCategory" style="background:#f8fafc; color:#111; border:1px solid #cbd5e1;" onchange="
                const custom = document.getElementById('customCategoryWrapEdit');
                if(this.value === '__custom__') { custom.style.display='block'; document.getElementById('customCategoryInputEdit').focus(); }
                else { custom.style.display='none'; }
              ">
                <option value="Smartphones" ${product.category === "Smartphones" ? "selected" : ""}>Smartphones</option>
                <option value="Services" ${product.category === "Services" ? "selected" : ""}>Services</option>
                <option value="Accessories" ${product.category === "Accessories" ? "selected" : ""}>Accessories</option>
                <option value="Chargers" ${product.category === "Chargers" ? "selected" : ""}>Chargers</option>
                <option value="Audio" ${product.category === "Audio" ? "selected" : ""}>Audio</option>
                <option value="Power" ${product.category === "Power" ? "selected" : ""}>Power Banks</option>
                ${(this.customCategories || []).filter(c => !['Smartphones','Services','Accessories','Chargers','Audio','Power'].includes(c)).map(c => `<option value="${c}" ${product.category === c ? 'selected' : ''}>${c}</option>`).join('')}
                ${!['Smartphones','Services','Accessories','Chargers','Audio','Power'].includes(product.category) && !(this.customCategories||[]).includes(product.category) && product.category ? `<option value="${product.category}" selected>${product.category}</option>` : ''}
                <option value="__custom__">➕ Add Custom Category...</option>
              </select>
              <div id="customCategoryWrapEdit" style="display:none; margin-top:8px;">
                <div style="display:flex; gap:8px;">
                  <input type="text" id="customCategoryInputEdit" class="input" placeholder="Type new category name..." style="flex:1; background:#f8fafc; color:#111; border:1px solid #cbd5e1;">
                  <button type="button" onclick="
                    const val = document.getElementById('customCategoryInputEdit').value.trim();
                    if(!val) return;
                    if(!app.customCategories) app.customCategories = [];
                    if(!app.customCategories.includes(val)) { app.customCategories.push(val); localStorage.setItem('manjula_custom_categories', JSON.stringify(app.customCategories)); }
                    const sel = document.getElementById('productCategory');
                    const existing = [...sel.options].find(o => o.value === val);
                    if(!existing) {
                      const opt = new Option(val, val);
                      sel.insertBefore(opt, sel.options[sel.options.length - 1]);
                    }
                    sel.value = val;
                    document.getElementById('customCategoryWrapEdit').style.display='none';
                  " style="padding:8px 16px; background:#dc2626; color:#fff; border:none; border-radius:8px; cursor:pointer; font-weight:600; white-space:nowrap;">✓ Add</button>
                </div>
              </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
              <div class="form-field">
                <label style="display:block; font-size:13px; font-weight:700; color:#1e293b; margin-bottom:6px;">Customer Price (₹) *</label>
                <input type="number" class="input" value="${product.price}" id="productPrice" style="background:#f8fafc; color:#111; border:1px solid #cbd5e1;">
              </div>
              <div class="form-field">
                <label style="display:block; font-size:13px; font-weight:700; color:#1e293b; margin-bottom:6px;">Original / MRP Price (₹)</label>
                <input type="number" class="input" value="${product.originalPrice}" id="productOriginalPrice" style="background:#f8fafc; color:#111; border:1px solid #cbd5e1;">
              </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
              <div class="form-field">
                <label style="display:block; font-size:13px; font-weight:700; color:#1e293b; margin-bottom:6px;">Owner Price (₹) <span style="font-size:11px; color:#f59e0b;">🔒 Owner only</span></label>
                <input type="number" class="input" value="${product.ownerPrice || ''}" placeholder="2500" id="productOwnerPrice" style="background:#f8fafc; color:#111; border:1px solid #cbd5e1;">
              </div>
              <div class="form-field">
                <label style="display:block; font-size:13px; font-weight:700; color:#1e293b; margin-bottom:6px;">Stock Quantity</label>
                <input type="number" class="input" value="${product.stock !== undefined ? product.stock : ''}" placeholder="0" id="productStock" min="0" style="background:#f8fafc; color:#111; border:1px solid #cbd5e1;">
              </div>
            </div>

            <div class="form-field">
              <label style="display:block; font-size:13px; font-weight:700; color:#1e293b; margin-bottom:6px;">Product Images</label>
              <div style="margin-bottom: 16px; padding: 16px; background: #f1f5f9; border-radius: 8px; border:1px solid #e2e8f0;">
                <p style="color: #475569; font-size: 12px; margin-bottom: 8px; font-weight: 600;">Image 1 (Main)</p>
                <input type="url" class="input" placeholder="https://example.com/image1.jpg" id="productImageUrl" value="${product.imageUrl || ""}" style="margin-bottom: 8px; background:#fff; color:#111; border:1px solid #cbd5e1;">
                <input type="file" class="input" accept="image/*" id="productImageFile1" onchange="app.handleImageUpload(event, 1)" style="font-size: 12px; background:#fff; color:#111; border:1px solid #cbd5e1;">
              </div>
              <div style="margin-bottom: 16px; padding: 16px; background: #f1f5f9; border-radius: 8px; border:1px solid #e2e8f0;">
                <p style="color: #475569; font-size: 12px; margin-bottom: 8px; font-weight: 600;">Image 2 (Secondary)</p>
                <input type="url" class="input" placeholder="https://example.com/image2.jpg" id="productImageUrl2" value="${product.imageUrl2 || ""}" style="margin-bottom: 8px; background:#fff; color:#111; border:1px solid #cbd5e1;">
                <input type="file" class="input" accept="image/*" id="productImageFile2" onchange="app.handleImageUpload(event, 2)" style="font-size: 12px; background:#fff; color:#111; border:1px solid #cbd5e1;">
              </div>
              <div style="margin-bottom: 12px;">
                <p style="color: #475569; font-size: 12px; margin-bottom: 8px; font-weight:600;">Emoji/Icon (if no images)</p>
                <input type="text" class="input" value="${product.image}" id="productImage" maxlength="2" style="background:#f8fafc; color:#111; border:1px solid #cbd5e1;">
              </div>
            </div>

            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 24px;">
              <input type="checkbox" id="productInStock" ${product.inStock ? "checked" : ""} style="width: 18px; height: 18px; cursor: pointer;">
              <label for="productInStock" style="cursor: pointer; color: #1e293b; font-weight:600; font-size:14px;">In Stock</label>
            </div>

            <button class="btn btn-primary" style="width: 100%; padding: 12px; font-size: 16px; margin-bottom: 12px;" data-action="save-product">Update Product</button>
            <button class="btn btn-secondary" style="width: 100%; padding: 12px; font-size: 16px;" data-page="admin-products">Cancel</button>
          </div>
        </div>
      </div>
    `
  }

  renderAdminSales() {
    const search = (this.salesSearch || '').toLowerCase();
    const filtered = this.salesRecords.filter(s =>
      s.customerName?.toLowerCase().includes(search) ||
      s.phoneNumber?.includes(search) ||
      s.productName?.toLowerCase().includes(search) ||
      s.customerAddress?.toLowerCase().includes(search)
    );

    return `
      <div style="min-height: 100vh; background-color: #f13e74fb; padding-top: 96px; padding-bottom: 80px;">
        <div class="container">
          <button class="back-button" data-page="admin" style="margin-bottom: 20px;">&#8592; Dashboard</button>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; flex-wrap: wrap; gap: 12px;">
            <div>
              <h1 style="font-size: 32px; font-weight: 700; margin-bottom: 4px;">🛍️ Sales Records</h1>
              <p style="color: #94a3b8;">Store and lookup customer purchase details</p>
            </div>
            <div style="display:flex; gap:10px; flex-wrap:wrap;">
              <button class="btn btn-primary" onclick="app.toggleSalesForm()" style="padding: 12px 24px;">+ Add Sale</button>
              <button onclick="app.renderPage('admin-sales-monthly')" style="padding: 12px 24px; background:#1d4ed8; color:#fff; border:none; border-radius:8px; font-size:14px; font-weight:700; cursor:pointer;">📅 Monthly Sales</button>
              <button onclick="app.exportSalesPDF()" style="padding: 12px 24px; background:#1e293b; color:#fff; border:none; border-radius:8px; font-size:14px; font-weight:700; cursor:pointer;">📄 PDF</button>
              <button onclick="app.exportSalesXL()" style="padding: 12px 24px; background:#16a34a; color:#fff; border:none; border-radius:8px; font-size:14px; font-weight:700; cursor:pointer;">📊 XL Sheet</button>
            </div>
          </div>

          <!-- Add Sale Form -->
          <div id="salesForm" style="display:none; background: rgba(255,255,255,0.95); border: 2px solid #dc2626; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
            <h3 style="font-size: 18px; font-weight: 700; margin-bottom: 16px; color: #000;">New Sale Record</h3>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px;">
              <div>
                <label style="font-size: 13px; font-weight: 600; color: #374151; display: block; margin-bottom: 4px;">Customer Name *</label>
                <input class="input" id="sale_customerName" placeholder="Enter customer name" style="width:100%;">
              </div>
              <div>
                <label style="font-size: 13px; font-weight: 600; color: #374151; display: block; margin-bottom: 4px;">Phone Number *</label>
                <input class="input" id="sale_phoneNumber" placeholder="Enter phone number" style="width:100%;">
              </div>
              <div style="grid-column: 1/-1;">
                <label style="font-size: 13px; font-weight: 600; color: #374151; display: block; margin-bottom: 4px;">Address</label>
                <input class="input" id="sale_customerAddress" placeholder="Enter customer address" style="width:100%;">
              </div>

              <!-- ── PRODUCTS SECTION ── -->
              <div style="grid-column: 1/-1;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                  <label style="font-size:13px; font-weight:700; color:#374151;">Products *</label>
                  <button type="button" onclick="app.addSaleProductRow()"
                    style="background:#dc2626; color:#fff; border:none; border-radius:6px; padding:5px 14px; font-size:12px; font-weight:700; cursor:pointer;">
                    + Add Product
                  </button>
                </div>

                <!-- Column headers -->
                <div style="display:grid; grid-template-columns:2fr 1.2fr 0.8fr 1fr 1fr 32px; gap:6px; margin-bottom:4px; padding:0 2px;">
                  <span style="font-size:11px; font-weight:700; color:#6b7280;">Product Name</span>
                  <span style="font-size:11px; font-weight:700; color:#6b7280;">Category</span>
                  <span style="font-size:11px; font-weight:700; color:#6b7280;">Qty</span>
                  <span style="font-size:11px; font-weight:700; color:#6b7280;">Amount (₹)</span>
                  <span style="font-size:11px; font-weight:700; color:#6b7280;">Discount (₹)</span>
                  <span></span>
                </div>

                <!-- Product rows container -->
                <div id="sale_items_container"></div>
              </div>
              <!-- ── END PRODUCTS ── -->

              <div>
                <label style="font-size: 13px; font-weight: 600; color: #374151; display: block; margin-bottom: 4px;">Purchase Date *</label>
                <input class="input" type="date" id="sale_purchaseDate" value="${new Date().toISOString().split('T')[0]}" style="width:100%;">
              </div>
              <div>
                <label style="font-size: 13px; font-weight: 600; color: #374151; display: block; margin-bottom: 4px;">Warranty Period</label>
                <select class="input" id="sale_warrantyPeriod" style="width:100%;">
                  <option value="">No Warranty</option>
                  <option value="1 Month">1 Month</option>
                  <option value="3 Months">3 Months</option>
                  <option value="6 Months">6 Months</option>
                  <option value="1 Year">1 Year</option>
                  <option value="2 Years">2 Years</option>
                </select>
              </div>
              <div style="grid-column: 1/-1;">
                <label style="font-size: 13px; font-weight: 600; color: #374151; display: block; margin-bottom: 4px;">Notes</label>
                <textarea class="input" id="sale_notes" placeholder="Any additional notes..." rows="2" style="width:100%; resize:vertical;"></textarea>
              </div>
              <!-- Live total preview -->
              <div style="grid-column: 1/-1; background: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; padding: 10px 16px; display: flex; gap: 24px; align-items: center;">
                <span style="font-size: 13px; color: #374151;">Net Payable:</span>
                <span id="bill_preview_total" style="font-size: 18px; font-weight: 700; color: #16a34a;">₹0</span>
              </div>
            </div>
            <div style="display: flex; gap: 12px; margin-top: 16px;">
              <button class="btn btn-primary" onclick="app.saveSaleRecord()" style="padding: 10px 24px;">💾 Save Record</button>
              <button class="btn btn-secondary" onclick="app.toggleSalesForm()" style="padding: 10px 24px;">Cancel</button>
            </div>
          </div>

          <!-- Search -->
          <div style="margin-bottom: 20px; display: flex; gap: 12px; align-items: center;">
            <input class="input" placeholder="🔍 Search by name, phone, product or address..." 
              style="flex:1;" 
              oninput="app.searchSales(this.value)"
              value="${this.salesSearch || ''}">
            <span style="color: #fff; font-size: 14px; font-weight: 600;" class="sales-counter">${filtered.length} records</span>
          </div>

          <!-- Records Grid -->
          ${filtered.length === 0 ? `
            <div style="text-align:center; padding: 60px; color: #fff; font-size: 16px;">
              <div style="font-size: 48px; margin-bottom: 16px;">🛍️</div>
              <p>No sales records found. Add your first sale!</p>
            </div>
          ` : `
            <div class="sales-records-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px;">
              ${filtered.map(sale => {
                const amount = Number(sale.saleAmount) || 0;
                const discount = Number(sale.discount) || 0;
                const netAmount = amount - discount;
                return `
                <div style="background: rgba(255,255,255,0.95); border-radius: 12px; padding: 16px; border: 2px solid #fecaca; position: relative;">
                  <div style="margin-bottom: 12px;">
                    <div style="font-size: 16px; font-weight: 700; color: #000;">${sale.customerName}</div>
                    <div style="font-size: 13px; color: #dc2626; font-weight: 600;">📞 ${sale.phoneNumber}</div>
                    ${sale.customerAddress ? `<div style="font-size: 12px; color: #6b7280;">📍 ${sale.customerAddress}</div>` : ''}
                  </div>
                  <!-- Action buttons — 2×2 grid -->
                  <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; margin-bottom:12px;">
                    <button onclick="app.showEditSaleModal('${sale.saleId}')" style="background:#16a34a; border:none; border-radius:8px; padding:7px 10px; cursor:pointer; color:#fff; font-size:12px; font-weight:700; display:flex; align-items:center; justify-content:center; gap:4px;" title="Edit">✏️ Edit</button>
                    <button onclick="app.printBill('${sale.saleId}')" style="background:#1d4ed8; border:none; border-radius:8px; padding:7px 10px; cursor:pointer; color:#fff; font-size:12px; font-weight:700; display:flex; align-items:center; justify-content:center; gap:4px;" title="Print Receipt">🧾 Print</button>
                    <button onclick="app.shareSaleWhatsApp('${sale.saleId}')" style="background:#25d366; border:none; border-radius:8px; padding:7px 10px; cursor:pointer; color:#fff; font-size:12px; font-weight:700; display:flex; align-items:center; justify-content:center; gap:4px;" title="Share on WhatsApp">💬 WhatsApp</button>
                    <button onclick="app.deleteSaleRecord('${sale.saleId}')" style="background:#dc2626; border:none; border-radius:8px; padding:7px 10px; cursor:pointer; color:#fff; font-size:12px; font-weight:700; display:flex; align-items:center; justify-content:center; gap:4px;" title="Delete">🗑️ Delete</button>
                  </div>
                  <div style="border-top: 1px solid #fecaca; padding-top: 10px; display: flex; flex-direction: column; gap: 6px;">
                    <div style="font-size: 13px; color: #000;"><span style="color: #6b7280;">📱 Product:</span> <strong>${sale.productName}</strong></div>
                    <div style="font-size: 13px; color: #000;"><span style="color: #6b7280;">📅 Date:</span> ${sale.purchaseDate}</div>
                    ${amount ? `<div style="font-size: 13px; color: #374151;">Price: ₹${amount.toLocaleString()}${discount ? ` &nbsp;|&nbsp; Discount: ₹${discount.toLocaleString()}` : ''}</div>` : ''}
                    ${amount ? `<div style="font-size: 14px; font-weight: 700; color: #16a34a;">💰 Net: ₹${netAmount.toLocaleString()}</div>` : ''}
                    ${sale.warrantyPeriod ? `<div style="font-size: 12px; background: #dcfce7; color: #16a34a; padding: 3px 8px; border-radius: 20px; display: inline-block; font-weight: 600;">🛡️ Warranty: ${sale.warrantyPeriod}</div>` : ''}
                    ${sale.notes ? `<div style="font-size: 12px; color: #6b7280; font-style: italic;">${sale.notes}</div>` : ''}
                  </div>
                </div>
              `}).join('')}
            </div>
          `}
        </div>
      </div>
    `
  }

  renderDisplayStock() {
    const search = (this.stockSearch || '').toLowerCase();
    const filtered = (this.displayStock || []).filter(d =>
      d.displayName?.toLowerCase().includes(search) ||
      d.displayId?.toLowerCase().includes(search)
    );

    const lowStock = filtered.filter(d => (Number(d.stock) || 0) === 1);

    return `
      <div style="min-height:100vh; background-color:#f13e74fb; padding-top:96px; padding-bottom:80px;">
        <div class="container">
          <button class="back-button" data-page="admin" style="margin-bottom: 20px;">&#8592; Dashboard</button>
          <!-- Header -->
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:24px; flex-wrap:wrap; gap:12px;">
            <div>
              <h1 style="font-size:32px; font-weight:700; margin-bottom:4px;">📦 Display Stock</h1>
              <p style="color:#94a3b8;">Manage display inventory — increase, decrease & track stock</p>
            </div>
            <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center;">
              <button class="btn btn-primary" onclick="app.toggleStockForm()" style="padding:12px 24px;">+ Add Display</button>
              <button onclick="app.exportDisplayStockPDF()" style="padding: 12px 24px; background:#1e293b; color:#fff; border:none; border-radius:8px; font-size:14px; font-weight:700; cursor:pointer;">📄 PDF</button>
              <button onclick="app.exportDisplayStockXL()" style="padding: 12px 24px; background:#16a34a; color:#fff; border:none; border-radius:8px; font-size:14px; font-weight:700; cursor:pointer;">📊 XL Sheet</button>
            </div>
          </div>

          <!-- Add Form -->
          <div id="stockForm" style="display:none; background:rgba(255,255,255,0.97); border:2px solid #dc2626; border-radius:12px; padding:24px; margin-bottom:24px;">
            <h3 style="font-size:18px; font-weight:700; margin-bottom:16px; color:#000;">Add New Display</h3>
            <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(200px,1fr)); gap:12px;">
              <div>
                <label style="font-size:13px; font-weight:600; color:#374151; display:block; margin-bottom:4px;">Display Name *</label>
                <input class="input" id="stk_displayName" placeholder="e.g. Samsung A54 OLED" style="width:100%;">
              </div>
              <div>
                <label style="font-size:13px; font-weight:600; color:#374151; display:block; margin-bottom:4px;">Display ID *</label>
                <input class="input" id="stk_displayId" placeholder="e.g. DISP-SA54-001" style="width:100%;">
              </div>
              <div>
                <label style="font-size:13px; font-weight:600; color:#374151; display:block; margin-bottom:4px;">Initial Stock *</label>
                <input class="input" type="number" id="stk_stock" placeholder="Enter quantity" min="0" style="width:100%;">
              </div>
              <div>
                <label style="font-size:13px; font-weight:600; color:#374151; display:block; margin-bottom:4px;">Price (₹)</label>
                <input class="input" type="number" id="stk_price" placeholder="Unit price" min="0" style="width:100%;">
              </div>
            </div>
            <div style="display:flex; gap:12px; margin-top:16px;">
              <button class="btn btn-primary" onclick="app.saveDisplayStock()" style="padding:10px 24px;">💾 Save Display</button>
              <button class="btn btn-secondary" onclick="app.toggleStockForm()" style="padding:10px 24px;">Cancel</button>
            </div>
          </div>

          <!-- Search -->
          <div style="margin-bottom:16px; display:flex; gap:12px; align-items:center;">
            <div style="flex:1; position:relative;">
              <input class="input" id="stockSearchInput" placeholder="🔍 Search by display name or ID..."
                style="width:100%; background:#fff; color:#111; border:1px solid #d1d5db;"
                oninput="app.searchStock(this.value)"
                onblur="setTimeout(()=>{ const d=document.getElementById('stockSearchDropdown'); if(d) d.style.display='none'; }, 200)"
                autocomplete="off"
                value="${this.stockSearch || ''}">
            </div>
            <span style="color:#fff; font-size:14px; font-weight:600; white-space:nowrap;" class="stock-counter">${filtered.length} items</span>
          </div>

          <!-- Low stock warning -->
          ${lowStock.length > 0 ? `
            <div style="background:#fef2f2; border:2px solid #fca5a5; border-radius:10px; padding:12px 18px; margin-bottom:16px; display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap;">
              <div style="display:flex; align-items:center; gap:10px;">
                <span style="font-size:20px;">⚠️</span>
                <span style="font-size:13px; color:#dc2626; font-weight:600;">Only 1 unit left — ${lowStock.map(d=>d.displayName).join(', ')}</span>
              </div>
              <button onclick="app.downloadLowStockAlertPDF()" style="background:#1e293b; color:#fff; border:none; border-radius:7px; padding:6px 14px; font-size:12px; font-weight:700; cursor:pointer; white-space:nowrap;">📄 Download PDF</button>
            </div>
          ` : ''}

          <!-- Excel-style Table -->
          ${filtered.length === 0 ? `
            <div style="text-align:center; padding:60px; color:#fff; font-size:16px;">
              <div style="font-size:48px; margin-bottom:16px;">📦</div>
              <p>No display stock found. Add your first display!</p>
            </div>
          ` : `
            <div style="background:#fff; border-radius:12px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,0.15); border:2px solid #e2e8f0;">
              <div style="overflow-x:auto;">
                <table style="width:100%; border-collapse:collapse; font-size:13px; min-width:680px;">
                  <!-- Table Header -->
                  <thead>
                    <tr style="background:#1e293b; color:#fff; text-align:left;">
                      <th style="padding:12px 14px; font-weight:700; border-right:1px solid #334155; width:36px;">#</th>
                      <th style="padding:12px 14px; font-weight:700; border-right:1px solid #334155; min-width:180px;">Display Name</th>
                      <th style="padding:12px 14px; font-weight:700; border-right:1px solid #334155; min-width:90px; text-align:center;">Price (₹)</th>
                      <th style="padding:12px 14px; font-weight:700; border-right:1px solid #334155; min-width:100px; text-align:center;">Stock</th>
                      <th style="padding:12px 14px; font-weight:700; border-right:1px solid #334155; min-width:170px; text-align:center;">
                        <div style="display:flex; flex-direction:column; align-items:center; gap:4px;">
                          <span>Total Value (₹) + Password</span>
                          <input type="password" id="stockTotalValuePassword" placeholder="Enter password"
                            value="${this.stockTotalValueUnlocked ? 'admin123' : ''}"
                            oninput="app.checkStockTotalValuePassword(this.value)"
                            onkeydown="if(event.key === 'Enter') app.checkStockTotalValuePassword(this.value, true)"
                            style="width:105px; padding:3px 6px; border:1px solid #cbd5e1; border-radius:4px; font-size:11px; text-align:center; color:#000; outline:none; font-weight:normal;">
                        </div>
                      </th>
                      <th style="padding:12px 14px; font-weight:700; border-right:1px solid #334155; min-width:200px; text-align:center;">Adjust Stock</th>
                      <th style="padding:12px 14px; font-weight:700; text-align:center; min-width:70px;">Action</th>
                    </tr>
                  </thead>
                  <tbody class="stock-table-body">
                    ${filtered.map((item, idx) => {
                      const stock = Number(item.stock) || 0;
                      const price = Number(item.price) || 0;
                      const totalValue = price * stock;
                      const stockColor  = stock === 0 ? '#dc2626' : stock <= 1 ? '#dc2626' : stock <= 3 ? '#d97706' : '#16a34a';
                      const stockBg     = stock === 0 ? '#fef2f2' : stock <= 1 ? '#fef2f2' : stock <= 3 ? '#fffbeb' : '#f0fdf4';
                      const rowBg       = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
                      return `
                        <tr class="stock-item-row" data-id="${item.stockItemId}" style="background:${rowBg}; border-bottom:1px solid #e2e8f0; transition:background 0.3s;"
                            onmouseover="this.style.background='#eff6ff'" onmouseout="this.style.background='${rowBg}'">
                          <td style="padding:10px 14px; color:#9ca3af; font-weight:600; border-right:1px solid #e2e8f0; text-align:center;">${idx + 1}</td>
                          <td style="padding:10px 14px; font-weight:700; color:#111827; border-right:1px solid #e2e8f0;">
                            ${item.displayName}
                            ${stock <= 1 && stock > 0 ? `<span style="margin-left:6px; background:#fef2f2; color:#dc2626; font-size:10px; font-weight:800; padding:2px 7px; border-radius:4px; border:1px solid #fca5a5;">⚠️ LAST 1</span>` : ''}
                            ${stock === 0 ? `<span style="margin-left:6px; background:#fef2f2; color:#dc2626; font-size:10px; font-weight:800; padding:2px 7px; border-radius:4px; border:1px solid #fca5a5;">❌ OUT</span>` : ''}
                          </td>
                          <td style="padding:10px 14px; text-align:center; color:#374151; font-weight:600; border-right:1px solid #e2e8f0;">
                            ${this.stockTotalValueUnlocked ? 
                              (price ? `₹${price.toLocaleString('en-IN')}` : '<span style="color:#9ca3af;">—</span>') :
                              '<span style="color:#94a3b8; font-family:monospace; font-size:14px;">••••</span>'
                            }
                          </td>
                          <td style="padding:10px 14px; text-align:center; border-right:1px solid #e2e8f0;">
                            <span style="display:inline-block; background:${stockBg}; color:${stockColor}; font-weight:900; font-size:18px; min-width:48px; padding:4px 10px; border-radius:6px; border:1px solid ${stockColor}40;">
                              ${stock}
                            </span>
                          </td>
                          <td style="padding:10px 14px; text-align:center; font-weight:700; color:#1d4ed8; border-right:1px solid #e2e8f0;">
                            ${this.stockTotalValueUnlocked ? 
                              (price && stock ? `₹${totalValue.toLocaleString('en-IN')}` : '<span style="color:#9ca3af;">—</span>') :
                              '<span style="color:#94a3b8; font-family:monospace; font-size:14px;">••••</span>'
                            }
                          </td>
                          <td style="padding:8px 14px; border-right:1px solid #e2e8f0;">
                            <div style="display:flex; gap:6px; align-items:center; justify-content:center;">
                              <input type="number" id="qty_${item.stockItemId}" min="1" value="1"
                                style="width:52px; padding:5px 6px; border:1px solid #d1d5db; border-radius:6px; font-size:13px; text-align:center; color:#111;">
                              <button onclick="app.adjustStock('${item.stockItemId}', 1)"
                                style="background:#16a34a; color:#fff; border:none; border-radius:6px; padding:6px 12px; font-size:12px; font-weight:700; cursor:pointer; white-space:nowrap;">
                                ▲ In
                              </button>
                              <button onclick="app.adjustStock('${item.stockItemId}', -1)"
                                style="background:#dc2626; color:#fff; border:none; border-radius:6px; padding:6px 12px; font-size:12px; font-weight:700; cursor:pointer; white-space:nowrap; ${stock===0?'opacity:0.45;cursor:not-allowed;':''}">
                                ▼ Out
                              </button>
                            </div>
                          </td>
                          <td style="padding:10px 14px; text-align:center;">
                            <div style="display:flex; gap:6px; justify-content:center;">
                              <button onclick="app.showEditStockModal('${item.stockItemId}')"
                                style="background:#dbeafe; color:#1d4ed8; border:1px solid #93c5fd; border-radius:6px; padding:5px 10px; font-size:12px; cursor:pointer;" title="Edit">
                                ✏️
                              </button>
                              <button onclick="app.deleteDisplayStock('${item.stockItemId}')"
                                style="background:#fee2e2; color:#dc2626; border:1px solid #fca5a5; border-radius:6px; padding:5px 10px; font-size:12px; cursor:pointer;" title="Delete">
                                🗑️
                              </button>
                            </div>
                          </td>
                        </tr>
                      `;
                    }).join('')}
                  </tbody>
                  <!-- Grand Total Footer Row -->
                  <tfoot>
                    <tr style="background:#1e293b; color:#fff; font-weight:700;">
                      <td colspan="2" style="padding:12px 14px; font-size:13px; border-right:1px solid #334155;">📊 GRAND TOTAL</td>
                      <td style="padding:12px 14px; text-align:center; font-size:13px; border-right:1px solid #334155;">—</td>
                      <td style="padding:12px 14px; text-align:center; font-size:15px; font-weight:900; border-right:1px solid #334155;">
                        ${filtered.reduce((sum, d) => sum + (Number(d.stock) || 0), 0)} units
                      </td>
                      <td style="padding:12px 14px; text-align:center; font-size:15px; font-weight:900; color:#86efac; border-right:1px solid #334155;">
                        ${this.stockTotalValueUnlocked ? 
                          `₹${filtered.reduce((sum, d) => sum + ((Number(d.price) || 0) * (Number(d.stock) || 0)), 0).toLocaleString('en-IN')}` :
                          '<span style="color:#94a3b8; font-family:monospace; font-size:14px;">••••</span>'
                        }
                      </td>
                      <td colspan="2" style="padding:12px 14px; text-align:center; font-size:12px; color:#94a3b8;">
                        ${filtered.length} item${filtered.length !== 1 ? 's' : ''}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          `}
        </div>
      </div>`;
  }

  toggleStockForm() {
    const f = document.getElementById('stockForm');
    if (f) f.style.display = f.style.display === 'none' ? 'block' : 'none';
  }

  toggleStockHistory(stockItemId) {
    const el = document.getElementById(`hist_${stockItemId}`);
    if (el) el.style.display = el.style.display === 'none' ? 'table-row' : 'none';
  }

  checkStockTotalValuePassword(val, isSubmit = false) {
    const isCorrect = (val === 'admin123');
    if (isCorrect !== this.stockTotalValueUnlocked) {
      this.stockTotalValueUnlocked = isCorrect;
      this.renderPage('admin-display-stock');
      setTimeout(() => {
        const input = document.getElementById('stockTotalValuePassword');
        if (input) {
          input.focus();
          input.value = val;
          input.setSelectionRange(val.length, val.length);
        }
      }, 50);
    } else if (isSubmit && !isCorrect) {
      alert('❌ Invalid password');
    }
  }

  async saveDisplayStock() {
    const displayName = document.getElementById('stk_displayName')?.value?.trim();
    const displayId   = document.getElementById('stk_displayId')?.value?.trim();
    const stock       = document.getElementById('stk_stock')?.value;
    const price       = document.getElementById('stk_price')?.value;

    if (!displayName || !displayId || stock === '' || stock === null) {
      alert('Please fill in Display Name, Display ID and Initial Stock.');
      return;
    }

    const data = {
      displayName,
      displayId,
      stock: Number(stock),
      price: price ? Number(price) : null,
      history: [{ change: Number(stock), stockAfter: Number(stock), date: new Date().toLocaleDateString('en-IN') }]
    };

    try {
      const response = await fetch(`${this.API_URL}/display-stock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (response.ok) {
        const saved = await response.json();
        this.displayStock.unshift(saved);
        this.displayStock.sort((a, b) => {
          const nameA = (a.displayName || '').trim().toLowerCase();
          const nameB = (b.displayName || '').trim().toLowerCase();
          return nameA.localeCompare(nameB);
        });
        alert('✅ Display stock saved!');
        this.renderPage('admin-display-stock');
      } else {
        alert('❌ Failed to save display stock.');
      }
    } catch (err) {
      console.error(err);
      alert('❌ Error saving display stock.');
    }
  }

  async adjustStock(stockItemId, direction) {
    const qtyInput = document.getElementById(`qty_${stockItemId}`);
    const qty = Math.max(1, Number(qtyInput?.value) || 1);
    const item = (this.displayStock || []).find(d => d.stockItemId === stockItemId);
    if (!item) return;

    const change = direction * qty;
    const newStock = Math.max(0, (Number(item.stock) || 0) + change);

    const historyEntry = {
      change,
      stockAfter: newStock,
      date: new Date().toLocaleDateString('en-IN')
    };

    try {
      const response = await fetch(`${this.API_URL}/display-stock/${stockItemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stock: newStock, historyEntry })
      });
      if (response.ok) {
        const updated = await response.json();
        const idx = this.displayStock.findIndex(d => d.stockItemId === stockItemId);
        if (idx !== -1) this.displayStock[idx] = updated;

        // Show low stock warning modal with PDF option when stock reaches 1
        if (updated.stock === 1) {
          this.showLowStockAlert(updated);
        }

        this.renderPage('admin-display-stock');
      } else {
        alert('❌ Failed to update stock.');
      }
    } catch (err) {
      console.error(err);
      alert('❌ Error updating stock.');
    }
  }

  showLowStockAlert(item) {
    const existing = document.getElementById('lowStockAlertModal');
    if (existing) existing.remove();

    const totalValue = (Number(item.price) || 0) * 1; // stock is 1

    const modalHTML = `
      <div id="lowStockAlertModal" onclick="if(event.target===this)this.remove()" 
        style="position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;">
        <div style="background:#fff;border-radius:14px;padding:28px;max-width:420px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,0.4);text-align:center;">
          <div style="font-size:48px;margin-bottom:12px;">⚠️</div>
          <h2 style="font-size:20px;font-weight:800;color:#dc2626;margin-bottom:8px;">Low Stock Alert!</h2>
          <p style="font-size:15px;font-weight:700;color:#111;margin-bottom:6px;">${item.displayName}</p>
          <p style="font-size:13px;color:#6b7280;margin-bottom:16px;">Only <strong style="color:#dc2626;">1 unit</strong> remaining in stock. Please reorder soon.</p>
          ${item.price ? `<p style="font-size:13px;color:#374151;margin-bottom:20px;">Unit Price: <strong>${this.stockTotalValueUnlocked ? '₹' + Number(item.price).toLocaleString('en-IN') : '••••'}</strong></p>` : ''}
          <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">
            <button onclick="app.downloadLowStockPDF('${item.stockItemId}')" 
              style="background:#1e293b;color:#fff;border:none;border-radius:8px;padding:10px 20px;font-size:14px;font-weight:700;cursor:pointer;">
              📄 Download PDF
            </button>
            <button onclick="document.getElementById('lowStockAlertModal').remove()"
              style="background:#f1f5f9;color:#374151;border:1px solid #d1d5db;border-radius:8px;padding:10px 20px;font-size:14px;font-weight:600;cursor:pointer;">
              ✕ Dismiss
            </button>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
  }

  downloadLowStockAlertPDF() {
    const lowItems = (this.displayStock || []).filter(d => Number(d.stock) === 1);
    if (lowItems.length === 0) return;

    const win = window.open('', '_blank', 'width=700,height=500');
    const rows = lowItems.map((d, i) => `
      <tr style="background:${i%2===0?'#fff':'#fef2f2'}">
        <td>${i+1}</td>
        <td style="font-weight:700;">${d.displayName}</td>
        <td>${d.displayId}</td>
        <td style="color:#dc2626;font-weight:900;">1 unit</td>
        <td>${this.stockTotalValueUnlocked ? (d.price ? '₹' + Number(d.price).toLocaleString('en-IN') : '—') : '••••'}</td>
      </tr>`).join('');

    win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Low Stock Alert Report</title>
    <style>
      body{font-family:Arial,sans-serif;padding:30px;color:#111;}
      h2{color:#dc2626;}
      table{width:100%;border-collapse:collapse;font-size:13px;margin-top:16px;}
      th{background:#dc2626;color:#fff;padding:9px 12px;text-align:left;}
      td{padding:8px 12px;border-bottom:1px solid #e5e7eb;}
      .footer{margin-top:20px;font-size:12px;color:#6b7280;}
      @media print{button{display:none;}}
    </style></head><body>
    <h2>⚠️ Low Stock Alert — Manjula Mobile World</h2>
    <p style="color:#6b7280;font-size:13px;">Generated: ${new Date().toLocaleString('en-IN')} &nbsp;|&nbsp; Items with only 1 unit remaining: ${lowItems.length}</p>
    <table>
      <thead><tr><th>#</th><th>Display Name</th><th>Display ID</th><th>Stock</th><th>Unit Price</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p style="margin-top:20px;font-size:13px;color:#dc2626;font-weight:700;">⚠️ Please reorder the above items immediately!</p>
    <div class="footer">Manjula Mobile World | Ramapuram, Tamil Nadu | Ph: +91 82484 54841</div>
    <br>
    <button onclick="window.print()" style="padding:10px 24px;background:#1e293b;color:#fff;border:none;border-radius:6px;font-size:14px;cursor:pointer;">🖨️ Print / Save as PDF</button>
    </body></html>`);
    win.document.close();
    setTimeout(() => { try { win.focus(); } catch(e) {} }, 200);
  }

  downloadLowStockPDF(stockItemId) {
    const item = (this.displayStock || []).find(d => d.stockItemId === stockItemId);
    if (!item) return;

    const win = window.open('', '_blank', 'width=600,height=500');
    win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Low Stock Alert</title>
    <style>
      body{font-family:Arial,sans-serif;padding:30px;color:#111;}
      h2{color:#dc2626;}
      .box{border:2px solid #dc2626;border-radius:8px;padding:20px;margin-top:16px;}
      .row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f3f4f6;font-size:14px;}
      .label{color:#6b7280;}
      .value{font-weight:700;}
      @media print{button{display:none;}}
    </style></head><body>
    <h2>⚠️ Low Stock Alert — Manjula Mobile World</h2>
    <p style="color:#6b7280;font-size:13px;">Generated: ${new Date().toLocaleString('en-IN')}</p>
    <div class="box">
      <div class="row"><span class="label">Display Name</span><span class="value">${item.displayName}</span></div>
      <div class="row"><span class="label">Display ID</span><span class="value">${item.displayId}</span></div>
      <div class="row"><span class="label">Remaining Stock</span><span class="value" style="color:#dc2626;">1 unit</span></div>
      <div class="row"><span class="label">Unit Price</span><span class="value">${this.stockTotalValueUnlocked ? (item.price ? '₹' + Number(item.price).toLocaleString('en-IN') : '—') : '••••'}</span></div>
      <div class="row"><span class="label">Total Value</span><span class="value">${this.stockTotalValueUnlocked ? (item.price ? '₹' + Number(item.price).toLocaleString('en-IN') : '—') : '••••'}</span></div>
    </div>
    <p style="margin-top:20px;font-size:13px;color:#dc2626;font-weight:700;">⚠️ Please reorder this display immediately!</p>
    <br>
    <button onclick="window.print()" style="padding:10px 24px;background:#1e293b;color:#fff;border:none;border-radius:6px;font-size:14px;cursor:pointer;">🖨️ Print / Save as PDF</button>
    </body></html>`);
    win.document.close();
    setTimeout(() => { try { win.focus(); } catch(e) {} }, 200);
  }

  showEditStockModal(stockItemId) {
    const item = (this.displayStock || []).find(d => d.stockItemId === stockItemId);
    if (!item) return;

    const existing = document.getElementById('editStockModal');
    if (existing) existing.remove();

    const modalHTML = `
      <div id="editStockModal" style="position:fixed; inset:0; background:rgba(0,0,0,0.6); z-index:9999; display:flex; align-items:center; justify-content:center; padding:16px;">
        <div style="background:#fff; border-radius:14px; padding:28px; width:100%; max-width:460px; box-shadow:0 20px 60px rgba(0,0,0,0.3);">
          <h3 style="font-size:18px; font-weight:800; color:#111; margin-bottom:20px;">✏️ Edit Display Stock</h3>

          <div style="display:flex; flex-direction:column; gap:14px;">
            <div>
              <label style="font-size:13px; font-weight:600; color:#374151; display:block; margin-bottom:4px;">Display Name *</label>
              <input id="edit_displayName" class="input" value="${item.displayName}"
                style="width:100%; background:#f8fafc; color:#111; border:1px solid #d1d5db;">
            </div>
            <div>
              <label style="font-size:13px; font-weight:600; color:#374151; display:block; margin-bottom:4px;">Display ID *</label>
              <input id="edit_displayId" class="input" value="${item.displayId}"
                style="width:100%; background:#f8fafc; color:#111; border:1px solid #d1d5db;">
            </div>
            <div>
              <label style="font-size:13px; font-weight:600; color:#374151; display:block; margin-bottom:4px;">Price (₹)</label>
              <input id="edit_price" class="input" type="${this.stockTotalValueUnlocked ? 'number' : 'password'}" min="0" value="${item.price || ''}"
                placeholder="${this.stockTotalValueUnlocked ? 'Leave blank if no price' : '••••'}"
                ${this.stockTotalValueUnlocked ? '' : 'readonly'}
                style="width:100%; background:#f8fafc; color:#111; border:1px solid #d1d5db;">
            </div>
          </div>

          <div style="display:flex; gap:10px; margin-top:22px;">
            <button onclick="app.saveEditDisplayStock('${stockItemId}')"
              style="flex:1; background:#1d4ed8; color:#fff; border:none; border-radius:8px; padding:11px; font-size:14px; font-weight:700; cursor:pointer;">
              💾 Save Changes
            </button>
            <button onclick="document.getElementById('editStockModal').remove()"
              style="flex:1; background:#f1f5f9; color:#374151; border:1px solid #d1d5db; border-radius:8px; padding:11px; font-size:14px; font-weight:600; cursor:pointer;">
              Cancel
            </button>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
  }

  async saveEditDisplayStock(stockItemId) {
    const displayName = document.getElementById('edit_displayName')?.value?.trim();
    const displayId   = document.getElementById('edit_displayId')?.value?.trim();
    const priceVal    = document.getElementById('edit_price')?.value;

    if (!displayName || !displayId) {
      alert('Display Name and Display ID are required.');
      return;
    }

    const updates = {
      displayName,
      displayId,
      price: priceVal !== '' && priceVal !== null ? Number(priceVal) : null
    };

    try {
      const response = await fetch(`${this.API_URL}/display-stock/${stockItemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });

      if (response.ok) {
        const updated = await response.json();
        const idx = this.displayStock.findIndex(d => d.stockItemId === stockItemId);
        if (idx !== -1) this.displayStock[idx] = updated;
        this.displayStock.sort((a, b) => {
          const nameA = (a.displayName || '').trim().toLowerCase();
          const nameB = (b.displayName || '').trim().toLowerCase();
          return nameA.localeCompare(nameB);
        });
        document.getElementById('editStockModal')?.remove();
        this.renderPage('admin-display-stock');
      } else {
        alert('❌ Failed to update item.');
      }
    } catch (err) {
      console.error(err);
      alert('❌ Error updating item.');
    }
  }

  async deleteDisplayStock(stockItemId) {
    if (!confirm('Delete this display stock item?')) return;
    try {
      const response = await fetch(`${this.API_URL}/display-stock/${stockItemId}`, { method: 'DELETE' });
      if (response.ok) {
        this.displayStock = this.displayStock.filter(d => d.stockItemId !== stockItemId);
        this.renderPage('admin-display-stock');
        alert('✅ Display stock deleted.');
      }
    } catch (err) {
      console.error(err);
    }
  }

  renderAdminServices() {
    const search = (this.serviceSearch || '').toLowerCase();
    const filtered = (this.serviceRecords || []).filter(s =>
      s.customerName?.toLowerCase().includes(search) ||
      s.phoneNumber?.includes(search) ||
      s.serviceDetails?.toLowerCase().includes(search) ||
      s.customerAddress?.toLowerCase().includes(search)
    );

    return `
      <div style="min-height:100vh; background-color:#f13e74fb; padding-top:96px; padding-bottom:80px;">
        <div class="container">
          <button class="back-button" data-page="admin" style="margin-bottom: 20px;">&#8592; Dashboard</button>
          <!-- Header -->
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:24px; flex-wrap:wrap; gap:12px;">
            <div>
              <h1 style="font-size:32px; font-weight:700; margin-bottom:4px;">🔧 Services</h1>
              <p style="color:#94a3b8;">Manage customer service & repair records</p>
            </div>
            <div style="display:flex; gap:10px; flex-wrap:wrap;">
              <button class="btn btn-primary" onclick="app.toggleServiceForm()" style="padding:12px 24px;">+ Add Service</button>
              <button onclick="app.renderPage('admin-services-daily')" style="padding:12px 24px; background:#0891b2; color:#fff; border:none; border-radius:8px; font-size:14px; font-weight:700; cursor:pointer;">📅 Daily</button>
              <button onclick="app.renderPage('admin-services-monthly')" style="padding:12px 24px; background:#1d4ed8; color:#fff; border:none; border-radius:8px; font-size:14px; font-weight:700; cursor:pointer;">📆 Monthly</button>
            </div>
          </div>

          <!-- Add Service Form -->
          <div id="serviceForm" style="display:none; background:rgba(255,255,255,0.97); border:2px solid #dc2626; border-radius:12px; padding:24px; margin-bottom:24px;">
            <h3 style="font-size:18px; font-weight:700; margin-bottom:16px; color:#000;">New Service Record</h3>
            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:12px;">
              <div>
                <label style="font-size:13px; font-weight:600; color:#374151; display:block; margin-bottom:4px;">Customer Name *</label>
                <input class="input" id="svc_customerName" placeholder="Enter customer name" style="width:100%;">
              </div>
              <div>
                <label style="font-size:13px; font-weight:600; color:#374151; display:block; margin-bottom:4px;">Phone Number *</label>
                <input class="input" id="svc_phoneNumber" placeholder="Enter phone number" style="width:100%;">
              </div>
              <div style="grid-column:1/-1;">
                <label style="font-size:13px; font-weight:600; color:#374151; display:block; margin-bottom:4px;">Address</label>
                <input class="input" id="svc_customerAddress" placeholder="Enter customer address" style="width:100%;">
              </div>
              <div>
                <label style="font-size:13px; font-weight:600; color:#374151; display:block; margin-bottom:4px;">Service Price (₹) *</label>
                <input class="input" type="number" id="svc_price" placeholder="Total service price" style="width:100%;" oninput="app.updateServicePreview()">
              </div>
              <div>
                <label style="font-size:13px; font-weight:600; color:#374151; display:block; margin-bottom:4px;">Advance Paid (₹)</label>
                <input class="input" type="number" id="svc_advance" placeholder="Advance amount received" style="width:100%;" oninput="app.updateServicePreview()">
              </div>
              <div>
                <label style="font-size:13px; font-weight:600; color:#374151; display:block; margin-bottom:4px;">Service Date *</label>
                <input class="input" type="date" id="svc_serviceDate" value="${new Date().toISOString().split('T')[0]}" style="width:100%;">
              </div>
              <div>
                <label style="font-size:13px; font-weight:600; color:#374151; display:block; margin-bottom:4px;">Status</label>
                <select class="input" id="svc_status" style="width:100%;">
                  <option value="Received">📥 Received</option>
                  <option value="In Progress">🔧 In Progress</option>
                  <option value="Ready for Pickup">📢 Ready for Pickup</option>
                  <option value="Completed">✅ Completed</option>
                  <option value="Delivered">🎉 Delivered</option>
                </select>
              </div>
              <div style="grid-column:1/-1;">
                <label style="font-size:13px; font-weight:600; color:#374151; display:block; margin-bottom:4px;">Product / Service Details *</label>
                <textarea class="input" id="svc_serviceDetails" placeholder="e.g. iPhone 13 - Screen replacement, battery issue fixed..." rows="3" style="width:100%; resize:vertical;"></textarea>
              </div>
              <!-- Balance preview -->
              <div style="grid-column:1/-1; background:#fef2f2; border:1px solid #fecaca; border-radius:8px; padding:10px 16px; display:flex; gap:32px; align-items:center; flex-wrap:wrap;">
                <div><span style="font-size:12px; color:#6b7280;">Total Price:</span> <span id="svc_preview_total" style="font-size:16px; font-weight:700; color:#374151;">₹0</span></div>
                <div><span style="font-size:12px; color:#6b7280;">Advance:</span> <span id="svc_preview_advance" style="font-size:16px; font-weight:700; color:#16a34a;">₹0</span></div>
                <div><span style="font-size:12px; color:#6b7280;">Balance Due:</span> <span id="svc_preview_balance" style="font-size:18px; font-weight:800; color:#dc2626;">₹0</span></div>
              </div>
            </div>
            <div style="display:flex; gap:12px; margin-top:16px;">
              <button class="btn btn-primary" onclick="app.saveServiceRecord()" style="padding:10px 24px;">💾 Save Service</button>
              <button class="btn btn-secondary" onclick="app.toggleServiceForm()" style="padding:10px 24px;">Cancel</button>
            </div>
          </div>

          <!-- Search -->
          <div style="margin-bottom:20px; display:flex; gap:12px; align-items:center;">
            <input class="input" placeholder="🔍 Search by name, phone, address or service details..."
              style="flex:1;"
              oninput="app.searchServices(this.value)"
              value="${this.serviceSearch || ''}">
            <span style="color:#fff; font-size:14px; font-weight:600;" class="services-counter">${filtered.length} records</span>
          </div>

          <!-- Records -->
          ${filtered.length === 0 ? `
            <div style="text-align:center; padding:60px; color:#fff; font-size:16px;">
              <div style="font-size:48px; margin-bottom:16px;">🔧</div>
              <p>No service records yet. Add your first service!</p>
            </div>
          ` : `
            <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(320px, 1fr)); gap:16px;">
              ${filtered.map(svc => {
                const price = Number(svc.price) || 0;
                const advance = Number(svc.advance) || 0;
                const balance = price - advance;
                const statusColors = {
                  'Received': '#6b7280',
                  'In Progress': '#d97706',
                  'Ready for Pickup': '#2563eb',
                  'Completed': '#16a34a',
                  'Delivered': '#7c3aed'
                };
                const color = statusColors[svc.status] || '#6b7280';
                return `
                  <div style="background:rgba(255,255,255,0.97); border-radius:12px; padding:16px; border:2px solid #fecaca; position:relative;">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px;">
                      <div>
                        <div style="font-size:16px; font-weight:700; color:#000;">${svc.customerName}</div>
                        <div style="font-size:13px; color:#dc2626; font-weight:600;">📞 ${svc.phoneNumber}</div>
                        ${svc.customerAddress ? `<div style="font-size:12px; color:#6b7280;">📍 ${svc.customerAddress}</div>` : ''}
                      </div>
                      <div style="display:flex; gap:6px; align-items:center;">
                        <span style="font-size:11px; font-weight:700; color:${color}; background:${color}18; padding:3px 8px; border-radius:20px; border:1px solid ${color}40;">${svc.status || 'Received'}</span>
                        <button onclick="app.showServiceBill('${svc.serviceId}')" style="background:#dbeafe; border:none; border-radius:6px; padding:4px 8px; cursor:pointer; color:#1d4ed8; font-size:12px;" title="View Bill">🧾</button>
                        <button onclick="app.deleteServiceRecord('${svc.serviceId}')" style="background:#fee2e2; border:none; border-radius:6px; padding:4px 8px; cursor:pointer; color:#dc2626; font-size:12px;" title="Delete">🗑️</button>
                      </div>
                    </div>
                    <div style="border-top:1px solid #fecaca; padding-top:10px; display:flex; flex-direction:column; gap:5px;">
                      <div style="font-size:13px; color:#374151;"><span style="color:#6b7280;">🔧 Service:</span> ${svc.serviceDetails}</div>
                      <div style="font-size:12px; color:#6b7280;">📅 Date: ${svc.serviceDate}</div>
                      <div style="display:flex; gap:16px; margin-top:4px; flex-wrap:wrap;">
                        <div style="font-size:13px;"><span style="color:#6b7280;">Price:</span> <strong>₹${price.toLocaleString()}</strong></div>
                        <div style="font-size:13px; color:#16a34a;"><span style="color:#6b7280;">Advance:</span> <strong>₹${advance.toLocaleString()}</strong></div>
                        <div style="font-size:14px; font-weight:800; color:${balance > 0 ? '#dc2626' : '#16a34a'};">Balance: ₹${balance.toLocaleString()}</div>
                      </div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          `}
        </div>
      </div>
    `;
  }

  toggleServiceForm() {
    const form = document.getElementById('serviceForm');
    if (form) form.style.display = form.style.display === 'none' ? 'block' : 'none';
  }

  updateServicePreview() {
    const price = Number(document.getElementById('svc_price')?.value) || 0;
    const advance = Number(document.getElementById('svc_advance')?.value) || 0;
    const balance = price - advance;
    const t = document.getElementById('svc_preview_total');
    const a = document.getElementById('svc_preview_advance');
    const b = document.getElementById('svc_preview_balance');
    if (t) t.textContent = `₹${price.toLocaleString()}`;
    if (a) a.textContent = `₹${advance.toLocaleString()}`;
    if (b) b.textContent = `₹${balance.toLocaleString()}`;
  }

  async saveServiceRecord() {
    const customerName = document.getElementById('svc_customerName')?.value?.trim();
    const phoneNumber = document.getElementById('svc_phoneNumber')?.value?.trim();
    const serviceDetails = document.getElementById('svc_serviceDetails')?.value?.trim();
    const serviceDate = document.getElementById('svc_serviceDate')?.value;
    const price = document.getElementById('svc_price')?.value;

    if (!customerName || !phoneNumber || !serviceDetails || !serviceDate || !price) {
      alert('Please fill in Customer Name, Phone Number, Service Details, Date and Price.');
      return;
    }

    const serviceData = {
      customerName,
      phoneNumber,
      customerAddress: document.getElementById('svc_customerAddress')?.value?.trim(),
      price,
      advance: document.getElementById('svc_advance')?.value || '0',
      serviceDate,
      status: document.getElementById('svc_status')?.value || 'Received',
      serviceDetails
    };

    try {
      const response = await fetch(`${this.API_URL}/services`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(serviceData)
      });
      if (response.ok) {
        const saved = await response.json();
        this.serviceRecords.unshift(saved);
        alert('✅ Service record saved successfully!');
        this.renderPage('admin-services');
      } else {
        alert('❌ Failed to save service record.');
      }
    } catch (error) {
      console.error('Error saving service:', error);
      alert('❌ Error saving service record.');
    }
  }

  async deleteServiceRecord(serviceId) {
    if (!confirm('Delete this service record?')) return;
    try {
      const response = await fetch(`${this.API_URL}/services/${serviceId}`, { method: 'DELETE' });
      if (response.ok) {
        this.serviceRecords = this.serviceRecords.filter(s => s.serviceId !== serviceId);
        this.renderPage('admin-services');
        alert('✅ Service record deleted.');
      }
    } catch (error) {
      console.error('Error deleting service:', error);
    }
  }

  showServiceBill(serviceId) {
    const svc = this.serviceRecords.find(s => s.serviceId === serviceId);
    if (!svc) return;

    const price = Number(svc.price) || 0;
    const advance = Number(svc.advance) || 0;
    const balance = price - advance;

    const billHTML = `
      <div id="serviceBillModal" style="position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;">
        <div style="background:#fff;border-radius:12px;max-width:520px;width:100%;max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.4);">
          <div id="serviceBillContent" style="padding:32px;">
            <!-- Header -->
            <div style="text-align:center;border-bottom:2px solid #dc2626;padding-bottom:16px;margin-bottom:20px;">
              <div style="font-size:22px;font-weight:800;color:#dc2626;letter-spacing:1px;">MANJULA MOBILE WORLD</div>
              <div style="font-size:12px;color:#6b7280;margin-top:4px;">📞 +91 82484 54841 &nbsp;|&nbsp; ✉️ manjulamobiles125@gmail.com</div>
              <div style="font-size:13px;font-weight:700;color:#374151;margin-top:6px;">SERVICE RECEIPT</div>
            </div>

            <div style="display:flex;justify-content:space-between;margin-bottom:20px;">
              <div style="font-size:13px;color:#6b7280;">Date: <strong style="color:#111;">${svc.serviceDate}</strong></div>
              <div style="font-size:12px;background:${svc.status==='Delivered'||svc.status==='Completed'?'#dcfce7':'#fef3c7'};color:${svc.status==='Delivered'||svc.status==='Completed'?'#16a34a':'#d97706'};padding:3px 10px;border-radius:20px;font-weight:700;">${svc.status}</div>
            </div>

            <!-- Customer -->
            <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:14px;margin-bottom:20px;">
              <div style="font-size:12px;font-weight:700;color:#dc2626;margin-bottom:8px;text-transform:uppercase;">Customer Details</div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">
                <div style="font-size:13px;"><span style="color:#6b7280;">Name:</span> <strong>${svc.customerName}</strong></div>
                <div style="font-size:13px;"><span style="color:#6b7280;">Phone:</span> <strong>${svc.phoneNumber}</strong></div>
                <div style="font-size:13px;grid-column:1/-1;"><span style="color:#6b7280;">Address:</span> <strong>${svc.customerAddress || '—'}</strong></div>
              </div>
            </div>

            <!-- Service details -->
            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px;margin-bottom:20px;">
              <div style="font-size:12px;font-weight:700;color:#374151;margin-bottom:8px;text-transform:uppercase;">Service Details</div>
              <div style="font-size:13px;color:#374151;line-height:1.6;">${svc.serviceDetails}</div>
            </div>

            <!-- Payment summary -->
            <div style="border-top:2px solid #dc2626;padding-top:12px;margin-bottom:20px;">
              <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:6px;">
                <span style="color:#6b7280;">Service Price</span>
                <span>₹${price.toLocaleString()}</span>
              </div>
              <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:6px;color:#16a34a;">
                <span>Advance Paid</span>
                <span>- ₹${advance.toLocaleString()}</span>
              </div>
              <div style="display:flex;justify-content:space-between;font-size:16px;font-weight:800;color:${balance>0?'#dc2626':'#16a34a'};border-top:1px dashed #fecaca;padding-top:8px;margin-top:4px;">
                <span>${balance > 0 ? 'Balance Due' : 'Fully Paid ✅'}</span>
                <span>₹${balance.toLocaleString()}</span>
              </div>
            </div>

            <div style="text-align:center;border-top:1px solid #e5e7eb;padding-top:14px;font-size:11px;color:#9ca3af;">
              Thank you for choosing Manjula Mobile World! 🙏<br>
              Please keep this receipt for reference.
            </div>
          </div>

          <div style="display:flex;gap:12px;padding:16px 32px 24px;border-top:1px solid #e5e7eb;">
            <button onclick="app.printServiceBill()" style="flex:1;background:#dc2626;color:#fff;border:none;border-radius:8px;padding:12px;font-size:14px;font-weight:700;cursor:pointer;">🖨️ Print / Save PDF</button>
            <button onclick="app.closeServiceBillModal()" style="flex:1;background:#f1f5f9;color:#374151;border:none;border-radius:8px;padding:12px;font-size:14px;font-weight:600;cursor:pointer;">✕ Close</button>
          </div>
        </div>
      </div>
    `;

    const existing = document.getElementById('serviceBillModal');
    if (existing) existing.remove();
    document.body.insertAdjacentHTML('beforeend', billHTML);
  }

  closeBillModal() {
    const m = document.getElementById('billModal');
    if (m) m.remove();
  }

  closeServiceBillModal() {
    const m = document.getElementById('serviceBillModal');
    if (m) m.remove();
  }

  printServiceBill() {
    const content = document.getElementById('serviceBillContent');
    if (!content) return;
    const printWindow = window.open('', '_blank', 'width=600,height=800');
    printWindow.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Service Receipt - Manjula Mobile World</title><style>body{font-family:Arial,sans-serif;margin:0;padding:20px;color:#111;}@media print{button{display:none!important;}}.print-btn{display:block;margin:20px auto;padding:10px 28px;background:#000;color:#fff;border:none;border-radius:6px;font-size:14px;cursor:pointer;font-family:monospace;}</style></head><body>${content.innerHTML}<br><button class="print-btn" onclick="window.print()">🖨️ PRINT</button></body></html>`);
    printWindow.document.close();
    setTimeout(() => { try { printWindow.focus(); } catch(e) {} }, 200);
  }

  // ── Helper: parse service/sale date to a Date object ──────────────────
  _parseDate(str) {
    if (!str) return null;
    if (str.includes('-')) return new Date(str);
    const p = str.split('/');
    if (p.length === 3) return new Date(`${p[2]}-${p[1]}-${p[0]}`);
    return null;
  }

  renderDailyServices() {
    const records = this.serviceRecords || [];

    // Group by date string (YYYY-MM-DD)
    const groups = {};
    records.forEach(svc => {
      const d = this._parseDate(svc.serviceDate);
      const key = d && !isNaN(d) ? d.toISOString().split('T')[0] : 'Unknown';
      if (!groups[key]) groups[key] = [];
      groups[key].push(svc);
    });

    const sortedKeys = Object.keys(groups).sort((a, b) => b.localeCompare(a));

    const fmtDate = key => {
      if (key === 'Unknown') return 'Unknown Date';
      const d = new Date(key);
      return d.toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
    };

    return `
      <div style="min-height:100vh; background-color:#f13e74fb; padding-top:96px; padding-bottom:80px;">
        <div class="container">
          <button class="back-button" data-page="admin-services" style="margin-bottom: 20px;">&#8592; Services</button>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:28px; flex-wrap:wrap; gap:12px;">
            <div>
              <h1 style="font-size:32px; font-weight:700; margin-bottom:4px;">📅 Daily Service Records</h1>
              <p style="color:#94a3b8;">Services grouped by day — ${records.length} total records</p>
            </div>
            <div style="display:flex; gap:10px; flex-wrap:wrap;">
              <button onclick="app.renderPage('admin-services-monthly')" style="padding:12px 20px; background:#1d4ed8; color:#fff; border:none; border-radius:8px; font-size:14px; font-weight:700; cursor:pointer;">📆 Monthly View</button>
              <button onclick="app.renderPage('admin-services')" style="padding:12px 20px; background:#374151; color:#fff; border:none; border-radius:8px; font-size:14px; font-weight:700; cursor:pointer;">← All Records</button>
            </div>
          </div>

          ${sortedKeys.length === 0 ? `
            <div style="text-align:center; padding:60px; color:#fff; font-size:16px;">
              <div style="font-size:48px; margin-bottom:16px;">📅</div><p>No service records yet.</p>
            </div>
          ` : sortedKeys.map(key => {
            const dayRecords = groups[key];
            const totalPrice   = dayRecords.reduce((s, r) => s + (Number(r.price)   || 0), 0);
            const totalAdvance = dayRecords.reduce((s, r) => s + (Number(r.advance) || 0), 0);
            const totalBalance = totalPrice - totalAdvance;
            return `
              <div style="background:rgba(255,255,255,0.97); border-radius:14px; margin-bottom:24px; overflow:hidden; box-shadow:0 4px 20px rgba(0,0,0,0.12);">
                <!-- Day header -->
                <div style="background:linear-gradient(135deg,#0891b2,#0e7490); padding:14px 24px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
                  <div style="font-size:16px; font-weight:800; color:#fff;">📅 ${fmtDate(key)}</div>
                  <div style="display:flex; gap:20px; flex-wrap:wrap;">
                    <div style="text-align:center;"><div style="font-size:18px; font-weight:800; color:#fff;">${dayRecords.length}</div><div style="font-size:11px; color:#cffafe;">Jobs</div></div>
                    <div style="text-align:center;"><div style="font-size:18px; font-weight:800; color:#fff;">₹${totalPrice.toLocaleString()}</div><div style="font-size:11px; color:#cffafe;">Total</div></div>
                    <div style="text-align:center;"><div style="font-size:18px; font-weight:800; color:#a7f3d0;">₹${totalAdvance.toLocaleString()}</div><div style="font-size:11px; color:#cffafe;">Advance</div></div>
                    <div style="text-align:center;"><div style="font-size:18px; font-weight:800; color:${totalBalance>0?'#fde68a':'#a7f3d0'};">₹${totalBalance.toLocaleString()}</div><div style="font-size:11px; color:#cffafe;">Balance</div></div>
                  </div>
                </div>
                <!-- Table -->
                <div style="overflow-x:auto;">
                  <table style="width:100%; border-collapse:collapse; font-size:13px;">
                    <thead>
                      <tr style="background:#ecfeff; border-bottom:2px solid #a5f3fc;">
                        <th style="padding:9px 14px; text-align:left; color:#374151;">#</th>
                        <th style="padding:9px 14px; text-align:left; color:#374151;">Customer</th>
                        <th style="padding:9px 14px; text-align:left; color:#374151;">Phone</th>
                        <th style="padding:9px 14px; text-align:left; color:#374151;">Service Details</th>
                        <th style="padding:9px 14px; text-align:left; color:#374151;">Status</th>
                        <th style="padding:9px 14px; text-align:right; color:#374151;">Price</th>
                        <th style="padding:9px 14px; text-align:right; color:#374151;">Advance</th>
                        <th style="padding:9px 14px; text-align:right; color:#374151;">Balance</th>
                        <th style="padding:9px 14px; text-align:center; color:#374151;">Bill</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${dayRecords.map((svc, i) => {
                        const p = Number(svc.price)||0, a = Number(svc.advance)||0, b = p-a;
                        return `
                          <tr style="border-bottom:1px solid #ecfeff; ${i%2===1?'background:#f0fdff;':''}">
                            <td style="padding:9px 14px; color:#9ca3af;">${i+1}</td>
                            <td style="padding:9px 14px; font-weight:600; color:#111;">${svc.customerName}</td>
                            <td style="padding:9px 14px; color:#0891b2;">${svc.phoneNumber}</td>
                            <td style="padding:9px 14px; color:#374151; max-width:200px;">${svc.serviceDetails}</td>
                            <td style="padding:9px 14px;"><span style="font-size:11px; font-weight:700; padding:2px 8px; border-radius:20px; background:#f0fdf4; color:#16a34a;">${svc.status||'Received'}</span></td>
                            <td style="padding:9px 14px; text-align:right;">${p?'₹'+p.toLocaleString():'—'}</td>
                            <td style="padding:9px 14px; text-align:right; color:#16a34a;">${a?'₹'+a.toLocaleString():'—'}</td>
                            <td style="padding:9px 14px; text-align:right; font-weight:700; color:${b>0?'#dc2626':'#16a34a'};">${p?'₹'+b.toLocaleString():'—'}</td>
                            <td style="padding:9px 14px; text-align:center;"><button onclick="app.showServiceBill('${svc.serviceId}')" style="background:#dbeafe; border:none; border-radius:6px; padding:4px 10px; cursor:pointer; color:#1d4ed8; font-size:13px;">🧾</button></td>
                          </tr>`;
                      }).join('')}
                    </tbody>
                    <tfoot>
                      <tr style="background:#ecfeff; border-top:2px solid #a5f3fc;">
                        <td colspan="5" style="padding:9px 14px; font-weight:700; color:#374151;">Day Total</td>
                        <td style="padding:9px 14px; text-align:right; font-weight:700;">₹${totalPrice.toLocaleString()}</td>
                        <td style="padding:9px 14px; text-align:right; font-weight:700; color:#16a34a;">₹${totalAdvance.toLocaleString()}</td>
                        <td style="padding:9px 14px; text-align:right; font-weight:800; color:${totalBalance>0?'#dc2626':'#16a34a'};">₹${totalBalance.toLocaleString()}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>`;
          }).join('')}
        </div>
      </div>`;
  }

  renderMonthlyServices() {
    const records = this.serviceRecords || [];

    // Group by YYYY-MM
    const groups = {};
    records.forEach(svc => {
      const d = this._parseDate(svc.serviceDate);
      const key = d && !isNaN(d)
        ? `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
        : 'Unknown';
      if (!groups[key]) groups[key] = [];
      groups[key].push(svc);
    });

    const sortedKeys = Object.keys(groups).sort((a,b) => b.localeCompare(a));
    const monthLabel = key => {
      if (key === 'Unknown') return 'Unknown Date';
      const [y, m] = key.split('-');
      return new Date(y, m-1, 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' });
    };

    return `
      <div style="min-height:100vh; background-color:#f13e74fb; padding-top:96px; padding-bottom:80px;">
        <div class="container">
          <button class="back-button" data-page="admin-services" style="margin-bottom: 20px;">&#8592; Services</button>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:28px; flex-wrap:wrap; gap:12px;">
            <div>
              <h1 style="font-size:32px; font-weight:700; margin-bottom:4px;">📆 Monthly Service Records</h1>
              <p style="color:#94a3b8;">Services grouped by month — ${records.length} total records</p>
            </div>
            <div style="display:flex; gap:10px; flex-wrap:wrap;">
              <button onclick="app.renderPage('admin-services-daily')" style="padding:12px 20px; background:#0891b2; color:#fff; border:none; border-radius:8px; font-size:14px; font-weight:700; cursor:pointer;">📅 Daily View</button>
              <button onclick="app.renderPage('admin-services')" style="padding:12px 20px; background:#374151; color:#fff; border:none; border-radius:8px; font-size:14px; font-weight:700; cursor:pointer;">← All Records</button>
            </div>
          </div>

          ${sortedKeys.length === 0 ? `
            <div style="text-align:center; padding:60px; color:#fff; font-size:16px;">
              <div style="font-size:48px; margin-bottom:16px;">📆</div><p>No service records yet.</p>
            </div>
          ` : sortedKeys.map(key => {
            const monthRecords = groups[key];
            const totalPrice   = monthRecords.reduce((s,r) => s+(Number(r.price)||0), 0);
            const totalAdvance = monthRecords.reduce((s,r) => s+(Number(r.advance)||0), 0);
            const totalBalance = totalPrice - totalAdvance;
            return `
              <div style="background:rgba(255,255,255,0.97); border-radius:14px; margin-bottom:28px; overflow:hidden; box-shadow:0 4px 20px rgba(0,0,0,0.12);">
                <!-- Month header -->
                <div style="background:linear-gradient(135deg,#1d4ed8,#1e40af); padding:16px 24px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
                  <div style="font-size:18px; font-weight:800; color:#fff;">📆 ${monthLabel(key)}</div>
                  <div style="display:flex; gap:20px; flex-wrap:wrap;">
                    <div style="text-align:center;"><div style="font-size:20px; font-weight:800; color:#fff;">${monthRecords.length}</div><div style="font-size:11px; color:#bfdbfe;">Jobs</div></div>
                    <div style="text-align:center;"><div style="font-size:20px; font-weight:800; color:#fff;">₹${totalPrice.toLocaleString()}</div><div style="font-size:11px; color:#bfdbfe;">Total Revenue</div></div>
                    <div style="text-align:center;"><div style="font-size:20px; font-weight:800; color:#a7f3d0;">₹${totalAdvance.toLocaleString()}</div><div style="font-size:11px; color:#bfdbfe;">Advance Collected</div></div>
                    <div style="text-align:center;"><div style="font-size:20px; font-weight:800; color:${totalBalance>0?'#fde68a':'#a7f3d0'};">₹${totalBalance.toLocaleString()}</div><div style="font-size:11px; color:#bfdbfe;">Balance Pending</div></div>
                  </div>
                </div>
                <!-- Table -->
                <div style="overflow-x:auto;">
                  <table style="width:100%; border-collapse:collapse; font-size:13px;">
                    <thead>
                      <tr style="background:#eff6ff; border-bottom:2px solid #bfdbfe;">
                        <th style="padding:9px 14px; text-align:left; color:#374151;">#</th>
                        <th style="padding:9px 14px; text-align:left; color:#374151;">Customer</th>
                        <th style="padding:9px 14px; text-align:left; color:#374151;">Phone</th>
                        <th style="padding:9px 14px; text-align:left; color:#374151;">Service Details</th>
                        <th style="padding:9px 14px; text-align:left; color:#374151;">Date</th>
                        <th style="padding:9px 14px; text-align:left; color:#374151;">Status</th>
                        <th style="padding:9px 14px; text-align:right; color:#374151;">Price</th>
                        <th style="padding:9px 14px; text-align:right; color:#374151;">Advance</th>
                        <th style="padding:9px 14px; text-align:right; color:#374151;">Balance</th>
                        <th style="padding:9px 14px; text-align:center; color:#374151;">Bill</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${monthRecords.map((svc, i) => {
                        const p = Number(svc.price)||0, a = Number(svc.advance)||0, b = p-a;
                        return `
                          <tr style="border-bottom:1px solid #eff6ff; ${i%2===1?'background:#f8faff;':''}">
                            <td style="padding:9px 14px; color:#9ca3af;">${i+1}</td>
                            <td style="padding:9px 14px; font-weight:600; color:#111;">${svc.customerName}</td>
                            <td style="padding:9px 14px; color:#1d4ed8;">${svc.phoneNumber}</td>
                            <td style="padding:9px 14px; color:#374151; max-width:200px;">${svc.serviceDetails}</td>
                            <td style="padding:9px 14px; color:#6b7280;">${svc.serviceDate}</td>
                            <td style="padding:9px 14px;"><span style="font-size:11px; font-weight:700; padding:2px 8px; border-radius:20px; background:#f0fdf4; color:#16a34a;">${svc.status||'Received'}</span></td>
                            <td style="padding:9px 14px; text-align:right;">${p?'₹'+p.toLocaleString():'—'}</td>
                            <td style="padding:9px 14px; text-align:right; color:#16a34a;">${a?'₹'+a.toLocaleString():'—'}</td>
                            <td style="padding:9px 14px; text-align:right; font-weight:700; color:${b>0?'#dc2626':'#16a34a'};">${p?'₹'+b.toLocaleString():'—'}</td>
                            <td style="padding:9px 14px; text-align:center;"><button onclick="app.showServiceBill('${svc.serviceId}')" style="background:#dbeafe; border:none; border-radius:6px; padding:4px 10px; cursor:pointer; color:#1d4ed8; font-size:13px;">🧾</button></td>
                          </tr>`;
                      }).join('')}
                    </tbody>
                    <tfoot>
                      <tr style="background:#eff6ff; border-top:2px solid #bfdbfe;">
                        <td colspan="6" style="padding:9px 14px; font-weight:700; color:#374151;">Month Total</td>
                        <td style="padding:9px 14px; text-align:right; font-weight:700;">₹${totalPrice.toLocaleString()}</td>
                        <td style="padding:9px 14px; text-align:right; font-weight:700; color:#16a34a;">₹${totalAdvance.toLocaleString()}</td>
                        <td style="padding:9px 14px; text-align:right; font-weight:800; color:${totalBalance>0?'#dc2626':'#16a34a'};">₹${totalBalance.toLocaleString()}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>`;
          }).join('')}
        </div>
      </div>`;
  }

  renderMonthlySales() {
    // Group sales by year-month
    const groups = {};
    this.salesRecords.forEach(sale => {
      // purchaseDate can be "YYYY-MM-DD" or "DD/MM/YYYY"
      let dateObj = null;
      if (sale.purchaseDate) {
        if (sale.purchaseDate.includes('-')) {
          dateObj = new Date(sale.purchaseDate);
        } else {
          // DD/MM/YYYY
          const parts = sale.purchaseDate.split('/');
          if (parts.length === 3) dateObj = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
        }
      }
      const key = dateObj && !isNaN(dateObj)
        ? `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`
        : 'Unknown';
      if (!groups[key]) groups[key] = [];
      groups[key].push(sale);
    });

    // Sort months descending
    const sortedKeys = Object.keys(groups).sort((a, b) => b.localeCompare(a));

    const monthLabel = (key) => {
      if (key === 'Unknown') return 'Unknown Date';
      const [y, m] = key.split('-');
      return new Date(y, m - 1, 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' });
    };

    return `
      <div style="min-height:100vh; background-color:#f13e74fb; padding-top:96px; padding-bottom:80px;">
        <div class="container">
          <button class="back-button" data-page="admin-sales" style="margin-bottom: 20px;">&#8592; Sales Records</button>
          <!-- Header -->
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:28px; flex-wrap:wrap; gap:12px;">
            <div>
              <h1 style="font-size:32px; font-weight:700; margin-bottom:4px;">📅 Monthly Sales</h1>
              <p style="color:#94a3b8;">Sales grouped by month — ${this.salesRecords.length} total records</p>
            </div>
            <div style="display:flex; gap:10px; flex-wrap:wrap;">
              <button class="btn btn-primary" onclick="app.toggleSalesForm(); app.renderPage('admin-sales')" style="padding:12px 24px;">+ Add Sale</button>
              <button onclick="app.renderPage('admin-sales')" style="padding:12px 24px; background:#374151; color:#fff; border:none; border-radius:8px; font-size:14px; font-weight:700; cursor:pointer;">← All Records</button>
            </div>
          </div>

          ${sortedKeys.length === 0 ? `
            <div style="text-align:center; padding:60px; color:#fff; font-size:16px;">
              <div style="font-size:48px; margin-bottom:16px;">📅</div>
              <p>No sales records yet.</p>
            </div>
          ` : sortedKeys.map(key => {
            const sales = groups[key];
            const totalRevenue = sales.reduce((sum, s) => sum + (Number(s.saleAmount) || 0), 0);
            const totalDiscount = sales.reduce((sum, s) => sum + (Number(s.discount) || 0), 0);
            const netRevenue = totalRevenue - totalDiscount;

            return `
              <div style="background:rgba(255,255,255,0.97); border-radius:14px; margin-bottom:28px; overflow:hidden; box-shadow:0 4px 20px rgba(0,0,0,0.12);">
                <!-- Month header -->
                <div style="background:linear-gradient(135deg,#dc2626,#b91c1c); padding:16px 24px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
                  <div style="font-size:18px; font-weight:800; color:#fff;">📅 ${monthLabel(key)}</div>
                  <div style="display:flex; gap:20px; flex-wrap:wrap;">
                    <div style="text-align:center;">
                      <div style="font-size:20px; font-weight:800; color:#fff;">${sales.length}</div>
                      <div style="font-size:11px; color:#fecaca;">Sales</div>
                    </div>
                    <div style="text-align:center;">
                      <div style="font-size:20px; font-weight:800; color:#fff;">₹${netRevenue.toLocaleString()}</div>
                      <div style="font-size:11px; color:#fecaca;">Net Revenue</div>
                    </div>
                    ${totalDiscount > 0 ? `
                    <div style="text-align:center;">
                      <div style="font-size:20px; font-weight:800; color:#fde68a;">₹${totalDiscount.toLocaleString()}</div>
                      <div style="font-size:11px; color:#fecaca;">Discounts</div>
                    </div>` : ''}
                  </div>
                </div>

                <!-- Sales table -->
                <div style="overflow-x:auto;">
                  <table style="width:100%; border-collapse:collapse; font-size:13px;">
                    <thead>
                      <tr style="background:#fef2f2; border-bottom:2px solid #fecaca;">
                        <th style="padding:10px 16px; text-align:left; color:#374151; font-weight:700;">#</th>
                        <th style="padding:10px 16px; text-align:left; color:#374151; font-weight:700;">Customer</th>
                        <th style="padding:10px 16px; text-align:left; color:#374151; font-weight:700;">Phone</th>
                        <th style="padding:10px 16px; text-align:left; color:#374151; font-weight:700;">Product</th>
                        <th style="padding:10px 16px; text-align:left; color:#374151; font-weight:700;">Date</th>
                        <th style="padding:10px 16px; text-align:right; color:#374151; font-weight:700;">Amount</th>
                        <th style="padding:10px 16px; text-align:right; color:#374151; font-weight:700;">Discount</th>
                        <th style="padding:10px 16px; text-align:right; color:#374151; font-weight:700;">Net</th>
                        <th style="padding:10px 16px; text-align:center; color:#374151; font-weight:700;">Bill</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${sales.map((sale, idx) => {
                        const amt = Number(sale.saleAmount) || 0;
                        const disc = Number(sale.discount) || 0;
                        const net = amt - disc;
                        return `
                          <tr style="border-bottom:1px solid #fef2f2; ${idx % 2 === 1 ? 'background:#fffbfb;' : ''}">
                            <td style="padding:10px 16px; color:#9ca3af;">${idx + 1}</td>
                            <td style="padding:10px 16px; font-weight:600; color:#111;">${sale.customerName}</td>
                            <td style="padding:10px 16px; color:#dc2626;">${sale.phoneNumber}</td>
                            <td style="padding:10px 16px; color:#374151;">${sale.productName}</td>
                            <td style="padding:10px 16px; color:#6b7280;">${sale.purchaseDate}</td>
                            <td style="padding:10px 16px; text-align:right; color:#374151;">${amt ? '₹' + amt.toLocaleString() : '—'}</td>
                            <td style="padding:10px 16px; text-align:right; color:#16a34a;">${disc ? '₹' + disc.toLocaleString() : '—'}</td>
                            <td style="padding:10px 16px; text-align:right; font-weight:700; color:#dc2626;">${amt ? '₹' + net.toLocaleString() : '—'}</td>
                            <td style="padding:10px 16px; text-align:center;">
                              <div style="display:flex;gap:6px;justify-content:center;">
                                <button onclick="app.showEditSaleModal('${sale.saleId}')" style="background:#16a34a; border:none; border-radius:8px; padding:6px 12px; cursor:pointer; color:#fff; font-size:13px; font-weight:700;" title="Edit">✏️ Edit</button>
                                <button onclick="app.printBill('${sale.saleId}')" style="background:#1d4ed8; border:none; border-radius:8px; padding:6px 12px; cursor:pointer; color:#fff; font-size:13px; font-weight:700;" title="Print Receipt">🧾 Print</button>
                                <button onclick="app.shareSaleWhatsApp('${sale.saleId}')" style="background:#25d366; border:none; border-radius:8px; padding:6px 12px; cursor:pointer; color:#fff; font-size:13px; font-weight:700;" title="WhatsApp">💬</button>
                              </div>
                            </td>
                          </tr>
                        `;
                      }).join('')}
                    </tbody>
                    <!-- Month total row -->
                    <tfoot>
                      <tr style="background:#fef2f2; border-top:2px solid #fecaca;">
                        <td colspan="5" style="padding:10px 16px; font-weight:700; color:#374151;">Month Total</td>
                        <td style="padding:10px 16px; text-align:right; font-weight:700; color:#374151;">₹${totalRevenue.toLocaleString()}</td>
                        <td style="padding:10px 16px; text-align:right; font-weight:700; color:#16a34a;">₹${totalDiscount.toLocaleString()}</td>
                        <td style="padding:10px 16px; text-align:right; font-weight:800; color:#dc2626; font-size:14px;">₹${netRevenue.toLocaleString()}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  toggleSalesForm() {
    const form = document.getElementById('salesForm');
    if (!form) return;
    const isHidden = form.style.display === 'none';
    form.style.display = isHidden ? 'block' : 'none';
    if (isHidden) {
      // Seed one empty product row when opening
      const container = document.getElementById('sale_items_container');
      if (container && container.children.length === 0) {
        this.addSaleProductRow();
      }
      this.updateBillPreview();
    }
  }

  // Generate a unique row ID
  _saleRowId() {
    return 'row_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
  }

  addSaleProductRow() {
    const container = document.getElementById('sale_items_container');
    if (!container) return;
    const rowId = this._saleRowId();
    const rowHtml = `
      <div id="${rowId}" style="display:grid; grid-template-columns:2fr 1.2fr 0.8fr 1fr 1fr 32px; gap:6px; margin-bottom:6px; align-items:start;">
        <div style="position:relative;">
          <input class="input sp_name" data-row="${rowId}" placeholder="Type to search products..."
            style="width:100%; font-size:13px; color:#111; background:#fff; border:1px solid #d1d5db;"
            autocomplete="off"
            oninput="app.showRowProductSuggestions(this, '${rowId}')"
            onblur="setTimeout(()=>{ const d=document.getElementById('dd_${rowId}'); if(d) d.style.display='none'; }, 150)">
          <div id="dd_${rowId}" style="display:none; position:absolute; top:100%; left:0; right:0; background:#fff; border:2px solid #dc2626; border-radius:8px; max-height:180px; overflow-y:auto; z-index:9999; box-shadow:0 4px 12px rgba(0,0,0,0.15);"></div>
        </div>
        <input class="input sp_cat" data-row="${rowId}" placeholder="Category" readonly
          style="width:100%; font-size:13px; background:#f9fafb; color:#6b7280; border:1px solid #e5e7eb;">
        <input class="input sp_qty" data-row="${rowId}" type="number" placeholder="1" min="1" value="1"
          style="width:100%; font-size:13px; color:#111; border:1px solid #d1d5db;"
          oninput="app.updateBillPreview()">
        <input class="input sp_amount" data-row="${rowId}" type="number" placeholder="Amount" min="0"
          style="width:100%; font-size:13px; color:#111; border:1px solid #d1d5db;"
          oninput="app.updateBillPreview()">
        <input class="input sp_discount" data-row="${rowId}" type="number" placeholder="0" min="0" value="0"
          style="width:100%; font-size:13px; color:#111; border:1px solid #d1d5db;"
          oninput="app.updateBillPreview()">
        <button type="button" onclick="app.removeSaleProductRow('${rowId}')"
          style="background:#fee2e2; color:#dc2626; border:1px solid #fca5a5; border-radius:6px; width:28px; height:34px; font-size:16px; cursor:pointer; display:flex; align-items:center; justify-content:center; padding:0; flex-shrink:0;">
          ×
        </button>
      </div>`;
    container.insertAdjacentHTML('beforeend', rowHtml);
    // Focus the name input of the new row
    const newRow = document.getElementById(rowId);
    if (newRow) newRow.querySelector('.sp_name')?.focus();
    this.updateBillPreview();
  }

  removeSaleProductRow(rowId) {
    const row = document.getElementById(rowId);
    if (!row) return;
    // Always keep at least 1 row
    const container = document.getElementById('sale_items_container');
    if (container && container.children.length <= 1) {
      alert('You need at least one product.');
      return;
    }
    row.remove();
    this.updateBillPreview();
  }

  showRowProductSuggestions(input, rowId) {
    const query = input.value.toLowerCase();
    const dropdown = document.getElementById(`dd_${rowId}`);
    if (!dropdown) return;

    if (!query) { dropdown.style.display = 'none'; return; }

    const matches = (this.products || []).filter(p =>
      p.name?.toLowerCase().includes(query) || p.category?.toLowerCase().includes(query)
    ).slice(0, 8);

    if (matches.length === 0) { dropdown.style.display = 'none'; return; }

    dropdown.innerHTML = matches.map(p => `
      <div onmousedown="app.selectRowProduct('${rowId}', '${(p.name || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'")}', '${(p.category || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'")}', ${Number(p.price) || 0})"
        style="padding:10px 14px; cursor:pointer; border-bottom:1px solid #f3f4f6; font-size:13px; display:flex; justify-content:space-between; align-items:center;"
        onmouseover="this.style.background='#fef2f2'" onmouseout="this.style.background='#fff'">
        <span style="font-weight:600; color:#111;">${p.name || '—'}</span>
        <span style="color:#16a34a; font-weight:700; font-size:12px;">${p.price ? '₹' + Number(p.price).toLocaleString('en-IN') : ''}</span>
      </div>
    `).join('');
    dropdown.style.display = 'block';
  }

  selectRowProduct(rowId, name, category, price) {
    const row = document.getElementById(rowId);
    if (!row) return;
    const nameInput     = row.querySelector('.sp_name');
    const catInput      = row.querySelector('.sp_cat');
    const amountInput   = row.querySelector('.sp_amount');
    const dropdown      = document.getElementById(`dd_${rowId}`);

    if (nameInput)   nameInput.value   = name;
    if (catInput)    catInput.value    = category;
    if (amountInput) amountInput.value = price || '';
    if (dropdown)    dropdown.style.display = 'none';

    this.updateBillPreview();
  }

  async saveSaleRecord() {
    const customerName = document.getElementById('sale_customerName')?.value?.trim();
    const phoneNumber  = document.getElementById('sale_phoneNumber')?.value?.trim();
    const purchaseDate = document.getElementById('sale_purchaseDate')?.value;

    if (!customerName || !phoneNumber || !purchaseDate) {
      alert('Please fill in Customer Name, Phone Number and Purchase Date.');
      return;
    }

    // Collect all product rows
    const container = document.getElementById('sale_items_container');
    const rows = container ? Array.from(container.children) : [];
    const items = rows.map(row => ({
      name:     (row.querySelector('.sp_name')?.value || '').trim(),
      category: (row.querySelector('.sp_cat')?.value  || '').trim(),
      quantity: Number(row.querySelector('.sp_qty')?.value)      || 1,
      amount:   Number(row.querySelector('.sp_amount')?.value)   || 0,
      discount: Number(row.querySelector('.sp_discount')?.value) || 0
    })).filter(i => i.name);

    if (items.length === 0) {
      alert('Please add at least one product.');
      return;
    }

    // Build combined fields for backward-compat storage
    const productName = items.map(i => i.quantity > 1 ? `${i.name} (x${i.quantity})` : i.name).join(', ');
    const totalAmount = items.reduce((s, i) => s + (i.amount * i.quantity), 0);
    const totalDiscount = items.reduce((s, i) => s + (i.discount * i.quantity), 0);

    const saleData = {
      customerName,
      phoneNumber,
      customerAddress: document.getElementById('sale_customerAddress')?.value?.trim(),
      productName,
      productItems: items,         // full multi-item array
      saleAmount:  totalAmount   || null,
      discount:    totalDiscount || null,
      purchaseDate,
      warrantyPeriod: document.getElementById('sale_warrantyPeriod')?.value,
      notes: document.getElementById('sale_notes')?.value?.trim()
    };

    try {
      const response = await fetch(`${this.API_URL}/sales`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(saleData)
      });
      if (response.ok) {
        const saved = await response.json();
        this.salesRecords.unshift(saved);
        alert('✅ Sale record saved successfully!');
        this.renderPage('admin-sales');
      } else {
        alert('❌ Failed to save sale record.');
      }
    } catch (error) {
      console.error('Error saving sale:', error);
      alert('❌ Error saving sale record.');
    }
  }

  updateBillPreview() {
    const container = document.getElementById('sale_items_container');
    let total = 0;
    if (container) {
      Array.from(container.children).forEach(row => {
        const qty      = Number(row.querySelector('.sp_qty')?.value)      || 1;
        const amount   = Number(row.querySelector('.sp_amount')?.value)   || 0;
        const discount = Number(row.querySelector('.sp_discount')?.value) || 0;
        total += Math.max(0, (amount - discount) * qty);
      });
    }
    const el = document.getElementById('bill_preview_total');
    if (el) el.textContent = `₹${total.toLocaleString('en-IN')}`;
  }

  showEditSaleModal(saleId) {
    const sale = this.salesRecords.find(s => s.saleId === saleId);
    if (!sale) return;

    const existing = document.getElementById('editSaleModal');
    if (existing) existing.remove();

    const modalHTML = `
      <div id="editSaleModal" onclick="if(event.target===this)this.remove()"
        style="position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;">
        <div style="background:#fff;border-radius:14px;padding:28px;max-width:520px;width:100%;max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.4);">
          <h3 style="font-size:18px;font-weight:800;color:#111;margin-bottom:20px;">✏️ Edit Sale Record</h3>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;">
            <div>
              <label style="font-size:12px;font-weight:600;color:#374151;display:block;margin-bottom:4px;">Customer Name *</label>
              <input id="es_customerName" class="input" value="${sale.customerName || ''}" style="width:100%;color:#111;background:#f8fafc;border:1px solid #d1d5db;">
            </div>
            <div>
              <label style="font-size:12px;font-weight:600;color:#374151;display:block;margin-bottom:4px;">Phone Number *</label>
              <input id="es_phoneNumber" class="input" value="${sale.phoneNumber || ''}" style="width:100%;color:#111;background:#f8fafc;border:1px solid #d1d5db;">
            </div>
            <div style="grid-column:1/-1;">
              <label style="font-size:12px;font-weight:600;color:#374151;display:block;margin-bottom:4px;">Address</label>
              <input id="es_customerAddress" class="input" value="${sale.customerAddress || ''}" style="width:100%;color:#111;background:#f8fafc;border:1px solid #d1d5db;">
            </div>
            <div>
              <label style="font-size:12px;font-weight:600;color:#374151;display:block;margin-bottom:4px;">Product Name *</label>
              <input id="es_productName" class="input" value="${sale.productName || ''}" style="width:100%;color:#111;background:#f8fafc;border:1px solid #d1d5db;">
            </div>
            <div>
              <label style="font-size:12px;font-weight:600;color:#374151;display:block;margin-bottom:4px;">Sale Amount (₹)</label>
              <input id="es_saleAmount" class="input" type="number" value="${sale.saleAmount || ''}" style="width:100%;color:#111;background:#f8fafc;border:1px solid #d1d5db;">
            </div>
            <div>
              <label style="font-size:12px;font-weight:600;color:#374151;display:block;margin-bottom:4px;">Discount (₹)</label>
              <input id="es_discount" class="input" type="number" value="${sale.discount || ''}" placeholder="0" style="width:100%;color:#111;background:#f8fafc;border:1px solid #d1d5db;">
            </div>
            <div>
              <label style="font-size:12px;font-weight:600;color:#374151;display:block;margin-bottom:4px;">Purchase Date *</label>
              <input id="es_purchaseDate" class="input" type="date" value="${sale.purchaseDate || ''}" style="width:100%;color:#111;background:#f8fafc;border:1px solid #d1d5db;">
            </div>
            <div>
              <label style="font-size:12px;font-weight:600;color:#374151;display:block;margin-bottom:4px;">Warranty Period</label>
              <select id="es_warrantyPeriod" class="input" style="width:100%;color:#111;background:#f8fafc;border:1px solid #d1d5db;">
                <option value="" ${!sale.warrantyPeriod ? 'selected' : ''}>No Warranty</option>
                <option value="1 Month" ${sale.warrantyPeriod === '1 Month' ? 'selected' : ''}>1 Month</option>
                <option value="3 Months" ${sale.warrantyPeriod === '3 Months' ? 'selected' : ''}>3 Months</option>
                <option value="6 Months" ${sale.warrantyPeriod === '6 Months' ? 'selected' : ''}>6 Months</option>
                <option value="1 Year" ${sale.warrantyPeriod === '1 Year' ? 'selected' : ''}>1 Year</option>
                <option value="2 Years" ${sale.warrantyPeriod === '2 Years' ? 'selected' : ''}>2 Years</option>
              </select>
            </div>
            <div style="grid-column:1/-1;">
              <label style="font-size:12px;font-weight:600;color:#374151;display:block;margin-bottom:4px;">Notes</label>
              <textarea id="es_notes" class="input" rows="2" style="width:100%;color:#111;background:#f8fafc;border:1px solid #d1d5db;resize:vertical;">${sale.notes || ''}</textarea>
            </div>
          </div>
          <div style="display:flex;gap:10px;margin-top:20px;">
            <button onclick="app.saveEditSale('${sale.saleId}')"
              style="flex:1;background:#16a34a;color:#fff;border:none;border-radius:8px;padding:11px;font-size:14px;font-weight:700;cursor:pointer;">
              💾 Save Changes
            </button>
            <button onclick="document.getElementById('editSaleModal').remove()"
              style="flex:1;background:#f1f5f9;color:#374151;border:1px solid #d1d5db;border-radius:8px;padding:11px;font-size:14px;font-weight:600;cursor:pointer;">
              ✕ Cancel
            </button>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
  }

  async saveEditSale(saleId) {
    const customerName  = document.getElementById('es_customerName')?.value?.trim();
    const phoneNumber   = document.getElementById('es_phoneNumber')?.value?.trim();
    const productName   = document.getElementById('es_productName')?.value?.trim();
    const purchaseDate  = document.getElementById('es_purchaseDate')?.value;

    if (!customerName || !phoneNumber || !productName || !purchaseDate) {
      alert('Please fill in Customer Name, Phone, Product Name and Date.');
      return;
    }

    const updatedData = {
      customerName,
      phoneNumber,
      customerAddress: document.getElementById('es_customerAddress')?.value?.trim(),
      productName,
      saleAmount:      document.getElementById('es_saleAmount')?.value || null,
      discount:        document.getElementById('es_discount')?.value || null,
      purchaseDate,
      warrantyPeriod:  document.getElementById('es_warrantyPeriod')?.value,
      notes:           document.getElementById('es_notes')?.value?.trim()
    };

    try {
      const response = await fetch(`${this.API_URL}/sales/${saleId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedData)
      });
      if (response.ok) {
        const updated = await response.json();
        const idx = this.salesRecords.findIndex(s => s.saleId === saleId);
        if (idx !== -1) this.salesRecords[idx] = updated;
        document.getElementById('editSaleModal')?.remove();
        this.renderPage('admin-sales');
      } else {
        alert('❌ Failed to update sale record.');
      }
    } catch (err) {
      console.error(err);
      alert('❌ Error updating sale record.');
    }
  }

  showBillModal(saleId) {
    const sale = this.salesRecords.find(s => s.saleId === saleId);
    if (!sale) return;

    const amount   = Number(sale.saleAmount) || 0;
    const discount = Number(sale.discount) || 0;
    const net      = amount - discount;

    const receiptStyle = `
      font-family: Arial, 'Helvetica Neue', sans-serif;
      font-size: 12px;
      width: 300px;
      color: #000;
      background: #fff;
      padding: 16px;
      line-height: 1.5;
    `;

    const billHTML = `
      <div id="billModal" onclick="if(event.target===this)app.closeBillModal()" style="position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;">
        <div style="background:#fff;border-radius:8px;max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.5);">

          <!-- Thermal Receipt Preview -->
          <div id="billContent" style="${receiptStyle}">

            <!-- Header -->
            <div style="text-align:center;">
              <div style="font-size:15px;font-weight:bold;">MANJULA MOBILE WORLD</div>
              <div style="font-size:10px;margin-top:2px;">The Final World of Mobile Solution</div>
              <div style="font-size:10px;">Ramapuram, Tamil Nadu - 603201</div>
              <div style="font-size:10px;">Ph: +91 82484 54841</div>
              <div style="font-size:10px;">manjulamobiles125@gmail.com</div>
            </div>

            <div style="border-top:1px solid #000;margin:6px 0;"></div>
            <div style="text-align:center;font-weight:bold;font-size:12px;letter-spacing:1px;">** SALES RECEIPT **</div>
            <div style="text-align:center;font-size:10px;">Date: ${sale.purchaseDate || new Date().toLocaleDateString('en-IN')}</div>
            <div style="text-align:center;font-size:10px;">Bill No: ${sale.saleId}</div>
            <div style="border-top:1px dashed #000;margin:6px 0;"></div>

            <!-- Customer -->
            <div style="font-weight:bold;margin-bottom:3px;">CUSTOMER DETAILS</div>
            <div style="display:flex;justify-content:space-between;"><span>Name</span><span style="font-weight:bold;text-align:right;max-width:55%;word-break:break-word;">${sale.customerName}</span></div>
            <div style="display:flex;justify-content:space-between;"><span>Phone</span><span style="font-weight:bold;">${sale.phoneNumber || '-'}</span></div>
            ${sale.customerAddress ? `<div style="display:flex;justify-content:space-between;"><span>Address</span><span style="font-weight:bold;text-align:right;max-width:55%;word-break:break-word;">${sale.customerAddress}</span></div>` : ''}

            <div style="border-top:1px dashed #000;margin:6px 0;"></div>

            <!-- Product -->
            <div style="font-weight:bold;margin-bottom:3px;">PRODUCT DETAILS</div>
            ${
              sale.productItems && sale.productItems.length > 0
                ? sale.productItems.map((it, idx) => {
                    const qty = Number(it.quantity) || 1;
                    const qtyStr = qty > 1 ? ` (x${qty})` : '';
                    return `
                      <div style="display:flex;justify-content:space-between;margin-bottom:2px;">
                        <span style="max-width:65%;word-break:break-word;">${it.name}${qtyStr}</span>
                        <span style="font-weight:bold;">Rs.${(it.amount * qty).toLocaleString('en-IN')}</span>
                      </div>
                    `;
                  }).join('')
                : `<div style="display:flex;justify-content:space-between;"><span>Product</span><span style="font-weight:bold;text-align:right;max-width:55%;word-break:break-word;">${sale.productName}</span></div>`
            }
            ${sale.productModel ? `<div style="display:flex;justify-content:space-between;"><span>Model</span><span style="font-weight:bold;">${sale.productModel}</span></div>` : ''}
            ${sale.warrantyPeriod ? `<div style="display:flex;justify-content:space-between;"><span>Warranty</span><span style="font-weight:bold;">${sale.warrantyPeriod}</span></div>` : ''}

            <div style="border-top:1px dashed #000;margin:6px 0;"></div>

            <!-- Amount -->
            <div style="display:flex;justify-content:space-between;"><span>Price</span><span style="font-weight:bold;">Rs.${amount.toLocaleString('en-IN')}</span></div>
            ${discount > 0 ? `<div style="display:flex;justify-content:space-between;"><span>Discount</span><span style="font-weight:bold;">- Rs.${discount.toLocaleString('en-IN')}</span></div>` : ''}

            <div style="border-top:1px solid #000;margin:6px 0;"></div>
            <div style="display:flex;justify-content:space-between;font-size:14px;font-weight:bold;">
              <span>NET PAYABLE</span><span>Rs.${net.toLocaleString('en-IN')}</span>
            </div>
            <div style="border-top:1px solid #000;margin:6px 0;"></div>

            ${sale.notes ? `
            <div style="font-size:10px;margin:4px 0;">
              <div style="font-weight:bold;">Notes:</div>
              <div>${sale.notes}</div>
            </div>
            <div style="border-top:1px dashed #000;margin:6px 0;"></div>` : ''}

            <!-- Footer -->
            <div style="text-align:center;font-size:10px;margin-top:6px;">
              <div>Mon-Sun: 9:00 AM - 10:00 PM</div>
              <div>24/7 Emergency Service Available</div>
              <div style="margin-top:4px;">*** Thank You! Visit Again ***</div>
              <div style="margin-top:2px;">manjulamobilesworld.onrender.com</div>
            </div>

          </div>

          <!-- Action buttons -->
          <div style="display:flex;gap:12px;padding:12px 16px;border-top:1px solid #e5e7eb;">
            <button onclick="app.printBill('${sale.saleId}')" style="flex:1;background:#000;color:#fff;border:none;border-radius:6px;padding:10px;font-size:14px;font-weight:700;cursor:pointer;font-family:monospace;">🖨️ PRINT</button>
            <button onclick="app.closeBillModal()" style="flex:1;background:#f1f5f9;color:#374151;border:none;border-radius:6px;padding:10px;font-size:14px;font-weight:600;cursor:pointer;">✕ Close</button>
          </div>
        </div>
      </div>
    `;

    const existing = document.getElementById('billModal');
    if (existing) existing.remove();
    document.body.insertAdjacentHTML('beforeend', billHTML);
  }

  printBill(saleId) {
    const sale = this.salesRecords.find(s => s.saleId === saleId);
    if (!sale) return;

    const amount   = Number(sale.saleAmount) || 0;
    const discount = Number(sale.discount) || 0;
    const net      = amount - discount;

    const win = window.open('', '_blank', 'width=400,height=700');
    win.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Sales Receipt - ${sale.saleId}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    @page {
      size: 80mm auto;
      margin: 3mm 2mm;
    }
    html, body {
      font-family: Arial, 'Helvetica Neue', sans-serif;
      font-size: 13px;
      font-weight: 800;
      width: 76mm;
      color: #000;
      background: #fff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .center { text-align: center; }
    .bold { font-weight: 900; }
    .large { font-size: 15px; font-weight: 900; }
    .xlarge { font-size: 19px; font-weight: 900; letter-spacing: 0.5px; }
    .divider { border-top: 1.5px dashed #000; margin: 4px 0; }
    .divider-solid { border-top: 2.5px solid #000; margin: 4px 0; }
    .row { display: flex; justify-content: space-between; margin: 3px 0; font-size: 13px; }
    .label { color: #000; font-weight: 700; }
    .value { font-weight: 900; text-align: right; max-width: 55%; word-break: break-word; color: #000; }
    .amount-row { display: flex; justify-content: space-between; font-size: 16px; font-weight: 900; margin: 4px 0; color: #000; letter-spacing: 0.5px; }
    .footer { font-size: 11px; text-align: center; margin-top: 6px; color: #000; font-weight: 700; line-height: 1.7; }
    @media print {
      html, body { color: #000 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      * { color: #000 !important; }
      button { display: none !important; }
    }
  </style>
</head>
<body>

  <!-- Shop Header -->
  <div class="center">
    <div class="xlarge bold">MANJULA MOBILE WORLD</div>
    <div style="font-size:10px; margin-top:2px; font-weight:700;">The Final World of Mobile Solution</div>
    <div style="font-size:10px; font-weight:700;">Ramapuram, Tamil Nadu - 603201</div>
    <div style="font-size:10px;">Ph: +91 82484 54841</div>
    <div style="font-size:10px;">manjulamobiles125@gmail.com</div>
  </div>

  <div class="divider-solid"></div>

  <div class="center bold" style="font-size:12px; letter-spacing:1px;">** SALES RECEIPT **</div>
  <div class="center" style="font-size:10px;">Date: ${sale.purchaseDate || new Date().toLocaleDateString('en-IN')}</div>
  <div class="center" style="font-size:10px;">Bill No: ${sale.saleId}</div>

  <div class="divider"></div>

  <!-- Customer Details -->
  <div class="bold" style="margin-bottom:3px;">CUSTOMER DETAILS</div>
  <div class="row"><span class="label">Name</span><span class="value">${sale.customerName}</span></div>
  <div class="row"><span class="label">Phone</span><span class="value">${sale.phoneNumber || '-'}</span></div>
  ${sale.customerAddress ? `<div class="row"><span class="label">Address</span><span class="value">${sale.customerAddress}</span></div>` : ''}

  <div class="divider"></div>

  <!-- Product Details -->
  <div class="bold" style="margin-bottom:3px;">PRODUCT DETAILS</div>
  <div class="row"><span class="label">Product</span><span class="value">${sale.productName}</span></div>
  ${sale.productModel ? `<div class="row"><span class="label">Model</span><span class="value">${sale.productModel}</span></div>` : ''}
  ${sale.warrantyPeriod ? `<div class="row"><span class="label">Warranty</span><span class="value">${sale.warrantyPeriod}</span></div>` : ''}

  <div class="divider"></div>

  <!-- Amount -->
  <div class="row"><span class="label">Price</span><span class="value">Rs.${amount.toLocaleString('en-IN')}</span></div>
  ${discount > 0 ? `<div class="row"><span class="label">Discount</span><span class="value">- Rs.${discount.toLocaleString('en-IN')}</span></div>` : ''}

  <div class="divider-solid"></div>

  <div class="row amount-row">
    <span>NET PAYABLE</span>
    <span>Rs.${net.toLocaleString('en-IN')}</span>
  </div>

  <div class="divider-solid"></div>

  ${sale.notes ? `
  <div style="font-size:10px; margin: 4px 0;">
    <div class="bold">Notes:</div>
    <div>${sale.notes}</div>
  </div>
  <div class="divider"></div>
  ` : ''}

  <div class="footer">
    <div>Mon-Sun: 9:00 AM - 10:00 PM</div>
    <div>24/7 Emergency Service Available</div>
    <div style="margin-top:4px;">*** Thank You! Visit Again ***</div>
    <div style="margin-top:2px;">manjulamobilesworld.onrender.com</div>
  </div>

  <br>
  <div style="text-align:center;">
    <button onclick="window.print()" style="padding:8px 20px; background:#000; color:#fff; border:none; border-radius:4px; font-size:13px; cursor:pointer; font-family:monospace;">🖨️ PRINT</button>
  </div>

</div><!-- /.receipt -->
</body>
</html>`);
    win.document.close();
    // Focus the window — user clicks the PRINT button inside to trigger printer dialog
    setTimeout(() => { try { win.focus(); } catch(e) {} }, 200);
  }

  async deleteSaleRecord(saleId) {
    if (!confirm('Delete this sale record?')) return;
    try {
      const response = await fetch(`${this.API_URL}/sales/${saleId}`, { method: 'DELETE' });
      if (response.ok) {
        this.salesRecords = this.salesRecords.filter(s => s.saleId !== saleId);
        this.renderPage('admin-sales');
        alert('✅ Sale record deleted.');
      }
    } catch (error) {
      console.error('Error deleting sale:', error);
    }
  }

  async shareSaleWhatsApp(saleId) {
    const sale = this.salesRecords.find(s => s.saleId === saleId);
    if (!sale) return;

    const amount   = Number(sale.saleAmount) || 0;
    const discount = Number(sale.discount)   || 0;
    const net      = amount - discount;

    const items = sale.productItems && sale.productItems.length > 0
      ? sale.productItems
      : [{ name: sale.productName, category: '', amount: amount, discount: discount }];

    // ── Build PDF using jsPDF ─────────────────────────────────────────────
    const { jsPDF } = window.jspdf;
    if (!jsPDF) { alert('PDF library not loaded yet. Please try again in a moment.'); return; }

    const doc = new jsPDF({ unit: 'mm', format: [80, 200], orientation: 'portrait' });
    const W = 80;
    let y = 6;

    const centerText = (text, size, bold) => {
      doc.setFontSize(size);
      doc.setFont('courier', bold ? 'bold' : 'normal');
      doc.text(text, W / 2, y, { align: 'center' });
      y += size * 0.45 + 1;
    };
    const rowText = (label, value, size = 9) => {
      doc.setFontSize(size); doc.setFont('courier', 'normal');
      doc.text(label, 4, y);
      doc.setFont('courier', 'bold');
      doc.text(value, W - 4, y, { align: 'right' });
      y += size * 0.4 + 1.5;
    };
    const dashed = () => {
      doc.setLineDashPattern([1, 1], 0); doc.setDrawColor(0); doc.setLineWidth(0.3);
      doc.line(4, y, W - 4, y); y += 3;
    };
    const solid = () => {
      doc.setLineDashPattern([], 0); doc.setLineWidth(0.5);
      doc.line(4, y, W - 4, y); y += 3;
    };

    centerText('MANJULA MOBILE WORLD', 11, true);
    centerText('The Final World of Mobile Solution', 7, false);
    centerText('Ramapuram, Tamil Nadu - 603201', 7, false);
    centerText('Ph: +91 82484 54841', 7, false);
    centerText('manjulamobiles125@gmail.com', 7, false);
    y += 1; solid();
    centerText('** SALES RECEIPT **', 9, true); y += 1;
    doc.setFontSize(8); doc.setFont('courier', 'normal');
    doc.text('Date: ' + (sale.purchaseDate || new Date().toLocaleDateString('en-IN')), 4, y); y += 4;
    doc.text('Bill No: ' + sale.saleId, 4, y); y += 4;
    dashed();
    doc.setFontSize(9); doc.setFont('courier', 'bold');
    doc.text('CUSTOMER DETAILS', 4, y); y += 5;
    rowText('Name', sale.customerName);
    rowText('Phone', sale.phoneNumber || '-');
    if (sale.customerAddress) rowText('Address', sale.customerAddress);
    dashed();
    doc.setFontSize(9); doc.setFont('courier', 'bold');
    doc.text('PRODUCT DETAILS', 4, y); y += 5;
    items.forEach((it, i) => {
      const itAmt = Number(it.amount || 0), itDisc = Number(it.discount || 0);
      const qty = Number(it.quantity) || 1;
      const qtyStr = qty > 1 ? ` (x${qty})` : '';
      rowText(`${i + 1}. ${it.name || '—'}${qtyStr}`, 'Rs.' + (itAmt * qty).toLocaleString('en-IN'));
      if (itDisc > 0) rowText('   Discount', '- Rs.' + (itDisc * qty).toLocaleString('en-IN'));
    });
    if (sale.warrantyPeriod) rowText('Warranty', sale.warrantyPeriod);
    dashed();
    if (discount > 0) {
      rowText('Sub-Total', 'Rs.' + amount.toLocaleString('en-IN'));
      rowText('Discount',  '- Rs.' + discount.toLocaleString('en-IN'));
    }
    solid();
    doc.setFontSize(11); doc.setFont('courier', 'bold');
    doc.text('NET PAYABLE', 4, y);
    doc.text('Rs.' + net.toLocaleString('en-IN'), W - 4, y, { align: 'right' });
    y += 6; solid();
    if (sale.notes) {
      doc.setFontSize(8); doc.setFont('courier', 'normal');
      doc.text('Notes: ' + sale.notes, 4, y); y += 5; dashed();
    }
    centerText('Mon-Sun: 9:00 AM - 10:00 PM', 7, false);
    centerText('24/7 Emergency Service Available', 7, false);
    y += 1;
    centerText('*** Thank You! Visit Again ***', 8, true);
    centerText('manjulamobilesworld-whwt.onrender.com', 7, false);

    // ── Share caption text ────────────────────────────────────────────────
    const productList = items.map(it => it.name).join(', ');
    const caption = [
      '*MANJULA MOBILE WORLD*',
      '_Ramapuram, Tamil Nadu | +91 82484 54841_',
      '',
      'Dear *' + sale.customerName + '*,',
      'Thank you for your purchase!',
      '',
      'Bill No: ' + sale.saleId,
      'Date: ' + (sale.purchaseDate || new Date().toLocaleDateString('en-IN')),
      'Product: ' + productList,
      sale.warrantyPeriod ? 'Warranty: ' + sale.warrantyPeriod : null,
      '*Net Payable: \u20B9' + net.toLocaleString('en-IN') + '*',
      '',
      'Visit us: https://manjulamobilesworld-whwt.onrender.com'
    ].filter(Boolean).join('\n');

    const fileName = `receipt-${sale.saleId}.pdf`;

    // Build the direct WhatsApp link for this customer's number
    let phone = (sale.phoneNumber || '').replace(/\D/g, '');
    if (phone.length === 10) phone = '91' + phone;
    else if (phone.startsWith('0')) phone = '91' + phone.slice(1);
    const waUrl = 'https://wa.me/' + phone + '?text=' + encodeURIComponent(caption);

    // ── On mobile: share PDF via Web Share API, then open the customer's WhatsApp chat ──
    if (navigator.canShare) {
      try {
        const pdfBlob = doc.output('blob');
        const file = new File([pdfBlob], fileName, { type: 'application/pdf' });
        if (navigator.canShare({ files: [file] })) {
          // Open customer's WhatsApp chat directly first
          window.open(waUrl, '_blank');
          // Then trigger file share so owner can attach the PDF
          setTimeout(async () => {
            try { await navigator.share({ files: [file], title: 'Receipt - ' + sale.saleId }); }
            catch(e) { if (e.name !== 'AbortError') doc.save(fileName); }
          }, 500);
          return;
        }
      } catch (err) {
        if (err.name !== 'AbortError') console.warn('Share API error:', err);
      }
    }

    // ── Fallback (desktop): download PDF + open customer's WhatsApp chat directly ──
    doc.save(fileName);
    setTimeout(() => { window.open(waUrl, '_blank'); }, 600);
  }

  printTrackingCard(qrId) {
    const t = this.trackingData.find(t => t.qrId === qrId);
    if (!t) return;
    const win = window.open('', '_blank', 'width=400,height=700');
    win.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Receipt - ${t.qrId}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    @page { size: 80mm auto; margin: 3mm 2mm; }
    html, body {
      font-family: Arial, 'Helvetica Neue', sans-serif;
      font-size: 13px;
      font-weight: 800;
      width: 76mm;
      color: #000;
      background: #fff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .receipt {
      width: 76mm;
      page-break-inside: avoid;
      break-inside: avoid;
      overflow: hidden;
    }
    .center { text-align: center; }
    .bold { font-weight: 900; }
    .xlarge { font-size: 19px; font-weight: 900; letter-spacing: 0.5px; }
    .divider { border-top: 1.5px dashed #000; margin: 4px 0; }
    .divider-solid { border-top: 2.5px solid #000; margin: 4px 0; }
    .row { display: flex; justify-content: space-between; margin: 3px 0; font-size: 13px; }
    .label { color: #000; font-weight: 700; }
    .value { font-weight: 900; text-align: right; max-width: 55%; word-break: break-word; color: #000; }
    .amount-row { display: flex; justify-content: space-between; font-size: 16px; font-weight: 900; margin: 3px 0; color: #000; letter-spacing: 0.5px; }
    .footer { font-size: 11px; text-align: center; margin-top: 5px; color: #000; font-weight: 700; line-height: 1.7; }
    .issue-box { border: 2px solid #000; padding: 4px; margin: 4px 0; font-size: 12px; word-break: break-word; font-weight: 800; line-height: 1.5; }
    .status-badge { border: 2px solid #000; padding: 2px 6px; font-weight: 900; font-size: 12px; letter-spacing: 0.5px; }
    @media print {
      html, body { color: #000 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      * { color: #000 !important; }
      button { display: none !important; }
      .receipt { page-break-after: avoid; break-after: avoid; }
    }
  </style>
</head>
<body>
<div class="receipt">

  <!-- Shop Header -->
  <div class="center">
    <div class="xlarge bold">MANJULA MOBILE WORLD</div>
    <div style="font-size:10px; margin-top:2px; font-weight:700;">The Final World of Mobile Solution</div>
    <div style="font-size:10px; font-weight:700;">Ramapuram, Tamil Nadu - 603201</div>
    <div style="font-size:10px; font-weight:700;">Ph: +91 82484 54841</div>
    <div style="font-size:10px; font-weight:700;">manjulamobiles125@gmail.com</div>
  </div>

  <div class="divider-solid"></div>

  <div class="center bold" style="font-size:12px; letter-spacing:1px;">** REPAIR RECEIPT **</div>
  <div class="center" style="font-size:10px;">Date In: ${t.dateIn || t.createdAt || new Date().toLocaleDateString('en-IN')}</div>
  ${t.dateOut ? `<div class="center" style="font-size:10px;">Date Out: ${t.dateOut}</div>` : ''}

  <div class="divider"></div>

  <!-- Customer Details -->
  <div class="bold" style="margin-bottom:3px;">CUSTOMER DETAILS</div>
  <div class="row"><span class="label">Name</span><span class="value">${t.customerName}</span></div>
  <div class="row"><span class="label">Phone</span><span class="value">${t.contact || '-'}</span></div>
  <div class="row"><span class="label">Device</span><span class="value">${t.productName || t.deviceModel || '-'}</span></div>

  <div class="divider"></div>

  <!-- Tracking Details -->
  <div class="bold" style="margin-bottom:3px;">TRACKING DETAILS</div>
  <div class="row"><span class="label">QR ID</span><span class="value bold">${t.qrId}</span></div>
  <div class="row"><span class="label">Password</span><span class="value bold">${t.qrPassword || '-'}</span></div>
  <div class="row"><span class="label">Status</span><span class="value"><span class="status-badge">${t.status}</span></span></div>
  <div class="row"><span class="label">Est. Days</span><span class="value">${t.estimatedDays == 0 ? 'Same Day' : ((t.estimatedDays || 2) + ' days')}</span></div>

  <div class="divider"></div>

  <!-- Issue -->
  <div class="bold" style="margin-bottom:3px;">ISSUE DESCRIPTION</div>
  <div class="issue-box">${t.issue}</div>

  <div class="divider"></div>

  <!-- Amount -->
  ${t.address ? `
  <div class="row"><span class="label">Address</span><span class="value">${t.address}</span></div>
  <div class="divider"></div>
  ` : ''}
  <div class="row"><span class="label">Full Price</span><span class="value">Rs.${(Number(t.amount) || 0).toLocaleString('en-IN')}</span></div>
  ${(Number(t.advanceAmount) > 0) ? `<div class="row"><span class="label">Advance Paid</span><span class="value">Rs.${Number(t.advanceAmount).toLocaleString('en-IN')}</span></div>` : ''}
  <div class="divider-solid"></div>
  <div class="row amount-row">
    <span>BALANCE DUE</span>
    <span>Rs.${(Number(t.balanceAmount) || Number(t.amount) || 0).toLocaleString('en-IN')}</span>
  </div>

  <div class="divider-solid"></div>

  <!-- Track Online -->
  <div class="center" style="font-size:10px; margin: 4px 0;">
    <div>Track your repair online:</div>
    <div class="bold">manjulamobilesworld.onrender.com</div>
    <div style="margin-top:2px;">Use QR ID &amp; Password to check status</div>
  </div>

  <div class="divider"></div>

  <div class="footer">
    <div>Mon-Sun: 9:00 AM - 10:00 PM</div>
    <div>24/7 Emergency Service Available</div>
    <div style="margin-top:4px;">*** Thank You! Visit Again ***</div>
  </div>

  <br>
  <div style="text-align:center;">
    <button onclick="window.print()" style="padding:8px 20px; background:#000; color:#fff; border:none; border-radius:4px; font-size:13px; cursor:pointer; font-family:monospace;">🖨️ PRINT</button>
  </div>

</div><!-- /.receipt -->
</body>
</html>`);
    win.document.close();
    // Focus the window — user clicks the PRINT button inside to trigger printer dialog
    setTimeout(() => { try { win.focus(); } catch(e) {} }, 200);
  }

  exportProductsPDF() {
    const data = this.products;
    const win = window.open('', '_blank', 'width=1000,height=700');
    const rows = data.map((p, i) => {
      const stock = Number(p.stock) || 0;
      const stockColor = stock === 0 ? '#dc2626' : stock <= 3 ? '#d97706' : '#059669';
      const stockLabel = stock === 0 ? 'Out of Stock' : stock <= 3 ? `Low (${stock})` : stock;
      return `<tr style="background:${i%2===0?'#fff':'#f9fafb'}">
        <td>${i+1}</td>
        <td><strong>${p.name}</strong></td>
        <td>${p.category||'-'}</td>
        <td style="color:#059669;font-weight:700;">₹${(Number(p.price)||0).toLocaleString('en-IN')}</td>
        <td style="color:#6b7280;text-decoration:line-through;">₹${(Number(p.originalPrice)||0).toLocaleString('en-IN')}</td>
        <td style="color:#d97706;font-weight:700;">${p.ownerPrice ? '₹'+Number(p.ownerPrice).toLocaleString('en-IN') : '-'}</td>
        <td style="color:${stockColor};font-weight:700;">${stockLabel}</td>
        <td><span style="background:${p.inStock?'#dcfce7':'#fee2e2'};color:${p.inStock?'#166534':'#dc2626'};padding:2px 8px;border-radius:4px;font-size:11px;">${p.inStock?'In Stock':'Out of Stock'}</span></td>
      </tr>`;
    }).join('');
    const lowStockCount = data.filter(p => { const s = Number(p.stock)||0; return s > 0 && s <= 3; }).length;
    const outOfStockCount = data.filter(p => (Number(p.stock)||0) === 0).length;
    win.document.write(`
      <!DOCTYPE html><html><head><title>Products Report</title>
      <style>
        body{font-family:Arial,sans-serif;padding:20px;color:#111;}
        h2{color:#dc2626;margin-bottom:4px;}
        table{width:100%;border-collapse:collapse;font-size:12px;margin-top:16px;}
        th{background:#dc2626;color:#fff;padding:8px 10px;text-align:left;}
        td{padding:7px 10px;border-bottom:1px solid #e5e7eb;}
        .summary{display:flex;gap:20px;margin:12px 0;flex-wrap:wrap;}
        .badge{padding:6px 14px;border-radius:6px;font-size:13px;font-weight:700;}
        @media print{button{display:none;}}
      </style></head><body>
      <h2>MANJULA MOBILE WORLD — Products Report</h2>
      <p style="color:#6b7280;font-size:12px;">Generated: ${new Date().toLocaleString('en-IN')} | Total Products: ${data.length}</p>
      <div class="summary">
        <span class="badge" style="background:#dcfce7;color:#166534;">✅ Total: ${data.length}</span>
        <span class="badge" style="background:#fee2e2;color:#dc2626;">🔴 Out of Stock: ${outOfStockCount}</span>
        <span class="badge" style="background:#fef3c7;color:#d97706;">🟡 Low Stock: ${lowStockCount}</span>
      </div>
      <table>
        <thead><tr>
          <th>#</th><th>Product Name</th><th>Category</th>
          <th>Customer Price</th><th>MRP</th><th>Owner Price 🔒</th>
          <th>Stock</th><th>Status</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <br><button onclick="window.print()" style="padding:10px 24px;background:#dc2626;color:#fff;border:none;border-radius:6px;font-size:14px;cursor:pointer;">🖨️ Print / Save as PDF</button>
      </body></html>
    `);
    win.document.close();
  }

  exportTrackingPDF() {
    const data = this.trackingData;
    const win = window.open('', '_blank', 'width=900,height=700');
    const rows = data.map((t, i) => `
      <tr style="background:${i%2===0?'#fff':'#f9fafb'}">
        <td>${i+1}</td><td>${t.createdAt||'-'}</td><td>${t.qrId}</td>
        <td>${t.customerName}</td><td>${t.contact||'-'}</td>
        <td>${t.productName||t.deviceModel||'-'}</td><td>${t.issue}</td>
        <td>${t.status}</td><td style="font-weight:700;color:#059669;">₹${(Number(t.amount)||0).toLocaleString('en-IN')}</td>
      </tr>`).join('');
    const total = data.reduce((s,t)=>s+(Number(t.amount)||0),0);
    win.document.write(`
      <!DOCTYPE html><html><head><title>Tracking Records</title>
      <style>
        body{font-family:Arial,sans-serif;padding:20px;color:#111;}
        h2{color:#dc2626;}
        table{width:100%;border-collapse:collapse;font-size:12px;}
        th{background:#dc2626;color:#fff;padding:8px 10px;text-align:left;}
        td{padding:7px 10px;border-bottom:1px solid #e5e7eb;}
        .total{font-size:16px;font-weight:800;color:#059669;margin-top:12px;}
        @media print{button{display:none;}}
      </style></head><body>
      <h2>MANJULA MOBILE WORLD — Tracking Records</h2>
      <p style="color:#6b7280;font-size:12px;">Generated: ${new Date().toLocaleString('en-IN')} | Total Records: ${data.length}</p>
      <table><thead><tr><th>#</th><th>Date</th><th>QR ID</th><th>Customer</th><th>Contact</th><th>Device</th><th>Issue</th><th>Status</th><th>Amount</th></tr></thead>
      <tbody>${rows}</tbody></table>
      <div class="total">Total Income: ₹${total.toLocaleString('en-IN')}</div>
      <br><button onclick="window.print()" style="padding:10px 24px;background:#dc2626;color:#fff;border:none;border-radius:6px;font-size:14px;cursor:pointer;">🖨️ Print / Save as PDF</button>
      </body></html>
    `);
    win.document.close();
  }

  exportTrackingXL() {
    const data = this.trackingData;
    const headers = ['#','Date','QR ID','Customer','Contact','Device','Issue','Status','Amount (Rs)'];
    const rows = data.map((t, i) => [
      i+1, t.createdAt||'', t.qrId, t.customerName, t.contact||'',
      t.productName||t.deviceModel||'', t.issue, t.status, Number(t.amount)||0
    ]);
    this._downloadCSV('tracking_records', headers, rows);
  }

  exportSalesPDF() {
    const data = this.salesRecords;
    const win = window.open('', '_blank', 'width=900,height=700');
    const rows = data.map((s, i) => {
      const net = (Number(s.saleAmount)||0) - (Number(s.discount)||0);
      return `<tr style="background:${i%2===0?'#fff':'#f9fafb'}">
        <td>${i+1}</td><td>${s.purchaseDate||'-'}</td><td>${s.customerName}</td>
        <td>${s.phoneNumber||'-'}</td><td>${s.productName}</td>
        <td>${s.productModel||'-'}</td><td>${s.warrantyPeriod||'-'}</td>
        <td>₹${(Number(s.saleAmount)||0).toLocaleString('en-IN')}</td>
        <td>₹${(Number(s.discount)||0).toLocaleString('en-IN')}</td>
        <td style="font-weight:700;color:#059669;">₹${net.toLocaleString('en-IN')}</td>
      </tr>`;
    }).join('');
    const total = data.reduce((s,r)=>(s+(Number(r.saleAmount)||0)-(Number(r.discount)||0)),0);
    win.document.write(`
      <!DOCTYPE html><html><head><title>Sales Records</title>
      <style>
        body{font-family:Arial,sans-serif;padding:20px;color:#111;}
        h2{color:#dc2626;}
        table{width:100%;border-collapse:collapse;font-size:12px;}
        th{background:#dc2626;color:#fff;padding:8px 10px;text-align:left;}
        td{padding:7px 10px;border-bottom:1px solid #e5e7eb;}
        .total{font-size:16px;font-weight:800;color:#059669;margin-top:12px;}
        @media print{button{display:none;}}
      </style></head><body>
      <h2>MANJULA MOBILE WORLD — Sales Records</h2>
      <p style="color:#6b7280;font-size:12px;">Generated: ${new Date().toLocaleString('en-IN')} | Total Records: ${data.length}</p>
      <table><thead><tr><th>#</th><th>Date</th><th>Customer</th><th>Phone</th><th>Product</th><th>Model</th><th>Warranty</th><th>Amount</th><th>Discount</th><th>Net</th></tr></thead>
      <tbody>${rows}</tbody></table>
      <div class="total">Total Net Sales: ₹${total.toLocaleString('en-IN')}</div>
      <br><button onclick="window.print()" style="padding:10px 24px;background:#dc2626;color:#fff;border:none;border-radius:6px;font-size:14px;cursor:pointer;">🖨️ Print / Save as PDF</button>
      </body></html>
    `);
    win.document.close();
  }

  exportSalesXL() {
    const data = this.salesRecords;
    const headers = ['#','Date','Customer','Phone','Product','Model','Warranty','Amount (Rs)','Discount (Rs)','Net (Rs)'];
    const rows = data.map((s, i) => {
      const net = (Number(s.saleAmount)||0) - (Number(s.discount)||0);
      return [i+1, s.purchaseDate||'', s.customerName, s.phoneNumber||'', s.productName, s.productModel||'', s.warrantyPeriod||'', Number(s.saleAmount)||0, Number(s.discount)||0, net];
    });
    this._downloadCSV('sales_records', headers, rows);
  }

  exportDisplayStockPDF() {
    const data = this.displayStock || [];
    const win = window.open('', '_blank', 'width=900,height=700');
    const rows = data.map((d, i) => {
      const stock = Number(d.stock) || 0;
      const stockColor = stock === 0 ? '#dc2626' : stock <= 1 ? '#dc2626' : '#16a34a';
      const statusLabel = stock === 0 ? 'Out of Stock' : stock <= 1 ? 'Last 1 - Reorder!' : 'In Stock';
      return `<tr style="background:${i%2===0?'#fff':'#f9fafb'}">
        <td>${i+1}</td>
        <td>${d.displayName}</td>
        <td>${d.displayId}</td>
        <td>${this.stockTotalValueUnlocked ? (d.price ? '₹' + Number(d.price).toLocaleString('en-IN') : '—') : '••••'}</td>
        <td style="font-weight:900; color:${stockColor};">${stock}</td>
        <td style="color:${stockColor}; font-weight:700;">${statusLabel}</td>
      </tr>`;
    }).join('');
    const totalValue = data.reduce((sum, d) => sum + ((Number(d.price)||0) * (Number(d.stock)||0)), 0);
    win.document.write(`
      <!DOCTYPE html><html><head><title>Display Stock Report</title>
      <style>
        body{font-family:Arial,sans-serif;padding:20px;color:#111;}
        h2{color:#1e293b;}
        table{width:100%;border-collapse:collapse;font-size:12px;}
        th{background:#1e293b;color:#fff;padding:8px 10px;text-align:left;}
        td{padding:7px 10px;border-bottom:1px solid #e5e7eb;}
        .total{font-size:16px;font-weight:800;color:#1e293b;margin-top:12px;}
        @media print{button{display:none;}}
      </style></head><body>
      <h2>MANJULA MOBILE WORLD — Display Stock Report</h2>
      <p style="color:#6b7280;font-size:12px;">Generated: ${new Date().toLocaleString('en-IN')} | Total Items: ${data.length}</p>
      <table><thead><tr><th>#</th><th>Display Name</th><th>Display ID</th><th>Price</th><th>Stock Qty</th><th>Status</th></tr></thead>
      <tbody>${rows}</tbody></table>
      <div class="total">Total Stock Value: ${this.stockTotalValueUnlocked ? '₹' + totalValue.toLocaleString('en-IN') : '••••'}</div>
      <br><button onclick="window.print()" style="padding:10px 24px;background:#1e293b;color:#fff;border:none;border-radius:6px;font-size:14px;cursor:pointer;">🖨️ Print / Save as PDF</button>
      </body></html>
    `);
    win.document.close();
  }

  exportDisplayStockXL() {
    const data = this.displayStock || [];
    const headers = ['#', 'Display Name', 'Display ID', 'Price (Rs)', 'Stock Qty', 'Status'];
    const rows = data.map((d, i) => {
      const stock = Number(d.stock) || 0;
      const status = stock === 0 ? 'Out of Stock' : stock <= 1 ? 'Last 1 - Reorder!' : 'In Stock';
      return [i+1, d.displayName, d.displayId, this.stockTotalValueUnlocked ? (Number(d.price)||0) : '••••', stock, status];
    });
    this._downloadCSV('display_stock', headers, rows);
  }

  _downloadCSV(filename, headers, rows) {
    const escape = v => {
      const s = String(v).replace(/"/g, '""');
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s}"` : s;
    };
    const csv = [headers, ...rows].map(r => r.map(escape).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  renderFooter() {
    return `
      <footer>
        <div class="footer-content">
          <div class="footer-section">
            <h4>Owner Portal</h4>
            <ul>
              <li><a href="#" data-page="admin">Dashboard</a></li>
              <li><a href="#" data-page="admin-products">Products</a></li>
              <li><a href="#" data-page="admin-tracking">Tracking</a></li>
              <li><a href="#" data-page="admin-orders">Orders</a></li>
            </ul>
          </div>
          <div class="footer-section">
            <h4>Main Site</h4>
            <ul>
              <li><a href="index.html">← Back to Main Site</a></li>
            </ul>
          </div>
          <div class="footer-section">
            <h4>Contact</h4>
            <ul>
              <li><a href="mailto:manjulamobiles125@gmail.com">manjulamobiles125@gmail.com</a></li>
              <li><a href="tel:+918248454841">+91 82484 54841</a></li>
              <li>Available 24/7</li>
            </ul>
          </div>
        </div>
        <div class="footer-bottom">
          <p>&copy; 2025 Manjula Mobile World Owner Portal. All rights reserved.</p>
        </div>
      </footer>
    `
  }

  // Product Management Methods
  async saveProduct() {
    const name = document.getElementById("productName")?.value;
    const category = document.getElementById("productCategory")?.value;
    const price = Number.parseInt(document.getElementById("productPrice")?.value || 0);
    const originalPrice = Number.parseInt(document.getElementById("productOriginalPrice")?.value || 0);
    const ownerPrice = Number.parseInt(document.getElementById("productOwnerPrice")?.value || 0);
    const stock = Number.parseInt(document.getElementById("productStock")?.value || 0);
    const imageUrl = document.getElementById("productImageUrl")?.value?.trim();
    const imageUrl2 = document.getElementById("productImageUrl2")?.value?.trim();
    const emoji = document.getElementById("productImage")?.value?.trim();
    const inStock = document.getElementById("productInStock")?.checked || false;

    if (!name || !category || !price) {
      alert("Please fill all required fields");
      return;
    }

    if (imageUrl && imageUrl.length > 700000) {
      alert("❌ Image file is too large. Please use a smaller image (max 500KB).");
      return;
    }
    if (imageUrl2 && imageUrl2.length > 700000) {
      alert("❌ Image 2 file is too large. Please use a smaller image (max 500KB).");
      return;
    }

    try {
      // Show loading indicator
      const saveButton = document.querySelector('[data-action="save-product"]');
      const originalText = saveButton.textContent;
      saveButton.textContent = 'Saving...';
      saveButton.disabled = true;

      if (this.editingProductId) {
        // Update existing product - Database ONLY
        const updatedProduct = {
          name,
          category,
          price,
          originalPrice: originalPrice || price,
          ownerPrice: ownerPrice || 0,
          stock: stock || 0,
          imageUrl: imageUrl || "",
          imageUrl2: imageUrl2 || "",
          image: emoji || "📦",
          inStock
        };

        const editingIdStr = String(this.editingProductId);
        const existingProduct = this.products.find((p) => String(p.id) === editingIdStr || String(p._id) === editingIdStr);
        
        if (existingProduct) {
          const mongoId = existingProduct._id || existingProduct.id;
          console.log('💾 [OWNER PORTAL] Updating product in database...');
          
          // Update in database ONLY
          const response = await fetch(`${this.API_URL}/products/${mongoId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatedProduct)
          });

          if (response.ok) {
            const savedProduct = await response.json();
            console.log('✅ [OWNER PORTAL] Product updated in database:', savedProduct);
            
            // Update local array (no localStorage)
            const productIndex = this.products.findIndex((p) => String(p.id) === editingIdStr || String(p._id) === editingIdStr);
            if (productIndex !== -1) {
              this.products[productIndex] = savedProduct;
            }
            
            alert("✅ Product updated in database successfully!");
          } else {
            const errorText = await response.text();
            console.error('❌ [OWNER PORTAL] Database update failed:', errorText);
            throw new Error(`Failed to update product: ${errorText}`);
          }
          
          this.editingProductId = null;
          console.log('🔄 Product updated in database, main website will see changes');
        } else {
          alert("❌ Product not found for editing");
        }
      } else {
        // Create new product - Save ONLY to DATABASE
        const newProduct = {
          name,
          category,
          price,
          originalPrice: originalPrice || price,
          ownerPrice: ownerPrice || 0,
          stock: stock || 0,
          image: emoji || "📦",
          imageUrl: imageUrl || "",
          imageUrl2: imageUrl2 || "",
          rating: 4.5,
          reviews: 0,
          inStock,
          badge: null,
          qrId: "",
          qrPassword: "",
          trackingStatus: "Received",
          ownerGender: "none"
        };

        console.log('💾 [OWNER PORTAL] Saving product to database...');
        
        // Save to database ONLY
        const response = await fetch(`${this.API_URL}/products`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newProduct)
        });

        if (response.ok) {
          const savedProduct = await response.json();
          console.log('✅ [OWNER PORTAL] Product saved to database:', savedProduct);
          
          // Add to local array (no localStorage)
          this.products.push(savedProduct);
          
          alert("✅ Product saved to database successfully!");
        } else {
          const errorText = await response.text();
          console.error('❌ [OWNER PORTAL] Database save failed:', errorText);
          throw new Error(`Failed to save product: ${errorText}`);
        }
        
        console.log('🔄 Product saved to database, main website will see it');
      }

      this.renderPage("admin-products");
    } catch (error) {
      console.error('❌ Error saving product:', error);
      
      let errorMessage = error.message;
      
      if (error.message.includes('timeout') || error.message.includes('timed out')) {
        alert(`⏰ Database operation timed out!\n\nThis usually means:\n• Slow internet connection\n• Database server is busy\n\nPlease try again in a few moments.`);
      } else if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
        alert(`🌐 Network connection error!\n\nPlease check:\n• Your internet connection\n• Server is running\n• Try refreshing the page`);
      } else if (error.message.includes('offline') || error.message.includes('not available')) {
        alert(`📡 Database is currently offline!\n\nThe server is running but can't connect to the database.\n\nPlease try again later.`);
      } else {
        alert(`❌ Error saving product:\n\n${errorMessage}\n\nPlease check your connection and try again.`);
      }
    } finally {
      // Restore button state
      const saveButton = document.querySelector('[data-action="save-product"]');
      if (saveButton) {
        saveButton.textContent = this.editingProductId ? 'Update Product' : 'Add Product';
        saveButton.disabled = false;
      }
    }
  }

  // Background sync method for product updates
  async syncProductUpdateToDatabase(mongoId, updatedProduct) {
    try {
      const response = await fetch(`${this.API_URL}/products/${mongoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedProduct)
      });

      if (response.ok) {
        const savedProduct = await response.json();
        
        // Update local storage with response from database
        const index = this.products.findIndex(p => (p._id || p.id) === mongoId);
        if (index !== -1) {
          this.products[index] = savedProduct;
          localStorage.setItem('manjula_products', JSON.stringify(this.products));
        }
        
        console.log('✅ Product update synced to database successfully');
      } else {
        console.error('❌ Failed to sync product update to database');
      }
    } catch (error) {
      console.error('❌ Background update sync error:', error);
    }
  }

  // Background sync method - doesn't block UI
  async syncProductToDatabase(product) {
    try {
      console.log('🔄 [OWNER PORTAL] Starting database sync for product:', product.name);
      
      const productForDB = { ...product };
      delete productForDB.id; // Remove temporary ID, let MongoDB generate _id
      
      const response = await fetch(`${this.API_URL}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(productForDB)
      });

      if (response.ok) {
        const savedProduct = await response.json();
        console.log('✅ [OWNER PORTAL] Product saved to database:', savedProduct);
        
        // Update local storage with real database product
        const index = this.products.findIndex(p => p.id === product.id);
        if (index !== -1) {
          this.products[index] = savedProduct;
          localStorage.setItem('manjula_products', JSON.stringify(this.products));
          console.log('✅ [OWNER PORTAL] Local storage updated with database product');
        }
        
        console.log('✅ Product synced to database successfully - main website should see it now!');
      } else {
        const errorText = await response.text();
        console.error('❌ Failed to sync product to database:', errorText);
      }
    } catch (error) {
      console.error('❌ Background sync error:', error);
    }
  }

  async deleteProduct(productId) {
    if (confirm("Are you sure you want to delete this product?")) {
      try {
        const productIdStr = String(productId);
        const product = this.products.find(p => String(p.id) === productIdStr || String(p._id) === productIdStr);
        if (!product) {
          alert('Product not found');
          return;
        }

        const mongoId = product._id || product.id;
        console.log('💾 [OWNER PORTAL] Deleting product from database...');
        
        // Delete from database ONLY
        const response = await fetch(`${this.API_URL}/products/${mongoId}`, {
          method: 'DELETE'
        });

        if (response.ok) {
          console.log('✅ [OWNER PORTAL] Product deleted from database');
          
          // Remove from local array (no localStorage)
          this.products = this.products.filter((p) => String(p.id) !== productIdStr && String(p._id) !== productIdStr);
          
          this.renderPage("admin-products");
          alert('✅ Product deleted from database successfully!');
        } else {
          const errorText = await response.text();
          console.error('❌ [OWNER PORTAL] Database delete failed:', errorText);
          throw new Error(`Failed to delete product: ${errorText}`);
        }
        
        console.log('🔄 Product deleted from database, main website will see changes');
      } catch (error) {
        console.error('❌ Error deleting product:', error);
        alert('❌ Error deleting product: ' + error.message);
      }
    }
  }

  // Background sync method for product deletion
  async syncProductDeleteToDatabase(mongoId) {
    try {
      const response = await fetch(`${this.API_URL}/products/${mongoId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        console.log('✅ Product deletion synced to database successfully');
      } else {
        console.error('❌ Failed to sync product deletion to database');
      }
    } catch (error) {
      console.error('❌ Background delete sync error:', error);
    }
  }

  handleImageUpload(event, imageNumber = 1) {
    const file = event.target.files[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        const base64Image = e.target.result
        if (imageNumber === 1) {
          document.getElementById("productImageUrl").value = base64Image
        } else if (imageNumber === 2) {
          document.getElementById("productImageUrl2").value = base64Image
        }
      }
      reader.readAsDataURL(file)
    }
  }

  // Tracking Management Methods
  async saveNewTracking() {
    const qrId = document.getElementById("newTrackingQRId")?.value?.trim();
    const password = document.getElementById("newTrackingPassword")?.value?.trim();
    const customer = document.getElementById("newTrackingCustomer")?.value?.trim();
    const device = document.getElementById("newTrackingDevice")?.value?.trim();
    const contact       = document.getElementById("newTrackingContact")?.value?.trim();
    const address       = document.getElementById("newTrackingAddress")?.value?.trim();
    const dateIn        = document.getElementById("newTrackingDateIn")?.value?.trim();
    const dateOut       = document.getElementById("newTrackingDateOut")?.value?.trim();
    const issue         = document.getElementById("newTrackingIssue")?.value?.trim();
    const status        = document.getElementById("newTrackingStatus")?.value;
    const days          = document.getElementById("newTrackingDays")?.value;
    const amount        = document.getElementById("newTrackingAmount")?.value?.trim();
    const advance       = document.getElementById("newTrackingAdvance")?.value?.trim();
    const paidAmount    = document.getElementById("newTrackingPaid")?.value?.trim();
    const totalReceived = document.getElementById("newTrackingTotalReceived")?.value?.trim();
    const balance       = document.getElementById("newTrackingBalance")?.value?.trim();    if (!qrId || !password || !customer || !device || !issue || !amount) {
      alert("Please fill all required fields: QR ID, Password, Customer Name, Device Model, Issue Description, and Full Price");
      return;
    }

    if (this.trackingData.find((t) => t.qrId === qrId)) {
      alert("This QR ID already exists. Please use a unique QR ID.");
      return;
    }

    try {
      // Show loading indicator
      const saveButton = document.querySelector('[data-action="save-new-tracking"]');
      const originalText = saveButton.textContent;
      saveButton.textContent = 'Saving...';
      saveButton.disabled = true;

      const currentDate = new Date().toLocaleDateString('en-IN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });

      const newTracking = {
        qrId: qrId,
        qrPassword: password,
        customerName: customer,
        productName: device,
        deviceModel: device,
        contact: contact,
        address: address || '',
        dateIn:  dateIn  || currentDate,
        dateOut: dateOut || '',
        status: status,
        issue: issue,
        estimatedDays: Number.parseInt(days) || 0,
        amount:         Number.parseInt(amount) || 0,
        advanceAmount:  Number.parseInt(advance) || 0,
        paidAmount:     Number.parseInt(paidAmount) || 0,
        totalReceived:  Number.parseInt(totalReceived) || 0,
        balanceAmount:  Number.parseInt(balance) || Number.parseInt(amount) || 0,        createdAt: currentDate,
        completedAt: null,
        lastUpdated: new Date().toLocaleDateString('en-IN', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })
      };

      // 1. Save to local storage IMMEDIATELY (instant)
      this.trackingData.push(newTracking);
      
      // 2. Show SUCCESS popup immediately
      alert("✅ Tracking record created successfully!\n\nQR ID: " + qrId + "\nPassword: " + password + "\nAmount: ₹" + amount + "\n\nShare these details with your customer for tracking.");
      
      // 3. Clear form and render page immediately
      document.getElementById("newTrackingQRId").value = "";
      document.getElementById("newTrackingPassword").value = "";
      document.getElementById("newTrackingCustomer").value = "";
      document.getElementById("newTrackingDevice").value = "";
      document.getElementById("newTrackingContact").value = "";
      if (document.getElementById("newTrackingAddress")) document.getElementById("newTrackingAddress").value = "";
      if (document.getElementById("newTrackingDateIn"))  document.getElementById("newTrackingDateIn").value  = "";
      if (document.getElementById("newTrackingDateOut")) document.getElementById("newTrackingDateOut").value = "";
      document.getElementById("newTrackingIssue").value = "";
      document.getElementById("newTrackingDays").value = "0";
      document.getElementById("newTrackingAmount").value = "";
      if (document.getElementById("newTrackingAdvance"))       document.getElementById("newTrackingAdvance").value = "";
      if (document.getElementById("newTrackingPaid"))          document.getElementById("newTrackingPaid").value = "";
      if (document.getElementById("newTrackingTotalReceived")) document.getElementById("newTrackingTotalReceived").value = "";
      if (document.getElementById("newTrackingBalance"))       document.getElementById("newTrackingBalance").value = "";
      
      this.toggleTrackingForm();
      this.renderPage("admin-tracking");
      
      // 4. Sync to database in background (don't wait for it)
      this.syncTrackingToDatabase(newTracking).catch(error => {
        console.error('❌ Background tracking sync failed:', error);
      });
      
      console.log('🔄 Tracking saved locally, syncing to database in background');
    } catch (error) {
      console.error('Error saving tracking:', error);
      alert('❌ Error saving tracking: ' + error.message + '\n\nPlease check your internet connection and try again.');
    } finally {
      // Restore button state
      const saveButton = document.querySelector('[data-action="save-new-tracking"]');
      if (saveButton) {
        saveButton.textContent = 'Save Tracking';
        saveButton.disabled = false;
      }
    }
  }

  // Background sync method for tracking
  async syncTrackingToDatabase(tracking) {
    try {
      const response = await fetch(`${this.API_URL}/tracking`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tracking)
      });

      if (response.ok) {
        console.log('✅ Tracking synced to database successfully');
      } else {
        console.error('❌ Failed to sync tracking to database');
      }
    } catch (error) {
      console.error('❌ Background tracking sync error:', error);
    }
  }

  showEditTrackingModal(qrId) {
    const t = this.trackingData.find(t => t.qrId === qrId);
    if (!t) return;

    const existing = document.getElementById('editTrackingModal');
    if (existing) existing.remove();

    const modalHTML = `
      <div id="editTrackingModal" onclick="if(event.target===this)this.remove()"
        style="position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;">
        <div style="background:#fff;border-radius:14px;padding:28px;max-width:540px;width:100%;max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.4);">
          <h3 style="font-size:18px;font-weight:800;color:#111;margin-bottom:20px;">✏️ Edit Tracking Record</h3>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;">
            <div>
              <label style="font-size:12px;font-weight:600;color:#374151;display:block;margin-bottom:4px;">Customer Name *</label>
              <input id="et_customerName" class="input" value="${t.customerName || ''}" style="width:100%;color:#111;background:#f8fafc;border:1px solid #d1d5db;">
            </div>
            <div>
              <label style="font-size:12px;font-weight:600;color:#374151;display:block;margin-bottom:4px;">Contact Number</label>
              <input id="et_contact" class="input" value="${t.contact || ''}" style="width:100%;color:#111;background:#f8fafc;border:1px solid #d1d5db;">
            </div>
            <div>
              <label style="font-size:12px;font-weight:600;color:#374151;display:block;margin-bottom:4px;">Address</label>
              <input id="et_address" class="input" value="${t.address || ''}" placeholder="Enter customer address" style="width:100%;color:#111;background:#f8fafc;border:1px solid #d1d5db;">
            </div>
            <div>
              <label style="font-size:12px;font-weight:600;color:#374151;display:block;margin-bottom:4px;">Device / Product Name *</label>
              <input id="et_productName" class="input" value="${t.productName || ''}" style="width:100%;color:#111;background:#f8fafc;border:1px solid #d1d5db;">
            </div>
            <div>
              <label style="font-size:12px;font-weight:600;color:#374151;display:block;margin-bottom:4px;">Full Price (₹)</label>
              <input id="et_amount" class="input" type="number" value="${t.amount || ''}" style="width:100%;color:#111;background:#f8fafc;border:1px solid #d1d5db;"
                oninput="var f=Number(this.value)||0;var a=Number(document.getElementById('et_advance').value)||0;var p=Number(document.getElementById('et_paid').value)||0;var tot=a+p;document.getElementById('et_total').value=tot;document.getElementById('et_balance').value=Math.max(0,f-tot);">
              <small style="color:#6b7280;font-size:10px;">Owner reference — not in daily sales</small>
            </div>
            <div>
              <label style="font-size:12px;font-weight:600;color:#374151;display:block;margin-bottom:4px;">Advance Received (₹)</label>
              <input id="et_advance" class="input" type="number" value="${t.advanceAmount || ''}" style="width:100%;color:#111;background:#f8fafc;border:1px solid #d1d5db;"
                oninput="var f=Number(document.getElementById('et_amount').value)||0;var a=Number(this.value)||0;var p=Number(document.getElementById('et_paid').value)||0;var tot=a+p;document.getElementById('et_total').value=tot;document.getElementById('et_balance').value=Math.max(0,f-tot);">
              <small style="color:#10b981;font-size:10px;">Amount paid at drop-off → shows in Today's Sales</small>
            </div>
            <div>
              <label style="font-size:12px;font-weight:600;color:#374151;display:block;margin-bottom:4px;">Paid Amount (₹) <span style="color:#059669;">(balance received)</span></label>
              <input id="et_paid" class="input" type="number" value="${Number(t.paidAmount) || ''}" style="width:100%;color:#111;background:#f8fafc;border:1px solid #d1d5db;"
                oninput="var f=Number(document.getElementById('et_amount').value)||0;var a=Number(document.getElementById('et_advance').value)||0;var p=Number(this.value)||0;var tot=a+p;document.getElementById('et_total').value=tot;document.getElementById('et_balance').value=Math.max(0,f-tot);">
              <small style="color:#059669;font-size:10px;">Amount paid when customer collects → shows in Today's Sales</small>
            </div>
            <div>
              <label style="font-size:12px;font-weight:600;color:#374151;display:block;margin-bottom:4px;">Total Received (₹)</label>
              <input id="et_total" class="input" type="number" value="${Number(t.totalReceived) || (Number(t.advanceAmount||0) + Number(t.paidAmount||0))}" readonly style="width:100%;color:#059669;background:#f0fdf4;border:1px solid #d1d5db;font-weight:700;">
              <small style="color:#6b7280;font-size:10px;">Advance + Paid (auto)</small>
            </div>
            <div>
              <label style="font-size:12px;font-weight:600;color:#374151;display:block;margin-bottom:4px;">Balance Amount (₹)</label>
              <input id="et_balance" class="input" type="number"
                value="${Math.max(0, Number(t.amount||0) - Number(t.advanceAmount||0) - Number(t.paidAmount||0))}"
                readonly style="width:100%;color:#dc2626;background:#fef2f2;border:1px solid #d1d5db;font-weight:700;">
              <small style="color:#6b7280;font-size:10px;">Full − Advance − Paid (auto)</small>
            </div>
            <div>
              <label style="font-size:12px;font-weight:600;color:#374151;display:block;margin-bottom:4px;">Estimated Completion</label>
              <select id="et_estimatedDays" class="input" style="width:100%;color:#111;background:#f8fafc;border:1px solid #d1d5db;">
                <option value="0" ${(t.estimatedDays||0)==0?'selected':''}>📅 Same Day</option>
                <option value="1" ${(t.estimatedDays||0)==1?'selected':''}>1 Day</option>
                <option value="2" ${(t.estimatedDays||0)==2?'selected':''}>2 Days</option>
                <option value="3" ${(t.estimatedDays||0)==3?'selected':''}>3 Days</option>
                <option value="4" ${(t.estimatedDays||0)==4?'selected':''}>4 Days</option>
                <option value="5" ${(t.estimatedDays||0)==5?'selected':''}>5 Days</option>
                <option value="7" ${(t.estimatedDays||0)==7?'selected':''}>1 Week</option>
                <option value="10" ${(t.estimatedDays||0)==10?'selected':''}>10 Days</option>
                <option value="14" ${(t.estimatedDays||0)==14?'selected':''}>2 Weeks</option>
                <option value="30" ${(t.estimatedDays||0)==30?'selected':''}>1 Month</option>
              </select>
            </div>            <div>
              <label style="font-size:12px;font-weight:600;color:#374151;display:block;margin-bottom:4px;">QR Password</label>
              <input id="et_qrPassword" class="input" value="${t.qrPassword || ''}" style="width:100%;color:#111;background:#f8fafc;border:1px solid #d1d5db;">
            </div>
            <div style="grid-column:1/-1;">
              <label style="font-size:12px;font-weight:600;color:#374151;display:block;margin-bottom:4px;">Issue Description *</label>
              <textarea id="et_issue" class="input" rows="3" style="width:100%;color:#111;background:#f8fafc;border:1px solid #d1d5db;resize:vertical;">${t.issue || ''}</textarea>
            </div>
          </div>
          <div style="display:flex;gap:10px;margin-top:20px;">
            <button onclick="app.saveEditTracking('${t.qrId}')"
              style="flex:1;background:#dc2626;color:#fff;border:none;border-radius:8px;padding:11px;font-size:14px;font-weight:700;cursor:pointer;">
              💾 Save Changes
            </button>
            <button onclick="document.getElementById('editTrackingModal').remove()"
              style="flex:1;background:#f1f5f9;color:#374151;border:1px solid #d1d5db;border-radius:8px;padding:11px;font-size:14px;font-weight:600;cursor:pointer;">
              ✕ Cancel
            </button>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
  }

  async saveEditTracking(qrId) {
    const customerName  = document.getElementById('et_customerName')?.value?.trim();
    const productName   = document.getElementById('et_productName')?.value?.trim();
    const issue         = document.getElementById('et_issue')?.value?.trim();

    if (!customerName || !productName || !issue) {
      alert('Please fill in Customer Name, Device Name and Issue.');
      return;
    }

    const updatedData = {
      customerName,
      productName,
      contact:        document.getElementById('et_contact')?.value?.trim(),
      address:        document.getElementById('et_address')?.value?.trim(),
      amount:         Number(document.getElementById('et_amount')?.value) || 0,
      advanceAmount:  Number(document.getElementById('et_advance')?.value) || 0,
      paidAmount:     Number(document.getElementById('et_paid')?.value) || 0,
      totalReceived:  Number(document.getElementById('et_total')?.value) || 0,
      balanceAmount:  Number(document.getElementById('et_balance')?.value) || 0,
      estimatedDays:  Number(document.getElementById('et_estimatedDays')?.value) || 0,
      qrPassword:     document.getElementById('et_qrPassword')?.value?.trim(),
      issue
    };

    try {
      const response = await fetch(`${this.API_URL}/tracking/${qrId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedData)
      });

      if (response.ok) {
        const updated = await response.json();
        const idx = this.trackingData.findIndex(t => t.qrId === qrId);
        if (idx !== -1) this.trackingData[idx] = { ...this.trackingData[idx], ...updated };
        document.getElementById('editTrackingModal')?.remove();
        this.renderTrackingListOnly();
        alert('✅ Tracking record updated!');
      } else {
        alert('❌ Failed to update tracking record.');
      }
    } catch (error) {
      console.error('Error updating tracking:', error);
      alert('❌ Error updating tracking record.');
    }
  }

  async editTracking(qrId) {
    const tracking = this.trackingData.find((t) => t.qrId === qrId);
    if (!tracking) return;

    this.showStatusModal(tracking);
  }

  showStatusModal(tracking) {
    const statuses = [
      { value: 'Received',        label: '📥 Received',         desc: 'Device received at service center' },
      { value: 'Diagnostics',     label: '🔍 Diagnostics',      desc: 'Checking device issues' },
      { value: 'Return',          label: '↩️ Return',            desc: 'Device returned to customer' },
      { value: 'In Progress',     label: '🔧 In Progress',      desc: 'Repair work in progress' },
      { value: 'Parts Ordered',   label: '📦 Parts Ordered',    desc: 'Waiting for replacement parts' },
      { value: 'Quality Check',   label: '✅ Quality Check',    desc: 'Final testing' },
      { value: 'Ready for Pickup',label: '📢 Ready for Pickup', desc: 'Ready for collection' },
      { value: 'Completed',       label: '🎉 Completed',        desc: 'Service completed' },
      { value: 'Delivered',       label: '🚚 Delivered',        desc: 'Device delivered to customer' }
    ];

    // Which options to hide when Return is selected
    const returnOnlyStatuses = ['Return'];
    const hiddenWhenReturn = ['In Progress','Parts Ordered','Quality Check','Ready for Pickup','Completed','Delivered'];

    const hasPaidFull = (Number(tracking.amount || 0) - Number(tracking.advanceAmount || 0) - Number(tracking.paidAmount || 0)) <= 0;

    const modalHTML = `
      <div class="status-modal" id="statusModal">
        <div class="status-modal-content">
          <div class="status-modal-header">
            <div class="status-modal-title">Update Repair Status</div>
            <div class="status-modal-subtitle">
              QR: ${tracking.qrId} | Device: ${tracking.productName} | Customer: ${tracking.customerName}
            </div>
          </div>
          
          <div class="status-select-group">
            <label class="status-select-label">Select New Status</label>
            <select class="status-select" id="newStatusSelect" data-qr-id="${tracking.qrId}" onchange="app.onStatusSelectChange(this)">
              ${statuses.map(s => {
                const isDelivered = s.value === 'Delivered';
                const hideReturn = hiddenWhenReturn.includes(s.value) && tracking.status === 'Return';
                const hideDelivered = isDelivered && !hasPaidFull;
                const hide = hideReturn || hideDelivered;

                return `
                  <option value="${s.value}" ${s.value === tracking.status ? 'selected' : ''}
                    ${hide ? 'style="display:none"' : ''}>
                    ${s.label} - ${s.desc}
                  </option>
                `;
              }).join('')}
            </select>
          </div>

          <!-- Return warning banner (shown only when Return is selected) -->
          <div id="returnWarning" style="display:${tracking.status === 'Return' ? 'flex' : 'none'}; align-items:center; gap:10px; background:#fef2f2; border:1px solid #fca5a5; border-radius:8px; padding:10px 14px; margin-top:12px;">
            <span style="font-size:18px;">↩️</span>
            <span style="font-size:13px; color:#dc2626; font-weight:600;">Return selected — device will be returned to customer. Further repair steps are hidden.</span>
          </div>
          
          <div class="status-modal-actions">
            <button class="status-btn status-btn-cancel" onclick="app.closeStatusModal()">Cancel</button>
            <button class="status-btn status-btn-save" onclick="app.saveTrackingStatus('${tracking.qrId}')">Update Status</button>
          </div>
        </div>
      </div>
    `;

    const existingModal = document.getElementById('statusModal');
    if (existingModal) existingModal.remove();
    document.body.insertAdjacentHTML('beforeend', modalHTML);
  }

  // Called when the status dropdown changes — hides/shows options based on Return and Payment status
  onStatusSelectChange(selectEl) {
    const hiddenWhenReturn = ['In Progress','Parts Ordered','Quality Check','Ready for Pickup','Completed','Delivered'];
    const isReturn = selectEl.value === 'Return';
    const warning = document.getElementById('returnWarning');

    const qrId = selectEl.dataset.qrId;
    const tracking = this.trackingData.find(t => t.qrId === qrId);
    const hasPaidFull = tracking ? ((Number(tracking.amount || 0) - Number(tracking.advanceAmount || 0) - Number(tracking.paidAmount || 0)) <= 0) : true;

    Array.from(selectEl.options).forEach(opt => {
      if (hiddenWhenReturn.includes(opt.value)) {
        if (opt.value === 'Delivered' && !hasPaidFull) {
          opt.style.display = 'none';
        } else {
          opt.style.display = isReturn ? 'none' : '';
        }
      }
    });

    // Only reset if Return is active AND the currently selected value is one of the hidden ones
    if (isReturn && hiddenWhenReturn.includes(selectEl.value)) {
      selectEl.value = 'Return';
    }

    if (warning) warning.style.display = isReturn ? 'flex' : 'none';
  }

  closeStatusModal() {
    const modal = document.getElementById('statusModal');
    if (modal) {
      modal.remove();
    }
  }

  async saveTrackingStatus(qrId) {
    const newStatus = document.getElementById('newStatusSelect').value;
    const tracking = this.trackingData.find((t) => t.qrId === qrId);
    
    if (!tracking) return;

    // 1. Update local storage IMMEDIATELY (instant)
    tracking.status = newStatus;
    tracking.lastUpdated = new Date().toLocaleDateString('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    
    // Set completed date when status is changed to "Completed"
    if (newStatus === 'Completed' && !tracking.completedAt) {
      tracking.completedAt = new Date().toLocaleDateString('en-IN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    }
    // Set delivered date
    if (newStatus === 'Delivered' && !tracking.deliveredAt) {
      tracking.deliveredAt = new Date().toLocaleDateString('en-IN', {
        day: '2-digit', month: '2-digit', year: 'numeric'
      });
    }
    // Set return date
    if (newStatus === 'Return' && !tracking.returnedAt) {
      tracking.returnedAt = new Date().toLocaleDateString('en-IN', {
        day: '2-digit', month: '2-digit', year: 'numeric'
      });
    }
    
    // 2. Show SUCCESS and render page immediately
    this.closeStatusModal();
    this.renderPage("admin-tracking");
    alert(`✅ Status updated to: ${newStatus}${newStatus === 'Completed' ? '\n✅ Completed date recorded!' : ''}`);
    
    // 3. Sync to database in background (don't wait for it)
    this.syncTrackingStatusToDatabase(qrId, newStatus, tracking.lastUpdated, tracking.completedAt).catch(error => {
      console.error('❌ Background tracking status sync failed:', error);
    });
    
    console.log('🔄 Tracking status updated locally, syncing to database in background');
  }

  // Background sync method for tracking status updates
  async syncTrackingStatusToDatabase(qrId, newStatus, lastUpdated, completedAt) {
    try {
      const updateData = { 
        status: newStatus, 
        lastUpdated: lastUpdated 
      };
      
      // Include completedAt if it exists
      if (completedAt) {
        updateData.completedAt = completedAt;
      }
      
      const response = await fetch(`${this.API_URL}/tracking/${qrId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      });
      
      if (response.ok) {
        console.log('✅ Tracking status synced to database successfully');
      } else {
        console.error('❌ Failed to sync tracking status to database');
      }
    } catch (error) {
      console.error('❌ Background tracking status sync error:', error);
    }
  }

  async deleteTracking(qrId) {
    if (confirm("Are you sure you want to delete this tracking record?")) {
      // 1. Delete from local storage IMMEDIATELY (instant)
      this.trackingData = this.trackingData.filter((t) => t.qrId !== qrId);
      
      // 2. Show SUCCESS and render page immediately
      this.renderPage("admin-tracking");
      alert('✅ Tracking deleted successfully!');
      
      // 3. Delete from database in background (don't wait for it)
      this.syncTrackingDeleteToDatabase(qrId).catch(error => {
        console.error('❌ Background tracking delete sync failed:', error);
      });
      
      console.log('🔄 Tracking deleted locally, syncing to database in background');
    }
  }

  // Background sync method for tracking deletion
  async syncTrackingDeleteToDatabase(qrId) {
    try {
      const response = await fetch(`${this.API_URL}/tracking/${qrId}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        console.log('✅ Tracking deletion synced to database successfully');
      } else {
        console.error('❌ Failed to sync tracking deletion to database');
      }
    } catch (error) {
      console.error('❌ Background tracking delete sync error:', error);
    }
  }

  handleBarcodeScan(value) {
    // Auto-lookup when scanner sends a complete code (ends with Enter key via scanner)
    // Also update the barcode preview if it looks like a valid ID
    clearTimeout(this._scanTimer);
    this._scanTimer = setTimeout(() => {
      if (value && value.trim().length >= 4) {
        this.lookupBarcode(value.trim());
      }
    }, 400);
  }

  async lookupBarcode(value) {
    let code = (value || '').trim();
    if (!code) return;

    // If the scanner sends a full URL (e.g. https://...?scan=01518), extract the ID
    if (code.includes('scan=')) {
      try {
        const url = new URL(code.startsWith('http') ? code : 'https://x.x/' + code);
        code = url.searchParams.get('scan') || code;
      } catch(e) {
        const match = code.match(/[?&]scan=([^&\s]+)/);
        if (match) code = match[1];
      }
    }

    code = code.trim();
    if (!code) return;

    // 1. Try local data first (instant)
    let t = this.trackingData.find(tr => tr.qrId === code);

    // 2. If not found locally, fetch fresh from server
    if (!t) {
      try {
        const response = await fetch(`${this.API_URL}/tracking`);
        if (response.ok) {
          this.trackingData = await response.json();
          t = this.trackingData.find(tr => tr.qrId === code);
        }
      } catch (err) {
        console.warn('Fetch failed during barcode lookup:', err);
      }
    }

    if (t) {
      this.showTrackingLookupResult(t);
    } else {
      const scanInput = document.getElementById('globalScanInput') || document.getElementById('barcodeScanInput');
      if (scanInput) {
        scanInput.style.border = '2px solid #dc2626';
        scanInput.placeholder = `❌ Not found: "${code}" — check QR ID`;
        setTimeout(() => {
          if (scanInput) {
            scanInput.style.border = '1px solid #10b981';
            scanInput.placeholder = 'Scan barcode here to lookup any tracking record...';
          }
        }, 2000);
      }
    }
  }

  showTrackingLookupResult(t) {
    if (!t) return;
    const existing = document.getElementById('barcodeLookupModal');
    if (existing) existing.remove();

    const statusColors = {
      'Received':'#3b82f6','Diagnostics':'#8b5cf6','Return':'#ef4444',
      'In Progress':'#f59e0b','Parts Ordered':'#ec4899','Quality Check':'#06b6d4',
      'Ready for Pickup':'#f59e0b','Completed':'#10b981','Delivered':'#2563eb'
    };
    const sc = statusColors[t.status] || '#10b981';
    const bcModalId = `bc_modal_${t.qrId.replace(/[^a-zA-Z0-9]/g,'_')}`;

    const modal = `
      <div id="barcodeLookupModal" onclick="if(event.target===this)this.remove()"
        style="position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;overflow-y:auto;">
        <div style="background:#1e293b;border:2px solid #334155;border-radius:14px;padding:24px;max-width:500px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,0.5);max-height:90vh;overflow-y:auto;">

          <!-- Header -->
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
            <h2 style="font-size:18px;font-weight:800;color:#f8fafc;">📷 Tracking Details</h2>
            <button onclick="document.getElementById('barcodeLookupModal').remove()"
              style="background:rgba(244,63,94,0.15);color:#f87171;border:1px solid #f87171;border-radius:6px;padding:4px 10px;cursor:pointer;font-size:13px;">✕ Close</button>
          </div>

          <!-- Barcode display -->
          <div style="background:#fff;border-radius:8px;padding:8px;text-align:center;margin-bottom:16px;">
            <svg id="${bcModalId}" style="max-width:100%;"></svg>
          </div>

          <!-- Status + QR -->
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;flex-wrap:wrap;">
            <span style="font-size:20px;font-weight:900;color:#f8fafc;font-family:monospace;">${t.qrId}</span>
            <span style="padding:5px 14px;border-radius:20px;font-size:13px;font-weight:700;background:rgba(16,185,129,0.15);color:${sc};border:1px solid ${sc}40;">${t.status}</span>
            ${t.status === 'Return' ? `<span style="background:#fef2f2;color:#dc2626;padding:4px 10px;border-radius:6px;font-size:12px;font-weight:700;border:1px solid #fca5a5;">↩️ RETURNED</span>` : ''}
          </div>

          <!-- All Details -->
          <div style="display:grid;gap:0;font-size:13px;border:1px solid #334155;border-radius:8px;overflow:hidden;">
            ${[
              ['👤 Customer', t.customerName],
              ['📞 Phone', t.contact || '—'],
              ['📱 Device', t.productName || t.deviceModel || '—'],
              ['🔑 Password', t.qrPassword || '—'],
              ['⏱ Est. Days', t.estimatedDays == 0 ? 'Same Day' : (t.estimatedDays ? t.estimatedDays + ' days' : '—')],
              ['💰 Amount', t.amount ? '₹' + Number(t.amount).toLocaleString('en-IN') : '—'],
              ['📅 Received', t.createdAt || '—'],
              ['✅ Completed', t.completedAt || '—'],
              ['🚀 Delivered', t.deliveredAt || '—'],
              ['↩️ Returned', t.returnedAt  || '—'],
              ['🕒 Last Update', t.lastUpdated || '—'],
            ].filter(([,v]) => v !== '—' || ['👤 Customer','📱 Device','💰 Amount','📅 Received'].some(l => l === [].toString())).map(([label, value], i) => `
              <div style="display:flex;justify-content:space-between;align-items:flex-start;padding:9px 14px;background:${i%2===0?'rgba(30,41,59,0.8)':'rgba(51,65,85,0.4)'};border-bottom:1px solid #334155;">
                <span style="color:#94a3b8;font-size:12px;min-width:110px;">${label}</span>
                <span style="font-weight:600;color:#f8fafc;text-align:right;max-width:55%;word-break:break-word;">${value}</span>
              </div>`).join('')}
            <!-- Issue — full display -->
            <div style="padding:9px 14px;background:rgba(51,65,85,0.4);">
              <div style="color:#94a3b8;font-size:12px;margin-bottom:4px;">🔧 Issue Description</div>
              <div style="color:#e2e8f0;font-size:13px;line-height:1.5;">${t.issue || '—'}</div>
            </div>
          </div>

          <!-- Action buttons -->
          <div style="display:flex;gap:10px;margin-top:16px;flex-wrap:wrap;">
            <button onclick="app.printTrackingLabel('${t.qrId}','${(t.customerName||'').replace(/'/g,"\\'")}','${((t.productName||t.deviceModel||'')).replace(/'/g,"\\'")}');document.getElementById('barcodeLookupModal').remove();"
              style="flex:1;min-width:100px;background:#1e293b;color:#fff;border:1px solid #475569;border-radius:8px;padding:10px;font-size:13px;font-weight:700;cursor:pointer;">
              🏷️ Print Label
            </button>
            <button onclick="app.printTSCLabel('${t.qrId}','${(t.customerName||'').replace(/'/g,"\\'")}','${((t.productName||t.deviceModel||'')).replace(/'/g,"\\'")}');document.getElementById('barcodeLookupModal').remove();"
              style="flex:1;min-width:100px;background:#ea580c;color:#fff;border:none;border-radius:8px;padding:10px;font-size:13px;font-weight:700;cursor:pointer;">
              🖶 TSC Printer
            </button>
            <button onclick="app.printTrackingCard('${t.qrId}');document.getElementById('barcodeLookupModal').remove();"
              style="flex:1;min-width:100px;background:#1d4ed8;color:#fff;border:none;border-radius:8px;padding:10px;font-size:13px;font-weight:700;cursor:pointer;">
              🖨️ Full Receipt
            </button>
            <button onclick="app.showEditTrackingModal('${t.qrId}');document.getElementById('barcodeLookupModal').remove();"
              style="flex:1;min-width:100px;background:#f59e0b;color:#fff;border:none;border-radius:8px;padding:10px;font-size:13px;font-weight:700;cursor:pointer;">
              ✏️ Edit
            </button>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modal);

    // Render barcode inside modal
    setTimeout(() => {
      const el = document.getElementById(bcModalId);
      if (el && typeof JsBarcode !== 'undefined') {
        try {
          JsBarcode(el, t.qrId, {
            format:'CODE128', width:2.2, height:50,
            displayValue:true, fontSize:14, margin:6,
            background:'#ffffff', lineColor:'#000000', fontOptions:'bold'
          });
        } catch(e) {}
      }
    }, 50);

    // Clear scan input
    const scanInput = document.getElementById('barcodeScanInput');
    if (scanInput) scanInput.value = '';
  }

  printTrackingLabel(qrId, customerName, deviceModel) {
    const t = this.trackingData.find(tr => tr.qrId === qrId) || {
      qrId, customerName: customerName || '', productName: deviceModel || '', contact: '', status: 'Received', amount: 0
    };

    const barVal = (t.qrId || '').trim();
    const cust   = (t.customerName || '').substring(0, 14).toUpperCase();
    const dev    = (t.productName || t.deviceModel || '').substring(0, 16);

    const win = window.open('', '_blank', 'width=920,height=480');
    win.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>TSC Label - ${barVal}</title>
  <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"><\/script>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }

    /* ── Screen layout ── */
    body {
      font-family: Arial, Helvetica, sans-serif;
      background: #f1f5f9;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      padding: 24px 16px;
      min-height: 100vh;
    }
    h2 { font-size: 17px; font-weight: 800; color: #1e293b; margin-bottom: 4px; }
    .hint { font-size: 12px; color: #64748b; margin-bottom: 18px; text-align:center; line-height:1.5; }
    .hint strong { color: #1e293b; }

    /* ── Label strip container ── */
    .scale-wrap {
      zoom: 2;
      margin-top: 12px;
      margin-bottom: 16px;
      flex-shrink: 0;
      max-width: 100%;
      overflow: hidden;
    }
    .strip {
      display: flex;
      flex-direction: row;
      width: 101.5mm;
      height: 25mm;
      background: #fff;
      border: 0.3mm solid #ccc;
    }
    .label {
      width: 33.83mm;
      height: 25mm;
      border-right: 0.2mm dashed #ccc;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      padding: 0.3mm 0.5mm 0 0.5mm;
      overflow: hidden;
      gap: 0;
    }
    .label:last-child { border-right: none; }
    .shop {
      font-size: 5pt;
      font-weight: 800;
      text-align: center;
      color: #000;
      line-height: 1.2;
      letter-spacing: 0.3px;
      white-space: nowrap;
      margin-bottom: 0.8mm;
    }
    svg.bc, canvas.bc {
      display: block;
      max-width: 31mm;
      width: 31mm;
      margin: 0 auto;
    }
    .barnum {
      font-size: 6pt;
      font-weight: 700;
      color: #000;
      letter-spacing: 1px;
      text-align: center;
      margin-top: 0.5mm;
      margin-bottom: 0.4mm;
    }
    .device {
      font-size: 4.5pt;
      font-weight: 600;
      color: #000;
      text-align: center;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 31mm;
      text-transform: uppercase;
      letter-spacing: 0.2px;
    }
    .custname {
      font-size: 4pt;
      font-weight: 600;
      color: #333;
      text-align: center;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 31mm;
      text-transform: uppercase;
      letter-spacing: 0.2px;
      margin-top: 0.2mm;
    }

    /* ── Print button ── */
    .print-btn {
      padding: 12px 44px;
      background: #1e293b;
      color: #fff;
      border: none;
      border-radius: 8px;
      font-size: 15px;
      font-weight: 700;
      cursor: pointer;
      box-shadow: 0 4px 14px rgba(0,0,0,0.18);
      margin-top: 8px;
    }
    .print-btn:hover { background: #0f172a; }
    .steps {
      margin-top: 12px;
      font-size: 11px;
      color: #64748b;
      text-align: center;
      line-height: 1.8;
    }
    .steps span { color: #1e293b; font-weight: 700; }

    /* ── Print mode: only the strip, exact paper size ── */
    @media print {
      @page {
        size: 101.5mm 25mm portrait;
        margin: 0;
      }
      html,
      body {
        width: 101.5mm;
        height: 25mm;
        margin: 0;
        padding: 0;
        overflow: hidden;
        background: #fff;
      }
      body * {
        visibility: hidden;
      }
      .print-strip,
      .print-strip * {
        visibility: visible;
      }
      .print-strip {
        display: flex !important;
        flex-direction: row;
        width: 101.5mm;
        height: 25mm;
        position: absolute;
        top: 0;
        left: 0;
      }
      h2, .hint, .print-btn, .steps, .scale-wrap {
        display: none !important;
      }
    }
  </style>
</head>
<body>

  <h2>🏷️ TSC Label Preview — ${barVal}</h2>
  <div class="hint">
    Paper: <strong>101.5 mm × 25 mm</strong> &nbsp;|&nbsp; 3 labels per strip<br>
    Select your <strong>TSC / Zenpert</strong> printer in the print dialog
  </div>

  <!-- Screen preview (scaled up 3.5×) -->
  <div class="scale-wrap">
    <div class="strip">
      <div class="label">
        <div class="shop">MANJULA MOBILES</div>
        <canvas class="bc" id="bc1"></canvas>
        <div class="barnum">${barVal}</div>
        <div class="device">${dev}</div>
        ${cust ? `<div class="custname">${cust}</div>` : ''}
      </div>
      <div class="label">
        <div class="shop">MANJULA MOBILES</div>
        <canvas class="bc" id="bc2"></canvas>
        <div class="barnum">${barVal}</div>
        <div class="device">${dev}</div>
        ${cust ? `<div class="custname">${cust}</div>` : ''}
      </div>
      <div class="label">
        <div class="shop">MANJULA MOBILES</div>
        <canvas class="bc" id="bc3"></canvas>
        <div class="barnum">${barVal}</div>
        <div class="device">${dev}</div>
        ${cust ? `<div class="custname">${cust}</div>` : ''}
      </div>
    </div>
  </div>

  <button class="print-btn" onclick="window.print()">🖨️ Print to TSC Printer</button>

  <div class="steps">
    In the print dialog: &nbsp;
    ① Select <span>TSC / Zenpert</span> printer &nbsp;
    ② Paper size → <span>101.5 × 25 mm</span> &nbsp;
    ③ Margins → <span>None</span> &nbsp;
    ④ Click <span>Print</span>
  </div>

  <!-- Hidden print-only strip (exact size, no transform) -->
  <div class="print-strip" style="display:none;">
    <div class="label">
      <div class="shop">MANJULA MOBILES</div>
      <canvas class="bc" id="bcp1"></canvas>
      <div class="barnum">${barVal}</div>
      <div class="device">${dev}</div>
      ${cust ? `<div class="custname">${cust}</div>` : ''}
    </div>
    <div class="label">
      <div class="shop">MANJULA MOBILES</div>
      <canvas class="bc" id="bcp2"></canvas>
      <div class="barnum">${barVal}</div>
      <div class="device">${dev}</div>
      ${cust ? `<div class="custname">${cust}</div>` : ''}
    </div>
    <div class="label">
      <div class="shop">MANJULA MOBILES</div>
      <canvas class="bc" id="bcp3"></canvas>
      <div class="barnum">${barVal}</div>
      <div class="device">${dev}</div>
      ${cust ? `<div class="custname">${cust}</div>` : ''}
    </div>
  </div>

  <script>
    window.onload = function() {
      if (typeof JsBarcode === 'undefined') {
        setTimeout(renderBarcodes, 800);
      } else {
        renderBarcodes();
      }
    };
    function renderBarcodes() {
      try {
        /* Render barcode at high resolution then stretch to fill label width.
           width:2 gives thinner bars with clear gaps.
           We then force the canvas CSS width to fill the full label (31mm ≈ 117px at 96dpi). */
        var opts = {
          format: 'CODE128',
          width: 2,
          height: 50,
          displayValue: false,
          margin: 8,
          background: '#ffffff',
          lineColor: '#000000'
        };
        ['bc1','bc2','bc3','bcp1','bcp2','bcp3'].forEach(function(id){
          var canvas = document.getElementById(id);
          if (!canvas) return;
          JsBarcode(canvas, '${barVal}', opts);
          // Force canvas to fill the label width — bars scale proportionally
          canvas.style.width  = '31mm';
          canvas.style.height = 'auto';
        });
      } catch(e) { console.error('Barcode error:', e); }
    }
  <\/script>
</body>
</html>`);
    win.document.close();
    setTimeout(() => { try { win.focus(); } catch(e) {} }, 200);
  }

  // ── Send ZPL command to Zebra-compatible thermal label printer ───────────
  async printTSCLabel(qrId, customerName, deviceModel) {
    const t = this.trackingData.find(tr => tr.qrId === qrId) || {
      qrId, customerName: customerName || '', productName: deviceModel || ''
    };

    const barVal = (t.qrId || '').replace(/[^A-Za-z0-9]/g, '');
    const cust   = (t.customerName || customerName || '').substring(0, 14).toUpperCase().replace(/"/g, '');
    const dev    = (t.productName || t.deviceModel || deviceModel || '').substring(0, 14).toUpperCase().replace(/"/g, '');

    // TSPL command for Zenpert 4T520 / TSC-compatible printer
    const tspl = [
      'SIZE 101.5 mm, 25 mm',
      'GAP 2 mm, 0 mm',
      'DIRECTION 0,0',
      'REFERENCE 0,0',
      'OFFSET 0 mm',
      'SET PEEL OFF',
      'SET CUTTER OFF',
      'SET PARTIAL_CUTTER OFF',
      'SET TEAR OFF',
      'CLS',
      `BARCODE 131,152,"128M",42,0,180,2,4,"!104${barVal}"`,
      'CODEPAGE 1252',
      `TEXT 176,105,"0",180,8,8,"${barVal}"`,
      `TEXT 214,191,"0",180,6,12,"MANJULA MOBILES"`,
      `TEXT 260,81,"0",180,6,12,"${dev}"`,
      'BAR 131,22, 78, 2',
      'BAR 134,21, 1, 2',
      `BARCODE 402,152,"128M",42,0,180,2,4,"!104${barVal}"`,
      `TEXT 447,105,"0",180,8,8,"${barVal}"`,
      `TEXT 485,191,"0",180,6,12,"MANJULA MOBILES"`,
      `TEXT 531,81,"0",180,6,12,"${dev}"`,
      'BAR 402,22, 78, 2',
      'BAR 405,21, 1, 2',
      `BARCODE 672,152,"128M",42,0,180,2,4,"!104${barVal}"`,
      `TEXT 717,105,"0",180,8,8,"${barVal}"`,
      `TEXT 755,191,"0",180,6,12,"MANJULA MOBILES"`,
      `TEXT 801,81,"0",180,6,12,"${dev}"`,
      'BAR 672,22, 78, 2',
      'BAR 675,21, 1, 2',
      'PRINT 1,1'
    ].join('\r\n');

    // Try local print agent first (port 9101), then fall back to download
    try {
      const response = await fetch('http://localhost:9101/print', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tspl })
      });
      const result = await response.json();
      if (result.success) {
        const btn = document.activeElement;
        if (btn && btn.textContent) {
          const orig = btn.textContent;
          btn.textContent = '✅ Printed!';
          btn.style.background = '#10b981';
          setTimeout(() => { btn.textContent = orig; btn.style.background = ''; }, 2000);
        }
        return;
      }
      throw new Error(result.error || 'Agent print failed');
    } catch (agentErr) {
      // Agent not running — try cloud server
      try {
        const response = await fetch(`${this.API_URL}/print-label`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tspl })
        });
        const result = await response.json();
        if (result.success) return;
        throw new Error(result.error);
      } catch (serverErr) {
        // Both failed — download as fallback
        const blob = new Blob([tspl], { type: 'application/octet-stream' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href = url; a.download = `label-${barVal}.prn`; a.click();
        URL.revokeObjectURL(url);
        alert('⚠️ Print agent not running.\n\nFile downloaded: label-' + barVal + '.prn\n\nTo enable one-click printing:\n1. Run print-agent/start-agent.bat on this PC\n2. Keep it running in the background');
      }
    }
  }

  toggleTrackingForm() {
    const form = document.getElementById("trackingForm");
    if (!form) return;
    const isHidden = form.style.display === 'none';
    form.style.display = isHidden ? 'block' : 'none';
    if (isHidden) {
      // Auto-generate next QR ID starting from 01518
      const nextId = this._generateNextQRId();
      const qrInput = document.getElementById('newTrackingQRId');
      if (qrInput) {
        qrInput.value = nextId;
        this._renderFormBarcode(nextId);
      }

      // Auto-fill Date In with today's date
      const dateInInput = document.getElementById('newTrackingDateIn');
      if (dateInInput) {
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm   = String(today.getMonth() + 1).padStart(2, '0');
        const dd   = String(today.getDate()).padStart(2, '0');
        dateInInput.value = `${yyyy}-${mm}-${dd}`;
      }

      // Show "Don't Get the SIM" reminder popup
      this._showSimReminder();
    }
  }

  _showSimReminder() {
    const existing = document.getElementById('simReminderPopup');
    if (existing) existing.remove();

    const popup = document.createElement('div');
    popup.id = 'simReminderPopup';
    popup.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      z-index: 99999;
      background: #fff;
      border: 3px solid #dc2626;
      border-radius: 16px;
      padding: 32px 40px;
      text-align: center;
      box-shadow: 0 24px 80px rgba(0,0,0,0.5);
      min-width: 280px;
      animation: popIn 0.25s ease;
    `;
    popup.innerHTML = `
      <style>
        @keyframes popIn {
          from { transform: translate(-50%, -50%) scale(0.7); opacity: 0; }
          to   { transform: translate(-50%, -50%) scale(1);   opacity: 1; }
        }
      </style>
      <div style="font-size: 48px; margin-bottom: 12px;">⚠️</div>
      <div style="font-size: 22px; font-weight: 900; color: #dc2626; margin-bottom: 8px; letter-spacing: 0.5px;">
        DON'T GET THE SIM
      </div>
      <div style="font-size: 14px; color: #64748b; margin-bottom: 24px;">
        Please remember to remove the SIM card<br>before accepting the device.
      </div>
      <button onclick="document.getElementById('simReminderPopup').remove()"
        style="background: #dc2626; color: #fff; border: none; border-radius: 8px;
               padding: 12px 32px; font-size: 15px; font-weight: 700; cursor: pointer; width: 100%;">
        ✅ Got it
      </button>
    `;
    document.body.appendChild(popup);
  }

  _generateNextQRId() {
    const BASE = 1518;
    // Find the highest numeric suffix among existing IDs
    let max = BASE - 1;
    (this.trackingData || []).forEach(t => {
      const num = parseInt(t.qrId, 10);
      if (!isNaN(num) && num > max) max = num;
    });
    const next = max + 1;
    // Zero-pad to 5 digits minimum
    return String(next).padStart(5, '0');
  }

  _renderFormBarcode(value) {
    const canvas = document.getElementById('formBarcodeCanvas');
    if (!canvas) return;
    if (typeof JsBarcode === 'undefined') {
      setTimeout(() => this._renderFormBarcode(value), 300);
      return;
    }
    try {
      JsBarcode(canvas, value, {
        format: 'CODE128', width: 2, height: 40,
        displayValue: true, fontSize: 13, margin: 4,
        background: '#ffffff', lineColor: '#000000'
      });
      canvas.style.display = 'block';
      canvas.style.margin = '0 auto';
    } catch(e) { console.warn('Barcode render error:', e); }
  }

  handleTrackingSearch(value) {
    this.trackingSearch = value;
    // Clear existing timeout
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }
    // Wait for user to stop typing before filtering
    this.searchTimeout = setTimeout(() => {
      this.renderTrackingListOnly();
    }, 500); // Increased to 500ms for smoother typing
  }

  filterTracking(status) {
    this.trackingFilter = status;
    this.renderTrackingListOnly();
  }

  showProductSuggestions(value) {
    const dropdown = document.getElementById('sale_product_dropdown');
    if (!dropdown) return;
    const term = value.trim().toLowerCase();
    if (!term) { dropdown.style.display = 'none'; return; }

    const matches = this.products.filter(p =>
      p.name.toLowerCase().includes(term) ||
      (p.category && p.category.toLowerCase().includes(term))
    ).slice(0, 10);

    if (matches.length === 0) { dropdown.style.display = 'none'; return; }

    dropdown.innerHTML = matches.map(p => {
      // Use index reference to avoid quote-escaping issues with product names
      const idx = this.products.indexOf(p);
      const inStock = p.inStock !== false;
      return `
        <div onmousedown="event.preventDefault(); app.selectProductSuggestion(${idx});"
          style="padding:10px 14px; cursor:pointer; border-bottom:1px solid #fecaca; font-size:13px; ${!inStock ? 'opacity:0.5;' : ''}"
          onmouseover="this.style.background='#fef2f2'" onmouseout="this.style.background='#fff'">
          <div style="font-weight:600; color:#111;">${p.name} ${!inStock ? '<span style="color:#dc2626;font-size:10px;">(Out of Stock)</span>' : ''}</div>
          <div style="font-size:11px; color:#6b7280;">
            ${p.category ? `<span style="background:#fee2e2;color:#dc2626;padding:1px 6px;border-radius:4px;margin-right:4px;">${p.category}</span>` : ''}
            ${p.price ? `<span style="color:#16a34a;font-weight:600;">₹${Number(p.price).toLocaleString('en-IN')}</span>` : ''}
            ${p.originalPrice && p.originalPrice > p.price ? `<span style="color:#9ca3af;text-decoration:line-through;margin-left:4px;font-size:10px;">₹${Number(p.originalPrice).toLocaleString('en-IN')}</span>` : ''}
          </div>
        </div>
      `;
    }).join('');
    dropdown.style.display = 'block';
  }

  selectProductSuggestion(productIndex) {
    const p = this.products[productIndex];
    if (!p) return;

    const dropdown = document.getElementById('sale_product_dropdown');
    if (dropdown) dropdown.style.display = 'none';

    // Fill product name
    const nameInput = document.getElementById('sale_productName');
    if (nameInput) nameInput.value = p.name;

    // Fill sale amount from product price
    const amountInput = document.getElementById('sale_saleAmount');
    if (amountInput && p.price) {
      amountInput.value = p.price;
    }

    // Fill category/type field
    const categoryInput = document.getElementById('sale_productCategory');
    if (categoryInput) categoryInput.value = p.category || '';

    // Show original price as reference
    const origPriceEl = document.getElementById('sale_originalPrice_ref');
    if (origPriceEl) {
      if (p.originalPrice && p.originalPrice > p.price) {
        origPriceEl.textContent = `MRP: ₹${Number(p.originalPrice).toLocaleString('en-IN')}`;
        origPriceEl.style.display = 'inline';
      } else {
        origPriceEl.style.display = 'none';
      }
    }

    // Auto-set warranty if product has a badge hint
    const warrantySelect = document.getElementById('sale_warrantyPeriod');
    if (warrantySelect && p.badge) {
      const badge = p.badge.toLowerCase();
      if (badge.includes('1 year') || badge.includes('1year')) warrantySelect.value = '1 Year';
      else if (badge.includes('2 year') || badge.includes('2year')) warrantySelect.value = '2 Years';
      else if (badge.includes('6 month')) warrantySelect.value = '6 Months';
      else if (badge.includes('3 month')) warrantySelect.value = '3 Months';
    }

    this.updateBillPreview();
  }

  // ===== DEBOUNCED SEARCH METHODS (no full page re-render) =====

  searchProducts(value) {
    // Store value and update only the products grid
    if (this._searchTimer) clearTimeout(this._searchTimer);
    this._searchTimer = setTimeout(() => {
      const term = value.toLowerCase();
      const filtered = this.products.filter(p =>
        p.name.toLowerCase().includes(term) || p.category.toLowerCase().includes(term)
      );
      const grid = document.querySelector('.admin-products-grid');
      if (grid) {
        grid.innerHTML = filtered.length > 0
          ? filtered.map(p => this.renderAdminProductCard(p)).join('')
          : '<div style="grid-column:1/-1;text-align:center;padding:48px;color:#94a3b8;">No products found</div>';
      }
      const counter = document.querySelector('#adminSearch + span');
      if (counter) counter.textContent = `Total: ${filtered.length} products`;
    }, 300);
  }

  searchSales(value) {
    if (this._salesTimer) clearTimeout(this._salesTimer);
    this.salesSearch = value;
    this._salesTimer = setTimeout(() => {
      const term = value.toLowerCase();
      const filtered = this.salesRecords.filter(s =>
        s.customerName?.toLowerCase().includes(term) ||
        s.phoneNumber?.includes(term) ||
        s.productName?.toLowerCase().includes(term) ||
        s.customerAddress?.toLowerCase().includes(term)
      );
      const grid = document.querySelector('.sales-records-grid');
      const counter = document.querySelector('.sales-counter');
      if (counter) counter.textContent = `${filtered.length} records`;
      if (!grid) return;
      if (filtered.length === 0) {
        grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:60px;color:#374151;font-size:16px;"><div style="font-size:48px;margin-bottom:16px;">🛍️</div><p>No sales records found.</p></div>';
        return;
      }
      grid.innerHTML = filtered.map(sale => {
        const amount = Number(sale.saleAmount) || 0;
        const discount = Number(sale.discount) || 0;
        const netAmount = amount - discount;
        return `
          <div style="background: rgba(255,255,255,0.95); border-radius: 12px; padding: 16px; border: 2px solid #fecaca; position: relative;">
            <div style="margin-bottom: 12px;">
              <div style="font-size: 16px; font-weight: 700; color: #000;">${sale.customerName}</div>
              <div style="font-size: 13px; color: #dc2626; font-weight: 600;">📞 ${sale.phoneNumber}</div>
              ${sale.customerAddress ? `<div style="font-size: 12px; color: #6b7280;">📍 ${sale.customerAddress}</div>` : ''}
            </div>
            <!-- Action buttons — 2×2 grid -->
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; margin-bottom:12px;">
              <button onclick="app.showEditSaleModal('${sale.saleId}')" style="background:#16a34a; border:none; border-radius:8px; padding:7px 10px; cursor:pointer; color:#fff; font-size:12px; font-weight:700; display:flex; align-items:center; justify-content:center; gap:4px;" title="Edit">✏️ Edit</button>
              <button onclick="app.printBill('${sale.saleId}')" style="background:#1d4ed8; border:none; border-radius:8px; padding:7px 10px; cursor:pointer; color:#fff; font-size:12px; font-weight:700; display:flex; align-items:center; justify-content:center; gap:4px;" title="Print Receipt">🧾 Print</button>
              <button onclick="app.shareSaleWhatsApp('${sale.saleId}')" style="background:#25d366; border:none; border-radius:8px; padding:7px 10px; cursor:pointer; color:#fff; font-size:12px; font-weight:700; display:flex; align-items:center; justify-content:center; gap:4px;" title="Share on WhatsApp">💬 WhatsApp</button>
              <button onclick="app.deleteSaleRecord('${sale.saleId}')" style="background:#dc2626; border:none; border-radius:8px; padding:7px 10px; cursor:pointer; color:#fff; font-size:12px; font-weight:700; display:flex; align-items:center; justify-content:center; gap:4px;" title="Delete">🗑️ Delete</button>
            </div>
            <div style="border-top: 1px solid #fecaca; padding-top: 10px; display: flex; flex-direction: column; gap: 6px;">
              <div style="font-size: 13px; color: #000;"><span style="color: #6b7280;">📱 Product:</span> <strong>${sale.productName}</strong></div>
              <div style="font-size: 13px; color: #000;"><span style="color: #6b7280;">📅 Date:</span> ${sale.purchaseDate}</div>
              ${amount ? `<div style="font-size: 13px; color: #374151;">Price: ₹${amount.toLocaleString()}${discount ? ` &nbsp;|&nbsp; Discount: ₹${discount.toLocaleString()}` : ''}</div>` : ''}
              ${amount ? `<div style="font-size: 14px; font-weight: 700; color: #16a34a;">💰 Net: ₹${netAmount.toLocaleString()}</div>` : ''}
              ${sale.warrantyPeriod ? `<div style="font-size: 12px; background: #dcfce7; color: #16a34a; padding: 3px 8px; border-radius: 20px; display: inline-block; font-weight: 600;">🛡️ Warranty: ${sale.warrantyPeriod}</div>` : ''}
              ${sale.notes ? `<div style="font-size: 12px; color: #6b7280; font-style: italic;">${sale.notes}</div>` : ''}
            </div>
          </div>
        `;
      }).join('');
    }, 300);
  }

  searchStock(value) {
    if (this._stockTimer) clearTimeout(this._stockTimer);
    this.stockSearch = value;

    // Get or create a body-level dropdown (floats above everything)
    let dropdown = document.getElementById('stockSearchDropdown');
    if (!dropdown) {
      dropdown = document.createElement('div');
      dropdown.id = 'stockSearchDropdown';
      dropdown.style.cssText = 'display:none; position:fixed; background:#fff; border:2px solid #dc2626; border-radius:8px; max-height:200px; overflow-y:auto; z-index:99999; box-shadow:0 6px 20px rgba(0,0,0,0.18); min-width:280px;';
      document.body.appendChild(dropdown);
    }

    // Position it under the input
    const input = document.getElementById('stockSearchInput');
    if (input) {
      const rect = input.getBoundingClientRect();
      dropdown.style.top  = (rect.bottom + window.scrollY + 4) + 'px';
      dropdown.style.left = rect.left + 'px';
      dropdown.style.width = rect.width + 'px';
    }

    // Hide if empty
    if (!value.trim()) {
      dropdown.style.display = 'none';
      return;
    }

    this._stockTimer = setTimeout(() => {
      const term = (this.stockSearch || '').toLowerCase();
      const matched = (this.displayStock || []).filter(d =>
        d.displayName?.toLowerCase().includes(term) ||
        d.displayId?.toLowerCase().includes(term)
      );
      matched.sort((a, b) => {
        const nameA = (a.displayName || '').trim().toLowerCase();
        const nameB = (b.displayName || '').trim().toLowerCase();
        return nameA.localeCompare(nameB);
      });

      if (matched.length === 0) {
        dropdown.innerHTML = `<div style="padding:12px; text-align:center; color:#9ca3af; font-size:12px;">No items found</div>`;
      } else {
        dropdown.innerHTML = matched.map(item => {
          const stock = Number(item.stock) || 0;
          const stockColor = stock === 0 ? '#dc2626' : stock <= 3 ? '#d97706' : '#16a34a';
          const stockLabel = stock === 0 ? '❌ Out' : stock <= 3 ? `⚠️ ${stock} left` : `✅ ${stock}`;
          return `
            <div style="padding:8px 12px; border-bottom:1px solid #f1f5f9; cursor:pointer; display:flex; justify-content:space-between; align-items:center; background:#fff;"
              onmouseover="this.style.background='#f0f9ff'" onmouseout="this.style.background='#fff'"
              onmousedown="event.preventDefault(); document.getElementById('stockSearchInput').value=''; document.getElementById('stockSearchDropdown').style.display='none'; app.stockSearch=''; app.scrollToStockItem('${item.stockItemId}')">
              <div>
                <div style="font-weight:700; color:#111827; font-size:13px;">${item.displayName}</div>
                <div style="font-size:11px; color:#6b7280; margin-top:1px;">${item.displayId}${item.price ? ' · ₹' + Number(item.price).toLocaleString('en-IN') : ''}</div>
              </div>
              <span style="font-size:11px; font-weight:700; color:${stockColor}; white-space:nowrap; margin-left:12px; padding:2px 8px; border-radius:12px; background:${stockColor}18;">${stockLabel}</span>
            </div>
          `;
        }).join('');
      }

      dropdown.style.display = 'block';
    }, 150);
  }

  scrollToStockItem(stockItemId) {
    // Highlight the row in the table
    const rows = document.querySelectorAll('.stock-item-row');
    rows.forEach(row => row.style.background = '');
    const target = document.querySelector(`.stock-item-row[data-id="${stockItemId}"]`);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      target.style.background = '#fef9c3';
      setTimeout(() => { target.style.background = ''; }, 2000);
    }
  }

  searchServices(value) {
    if (this._serviceTimer) clearTimeout(this._serviceTimer);
    this.serviceSearch = value;
    this._serviceTimer = setTimeout(() => {
      const term = value.toLowerCase();
      const filtered = (this.serviceRecords || []).filter(s =>
        s.customerName?.toLowerCase().includes(term) ||
        s.phoneNumber?.includes(term) ||
        s.serviceDetails?.toLowerCase().includes(term) ||
        s.customerAddress?.toLowerCase().includes(term)
      );
      const tbody = document.querySelector('.services-table-body');
      if (tbody) {
        tbody.innerHTML = filtered.length === 0
          ? '<tr><td colspan="9" style="text-align:center;padding:40px;color:#94a3b8;">No records found</td></tr>'
          : filtered.map((s, i) => this._renderServiceRow(s, i)).join('');
      }
      const counter = document.querySelector('.services-counter');
      if (counter) counter.textContent = `${filtered.length} records`;
    }, 300);
  }

  // Render only the tracking list without re-rendering the entire page
  renderTrackingListOnly() {
    const trackingListContainer = document.querySelector('.tracking-list');
    if (trackingListContainer) {
      const parent = trackingListContainer.parentElement;
      const newContent = this.renderTrackingList();
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = newContent;
      const newTrackingList = tempDiv.firstElementChild;
      
      // Preserve the search input value and focus
      const oldInput = trackingListContainer.querySelector('#trackingSearchInput');
      const hadFocus = oldInput && document.activeElement === oldInput;
      const cursorPos = oldInput ? oldInput.selectionStart : 0;
      
      parent.replaceChild(newTrackingList, trackingListContainer);
      
      // Restore focus and cursor position
      if (hadFocus) {
        const newInput = document.getElementById('trackingSearchInput');
        if (newInput) {
          newInput.focus();
          newInput.setSelectionRange(cursorPos, cursorPos);
        }
      }
    }
  }

  getStatusEmoji(status) {
    const emojiMap = {
      'Received':         '📥',
      'Diagnostics':      '🔍',
      'Return':           '↩️',
      'In Progress':      '🔧',
      'Parts Ordered':    '📦',
      'Quality Check':    '✅',
      'Ready for Pickup': '📢',
      'Completed':        '🎉',
      'Delivered':        '🚚'
    }
    return emojiMap[status] || '📱'
  }

  // Order Management Methods
  async updateOrderStatus(orderId) {
    const order = this.orders.find(o => o.id === orderId || o.orderId === orderId);
    if (!order) return;

    const newStatus = prompt(
      "Enter new order status:\n\nPending\nProcessing\nShipped\nDelivered\nCancelled",
      order.status
    );

    if (newStatus) {
      const validStatuses = ["Pending", "Processing", "Shipped", "Delivered", "Cancelled"];
      if (validStatuses.includes(newStatus)) {
        order.status = newStatus;
        this.renderPage("admin-orders");
        alert(`✅ Order status updated to: ${newStatus}`);
      } else {
        alert("Invalid status. Please use one of the suggested statuses.");
      }
    }
  }

  async deleteOrder(orderId) {
    if (confirm("Are you sure you want to delete this order?")) {
      try {
        const orderIdStr = String(orderId);
        const order = this.orders.find(o => String(o.id) === orderIdStr || String(o.orderId) === orderIdStr || String(o._id) === orderIdStr);
        
        if (!order) {
          throw new Error('Order not found in local array');
        }

        const dbOrderId = order.orderId || order.id;
        
        const response = await fetch(`${this.API_URL}/orders/${dbOrderId}`, {
          method: 'DELETE'
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to delete order: ${errorText}`);
        }
        
        this.orders = this.orders.filter(o => o.id !== orderId && o.orderId !== orderId && o.id !== dbOrderId && o.orderId !== dbOrderId);
        
        this.renderPage("admin-orders");
        alert('✅ Order deleted successfully!');
      } catch (error) {
        console.error('❌ Error deleting order:', error);
        alert(`❌ Failed to delete order: ${error.message}`);
      }
    }
  }

  // ===== SPARE PARTS METHODS =====

  renderSpareParts() {
    const search = (this.sparePartsSearch || '').toLowerCase();
    const filtered = (this.sparePartsStock || []).filter(d =>
      d.partName?.toLowerCase().includes(search) ||
      d.partId?.toLowerCase().includes(search)
    );
    const lowStock = filtered.filter(d => (Number(d.stock) || 0) === 1);
    return `
      <div style="min-height:100vh; background-color:#f13e74fb; padding-top:96px; padding-bottom:80px;">
        <div class="container">
          <button class="back-button" data-page="admin" style="margin-bottom:20px;">&#8592; Dashboard</button>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:24px; flex-wrap:wrap; gap:12px;">
            <div>
              <h1 style="font-size:32px; font-weight:700; margin-bottom:4px;">🔩 Spare Parts</h1>
              <p style="color:#94a3b8;">Manage spare parts inventory — increase, decrease &amp; track stock</p>
            </div>
            <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center;">
              <button class="btn btn-primary" onclick="app.toggleSparePartsForm()" style="padding:12px 24px;">+ Add Part</button>
              <button onclick="app.exportSparePartsPDF()" style="padding:12px 24px; background:#1e293b; color:#fff; border:none; border-radius:8px; font-size:14px; font-weight:700; cursor:pointer;">📄 PDF</button>
              <button onclick="app.exportSparePartsXL()" style="padding:12px 24px; background:#16a34a; color:#fff; border:none; border-radius:8px; font-size:14px; font-weight:700; cursor:pointer;">📊 XL Sheet</button>
            </div>
          </div>
          <div id="sparePartsForm" style="display:none; background:rgba(255,255,255,0.97); border:2px solid #dc2626; border-radius:12px; padding:24px; margin-bottom:24px;">
            <h3 style="font-size:18px; font-weight:700; margin-bottom:16px; color:#000;">Add New Spare Part</h3>
            <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(200px,1fr)); gap:12px;">
              <div>
                <label style="font-size:13px; font-weight:600; color:#374151; display:block; margin-bottom:4px;">Part Name *</label>
                <input class="input" id="sp_partName" placeholder="e.g. Samsung A54 Battery" style="width:100%;">
              </div>
              <div>
                <label style="font-size:13px; font-weight:600; color:#374151; display:block; margin-bottom:4px;">Part ID *</label>
                <input class="input" id="sp_partId" placeholder="e.g. PART-SA54-BAT" style="width:100%;">
              </div>
              <div>
                <label style="font-size:13px; font-weight:600; color:#374151; display:block; margin-bottom:4px;">Initial Stock *</label>
                <input class="input" type="number" id="sp_stock" placeholder="Enter quantity" min="0" style="width:100%;">
              </div>
              <div>
                <label style="font-size:13px; font-weight:600; color:#d97706; display:block; margin-bottom:4px;">Owner Price (₹)</label>
                <input class="input" type="number" id="sp_ownerPrice" placeholder="Cost price" min="0" style="width:100%;">
              </div>
              <div>
                <label style="font-size:13px; font-weight:600; color:#16a34a; display:block; margin-bottom:4px;">Customer Price (₹)</label>
                <input class="input" type="number" id="sp_customerPrice" placeholder="Selling price" min="0" style="width:100%;">
              </div>
            </div>
            <div style="display:flex; gap:12px; margin-top:16px;">
              <button class="btn btn-primary" onclick="app.saveSparePart()" style="padding:10px 24px;">💾 Save Part</button>
              <button class="btn btn-secondary" onclick="app.toggleSparePartsForm()" style="padding:10px 24px;">Cancel</button>
            </div>
          </div>
          <div style="margin-bottom:16px; display:flex; gap:12px; align-items:center;">
            <div style="flex:1;">
              <input class="input" id="sparePartsSearchInput" placeholder="🔍 Search by part name or ID..."
                style="width:100%; background:#fff; color:#111; border:1px solid #d1d5db;"
                oninput="app.searchSpareParts(this.value)"
                value="${this.sparePartsSearch || ''}">
            </div>
            <span style="color:#fff; font-size:14px; font-weight:600; white-space:nowrap;">${filtered.length} items</span>
          </div>
          ${lowStock.length > 0 ? `
            <div style="background:#fef2f2; border:2px solid #fca5a5; border-radius:10px; padding:12px 18px; margin-bottom:16px; display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap;">
              <div style="display:flex; align-items:center; gap:10px;">
                <span style="font-size:20px;">⚠️</span>
                <span style="font-size:13px; color:#dc2626; font-weight:600;">Only 1 unit left — ${lowStock.map(d => d.partName).join(', ')}</span>
              </div>
              <button onclick="app.downloadSparePartsLowStockAlertPDF()" style="background:#1e293b; color:#fff; border:none; border-radius:7px; padding:6px 14px; font-size:12px; font-weight:700; cursor:pointer; white-space:nowrap;">📄 Download PDF</button>
            </div>
          ` : ''}
          ${filtered.length === 0 ? `
            <div style="text-align:center; padding:60px; color:#fff; font-size:16px;">
              <div style="font-size:48px; margin-bottom:16px;">🖥️</div>
              <p>No spare parts found. Add your first part!</p>
            </div>
          ` : `
            <div style="background:#fff; border-radius:12px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,0.15); border:2px solid #e2e8f0;">
              <div style="overflow-x:auto;">
                <table style="width:100%; border-collapse:collapse; font-size:13px; min-width:680px;">
                  <thead>
                    <tr style="background:#1e293b; color:#fff; text-align:left;">
                      <th style="padding:12px 14px; font-weight:700; border-right:1px solid #334155; width:36px;">#</th>
                      <th style="padding:12px 14px; font-weight:700; border-right:1px solid #334155; min-width:180px;">Part Name</th>
                      <th style="padding:12px 14px; font-weight:700; border-right:1px solid #334155; min-width:100px; text-align:center;">Owner Price (₹)</th>
                      <th style="padding:12px 14px; font-weight:700; border-right:1px solid #334155; min-width:110px; text-align:center;">Customer Price (₹)</th>
                      <th style="padding:12px 14px; font-weight:700; border-right:1px solid #334155; min-width:100px; text-align:center;">Stock</th>
                      <th style="padding:12px 14px; font-weight:700; border-right:1px solid #334155; min-width:170px; text-align:center;">
                        <div style="display:flex; flex-direction:column; align-items:center; gap:4px;">
                          <span>Total Value (₹) + Password</span>
                          <input type="password" id="spareTotalValuePassword" placeholder="Enter password"
                            value="${this.spareTotalValueUnlocked ? 'admin123' : ''}"
                            oninput="app.checkSpareTotalValuePassword(this.value)"
                            onkeydown="if(event.key === 'Enter') app.checkSpareTotalValuePassword(this.value, true)"
                            style="width:105px; padding:3px 6px; border:1px solid #cbd5e1; border-radius:4px; font-size:11px; text-align:center; color:#000; outline:none; font-weight:normal;">
                        </div>
                      </th>
                      <th style="padding:12px 14px; font-weight:700; border-right:1px solid #334155; min-width:200px; text-align:center;">Adjust Stock</th>
                      <th style="padding:12px 14px; font-weight:700; text-align:center; min-width:70px;">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${filtered.map((item, idx) => {
                      const stock = Number(item.stock) || 0;
                      const ownerPrice    = Number(item.ownerPrice) || 0;
                      const customerPrice = Number(item.customerPrice) || 0;
                      const totalValue = customerPrice * stock;
                      const stockColor = stock === 0 ? '#dc2626' : stock <= 1 ? '#dc2626' : stock <= 3 ? '#d97706' : '#16a34a';
                      const stockBg    = stock === 0 ? '#fef2f2' : stock <= 1 ? '#fef2f2' : stock <= 3 ? '#fffbeb' : '#f0fdf4';
                      const rowBg      = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
                      return `
                        <tr style="background:${rowBg}; border-bottom:1px solid #e2e8f0; transition:background 0.3s;"
                            onmouseover="this.style.background='#eff6ff'" onmouseout="this.style.background='${rowBg}'">
                          <td style="padding:10px 14px; color:#9ca3af; font-weight:600; border-right:1px solid #e2e8f0; text-align:center;">${idx + 1}</td>
                          <td style="padding:10px 14px; font-weight:700; color:#111827; border-right:1px solid #e2e8f0;">
                            ${item.partName}
                            ${stock <= 1 && stock > 0 ? `<span style="margin-left:6px; background:#fef2f2; color:#dc2626; font-size:10px; font-weight:800; padding:2px 7px; border-radius:4px; border:1px solid #fca5a5;">⚠️ LAST 1</span>` : ''}
                            ${stock === 0 ? `<span style="margin-left:6px; background:#fef2f2; color:#dc2626; font-size:10px; font-weight:800; padding:2px 7px; border-radius:4px; border:1px solid #fca5a5;">❌ OUT</span>` : ''}
                          </td>
                          <td style="padding:10px 14px; text-align:center; color:#d97706; font-weight:700; border-right:1px solid #e2e8f0;">
                            ${this.spareTotalValueUnlocked ? 
                              (ownerPrice ? `₹${ownerPrice.toLocaleString('en-IN')}` : '<span style="color:#9ca3af;">—</span>') :
                              '<span style="color:#94a3b8; font-family:monospace; font-size:14px;">••••</span>'
                            }
                          </td>
                          <td style="padding:10px 14px; text-align:center; color:#16a34a; font-weight:700; border-right:1px solid #e2e8f0;">
                            ${this.spareTotalValueUnlocked ? 
                              (customerPrice ? `₹${customerPrice.toLocaleString('en-IN')}` : '<span style="color:#9ca3af;">—</span>') :
                              '<span style="color:#94a3b8; font-family:monospace; font-size:14px;">••••</span>'
                            }
                          </td>
                          <td style="padding:10px 14px; text-align:center; border-right:1px solid #e2e8f0;">
                            <span style="display:inline-block; background:${stockBg}; color:${stockColor}; font-weight:900; font-size:18px; min-width:48px; padding:4px 10px; border-radius:6px; border:1px solid ${stockColor}40;">
                              ${stock}
                            </span>
                          </td>
                          <td style="padding:10px 14px; text-align:center; font-weight:700; color:#1d4ed8; border-right:1px solid #e2e8f0;">
                            ${this.spareTotalValueUnlocked ? 
                              (customerPrice && stock ? `₹${totalValue.toLocaleString('en-IN')}` : '<span style="color:#9ca3af;">—</span>') :
                              '<span style="color:#94a3b8; font-family:monospace; font-size:14px;">••••</span>'
                            }
                          </td>
                          <td style="padding:8px 14px; border-right:1px solid #e2e8f0;">
                            <div style="display:flex; gap:6px; align-items:center; justify-content:center;">
                              <input type="number" id="spqty_${item.partItemId}" min="1" value="1"
                                style="width:52px; padding:5px 6px; border:1px solid #d1d5db; border-radius:6px; font-size:13px; text-align:center; color:#111;">
                              <button onclick="app.adjustSparePart('${item.partItemId}', 1)"
                                style="background:#16a34a; color:#fff; border:none; border-radius:6px; padding:6px 12px; font-size:12px; font-weight:700; cursor:pointer; white-space:nowrap;">
                                ▲ In
                              </button>
                              <button onclick="app.adjustSparePart('${item.partItemId}', -1)"
                                style="background:#dc2626; color:#fff; border:none; border-radius:6px; padding:6px 12px; font-size:12px; font-weight:700; cursor:pointer; white-space:nowrap; ${stock===0?'opacity:0.45;cursor:not-allowed;':''}">
                                ▼ Out
                              </button>
                            </div>
                          </td>
                          <td style="padding:10px 14px; text-align:center;">
                            <div style="display:flex; gap:6px; justify-content:center;">
                              <button onclick="app.showEditSparePartModal('${item.partItemId}')"
                                style="background:#dbeafe; color:#1d4ed8; border:1px solid #93c5fd; border-radius:6px; padding:5px 10px; font-size:12px; cursor:pointer;" title="Edit">
                                ✏️
                              </button>
                              <button onclick="app.deleteSparePart('${item.partItemId}')"
                                style="background:#fee2e2; color:#dc2626; border:1px solid #fca5a5; border-radius:6px; padding:5px 10px; font-size:12px; cursor:pointer;" title="Delete">
                                🗑️
                              </button>
                            </div>
                          </td>
                        </tr>
                      `;
                    }).join('')}
                  </tbody>
                  <tfoot>
                    <tr style="background:#1e293b; color:#fff; font-weight:700;">
                      <td colspan="2" style="padding:12px 14px; font-size:13px; border-right:1px solid #334155;">📊 GRAND TOTAL</td>
                      <td style="padding:12px 14px; text-align:center; font-size:13px; border-right:1px solid #334155;">—</td>
                      <td style="padding:12px 14px; text-align:center; font-size:13px; border-right:1px solid #334155;">—</td>
                      <td style="padding:12px 14px; text-align:center; font-size:15px; font-weight:900; border-right:1px solid #334155;">
                        ${filtered.reduce((sum, d) => sum + (Number(d.stock) || 0), 0)} units
                      </td>
                      <td style="padding:12px 14px; text-align:center; font-size:15px; font-weight:900; color:#86efac; border-right:1px solid #334155;">
                        ${this.spareTotalValueUnlocked ? 
                          `₹${filtered.reduce((sum, d) => sum + ((Number(d.customerPrice) || 0) * (Number(d.stock) || 0)), 0).toLocaleString('en-IN')}` :
                          '<span style="color:#94a3b8; font-family:monospace; font-size:14px;">••••</span>'
                        }
                      </td>
                      <td colspan="2" style="padding:12px 14px; text-align:center; font-size:12px; color:#94a3b8;">
                        ${filtered.length} item${filtered.length !== 1 ? 's' : ''}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          `}
        </div>
      </div>`;
  }

  toggleSparePartsForm() {
    const f = document.getElementById('sparePartsForm');
    if (f) f.style.display = f.style.display === 'none' ? 'block' : 'none';
  }

  checkSpareTotalValuePassword(val, isSubmit = false) {
    const isCorrect = (val === 'admin123');
    if (isCorrect !== this.spareTotalValueUnlocked) {
      this.spareTotalValueUnlocked = isCorrect;
      this.renderPage('admin-spare-parts');
      setTimeout(() => {
        const input = document.getElementById('spareTotalValuePassword');
        if (input) {
          input.focus();
          input.value = val;
          input.setSelectionRange(val.length, val.length);
        }
      }, 50);
    } else if (isSubmit && !isCorrect) {
      alert('❌ Invalid password');
    }
  }

  searchSpareParts(value) {
    this.sparePartsSearch = value || '';
    clearTimeout(this._sparePartsSearchTimer);
    this._sparePartsSearchTimer = setTimeout(() => {
      if (this.currentPage === 'admin-spare-parts') {
        this.renderPage('admin-spare-parts');
      }
    }, 250);
  }

  async saveSparePart() {
    const partName      = document.getElementById('sp_partName')?.value?.trim();
    const partId        = document.getElementById('sp_partId')?.value?.trim();
    const stock         = document.getElementById('sp_stock')?.value;
    const ownerPrice    = document.getElementById('sp_ownerPrice')?.value;
    const customerPrice = document.getElementById('sp_customerPrice')?.value;

    if (!partName || !partId || stock === '' || stock === null) {
      alert('Please fill in Part Name, Part ID and Initial Stock.');
      return;
    }

    const data = {
      partName,
      partId,
      stock: Number(stock),
      ownerPrice:    ownerPrice    ? Number(ownerPrice)    : null,
      customerPrice: customerPrice ? Number(customerPrice) : null,
      history: [{ change: Number(stock), stockAfter: Number(stock), date: new Date().toLocaleDateString('en-IN') }]
    };

    try {
      const response = await fetch(`${this.API_URL}/spare-parts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (response.ok) {
        const saved = await response.json();
        this.sparePartsStock.unshift(saved);
        alert('✅ Spare part saved!');
        this.renderPage('admin-spare-parts');
      } else {
        alert('❌ Failed to save spare part.');
      }
    } catch (err) {
      console.error(err);
      alert('❌ Error saving spare part.');
    }
  }

  async adjustSparePart(partItemId, direction) {
    const qtyInput = document.getElementById(`spqty_${partItemId}`);
    const qty = Math.max(1, Number(qtyInput?.value) || 1);
    const item = (this.sparePartsStock || []).find(d => d.partItemId === partItemId);
    if (!item) return;

    const change = direction * qty;
    const newStock = Math.max(0, (Number(item.stock) || 0) + change);

    const historyEntry = {
      change,
      stockAfter: newStock,
      date: new Date().toLocaleDateString('en-IN')
    };

    try {
      const response = await fetch(`${this.API_URL}/spare-parts/${partItemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stock: newStock, historyEntry })
      });
      if (response.ok) {
        const updated = await response.json();
        const idx = this.sparePartsStock.findIndex(d => d.partItemId === partItemId);
        if (idx !== -1) this.sparePartsStock[idx] = updated;

        // Show low stock warning modal when stock reaches 1
        if (updated.stock === 1) {
          this.showSparePartsLowStockAlert(updated);
        }

        this.renderPage('admin-spare-parts');
      } else {
        alert('❌ Failed to update stock.');
      }
    } catch (err) {
      console.error(err);
      alert('❌ Error updating stock.');
    }
  }

  showSparePartsLowStockAlert(item) {
    const existing = document.getElementById('sparePartsLowStockModal');
    if (existing) existing.remove();

    const modalHTML = `
      <div id="sparePartsLowStockModal" onclick="if(event.target===this)this.remove()"
        style="position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;">
        <div style="background:#fff;border-radius:14px;padding:28px;max-width:420px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,0.4);text-align:center;">
          <div style="font-size:48px;margin-bottom:12px;">⚠️</div>
          <h2 style="font-size:20px;font-weight:800;color:#dc2626;margin-bottom:8px;">Low Stock Alert!</h2>
          <p style="font-size:15px;font-weight:700;color:#111;margin-bottom:6px;">${item.partName}</p>
          <p style="font-size:13px;color:#6b7280;margin-bottom:16px;">Only <strong style="color:#dc2626;">1 unit</strong> remaining in stock. Please reorder soon.</p>
          ${item.customerPrice ? `<p style="font-size:13px;color:#374151;margin-bottom:4px;">Customer Price: <strong>${this.spareTotalValueUnlocked ? '₹' + Number(item.customerPrice).toLocaleString('en-IN') : '••••'}</strong></p>` : ''}
          ${item.ownerPrice ? `<p style="font-size:13px;color:#374151;margin-bottom:20px;">Owner Price: <strong>${this.spareTotalValueUnlocked ? '₹' + Number(item.ownerPrice).toLocaleString('en-IN') : '••••'}</strong></p>` : ''}
          <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">
            <button onclick="app.downloadSparePartsLowStockPDF('${item.partItemId}')"
              style="background:#1e293b;color:#fff;border:none;border-radius:8px;padding:10px 20px;font-size:14px;font-weight:700;cursor:pointer;">
              📄 Download PDF
            </button>
            <button onclick="document.getElementById('sparePartsLowStockModal').remove()"
              style="background:#f1f5f9;color:#374151;border:1px solid #d1d5db;border-radius:8px;padding:10px 20px;font-size:14px;font-weight:600;cursor:pointer;">
              ✕ Dismiss
            </button>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
  }

  downloadSparePartsLowStockAlertPDF() {
    const lowItems = (this.sparePartsStock || []).filter(d => Number(d.stock) === 1);
    if (lowItems.length === 0) return;

    const win = window.open('', '_blank', 'width=700,height=500');
    const rows = lowItems.map((d, i) => `
      <tr style="background:${i % 2 === 0 ? '#fff' : '#fef2f2'}">
        <td>${i + 1}</td>
        <td style="font-weight:700;">${d.partName}</td>
        <td>${d.partId}</td>
        <td style="color:#dc2626;font-weight:900;">1 unit</td>
        <td style="color:#d97706;font-weight:700;">${this.spareTotalValueUnlocked ? (d.ownerPrice ? '₹' + Number(d.ownerPrice).toLocaleString('en-IN') : '—') : '••••'}</td>
        <td style="color:#16a34a;font-weight:700;">${this.spareTotalValueUnlocked ? (d.customerPrice ? '₹' + Number(d.customerPrice).toLocaleString('en-IN') : '—') : '••••'}</td>
      </tr>`).join('');

    win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Low Stock Alert — Spare Parts</title>
    <style>
      body{font-family:Arial,sans-serif;padding:30px;color:#111;}
      h2{color:#dc2626;}
      table{width:100%;border-collapse:collapse;font-size:13px;margin-top:16px;}
      th{background:#dc2626;color:#fff;padding:9px 12px;text-align:left;}
      td{padding:8px 12px;border-bottom:1px solid #e5e7eb;}
      .footer{margin-top:20px;font-size:12px;color:#6b7280;}
      @media print{button{display:none;}}
    </style></head><body>
    <h2>⚠️ Low Stock Alert — Spare Parts</h2>
    <p style="color:#6b7280;font-size:13px;">Generated: ${new Date().toLocaleString('en-IN')} &nbsp;|&nbsp; Items with only 1 unit remaining: ${lowItems.length}</p>
    <table>
      <thead><tr><th>#</th><th>Part Name</th><th>Part ID</th><th>Stock</th><th>Owner Price</th><th>Customer Price</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p style="margin-top:20px;font-size:13px;color:#dc2626;font-weight:700;">⚠️ Please reorder the above parts immediately!</p>
    <div class="footer">Manjula Mobile World | Ramapuram, Tamil Nadu | Ph: +91 82484 54841</div>
    <br>
    <button onclick="window.print()" style="padding:10px 24px;background:#1e293b;color:#fff;border:none;border-radius:6px;font-size:14px;cursor:pointer;">🖨️ Print / Save as PDF</button>
    </body></html>`);
    win.document.close();
    setTimeout(() => { try { win.focus(); } catch(e) {} }, 200);
  }

  downloadSparePartsLowStockPDF(partItemId) {
    const item = (this.sparePartsStock || []).find(d => d.partItemId === partItemId);
    if (!item) return;

    const win = window.open('', '_blank', 'width=600,height=500');
    win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Low Stock Alert</title>
    <style>
      body{font-family:Arial,sans-serif;padding:30px;color:#111;}
      h2{color:#dc2626;}
      .box{border:2px solid #dc2626;border-radius:8px;padding:20px;margin-top:16px;}
      .row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f3f4f6;font-size:14px;}
      .label{color:#6b7280;}
      .value{font-weight:700;}
      @media print{button{display:none;}}
    </style></head><body>
    <h2>⚠️ Low Stock Alert — Spare Parts</h2>
    <p style="color:#6b7280;font-size:13px;">Generated: ${new Date().toLocaleString('en-IN')}</p>
    <div class="box">
      <div class="row"><span class="label">Part Name</span><span class="value">${item.partName}</span></div>
      <div class="row"><span class="label">Part ID</span><span class="value">${item.partId}</span></div>
      <div class="row"><span class="label">Remaining Stock</span><span class="value" style="color:#dc2626;">1 unit</span></div>
      <div class="row"><span class="label">Owner Price</span><span class="value" style="color:#d97706;">${this.spareTotalValueUnlocked ? (item.ownerPrice ? '₹' + Number(item.ownerPrice).toLocaleString('en-IN') : '—') : '••••'}</span></div>
      <div class="row"><span class="label">Customer Price</span><span class="value" style="color:#16a34a;">${this.spareTotalValueUnlocked ? (item.customerPrice ? '₹' + Number(item.customerPrice).toLocaleString('en-IN') : '—') : '••••'}</span></div>
    </div>
    <p style="margin-top:20px;font-size:13px;color:#dc2626;font-weight:700;">⚠️ Please reorder this part immediately!</p>
    <br>
    <button onclick="window.print()" style="padding:10px 24px;background:#1e293b;color:#fff;border:none;border-radius:6px;font-size:14px;cursor:pointer;">🖨️ Print / Save as PDF</button>
    </body></html>`);
    win.document.close();
    setTimeout(() => { try { win.focus(); } catch(e) {} }, 200);
  }

  showEditSparePartModal(partItemId) {
    const item = (this.sparePartsStock || []).find(d => d.partItemId === partItemId);
    if (!item) return;

    const existing = document.getElementById('editSparePartModal');
    if (existing) existing.remove();

    const modalHTML = `
      <div id="editSparePartModal" onclick="if(event.target===this)this.remove()"
        style="position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;">
        <div style="background:#fff;border-radius:14px;padding:28px;max-width:520px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,0.4);">
          <h2 style="font-size:18px;font-weight:800;color:#111;margin-bottom:20px;">✏️ Edit Spare Part</h2>
          <div style="display:grid;gap:12px;">
            <div>
              <label style="font-size:13px;font-weight:600;color:#374151;display:block;margin-bottom:4px;">Part Name *</label>
              <input class="input" id="edit_sp_partName" value="${item.partName}" style="width:100%;background:#f8fafc;color:#111;border:1px solid #d1d5db;">
            </div>
            <div>
              <label style="font-size:13px;font-weight:600;color:#374151;display:block;margin-bottom:4px;">Part ID *</label>
              <input class="input" id="edit_sp_partId" value="${item.partId}" style="width:100%;background:#f8fafc;color:#111;border:1px solid #d1d5db;">
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;">
              <div>
                <label style="font-size:13px;font-weight:600;color:#d97706;display:block;margin-bottom:4px;">Owner Price (₹)</label>
                <input class="input" type="${this.spareTotalValueUnlocked ? 'number' : 'password'}" id="edit_sp_ownerPrice" value="${item.ownerPrice || ''}" placeholder="${this.spareTotalValueUnlocked ? 'Cost price' : '••••'}" ${this.spareTotalValueUnlocked ? '' : 'readonly'} min="0" style="width:100%;background:#f8fafc;color:#111;border:1px solid #d1d5db;">
              </div>
              <div>
                <label style="font-size:13px;font-weight:600;color:#16a34a;display:block;margin-bottom:4px;">Customer Price (₹)</label>
                <input class="input" type="${this.spareTotalValueUnlocked ? 'number' : 'password'}" id="edit_sp_customerPrice" value="${item.customerPrice || ''}" placeholder="${this.spareTotalValueUnlocked ? 'Selling price' : '••••'}" ${this.spareTotalValueUnlocked ? '' : 'readonly'} min="0" style="width:100%;background:#f8fafc;color:#111;border:1px solid #d1d5db;">
              </div>
              <div>
                <label style="font-size:13px;font-weight:600;color:#1d4ed8;display:block;margin-bottom:4px;">Stock Qty</label>
                <input class="input" type="number" id="edit_sp_stock" value="${item.stock || 0}" placeholder="Quantity" min="0" style="width:100%;background:#f8fafc;color:#111;border:1px solid #d1d5db;">
              </div>
            </div>
          </div>
          <div style="display:flex;gap:10px;margin-top:20px;">
            <button onclick="app.saveEditSparePart('${partItemId}')"
              style="flex:1;background:#1d4ed8;color:#fff;border:none;border-radius:8px;padding:12px;font-size:14px;font-weight:700;cursor:pointer;">
              💾 Save Changes
            </button>
            <button onclick="document.getElementById('editSparePartModal').remove()"
              style="flex:1;background:#f1f5f9;color:#374151;border:1px solid #d1d5db;border-radius:8px;padding:12px;font-size:14px;font-weight:600;cursor:pointer;">
              Cancel
            </button>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
  }

  async saveEditSparePart(partItemId) {
    const partName      = document.getElementById('edit_sp_partName')?.value?.trim();
    const partId        = document.getElementById('edit_sp_partId')?.value?.trim();
    const ownerPrice    = document.getElementById('edit_sp_ownerPrice')?.value;
    const customerPrice = document.getElementById('edit_sp_customerPrice')?.value;
    const stock         = document.getElementById('edit_sp_stock')?.value;

    if (!partName || !partId) {
      alert('Part Name and Part ID are required.');
      return;
    }

    try {
      const response = await fetch(`${this.API_URL}/spare-parts/${partItemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partName,
          partId,
          ownerPrice:    ownerPrice    ? Number(ownerPrice)    : null,
          customerPrice: customerPrice ? Number(customerPrice) : null,
          stock:         stock !== '' && stock !== undefined ? Number(stock) : undefined
        })
      });
      if (response.ok) {
        const updated = await response.json();
        const idx = this.sparePartsStock.findIndex(d => d.partItemId === partItemId);
        if (idx !== -1) this.sparePartsStock[idx] = updated;
        document.getElementById('editSparePartModal')?.remove();
        this.renderPage('admin-spare-parts');
      } else {
        alert('❌ Failed to update spare part.');
      }
    } catch (err) {
      console.error(err);
      alert('❌ Error updating spare part.');
    }
  }

  async deleteSparePart(partItemId) {
    if (!confirm('Delete this spare part? This cannot be undone.')) return;
    try {
      const response = await fetch(`${this.API_URL}/spare-parts/${partItemId}`, { method: 'DELETE' });
      if (response.ok) {
        this.sparePartsStock = this.sparePartsStock.filter(d => d.partItemId !== partItemId);
        this.renderPage('admin-spare-parts');
      } else {
        alert('❌ Failed to delete spare part.');
      }
    } catch (err) {
      console.error(err);
      alert('❌ Error deleting spare part.');
    }
  }

  exportSparePartsPDF() {
    const data = this.sparePartsStock || [];
    const win = window.open('', '_blank', 'width=1000,height=750');
    const rows = data.map((p, i) => {
      const stock         = Number(p.stock) || 0;
      const ownerPrice    = Number(p.ownerPrice) || 0;
      const customerPrice = Number(p.customerPrice) || 0;
      const stockColor = stock === 0 ? '#dc2626' : stock <= 3 ? '#d97706' : '#16a34a';
      return `
        <tr style="background:${i % 2 === 0 ? '#fff' : '#f8fafc'};">
          <td style="padding:8px 10px; border:1px solid #e2e8f0; text-align:center; color:#9ca3af;">${i + 1}</td>
          <td style="padding:8px 10px; border:1px solid #e2e8f0; font-weight:700;">${p.partName || '—'}</td>
          <td style="padding:8px 10px; border:1px solid #e2e8f0;">${p.partId || '—'}</td>
          <td style="padding:8px 10px; border:1px solid #e2e8f0; text-align:center; color:#d97706; font-weight:700;">${this.spareTotalValueUnlocked ? (ownerPrice ? '₹' + ownerPrice.toLocaleString('en-IN') : '—') : '••••'}</td>
          <td style="padding:8px 10px; border:1px solid #e2e8f0; text-align:center; color:#16a34a; font-weight:700;">${this.spareTotalValueUnlocked ? (customerPrice ? '₹' + customerPrice.toLocaleString('en-IN') : '—') : '••••'}</td>
          <td style="padding:8px 10px; border:1px solid #e2e8f0; text-align:center; font-weight:900; color:${stockColor};">${stock}</td>
          <td style="padding:8px 10px; border:1px solid #e2e8f0; text-align:center; font-weight:700; color:#1d4ed8;">${this.spareTotalValueUnlocked ? (customerPrice && stock ? '₹' + (customerPrice * stock).toLocaleString('en-IN') : '—') : '••••'}</td>
        </tr>`;
    }).join('');
    const totalUnits = data.reduce((s, p) => s + (Number(p.stock) || 0), 0);
    const totalValue = data.reduce((s, p) => s + ((Number(p.customerPrice) || 0) * (Number(p.stock) || 0)), 0);
    win.document.write(`
      <html><head><title>Spare Parts - Manjula Mobile World</title>
      <style>body{font-family:Arial,sans-serif;padding:20px;} table{width:100%;border-collapse:collapse;font-size:12px;} th{background:#1e293b;color:#fff;padding:10px;text-align:left;} tfoot td{background:#1e293b;color:#fff;font-weight:700;padding:10px;}</style>
      </head><body>
      <h2 style="margin-bottom:4px;">� Spare Parts — Manjula Mobile World</h2>
      <p style="color:#64748b; font-size:12px; margin-bottom:16px;">Generated: ${new Date().toLocaleString('en-IN')}</p>
      <table>
        <thead><tr><th>#</th><th>Part Name</th><th>Part ID</th><th>Owner Price</th><th>Customer Price</th><th>Stock</th><th>Total Value</th></tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr><td colspan="5" style="text-align:right;">GRAND TOTAL</td><td style="text-align:center;">${totalUnits} units</td><td style="text-align:center;">${this.spareTotalValueUnlocked ? '₹' + totalValue.toLocaleString('en-IN') : '••••'}</td></tr></tfoot>
      </table>
      <script>window.print();<\/script>
      </body></html>`);
    win.document.close();
  }

  exportSparePartsXL() {
    const data = this.sparePartsStock || [];
    const headers = ['#', 'Part Name', 'Part ID', 'Owner Price (₹)', 'Customer Price (₹)', 'Stock Qty', 'Total Value (₹)'];
    const rows = data.map((p, i) => [
      i + 1,
      p.partName || '',
      p.partId || '',
      this.spareTotalValueUnlocked ? (Number(p.ownerPrice) || 0) : '••••',
      this.spareTotalValueUnlocked ? (Number(p.customerPrice) || 0) : '••••',
      Number(p.stock) || 0,
      this.spareTotalValueUnlocked ? ((Number(p.customerPrice) || 0) * (Number(p.stock) || 0)) : '••••'
    ]);
    const totalUnits = data.reduce((s, p) => s + (Number(p.stock) || 0), 0);
    const totalValue = data.reduce((s, p) => s + ((Number(p.customerPrice) || 0) * (Number(p.stock) || 0)), 0);
    rows.push(['', 'GRAND TOTAL', '', '', '', totalUnits, this.spareTotalValueUnlocked ? totalValue : '••••']);

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `spare-parts-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
}

// Initialize Owner Portal App
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initOwnerApp);
} else {
  initOwnerApp();
}

function initOwnerApp() {
  try {
    console.log('🚀 Initializing Owner Portal...');
    const app = new OwnerPortalApp();
    window.app = app; // Make app globally accessible
    console.log('✅ Owner Portal initialized successfully');
  } catch (error) {
    console.error('❌ Owner Portal initialization error:', error);
    document.getElementById('app').innerHTML = `
      <div style="padding: 40px; text-align: center; font-family: Arial, sans-serif;">
        <h1 style="color: #dc2626; margin-bottom: 20px;">⚠️ Error Loading Owner Portal</h1>
        <p style="color: #666; margin-bottom: 20px;">There was an error initializing the owner portal.</p>
        <div style="background: #fef2f2; border: 2px solid #fecaca; border-radius: 8px; padding: 20px; margin: 20px auto; max-width: 600px; text-align: left;">
          <strong>Error Details:</strong>
          <pre style="margin-top: 10px; color: #dc2626; overflow-x: auto;">${error.message}\n\n${error.stack}</pre>
        </div>
        <button onclick="location.reload()" style="margin-top: 20px; padding: 12px 24px; background: #dc2626; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 16px;">
          Retry
        </button>
      </div>
    `;
  }
}