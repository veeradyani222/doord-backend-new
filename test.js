// const Users = mongoose.model('Users', new mongoose.Schema({
//     name: { type: String },
//     email: { type: String, unique: true },
//     password: { type: String },
//     mobile_number: { type: String, unique: true },
//     cartData: { type: Object, default: {} },
//     wishlistData: { type: Object, default: {} },
//     buyData: { type: Object, default: {} }, // Updated buyData field
//     verified: { type: Boolean, default: false },
//     verificationToken: { type: String },
//     comments: { type: String },
//     Date: { type: Date, default: Date.now }
// }));
// // Nodemailer setup (configure with your email service)
// const transporter = nodemailer.createTransport({
//     service: 'gmail',
//     auth: {
//         user: process.env.EMAIL_USER, 
//         pass: process.env.EMAIL_PASS 
//     },
// });



// // Endpoint for user signup
// app.post('/signup', async (req, res) => {
//     try {
//         // Check if the user already exists
//         let check = await Users.findOne({ email: req.body.email });
//         if (check) {
//             return res.status(400).json({ success: false, errors: "This user already exists." });
//         }

//         // Generate a random email verification token
//         const emailToken = crypto.randomBytes(16).toString('hex');

//         // Create a new user
//         const user = new Users({
//             name: req.body.username,
//             email: req.body.email,
//             password: req.body.password, // Consider hashing the password before saving
//             mobile_number: req.body.mobile_number,
//             verificationToken: emailToken,
//         });

//         await user.save();

//         // HTML for verification email
//         const verifyMailHtml = `
//             <div style="font-family: Arial, sans-serif; color: #333; padding: 20px; max-width: 600px; margin: auto; border: 1px solid #ddd; border-radius: 10px;">
//                 <h1 style="color: #d14822; text-align: center;">Welcome to Our Community!</h1>
//                 <p style="font-size: 16px; line-height: 1.5;">
//                     We're excited to have you on board. To complete your registration and unlock all the great features, please verify your email address by clicking the button below:
//                 </p>
//                 <div style="text-align: center; margin: 20px 0;">
//                     <a href="https://prolibrary.onrender.com/verify-email?token=${emailToken}" target="_blank" style="display: inline-block; background-color: #28a745; color: white; padding: 12px 24px; font-size: 16px; border-radius: 5px; text-decoration: none;">
//                         Verify Email
//                     </a>
//                 </div>
//                 <p style="font-size: 14px; color: #555; margin-top: 20px;">
//                     If the button above doesn't work, please copy and paste the link below into your browser to verify your email:
//                 </p>
//                 <p style="font-size: 14px; color: #555; background-color: #f9f9f9; padding: 10px; border-radius: 5px; border: 1px solid #ccc;">
//                     https://prolibrary.onrender.com/verify-email?token=${emailToken}
//                 </p>
//                 <p style="font-size: 16px; margin-top: 20px;">
//                     After verifying your email, feel free to explore our exclusive resources at the Pro Library and connect with us on social media!
//                 </p>
//                 <div style="text-align: center; margin: 20px 0;">
//                     <a href=" https://pro-library-c70q.onrender.com" target="_blank" style="display: inline-block; background-color: #d14822; color: white; padding: 12px 24px; font-size: 16px; border-radius: 5px; text-decoration: none;">
//                         Visit Pro Library
//                     </a>
//                 </div>
//                 <p style="font-size: 14px; color: #555;">
//                     Stay connected: <br>
//                     <a href="https://www.facebook.com" style="color: #d14822;">Facebook</a> | 
//                     <a href="https://www.twitter.com" style="color: #d14822;">Twitter</a> | 
//                     <a href="https://www.linkedin.com" style="color: #d14822;">LinkedIn</a>
//                 </p>
//                 <footer style="text-align: center; margin-top: 30px;">
//                     <p style="font-size: 12px; color: #aaa;">Designed and developed with love by <a href="https://veeradyani-portfolio.com" style="color: #0056b3;">Veer Adyani</a></p>
//                 </footer>
//             </div>
//         `;

//         // Email options
//         const verifyMail = {
//             from: 'veeradyani2@gmail.com',
//             to: user.email,
//             subject: 'Welcome to Our Community! Verify Your Email',
//             html: verifyMailHtml,
//         };

