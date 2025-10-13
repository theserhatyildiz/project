const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const rateLimit = require('express-rate-limit');
const csrf = require('csurf');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const sanitizeHtml = require('sanitize-html');
const { body, validationResult, param } = require('express-validator');
require('dotenv').config();
const crypto = require('crypto');
const path = require('path');

const macroCoachForm = require('./models/macroCoachForm')
const dailyMacroTotal = require('./models/dailyMacroTotal')
const userModel = require('./models/userModel')
const foodModel =  require('./models/foodModel')
const macroGoal = require('./models/macroGoal')
const macroCoachMacro = require('./models/macroCoachMacro')
const macroCoachWeeklyMacroAverage = require('./models/macroCoachWeeklyMacroAverage') 
const userFoodModel = require('./models/userFoodModel')
const trackingModel = require('./models/trackingModel')
const verifyToken = require('./verifyToken')
const weightAverage = require('./models/weightAverage')
const weightModel = require('./models/weightModel');
const refreshTokenModel = require('./models/refreshTokenModel'); 

// database connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.log(err.message));

const app = express();
app.use(helmet());
app.use(cors({
  origin: 'http://localhost:5173', // Allow requests from this origin
  credentials: true, // Allow cookies and other credentials to be sent
  allowedHeaders: ['Content-Type', 'csrf-token', 'Authorization'], // Allow csrf-token and Authorization headers
}));
app.use(express.json());
app.use(cookieParser());
app.use(csrf({ cookie: true }));

// Rate limiting
// const limiter = rateLimit({
//   windowMs: 15 * 60 * 1000,
//   max: 100,
//   message: "Too many requests, please try again later."
// });
// app.use(limiter);

app.use((req, res, next) => {
  res.cookie('XSRF-TOKEN', req.csrfToken());
  next();
});

app.get('/csrf-token', (req, res) => {
  const csrfToken = req.csrfToken();
  res.cookie('XSRF-TOKEN', csrfToken, {
    httpOnly: false,
    secure: true,
    sameSite: 'Strict',
    path: '/'
  });
  res.json({ csrfToken });
});

// Sanitize a string input using sanitize-html
const sanitizeInput = (input) => sanitizeHtml(input, {
  allowedTags: [],
  allowedAttributes: {}
});

///////////////////////////////////// REGISTER and LOGIN /////////////////////////////////////

// Endpoint to register a new user

app.post('/register', [
    body('name').isAlphanumeric().withMessage('Invalid username format.'),
    body('email').isEmail().withMessage('Invalid email format.'),
    body('password').isLength({ min: 11 }).withMessage('Password must be at least 11 characters long.')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  let user = req.body;

  try {
    const existingUser = await userModel.findOne({ name: user.name });
    if (existingUser) {
      return res.status(400).send({ message: 'Kullanıcı adı zaten kayıtlı!' });
    }

    const existingEmail = await userModel.findOne({ email: user.email });
    if (existingEmail) {
      return res.status(400).send({ message: 'Email zaten kayıtlı!' });
    }

    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(user.password, salt);
    user.password = hashedPassword;

    const emailToken = jwt.sign({ email: user.email }, process.env.JWT_SECRET, { expiresIn: '1d' });
    user.emailToken = emailToken;
    user.isVerified = false;

    const doc = await userModel.create(user);

    const transporter = nodemailer.createTransport({
      service: 'outlook',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
      }
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: user.email,
      subject: 'Email Verification',
      html: `<p>Merhaba ${user.name},</p>
             <p>E-posta adresinizi doğrulamak için lütfen aşağıdaki bağlantıya tıklayın:</p>
             <p>http://localhost:5173/verify/${doc._id}/${emailToken}</p>
             <p><strong>Galwin Support Team</strong></p>`
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error('Error sending email:', error);
        return res.status(500).send({ message: 'Email sending failed' });
      } else {
        console.log('Email sent: ' + info.response);
        res.status(201).send({ message: "Üyelik Oluşturuldu! Lütfen e-posta adresinizi doğrulamak için gelen kutunuzu kontrol edin." });
      }
    });
  } catch (err) {
    console.error('Error registering user:', err);
    res.status(500).send({ message: 'An error occurred during registration. Please try again later.' });
  }
});

app.post('/verify/:id/:token', async (req, res) => {
  const { id, token } = req.params;
  const csrfToken = req.headers['csrf-token'];
  const csrfTokenFromCookie = req.cookies['XSRF-TOKEN'];

  if (!csrfToken || csrfToken !== csrfTokenFromCookie) {
    return res.status(403).json({ error: 'Invalid CSRF token' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await userModel.findById(id);

    if (!user || user.email !== decoded.email) {
      return res.status(400).json({ message: 'Invalid token or user.' });
    }

    user.isVerified = true;
    user.emailToken = null;
    await user.save();

    res.status(200).json({ message: 'Email successfully verified.' });
  } catch (err) {
    console.error('Error verifying email:', err);
    res.status(500).json({ message: 'Email verification failed.' });
  }
});

// Endpoint to login a user
app.post('/login', async (req, res) => {
  let userCred = req.body;
  console.log('Login attempt:', userCred);

  try {
    const user = await userModel.findOne({ email: userCred.email });
    if (user) {
      console.log('User found:', user.email);

      const match = await bcrypt.compare(userCred.password, user.password);
      if (match) {
        console.log('Password match successful');

        // Optional: Prevent login if email not verified
        // if (!user.isVerified) {
        //   return res.status(401).send({ message: "Email not verified" });
        // }

        // 🔐 Remove old refresh tokens for the user
        await refreshTokenModel.deleteMany({ userId: user._id });

        // Generate access token (expires in 15 minutes for production)
        const token = jwt.sign({ email: user.email, userId: user._id }, process.env.JWT_SECRET, { expiresIn: '15m' });

        // Generate refresh token and save it to the database (expires in 1 day for production)
        const expiryDate = new Date(Date.now() + 1 * 24 * 60 * 60 * 1000); // 1 day
        const newRefreshToken = new refreshTokenModel({
          token: crypto.randomBytes(40).toString('hex'),
          userId: user._id,
          expiryDate: expiryDate
        });
        await newRefreshToken.save(); // Save refresh token to DB

        console.log('Generated access token:', token);
        console.log('Generated refresh token and stored in DB:', newRefreshToken.token);

        // Set the refresh token in a cookie (httpOnly, secure, etc.)
        res.cookie('refreshToken', newRefreshToken.token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'Strict',
          maxAge: 1 * 24 * 60 * 60 * 1000 // 1 day in milliseconds
        });

        res.send({
          message: "Login Success",
          token: token,
          userid: user._id,
          name: user.name,
          isVerified: user.isVerified,
          email: user.email
        });
      } else {
        console.log('Invalid password');
        res.status(403).send({ message: "Invalid Password" });
      }
    } else {
      console.log('User not found');
      res.status(404).send({ message: "User not found" });
    }
  } catch (err) {
    console.error('Error Finding User:', err);
    res.status(500).send("Internal Server Error");
  }
});


// Endpoint to refresh the access token bu storedToken.remove is not a function hatasi veren
app.post('/refresh-token', async (req, res) => {
  console.log('Received cookies:', req.cookies);
  console.log('Req Body:', req.body);

  const refreshToken = req.cookies.refreshToken;
  if (!refreshToken) {
    console.log('No refresh token provided');
    return res.status(401).send({ message: "No refresh token provided" });
  }

  try {
    // Find the refresh token in the database
    const storedToken = await refreshTokenModel.findOne({ token: refreshToken });
    if (!storedToken) {
      console.log('Invalid or expired refresh token');
      return res.status(403).send({ message: "Invalid refresh token" });
    }

    // Generate a new access token (expires in 1 minute for testing)
    const newToken = jwt.sign(
      { email: storedToken.email, userId: storedToken.userId },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );
    console.log('Generated new access token:', newToken);

    // Check if the refresh token is close to expiration, if so, generate a new one
    const now = Date.now();
    const timeRemaining = storedToken.expiryDate - now;
    if (timeRemaining < 10 * 60 * 1000) { // Less than 10 minute remaining
      const newExpiryDate = new Date(now + 1 * 24 * 60 * 60 * 1000); // Extend by 1 day from now
      const newRefreshToken = new refreshTokenModel({
        token: crypto.randomBytes(40).toString('hex'),
        userId: storedToken.userId,
        expiryDate: newExpiryDate
      });

      await newRefreshToken.save(); // Save new token
      await refreshTokenModel.deleteOne({ _id: storedToken._id }); // Delete the old token

      console.log('Generated new refresh token:', newRefreshToken.token);

      res.cookie('refreshToken', newRefreshToken.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'Strict',
        maxAge: 1 * 24 * 60 * 60 * 1000  // 1 day in milliseconds
      });

      res.send({ token: newToken });
    } else {
      console.log('Refresh token is still valid');
      res.send({ token: newToken });
    }
  } catch (err) {
    console.error('Error refreshing token:', err.message);
    res.status(500).send({ message: "Internal Server Error" });
  }
});

