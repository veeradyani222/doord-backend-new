const port = process.env.PORT || 4000;
const express = require("express");
const app = express();
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const multer = require("multer");
const path = require("path");
const cors = require("cors");
const fs = require('fs');
const xlsx = require('xlsx');
const nodemailer = require('nodemailer');
const bodyParser = require('body-parser');
const cloudinary = require('cloudinary').v2;
const Razorpay = require("razorpay");
const bcrypt = require('bcrypt');
const twilio = require('twilio');
const https = require('https');
require('dotenv').config();



app.use(bodyParser.json());
app.use(express.json({ limit: '10mb' }));
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});



// Middleware for parsing URL-encoded bodies with a size limit

app.use(express.urlencoded({ limit: '10mb', extended: true }));



app.use(cors());

// MongoDB connection
mongoose.connect('mongodb+srv://veeradyani2:S%40nju_143@cluster0.uafyz.mongodb.net/Doord?retryWrites=true&w=majority');


app.get("/", (req, res) => {
    res.send("Express app is running");
});

// Multer configuration for image upload
const uploadPath = path.join('/tmp', 'upload', 'images');

// Ensure the `/tmp/upload/images` directory exists
if (!fs.existsSync(uploadPath)) {
    fs.mkdirSync(uploadPath, { recursive: true }); // Create the directory if it doesn't exist
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadPath); // Use the writable `/tmp` directory
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = `${file.fieldname}_${Date.now()}${path.extname(file.originalname)}`;
        cb(null, uniqueSuffix); // Generate a unique filename
    },
});

const upload = multer({ storage: storage });


app.use('/images', express.static(path.join(__dirname, 'upload/images')));


// Endpoint for uploading product images
app.post("/upload", upload.single('image'), (req, res) => {
    cloudinary.uploader.upload(req.file.path, (error, result) => {
        if (error) {
            return res.status(500).json({ success: 0, message: "Image upload failed", error });
        }

        res.json({
            success: 1,
            image_url: result.secure_url // Use the secure URL provided by Cloudinary
        });
    });
});



const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  verificationCode: { type: String, required: true },
  isVerified: { type: Boolean, required: true, default: false },
  dateOfBirth: { type: Date, required: true },
  presentAddress: { type: String },
  permanentAddress: { type: String },
  city: { type: String },
  postalCode: { type: mongoose.Schema.Types.BigInt },
  country: { type: String },
  currency: { type: String },
  timeZone: { type: String },
  notification: { type: String, default: "I send or receive Payment receipt" },
  twoFactorAuth: { type: Boolean, default: false },

  orders: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order'
  }],

  quotations: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Quotation'
  }],

  reportsAndIssues: {
    type: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ReportsAndIssues'
    }],
    default: []
  },

  Date: { type: Date, default: Date.now }
});

// ✅ Virtual Population
userSchema.virtual('populatedOrders', {
  ref: 'Order',
  localField: 'orders',
  foreignField: '_id',
});

userSchema.set('toObject', { virtuals: true });
userSchema.set('toJSON', { virtuals: true });

// ✅ Create the model
const Users = mongoose.model('Users', userSchema);
const tempUsers = {}; // In-memory store for signup OTPs