//         // Send verification email
//         transporter.sendMail(verifyMail, (err, info) => {
//             if (err) {
//                 console.error("Error sending email:", err);
//                 return res.status(500).json({ success: false, errors: 'Failed to send verification email' });
//             }
//             res.json({ success: true, message: 'Please verify your email' });
//         });

//     } catch (error) {
//         console.error("Error during signup:", error);
//         res.status(500).json({ error: "Signup failed" });
//     }
// });

// // Endpoint for verifying email
// app.get('/verify-email', async (req, res) => {
//     try {
//         const { token } = req.query;

//         // Find user by verification token
//         let user = await Users.findOne({ verificationToken: token });
//         if (!user) {
//             return res.status(400).json({ success: false, errors: "Invalid token or user not found" });
//         }

//         // Set email as verified and clear the token
//         user.verified = true;
//         user.verificationToken = null;
//         await user.save();

        
//         res.json({ success: true, message: 'Email verified successfully, now please go back to the website and login.' });
//     } catch (error) {
//         console.error("Error during email verification:", error);
//         res.status(500).json({ error: "Email verification failed" });
//     }
// });

// app.post('/login', async (req, res) => {
//     let user = await Users.findOne({ email: req.body.email });
//     if (user) {
//         const passwordCompare = req.body.password === user.password; // Consider hashing the password and comparing
//         if (passwordCompare) {
//             const data = {
//                 user: {
//                     id: user.id,
//                 }
//             };
//             const token = jwt.sign(data, 'secret_ecom', { expiresIn: '730h' }); // Token expiration can be set
//             res.json({ success: true, token });
//         } else {
//             res.json({ success: false, errors: "Wrong Password" });
//         }
//     } else {
//         res.json({ success: false, errors: "Wrong Email Id" });
//     }
// });


// Schema for creating Products
// const Product = mongoose.model("Product", new mongoose.Schema({
//     id: { type: Number, required: true },
//     name: { type: String, required: true },
//     image: { type: String, required: true },
//     category: { type: String, required: true },
//     sub_category: { type: String, required: true },
//     lecturer: { type: String, required: true },
//     new_price: { type: Number, required: true },
//     old_price: { type: Number, required: true },
//     kit_contents: { type: String, required: true },
//     lecture_duration: { type: String, required: true },
//     batch_start: { type: String, required: true },
//     batch_end: { type: String, required: true },
//     ammendment_support: { type: String, required: true },
//     validity: { type: String, required: true },
//     views: { type: String, required: true },
//     mode: { type: String, required: true },
//     language: { type: String, required: true },
//     study_material: { type: String, required: true },
//     doubt_solving: { type: String, required: true },
//     technical_support: { type: String, required: true },
//     note: { type: String, required: true },
//     about_faculty: { type: String, required: true },
//     specifications:{ type: [String], required: true },
//     tag:{ type: String, required: false }, 
//     hide:{ type: Boolean, default:false, required:false},
//     date: { type: Date, default: Date.now },
//     available: { type: Boolean, default: true }
// }));

// app.post('/addproduct', upload.single('file'), async (req, res) => {
//     try {
//         const filePath = req.file.path;
//         const workbook = xlsx.readFile(filePath);
//         const sheetName = workbook.SheetNames[0];
//         const sheetData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

//         console.log("Parsed Excel Data:", sheetData);

//         const allProductImages = await ProductImage.find();
//         const imageMap = {};
//         allProductImages.forEach(image => {
//             imageMap[image.image_code] = image.image;
//         });

//         const products = [];
//         for (let row of sheetData) {
//             // Validate required fields
//             if (!row.name || !row.image_code) {
//                 console.error("Missing required fields in row:", row);
//                 continue;
//             }

//             const lastProduct = await Product.findOne({}, {}, { sort: { id: -1 } });
//             const id = lastProduct ? lastProduct.id + 1 : 1;

//             // Get the image URL from the map
//             const imageUrl = imageMap[row.image_code];
//             if (!imageUrl) {
//                 console.error(`No image found for image_code: ${row.image_code}. Skipping product.`);
//                 continue; // Skip this row if no image URL is found
//             }