// Endpoint to logout a user
app.post('/logout', async (req, res) => {
  console.log('🔁 Logout request received');

  try {
    const refreshToken = req.cookies.refreshToken;
    const authHeader = req.headers['authorization'];
    const accessToken = authHeader && authHeader.split(' ')[1];

    console.log('📦 refreshToken from cookie:', refreshToken);
    console.log('🔐 accessToken from header:', accessToken);

    let userId = null;

    // 1. Try to decode userId from the access token (even if expired)
    if (accessToken) {
      const decoded = jwt.decode(accessToken);
      console.log('📜 Decoded access token (unverified):', decoded);
      userId = decoded?.id || decoded?.userId;
    }

    // 2. If access token failed to give us a userId, try the refresh token
    if (!userId && refreshToken) {
      const tokenDoc = await refreshTokenModel.findOne({ token: refreshToken });
      if (tokenDoc) {
        userId = tokenDoc.userId;
        console.log('🔍 Found userId from refreshToken in DB:', userId);
      } else {
        console.warn('❌ No matching refresh token found in DB.');
      }
    }

    // 3. Delete all refresh tokens for this user
    if (userId) {
      const result = await refreshTokenModel.deleteMany({ userId });
      console.log(`🧹 Deleted ALL refresh tokens for user ${userId}:`, result);
    } else {
      console.warn('⚠️ Could not determine userId. No tokens deleted.');
    }

    // 4. Always clear the refresh token cookie
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Strict'
    });

    res.send({ message: "Logged out successfully" });

  } catch (err) {
    console.error('💥 Error during logout:', err.message);
    res.status(500).send({ message: "Internal Server Error" });
  }
});

// Endpoint for forgotpassword

app.post('/forgotpassword', async (req, res) => {
  const { email } = req.body;

  try {
    const user = await userModel.findOne({ email });
    if (!user) {
      return res.status(404).send({ Status: "User not existed" });
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });

    const transporter = nodemailer.createTransport({
      service: 'outlook',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
      }
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Şifre Yenileme Linki',
      html: `<p><strong>Galwin App şifreniz sıfırlanmak istendi!</strong></p>
             <p>Eğer şifre yenileme talebinde bulunmadıysanız, bu e-postayı dikkate almayınız.</p>
             <p>Eğer şifre yenileme talebinde bulunduysanız şifrenizi değiştirmek için alttaki bağlantıya tıklayın.</p>
             <p>Galwin App şifre yenileme linkiniz: http://localhost:5173/resetpassword/${user._id}/${token}</p>
             <p><strong>Galwin Support Team</strong></p>`
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error('Error sending email:', error);
        return res.status(500).send({ Status: "Email sending failed" });
      } else {
        console.log('Email sent: ' + info.response);
        res.send({ Status: "Success" });
      }
    });
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).send({ Status: "Internal Server Error" });
  }
});

app.post('/resetpassword/:id/:token', async (req, res) => {
  const { id, token } = req.params;
  const { password } = req.body;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.id !== id) {
      return res.status(403).json({ Status: "Invalid token" });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const user = await userModel.findByIdAndUpdate(id, { password: hashedPassword });

    if (!user) {
      return res.status(404).json({ Status: "User not found" });
    }

    res.json({ Status: "Success" });
  } catch (err) {
    console.error('Error resetting password:', err);
    res.status(500).send({ Status: "Error resetting password" });
  }
});

///////////////////////////////////// FETCH and SEARCH FOOD /////////////////////////////////////

// endpoint to fetch all foods

app.get("/foods", verifyToken, async (req, res) => {
    try {
        // Fetch all the food items created by the user
        let userFoods = await foodModel.find({ userId: req.userId });

        // Fetch all the food items from the default food database
        let defaultFoods = await foodModel.find({ userId: { $exists: false } });

        // Combine the default food items and user food items into a single array
        let foods = [...defaultFoods, ...userFoods];

        // Remove any duplicate food items based on the NameTr field
        foods = foods.filter((value, index, self) =>
            index === self.findIndex((t) => t.NameTr === value.NameTr)
        );

        res.send(foods);
    } catch (err) {
        console.log(err);
        res.status(500).send({ message: 'Some problem while getting nutrition info' });
    }
});

// end point for search food by name

// Turkish-insensitive multi-word regex function
function turkishInsensitiveMultiRegex(query) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const charMap = {
    'i': ['i', 'ı', 'İ', 'I'],
    'ı': ['i', 'ı', 'İ', 'I'],
    'u': ['u', 'ü', 'U', 'Ü'],
    'ü': ['u', 'ü', 'U', 'Ü'],
    'o': ['o', 'ö', 'O', 'Ö'],
    'ö': ['o', 'ö', 'O', 'Ö'],
    's': ['s', 'ş', 'S', 'Ş'],
    'ş': ['s', 'ş', 'S', 'Ş'],
    'c': ['c', 'ç', 'C', 'Ç'],
    'ç': ['c', 'ç', 'C', 'Ç'],
    'g': ['g', 'ğ', 'G', 'Ğ'],
    'ğ': ['g', 'ğ', 'G', 'Ğ'],
  };

  return words.map(word => {
    const pattern = word.split('').map(char => {
      const lowerChar = char.toLowerCase();
      if (charMap[lowerChar]) {
        const chars = charMap[lowerChar];
        return `[${[...new Set(chars)].join('')}]`;
      } else {
        return char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      }
    }).join('');
    return new RegExp(pattern, 'i');
  });
}