// Signup endpoint
app.post('/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, errors: "All fields are required." });
    }

    const existingUser = await Users.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, errors: "Email already registered." });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    tempUsers[email] = {
      name,
      email,
      password,
      otp,
      createdAt: Date.now(),
    };

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: '"Doord Support" <no-reply@doord.com>',
      to: email,
      subject: 'Verify your email address',
      html: `
        <h2>Hello ${name},</h2>
        <p>Your OTP for email verification is: <strong>${otp}</strong></p>
        <p>This OTP is valid for a few minutes. Please do not share it.</p>
        <footer><p>Best Regards,<br/>Doord Team</p></footer>
      `,
    };

    await transporter.sendMail(mailOptions);

    res.json({ success: true, message: "OTP sent successfully via email." });

  } catch (error) {
    console.error("Signup Error:", error);
    res.status(500).json({ error: "Signup failed." });
  }
});
app.post('/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;

    const tempUser = tempUsers[email];
    if (!tempUser) {
      return res.status(400).json({ success: false, errors: "User not found or OTP expired." });
    }

    if (tempUser.otp !== otp && otp !== '123456') {
      return res.status(400).json({ success: false, errors: "Invalid OTP." });
    }

    const user = new Users({
      name: tempUser.name,
      email: tempUser.email,
      password: tempUser.password, // ❗ Hash this in production
      verificationCode: otp,
      isVerified: true,
      dateOfBirth: new Date(tempUser.dateOfBirth || Date.now())
    });

    await user.save();
    delete tempUsers[email];

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: '"Doord Support" <no-reply@doord.com>',
      to: user.email,
      subject: 'Welcome Onboard!',
      html: `
        <h1>Welcome to Doord, ${user.name}!</h1>
        <p>Your email has been successfully verified. We're glad to have you on board!</p>
        <footer><p>Best Regards,<br/>Doord Team</p></footer>
      `,
    };

    await transporter.sendMail(mailOptions);

    res.json({ success: true, message: "Email verified successfully." });

  } catch (error) {
    console.error("OTP Verification Error:", error);
    res.status(500).json({ error: "OTP verification failed." });
  }
});

// Login endpoint
app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await Users.findOne({ email });
    
    if (!user) return res.status(400).json({ success: false, errors: "Wrong Email ID" });
    if (password !== user.password) return res.status(400).json({ success: false, errors: "Wrong Password" });

    // Include both _id AND email in the token
    const tokenData = { 
      user: { 
        _id: user._id,  // Using _id instead of id
        email: user.email
      } 
    };
    
    const token = jwt.sign(tokenData, 'secret_doord_key', { expiresIn: '730h' });
    res.json({ 
      success: true, 
      token,
      user: {
        _id: user._id,
        email: user.email,
        name: user.name
      }
    });

  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ error: "Login failed." });
  }
});

// Middleware to fetch user
const fetchUser = async (req, res, next) => {
  const token = req.header('auth-token');
  if (!token) return res.status(401).json({ error: 'Please authenticate' });

  try {
    // 1. Verify token
    const data = jwt.verify(token, 'secret_doord_key');
    
    // 2. Fetch COMPLETE user document from database
    const user = await Users.findById(data.user._id)
      .select('-password -verificationCode'); // Exclude sensitive fields
    
    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    // 3. Attach full user document to request
    req.user = user;
    next();
    
  } catch (error) {
    res.status(401).json({ error: "Invalid token" });
  }
};

//FORGOT USER

const forgotPasswordOtps = {}; // Store OTPs in memory temporarily

app.post('/forgot-password', async (req, res) => {
  const { email } = req.body;

  try {
    const user = await Users.findOne({ email });

    if (!user) {
      return res.status(404).json({ success: false, message: "User with that email not found" });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    forgotPasswordOtps[email] = { otp, createdAt: Date.now() };

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Forgot Password OTP - W Ever Classes',
      html: `
        <h2>Hello ${user.name || ''},</h2>
        <p>Your OTP to reset your password is: <strong>${otp}</strong></p>
        <p>This OTP is valid for 10 minutes.</p>
        <footer><p>Best Regards,<br/>W Ever Classes Team</p></footer>
      `,
    };

    await transporter.sendMail(mailOptions);

    res.json({ success: true, message: "OTP sent to email" });

  } catch (error) {
    console.error("Forgot Password Error:", error);
    res.status(500).json({ success: false, message: "Error sending OTP" });
  }
});
app.post('/verify-forgot-otp', async (req, res) => {
  const { email, otp } = req.body;
  const record = forgotPasswordOtps[email];

  if (!record) {
    return res.status(400).json({ success: false, message: "OTP not requested or expired" });
  }

  // Check OTP match or universal fallback '123456'
  const isValidOtp = record.otp === otp || otp === '123456';

  // Check expiration (10 minutes)
  const isExpired = (Date.now() - record.createdAt) > 10 * 60 * 1000;

  if (!isValidOtp) {
    return res.status(400).json({ success: false, message: "Invalid OTP" });
  }

  if (isExpired) {
    delete forgotPasswordOtps[email];
    return res.status(400).json({ success: false, message: "OTP expired" });
  }

  // Generate short-lived JWT
  const token = jwt.sign({ email }, 'secret_ecom', { expiresIn: '15m' });

  res.json({ success: true, message: "OTP verified", token });
});


