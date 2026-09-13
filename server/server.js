const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
require('dotenv').config();

// Override DNS to use Google DNS (fixes SRV lookup issues on some networks)
const dns = require('dns');
if (process.env.NODE_ENV !== 'production') {
  try {
    dns.setServers(['8.8.8.8', '8.8.4.4']);
    console.log('📡 Local DNS configured: Google DNS');
  } catch (err) {
    console.warn('⚠️ Failed to set Google DNS servers:', err.message);
  }
}
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}

// Import keep-alive service
require('../keep-alive');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true
  },
  transports: ['websocket', 'polling'],
  allowEIO3: true,
  pingTimeout: 60000,
  pingInterval: 25000
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Increase payload limit for images
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serve static files from client directory
const clientPath = path.join(__dirname, '../client');
console.log('📁 Serving static files from:', clientPath);
console.log('🚀 Deploy version: 20260517a');
app.use(express.static(clientPath, {
  etag: false,
  lastModified: false,
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.js') || filePath.endsWith('.html') || filePath.endsWith('.css')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  }
}));

// MongoDB Connection with optimized settings and faster timeout
const MONGODB_URI = process.env.MONGO_URI;

mongoose.connect(MONGODB_URI, {
  maxPoolSize: 20,
  minPoolSize: 5,
  serverSelectionTimeoutMS: 15000,
  socketTimeoutMS: 30000,
  connectTimeoutMS: 15000,
  family: 4
})
  .then(() => {
    console.log('✅ Connected to MongoDB');
    console.log('📊 Connection pool size: 10');
    
    // Drop the problematic 'id' index if it exists (after connection is established)
    Product.collection.dropIndex('id_1').then(() => {
      console.log('✅ Dropped id_1 index');
    }).catch(err => {
      if (err.code === 27) {
        console.log('ℹ️ Index id_1 does not exist (this is fine)');
      } else {
        console.log('ℹ️ Could not drop index:', err.message);
      }
    });
  })
  .catch(err => {
    console.error('❌ MongoDB connection error:', err.message);
    console.log('⚠️ Running in offline mode - using fallback data');
  });

// Product Schema
const productSchema = new mongoose.Schema({
  name: { type: String, index: true },
  category: { type: String, index: true },
  price: Number,
  originalPrice: Number,
  ownerPrice: Number,
  stock: { type: Number, default: 0 },
  image: String,
  imageUrl: String,
  imageUrl2: String,
  rating: Number,
  reviews: Number,
  inStock: { type: Boolean, index: true },
  badge: String,
  qrId: String,
  qrPassword: String,
  trackingStatus: String,
  ownerGender: String
}, { 
  timestamps: true,
  // Optimize for read performance
  autoIndex: true
});

// Add compound index for common queries
productSchema.index({ category: 1, inStock: 1 });
productSchema.index({ createdAt: 1 });

const Product = mongoose.model('Product', productSchema);

// Tracking Schema
const trackingSchema = new mongoose.Schema({
  qrId: { type: String, required: true, unique: true },
  qrPassword: String,
  customerName: String,
  productName: String,
  deviceModel: String,
  contact: String,
  address: String,
  dateIn: String,
  dateOut: String,
  status: String,
  issue: String,
  estimatedDays: Number,
  amount: { type: Number, default: 0 },
  advanceAmount: { type: Number, default: 0 },
  paidAmount:    { type: Number, default: 0 },
  totalReceived: { type: Number, default: 0 },
  balanceAmount: { type: Number, default: 0 },
  balancePaidDate: String,
  createdAt: String,
  completedAt: String,
  lastUpdated: String
}, { timestamps: true, strict: false });

const Tracking = mongoose.model('Tracking', trackingSchema);

// Order Schema
const orderSchema = new mongoose.Schema({
  orderId: { type: String, required: true, unique: true },
  customer: {
    name: String,
    phone: String,
    email: String,
    address: String
  },
  items: [{
    id: Number,
    name: String,
    price: Number,
    quantity: Number,
    image: String
  }],
  total: Number,
  paymentMethod: String,
  status: { type: String, default: 'Pending' },
  orderDate: { type: Date, default: Date.now },
  paymentScreenshot: {
    imageUrl: String, // URL to the uploaded image (local or cloud)
    data: String, // Base64 data as backup
    fileName: String,
    uploadTime: String
  }
}, { 
  timestamps: true,
  strict: false // Allow additional fields that might not be in schema
});

const Order = mongoose.model('Order', orderSchema);

// Sales Record Schema
const salesSchema = new mongoose.Schema({
  saleId: { type: String, required: true, unique: true },
  customerName: { type: String, required: true },
  phoneNumber: { type: String, required: true },
  customerAddress: String,
  productName: { type: String, required: true },
  productItems: { type: Array, default: [] },  // multi-item support
  productModel: String,
  imeiNumber: String,
  saleAmount: Number,
  discount: { type: Number, default: 0 },
  purchaseDate: { type: String, required: true },
  warrantyPeriod: String,
  notes: String,
  createdAt: { type: String }
}, { timestamps: true });

const SalesRecord = mongoose.model('SalesRecord', salesSchema);

// Services Schema
const serviceSchema = new mongoose.Schema({
  serviceId: { type: String, required: true, unique: true },
  customerName: { type: String, required: true },
  phoneNumber: { type: String, required: true },
  customerAddress: String,
  price: Number,
  advance: Number,
  serviceDate: { type: String, required: true },
  status: { type: String, default: 'Received' },
  serviceDetails: { type: String, required: true }
}, { timestamps: true });

const ServiceRecord = mongoose.model('ServiceRecord', serviceSchema);

// Display Stock Schema
const displayStockSchema = new mongoose.Schema({
  stockItemId:  { type: String, required: true, unique: true },
  displayName:  { type: String, required: true },
  displayId:    { type: String, required: true },
  barcode:      { type: String, default: "" },
  stock:        { type: Number, default: 0 },
  price:        { type: Number, default: null },
  ownerPrice:   { type: Number, default: null },
  customerPrice:{ type: Number, default: null },
  history:      { type: Array, default: [] }
}, { timestamps: true });

const DisplayStock = mongoose.model('DisplayStock', displayStockSchema);

// Spare Parts Stock Schema
const sparePartsSchema = new mongoose.Schema({
  partItemId:    { type: String, required: true, unique: true },
  partName:      { type: String, required: true },
  partId:        { type: String, required: true },
  stock:         { type: Number, default: 0 },
  ownerPrice:    { type: Number, default: null },
  customerPrice: { type: Number, default: null },
  history:       { type: Array, default: [] }
}, { timestamps: true });

const SpareParts = mongoose.model('SpareParts', sparePartsSchema);

// Distributor Schema
const distributorSchema = new mongoose.Schema({
  distributorId: { type: String, required: true, unique: true },
  name: { type: String, required: true, trim: true },
  mobile: { type: String, required: true, trim: true },
  purchaseCount: { type: Number, default: 0 },
  lastPurchaseDate: { type: String, default: "" }
}, { timestamps: true });

const Distributor = mongoose.model('Distributor', distributorSchema);

// Distributor Product Schema (Independent from main Product schema)
const distributorProductSchema = new mongoose.Schema({
  distributorProductId: { type: String, required: true, unique: true },
  distributorId: { type: String, required: true, index: true },
  distributorName: { type: String, default: "" },
  productName: { type: String, required: true, trim: true, index: true },
  barcode: { type: String, trim: true, default: "", index: true },
  currentStock: { type: Number, default: 0 },
  distributorPrice: { type: Number, default: 0 },
  ownerPrice: { type: Number, default: 0 },
  customerPrice: { type: Number, default: 0 }
}, { timestamps: true });

const DistributorProduct = mongoose.model('DistributorProduct', distributorProductSchema);