// Shared sort function to prioritize prefix matches
function prioritizeStartsWith(query, list) {
  const q = query.toLowerCase();
  return list.sort((a, b) => {
    const aName = a.NameTr.toLowerCase();
    const bName = b.NameTr.toLowerCase();
    const aStarts = aName.startsWith(q);
    const bStarts = bName.startsWith(q);

    if (aStarts && !bStarts) return -1;
    if (!aStarts && bStarts) return 1;
    return aName.localeCompare(bName);
  });
}

// /foods/:name route
app.get('/foods/:name', 
[
  param('name')
    .trim()
    .matches(/^[a-zA-ZıİşŞğĞüÜöÖçÇ\s]+$/)
    .withMessage('Invalid query parameter: Only letters and spaces are allowed')
    .isLength({ max: 50 })
    .withMessage('Name parameter cannot exceed 50 characters')
    .customSanitizer(value => sanitizeHtml(value)),
],
verifyToken,
async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const query = sanitizeHtml(req.params.name.trim());
    const regexPatterns = turkishInsensitiveMultiRegex(query);

    const [userFoodsRaw, defaultFoodsRaw] = await Promise.all([
      foodModel.find({ userId: req.userId }),
      foodModel.find({ userId: { $exists: false } })
    ]);

    const allFoods = [...userFoodsRaw, ...defaultFoodsRaw].filter(food => {
      const name = food.NameTr || '';
      return regexPatterns.every(regex => regex.test(name));
    });

    const sortedFoods = prioritizeStartsWith(query, allFoods);

    if (sortedFoods.length > 0) {
      res.json(sortedFoods);
    } else {
      res.status(404).json({ message: 'Food item not found' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Some problem in getting the food using search' });
  }
});

// /userfoods/:name route
app.get('/userfoods/:name', 
[
  param('name')
    .trim()
    .matches(/^[a-zA-ZıİşŞğĞüÜöÖçÇ\s]+$/)
    .withMessage('Invalid query parameter: Only letters and spaces are allowed')
    .isLength({ max: 50 })
    .withMessage('Name parameter cannot exceed 50 characters')
    .customSanitizer(value => sanitizeHtml(value)),
],
verifyToken,
async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const query = sanitizeHtml(req.params.name.trim());
    const regexPatterns = turkishInsensitiveMultiRegex(query);

    const userFoodsRaw = await userFoodModel.find({ userId: req.userId });

    const filtered = userFoodsRaw.filter(food => {
      const name = food.NameTr || '';
      return regexPatterns.every(regex => regex.test(name));
    });

    const sorted = prioritizeStartsWith(query, filtered);

    if (sorted.length > 0) {
      res.json(sorted);
    } else {
      res.status(404).json({ message: 'User food item not found' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Some problem in getting the user food using search' });
  }
});

// end point to fetch all foods eaten by a user

app.get("/track/:userid/:date",verifyToken,async(req,res)=>{

    let userid = req.params.userid ; 
    let date = new Date(req.params.date).toLocaleDateString();

    try
    {

        let foods = await trackingModel.find({userId:userid,eatenDate:date});
        res.send(foods);

    }
    catch(err)
    {
        console.log(err);
        res.status(500).send({message:'Some problem in fetching all foods eaten by a user'})
    }
})

///////////////////////////////////// DELETE and CREATE FOOD /////////////////////////////////////

// Endpoint to delete a specific food entry

app.delete("/track/:id", verifyToken, async (req, res) => {
    const id = req.params.id; // Using the route parameter 'id' to represent the unique identifier (_id)
    console.log("Deleting food entry with id:", id);
  
    try {
      // Check if the food entry exists
      const foodEntry = await trackingModel.findById(id);
  
      if (!foodEntry) {
        console.log("Food entry not found");
        return res.status(404).send({ message: "Food entry not found" });
      }
  
      console.log("Deleting food entry from database");
      await trackingModel.deleteOne({ _id: id }); // Deleting the food entry based on its _id
      console.log("Food entry deleted");
  
      // Send a success response
      res.send({ message: "Food entry deleted successfully" });
    } catch (error) {
      console.error("Error deleting food entry:", error);
      res.status(500).send({ message: "An error occurred while deleting the food entry" });
    }
});

// end point to create a new food

app.post(
  "/foods",
  verifyToken,
  [
    // Validation and sanitization rules

    // Sanitize and validate name: string, required, max length 6
    body('NameTr')
      .trim()  // Removes leading/trailing whitespace
      .customSanitizer(value => sanitizeInput(value))  // Sanitize HTML
      .isString().withMessage('Food name must be a string')
      .notEmpty().withMessage('Food name is required')
      .isLength({ max: 50 }).withMessage('Food name can be at most 50 characters long'),

    // Sanitize and validate calories: number, positive, max 6 digits
    body('Calorie')
      .trim()
      .isFloat({ min: 0 }).withMessage('Calories must be a positive number')
      .custom(value => {
        if (value.toString().length > 6) {
          throw new Error('Calories value can have at most 6 digits');
        }
        return true;
      }),

    // Sanitize and validate protein: number, positive, max 6 digits
    body('Protein')
      .trim()
      .isFloat({ min: 0 }).withMessage('Protein must be a positive number')
      .custom(value => {
        if (value.toString().length > 6) {
          throw new Error('Protein value can have at most 6 digits');
        }
        return true;
      }),

    // Sanitize and validate carbs: number, positive, max 6 digits
    body('Carbohydrate')
      .trim()
      .isFloat({ min: 0 }).withMessage('Carbs must be a positive number')
      .custom(value => {
        if (value.toString().length > 6) {
          throw new Error('Carbs value can have at most 6 digits');
        }
        return true;
      }),

    // Sanitize and validate fat: number, positive, max 6 digits
    body('Fat')
      .trim()
      .isFloat({ min: 0 }).withMessage('Fat must be a positive number')
      .custom(value => {
        if (value.toString().length > 6) {
          throw new Error('Fat value can have at most 6 digits');
        }
        return true;
      }),

    // Sanitize and validate fiber (optional): number, positive, max 6 digits
    body('Fiber')
      .trim()
      .isFloat({ min: 0 }).withMessage('Fiber must be a positive number')
      .custom(value => {
        if (value.toString().length > 6) {
          throw new Error('Fiber value can have at most 6 digits');
        }
        return true;
      })
  ],
  async (req, res) => {
    console.log("POST request received to create a new food item");
    console.log("Request body:", req.body);

    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const createFood = req.body;
    createFood.userId = req.userId;

    try {
      console.log("Creating a new food item with the following data:", createFood);
      const data = await userFoodModel.create(createFood);
      console.log("Food item created successfully");
      res.status(201).send({ message: "Food created successfully" });
    } catch (err) {
      console.log("Error creating food item:", err);
      res.status(500).send({ message: "Some problem in creating the food" });
    }
  }
);

  ///////////////////////////////////// ADD and UPDATE FOOD /////////////////////////////////////
  
// end point to add a food to a meal and update a food in a meal

// end point to add a food to a meal

app.post("/track", verifyToken, async (req, res) => {
  let trackData = req.body;
  console.log("track data:", trackData);

  const { foodId, quantity, mealNumber, createdAt, eatenDate } = req.body;

  try {
    const newTracking = {
      userId: req.userId,
      details: trackData.details,
      foodId,
      quantity,
      mealNumber,
      createdAt: new Date(),
      eatenDate
    };

    const createdTracking = await trackingModel.create(newTracking);
    return res.status(201).json({ message: "Tracking document created successfully", trackingData: createdTracking });
  } catch (err) {
    console.error("Error logging food:", err);
    return res.status(500).json({ message: "Some problem in logging the food" });
  }
});

// Endpoint to update a specific food entry

app.put("/track/:id", verifyToken, async (req, res) => {
  const { id } = req.params;
  const { foodId, quantity, mealNumber, details } = req.body;

  try {
    const existingTracking = await trackingModel.findOne({
      userId: req.userId,
      _id: id,
    });

    if (existingTracking) {
      // existingTracking.foodId = foodId; -- I got "trackings validation failed" error when I tried to update foodId. Therefore, I removed it.
      existingTracking.quantity = quantity;
      existingTracking.mealNumber = mealNumber;
      existingTracking.details = details;

      await existingTracking.save();

      return res.status(200).json({
        message: "Tracking document updated successfully",
        trackingData: existingTracking,
      });
    } else {
      return res.status(404).json({ message: "Tracking document not found" });
    }
  } catch (err) {
    console.error("Error updating food tracking:", err);
    return res.status(500).json({ message: "Some problem in updating the food tracking" });
  }
});

///////////////////////////////////// MEAL FUNCTIONS /////////////////////////////////////

// end point to fetch the meal foods in the meal function page

app.get('/track/:userId/:mealNumber/:eatenDate', verifyToken, async (req, res) => {
    try {
        // Extract parameters from the request
        const { userId, mealNumber, eatenDate } = req.params;
        console.log('User ID:', userId);
        console.log('Meal number:', mealNumber);
        console.log('Eaten date:', eatenDate);

        let convertedEatenDate;
            try {
                const dateParts = eatenDate.split("-");  // Split by "-"
                convertedEatenDate = `${dateParts[1]}/${dateParts[2]}/${dateParts[0]}`;  // Reassemble in mm/dd/yyyy format
                // Reorder the date parts to mm/dd/yyyy format
                convertedEatenDate = convertedEatenDate.split("/").map(part => parseInt(part)).join("/");
                console.log('Converted Eaten Date:', convertedEatenDate);  // Log the converted date
            } catch (error) {
                convertedEatenDate = eatenDate;  // Use the raw value if parsing fails
            }

        // Assuming trackingModel is your Mongoose model for tracking
        // Fetch food items based on the user ID, meal number, and converted eaten date
        const foods = await trackingModel.find({ userId, mealNumber, eatenDate: convertedEatenDate });
        console.log('Fetched food items:', foods);

        // Send the fetched food items as a JSON response
        res.status(200).json(foods);
    } catch (error) {
        // If an error occurs, send an error response
        console.error('Error fetching food items:', error);
        res.status(500).json({ message: 'Failed to fetch food items' });
    }
});

// end point to delete the meal foods in the meal function page

app.delete("/deleteFoods", verifyToken, async (req, res) => {
    const { foods } = req.body; // Extracting the list of food IDs from the request body
    console.log("Deleting selected foods:", foods);
  
    try {
      // Deleting multiple food entries from the database based on their IDs
      const deleteResult = await trackingModel.deleteMany({ _id: { $in: foods } });
      console.log("Deleted foods:", deleteResult.deletedCount);
  
      // Send a success response
      res.send({ message: `${deleteResult.deletedCount} food(s) deleted successfully` });
    } catch (error) {
      console.error("Error deleting selected foods:", error);
      res.status(500).send({ message: "An error occurred while deleting the selected foods" });
    }
});


app.post("/track/copy", verifyToken, async (req, res) => {
    const { copiedItems, userId, foodId, eatenDate } = req.body;

    console.log("Received copied items:", copiedItems);
    console.log("Received userId:", userId);
    console.log("Received foodId:", foodId);
    console.log("Received eatenDate:", eatenDate);

    try {
        // Iterate through copiedItems to handle each copied item
        for (const copiedItem of copiedItems) {
            const { details, quantity, mealNumber } = copiedItem;
            let foodId;
            if (copiedItem.details && copiedItem.details.foodId) {
                foodId = copiedItem.details.foodId; // Extract foodId from details if available
            } else if (copiedItem.foodId) {
                foodId = copiedItem.foodId; // Extract foodId directly if available
            } else {
                console.log("No foodId found for copiedItem:", copiedItem);
                continue; // Skip processing this copiedItem if no foodId is available
            }
    
            // Parse and format the eatenDate
            const eatenDate = new Date(copiedItem.eatenDate);
            const formattedEatenDate = eatenDate.toISOString().split('T')[0];

            let convertedEatenDate;
            try {
                const dateParts = formattedEatenDate.split("-");  // Split by "-"
                convertedEatenDate = `${dateParts[1]}/${dateParts[2]}/${dateParts[0]}`;  // Reassemble in mm/dd/yyyy format
                // Reorder the date parts to mm/dd/yyyy format
                convertedEatenDate = convertedEatenDate.split("/").map(part => parseInt(part)).join("/");
                console.log('Converted Eaten Date:', convertedEatenDate);  // Log the converted date
            } catch (error) {
                convertedEatenDate = formattedEatenDate;  // Use the raw value if parsing fails
            }
    
            const newTracking = {
                userId,
                foodId: foodId,
                details: {
                    Name: details.Name,
                    Calorie: details.Calorie,
                    Protein: details.Protein,
                    Carbohydrate: details.Carbohydrate,
                    Fat: details.Fat,
                    Fiber: details.Fiber,
                },
                quantity,
                mealNumber,
                eatenDate: convertedEatenDate,
                _id: new mongoose.Types.ObjectId(), // Generate a new ObjectId for the new tracking document
            };
    

            console.log("Creating new tracking document:", newTracking);

            // Save the new tracking document to the database
            await trackingModel.create(newTracking);
            console.log("Tracking document created successfully");
        }

        res.status(201).json({ message: "All tracking documents created successfully" });
    } catch (err) {
        console.error("Error logging food:", err);
        res.status(500).json({ message: "Some problem in logging the food" });
    }
});

///////////////////////////////////// DASHBOARD /////////////////////////////////////

app.post('/macro-totals', async (req, res) => {
    console.log("Incoming POST /macro-totals");
    console.log("Body:", req.body);
    console.log("Checking fields - userId:", req.body.userId, "eatenDate:", req.body.eatenDate);

    if (!req.body.userId || !req.body.eatenDate) {
      console.log("❌ One or more required fields are missing or falsy");
      return res.status(400).json({ error: "Missing required fields" });
    }

    // 🚫 Check if all macros are zero or undefined/null
    const { totalProtein, totalCarbs, totalFats, totalFiber } = req.body;
    const allZero =
      (!totalProtein || totalProtein === 0) &&
      (!totalCarbs || totalCarbs === 0) &&
      (!totalFats || totalFats === 0) &&
      (!totalFiber || totalFiber === 0);

    if (allZero) {
      console.log("⛔ Skipping save: all macro values are zero");
      return res.status(204).send(); // No Content
    }

    try {
        const existing = await dailyMacroTotal.findOne({
            userId: req.body.userId,
            eatenDate: req.body.eatenDate
        });

        if (existing) {
            existing.totalProtein = totalProtein;
            existing.totalCarbs = totalCarbs;
            existing.totalFats = totalFats;
            existing.totalFiber = totalFiber;
            await existing.save();
        } else {
            await dailyMacroTotal.create({
                userId: req.body.userId,
                eatenDate: req.body.eatenDate,
                totalProtein,
                totalCarbs,
                totalFats,
                totalFiber
            });
        }

        res.status(200).json({ message: "Macro totals saved successfully" });
    } catch (error) {
        console.error("Error saving macro totals:", error);
        res.status(500).json({ error: "Server error saving macro totals" });
    }
});
//Get Weekly Average Macros with smart 7-day interval logic

app.get('/macro-totals/weekly-average', async (req, res) => {
  try {
    const { userId, includeToday, startDate } = req.query;

    console.group("📥 [ROUTE] GET /macro-totals/weekly-average");
    console.log("➡️ Query received:", { userId, includeToday, startDate });

    if (!userId) {
      console.log("❌ userId missing in query");
      console.groupEnd();
      return res.status(400).json({ error: "Missing userId" });
    }

    let mongoUserId;
    try {
      mongoUserId = new mongoose.Types.ObjectId(userId);
      console.log("✅ Converted userId to ObjectId:", mongoUserId);
    } catch (err) {
      console.error("❌ Invalid userId format:", userId);
      console.groupEnd();
      return res.status(400).json({ error: "Invalid userId" });
    }

    const formatDateString = (date) => date.toISOString().split("T")[0];
    const stripTime = (date) => new Date(date.toISOString().split("T")[0]);

    let today = new Date();
    today = stripTime(today);

    if (includeToday !== 'true') {
      today.setDate(today.getDate() - 1);
      console.log("📅 Excluding today from date range");
    } else {
      console.log("📅 Including today in date range");
    }

    let baseDate = null;
    if (startDate && startDate !== 'null') {
      baseDate = new Date(startDate);
      if (isNaN(baseDate)) {
        console.warn("⚠️ Invalid startDate, falling back to rolling 7-day logic");
        baseDate = null;
      } else {
        baseDate = stripTime(baseDate);
        console.log("📌 Using macroCoachStartedAt (normalized):", baseDate.toISOString());
      }
    }

    const allDates = [];
    const oneDay = 24 * 60 * 60 * 1000;

    if (baseDate) {
      const timePassed = today.getTime() - baseDate.getTime();
      const dayOffset = Math.floor(timePassed / oneDay);
      const currentWeek = Math.floor(dayOffset / 7);
      const weekStart = new Date(baseDate.getTime() + currentWeek * 7 * oneDay);

      const daysSinceWeekStart = Math.min(6, Math.floor((today - weekStart) / oneDay));
      for (let i = 0; i <= daysSinceWeekStart; i++) {
        const d = new Date(weekStart.getTime() + i * oneDay);
        allDates.push(formatDateString(d));
      }

      console.log(`📅 Calculating for week ${currentWeek + 1} since macro coach start`);
      console.log("📆 MacroCoach week dates:", allDates);
    } else {
      for (let i = 6; i >= 0; i--) {
        const d = new Date(today.getTime() - i * oneDay);
        allDates.push(formatDateString(d));
      }

      console.log("📅 No startDate, using rolling last 7 days:", allDates);
    }

    const rawEntries = await dailyMacroTotal.find({
      userId: mongoUserId,
      eatenDate: { $in: allDates }
    }).lean();

    console.log("📄 Raw DB entries found:", rawEntries.length);
    rawEntries.forEach(entry => console.log("📊 Record found:", entry));

    const byDate = {};
    for (const entry of rawEntries) {
      byDate[entry.eatenDate] = entry;
    }

    const paddedEntries = allDates.map((dateStr) => {
      const entry = byDate[dateStr] || {};
      return {
        date: dateStr,
        totalProtein: entry.totalProtein || 0,
        totalCarbs: entry.totalCarbs || 0,
        totalFats: entry.totalFats || 0,
        totalFiber: entry.totalFiber || 0,
      };
    });

    console.log("📊 Final 7-day padded entries:", paddedEntries);

    const avg = {
      avgProtein: 0,
      avgCarbs: 0,
      avgFats: 0,
      avgFiber: 0,
      entryCount: paddedEntries.length,
      dateRange: { from: allDates[0], to: allDates[allDates.length - 1] }
    };

    for (const day of paddedEntries) {
      avg.avgProtein += day.totalProtein;
      avg.avgCarbs += day.totalCarbs;
      avg.avgFats += day.totalFats;
      avg.avgFiber += day.totalFiber;
    }

    const divisor = paddedEntries.length || 1;

    avg.avgProtein = Number((avg.avgProtein / divisor).toFixed(1));
    avg.avgCarbs = Number((avg.avgCarbs / divisor).toFixed(1));
    avg.avgFats = Number((avg.avgFats / divisor).toFixed(1));
    avg.avgFiber = Number((avg.avgFiber / divisor).toFixed(1));

    console.group("✅ Final Macro Averages");
    console.log("📅 Date Range:", avg.dateRange);
    console.log("🥩 Protein:", avg.avgProtein);
    console.log("🍞 Carbs:  ", avg.avgCarbs);
    console.log("🧈 Fats:   ", avg.avgFats);
    console.log("🌾 Fiber:  ", avg.avgFiber);
    console.groupEnd();

    console.groupEnd();
    return res.status(200).json(avg);

  } catch (error) {
    console.error("💥 Unexpected error in weekly average route:", error);
    console.groupEnd();
    res.status(500).json({ error: "Server error calculating weekly average" });
  }
});

//Get Weekly Average and previousWeeklyAverage Weight//

app.get('/weights/averages/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    console.log("📥 Incoming request for weight averages");
    console.log("🔍 userId received:", userId);

    const objectId = new mongoose.Types.ObjectId(userId); // 🔥 convert string to ObjectId
    const record = await weightAverage.findOne({ userId: objectId });
    console.log("📊 Record found:", record);

    if (!record) {
      console.log("❌ No weight averages found for this user");
      return res.status(404).json({ message: 'No averages found for this user' });
    }

    res.json({
      weeklyAverage: record.weeklyAverage,
      previousWeeklyAverage: record.previousWeeklyAverage
    });
  } catch (error) {
    console.error("💥 Error fetching weight averages:", error);
    res.status(500).json({ message: "Error fetching weight data" });
  }
});

