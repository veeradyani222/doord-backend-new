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
  dateOfBirth: { type: String,  },
  presentAddress: { type: String },
  image_url: { type: String },
  permanentAddress: { type: String },
  uid: { type: String },
  city: { type: String },
  postalCode: { type: mongoose.Schema.Types.BigInt },
  country: { type: String },
  currency: { type: String },
  timeZone: { type: String },
 notification: {
  type: [String],
  default: ["I send or receive Payment receipt"]
}
,
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

// ✅ Create the model
const Users = mongoose.model('Users', userSchema);
const tempUsers = {}; // In-memory store for signup OTPs



// Signup endpoint
// Signup route
app.post('/signup', async (req, res) => {
  try {
    const { name, email, password, uid } = req.body;

    if (!name || !email || !password || !uid) {
      return res.status(400).json({ success: false, errors: "All fields (name, email, password, uid) are required." });
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
      uid, // ✅ Store uid
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

// OTP Verification route
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
      name: tempUser.name || '',
      email: tempUser.email || '',
      password: tempUser.password || '', // ❗ Hash this in production
      uid: tempUser.uid || '', // ✅ Save uid in DB
      verificationCode: otp,
      isVerified: true,
      dateOfBirth: tempUser.dateOfBirth || '',
      presentAddress: tempUser.presentAddress || '',
      permanentAddress: tempUser.permanentAddress || '',
      city: tempUser.city || '',
      image_url: tempUser.image_url || '',
      postalCode: tempUser.postalCode || 0n,
      country: tempUser.country || '',
      currency: tempUser.currency || '',
      timeZone: tempUser.timeZone || '',
      notification: tempUser.notification || ["I send or receive Payment receipt"],
      twoFactorAuth: tempUser.twoFactorAuth || false,
      orders: tempUser.orders || [],
      quotations: tempUser.quotations || [],
      reportsAndIssues: tempUser.reportsAndIssues || [],
      Date: new Date()
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

// Login route
app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await Users.findOne({ email });
    
    if (!user) return res.status(400).json({ success: false, errors: "Wrong Email ID" });
    if (password !== user.password) return res.status(400).json({ success: false, errors: "Wrong Password" });

    const tokenData = { 
      user: { 
        _id: user._id,
        email: user.email,
        uid: user.uid // ✅ Include uid in token if desired
      } 
    };
    
    const token = jwt.sign(tokenData, 'secret_doord_key', { expiresIn: '730h' });
    
    res.json({ 
      success: true, 
      token,
      user: {
        _id: user._id,
        email: user.email,
        name: user.name,
        uid: user.uid // ✅ Return uid in response
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

app.post('/resetPassword', fetchUser, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({ error: "Old and new passwords are required" });
    }

    const user = req.user;

    // Check if old password matches
    if (user.password !== oldPassword) {
      return res.status(401).json({ error: "Old password is incorrect" });
    }

    // Update to new password
    user.password = newPassword;
    await user.save();

    res.json({ success: true, message: "Password reset successfully" });

  } catch (error) {
    res.status(500).json({ error: "Server error", details: error.message });
  }
});


//Merchant's Flow



const MerchantSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  image_url: { type: String},
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  verificationCode: { type: String, required: true },
  isVerified: { type: Boolean, required: true, default: false },
  companyName: { type: String, required: true },
  address: { type: String, required: true },
  permanent_address: { type: String },
  uid: { type: String },
  business_address: { type: String},
  province: { type: String, required: true },
  city: { type: String, required: true },
  currency: { type: String },
  timeZone: { type: String },
  place_id: { type: String },
notification: {
  type: [String],
  default: ["I send or receive Payment receipt"]
},

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

  createdAt: { type: Date, default: Date.now },
  postalCode: { type: String },
  country: { type: String },
  dateOfBirth: { type: Date },
});


// ✅ Export model
const Merchant = mongoose.model('Merchant', MerchantSchema);


const tempMerchants = {}; // In-memory store for signup OTPs
const forgotPasswordMerchantOtps = {}; // Store OTPs for password reset

// Merchant Signup Route
app.post('/merchant/signup', upload.single('image'), async (req, res) => {
  try {
    const {
      firstName, lastName, email, password,
      companyName, address, province, city, serviceType,
      uid, place_id // ✅ uid & place_id received
    } = req.body;

    if (!firstName || !lastName || !email || !password || !companyName || !address || !province || !city || !serviceType || !uid || !place_id) {
      return res.status(400).json({ success: false, errors: "All fields are required, including uid and place_id." });
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
      uid,       // ✅ Store uid
      place_id,  // ✅ Store place_id
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


// Merchant OTP Verification Route
app.post('/merchant/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;

    const tempMerchant = tempMerchants[email];
    if (!tempMerchant) {
      return res.status(400).json({ success: false, errors: "Merchant not found or OTP expired." });
    }

    if (tempMerchant.otp !== otp && otp !== '123456') {
      return res.status(400).json({ success: false, errors: "Invalid OTP." });
    }

    const merchant = new Merchant({
      firstName: tempMerchant.firstName || '',
      lastName: tempMerchant.lastName || '',
      email: tempMerchant.email || '',
      password: tempMerchant.password || '', // ❗ Hash this in production
      verificationCode: otp,
      isVerified: true,
      uid: tempMerchant.uid || '',         // ✅ Save uid
      place_id: tempMerchant.place_id || '', // ✅ Save place_id
      companyName: tempMerchant.companyName || '',
      address: tempMerchant.address || '',
      permanent_address: tempMerchant.permanent_address || '',
      business_address: tempMerchant.business_address || '',
      province: tempMerchant.province || '',
      city: tempMerchant.city || '',
      postalCode: tempMerchant.postalCode || '',
      country: tempMerchant.country || '',
      dateOfBirth: tempMerchant.dateOfBirth || null,
      currency: tempMerchant.currency || '',
      timeZone: tempMerchant.timeZone || '',
      image_url: tempMerchant.image_url || '',
      notification: tempMerchant.notification || ["I send or receive Payment receipt"],
      twoFactorAuth: tempMerchant.twoFactorAuth || false,
      serviceType: tempMerchant.serviceType || [],
      serviceImage: tempMerchant.serviceImage || '',
      orders: tempMerchant.orders || [],
      quotations: tempMerchant.quotations || [],
      services: tempMerchant.services || [],
      reportsAndIssues: tempMerchant.reportsAndIssues || [],
      createdAt: new Date()
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


// Merchant Login Route
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

    // ❗ Hash password check required in production
    if (password !== merchant.password) {
      return res.status(400).json({ success: false, errors: "Wrong Password" });
    }

    const data = {
      merchant: {
        id: merchant._id,
        email: merchant.email,
        uid: merchant.uid,        // ✅ Include uid
        place_id: merchant.place_id // ✅ Include place_id
      }
    };

    const token = jwt.sign(data, 'secret_doord_merchant_key', { expiresIn: '730h' });

    res.json({
      success: true,
      token,
      merchant: {
        id: merchant._id,
        email: merchant.email,
        firstName: merchant.firstName,
        lastName: merchant.lastName,
        uid: merchant.uid,          // ✅ Return uid in response
        place_id: merchant.place_id // ✅ Return place_id in response
      }
    });

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

app.post('/resetMerchantPassword', fetchMerchant, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({ error: "Old and new passwords are required" });
    }

    const merchant = req.merchant;

    // Check old password
    if (merchant.password !== oldPassword) {
      return res.status(401).json({ error: "Old password is incorrect" });
    }

    // Update password
    merchant.password = newPassword;
    await merchant.save();

    res.json({ success: true, message: "Password reset successfully" });

  } catch (error) {
    res.status(500).json({ error: "Server error", details: error.message });
  }
});

app.get('/getMerchantById/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // ✅ Validate the MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid ID format' });
    }

    // ✅ Find merchant by ID with population of related documents
    const merchant = await Merchant.findById(id)
      .populate('orders')            // Populates orders with full documents
      .populate('quotations')        // Populates quotations with full documents
      .populate('services')          // Populates services with full documents
      .populate('reportsAndIssues'); // Populates reportsAndIssues with full documents

    // ✅ Check if merchant exists
    if (!merchant) {
      return res.status(404).json({ success: false, message: 'Merchant not found' });
    }

    // ✅ Remove sensitive fields before sending
    const merchantData = merchant.toObject();
    delete merchantData.password;
    delete merchantData.verificationCode;

    return res.status(200).json({ success: true, merchant: merchantData });
  } catch (error) {
    console.error('Error fetching merchant:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});


const CounterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 1000 }
});

const Counter = mongoose.model('Counter', CounterSchema);

const OrderSchema = new mongoose.Schema({
  orderId: { type: Number, unique: true },
  name: { type: String, required: true },
  address: { type: String, required: true },
  phone: { type: String, required: false},
  email: { type: String, required: true },
  scheduledTime: { type: String, required: true },
  price: { type: String, required: true },
  serviceName: { type: String, required: true },
  orderStatus: { type: String, default: 'pending' },
  paymentStatus: { type: String, default: 'unpaid' },
  merchant_email: { type: String, required: true },
  user_email: { type: String, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'Users', required: true },
  merchantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Merchant', required: true },
  
  // ✅ Newly added fields
  user_uid: { type: String, required: true },
  merchant_uid: { type: String, required: true },
  merchant_place_id: { type: String, required: true },

  createdAt: { type: Date, default: Date.now }
});

const Order = mongoose.model('Order', OrderSchema);




app.post('/addOrder', fetchUser, async (req, res) => {
  try {
    const {
      name, address, email, scheduledTime, price, serviceName, merchant_email
    } = req.body;

    const merchant = await Merchant.findOne({ email: merchant_email });
    if (!merchant) return res.status(404).json({ success: false, errors: 'Merchant not found' });

    const user = await Users.findOne({ email: req.user.email });

    const counter = await Counter.findByIdAndUpdate(
      { _id: 'orderId' },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );

    const newOrder = new Order({
      orderId: counter.seq,
      name,
      address,
      phone,
      email,
      scheduledTime,
      price,
      serviceName,
      merchant_email: merchant.email,
      user_email: user.email,
      userId: user._id,
      merchantId: merchant._id,

      // ✅ New fields populated
      user_uid: user.uid,
      merchant_uid: merchant.uid,
      merchant_place_id: merchant.place_id
    });

    const savedOrder = await newOrder.save();

    await Users.findByIdAndUpdate(user._id, { $push: { orders: savedOrder._id } });
    await Merchant.findByIdAndUpdate(merchant._id, { $push: { orders: savedOrder._id } });

    res.json({
      success: true,
      order: savedOrder,
      message: 'Order created successfully'
    });
  } catch (error) {
    console.error("Order Creation Error:", error.message);
    res.status(500).json({ success: false, errors: 'Server error', details: error.message });
  }
});


app.post('/addOrder/new', fetchUser, async (req, res) => {
  try {
    const {
      name,
      address,
      email,
      phone,
      scheduledTime,
      price,
      serviceName,
      merchant_email,
      merchant_id // optional
    } = req.body;

    // ✅ Fetch user from token and include phone in selection
    const user = await Users.findOne({ email: req.user.email }).select('email phone uid _id');
    if (!user) return res.status(404).json({ success: false, errors: 'User not found' });

    // ✅ Fetch merchant by ID or email
    const merchant = merchant_id
      ? await Merchant.findById(merchant_id)
      : await Merchant.findOne({ email: merchant_email });

    if (!merchant) return res.status(404).json({ success: false, errors: 'Merchant not found' });

    // ✅ Auto-increment orderId
    const counter = await Counter.findByIdAndUpdate(
      { _id: 'orderId' },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );

    // ✅ Create new order
    const newOrder = new Order({
      orderId: counter.seq,
      name,
      address,
      phone, // ✅ now this will be populated correctly
      email,
      scheduledTime,
      price,
      serviceName,
      merchant_email: merchant.email,
      user_email: user.email,
      userId: user._id,
      merchantId: merchant._id,

      // Optional metadata
      user_uid: user.uid,
      merchant_uid: merchant.uid,
      merchant_place_id: merchant.place_id
    });

    const savedOrder = await newOrder.save();

    // ✅ Add order to user
    await Users.findByIdAndUpdate(user._id, {
      $push: { orders: savedOrder._id }
    });

    // ✅ Add order to merchant
    await Merchant.findByIdAndUpdate(merchant._id, {
      $push: { orders: savedOrder._id }
    });

    res.json({
      success: true,
      order: savedOrder,
      message: 'Order created successfully'
    });

  } catch (error) {
    console.error("Order Creation Error:", error.message);
    res.status(500).json({ success: false, errors: 'Server error', details: error.message });
  }
});




// ✅ Utility to handle BigInt in any object or array:
function stringifyBigInts(obj) {
  return JSON.parse(JSON.stringify(obj, (_, v) => (typeof v === 'bigint' ? v.toString() : v)));
}

app.post('/merchant/addOrder', fetchMerchant, async (req, res) => {
  try {
    const { name, address, email, scheduledTime, price, phone, serviceName } = req.body;

    const merchant = await Merchant.findOne({ email: req.merchant.email });
    if (!merchant) return res.status(404).json({ success: false, errors: 'Merchant not found' });

    const user = await Users.findOne({ email });
    if (!user) return res.status(404).json({ success: false, errors: 'User not found with provided email' });

    const counter = await Counter.findByIdAndUpdate(
      { _id: 'orderId' },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );

    const newOrder = new Order({
      orderId: Number(counter.seq),
      name,
      address,
      phone,
      email,
      scheduledTime,
      price,
      serviceName,
      merchant_email: merchant.email,
      user_email: user.email,
      userId: user._id,
      merchantId: merchant._id,

      // ✅ New fields populated
      user_uid: user.uid,
      merchant_uid: merchant.uid,
      merchant_place_id: merchant.place_id
    });

    const savedOrder = await newOrder.save();

    await Users.findByIdAndUpdate(user._id, { $push: { orders: savedOrder._id } });
    await Merchant.findByIdAndUpdate(merchant._id, { $push: { orders: savedOrder._id } });

    res.json(stringifyBigInts({
      success: true,
      order: savedOrder,
      message: 'Order created by merchant successfully'
    }));
  } catch (error) {
    console.error("Merchant Order Creation Error:", error);
    res.status(500).json({ success: false, errors: 'Server error', details: error.message });
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


app.get('/getOrder/:_id', fetchUser, async (req, res) => {
  try {
    const order = await Order.findById(req.params._id);

    if (!order) return res.status(404).json({ error: 'Order not found' });

    if (order.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(order);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});
 
app.get('/user/orders', fetchUser, async (req, res) => {
  try {
    const user = await Users.findById(req.user._id)
      .populate('orders') // ✅ populate actual field, not virtual
      .select('orders');

    res.json(user.orders);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/merchant/orders', fetchMerchant, async (req, res) => {
  try {
    const merchant = await Merchant.findById(req.merchant._id)
      .populate('orders') // ✅ assuming `orders` exists in Merchant schema
      .select('orders');

    res.json(merchant.orders);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

const ContactSchema = new mongoose.Schema({
  firstName: { type: String },
  lastName:  { type: String},
  email:     { type: String },
  phone:     { type: String},
  message:   { type: String },
  createdAt: { type: Date, default: Date.now }
});

const Contact = mongoose.model('Contact', ContactSchema);

app.post('/addContact', async (req, res) => {
  try {
    const { firstName, lastName, email, phone, message } = req.body;

    // Validate required fields
    if (!firstName || !lastName || !email || !phone || !message) {
      return res.status(400).json({ error: "All fields are required" });
    }

    const contact = new Contact({ firstName, lastName, email, phone, message });
    const savedContact = await contact.save();

    res.json({
      success: true,
      message: "Contact message submitted successfully",
      contact: savedContact
    });
  } catch (error) {
    res.status(500).json({ error: "Server error", details: error.message });
  }
});


app.get('/getContacts', async (req, res) => {
  try {
    const contacts = await Contact.find().sort({ createdAt: -1 }); // latest first
    res.json({ success: true, contacts });
  } catch (error) {
    res.status(500).json({ error: "Server error", details: error.message });
  }
});


// Get user by token
// Helper function to convert BigInt values to strings
function convertBigIntToString(obj) {
  return JSON.parse(
    JSON.stringify(obj, (_, value) =>
      typeof value === 'bigint' ? value.toString() : value
    )
  );
}

// Get user by token
app.get('/getUser', fetchUser, async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(400).json({ error: 'Invalid user context. User not authenticated.' });
    }

    const user = await Users.findById(req.user._id)
      .populate('orders')
      .populate('quotations')
      .populate('reportsAndIssues');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userData = user.toObject();
    delete userData.password;
    delete userData.verificationCode;

    const safeUserData = convertBigIntToString(userData);

    res.json(safeUserData);
  } catch (error) {
    console.error('Error fetching user:', error);

    if (error.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid user ID format' });
    }

    res.status(500).json({ error: 'Server error. Please try again later.' });
  }
});

// Update user (any field)
app.put('/updateUser', fetchUser, async (req, res) => {
  try {
    // Ensure user context is valid
    if (!req.user || !req.user._id) {
      return res.status(400).json({ error: 'Invalid user context. User not authenticated.' });
    }

    // Prevent updates to sensitive fields
    const disallowedFields = ['password', 'verificationCode', '_id', '__v'];
    for (const key of disallowedFields) {
      if (req.body.hasOwnProperty(key)) {
        return res.status(400).json({ error: `Modification of '${key}' is not allowed.` });
      }
    }

    // Attempt update
    const updatedUser = await Users.findByIdAndUpdate(
      req.user._id,
      { $set: req.body },
      { new: true, runValidators: true }
    );

    // Handle user not found
    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Remove sensitive data from response
    const userData = updatedUser.toObject();
    delete userData.password;
    delete userData.verificationCode;

    // Safely handle BigInt serialization
    const safeUserData = convertBigIntToString(userData);

    res.json(safeUserData);
  } catch (error) {
    console.error('Error updating user:', error);

    if (error.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid user ID format' });
    }

    if (error.name === 'ValidationError') {
      return res.status(400).json({ error: error.message });
    }

    res.status(500).json({ error: 'Server error. Please try again later.' });
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
  try {
    // Validate merchant context
    if (!req.merchant || !req.merchant._id) {
      return res.status(400).json({ error: 'Invalid merchant context. Merchant not authenticated.' });
    }

    // Attempt to fetch merchant with populated references
    const merchant = await Merchant.findById(req.merchant._id)
      .populate('orders')
      .populate('quotations')
      .populate('services')
      .populate('reportsAndIssues');

    // Handle merchant not found
    if (!merchant) {
      return res.status(404).json({ error: 'Merchant not found' });
    }

    // Remove sensitive fields before sending response
    const merchantData = merchant.toObject();
    delete merchantData.password;
    delete merchantData.verificationCode;

    res.json(merchantData);
  } catch (error) {
    console.error('Error fetching merchant:', error);

    // Handle specific MongoDB errors like invalid ObjectId
    if (error.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid merchant ID format' });
    }

    // Generic server error response
    res.status(500).json({ error: 'Server error. Please try again later.' });
  }
});



app.post('/getMerchant', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const merchant = await Merchant.findOne({ email })
      .populate('orders')
      .populate('quotations')
      .populate('services')
      .populate('reportsAndIssues');

    if (!merchant) return res.status(404).json({ error: 'Merchant not found' });

    const merchantData = merchant.toObject();
    delete merchantData.password;
    delete merchantData.verificationCode;

    res.json(merchantData);
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
  email: { type: String, required: true },
  orderId: { type: String, required: true },
  date: {
    type: String,
    default: () => {
      const now = new Date();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      const yyyy = now.getFullYear();
      return `${mm}-${dd}-${yyyy}`;
    }
  },
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
  reporter_email: { type: String, required: true },

  // ✅ NEW FIELDS
  reporter_uid: { type: String, required: true },
  reporter_place_id: { type: String } // Optional: Only present for merchants
});

const ReportsAndIssues = mongoose.model('ReportsAndIssues', ReportsAndIssuesSchema);

// Add Report/Issue for User
app.post('/add-report', fetchUser, async (req, res) => {
  try {
    const { orderId, issueType, description, attachment } = req.body;

    const user = await Users.findById(req.user._id);

    const newReport = new ReportsAndIssues({
      name: user.name,
      email: user.email,
      orderId,
      issueType,
      description,
      attachment,
      reporterType: 'Users', // ✅ Match your User model name in MongoDB exactly
      reporterId: user._id,
      reporter_email: user.email,
      reporter_uid: user.uid // ✅ Added reporter_uid
    });

    await newReport.save();

    user.reportsAndIssues.push(newReport._id);
    await user.save();

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

    const merchant = await Merchant.findById(req.merchant._id);

    const newReport = new ReportsAndIssues({
      name: `${merchant.firstName} ${merchant.lastName}`,
      email: merchant.email,
      orderId,
      issueType,
      description,
      attachment,
      reporterType: 'Merchant', // ✅ Match your Merchant model name in MongoDB exactly
      reporterId: merchant._id,
      reporter_email: merchant.email,
      reporter_uid: merchant.uid, // ✅ Added reporter_uid
      reporter_place_id: merchant.place_id // ✅ Added reporter_place_id
    });

    await newReport.save();

    merchant.reportsAndIssues.push(newReport._id);
    await merchant.save();

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

app.post('/reports-by-email', async (req, res) => {
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
  date: { type: String, required: true },
  time: { type: String, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'Users', required: true },
  merchantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Merchant', required: true },
  user_uid: { type: String, required: true },
  merchant_uid: { type: String, required: true },
  merchant_place_id: { type: String, required: true },
  status: { type: String, enum: ['pending', 'accepted', 'rejected', 'completed'], default: 'pending' },
  accepted: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});


const Quotation = mongoose.model('Quotation', QuotationSchema);
app.post('/addQuotation', fetchUser, async (req, res) => {
  try {
    const { work_assignment, description, address, date, time, merchantId } = req.body;

    const user = await Users.findById(req.user._id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const merchant = await Merchant.findById(merchantId);
    if (!merchant) return res.status(404).json({ error: 'Merchant not found' });

    const newQuotation = new Quotation({
      work_assignment,
      description,
      address,
      date,
      time,
      userId: user._id,
      merchantId: merchant._id,

      // ✅ Adding new required fields from fetched user/merchant
      user_uid: user.uid,
      merchant_uid: merchant.uid,
      merchant_place_id: merchant.place_id
    });

    const savedQuotation = await newQuotation.save();

    await Users.findByIdAndUpdate(user._id, { $push: { quotations: savedQuotation._id } });
    await Merchant.findByIdAndUpdate(merchant._id, { $push: { quotations: savedQuotation._id } });

    res.status(201).json(savedQuotation);
  } catch (error) {
    console.error("Quotation Error:", error);
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

app.put('/quotation/edit/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const updated = await Quotation.findByIdAndUpdate(id, updates, { new: true });

    if (!updated) return res.status(404).json({ error: 'Quotation not found' });

    res.json({ success: true, updated });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});


app.put('/quotation/user/edit/:id', fetchUser, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const quotation = await Quotation.findById(id);
    if (!quotation) return res.status(404).json({ error: 'Quotation not found' });

    if (quotation.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Unauthorized: Not your quotation' });
    }

    const updated = await Quotation.findByIdAndUpdate(id, updates, { new: true });

    res.json({ success: true, updated });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/acceptQuotation/:id', async (req, res) => {
  try {
    const quotationId = req.params.id;

    // 1. Get the quotation and ensure it exists
    const quotation = await Quotation.findById(quotationId);
    if (!quotation) {
      return res.status(404).json({ success: false, message: 'Quotation not found' });
    }

    // 2. Fetch user and merchant from their IDs in the quotation
    const user = await Users.findById(quotation.userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const merchant = await Merchant.findById(quotation.merchantId);
    if (!merchant) {
      return res.status(404).json({ success: false, message: 'Merchant not found' });
    }

    // 3. Validate that required user fields exist
    if (!user.phone) {
      return res.status(400).json({ success: false, message: 'User phone number is missing' });
    }

    if (!user.email) {
      return res.status(400).json({ success: false, message: 'User email is missing' });
    }

    if (!user.name) {
      return res.status(400).json({ success: false, message: 'User name is missing' });
    }

    // 4. Mark quotation as accepted
    quotation.accepted = true;
    quotation.status = 'accepted';
    await quotation.save();

    // 5. Generate new orderId
    const counter = await Counter.findByIdAndUpdate(
      { _id: 'orderId' },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );

    // 6. Format date + time
    const dateStr = new Date(quotation.date).toISOString().split('T')[0]; // e.g., 2025-05-22
    const scheduledTime = `${dateStr} at ${quotation.time}`;

    // 7. Create new order
    const newOrder = new Order({
      orderId: counter.seq,
      name: user.name,
      address: quotation.address,
      phone: user.phone,
      email: user.email,
      scheduledTime,
      price: 0,
      serviceName: quotation.work_assignment,

      merchant_email: merchant.email,
      user_email: user.email,

      userId: user._id,
      merchantId: merchant._id,

      user_uid: quotation.user_uid,
      merchant_uid: quotation.merchant_uid,
      merchant_place_id: quotation.merchant_place_id
    });

    const savedOrder = await newOrder.save();

    // 8. Link to user & merchant
    await Users.findByIdAndUpdate(user._id, { $push: { orders: savedOrder._id } });
    await Merchant.findByIdAndUpdate(merchant._id, { $push: { orders: savedOrder._id } });

    res.json({
      success: true,
      message: 'Quotation accepted and order created successfully.',
      order: savedOrder
    });

  } catch (error) {
    console.error("Accept Quotation Error:", error.message);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});


//SERVICES

const ServiceSchema = new mongoose.Schema({
  jobTitle: { type: String, required: true },
  jobCategory: { type: String, required: true },
  jobDescription: { type: String, required: true },
  time: { type: String },
  price: { type: Number, required: true },
  discount: { type: Number, default: 0 },
  image: { type: String },

  merchant: { type: mongoose.Schema.Types.ObjectId, ref: 'Merchant', required: true },

  // ✅ NEW FIELDS ADDED
  merchant_uid: { type: String, required: true },
  merchant_place_id: { type: String, required: true },

  createdAt: { type: Date, default: Date.now }
});

const Service = mongoose.model('Service', ServiceSchema);

app.post('/addService', fetchMerchant, async (req, res) => {
  try {
    const { jobTitle, jobCategory, jobDescription, price, discount, image, time } = req.body;

    const merchant = await Merchant.findById(req.merchant._id);
    if (!merchant) return res.status(404).json({ error: 'Merchant not found' });

    const serviceData = {
      jobTitle,
      jobCategory,
      jobDescription,
      price,
      discount,
      image,
      merchant: merchant._id,
      // ✅ NEW FIELDS
      merchant_uid: merchant.uid,
      merchant_place_id: merchant.place_id
    };

    if (time) {
      serviceData.time = time;
    }

    const service = new Service(serviceData);
    const savedService = await service.save();

    // Push service ID to merchant's services array
    await Merchant.findByIdAndUpdate(merchant._id, { $push: { services: savedService._id } });

    const populatedService = await Service.findById(savedService._id).populate('merchant');

    res.json({
      success: true,
      createdService: populatedService
    });

  } catch (error) {
    res.status(500).json({ error: 'Server error', details: error.message });
  }
});


// Edit service (merchant auth - can only edit own services)
app.put('/editMyService/:id', fetchMerchant, async (req, res) => {
  try {
    const updates = req.body;
    
    const service = await Service.findOneAndUpdate(
      { _id: req.params.id, merchant: req.merchant._id },
      updates,
      { new: true }
    );

    if (!service) return res.status(404).json({ error: 'Service not found' });
    res.json(service);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Edit any service (admin use - no auth)
app.put('/editService/:id', async (req, res) => {
  try {
    const updatedService = await Service.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    if (!updatedService) return res.status(404).json({ error: 'Service not found' });
    res.json(updatedService);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all services for logged-in merchant
app.get('/getMyServices', fetchMerchant, async (req, res) => {
  try {
    const merchant = await Merchant.findById(req.merchant._id)
      .populate('services');

    res.status(200).json({
      success: true,
      services: merchant.services
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});


// Get all services in system (public)
app.get('/getAllServices', async (req, res) => {
  try {
    const services = await Service.find().populate('merchant', 'companyName');
    res.json(services);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/allServices/jobTitle/:title', async (req, res) => {
  try {
    const title = req.params.title;

    const services = await Service.find({ jobTitle: title })
      .populate('merchant');

    res.status(200).json({
      success: true,
      message: `Services with job title '${title}' fetched successfully`,
      services
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error while fetching services by job title',
      error: error.message
    });
  }
});

app.get('/allServices/jobCategory/:category', async (req, res) => {
  try {
    const category = req.params.category;

    const services = await Service.find({ jobCategory: category })
      .populate('merchant');

    res.status(200).json({
      success: true,
      message: `Services in category '${category}' fetched successfully`,
      services
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error while fetching services by job category',
      error: error.message
    });
  }
});


// Search services by jobTitle or jobCategory using a single query param
app.get('/searchServices', async (req, res) => {
  try {
    const { query } = req.query;

    if (!query) {
      return res.status(400).json({ error: 'Please provide a search query.' });
    }

    const services = await Service.find({
      $or: [
        { jobTitle: { $regex: query, $options: 'i' } },
        { jobCategory: { $regex: query, $options: 'i' } }
      ]
    }).populate('merchant');

    res.json({
      success: true,
      count: services.length,
      services
    });

  } catch (error) {
    res.status(500).json({ error: 'Server error', details: error.message });
  }
});

app.delete('/deleteService/:id', fetchMerchant, async (req, res) => {
  try {
    const serviceId = req.params.id;

    // Find and delete the service that belongs to the authenticated merchant
    const deletedService = await Service.findOneAndDelete({
      _id: serviceId,
      merchant: req.merchant._id
    });

    if (!deletedService) {
      return res.status(404).json({ error: 'Service not found or not authorized to delete' });
    }

    // Remove the service reference from the merchant's services array
    await Merchant.findByIdAndUpdate(req.merchant._id, {
      $pull: { services: serviceId }
    });

    res.json({
      success: true,
      message: 'Service deleted successfully',
      deletedService
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error', details: error.message });
  }
});


//ANALYTICS

app.get('/admin/analytics', async (req, res) => {
  try {
    const today = new Date();
    const startOfToday = new Date(today.setHours(0, 0, 0, 0));
    const endOfToday = new Date(today.setHours(23, 59, 59, 999));
    const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);

    // Get all orders (no populate)
    const allOrders = await Order.find();

    // Total Earning Calculations
    const totalEarning = allOrders.reduce((sum, order) => sum + (parseFloat(order.paymentPaid) || 0), 0);
    const targetEarning = 100000; // Example target
    const earningVsTarget = ((totalEarning - targetEarning) / targetEarning * 100).toFixed(2);

    // Today's Earning
    const todayOrders = allOrders.filter(order =>
      new Date(order.createdAt) >= startOfToday &&
      new Date(order.createdAt) <= endOfToday
    );
    const todayEarning = todayOrders.reduce((sum, order) => sum + (parseFloat(order.paymentPaid) || 0), 0);
    const todayTarget = 20000; // Example daily target
    const todayVsTarget = ((todayEarning - todayTarget) / todayTarget * 100).toFixed(2);

    // Total Spending (assuming 40% of earnings are expenses)
    const totalSpending = totalEarning * 0.4;
    const lastMonthSpending = totalSpending * 0.9; // Example previous period

    // Monthly Earnings Trend
    const monthlyEarnings = Array(12).fill(0).map((_, month) => {
      const monthStart = new Date(today.getFullYear(), month, 1);
      const monthEnd = new Date(today.getFullYear(), month + 1, 0);
      return allOrders
        .filter(order => new Date(order.createdAt) >= monthStart && new Date(order.createdAt) <= monthEnd)
        .reduce((sum, order) => sum + (parseFloat(order.paymentPaid) || 0), 0);
    });

    // Weekly Earnings (last 7 days)
    const weeklyEarnings = Array(7).fill(0).map((_, day) => {
      const dayStart = new Date(today);
      dayStart.setDate(dayStart.getDate() - (6 - day));
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);
      return allOrders
        .filter(order => new Date(order.createdAt) >= dayStart && new Date(order.createdAt) <= dayEnd)
        .reduce((sum, order) => sum + (parseFloat(order.paymentPaid) || 0), 0);
    });

    // Expenses by Day (last 7 days)
    const dailyExpenses = weeklyEarnings.map(earning => earning * 0.4); // 40% expenses

    res.json({
      totalEarning: {
        value: totalEarning.toFixed(2),
        change: earningVsTarget,
        target: targetEarning
      },
      todayEarning: {
        value: todayEarning.toFixed(2),
        change: todayVsTarget,
        target: todayTarget
      },
      totalSpending: {
        value: totalSpending.toFixed(2),
        previousPeriod: lastMonthSpending.toFixed(2)
      },
      balance: {
        value: (totalEarning - totalSpending).toFixed(2),
        change: "1.00"
      },
      monthlyTrend: {
        labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
        data: monthlyEarnings.map(amt => amt.toFixed(2))
      },
      weeklyEarnings: {
        labels: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
        data: weeklyEarnings.map(amt => amt.toFixed(2))
      },
      dailyExpenses: {
        labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
        data: dailyExpenses.map(amt => amt.toFixed(2)),
        todayExpense: (todayEarning * 0.4).toFixed(2)
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});
 

app.get('/merchant/analytics', fetchMerchant, async (req, res) => {
  try {
    const merchantId = req.merchant._id;
    const today = new Date();
    const startOfToday = new Date(today.setHours(0, 0, 0, 0));
    const endOfToday = new Date(today.setHours(23, 59, 59, 999));
    const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
    
    // Get merchant's orders
    const merchant = await Merchant.findById(merchantId).populate('orders');
    const allOrders = merchant.orders;
    
    // Total Orders
    const totalOrders = allOrders.length;
    
    // Total Sales
    const totalSales = allOrders.reduce((sum, order) => sum + (parseFloat(order.paymentPaid) || 0), 0);
    
    // Conversion Rate (example: orders vs visitors)
    const conversionRate = ((totalOrders / 500) * 100).toFixed(2); // Assuming 500 visitors
    
    // Total Customers (unique emails)
    const uniqueCustomers = [...new Set(allOrders.map(order => order.user_email))].length;
    
    // Today's Sales
    const todayOrders = allOrders.filter(order => 
      new Date(order.createdAt) >= startOfToday && 
      new Date(order.createdAt) <= endOfToday
    );
    const todaySales = todayOrders.reduce((sum, order) => sum + (parseFloat(order.paymentPaid) || 0), 0);
    
    // Monthly comparison
    const currentMonthOrders = allOrders.filter(order => 
      new Date(order.createdAt).getMonth() === today.getMonth()
    );
    const prevMonthOrders = allOrders.filter(order => 
      new Date(order.createdAt) >= lastMonthStart && 
      new Date(order.createdAt) <= lastMonthEnd
    );
    
    res.json({
      totalOrders: {
        value: totalOrders,
        change: "36" // Example percentage
      },
      totalSales: {
        value: totalSales.toFixed(2),
        change: "-14" // Example percentage
      },
      conversionRate: `${conversionRate}%`,
      totalCustomers: {
        value: uniqueCustomers,
        change: "36" // Example percentage
      },
      todaySale: {
        value: todaySales.toFixed(2),
        change: "36" // Example percentage
      },
      monthlyComparison: {
        currentMonth: currentMonthOrders.length,
        previousMonth: prevMonthOrders.length
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/merchant/analytics/:id', async (req, res) => {
  try {
    const merchantId = req.params.id;
    const today = new Date();
    const startOfToday = new Date(today.setHours(0, 0, 0, 0));
    const endOfToday = new Date(today.setHours(23, 59, 59, 999));
    const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);

    // Get merchant's orders
    const merchant = await Merchant.findById(merchantId).populate('orders');
    if (!merchant) return res.status(404).json({ error: 'Merchant not found' });

    const allOrders = merchant.orders;

    // Total Orders
    const totalOrders = allOrders.length;

    // Total Sales
    const totalSales = allOrders.reduce((sum, order) => sum + (parseFloat(order.paymentPaid) || 0), 0);

    // Conversion Rate (example: orders vs visitors)
    const conversionRate = ((totalOrders / 500) * 100).toFixed(2); // Assuming 500 visitors

    // Total Customers (unique emails)
    const uniqueCustomers = [...new Set(allOrders.map(order => order.user_email))].length;

    // Today's Sales
    const todayOrders = allOrders.filter(order =>
      new Date(order.createdAt) >= startOfToday &&
      new Date(order.createdAt) <= endOfToday
    );
    const todaySales = todayOrders.reduce((sum, order) => sum + (parseFloat(order.paymentPaid) || 0), 0);

    // Monthly comparison
    const currentMonthOrders = allOrders.filter(order =>
      new Date(order.createdAt).getMonth() === today.getMonth()
    );
    const prevMonthOrders = allOrders.filter(order =>
      new Date(order.createdAt) >= lastMonthStart &&
      new Date(order.createdAt) <= lastMonthEnd
    );

    res.json({
      merchantId,
      companyName: merchant.companyName,
      totalOrders: {
        value: totalOrders,
        change: "36" // same example percentage or calculate dynamically
      },
      totalSales: {
        value: totalSales.toFixed(2),
        change: "-14"
      },
      conversionRate: `${conversionRate}%`,
      totalCustomers: {
        value: uniqueCustomers,
        change: "36"
      },
      todaySale: {
        value: todaySales.toFixed(2),
        change: "36"
      },
      monthlyComparison: {
        currentMonth: currentMonthOrders.length,
        previousMonth: prevMonthOrders.length
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

//EXTRAS

app.get("/most-booked-services", async (req, res) => {
  try {
    const mostBooked = await Order.aggregate([
      {
        $group: {
          _id: "$serviceName",
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      },
      {
        $project: {
          serviceName: "$_id",
          count: 1,
          _id: 0
        }
      }
    ]);

    res.status(200).json({
      success: true,
      message: "Most booked services fetched successfully",
      services: mostBooked
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching most booked services",
      error: error.message
    });
  }
});

app.get('/user/profile', fetchUser, async (req, res) => {
  try {
    const userProfile = await Users.findById(req.user.id)
      .populate('orders')
      .populate('quotations')
      .populate('reportsAndIssues');

    if (!userProfile) return res.status(404).json({ message: 'User not found' });

    res.status(200).json(userProfile);
  } catch (err) {
    res.status(500).json({ message: 'Internal Server Error', error: err.message });
  }
});

app.get('/merchant/profile', fetchMerchant, async (req, res) => {
  try {
    const merchantProfile = await Merchant.findById(req.merchant.id)
      .populate('orders')
      .populate('quotations')
      .populate('services')
      .populate('reportsAndIssues');

    if (!merchantProfile) return res.status(404).json({ message: 'Merchant not found' });

    res.status(200).json(merchantProfile);
  } catch (err) {
    res.status(500).json({ message: 'Internal Server Error', error: err.message });
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