app.post('/reset-password', async (req, res) => {
    const { token, newPassword, confirmPassword } = req.body;

    if (newPassword !== confirmPassword) {
        return res.status(400).json({ success: false, message: "Passwords do not match" });
    }

    try {
        const { email } = jwt.verify(token, 'secret_ecom');
        const user = await Users.findOne({ email });

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        user.password = newPassword; // Hash in production
        await user.save();

        delete forgotPasswordOtps[email]; // Clean up memory

        res.json({ success: true, message: "Password reset successfully" });
    } catch (error) {
        console.error("Reset Password Error:", error);
        res.status(400).json({ success: false, message: "Invalid or expired token" });
    }
});


//Merchant's Flow



const MerchantSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  verificationCode: { type: String, required: true },
  isVerified: { type: Boolean, required: true, default: false },
  companyName: { type: String, required: true },
  address: { type: String, required: true },
  permanent_address: { type: String },
  business_address: { type: String},
  province: { type: String, required: true },
  city: { type: String, required: true },
  currency: { type: String },
  timeZone: { type: String },
  notification: { type: String, default: "I send or receive Payment receipt" },
  twoFactorAuth: { type: Boolean, default: false },

  serviceType: { type: [String], required: true },
  serviceImage: { type: String },

  orders: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order'
  }],

  quotations: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Quotation'
  }],

  services: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Service'
  }],

  reportsAndIssues: {
    type: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ReportsAndIssues'
    }],
    default: []
  },

  createdAt: { type: Date, default: Date.now }
});

// ✅ Virtual population for orders
MerchantSchema.virtual('populatedOrders', {
  ref: 'Order',
  localField: 'orders',
  foreignField: '_id',
});

MerchantSchema.set('toObject', { virtuals: true });
MerchantSchema.set('toJSON', { virtuals: true });

// ✅ Export model
const Merchant = mongoose.model('Merchant', MerchantSchema);


const tempMerchants = {}; // In-memory store for signup OTPs
const forgotPasswordMerchantOtps = {}; // Store OTPs for password reset

app.post('/merchant/signup', upload.single('image'), async (req, res) => {
  try {
    const {
      firstName, lastName, email, password,
      companyName, address, province, city, serviceType
    } = req.body;

    if (!firstName || !lastName || !email || !password || !companyName || !address || !province || !city || !serviceType) {
      return res.status(400).json({ success: false, errors: "All fields are required." });
    }

    const existingMerchant = await Merchant.findOne({ email });
    if (existingMerchant) {
      return res.status(400).json({ success: false, errors: "Email already registered." });
    }

    let serviceImageUrl = '';
    if (req.file) {
      const result = await cloudinary.uploader.upload(req.file.path);
      serviceImageUrl = result.secure_url;
    }

    // ✅ Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    tempMerchants[email] = {
      firstName,
      lastName,
      email,
      password,
      companyName,
      address,
      province,
      city,
      serviceType,
      serviceImage: serviceImageUrl,
      otp,
      createdAt: Date.now(),
    };

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: '"Doord Merchant Support" <no-reply@doord.com>',
      to: email,
      subject: 'Verify your merchant email address',
      html: `
        <h2>Hello ${firstName} ${lastName},</h2>
        <p>Your OTP for merchant account verification is: <strong>${otp}</strong></p>
        <p>This OTP is valid for a few minutes. Please do not share it.</p>
        <footer><p>Best Regards,<br/>Doord Merchant Team</p></footer>
      `,
    };

    await transporter.sendMail(mailOptions);

    res.json({ success: true, message: "OTP sent successfully via email." });

  } catch (error) {
    console.error("Merchant Signup Error:", error);
    res.status(500).json({ success: false, error: "Merchant signup failed." });
  }
});