///////////////////////////////////// WEIGHT ENTRY /////////////////////////////////////

// Endpoint to add weight entry

app.post("/weights", verifyToken, async (req, res) => {
    const { weight, date, choice } = req.body;
    const userId = req.userId;

    try {
        // Check if a weight entry already exists for the provided date
        const existingEntry = await weightModel.findOne({ userId, date });

        if (existingEntry) {
            // If an entry exists, update it
            existingEntry.weight = weight; // Update the weight value
            existingEntry.choice = choice; // Update the choice value
            await existingEntry.save(); // Save the changes
            res.status(200).json({ message: "Weight entry updated successfully", data: existingEntry });
        } else {
            // If no entry exists, create a new one
            const newWeightEntry = await weightModel.create({ userId, weight, date, choice });
            res.status(201).json({ message: "Weight entry added successfully", data: newWeightEntry });
        }
    } catch (error) {
        console.error("Error adding/updating weight entry:", error);
        res.status(500).json({ message: "Error adding/updating weight entry" });
    }
});

app.get("/weights/:userId/:date", verifyToken, async (req, res) => {
    const userId = req.params.userId;
    const date = new Date(req.params.date);

    try {
        // console.log("Fetching weight data for user:", userId, "on date:", date);

        const userWeight = await weightModel.findOne({
            userId,
            date: { $gte: date, $lt: new Date(date.getTime() + 24 * 60 * 60 * 1000) }, // Filter by date
            choice: req.query.choice // Filter by choice (optional query parameter)
        });

        // console.log("Found weight entry:", userWeight);

        if (!userWeight) {
            // console.log("No weight entry found for user:", userId, "on date:", date);
            return res.status(200).json({});
        }

        res.status(200).json(userWeight);
    } catch (error) {
        // console.error("Error fetching weight data:", error);
        res.status(500).json({ message: "Error fetching weight data" });
    }
});