// Distributor Purchase Schema (Immutable Purchase History & Bills)
const distributorPurchaseSchema = new mongoose.Schema({
  purchaseId: { type: String, required: true, unique: true },
  billNumber: { type: String, required: true, unique: true },
  distributorId: { type: String, required: true, index: true },
  distributorName: { type: String, required: true },
  distributorMobile: { type: String, required: true },
  purchaseDate: { type: String, required: true },
  purchaseTime: { type: String, required: true },
  month: { type: String, required: true },
  year: { type: Number, required: true },
  items: [{
    distributorProductId: String,
    productName: String,
    barcode: String,
    quantity: Number,
    distributorPrice: Number,
    ownerPrice: Number,
    customerPrice: Number,
    itemTotal: Number
  }],
  totalProducts: { type: Number, default: 0 },
  totalQuantity: { type: Number, default: 0 },
  totalAmount: { type: Number, default: 0 }
}, { timestamps: true });

const DistributorPurchase = mongoose.model('DistributorPurchase', distributorPurchaseSchema);

const uploadImageToCloud = async (base64Data, fileName) => {
  try {
    // File saving disabled - screenshots only stored in database as base64
    console.log('📸 File saving disabled - screenshots stored in database only');
    return null; // No file URL returned
    
    /* File saving functionality disabled
    const base64Image = base64Data.split(',')[1];
    console.log('📸 Using local storage for image upload');
    return await saveImageLocally(base64Data, fileName);
    */
  } catch (error) {
    console.error('❌ Cloud upload disabled');
    return null;
  }
};

// File saving disabled - screenshots only stored in database
const saveImageLocally = async (base64Data, fileName) => {
  console.log('📸 File saving disabled - screenshots stored in database only');
  return null; // No file saving
  
  /* File saving functionality disabled
  try {
    const fs = require('fs');
    const path = require('path');
    
    // Create uploads directory if it doesn't exist
    const uploadsDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    
    // Remove the data:image/...;base64, prefix
    const base64Image = base64Data.split(',')[1];
    const buffer = Buffer.from(base64Image, 'base64');
    
    // Generate unique filename
    const timestamp = Date.now();
    const extension = fileName.split('.').pop() || 'png';
    const uniqueFileName = `screenshot-${timestamp}.${extension}`;
    const filePath = path.join(uploadsDir, uniqueFileName);
    
    // Save file
    fs.writeFileSync(filePath, buffer);
    
    // Return URL path
    return `/uploads/${uniqueFileName}`;
  } catch (error) {
    console.error('❌ Local save failed:', error);
    throw error;
  }
  */
};

// Serve uploaded images
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// SEO Routes
app.get('/sitemap.xml', (req, res) => {
  res.sendFile(path.join(clientPath, 'sitemap.xml'));
});

app.get('/robots.txt', (req, res) => {
  res.sendFile(path.join(clientPath, 'robots.txt'));
});

app.get('/google5739f7b57b6f777b.html', (req, res) => {
  res.sendFile(path.join(clientPath, 'google5739f7b57b6f777b.html'));
});

app.get('/business-info.json', (req, res) => {
  res.sendFile(path.join(clientPath, 'business-info.json'));
});

// Health check endpoint for keep-alive and monitoring
app.get('/health', (req, res) => {
  const healthCheck = {
    uptime: process.uptime(),
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    memory: process.memoryUsage(),
    pid: process.pid
  };
  
  console.log(`🏥 Health check requested at ${healthCheck.timestamp}`);
  res.status(200).json(healthCheck);
});

// Keep-alive endpoint (lightweight)
app.get('/ping', (req, res) => {
  res.status(200).json({ 
    status: 'alive', 
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime())
  });
});

// Admin Login endpoint — verifies credentials server-side using HMAC-SHA256
const crypto = require('crypto');
const nodemailer = require('nodemailer');

// In-memory store for active OTPs (phone -> { otp, expiresAt })
const currentOtps = {};