app.post('/merchant/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;

    const tempMerchant = tempMerchants[email];
    if (!tempMerchant) {
      return res.status(400).json({ success: false, errors: "Merchant not found or OTP expired." });
    }

    // ✅ Allow real OTP or '123456'
    if (tempMerchant.otp !== otp && otp !== '123456') {
      return res.status(400).json({ success: false, errors: "Invalid OTP." });
    }

    const merchant = new Merchant({
      firstName: tempMerchant.firstName,
      lastName: tempMerchant.lastName,
      email: tempMerchant.email,
      password: tempMerchant.password, // Hash in production
      verificationCode: otp,
      isVerified: true,
      companyName: tempMerchant.companyName,
      address: tempMerchant.address,
      province: tempMerchant.province,
      city: tempMerchant.city,
      serviceType: tempMerchant.serviceType,
      serviceImage: tempMerchant.serviceImage
    });

    await merchant.save();
    delete tempMerchants[email];

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: '"Doord Merchant Support" <no-reply@doord.com>',
      to: merchant.email,
      subject: 'Welcome to Doord Merchant Program!',
      html: `
        <h1>Welcome to Doord Merchant Program, ${merchant.firstName}!</h1>
        <p>Your merchant account has been successfully verified. You can now start accepting payments through Doord!</p>
        <footer><p>Best Regards,<br/>Doord Merchant Team</p></footer>
      `,
    };

    await transporter.sendMail(mailOptions);

    res.json({ success: true, message: "Merchant account verified successfully." });

  } catch (error) {
    console.error("Merchant OTP Verification Error:", error);
    res.status(500).json({ error: "Merchant OTP verification failed." });
  }
});


app.post('/merchant/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const merchant = await Merchant.findOne({ email });
    if (!merchant) {
      return res.status(400).json({ success: false, errors: "Merchant not found." });
    }

    if (!merchant.isVerified) {
      return res.status(400).json({ success: false, errors: "Please verify your email first." });
    }

    // In production, use bcrypt.compare
    if (password !== merchant.password) {
      return res.status(400).json({ success: false, errors: "Wrong Password" });
    }

    const data = { merchant: { id: merchant.id } };
    const token = jwt.sign(data, 'secret_doord_merchant_key', { expiresIn: '730h' });

    res.json({ success: true, token });

  } catch (error) {
    console.error("Merchant Login Error:", error);
    res.status(500).json({ error: "Merchant login failed." });
  }
});

const fetchMerchant = async (req, res, next) => {
  const token = req.header('merchant-auth-token');
  if (!token) {
    return res.status(401).json({ errors: 'Please authenticate using a valid merchant token' });
  }

  try {
    const data = jwt.verify(token, 'secret_doord_merchant_key');
    const merchant = await Merchant.findById(data.merchant.id); // 🔍 Fetch full merchant

    if (!merchant) {
      return res.status(404).json({ errors: 'Merchant not found' });
    }

    req.merchant = merchant;
    next();
  } catch (error) {
    console.error("Auth Error:", error.message);
    res.status(401).json({ errors: 'Invalid token' });
  }
};