// Endpoint to fetch weight data for a user within a specific month

app.get("/weights/:userId/:year/:month", verifyToken, async (req, res) => {
    const userId = req.params.userId;
    const year = parseInt(req.params.year);
    const month = parseInt(req.params.month) - 1; // Months are zero-indexed in JavaScript Date object

    try {
        console.log("Fetching weight data for user:", userId, "in year:", year, "and month:", month);

        const startDate = new Date(year, month, 1);
        const endDate = new Date(year, month + 1, 1);

        console.log("Start date:", startDate);
        console.log("End date:", endDate);

        const userWeights = await weightModel.find({
            userId,
            date: { $gte: startDate, $lt: endDate },
        });

        console.log("Found weight entries:", userWeights);

        res.status(200).json(userWeights);
    } catch (error) {
        console.error("Error fetching weight data:", error);
        res.status(500).json({ message: "Error fetching weight data" });
    }
});




// Endpoint to delete a weight entry

// Endpoint to delete a specific weight entry
app.delete("/weights/:id", verifyToken, async (req, res) => {
    const id = req.params.id; // Using the route parameter 'id' to represent the unique identifier (_id)
    console.log("Deleting weight entry with id:", id);
  
    try {
      // Check if the weight entry exists
      const weightEntry = await weightModel.findById(id);
  
      if (!weightEntry) {
        console.log("Weight entry not found");
        return res.status(404).send({ message: "Weight entry not found" });
      }
  
      console.log("Deleting weight entry from database");
      await weightModel.deleteOne({ _id: id }); // Deleting the weight entry based on its _id
      console.log("Weight entry deleted");
  
      // Send a success response
      res.send({ message: "Weight entry deleted successfully" });
    } catch (error) {
      console.error("Error deleting weight entry:", error);
      res.status(500).send({ message: "An error occurred while deleting the weight entry" });
    }
});

