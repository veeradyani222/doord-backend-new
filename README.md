
# 📦 Doord Backend API Documentation

This documentation outlines all backend API endpoints for the Doord platform. Use this as a complete guide for integrating frontend functionality with the server.

---

## 🌐 Base URL

```
https://doord-backend-new.onrender.com/ 
```

---

## 📌 Headers

### Auth Headers

| Header Name           | Value                                  | Required |
|-----------------------|----------------------------------------|----------|
| `auth-token`          | JWT token (for user-protected routes)  | ✅       | 
| `merchant-auth-token` | JWT token (for merchant-protected routes) | ✅       |

---

## SCHEMAS

🧑 User Schema
| Field            | Type                           | Required | Default                             | Notes                         |
| ---------------- | ------------------------------ | -------- | ----------------------------------- | ----------------------------- |
| name             | String                         | Yes      | -                                   | -                             |
| email            | String                         | Yes      | -                                   | Must be unique                |
| password         | String                         | Yes      | -                                   | -                             |
| verificationCode | String                         | Yes      | -                                   | -                             |
| isVerified       | Boolean                        | Yes      | false                               | -                             |
| dateOfBirth      | Date                           | Yes      | -                                   | -                             |
| presentAddress   | String                         | No       | -                                   | -                             |
| permanentAddress | String                         | No       | -                                   | -                             |
| city             | String                         | No       | -                                   | -                             |
| postalCode       | BigInt                         | No       | -                                   | -                             |
| country          | String                         | No       | -                                   | -                             |
| currency         | String                         | No       | -                                   | -                             |
| timeZone         | String                         | No       | -                                   | -                             |
| notification     | String                         | No       | "I send or receive Payment receipt" | -                             |
| twoFactorAuth    | Boolean                        | No       | false                               | -                             |
| orders           | \[ObjectId → Order]            | No       | -                                   | References `Order` model      |
| quotations       | \[ObjectId → Quotation]        | No       | -                                   | References `Quotation` model  |
| reportsAndIssues | \[ObjectId → ReportsAndIssues] | No       | \[]                                 | References `ReportsAndIssues` |
| Date             | Date                           | No       | Date.now                            | Created date                  |



🧑‍💼 Merchant Schema

| Field              | Type                           | Required | Default                             | Notes             |
| ------------------ | ------------------------------ | -------- | ----------------------------------- | ----------------- |
| firstName          | String                         | Yes      | -                                   | -                 |
| lastName           | String                         | Yes      | -                                   | -                 |
| email              | String                         | Yes      | -                                   | Must be unique    |
| password           | String                         | Yes      | -                                   | -                 |
| verificationCode   | String                         | Yes      | -                                   | -                 |
| isVerified         | Boolean                        | Yes      | false                               | -                 |
| companyName        | String                         | Yes      | -                                   | -                 |
| address            | String                         | Yes      | -                                   | -                 |
| permanent\_address | String                         | No       | -                                   | -                 |
| business\_address  | String                         | No       | -                                   | -                 |
| province           | String                         | Yes      | -                                   | -                 |
| city               | String                         | Yes      | -                                   | -                 |
| currency           | String                         | No       | -                                   | -                 |
| timeZone           | String                         | No       | -                                   | -                 |
| notification       | String                         | No       | "I send or receive Payment receipt" | -                 |
| twoFactorAuth      | Boolean                        | No       | false                               | -                 |
| serviceType        | \[String]                      | Yes      | -                                   | Array of services |
| serviceImage       | String                         | No       | -                                   | -                 |
| orders             | \[ObjectId → Order]            | No       | -                                   | -                 |
| quotations         | \[ObjectId → Quotation]        | No       | -                                   | -                 |
| services           | \[ObjectId → Service]          | No       | -                                   | -                 |
| reportsAndIssues   | \[ObjectId → ReportsAndIssues] | No       | \[]                                 | -                 |
| createdAt          | Date                           | No       | Date.now                            | -                 |


📝 Order Schema

| Field           | Type   | Required | Default   | Notes |
| --------------- | ------ | -------- | --------- | ----- |
| serviceName     | String | Yes      | -         | -     |
| email           | String | Yes      | -         | -     |
| phone           | String | Yes      | -         | -     |
| orgName         | String | Yes      | -         | -     |
| scheduledTime   | String | Yes      | -         | -     |
| orderStatus     | String | No       | 'pending' | -     |
| websiteAddress  | String | No       | -         | -     |
| masterCard      | String | No       | -         | -     |
| businessName    | String | Yes      | -         | -     |
| paymentStatus   | String | No       | 'unpaid'  | -     |
| paymentPaid     | String | No       | -         | -     |
| user\_email     | String | Yes      | -         | -     |
| merchant\_email | String | Yes      | -         | -     |
| createdAt       | Date   | No       | Date.now  | -     |