app.post('/merchant/forgot-password', async (req, res) => {
  const { email } = req.body;

  try {
    const merchant = await Merchant.findOne({ email });

    if (!merchant) {
      return res.status(404).json({ success: false, message: "Merchant with that email not found" });
    }

    // ✅ Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    forgotPasswordMerchantOtps[email] = { otp, createdAt: Date.now() };

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Merchant Forgot Password OTP - Doord',
      html: `
        <h2>Hello ${merchant.firstName || ''},</h2>
        <p>Your OTP to reset your merchant account password is: <strong>${otp}</strong></p>
        <p>This OTP is valid for 10 minutes.</p>
        <footer><p>Best Regards,<br/>Doord Merchant Team</p></footer>
      `,
    };

    await transporter.sendMail(mailOptions);

    res.json({ success: true, message: "OTP sent to merchant email" });

  } catch (error) {
    console.error("Merchant Forgot Password Error:", error);
    res.status(500).json({ success: false, message: "Error sending OTP" });
  }
});


app.post('/merchant/verify-forgot-otp', async (req, res) => {
  const { email, otp } = req.body;
  const record = forgotPasswordMerchantOtps[email];

  if (!record) {
    return res.status(400).json({ success: false, message: "OTP not requested or expired" });
  }

  // ✅ Accept actual OTP or fallback '123456'
  const isValidOtp = record.otp === otp || otp === '123456';

  const isExpired = (Date.now() - record.createdAt) > 10 * 60 * 1000;
  if (isExpired) {
    delete forgotPasswordMerchantOtps[email];
    return res.status(400).json({ success: false, message: "OTP expired" });
  }

  if (!isValidOtp) {
    return res.status(400).json({ success: false, message: "Invalid OTP" });
  }

  const token = jwt.sign({ email }, 'secret_doord_merchant_key', { expiresIn: '15m' });

  res.json({ success: true, message: "OTP verified", token });
});


app.post('/merchant/reset-password', async (req, res) => {
    const { token, newPassword, confirmPassword } = req.body;

    if (newPassword !== confirmPassword) {
        return res.status(400).json({ success: false, message: "Passwords do not match" });
    }

    try {
        const { email } = jwt.verify(token, 'secret_doord_merchant_key');
        const merchant = await Merchant.findOne({ email });

        if (!merchant) {
            return res.status(404).json({ success: false, message: "Merchant not found" });
        }

        merchant.password = newPassword; // Hash in production
        await merchant.save();

        delete forgotPasswordMerchantOtps[email];

        res.json({ success: true, message: "Merchant password reset successfully" });
    } catch (error) {
        console.error("Merchant Reset Password Error:", error);
        res.status(400).json({ success: false, message: "Invalid or expired token" });
    }
});

//ORDERS

const OrderSchema = new mongoose.Schema({
  serviceName: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true
  },
  phone: {
    type: String,
    required: true
  },
  orgName: {
    type: String,
    required: true
  },
  scheduledTime: {
    type: String,
    required: true
  },
  orderStatus: {
    type: String,
    default: 'pending'
  },
  websiteAddress: {
    type: String
  },
  masterCard: {
    type: String
  },
  businessName: {
    type: String,
    required: true
  },
  paymentStatus: {
    type: String,
    default: 'unpaid'
  },
  paymentPaid: {
    type: String
  },
  user_email: {
    type: String,
    required: true
  },
  merchant_email: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});


const Order = mongoose.model('Order', OrderSchema);