// Weight Averages
app.post('/weights/averages', async (req, res) => {
  try {
    const { userId, weeklyAverage, previousWeeklyAverage } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "Missing userId" });
    }

    const updatedRecord = await weightAverage.findOneAndUpdate(
      { userId }, // Find document by userId
      {
        $set: {
          weeklyAverage,
          previousWeeklyAverage
        }
      },
      {
        upsert: true,              // Create if not exists
        new: true,                 // Return updated doc
        setDefaultsOnInsert: true // Apply schema defaults if inserting
      }
    );

    res.status(200).json({ message: "Averages saved successfully", data: updatedRecord });

  } catch (error) {
    console.error("Error saving weight averages:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});


///////////////////////////////////// MACRO COACH /////////////////////////////////////

// Macro Coach Form

app.post('/macrocoachform/submit', async (req, res) => {
  try {
    const userId = req.body.userId;
    const formData = { ...req.body }; // shallow copy

    // ✅ Remove optional macro fields if empty
    const optionalFields = [
      'carbIntake',
      'proteinIntake',
      'fatIntake',
      'weightChange',
      'current'
    ];

    optionalFields.forEach(field => {
      if (!formData[field]) {
        formData[field] = undefined; // so it can be $unset
      }
    });

    // ✅ Update or insert, removing old optional fields as needed
    const updatedForm = await macroCoachForm.findOneAndUpdate(
      { userId },
      {
        $set: formData,
        $unset: optionalFields.reduce((unsetFields, field) => {
          if (formData[field] === undefined) {
            unsetFields[field] = "";
          }
          return unsetFields;
        }, {})
      },
      { new: true, upsert: true }
    );

    await userModel.findByIdAndUpdate(userId, { hasSubmittedCoachForm: true });

    res.status(200).json({ message: 'Form submitted successfully!' });
  } catch (err) {
    console.error('🔴 Error during form submission:', err);
    res.status(500).json({ error: 'Server error during form submission.' });
  }
});

// Bu kod footerdaki koc a tikladigimda /macrocoach sayfasinin acilip acilmamasina karar veriyor
    app.get("/user/:id", async (req, res) => {
      try {
        const user = await userModel.findById(req.params.id).select("hasSubmittedCoachForm");
        if (!user) return res.status(404).json({ error: "User not found" });
        res.json(user);
      } catch (err) {
        console.error("Error fetching user status:", err);
        res.status(500).json({ error: "Server error" });
      }
    });

// Bu kod macrocoach.jsx sayfasinina macroCoachForm datalarini fetch etmek icin

    app.get('/macrocoachform/:userId', async (req, res) => {
  
      const { userId } = req.params;
  
      const formData = await macroCoachForm.findOne({ userId }); // adjust to your model name
  
      if (!formData) return res.status(404).json({ error: "Form not found" });
  
      res.json(formData);
});

// Macro Coach Macros // 

// hesaplanan macro lari database eklemek icin ve macro coach in baslatildigi gun

// POST /macrocoach/macros/:userId
app.post('/macrocoach/macros/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    console.log('📩 Incoming POST /macrocoach/macros:', {
      paramsUserId: userId,
      rawBody: req.body
    });

    const {
      calories, protein, carbs, fat, fiber,
      reason,
      reasonCode,
      uiMessage,
      goal, goalSpeed,
      weeklyAverage, previousWeeklyAverage,
    } = req.body;

    const toNum = (x) =>
      x === undefined || x === null || x === '' ? undefined : Number(x);

    const payload = {
      userId,
      calories: toNum(calories),
      protein: toNum(protein),
      carbs: toNum(carbs),
      fat: toNum(fat),
      fiber: toNum(fiber),

      reason:     reason ?? 'auto',
      reasonCode: reasonCode ?? null,
      uiMessage:  uiMessage ?? null,

      goal:      goal ?? null,
      goalSpeed: goalSpeed ?? null,

      weeklyAverage:         toNum(weeklyAverage),
      previousWeeklyAverage: toNum(previousWeeklyAverage),
    };

    console.log('📦 Normalized payload to save:', payload);

    // Validate required numeric fields
    for (const k of ['calories', 'protein', 'carbs', 'fat', 'fiber']) {
      if (!Number.isFinite(payload[k])) {
        console.error('❌ Invalid or missing numeric field:', k, 'value=', payload[k]);
        return res.status(400).json({ message: `Invalid or missing field: ${k}` });
      }
    }

    // 📝 Determine if this should be treated as the "initial"/reset snapshot
    const explicitInitial = payload.reason === 'initial' || payload.reason === 'goal-changed' || payload.reasonCode === 'initial';
    const existingCount = await macroCoachMacro.countDocuments({ userId });
    const inferredInitial = existingCount === 0;
    const isInitial = explicitInitial || inferredInitial;

    console.log('📝 Initial snapshot detection:', {
      userId,
      explicitInitial,
      inferredInitial,
      isInitial,
      existingCount,
      payloadReason: payload.reason,
      payloadReasonCode: payload.reasonCode
    });

    // 🧹 If this is an initial/goal-change snapshot, delete old macros first
    if (isInitial) {
      const deleted = await macroCoachMacro.deleteMany({ userId });
      console.log(`🧹 Deleted ${deleted.deletedCount} previous macro snapshots for user ${userId}`);
    }

    // 1) Create new snapshot
    const created = await macroCoachMacro.create(payload);
    console.log('✅ Created macro snapshot:', created._id);

    // 2) Update user's markers
    const createdAt = created.createdAt ? new Date(created.createdAt) : new Date();
    const user = await userModel.findById(userId).select('macroCoachStartedAt lastCheckInAt');

    if (user) {
      let changed = false;

      console.log('👁️ User markers BEFORE save:', {
        macroCoachStartedAt: user.macroCoachStartedAt,
        lastCheckInAt: user.lastCheckInAt
      });

      if (isInitial) {
        user.macroCoachStartedAt = createdAt;
        user.lastCheckInAt = null; // reset check-ins on new plan
        changed = true;
        console.log('📅 Reset markers for initial snapshot:', createdAt.toISOString());
      } else {
        user.lastCheckInAt = createdAt;
        changed = true;
        console.log('⏱️ Updated lastCheckInAt:', createdAt.toISOString());
      }

      if (changed) {
        await user.save();
        console.log('✅ User markers saved successfully.');
      }
    } else {
      console.warn('⚠️ User not found when updating markers:', userId);
    }

    return res.status(201).json(created);

  } catch (error) {
    console.error('❌ Error saving macros snapshot:', error);
    return res.status(500).json({ message: 'Error saving macros snapshot' });
  }
});