//             // Build product object based on the schema
//             const product = new Product({
//                 id: id,
//                 name: row.name,
//                 image: imageUrl,
//                 category: row.category,
//                 sub_category: row.sub_category,
//                 lecturer: row.lecturer,
//                 new_price: row.new_price,
//                 old_price: row.old_price,
//                 kit_contents: row.kit_contents,
//                 lecture_duration: row.lecture_duration,
//                 batch_start: row.batch_start,
//                 batch_end: row.batch_end,
//                 ammendment_support: row.ammendment_support,
//                 validity: row.validity,
//                 views: row.views,
//                 mode: row.mode,
//                 language: row.language,
//                 study_material: row.study_material,
//                 doubt_solving: row.doubt_solving,
//                 technical_support: row.technical_support,
//                 note: row.note,
//                 about_faculty: row.about_faculty,
//                 product_link: row.product_link,
//                 specifications:row.specifications,
//                 tag:row.tag || null,  
//                 hide: row.hide !== undefined && row.hide !== null ? row.hide : false,
//                 date: Date.now(),
//                 available: row.available !== undefined ? row.available : true  // Default true if not specified
//             });

//             await product.save();
//             products.push(product);
//         }

//         res.json({
//             success: true,
//             products,
//         });
//     } catch (error) {
//         console.error("Error adding products:", error);
//         res.status(500).json({ error: "Failed to add products" });
//     }
// });

// app.get('/allproducts', async (req, res) => {
//     try {
//         let products = await Product.find({}).sort({ date: -1 }); // Sort by date in descending order
//         res.send(products);
//     } catch (error) {
//         console.error("Error fetching products:", error);
//         res.status(500).json({ error: "Failed to fetch products" });
//     }
// });




// // Endpoint for removing a product
// app.post('/removeproduct', async (req, res) => {
//     await Product.findOneAndDelete({ id: req.body.id });

//     res.json({
//         success: true,
//         name: req.body.name,
//     });
// });

const QuoteYourPrice = mongoose.model("QuoteYourPrice", new mongoose.Schema({
    id: { type: Number, required: true },
    name: { type: String, required: true }, // Your Name
    email: { type: String, required: true }, // Your Email
    mobile: { type: String, required: true }, // Your Mobile No (only 10 Digit)
    seller: { type: String, required: true }, // Your Email
    quotedprice: { type: String, required: true }, // Your Email
    productname: { type: String, required: true }, // Your Email
    productid: { type: String, required: true }, // Your Email
    image: { type: String }, // Payment Screen Shot
    date: { type: Date, default: Date.now }, // Date
}));



// Endpoint for adding an order
app.post('/addQuoteYourPrice', upload.single('image'), async (req, res) => {
    try {
        const lastOrder = await Order.findOne({}, {}, { sort: { id: -1 } });
        const id = lastOrder ? lastOrder.id + 1 : 1;

        const order = new Order({
            id: id,
            name: req.body.name,
            email: req.body.email,
            mobile: req.body.mobile,
            subject: req.body.subject,
            postal_address: req.body.postal_address,
            state: req.body.state,
            city: req.body.city,
            pin_code: req.body.pin_code,
            faculty: req.body.faculty,
            course_level: req.body.course_level,
            course_type: req.body.course_type,
            mode_of_lectures: req.body.mode_of_lectures,
            exam_attempt_month: req.body.exam_attempt_month,
            exam_attempt_year: req.body.exam_attempt_year,
            product_mrp: req.body.product_mrp,
            amount_paid: req.body.amount_paid,
            amount_due: req.body.amount_due,
            mode_of_payment: req.body.mode_of_payment,
            upi_merchant_name: req.body.upi_merchant_name,
            paid_to: req.body.paid_to,
            image: req.body.image, // Receives Cloudinary URL from frontend
        });

        await order.save();
        res.json({ success: true, name: req.body.name });
    } catch (error) {
        console.error("Error saving order:", error);
        res.status(500).json({ error: "Failed to add order" });
    }
});


app.get('/allorders', async (req, res) => {
    let orders = await Order.find({}).sort({ date: -1 });
    res.send(orders);
});



// Endpoint for removing a product
app.post('/removeorder', async (req, res) => {
    await Order.findOneAndDelete({ id: req.body.id });

    res.json({
        success: true,
        name: req.body.name,
    });
});