// Send OTP email helper function
const sendOtpEmail = async (otp) => {
  const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
  const smtpPort = parseInt(process.env.SMTP_PORT || '587');
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const resendApiKey = process.env.RESEND_API_KEY;

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; background-color: #ffffff;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h2 style="color: #dc2626; margin: 0; font-size: 24px;">Manjula Mobile World</h2>
        <p style="color: #64748b; margin: 4px 0 0 0; font-size: 14px;">Owner Portal Secure Authentication</p>
      </div>
      <div style="background-color: #f8fafc; border-radius: 8px; padding: 18px; text-align: center; margin-bottom: 24px;">
        <p style="color: #475569; margin: 0 0 10px 0; font-size: 14px;">Your One-Time Password (OTP) for admin access is:</p>
        <span style="font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #1e293b;">${otp}</span>
        <p style="color: #94a3b8; margin: 10px 0 0 0; font-size: 11px;">This OTP is valid for 5 minutes. Do not share it with anyone.</p>
      </div>
      <p style="color: #475569; font-size: 13px; line-height: 1.5; margin-bottom: 0;">
        If you did not request this login, please change your admin credentials immediately.
      </p>
    </div>
  `;

  // Decide delivery order: Prioritize SMTP locally in development (goes to Inbox),
  // and prioritize Resend in production on Render (where SMTP port 587 is blocked).
  const isProduction = process.env.NODE_ENV === 'production';
  const deliveryOrder = isProduction ? ['resend', 'smtp'] : ['smtp', 'resend'];

  for (const method of deliveryOrder) {
    // Method: Resend HTTP API
    if (method === 'resend' && resendApiKey) {
      console.log('📡 Attempting to send OTP email via Resend HTTP API...');
      try {
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: 'Manjula Mobile World <onboarding@resend.dev>',
            to: smtpUser || 'manjulamobiles125@gmail.com',
            subject: '🔐 Admin Login OTP - Manjula Mobile World',
            html: htmlContent
          })
        });

        const resData = await response.json();
        if (response.ok) {
          console.log('✉️ OTP email successfully sent via Resend HTTP API:', resData.id);
          return { success: true };
        } else {
          console.warn('⚠️ Resend HTTP API returned error:', resData);
        }
      } catch (apiErr) {
        console.error('❌ Resend HTTP API request failed:', apiErr);
      }
    }

    // Method: Standard SMTP fallback / Local SMTP
    if (method === 'smtp' && smtpUser && smtpPass) {
      console.log('📡 Attempting to send OTP email via SMTP...');
      try {
        // Manually resolve hostname to IPv4 to prevent IPv6 ENETUNREACH issues on cloud hosts (like Render)
        let resolvedHost = smtpHost;
        try {
          const dnsPromises = require('dns').promises;
          if (/[a-zA-Z]/.test(smtpHost)) {
            const addresses = await dnsPromises.resolve4(smtpHost);
            if (addresses && addresses.length > 0) {
              resolvedHost = addresses[0];
            }
          }
        } catch (dnsErr) {
          // Ignore DNS resolution errors for SMTP host
        }

        const transporter = nodemailer.createTransport({
          host: resolvedHost,
          port: smtpPort,
          secure: smtpPort === 465,
          auth: {
            user: smtpUser,
            pass: smtpPass
          },
          connectionTimeout: 5000, // 5 seconds
          greetingTimeout: 5000,   // 5 seconds
          socketTimeout: 10000,    // 10 seconds
          family: 4,               // Force IPv4 socket connection
          tls: {
            servername: smtpHost,   // Force TLS SNI to validate against the original domain (e.g. smtp.gmail.com)
            rejectUnauthorized: false // Avoid strict certificate failures when using IP direct connection
          }
        });

        const mailOptions = {
          from: `"Manjula Mobile World" <${smtpUser}>`,
          to: smtpUser || 'manjulamobiles125@gmail.com',
          subject: '🔐 Admin Login OTP - Manjula Mobile World',
          html: htmlContent
        };

        await transporter.sendMail(mailOptions);
        console.log(`✉️ OTP email successfully sent to ${smtpUser || 'manjulamobiles125@gmail.com'} via SMTP`);
        return { success: true };
      } catch (smtpErr) {
        console.error('❌ SMTP sending failed:', smtpErr.message);
      }
    }
  }

  // If both methods failed/were skipped
  console.log('⚠️ Both Resend and SMTP failed to send the email.');
  return { success: false, reason: 'All configured email delivery services failed.' };
};

// Send OTP Route
app.post('/api/admin/send-otp', async (req, res) => {
  const { phone, password } = req.body;

  const expectedPhone = process.env.ADMIN_PHONE        || '9840694616';
  const salt          = process.env.ADMIN_SALT         || 'mmw2026';
  const expectedHash  = process.env.ADMIN_PASSWORD_HASH || '2cb298af21d955b3da5139b96971eef8f23b3d7e6a2f54dc7c3aa9d208b5750d';

  const inputHash = crypto.createHmac('sha256', salt).update(password || '').digest('hex');

  if (phone !== expectedPhone || inputHash !== expectedHash) {
    console.warn('⚠️ OTP request failed: Invalid credentials for phone:', phone);
    return res.status(401).json({ success: false, message: 'Invalid phone number or password' });
  }

  // Generate 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  currentOtps[phone] = {
    otp,
    expiresAt: Date.now() + 5 * 60 * 1000 // 5 minutes validity
  };
  console.log(`🔑 [OTP Generation] Generated OTP for ${phone} is: ${otp}`);

  try {
    const mailResult = await sendOtpEmail(otp);
    if (mailResult.success) {
      return res.json({ success: true, message: 'OTP sent to registered email address.' });
    } else {
      return res.json({ 
        success: true, 
        warning: true, 
        message: 'OTP generated. Mail delivery failed (SMTP credentials not configured in .env). Check server console for OTP.' 
      });
    }
  } catch (error) {
    console.error('❌ Error sending OTP mail:', error);
    // Print OTP to logs as fallback
    console.log(`🔑 [OTP Verification Fallback] Generated OTP for ${phone}: ${otp}`);
    return res.json({ 
      success: true, 
      warning: true, 
      message: `OTP generated. Mail sending error: ${error.message}. Check server console for OTP.` 
    });
  }
});

// Admin Login endpoint — verifies credentials and checks OTP
app.post('/api/admin/login', (req, res) => {
  const { phone, password, otp } = req.body;

  const expectedPhone = process.env.ADMIN_PHONE        || '9840694616';
  const salt          = process.env.ADMIN_SALT         || 'mmw2026';
  const expectedHash  = process.env.ADMIN_PASSWORD_HASH || '2cb298af21d955b3da5139b96971eef8f23b3d7e6a2f54dc7c3aa9d208b5750d';

  const inputHash = crypto.createHmac('sha256', salt).update(password || '').digest('hex');

  if (phone !== expectedPhone || inputHash !== expectedHash) {
    console.warn('⚠️ Failed admin login attempt for phone (invalid credentials):', phone);
    return res.status(401).json({ success: false, message: 'Invalid phone number or password' });
  }

  // Validate OTP
  const backupOtp = process.env.ADMIN_BACKUP_OTP;
  if (backupOtp && String(otp).trim() === String(backupOtp).trim()) {
    console.log('🔑 Admin logged in using EMERGENCY BACKUP OTP');
    delete currentOtps[phone];
    return res.json({ success: true });
  }

  const record = currentOtps[phone];
  if (!record) {
    return res.status(400).json({ success: false, message: 'Please request an OTP first.' });
  }

  if (Date.now() > record.expiresAt) {
    delete currentOtps[phone];
    return res.status(400).json({ success: false, message: 'OTP has expired. Please request a new one.' });
  }

  if (record.otp !== String(otp).trim()) {
    return res.status(400).json({ success: false, message: 'Invalid OTP. Please check and try again.' });
  }

  // OTP verified, remove it
  delete currentOtps[phone];

  console.log('✅ Admin login successful (OTP verified)');
  return res.json({ success: true });
});

// DIRECT TEST - Add this button to test screenshot saving directly
app.post('/api/direct-test', async (req, res) => {
  try {
    console.log('🧪 DIRECT TEST: Creating order with screenshot...');
    
    const testOrder = {
      orderId: 'DIRECT-TEST-' + Date.now(),
      customer: {
        name: 'Test User',
        phone: '1234567890',
        email: 'test@test.com',
        address: 'Test Address'
      },
      items: [{
        id: 1,
        name: 'Test Item',
        price: 100,
        quantity: 1
      }],
      total: 100,
      paymentMethod: 'UPI Payment (Screenshot Uploaded)',
      status: 'Payment Verification Pending',
      paymentScreenshot: {
        data: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
        fileName: 'test-screenshot.png',
        uploadTime: new Date().toISOString()
      }
    };
    
    console.log('🧪 Test order object:', {
      orderId: testOrder.orderId,
      hasScreenshot: !!testOrder.paymentScreenshot,
      screenshotDataLength: testOrder.paymentScreenshot.data.length
    });
    
    const order = new Order(testOrder);
    const savedOrder = await order.save();
    
    console.log('✅ DIRECT TEST: Order saved successfully:', {
      orderId: savedOrder.orderId,
      hasScreenshot: !!savedOrder.paymentScreenshot,
      screenshotDataLength: savedOrder.paymentScreenshot?.data?.length,
      allFields: Object.keys(savedOrder.toObject())
    });
    
    res.json({
      success: true,
      orderId: savedOrder.orderId,
      hasScreenshot: !!savedOrder.paymentScreenshot,
      screenshotDataLength: savedOrder.paymentScreenshot?.data?.length
    });
    
  } catch (error) {
    console.error('❌ DIRECT TEST FAILED:', error);
    res.status(500).json({ error: error.message, stack: error.stack });
  }
});

// Test endpoint to see what data we receive
app.post('/api/debug-order', (req, res) => {
  console.log('🔍 DEBUG: Received request body keys:', Object.keys(req.body));
  console.log('🔍 DEBUG: Has paymentScreenshot:', !!req.body.paymentScreenshot);
  console.log('🔍 DEBUG: PaymentScreenshot keys:', req.body.paymentScreenshot ? Object.keys(req.body.paymentScreenshot) : 'none');
  console.log('🔍 DEBUG: Screenshot data length:', req.body.paymentScreenshot?.data?.length);
  console.log('🔍 DEBUG: Full request body structure:', JSON.stringify(req.body, null, 2).substring(0, 1000));
  res.json({ received: true, hasScreenshot: !!req.body.paymentScreenshot });
});

// Test endpoint to verify schema works with screenshot data
app.post('/api/test-screenshot', async (req, res) => {
  try {
    console.log('🧪 Testing screenshot save capability...');
    
    const testOrder = new Order({
      orderId: 'TEST-' + Date.now(),
      customer: { name: 'Test User', phone: '1234567890', email: 'test@test.com', address: 'Test Address' },
      items: [{ id: 1, name: 'Test Item', price: 100, quantity: 1 }],
      total: 100,
      paymentMethod: 'Test Payment',
      status: 'Test',
      paymentScreenshot: {
        data: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
        fileName: 'test.png',
        uploadTime: new Date().toISOString()
      }
    });
    
    const saved = await testOrder.save();
    console.log('✅ Test order saved with screenshot:', !!saved.paymentScreenshot);
    
    // Clean up test order
    await Order.deleteOne({ orderId: saved.orderId });
    
    res.json({ success: true, hasScreenshot: !!saved.paymentScreenshot });
  } catch (error) {
    console.error('❌ Test failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// Socket.IO connection
let connectedClients = 0;
io.on('connection', (socket) => {
  connectedClients++;
  console.log('👤 Client connected:', socket.id);
  console.log('📊 Total connected clients:', connectedClients);
  
  socket.on('disconnect', (reason) => {
    connectedClients--;
    console.log('👋 Client disconnected:', socket.id, '- Reason:', reason);
    console.log('📊 Total connected clients:', connectedClients);
  });

  socket.on('error', (error) => {
    console.error('❌ Socket error:', error);
  });
});

// Product Routes

// Simple in-memory cache for products
let productsCache = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 60000; // 60 seconds - longer cache for speed

// Fallback products data for when database is unavailable
const fallbackProducts = [
  {
    id: "fallback-1",
    name: "iPhone 15 Pro Max",
    category: "Smartphones",
    price: 134900,
    originalPrice: 159900,
    image: "📱",
    imageUrl: "https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/iphone-15-pro-max-naturaltitanium-select?wid=470&hei=556&fmt=png-alpha&.v=1692845702781",
    rating: 4.8,
    reviews: 1250,
    inStock: true,
    badge: "New"
  },
  {
    id: "fallback-2", 
    name: "Samsung Galaxy S24 Ultra",
    category: "Smartphones",
    price: 124999,
    originalPrice: 139999,
    image: "📱",
    imageUrl: "https://images.samsung.com/is/image/samsung/p6pim/in/2401/gallery/in-galaxy-s24-ultra-s928-sm-s928bztqins-thumb-539573073",
    rating: 4.7,
    reviews: 890,
    inStock: true,
    badge: "Popular"
  },
  {
    id: "fallback-3",
    name: "Screen Replacement Service",
    category: "Services", 
    price: 2999,
    originalPrice: 4999,
    image: "🔧",
    rating: 4.9,
    reviews: 450,
    inStock: true,
    badge: "Service"
  }
];

// Get all products
app.get('/api/products', async (req, res) => {
  try {
    const startTime = Date.now();
    
    // Check cache first
    const now = Date.now();
    if (productsCache && (now - cacheTimestamp) < CACHE_DURATION) {
      console.log('📦 Serving products from cache (instant)');
      // Set cache headers for browser caching
      res.set('Cache-Control', 'public, max-age=60');
      return res.json(productsCache);
    }

    console.log('📡 Fetching products from database...');
    
    // Check if mongoose is connected
    if (mongoose.connection.readyState !== 1) {
      console.log('⚠️ Database not connected, using fallback data');
      res.set('Cache-Control', 'public, max-age=30');
      return res.json(fallbackProducts);
    }
    
    // Use lean() for faster queries with timeout
    const products = await Product.find()
      .lean()
      .select('-__v -updatedAt -createdAt') // Exclude unnecessary fields for speed
      .limit(100) // Limit results for faster loading
      .sort({ _id: -1 }) // Sort by _id is faster than createdAt
      .maxTimeMS(3000); // 3 second timeout for faster response
    
    // Transform MongoDB _id to id for client compatibility
    const transformedProducts = products.map(p => ({
      ...p,
      id: p._id.toString()
    }));
    
    // Update cache
    productsCache = transformedProducts;
    cacheTimestamp = now;
    
    const duration = Date.now() - startTime;
    console.log(`✅ Returning ${transformedProducts.length} products (took ${duration}ms)`);
    
    // Set cache headers
    res.set('Cache-Control', 'public, max-age=60');
    res.json(transformedProducts);
  } catch (error) {
    console.error('❌ Error fetching products:', error.message);
    
    // Return fallback data on any error
    console.log('⚠️ Using fallback products due to database error');
    res.set('Cache-Control', 'public, max-age=30');
    res.json(fallbackProducts);
  }
});

// Create a new product
app.post('/api/products', async (req, res) => {
  try {
    console.log('📦 [SERVER] Creating new product:', req.body.name);
    
    // Check if mongoose is connected
    if (mongoose.connection.readyState !== 1) {
      console.log('⚠️ Database not connected, cannot create product');
      return res.status(503).json({ 
        error: 'Database not available. Please try again later.',
        offline: true 
      });
    }

    const product = new Product(req.body);
    
    // Add timeout to save operation
    const savedProduct = await Promise.race([
      product.save(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Save operation timed out')), 8000)
      )
    ]);
    
    const transformedProduct = {
      ...savedProduct.toObject(),
      id: savedProduct._id.toString()
    };
    
    // Invalidate cache
    productsCache = null;
    
    console.log('✅ [SERVER] Product created successfully:', transformedProduct.id);
    io.emit('product-added', transformedProduct);
    res.json(transformedProduct);
  } catch (error) {
    console.error('❌ [SERVER] Error creating product:', error.message);
    
    if (error.message.includes('timed out') || error.message.includes('buffering timed out')) {
      return res.status(504).json({ 
        error: 'Database operation timed out. Please check your connection and try again.',
        timeout: true 
      });
    }
    
    res.status(500).json({ error: error.message });
  }
});

// Update a product
app.patch('/api/products/:id', async (req, res) => {
  try {
    console.log('🔄 [SERVER] Updating product:', req.params.id);
    
    // Check if mongoose is connected
    if (mongoose.connection.readyState !== 1) {
      console.log('⚠️ Database not connected, cannot update product');
      return res.status(503).json({ 
        error: 'Database not available. Please try again later.',
        offline: true 
      });
    }

    // Add timeout to update operation
    const product = await Promise.race([
      Product.findByIdAndUpdate(
        req.params.id,
        { $set: req.body },
        { new: true }
      ),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Update operation timed out')), 8000)
      )
    ]);

    console.log("product id: ", product._id)

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    const transformedProduct = {
      ...product.toObject(),
      id: product._id.toString()
    };

    // Invalidate cache
    productsCache = null;

    console.log('✅ [SERVER] Product updated successfully:', transformedProduct.id);
    io.emit('product-updated', transformedProduct);

    res.json(transformedProduct);
  } catch (error) {
    console.error('❌ [SERVER] Error updating product:', error.message);
    
    if (error.message.includes('timed out') || error.message.includes('buffering timed out')) {
      return res.status(504).json({ 
        error: 'Database operation timed out. Please check your connection and try again.',
        timeout: true 
      });
    }
    
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/products/:id', async (req, res) => {
  try {
    const deletedProduct = await Product.findByIdAndDelete(req.params.id);

    if (!deletedProduct) {
      return res.status(404).json({ error: "Product not found" });
    }

    // Invalidate cache
    productsCache = null;

    io.emit('product-deleted', { id: req.params.id });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Direct TSPL print endpoint — sends raw TSPL data directly to the printer
// The printer name must be configured in the server environment
app.post('/api/print-label', async (req, res) => {
  try {
    const { tspl } = req.body;
    if (!tspl) return res.status(400).json({ error: 'No TSPL data provided' });

    const os = require('os');
    const fs = require('fs');
    const { exec } = require('child_process');
    const path = require('path');

    // Write TSPL to a temp file
    const tmpFile = path.join(os.tmpdir(), `label-${Date.now()}.prn`);
    fs.writeFileSync(tmpFile, tspl, 'binary');

    // Get printer name from env or use default
    const printerName = process.env.LABEL_PRINTER_NAME || 'Zenpert 4T520';

    // Send to printer using Windows copy command
    const cmd = `copy /b "${tmpFile}" "\\\\.\\${printerName}"`;
    exec(cmd, (error, stdout, stderr) => {
      // Clean up temp file
      try { fs.unlinkSync(tmpFile); } catch(e) {}

      if (error) {
        console.error('❌ Print error:', error.message);
        return res.status(500).json({ error: 'Print failed: ' + error.message, cmd });
      }
      console.log('✅ Label printed to:', printerName);
      res.json({ success: true, printer: printerName });
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Customer Lookup Route
app.get('/api/customer/:phone', async (req, res) => {
  try {
    const { phone } = req.params;
    if (!phone) {
      return res.status(400).json({ error: 'Phone number is required' });
    }

    // Query in parallel for speed
    const [trackingMatch, salesMatch, serviceMatch, orderMatch] = await Promise.all([
      Tracking.findOne({ contact: phone }).sort({ _id: -1 }).lean(),
      SalesRecord.findOne({ phoneNumber: phone }).sort({ _id: -1 }).lean(),
      ServiceRecord.findOne({ phoneNumber: phone }).sort({ _id: -1 }).lean(),
      Order.findOne({ "customer.phone": phone }).sort({ _id: -1 }).lean()
    ]);

    let customerName = '';
    let address = '';

    // Prioritize tracking records
    if (trackingMatch) {
      customerName = trackingMatch.customerName || '';
      address = trackingMatch.address || '';
    }

    // Fallback to SalesRecord
    if ((!customerName || !address) && salesMatch) {
      customerName = customerName || salesMatch.customerName || '';
      address = address || salesMatch.customerAddress || '';
    }

    // Fallback to ServiceRecord
    if ((!customerName || !address) && serviceMatch) {
      customerName = customerName || serviceMatch.customerName || '';
      address = address || serviceMatch.customerAddress || '';
    }

    // Fallback to Order
    if ((!customerName || !address) && orderMatch && orderMatch.customer) {
      customerName = customerName || orderMatch.customer.name || '';
      address = address || orderMatch.customer.address || '';
    }

    if (customerName || address) {
      return res.json({
        success: true,
        customerName,
        address
      });
    }

    return res.json({
      success: false,
      message: 'No customer details found'
    });
  } catch (error) {
    console.error('Error fetching customer details:', error);
    res.status(500).json({ error: error.message });
  }
});

// Tracking Routes
app.get('/api/tracking', async (req, res) => {
  try {
    const tracking = await Tracking.find().sort({ createdAt: -1 });
    res.json(tracking);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/tracking/:qrId', async (req, res) => {
  try {
    const tracking = await Tracking.findOne({ qrId: req.params.qrId });
    if (!tracking) {
      return res.status(404).json({ error: 'Tracking record not found' });
    }
    res.json(tracking);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/tracking', async (req, res) => {
  try {
    const tracking = new Tracking(req.body);
    await tracking.save();
    io.emit('tracking-added', tracking);
    res.json(tracking);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/tracking/:qrId', async (req, res) => {
  try {
    const tracking = await Tracking.findOneAndUpdate(
      { qrId: req.params.qrId },
      req.body,
      { new: true }
    );
    io.emit('tracking-updated', tracking);
    res.json(tracking);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/tracking/:qrId', async (req, res) => {
  try {
    await Tracking.findOneAndDelete({ qrId: req.params.qrId });
    io.emit('tracking-deleted', { qrId: req.params.qrId });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Order Routes
app.get('/api/orders', async (req, res) => {
  try {
    console.log('📡 [SERVER] Loading orders from database...');
    
    // Check if mongoose is connected
    if (mongoose.connection.readyState !== 1) {
      console.log('⚠️ Database not connected, returning empty orders');
      return res.json([]);
    }
    
    // Add timeout to orders query
    const orders = await Promise.race([
      Order.find().sort({ orderDate: -1 }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Orders query timed out')), 5000)
      )
    ]);
    
    console.log('📤 [SERVER] Sending orders to client:', {
      totalOrders: orders.length,
      ordersWithScreenshots: orders.filter(o => o.paymentScreenshot?.data).length
    });
    
    // Debug each order's screenshot data
    orders.forEach((order, index) => {
      if (order.paymentScreenshot) {
        console.log(`📋 [SERVER] Order ${index + 1} screenshot:`, {
          orderId: order.orderId,
          hasScreenshotData: !!order.paymentScreenshot.data,
          screenshotDataLength: order.paymentScreenshot.data?.length,
          fileName: order.paymentScreenshot.fileName
        });
      }
    });
    
    res.json(orders);
  } catch (error) {
    console.error('❌ [SERVER] Error fetching orders:', error.message);
    
    if (error.message.includes('timed out')) {
      console.log('⚠️ [SERVER] Orders query timed out, returning empty array');
      return res.json([]);
    }
    
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/orders', async (req, res) => {
  try {
    console.log('📥 Received order data:', {
      orderId: req.body.orderId,
      hasScreenshot: !!req.body.paymentScreenshot,
      screenshotDataLength: req.body.paymentScreenshot?.data?.length,
      screenshotDataType: typeof req.body.paymentScreenshot?.data,
      screenshotDataPreview: req.body.paymentScreenshot?.data?.substring(0, 50),
      paymentMethod: req.body.paymentMethod,
      fileName: req.body.paymentScreenshot?.fileName
    });
    
    // Validate screenshot data if present
    if (req.body.paymentScreenshot && req.body.paymentScreenshot.data) {
      if (!req.body.paymentScreenshot.data.startsWith('data:image/')) {
        console.error('❌ Invalid screenshot data format');
        return res.status(400).json({ error: 'Invalid screenshot data format' });
      }
      
      if (req.body.paymentScreenshot.data.length > 10 * 1024 * 1024) { // 10MB limit
        console.error('❌ Screenshot data too large:', req.body.paymentScreenshot.data.length);
        return res.status(400).json({ error: 'Screenshot data too large' });
      }
    }
    
    // Create order object explicitly
    const orderData = {
      orderId: req.body.orderId,
      customer: req.body.customer,
      items: req.body.items,
      total: req.body.total,
      paymentMethod: req.body.paymentMethod,
      status: req.body.status || 'Pending',
      orderDate: req.body.orderDate || new Date()
    };
    
    // Process screenshot data if present - store base64 directly in database only (no file saving)
    if (req.body.paymentScreenshot && req.body.paymentScreenshot.data) {
      console.log('📸 Processing screenshot - storing in database only (no file saving)...');
      
      orderData.paymentScreenshot = {
        data: req.body.paymentScreenshot.data, // Store base64 directly in database only
        fileName: req.body.paymentScreenshot.fileName,
        uploadTime: req.body.paymentScreenshot.uploadTime
      };
      
      console.log('📸 Screenshot stored in database only:', {
        hasData: !!orderData.paymentScreenshot.data,
        fileName: orderData.paymentScreenshot.fileName,
        dataLength: orderData.paymentScreenshot.data.length,
        note: 'No file saved to disk'
      });
    }
    
    const order = new Order(orderData);
    const savedOrder = await order.save();
    
    console.log('✅ Order saved to MongoDB:', {
      orderId: savedOrder.orderId,
      hasScreenshot: !!savedOrder.paymentScreenshot,
      hasImageUrl: !!savedOrder.paymentScreenshot?.imageUrl,
      screenshotDataLength: savedOrder.paymentScreenshot?.data?.length,
      screenshotSavedCorrectly: savedOrder.paymentScreenshot?.data?.startsWith('data:image/'),
      allFields: Object.keys(savedOrder.toObject())
    });
    
    io.emit('order-added', savedOrder);
    console.log('📡 Order broadcasted via socket');
    
    res.json(savedOrder);
  } catch (error) {
    console.error('❌ Error saving order:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/orders/:orderId', async (req, res) => {
  try {
    const order = await Order.findOneAndUpdate(
      { orderId: req.params.orderId },
      req.body,
      { new: true }
    );
    io.emit('order-updated', order);
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/orders/:orderId', async (req, res) => {
  try {
    console.log('🗑️ Deleting order:', req.params.orderId);
    const deletedOrder = await Order.findOneAndDelete({ orderId: req.params.orderId });
    
    if (!deletedOrder) {
      console.log('⚠️ Order not found:', req.params.orderId);
      return res.status(404).json({ error: 'Order not found' });
    }
    
    console.log('✅ Order deleted successfully:', req.params.orderId);
    io.emit('order-deleted', { orderId: req.params.orderId });
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Error deleting order:', error);
    res.status(500).json({ error: error.message });
  }
});

// Test endpoint to process screenshot without saving to file
app.post('/api/test-image-upload', async (req, res) => {
  try {
    const { imageData, fileName } = req.body;
    
    if (!imageData || !fileName) {
      return res.status(400).json({ error: 'Missing imageData or fileName' });
    }
    
    console.log('🧪 Testing image processing (no file saving):', {
      fileName: fileName,
      dataLength: imageData.length,
      isValidFormat: imageData.startsWith('data:image/')
    });
    
    // Process image data without saving to file
    console.log('✅ Image processed successfully (stored in memory only)');
    
    res.json({
      success: true,
      originalFileName: fileName,
      dataLength: imageData.length,
      message: 'Image processed successfully - no file saved to disk'
    });
  } catch (error) {
    console.error('❌ Test image processing failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// ===== SALES RECORDS ROUTES =====
app.get('/api/sales', async (req, res) => {
  try {
    const sales = await SalesRecord.find().sort({ createdAt: -1 });
    res.json(sales);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/sales', async (req, res) => {
  try {
    const saleId = 'SALE-' + Date.now();
    const sale = new SalesRecord({ ...req.body, saleId, createdAt: new Date().toLocaleDateString('en-IN') });
    await sale.save();
    io.emit('sale-added', sale);
    res.json(sale);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/sales/:saleId', async (req, res) => {
  try {
    const sale = await SalesRecord.findOneAndUpdate({ saleId: req.params.saleId }, req.body, { new: true });
    io.emit('sale-updated', sale);
    res.json(sale);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/sales/:saleId', async (req, res) => {
  try {
    await SalesRecord.findOneAndDelete({ saleId: req.params.saleId });
    io.emit('sale-deleted', { saleId: req.params.saleId });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== SERVICES ROUTES =====
app.get('/api/services', async (req, res) => {
  try {
    const services = await ServiceRecord.find().sort({ createdAt: -1 });
    res.json(services);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/services', async (req, res) => {
  try {
    const serviceId = 'SVC-' + Date.now();
    const service = new ServiceRecord({ ...req.body, serviceId });
    await service.save();
    res.json(service);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/services/:serviceId', async (req, res) => {
  try {
    const service = await ServiceRecord.findOneAndUpdate(
      { serviceId: req.params.serviceId }, req.body, { new: true }
    );
    res.json(service);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/services/:serviceId', async (req, res) => {
  try {
    await ServiceRecord.findOneAndDelete({ serviceId: req.params.serviceId });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== DISPLAY STOCK ROUTES =====
app.get('/api/display-stock', async (req, res) => {
  try {
    const items = await DisplayStock.find().sort({ createdAt: -1 });
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/display-stock', async (req, res) => {
  try {
    const stockItemId = 'STK-' + Date.now();
    let barcode = (req.body.barcode || '').trim();

    if (!barcode) {
      const allItems = await DisplayStock.find();
      let maxNum = 0;
      allItems.forEach(item => {
        const bc = (item.barcode || item.displayId || '').trim();
        const match = bc.match(/^M(\d+)$/i);
        if (match) {
          const num = parseInt(match[1], 10);
          if (!isNaN(num) && num > maxNum) maxNum = num;
        }
      });
      barcode = 'M' + String(maxNum + 1).padStart(3, '0');
    }

    const item = new DisplayStock({ ...req.body, stockItemId, barcode });
    await item.save();
    res.json(item);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/display-stock/:stockItemId', async (req, res) => {
  try {
    const { displayName, displayId, barcode, price, ownerPrice, customerPrice, stock } = req.body;
    const updateFields = {
      displayName,
      displayId,
      barcode: barcode || "",
      price: price ?? null,
      ownerPrice: ownerPrice ?? null,
      customerPrice: customerPrice ?? null
    };
    if (stock !== undefined) updateFields.stock = stock;
    const item = await DisplayStock.findOneAndUpdate(
      { stockItemId: req.params.stockItemId },
      { $set: updateFields },
      { new: true }
    );
    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json(item);
  } catch (error) {
    console.error('❌ Error editing display stock:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/display-stock/:stockItemId', async (req, res) => {
  try {
    const { stock, historyEntry } = req.body;
    const item = await DisplayStock.findOne({ stockItemId: req.params.stockItemId });
    if (!item) return res.status(404).json({ error: 'Not found' });

    item.stock = stock;

    if (historyEntry) {
      // Use $push via findOneAndUpdate to avoid Mongoose mixed-type array mutation issues
      const updated = await DisplayStock.findOneAndUpdate(
        { stockItemId: req.params.stockItemId },
        {
          $set: { stock },
          $push: { history: historyEntry }
        },
        { new: true }
      );
      return res.json(updated);
    }

    await item.save();
    res.json(item);
  } catch (error) {
    console.error('❌ Error updating display stock:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/display-stock/:stockItemId', async (req, res) => {
  try {
    await DisplayStock.findOneAndDelete({ stockItemId: req.params.stockItemId });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// SMS notification endpoint
app.post('/api/send-order-sms', async (req, res) => {
  try {
    const { orderDetails, ownerPhone } = req.body;
    
    // Prepare SMS message
    const itemsList = orderDetails.items.map(item => 
      `${item.name} x${item.quantity} = Rs${item.price * item.quantity}`
    ).join(', ');
    
    const smsMessage = `New Order #${orderDetails.id}
Customer: ${orderDetails.customer.name}
Phone: ${orderDetails.customer.phone}
Address: ${orderDetails.customer.address}
Items: ${itemsList}
Total: Rs${orderDetails.total}
Payment: ${orderDetails.paymentMethod}`;
    
    // Log order details (SMS will be sent via SMS service)
    console.log('📱 New Order - SMS to be sent:');
    console.log('To:', ownerPhone);
    console.log('Message:', smsMessage);
    console.log('---');
    
    // TODO: Integrate with SMS service (Fast2SMS, Twilio, MSG91, etc.)
    // Example with Fast2SMS (you'll need to sign up and get API key):
    /*
    const response = await fetch('https://www.fast2sms.com/dev/bulkV2', {
      method: 'POST',
      headers: {
        'authorization': 'YOUR_FAST2SMS_API_KEY',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        route: 'q',
        message: smsMessage,
        language: 'english',
        flash: 0,
        numbers: ownerPhone
      })
    });
    */
    
    // For now, just log and return success
    res.json({ 
      success: true, 
      message: 'Order received and SMS queued',
      orderId: orderDetails.id 
    });
  } catch (error) {
    console.error('Error processing order:', error);
    res.status(500).json({ error: error.message });
  }
});

// ===== SPARE PARTS ROUTES =====
app.get('/api/spare-parts', async (req, res) => {
  try {
    const items = await SpareParts.find().sort({ createdAt: -1 });
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/spare-parts', async (req, res) => {
  try {
    const partItemId = 'PART-' + Date.now();
    const item = new SpareParts({ ...req.body, partItemId });
    await item.save();
    res.json(item);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/spare-parts/:partItemId', async (req, res) => {
  try {
    const { partName, partId, ownerPrice, customerPrice, stock } = req.body;
    const updateFields = { partName, partId, ownerPrice: ownerPrice ?? null, customerPrice: customerPrice ?? null };
    if (stock !== undefined) updateFields.stock = stock;
    const item = await SpareParts.findOneAndUpdate(
      { partItemId: req.params.partItemId },
      { $set: updateFields },
      { new: true }
    );
    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json(item);
  } catch (error) {
    console.error('❌ Error editing spare part:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/spare-parts/:partItemId', async (req, res) => {
  try {
    const { stock, historyEntry } = req.body;
    const item = await SpareParts.findOne({ partItemId: req.params.partItemId });
    if (!item) return res.status(404).json({ error: 'Not found' });

    if (historyEntry) {
      const updated = await SpareParts.findOneAndUpdate(
        { partItemId: req.params.partItemId },
        { $set: { stock }, $push: { history: historyEntry } },
        { new: true }
      );
      return res.json(updated);
    }

    item.stock = stock;
    await item.save();
    res.json(item);
  } catch (error) {
    console.error('❌ Error updating spare part stock:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/spare-parts/:partItemId', async (req, res) => {
  try {
    await SpareParts.findOneAndDelete({ partItemId: req.params.partItemId });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== DISTRIBUTOR MANAGEMENT ROUTES =====

// Get all distributors
app.get('/api/distributors', async (req, res) => {
  try {
    const distributors = await Distributor.find().sort({ createdAt: -1 });
    res.json(distributors);
  } catch (error) {
    console.error('❌ Error fetching distributors:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create new distributor (with duplicate check)
app.post('/api/distributors', async (req, res) => {
  try {
    const { name, mobile } = req.body;
    if (!name || !name.trim() || !mobile || !mobile.trim()) {
      return res.status(400).json({ error: 'Distributor Name and Mobile Number are required.' });
    }

    const cleanName = name.trim();
    const cleanMobile = mobile.trim();

    // Check duplicate by name or mobile
    const existing = await Distributor.findOne({
      $or: [
        { name: new RegExp('^' + cleanName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') },
        { mobile: cleanMobile }
      ]
    });

    if (existing) {
      return res.status(400).json({
        error: 'Distributor already exists. Please use the existing distributor and add a new purchase entry.',
        existingDistributor: existing
      });
    }

    const distributorId = 'DIST-' + Date.now();
    const newDistributor = new Distributor({
      distributorId,
      name: cleanName,
      mobile: cleanMobile,
      purchaseCount: 0,
      lastPurchaseDate: ""
    });

    await newDistributor.save();
    console.log('✅ Created new distributor:', cleanName);
    res.json(newDistributor);
  } catch (error) {
    console.error('❌ Error creating distributor:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get single distributor
app.get('/api/distributors/:id', async (req, res) => {
  try {
    const distributor = await Distributor.findOne({
      $or: [{ distributorId: req.params.id }, { _id: mongoose.Types.ObjectId.isValid(req.params.id) ? req.params.id : null }]
    });
    if (!distributor) return res.status(404).json({ error: 'Distributor not found' });
    res.json(distributor);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get purchases for a distributor
app.get('/api/distributors/:id/purchases', async (req, res) => {
  try {
    const purchases = await DistributorPurchase.find({ distributorId: req.params.id }).sort({ createdAt: -1 });
    res.json(purchases);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add purchase transaction for a distributor
app.post('/api/distributors/:id/purchases', async (req, res) => {
  try {
    const distributor = await Distributor.findOne({
      $or: [{ distributorId: req.params.id }, { _id: mongoose.Types.ObjectId.isValid(req.params.id) ? req.params.id : null }]
    });
    if (!distributor) return res.status(404).json({ error: 'Distributor not found' });

    const { items, purchaseDate: inputDate } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'At least one product item is required for purchase.' });
    }

    // Filter out empty rows & validate items
    const validItems = items.filter(it => it.productName && it.productName.trim() && Number(it.quantity) > 0);
    if (validItems.length === 0) {
      return res.status(400).json({ error: 'No valid products found in purchase form.' });
    }

    // Format date & time
    const now = new Date();
    const dateObj = inputDate ? new Date(inputDate) : now;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[dateObj.getMonth()];
    const year = dateObj.getFullYear();
    const purchaseDateFormatted = `${dateObj.getDate().toString().padStart(2, '0')} ${month} ${year}`;
    const timeOptions = { hour: '2-digit', minute: '2-digit', hour12: true };
    const purchaseTimeFormatted = now.toLocaleTimeString('en-US', timeOptions);

    // Generate unique sequential bill number PUR-0001, PUR-0002...
    const count = await DistributorPurchase.countDocuments();
    const billNumber = `PUR-${(count + 1).toString().padStart(4, '0')}`;
    const purchaseId = `PURTXN-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    let processedItems = [];
    let totalQuantity = 0;
    let totalAmount = 0;

    for (const item of validItems) {
      const pName = item.productName.trim();
      const pBarcode = (item.barcode || '').trim();
      const qty = parseInt(item.quantity) || 0;
      const dPrice = parseFloat(item.distributorPrice) || 0;
      const oPrice = parseFloat(item.ownerPrice) || 0;
      const cPrice = parseFloat(item.customerPrice) || 0;
      const itemTotal = qty * dPrice;

      // Find or create DistributorProduct stock record
      let query = { distributorId: distributor.distributorId, productName: pName };
      if (pBarcode) query.barcode = pBarcode;

      let distProd = await DistributorProduct.findOne(query);

      if (distProd) {
        distProd.currentStock += qty;
        distProd.distributorPrice = dPrice;
        distProd.ownerPrice = oPrice;
        distProd.customerPrice = cPrice;
        distProd.distributorName = distributor.name;
        await distProd.save();
      } else {
        distProd = new DistributorProduct({
          distributorProductId: 'DPROD-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
          distributorId: distributor.distributorId,
          distributorName: distributor.name,
          productName: pName,
          barcode: pBarcode,
          currentStock: qty,
          distributorPrice: dPrice,
          ownerPrice: oPrice,
          customerPrice: cPrice
        });
        await distProd.save();
      }

      processedItems.push({
        distributorProductId: distProd.distributorProductId,
        productName: pName,
        barcode: pBarcode,
        quantity: qty,
        distributorPrice: dPrice,
        ownerPrice: oPrice,
        customerPrice: cPrice,
        itemTotal: itemTotal
      });

      totalQuantity += qty;
      totalAmount += itemTotal;
    }

    const purchaseDoc = new DistributorPurchase({
      purchaseId,
      billNumber,
      distributorId: distributor.distributorId,
      distributorName: distributor.name,
      distributorMobile: distributor.mobile,
      purchaseDate: purchaseDateFormatted,
      purchaseTime: purchaseTimeFormatted,
      month: month,
      year: year,
      items: processedItems,
      totalProducts: processedItems.length,
      totalQuantity: totalQuantity,
      totalAmount: totalAmount
    });

    await purchaseDoc.save();

    // Update Distributor summary
    distributor.purchaseCount = (distributor.purchaseCount || 0) + 1;
    distributor.lastPurchaseDate = purchaseDateFormatted;
    await distributor.save();

    console.log(`✅ Saved purchase ${billNumber} for distributor ${distributor.name} (${processedItems.length} items, total ₹${totalAmount})`);
    res.json({ success: true, purchase: purchaseDoc });
  } catch (error) {
    console.error('❌ Error saving purchase:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get Distributor Products Inventory
app.get('/api/distributor-products', async (req, res) => {
  try {
    const products = await DistributorProduct.find().sort({ productName: 1 });
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update Distributor Product (Price/Stock adjustments if edited manually)
app.put('/api/distributor-products/:id', async (req, res) => {
  try {
    const { ownerPrice, customerPrice, currentStock } = req.body;
    const item = await DistributorProduct.findOneAndUpdate(
      { distributorProductId: req.params.id },
      { $set: { ownerPrice, customerPrice, currentStock } },
      { new: true }
    );
    if (!item) return res.status(404).json({ error: 'Distributor product not found' });
    res.json(item);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all Purchase Bills (Global View)
app.get('/api/purchase-bills', async (req, res) => {
  try {
    const bills = await DistributorPurchase.find().sort({ createdAt: -1 });
    res.json(bills);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get Single Purchase Bill
app.get('/api/purchase-bills/:billNumber', async (req, res) => {
  try {
    const bill = await DistributorPurchase.findOne({
      $or: [{ billNumber: req.params.billNumber }, { purchaseId: req.params.billNumber }]
    });
    if (!bill) return res.status(404).json({ error: 'Purchase bill not found' });
    res.json(bill);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Edit Purchase Bill (Recalculates stock differences and updates bill)
app.put('/api/purchase-bills/:billNumber', async (req, res) => {
  try {
    const existingBill = await DistributorPurchase.findOne({
      $or: [{ billNumber: req.params.billNumber }, { purchaseId: req.params.billNumber }]
    });

    if (!existingBill) return res.status(404).json({ error: 'Purchase bill not found' });

    const { items, purchaseDate: inputDate } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'At least one valid item is required.' });
    }

    const validItems = items.filter(it => it.productName && it.productName.trim() && Number(it.quantity) > 0);
    if (validItems.length === 0) {
      return res.status(400).json({ error: 'No valid products in edit entry.' });
    }

    const oldQtyMap = {};
    existingBill.items.forEach(it => {
      const key = (it.distributorProductId || (it.productName + '_' + (it.barcode || ''))).trim();
      oldQtyMap[key] = (oldQtyMap[key] || 0) + it.quantity;
    });

    let processedItems = [];
    let totalQuantity = 0;
    let totalAmount = 0;

    for (const item of validItems) {
      const pName = item.productName.trim();
      const pBarcode = (item.barcode || '').trim();
      const qty = parseInt(item.quantity) || 0;
      const dPrice = parseFloat(item.distributorPrice) || 0;
      const oPrice = parseFloat(item.ownerPrice) || 0;
      const cPrice = parseFloat(item.customerPrice) || 0;
      const itemTotal = qty * dPrice;

      let query = { distributorId: existingBill.distributorId, productName: pName };
      if (pBarcode) query.barcode = pBarcode;

      let distProd = await DistributorProduct.findOne(query);
      const key = distProd ? distProd.distributorProductId : (pName + '_' + pBarcode);
      const oldQty = oldQtyMap[key] || 0;
      const qtyDiff = qty - oldQty;
      oldQtyMap[key] = 0;

      if (distProd) {
        distProd.currentStock = Math.max(0, distProd.currentStock + qtyDiff);
        distProd.distributorPrice = dPrice;
        distProd.ownerPrice = oPrice;
        distProd.customerPrice = cPrice;
        await distProd.save();
      } else {
        distProd = new DistributorProduct({
          distributorProductId: 'DPROD-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
          distributorId: existingBill.distributorId,
          distributorName: existingBill.distributorName,
          productName: pName,
          barcode: pBarcode,
          currentStock: qty,
          distributorPrice: dPrice,
          ownerPrice: oPrice,
          customerPrice: cPrice
        });
        await distProd.save();
      }

      processedItems.push({
        distributorProductId: distProd.distributorProductId,
        productName: pName,
        barcode: pBarcode,
        quantity: qty,
        distributorPrice: dPrice,
        ownerPrice: oPrice,
        customerPrice: cPrice,
        itemTotal: itemTotal
      });

      totalQuantity += qty;
      totalAmount += itemTotal;
    }

    // Revert remaining unconsumed old items
    for (const [key, oldQty] of Object.entries(oldQtyMap)) {
      if (oldQty > 0) {
        const distProd = await DistributorProduct.findOne({
          $or: [{ distributorProductId: key }, { distributorId: existingBill.distributorId, productName: key.split('_')[0] }]
        });
        if (distProd) {
          distProd.currentStock = Math.max(0, distProd.currentStock - oldQty);
          await distProd.save();
        }
      }
    }

    if (inputDate) {
      const dateObj = new Date(inputDate);
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const month = months[dateObj.getMonth()];
      const year = dateObj.getFullYear();
      existingBill.purchaseDate = `${dateObj.getDate().toString().padStart(2, '0')} ${month} ${year}`;
      existingBill.month = month;
      existingBill.year = year;
    }

    existingBill.items = processedItems;
    existingBill.totalProducts = processedItems.length;
    existingBill.totalQuantity = totalQuantity;
    existingBill.totalAmount = totalAmount;

    await existingBill.save();
    console.log(`✏️ Updated purchase bill ${existingBill.billNumber}`);
    res.json({ success: true, purchase: existingBill });
  } catch (error) {
    console.error('❌ Error editing purchase bill:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete Purchase Bill (Deducts stock & updates distributor stats)
app.delete('/api/purchase-bills/:billNumber', async (req, res) => {
  try {
    const bill = await DistributorPurchase.findOne({
      $or: [{ billNumber: req.params.billNumber }, { purchaseId: req.params.billNumber }]
    });

    if (!bill) return res.status(404).json({ error: 'Purchase bill not found' });

    // Deduct stock from DistributorProduct
    for (const item of bill.items) {
      let query = { distributorId: bill.distributorId, productName: item.productName };
      if (item.barcode) query.barcode = item.barcode;
      if (item.distributorProductId) query = { distributorProductId: item.distributorProductId };

      const distProd = await DistributorProduct.findOne(query);
      if (distProd) {
        distProd.currentStock = Math.max(0, distProd.currentStock - item.quantity);
        await distProd.save();
      }
    }

    // Decrement distributor purchaseCount
    const dist = await Distributor.findOne({ distributorId: bill.distributorId });
    if (dist) {
      dist.purchaseCount = Math.max(0, (dist.purchaseCount || 1) - 1);
      await dist.save();
    }

    await DistributorPurchase.deleteOne({ _id: bill._id });
    console.log(`🗑️ Deleted purchase bill ${bill.billNumber}`);
    res.json({ success: true, message: `Bill ${bill.billNumber} deleted successfully.` });
  } catch (error) {
    console.error('❌ Error deleting purchase bill:', error);
    res.status(500).json({ error: error.message });
  }
});

// POS Checkout Endpoint (Unified across Products, Display Stock, Spare Parts)
app.post('/api/pos/checkout', async (req, res) => {
  try {
    const { customerName, phoneNumber, customerAddress, items, discount, paymentMethod, notes } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Cart is empty. Please add items to complete POS checkout.' });
    }

    let grandTotal = 0;
    let productItemsSummary = [];

    for (const item of items) {
      const qty = parseInt(item.quantity) || 1;
      const price = parseFloat(item.price) || 0;
      const itemTotal = qty * price;
      grandTotal += itemTotal;

      productItemsSummary.push({
        id: item.id,
        name: item.name,
        type: item.type, // 'product', 'display', 'spare'
        price: price,
        quantity: qty,
        itemTotal: itemTotal
      });

      // Deduct stock based on type
      if (item.type === 'product') {
        const prod = await Product.findOne({
          $or: [{ id: item.id }, { _id: mongoose.Types.ObjectId.isValid(item.id) ? item.id : null }, { name: item.name }]
        });
        if (prod) {
          prod.stock = Math.max(0, (prod.stock || 0) - qty);
          prod.inStock = prod.stock > 0;
          await prod.save();
        }
      } else if (item.type === 'display') {
        const disp = await DisplayStock.findOne({
          $or: [{ stockItemId: item.id }, { _id: mongoose.Types.ObjectId.isValid(item.id) ? item.id : null }, { displayName: item.name }]
        });
        if (disp) {
          disp.stock = Math.max(0, (disp.stock || 0) - qty);
          await disp.save();
        }
      } else if (item.type === 'spare') {
        const spare = await SpareParts.findOne({
          $or: [{ partItemId: item.id }, { _id: mongoose.Types.ObjectId.isValid(item.id) ? item.id : null }, { partName: item.name }]
        });
        if (spare) {
          spare.stock = Math.max(0, (spare.stock || 0) - qty);
          await spare.save();
        }
      }
    }

    const discountAmount = parseFloat(discount) || 0;
    const finalAmount = Math.max(0, grandTotal - discountAmount);

    const saleId = 'POS-' + Date.now();
    const now = new Date();
    const purchaseDateFormatted = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;

    const salesDoc = new SalesRecord({
      saleId,
      customerName: (customerName || 'Walk-in Customer').trim(),
      phoneNumber: (phoneNumber || 'N/A').trim(),
      customerAddress: (customerAddress || '').trim(),
      productName: productItemsSummary.map(i => `${i.name} (${i.quantity})`).join(', '),
      productItems: productItemsSummary,
      saleAmount: finalAmount,
      discount: discountAmount,
      purchaseDate: purchaseDateFormatted,
      notes: notes || `POS Sale (${paymentMethod || 'Cash'})`,
      createdAt: now.toISOString()
    });

    await salesDoc.save();

    console.log(`🛒 POS Sale completed: ${saleId} (Total: ₹${finalAmount})`);
    res.json({ success: true, saleId, sale: salesDoc });
  } catch (error) {
    console.error('❌ Error processing POS checkout:', error);
    res.status(500).json({ error: error.message });
  }
});


const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📡 MongoDB URI configured: ${process.env.MONGO_URI ? 'Yes' : 'No'}`);
});