// READ the latest snapshot for a user
app.get('/macrocoach/macros/:userId/latest', async (req, res) => {
  try {
    const { userId } = req.params;
    const latest = await macroCoachMacro.findOne({ userId }).sort({ createdAt: -1 });
    if (!latest) return res.status(404).json({ message: 'No macros yet' });
    res.json(latest);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Error fetching latest macros' });
  }
});

//READ full history (most recent first)
app.get('/macrocoach/macros/:userId/history', async (req, res) => {
  try {
    const { userId } = req.params;
    const history = await macroCoachMacro.find({ userId }).sort({ createdAt: -1 }).lean();

    const form = await macroCoachForm.findOne({ userId }).lean();

    res.json({ history, goal: form?.goal });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Error fetching history" });
  }
});

// READ single snapshot by id
app.get('/macrocoach/macros/item/:id', async (req, res) => {
  try {
    const item = await macroCoachMacro.findById(req.params.id).lean();
    if (!item) return res.status(404).json({ message: 'Not found' });
    res.json(item);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Error fetching macros item' });
  }
});

//// CheckIn Page ////

app.get('/dailymacrototals/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const entries = await dailyMacroTotal.find({ userId }).sort({ eatenDate: -1 });
    res.status(200).json(entries);
  } catch (err) {
    console.error("Error fetching daily macro totals:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// macro Target i checkIn sayfasina fetch etmek icin

app.get('/macrocoach/macros/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const macros = await macroCoachMacro.findOne({ userId });

    if (!macros) {
      return res.status(404).json({ message: "No macros found for this user" });
    }

    res.status(200).json(macros);
  } catch (error) {
    console.error("❌ Error fetching macros:", error);
    res.status(500).json({ message: "Error fetching macros" });
  }
});