🐞 Reports & Issues Schema

| Field           | Type     | Required | Default  | Notes                         |
| --------------- | -------- | -------- | -------- | ----------------------------- |
| name            | String   | Yes      | -        | -                             |
| email           | String   | Yes      | -        | Main contact email            |
| orderId         | String   | Yes      | -        | -                             |
| date            | Date     | No       | Date.now | -                             |
| issueType       | String   | Yes      | -        | -                             |
| description     | String   | Yes      | -        | -                             |
| reportStatus    | String   | No       | Pending  | -                             |
| attachment      | String   | No       | -        | Optional file/image           |
| reporterType    | String   | Yes      | -        | Either 'Users' or 'Merchant'  |
| reporterId      | ObjectId | Yes      | -        | `refPath` to reporterType     |
| reporter\_email | String   | Yes      | -        | Explicit reporter email field |
| createdAt       | Date     | No       | Date.now | -                             |


🧾 Quotation Schema

| Field            | Type                | Required | Default   | Notes                                                 |
| ---------------- | ------------------- | -------- | --------- | ----------------------------------------------------- |
| work\_assignment | String              | Yes      | -         | -                                                     |
| description      | String              | Yes      | -         | -                                                     |
| address          | String              | Yes      | -         | -                                                     |
| date             | Date                | Yes      | -         | -                                                     |
| time             | String              | Yes      | -         | -                                                     |
| userId           | ObjectId → Users    | Yes      | -         | -                                                     |
| merchantId       | ObjectId → Merchant | Yes      | -         | -                                                     |
| status           | String (enum)       | No       | 'pending' | One of `pending`, `accepted`, `rejected`, `completed` |
| createdAt        | Date                | No       | Date.now  | -                                                     |


🛠️ Service Schema

| Field          | Type                | Required | Default  | Notes                 |
| -------------- | ------------------- | -------- | -------- | --------------------- |
| jobTitle       | String              | Yes      | -        | -                     |
| jobCategory    | String              | Yes      | -        | -                     |
| jobDescription | String              | Yes      | -        | -                     |
| price          | Number              | Yes      | -        | -                     |
| discount       | Number              | No       | 0        | -                     |
| image          | String              | No       | -        | -                     |
| merchant       | ObjectId → Merchant | Yes      | -        | Reference to merchant |
| createdAt      | Date                | No       | Date.now | -                     |



## 🔐 Authentication

### 🔸 User Signup

`POST /signup`

```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "secret123"
}
```

✅ Response:
```json
{ "success": true, "message": "OTP sent successfully via email." }
```

---

### 🔸 Verify OTP

`POST /verify-otp`

```json
{
  "email": "john@example.com",
  "otp": "123456"
}
```

✅ Response:
```json
{ "success": true, "message": "Email verified successfully." }
```

---

### 🔸 Login

`POST /login`

```json
{
  "email": "john@example.com",
  "password": "secret123"
}
```

✅ Response:
```json
{
  "success": true,
  "token": "JWT_TOKEN",
  "user": {
    "_id": "...",
    "email": "...",
    "name": "..."
  }
}
```

---

### 🔸 Forgot Password Flow

1. `POST /forgot-password`
2. `POST /verify-forgot-otp`
3. `POST /reset-password`

Refer to detailed structure under each in codebase.

---

## 👤 User Routes

### Get Current User

`GET /getUser`  
🔒 Requires `auth-token`

---

### Get User by Email

`POST /getUser`

```json
{ "email": "john@example.com" }
```

---

### Update User

`PUT /updateUser`  
🔒 Requires `auth-token`

Body = any updatable fields from schema

---

### Get All Users

`GET /getAllUsers`

---

## 🧑‍💼 Merchant Routes

Same flow as user, replace with `/merchant/*`:

- `POST /merchant/signup`
- `POST /merchant/verify-otp`
- `POST /merchant/login`
- `POST /merchant/forgot-password`
- `POST /merchant/verify-forgot-otp`
- `POST /merchant/reset-password`

---

### Get Current Merchant

`GET /getMerchant` 🔒 `merchant-auth-token`

---