app.post('/addOrder', fetchUser, async (req, res) => {
  try {
    // Destructure required fields
    const requiredFields = [
      'serviceName', 'email', 'phone', 'orgName', 
      'scheduledTime', 'businessName', 'merchant_email'
    ];
    
    // Validate all required fields
    const missingFields = requiredFields.filter(field => !req.body[field]);
    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        errors: 'Missing required fields',
        missingFields
      });
    }

    const {
      serviceName,
      email,
      phone,
      orgName,
      scheduledTime,
      websiteAddress,
      masterCard,
      businessName,
      merchant_email,
      paymentPaid
    } = req.body;

    // Check if merchant exists
    const merchant = await Merchant.findOne({ email: merchant_email });
    if (!merchant) {
      return res.status(404).json({ 
        success: false,
        errors: 'Merchant not found' 
      });
    }

    // Create new order
    const newOrder = new Order({
      serviceName,
      email,
      phone,
      orgName,
      scheduledTime,
      websiteAddress: websiteAddress || '',
      masterCard: masterCard || '',
      businessName,
      paymentStatus: paymentPaid ? 'paid' : 'unpaid',
      paymentPaid: paymentPaid || '',
      user_email: req.user.email, // From authenticated user
      merchant_email
    });

    // Save the order
    const savedOrder = await newOrder.save();

    // Update user's orders array
    await Users.findByIdAndUpdate(
      req.user._id,
      { $push: { orders: savedOrder} }
    );

    // Update merchant's orders array
    await Merchant.findOneAndUpdate(
      { email: merchant_email },
      { $push: { orders: savedOrder } }
    );

    // Successful response
    res.json({
      success: true,
      order: savedOrder,
      message: 'Order created successfully'
    });

  } catch (error) {
    console.error("Order Creation Error:", error.message);
    res.status(500).json({
      success: false,
      errors: 'Server error during order creation',
      details: error.message
    });
  }
});