// macroCoachStartedAt fetch lemek icin
// GET /users/:userId
app.get('/users/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    // Only fetch what you need
    const user = await userModel
      .findById(userId)
      .select('macroCoachStartedAt lastCheckInAt');

    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json({
      macroCoachStartedAt: user.macroCoachStartedAt || null,
      lastCheckInAt: user.lastCheckInAt || null, // 👈 now included
    });
  } catch (error) {
    console.error('❌ Error fetching user:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/coachmacroaverages/:userId', async (req, res) => {
  const { userId } = req.params;
  const { protein, carbs, fat } = req.body;

  console.log("📩 Incoming weekly macro average POST:");
  console.log("   → userId:", userId);
  console.log("   → Data:", { protein, carbs, fat });

  // Check if all values are present and numeric
  if (
    typeof protein !== "number" ||
    typeof carbs !== "number" ||
    typeof fat !== "number"
  ) {
    console.warn("⚠️ Missing or invalid macro data.");
    return res.status(400).json({ message: "Missing or invalid macro data." });
  }

  try {
    const weekOf = new Date(); // 👈 Use current date instead of getWeekStartDate()
    weekOf.setHours(0, 0, 0, 0); // normalize time

    console.log("📅 Using current date as week start date:", weekOf.toISOString());

    // Check if this user already has an entry for this date
    const existing = await macroCoachWeeklyMacroAverage.findOne({ userId, weekOf });

    if (existing) {
      console.log("🔄 Existing entry found. Updating...");
      existing.protein = protein;
      existing.carbs = carbs;
      existing.fat = fat;
      await existing.save();
      console.log("✅ Weekly average updated:", existing);
      return res.status(200).json({ message: "Weekly average updated.", data: existing });
    }

    console.log("➕ No entry found. Creating new...");
    const newEntry = new macroCoachWeeklyMacroAverage({ userId, weekOf, protein, carbs, fat });
    await newEntry.save();
    console.log("✅ New weekly average saved:", newEntry);
    return res.status(201).json({ message: "Weekly average saved.", data: newEntry });

  } catch (err) {
    console.error("❌ Error saving weekly average:", err);
    return res.status(500).json({ message: "Server error." });
  }
});

// CheckIn Report- Fetch weekly averages history

app.get('/coachmacroaverages/:userId', async (req, res) => {
  const { userId } = req.params;

  try {
    const entries = await macroCoachWeeklyMacroAverage
      .find({ userId })
      .sort({ weekOf: 1 }); // ascending by date

    if (!entries.length) {
      return res.status(404).json({ message: "No weekly macro averages found for this user." });
    }

    console.log(`📤 Sending ${entries.length} weekly macro average entries for user: ${userId}`);
    return res.status(200).json(entries);

  } catch (err) {
    console.error("❌ Error fetching weekly averages:", err);
    return res.status(500).json({ message: "Server error." });
  }
});

///////////////////////////////////// MORE-GENERAL /////////////////////////////////////

///////// ACCOUNT /////////

// Endpoint to update the selected start date for a user

app.put("/users/:userId/:startDate", verifyToken, async (req, res) => {
    const userId = req.params.userId;
    const { startDate } = req.body;

    try {
        // Update the user's document in the database to store the selected start date
        await userModel.updateOne({ _id: userId }, { startDate });
        res.status(200).json({ message: "Start date updated successfully" });
    } catch (error) {
        console.error("Error updating start date:", error);
        res.status(500).json({ message: "Error updating start date" });
    }
});

// Endpoint to fetch the selected start date for a user
app.get("/users/:userId/:startDate", verifyToken, async (req, res) => {
    const userId = req.params.userId;

    try {
        // Fetch the user's document from the database
        const user = await userModel.findById(userId);

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        const startDate = user.startDate;
        res.status(200).json({ startDate });
    } catch (error) {
        console.error("Error fetching start date:", error);
        res.status(500).json({ message: "Error fetching start date" });
    }
});

// Endpoint to delete the start date for a user
app.delete("/users/:userId/startdate", verifyToken, async (req, res) => {
    const userId = req.params.userId;

    try {
        // Find the user and set the start date to null or an empty string
        const user = await userModel.findByIdAndUpdate(userId, { startDate: "" }, { new: true });
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        res.status(200).json({ message: "Start date deleted successfully", user });
    } catch (error) {
        console.error("Error deleting start date:", error);
        res.status(500).json({ message: "Error deleting start date" });
    }
});

// Endpoint to change the username

app.post('/update-username', async (req, res) => {
    const { id, newName } = req.body;

    if (!id || !newName) {
        return res.status(400).json({ success: false, message: 'ID ve yeni kullanıcı adı gereklidir.' });
    }

    const isValidUsername = /^[a-z0-9_.]+$/.test(newName);
    if (!isValidUsername || newName.includes(' ')) {
        return res.status(400).json({ success: false, message: 'Küçük harfler ve tek kelimeden oluşmalıdır.' });
    }

    try {
        const existingUser = await userModel.findOne({ name: newName });
        if (existingUser) {
            return res.status(400).json({ success: false, message: 'Kullanıcı adı zaten mevcut.' });
        }

        const user = await userModel.findById(id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'Kullanıcı bulunamadı.' });
        }

        user.name = newName;
        await user.save();

        res.status(200).json({ success: true, message: 'Kullanıcı adı başarıyla güncellendi', user });
    } catch (error) {
        console.error('Error updating username:', error);
        res.status(500).json({ success: false, message: 'Kullanıcı adı güncellenirken bir hata oluştu.' });
    }
});

/////////////////////////// GOALS ///////////////////////////

///////// MACRO-GOALS /////////

app.post(
  "/macro-goals",
  verifyToken,
  [
    body("goalProtein")
      .trim()
      .isInt({ min: 0 }).withMessage("Protein must be a positive integer")
      .custom(value => {
        if (value.toString().length > 5) {
          throw new Error("Protein value can have at most 5 digits");
        }
        return true;
      }),

    body("goalCarbohydrate")
      .trim()
      .isInt({ min: 0 }).withMessage("Carbohydrate must be a positive integer")
      .custom(value => {
        if (value.toString().length > 5) {
          throw new Error("Carbohydrate value can have at most 5 digits");
        }
        return true;
      }),

    body("goalFat")
      .trim()
      .isInt({ min: 0 }).withMessage("Fat must be a positive integer")
      .custom(value => {
        if (value.toString().length > 5) {
          throw new Error("Fat value can have at most 5 digits");
        }
        return true;
      }),

    body("goalFiber")
      .trim()
      .isInt({ min: 0 }).withMessage("Fiber must be a positive integer")
      .custom(value => {
        if (value.toString().length > 5) {
          throw new Error("Fiber value can have at most 5 digits");
        }
        return true;
      })
  ],
  async (req, res) => {
    console.log("POST /macro-goals called with:", req.body);

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const macroGoals = {
      goalProtein: req.body.goalProtein,
      goalCarbohydrate: req.body.goalCarbohydrate,
      goalFat: req.body.goalFat,
      goalFiber: req.body.goalFiber,
      userId: req.userId // From verifyToken middleware
    };

    try {
      const existing = await macroGoal.findOne({ userId: req.userId });
      if (existing) {
        // If exists, update
        await macroGoal.updateOne({ userId: req.userId }, macroGoals);
        return res.status(200).json({ message: "Macro goals updated successfully" });
      }

      await macroGoal.create(macroGoals);
      return res.status(201).json({ message: "Macro goals saved successfully" });
    } catch (err) {
      console.error("Error saving macro goals:", err);
      return res.status(500).json({ message: "Error saving macro goals" });
    }
  }
);

app.get("/macro-goals", verifyToken, async (req, res) => {
  console.log("GET /macro-goals hit");
  try {
    const userId = req.userId; // populated from the token by verifyToken middleware

    const goals = await macroGoal.findOne({ userId });

    if (!goals) {
      return res.status(404).json({ message: "No macro goals found" });
    }

    return res.status(200).json(goals);
  } catch (error) {
    console.error("Error fetching macro goals:", error);
    return res.status(500).json({ message: "Server error fetching macro goals" });
  }
});

if (process.env.NODE_ENV === 'production') {
  // Serve static files from the Vite build output
  app.use(express.static(path.join(__dirname, '/client/dist')));

  // Handle all SPA routes
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '/client/dist/index.html'));
  });
} else {
  // For dev/testing environments
  app.get('/', (req, res) => {
    res.send('API running');
  });
}

app.listen(process.env.PORT || PORT, () => {
    console.log('Server is running !!!')
})