### Update Merchant

`PUT /updateMerchant` 🔒

---

### Get All Merchants

`GET /getAllMerchants`

---

## 📦 Orders

### Add Order

`POST /addOrder` 🔒

Required fields:

```json
{
  "serviceName": "Plumbing",
  "email": "customer@example.com",
  "phone": "1234567890",
  "orgName": "Client Org",
  "scheduledTime": "2PM Tomorrow",
  "businessName": "Biz Ltd",
  "merchant_email": "merchant@example.com"
}
```

---

### Get Order by ID

`GET /getOrder/:_id`

---

### Get User Orders

`GET /user/orders` 🔒

---

### Get Merchant Orders

`GET /merchant/orders` 🔒

---

### Get All Orders

`GET /getAllOrders`

---

### Update Order

`PUT /updateOrder/:_id`

---

## 🧾 Quotations

### Add Quotation

`POST /addQuotation` 🔒

```json
{
  "work_assignment": "Fix AC",
  "description": "AC not working",
  "address": "123 Main St",
  "date": "2025-05-20",
  "time": "14:00",
  "merchantId": "..."
}
```

---

### Get User Quotations

`GET /user/quotations` 🔒

---

### Get Merchant Quotations

`GET /merchant/quotations` 🔒

---

### Update Quotation (Admin)

`PUT /quotations/:id`

---

### Update Quotation (User-owned)

`PUT /quotation/user/edit/:id` 🔒

---

## 🛠️ Services

### Add Service

`POST /addService` 🔒

```json
{
  "jobTitle": "Electrician",
  "jobCategory": "Electrical",
  "jobDescription": "Full installation",
  "price": 150,
  "discount": 10,
  "image": "https://cdn/image.jpg"
}
```

---

### Edit Service

- `PUT /editMyService/:id` 🔒 (Merchant's own)
- `PUT /editService/:id` (Admin/all access)

---

### Get My Services

`GET /getMyServices` 🔒

---

### Get All Services

`GET /getAllServices`

---

## 🚨 Reports & Issues

### Add Report (User)

`POST /add-report` 🔒

```json
{
  "orderId": "...",
  "issueType": "Late Delivery",
  "description": "The technician was late.",
  "attachment": "https://cdn/img.jpg"
}
```

---

### Add Report (Merchant)

`POST /merchant/add-report` 🔒

---

### Get My Reports (User)

`GET /my-reports` 🔒

---

### Get My Reports (Merchant)

`GET /merchant/my-reports` 🔒

---

### Get All Reports

`GET /all-reports`

---

### Get Reports by Email

`POST /reports-by-email`

```json
{ "email": "someone@example.com" }
```

---

### Update Report

`PATCH /update-report`

```json
{
  "reportId": "...",
  "updates": {
    "issueType": "Updated",
    "description": "Updated description"
  }
}
```

---

## 📊 Analytics

### Admin Analytics

`GET /admin/analytics`

Returns:
- totalEarning
- todayEarning
- monthly trends
- weekly earnings
- expenses

---

### Merchant Analytics

- `GET /merchant/analytics` 🔒
- `GET /merchant/analytics/:id`

---

## 🖼️ Upload Image

`POST /upload`  
`multipart/form-data` with field: `image`

Returns:
```json
{
  "success": 1,
  "image_url": "https://cdn.cloudinary.com/..."
}
```

---

## 🛑 Error Handling Format

All error responses follow:

```json
{
  "success": false,
  "message" or "error": "Descriptive error message"
}
```

---

## 🔒 Tokens

- JWT tokens valid for `730h` (~30 days)
- OTP fallback value: `'123456'` (dev only)

---

## ⚠️ Notes

- Passwords are stored as plain text (🚫). Replace with `bcrypt.hash()` in production.
- Universal OTP `'123456'` bypasses verification. Disable in production.
- In-memory OTP stores reset on server restart. Use Redis for persistence.
- Image uploads use `Cloudinary`.

---

## 🧪 Testing Checklist

✅ Email OTPs  
✅ Authentication flows  
✅ Protected routes  
✅ CRUD for orders, services, quotations, reports  
✅ File uploads  
✅ Analytics charts

---

## 💻 Built With

- Express.js
- MongoDB & Mongoose
- Cloudinary
- Nodemailer
- JWT Auth
- Multer (uploads)
- Twilio (planned)
- Razorpay (future scope)

---

## 👥 Contributors

- Backend: Veer Adyani
- Frontend: (Insert team name here)

---