app.get('/getOrder/:_id', async (req, res) => {
  try {
    const order = await Order.findById(req.params._id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});


// Get all orders
app.get('/getAllOrders', async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Update order (any field)
app.put('/updateOrder/:_id', async (req, res) => {
  try {
    const order = await Order.findByIdAndUpdate(
      req.params._id,
      { $set: req.body },
      { new: true, runValidators: true }
    );

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json(order);
  } catch (error) {
    console.error("Update Order Error:", error.message);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/user/orders', fetchUser, async (req, res) => {
  try {
    const user = await Users.findById(req.user._id)
      .populate('populatedOrders')
      .select('populatedOrders');

    res.json(user.populatedOrders);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});


app.get('/merchant/orders', fetchMerchant, async (req, res) => {
  try {
    const merchant = await Merchant.findById(req.merchant._id)
      .populate('populatedOrders')
      .select('populatedOrders');

    res.json(merchant.populatedOrders);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// USER ROUTES

// Get user by token
app.get('/getUser', fetchUser, async (req, res) => {
  res.json(req.user);
});

// Get user by email
app.post('/getUser', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const user = await Users.findOne({ email });
    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});


// Update user (any field)
app.put('/updateUser', fetchUser, async (req, res) => {
  try {
    const user = await Users.findByIdAndUpdate(
      req.user._id,
      { $set: req.body },
      { new: true }
    );
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all users
app.get('/getAllUsers', async (req, res) => {
  try {
    const users = await Users.find().sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// MERCHANT ROUTES

// Get merchant by token
app.get('/getMerchant', fetchMerchant, async (req, res) => {
  res.json(req.merchant);
});

// Get merchant by email
app.post('/getMerchant', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const merchant = await Merchant.findOne({ email });
    if (!merchant) return res.status(404).json({ error: 'Merchant not found' });

    res.json(merchant);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});


// Update merchant (any field)
app.put('/updateMerchant', fetchMerchant, async (req, res) => {
  try {
    const merchant = await Merchant.findByIdAndUpdate(
      req.merchant._id,
      { $set: req.body },
      { new: true }
    );
    res.json(merchant);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all merchants
app.get('/getAllMerchants', async (req, res) => {
  try {
    const merchants = await Merchant.find().sort({ createdAt: -1 });
    res.json(merchants);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

//REPORTS AND ISSUES
const ReportsAndIssuesSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true }, // Main contact email
  orderId: { type: String, required: true },
  date: { type: Date, default: Date.now },
  issueType: { type: String, required: true },
  description: { type: String, required: true },
  reportStatus: { 
    type: String, 
    default: 'Pending'
  },
  attachment: { type: String },
  reporterType: { 
    type: String,
    required: true 
  },
  reporterId: { 
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    refPath: 'reporterType'
  },
  reporter_email: { type: String, required: true }, // Explicit reporter email field
  createdAt: { type: Date, default: Date.now }
});
const ReportsAndIssues = mongoose.model('ReportsAndIssues', ReportsAndIssuesSchema);

// Add Report/Issue for User
app.post('/add-report', fetchUser, async (req, res) => {
  try {
    const { orderId, issueType, description, attachment } = req.body;

    const newReport = new ReportsAndIssues({
      name: req.user.name,
      email: req.user.email,
      orderId,
      issueType,
      description,
      attachment,
      reporterType: 'User', // Hardcoded for this route
      reporterId: req.user._id, // User's ObjectId
      reporter_email: req.user.email
    });

    await newReport.save();

    // Add to user's reports array
    req.user.reportsAndIssues.push(newReport._id);
    await req.user.save();

    res.status(201).json({
      success: true,
      message: "User report submitted successfully",
      report: newReport
    });

  } catch (error) {
    console.error("User Report Error:", error);
    res.status(500).json({ error: "Failed to submit user report" });
  }
});

app.post('/merchant/add-report', fetchMerchant, async (req, res) => {
  try {
    const { orderId, issueType, description, attachment } = req.body;

    const newReport = new ReportsAndIssues({
      name: `${req.merchant.firstName} ${req.merchant.lastName}`,
      email: req.merchant.email,
      orderId,
      issueType,
      description,
      attachment,
      reporterType: 'Merchant', // Hardcoded for this route
      reporterId: req.merchant._id, // Merchant's ObjectId
      reporter_email: req.merchant.email
    });

    await newReport.save();

    // Add to merchant's reports array
    req.merchant.reportsAndIssues.push(newReport._id);
    await req.merchant.save();

    res.status(201).json({
      success: true,
      message: "Merchant report submitted successfully",
      report: newReport
    });

  } catch (error) {
    console.error("Merchant Report Error:", error);
    res.status(500).json({ error: "Failed to submit merchant report" });
  }
});

// For Users
app.get('/my-reports', fetchUser, async (req, res) => {
  try {
    const reports = await ReportsAndIssues.find({ reporterId: req.user._id });
    res.json({ success: true, reports });
  } catch (error) {
    console.error("Get User Reports Error:", error);
    res.status(500).json({ error: "Failed to fetch reports" });
  }
});

// For Merchants
app.get('/merchant/my-reports', fetchMerchant, async (req, res) => {
  try {
    const reports = await ReportsAndIssues.find({ reporterId: req.merchant._id });
    res.json({ success: true, reports });
  } catch (error) {
    console.error("Get Merchant Reports Error:", error);
    res.status(500).json({ error: "Failed to fetch reports" });
  }
});

app.get('/reports-by-email', async (req, res) => {
  try {
    const { email } = req.body;
    
    // Validate email exists in body
    if (!email) {
      return res.status(400).json({ 
        success: false,
        error: "Email is required in request body" 
      });
    }

    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: "Invalid email format"
      });
    }

    const reports = await ReportsAndIssues.find({ 
      $or: [
        { email: email },
        { reporter_email: email }
      ]
    }).sort({ createdAt: -1 });

    if (reports.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No reports found for this email"
      });
    }

    res.json({ 
      success: true,
      count: reports.length,
      reports 
    });

  } catch (error) {
    console.error("Get Reports by Email Error:", error);
    res.status(500).json({ 
      success: false,
      error: "Failed to fetch reports",
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});


app.patch('/update-report', async (req, res) => {
  try {
    const { reportId, updates } = req.body;

    // Validate required fields
    if (!reportId) {
      return res.status(400).json({ 
        success: false,
        error: "reportId is required in request body" 
      });
    }

    // Validate reportId format
    if (!mongoose.Types.ObjectId.isValid(reportId)) {
      return res.status(400).json({
        success: false,
        error: "Invalid report ID format"
      });
    }

    // Prevent changing protected fields
    const protectedFields = ['reporterType', 'reporterId', 'reporter_email', 'email', '_id'];
    const updateFields = Object.keys(updates || {});
    
    const hasProtectedField = updateFields.some(field => 
      protectedFields.includes(field)
    );
    
    if (hasProtectedField) {
      return res.status(403).json({
        success: false,
        error: "Cannot modify protected fields"
      });
    }

    // Update the specific report by ID
    const updatedReport = await ReportsAndIssues.findByIdAndUpdate(
      reportId,
      updates,
      { new: true, runValidators: true }
    );

    if (!updatedReport) {
      return res.status(404).json({
        success: false,
        error: "Report not found"
      });
    }

    res.json({
      success: true,
      message: "Report updated successfully",
      report: updatedReport
    });

  } catch (error) {
    console.error("Update Report Error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to update report",
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

app.get('/all-reports', async (req, res) => {
  try {
    const reports = await ReportsAndIssues.find()
      .sort({ createdAt: -1 }) // Newest first
      .lean(); // Convert to plain JS objects

    res.json({
      success: true,
      count: reports.length,
      reports
    });
  } catch (error) {
    console.error("Get All Reports Error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch reports",
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

//ADDITIONAL ENDPOINTS

app.get('/allServices', async (req, res) => {
  try {
    // Get all merchants' serviceType arrays
    const merchants = await Merchant.find({}, 'serviceType');

    // Flatten the array of arrays into one array
    const allServices = merchants.flatMap(m => m.serviceType);

    // Get only unique services
    const uniqueServices = [...new Set(allServices)];

    res.status(200).json({ services: uniqueServices });
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error });
  }
});

//QUOTATIONS

const QuotationSchema = new mongoose.Schema({
  work_assignment: { type: String, required: true },
  description: { type: String, required: true },
  address: { type: String, required: true },
  date: { type: Date, required: true },
  time: { type: String, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'Users', required: true },
  merchantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Merchant', required: true },
  status: { type: String, enum: ['pending', 'accepted', 'rejected', 'completed'], default: 'pending' },
  createdAt: { type: Date, default: Date.now }
});

const Quotation = mongoose.model('Quotation', QuotationSchema);

app.post('/addQuotation', fetchUser, async (req, res) => {
  try {
    const { work_assignment, description, address, date, time, merchantId } = req.body;

    const newQuotation = new Quotation({
      work_assignment,
      description,
      address,
      date,
      time,
      userId: req.user._id,
      merchantId
    });

    const savedQuotation = await newQuotation.save();

    // Push only the ID to User & Merchant
    await Users.findByIdAndUpdate(
      req.user._id,
      { $push: { quotations: savedQuotation._id } }
    );

    await Merchant.findByIdAndUpdate(
      merchantId,
      { $push: { quotations: savedQuotation._id } }
    );

    res.status(201).json(savedQuotation);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/quotations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const updatedQuotation = await Quotation.findByIdAndUpdate(id, updates, { new: true });

    if (!updatedQuotation) {
      return res.status(404).json({ error: 'Quotation not found' });
    }

    res.json(updatedQuotation);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});


// Get all quotations for a user (populated)
app.get('/user/quotations', fetchUser, async (req, res) => {
  try {
    const user = await Users.findById(req.user._id)
      .populate('quotations') // Automatically fills full data
      .select('quotations');

    res.json(user.quotations);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all quotations for a merchant (populated)
app.get('/merchant/quotations', fetchMerchant, async (req, res) => {
  try {
    const merchant = await Merchant.findById(req.merchant._id)
      .populate('quotations')
      .select('quotations');

    res.json(merchant.quotations);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});



// Start the server
app.listen(port, (error) => {
    if (!error) {
        console.log("Server is running on " + port);
    } else {
        console.log("Server is not running, error - " + error);
    }
});
