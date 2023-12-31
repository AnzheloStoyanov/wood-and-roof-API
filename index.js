const PORT = 8080
const express = require('express')
const { MongoClient , ObjectId } = require('mongodb')
const { v1: uuidv4 } = require('uuid')
const jwt = require('jsonwebtoken')
const bcrypt = require('bcrypt')
const cors = require('cors')
const { error } = require('console')
const nodemailer = require('nodemailer');
const app = express()
const stripe = require("stripe")("sk_test_51N02adHGku6BOIoRkNHey0MqcixWhJiXNvQxpdPetJUTKMdpIFW9K8qqVkY3xNUT8mTfCuHopK7jtgkQ4ckYb5xt00rRGPJW5S");
const bodyParser = require("body-parser")
app.use(cors())
app.use(express.json({ limit: '50mb' }))
const server = require('http').createServer(app)
const io = require('socket.io')(server, {
  cors: {
    origin: '*'
  }
})

const uri =
  'mongodb+srv://anzhelostoyanovdev:aLOD2gSgoUREvlsn@tinderdb.9upifpe.mongodb.net/?retryWrites=true&w=majority'

const client = new MongoClient(uri)
client.connect()

app.post('/signup', async (req, res) => {
    // const client = new MongoClient(uri);
    const { email, password } = req.body

    const generatedUserId = uuidv4()
    const hashedPassword = await bcrypt.hash(password.trim(), 10)

    try {
        // await client.connect()
        const databaseName = client.db('app-data')
        const users = databaseName.collection('users')


        const existingUser = await users.findOne({ email })
        if (existingUser) {
            return res.status(409).send('User already exists. Plaeace login')
        }
        const sanitizedEmail = email.toLowerCase().trim()

        const data = {
            user_id: generatedUserId,
            email: sanitizedEmail,
            hashes_password: hashedPassword,
            photos:  [null,null,null,null,null],
            matches: [],
            gender_interest: "woman"

        }
        const insertedUser = await users.insertOne(data)

        const token = jwt.sign(insertedUser, sanitizedEmail, {
            expiresIn: 60 * 24
            // token id-то ще си замине след   expiresIn:60*24
        })
        res.status(201).json({ token , userId : generatedUserId})
    } catch (err) {
        res.status(500).send(err)
    }
})

app.post('/login', async (req, res) => {
  const { email, password } = req.body
  try {
      const databaseName = client.db('app-data')
      const users = databaseName.collection('users')
      const sessions = databaseName.collection('sessions')

      const user = await users.findOne({ email })
      const correctPassword = await bcrypt.compare(password, user.hashes_password)

      if (user && correctPassword) {
          const token = jwt.sign(user, email, {
              expiresIn: 60 * 24
          })

          // Insert token into "Sessions" collection
          await sessions.insertOne({ userId: user.user_id })

          return res.status(200).json({ token , userId: user.user_id})
      }

      return res.status(400).send('Invalid Credentials')
  } catch (err) {
      console.log(err)
      res.status(400).send('Invalid Credentials')
  } finally {
  }
})

//LOGOUT ROUTE
app.delete('/logout', async (req, res) => {
  const { userId } = req.body;

  try {
    const databaseName = client.db('app-data');
    const sessions = databaseName.collection('sessions');
    await sessions.deleteOne( userId );

    res.status(200).send('Logged out successfully');

  } catch (err) {

    console.log(err);
    res.status(500).send('Error logging out');

  } finally {
    //  SOMETHING
  }
});

// Create a new endpoint for handling the /Blog/GetAll POST request
app.post('/Blog/Upsert', async (req, res) => {
  try {
    const database = client.db('app-data');
    const blogs = database.collection('blogs');

    const blogData = req.body;

    // If the blogData.id is provided, use it as _id (string)
    const blogId = blogData.id;

    // Convert the datePosted string to a Date object
    blogData.datePosted = new Date(blogData.datePosted);

    const result = await blogs.updateOne(
      { _id: blogId },
      { $set: blogData },
      { upsert: true }
    );

    if (result.modifiedCount > 0 || result.upsertedCount > 0) {
      res.status(200).json({ message: 'Blog upserted successfully' });
    } else {
      res.status(500).json({ message: 'Failed to upsert blog' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
});
// Create a new endpoint for handling the /Blog/Upsert GET request

app.get('/Blog/GetAll', async (req, res) => {
  try {
    const database = client.db('app-data');
    const blogs = database.collection('blogs');

    // Retrieve all blogs
    const allBlogs = await blogs.find({}).toArray();

    res.status(200).json(allBlogs);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
});


app.get('/Blog/GetById', async (req, res) => {
  try {
    const database = client.db('app-data');
    const blogs = database.collection('blogs');

    const blogId = req.query.id; // Assuming the blog ID is a string
    console.log('Requested Blog ID:', blogId);

    // Retrieve the blog by ID
    const blog = await blogs.findOne({ _id: blogId });

    if (blog) {
      res.status(200).json(blog);
    } else {
      console.log('Blog not found');
      res.status(404).json({ message: 'Blog not found' });
    }
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Assuming you have already instantiated the 'app' object from Express

// Assuming you have already instantiated the 'app' object from Express

app.post('/Product/Upsert', async (req, res) => {
  try {
    const database = client.db('app-data');
    const products = database.collection('products');

    const productData = req.body;

    // If the productData.id is provided, use it as _id (string)
    const productId = productData.id;

    // Convert any string IDs to ObjectId
    if (productId) {
      productData._id = productId; // Set _id field with the provided id
    }

    const result = await products.updateOne(
      { _id: productId },
      { $set: productData },
      { upsert: true }
    );

    if (result.modifiedCount > 0 || result.upsertedCount > 0) {
      res.status(200).json({ message: 'Product upserted successfully' });
    } else {
      res.status(500).json({ message: 'Failed to upsert product' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});



app.get('/Product/GetAll', async (req, res) => {
  try {
    const database = client.db('app-data');
    const products = database.collection('products');

    // Retrieve all products
    const allProducts = await products.find({}).toArray();

    res.status(200).json(allProducts);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
});
// Create a new endpoint for handling the /Product/GetFiltered GET request
app.get('/Product/GetFiltered', async (req, res) => {
  try {
    const database = client.db('app-data');
    const products = database.collection('products');

    // Extract parameters from the request query
    const { categoryIds, allergensIdsNotContain, orderBy, ShowOnHomePage, pageNumber, pageSize } = req.query;

    // Convert string parameters to their respective types
    const categoryIdsArray = categoryIds ? categoryIds.split(',').map(Number) : [];
    const allergensIdsNotContainArray = allergensIdsNotContain ? allergensIdsNotContain.split(',').map(Number) : [];
    const orderByInt = orderBy ? parseInt(orderBy) : 1; // Default to 1 if orderBy is not provided
    const ShowOnHomePageBool = ShowOnHomePage === 'true'; // Convert string to boolean
    const pageNumberInt = pageNumber ? parseInt(pageNumber) : 1; // Default to 1 if pageNumber is not provided
    const pageSizeInt = pageSize ? parseInt(pageSize) : 10; // Default to 10 if pageSize is not provided

    // Your MongoDB query logic here based on the provided parameters
    const query = {};

    if (categoryIdsArray.length > 0) {
      query['categories.id'] = { $in: categoryIdsArray };
    }

    if (allergensIdsNotContainArray.length > 0) {
      query['allergens.id'] = { $nin: allergensIdsNotContainArray };
    }

    if (ShowOnHomePageBool !== undefined) {
      query['showOnHomePage'] = ShowOnHomePageBool;
    }

    const sortingLogic = getOrderSortingLogic(orderByInt); // Define your sorting logic function

    const totalCount = await products.countDocuments(query);

    const filteredProducts = await products.find(query)
      .sort(sortingLogic)
      .skip((pageNumberInt - 1) * pageSizeInt)
      .limit(pageSizeInt)
      .toArray();

    const totalPages = Math.ceil(totalCount / pageSizeInt);

    const response = {
      totalCount,
      pageSize: pageSizeInt,
      currentPage: pageNumberInt,
      totalPages,
      data: filteredProducts
    };

    res.status(200).json(response);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Helper function for sorting logic based on 'orderBy'
function getOrderSortingLogic(orderBy) {
  // Your sorting logic based on 'orderBy'
  // Example: Sort by price in ascending order
  if (orderBy === 1) {
    return { price: 1 };
  }
  // Add more cases for other orderBy values if needed

  // Default sorting logic (if no valid orderBy is provided)
  return { _id: 1 }; // Sort by ObjectId in ascending order
}

 // Create a new endpoint for handling the /Product/GetById GET request
 app.get('/Product/GetById', async (req, res) => {
  try {
    const database = client.db('app-data');
    const products = database.collection('products');

    const productId = req.query.id; // Assuming the product ID is a string
    console.log('Requested Product ID:', productId);

    // Retrieve the product by ID
    const product = await products.findOne({ _id: parseInt(productId) });
    console.log('Found Product:', product);

    if (product) {
      res.status(200).json(product);
    } else {
      console.log('Product not found');
      res.status(404).json({ message: 'Product not found' });
    }
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.get('/Category/GetAll', async (req, res) => {
  try {
    const database = client.db('app-data'); // Replace with your actual database name
    const categories = database.collection('categories'); // Replace with your actual collection name for categories

    // Retrieve all categories
    const allCategories = await categories.find({}, { _id: 5 }).toArray(); // Exclude _id field from the response

    res.status(200).json(allCategories);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});
// ...

// Create a new endpoint for handling the /Category/Upsert POST request
app.post('/Category/Upsert', async (req, res) => {
  try {
    const database = client.db('app-data');
    const categories = database.collection('categories');

    const categoryData = req.body;

    // If the categoryData.id is provided, use it as _id (string)
    const categoryId = categoryData.id;

    const result = await categories.updateOne(
      { _id: categoryId },
      { $set: categoryData },
      { upsert: true }
    );

    if (result.upsertedCount > 0) {
      const upsertedCategory = await categories.findOne({ _id: result.upsertedId });
      res.status(200).json(upsertedCategory);
    } else {
      const existingCategory = await categories.findOne({ _id: categoryId });
      res.status(200).json(existingCategory);
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
});



app.get('/sessions/userIds', async (req, res) => {
  try {
    const databaseName = client.db('app-data');
    const sessions = databaseName.collection('sessions');
    
    // Retrieve an array of all userIds from the sessions collection
    const userIds = await sessions.distinct('userId');

    res.status(200).json(userIds);

  } catch (err) {
    console.log(err);
    res.status(500).send('Error retrieving userIds');
  }
});




// GET all users by gender
app.get('/users', async (req, res) => {
  try {
    const { gender } = req.query;
    const database = client.db('app-data');
    const users = database.collection('users');
    const query ={ gender_identity: {$eq :gender}}

    const foundUsers = await users.find( query ).toArray();
    res.status(200).json(foundUsers);
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal server error');
  }
});

app.put('/user/:user_id/paymentstatus', async (req, res) => {
  const user_id = req.params.user_id;
  const paymentStatus = req.body.paymentStatus;

  try {
    const databaseName = client.db('app-data');
    const users = databaseName.collection('users');

    const query = { user_id: user_id };
    const updateDocument = {
      $set: {
        paymentStatus: paymentStatus
      },
    };

    const updatedUser = await users.updateOne(query, updateDocument);

    if (updatedUser.modifiedCount === 1) {
      res.send('User payment status updated successfully');
    } else {
      res.status(404).send('User not found');
    }
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal server error');
  }
});
// CHANGE USER CHARACTERISTICS
app.put('/users/:userId', async (req, res) => {
  const userId = req.get('identity');
  if (!userId) {
    res.status(401).send({ message: "You are not logged in!" });
    return;
  }

  try {
    const databaseName = client.db('app-data');
    const users = databaseName.collection('users');

    const query = { user_id: req.params.userId };
    const foundUser = await users.findOne(query); // check if the user ID exists
    if (!foundUser) {
      res.status(401).send({ message: "Invalid user ID!" }); // respond with an error if the user ID is invalid
      return;
    }

    if (userId !== req.params.userId) { // check if the authenticated user matches the user being updated
      res.status(401).send({ message: "You do not have permission to update this user!" });
      return;
    }

    const formData = req.body.formData;
    const updateDocument = {
      $set: {
        first_name: formData.first_name,
        dob_day: formData.dob_day,
        dob_month: formData.dob_month,
        dob_year: formData.dob_year,
        show_gender: formData.show_gender,
        gender_identity: formData.gender_identity,
        gender_interest: formData.gender_interest,
        age_interest: formData.age_interest,
        photos: formData.photos,
        about: formData.about,
        matches: formData.matches
      }
    };

    const updatedUser = await users.updateOne(query, updateDocument);
    res.send(updatedUser);
  } catch (err) {
    console.error(err);
    res.status(500).send({ error: 'Something went wrong' });
  }
});



// GETTING USER BY ID
app.get('/user', async (req, res) => {
  // const client = new MongoClient(uri);
  const userId = req.query.userId

  try {
      // await client.connect()
      const database = client.db('app-data')
      const users = database.collection('users')

      const query = { user_id: userId }
      const user = await users.findOne(query)
      
      res.send(user)

  } catch{
    console.log(error)

  }
  finally {
      // await client.close()
  }
})


// CHANGE USERS CHARACTERISTICS
app.put('/user',async (req,res)=>{
    // const client = new MongoClient(uri);
    const formData = req.body.formData
    
    try{
        // await client.connect()
        const databaseName = client.db('app-data')
        const users = databaseName.collection('users')

        const queary = { user_id: formData.user_id  }
        const updateDocument = {
            $set:{
                first_name:formData.first_name,
                dob_day : formData.dob_day,
                dob_month : formData.dob_month,
                dob_year : formData.dob_year,
                show_gender: formData.show_gender,
                gender_identity:formData.gender_identity,
                gender_interest:formData.gender_interest,
                age_interest: formData.age_interest,
                photos: formData.photos,
                about : formData.about,
                matches : formData.matches

            },
        }
       const insertedUser=  await users.updateOne(queary, updateDocument)
       res.send(insertedUser)
    } finally{
        // await client.close()
    }


})


    
// Update a user's matches
// PUT /users/:userId/matches/:matchedUserId

app.put('/users/:userId/matches/:matchedUserId', async (req, res) => {
  const userId = req.get('identity');
  if(!userId ) {
    res.status(401).send({message: "You are not logged in!"});
    return;
  }
  
  const { matchedUserId } = req.params;

  try {
    const database = client.db('app-data')
    const users = database.collection('users')

    const query = { user_id: userId }
    const updateDocument = {
      $push: { matches: { user_id: matchedUserId } },
    }
    const user = await users.updateOne(query, updateDocument)
    const updatedUser = await users.findOne(query)
    res.send(updatedUser.matches)
  } catch (error) {
    console.error(error)
    res.status(500).send('Internal server error')
  }
})


// GET ALL USERS BY USER ID
app.get('/usersIds', async (req, res) => {
    // const client = new MongoClient(uri)
    
    const userIds = req.query.userIds.split(",")
    
    try {
        // await client.connect()
        const database = client.db('app-data')
        const users = database.collection('users')
        const pipeline =
            [
                {
                    '$match': {
                        'user_id': {
                            '$in': userIds
                        }
                    }
                }
            ]

        const foundUsers = await users.aggregate(pipeline).toArray()
            
        res.json(foundUsers)

    } finally {
        // await client.close()
    }
})

// SET LOCATION OF USER

app.put('/user/:user_id/location', async (req, res) => {
    const user_id = req.params.user_id;
    const location = req.body.location;
  
    try {
      const databaseName = client.db('app-data');
      const users = databaseName.collection('users');
  
      const query = { user_id: user_id };
      const updateDocument = {
        $set: {
          location: location
        },
      };
  
      const updatedUser = await users.updateOne(query, updateDocument);
  
      if (updatedUser.modifiedCount === 1) {
        res.send('User location updated successfully');
      } else {
        res.status(404).send('User not found');
      }
    } catch (error) {
      console.error(error);
      res.status(500).send('Internal server error');
    }
  });


// MESSAGES BETWEEN userId and correspondingUserId

app.get('/users/:userId/messages/:correspondingUserId', async (req, res) => {
  const { userId, correspondingUserId } = req.params

  try {
  const database = client.db('app-data')
  const messages = database.collection('messages')
  const query = {
  $or: [
  { from: userId, to: correspondingUserId },
  { from: correspondingUserId, to: userId }
  ]
  }
  const foundMessages = await messages.find(query).sort({ timestamp: 1 }).toArray() // sort by timestamp in descending order
  io.emit("messages", foundMessages)
  res.send(foundMessages)
  } catch (error) {
  console.error(error)
  res.status(500).send('Internal server error')
  }
  })



 // Define a function to send a confirmation email
async function sendConfirmationEmail(userEmail, cart) {
  // Configure the email transport using nodemailer
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'anzhelostoyanovdev@gmail.com',
        pass: 'vgihsjebsorqgzbe'
    }
});

const mailOptions = {
  from: 'anzhelostoyanovdev@gmail.com',
  to: userEmail,
  subject: 'Purchase Confirmation',
  html: `<html xmlns="http://www.w3.org/1999/xhtml">
  <head>
    <meta http-equiv="content-type" content="text/html; charset=utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0;">
     <meta name="format-detection" content="telephone=no"/>
  
    <!-- Responsive Mobile-First Email Template by Konstantin Savchenko, 2015.
    https://github.com/konsav/email-templates/  -->
  
    <style>
  /* Reset styles */ 
  body { margin: 0; padding: 0; min-width: 100%; width: 100% !important; height: 100% !important;}
  body, table, td, div, p, a { -webkit-font-smoothing: antialiased; text-size-adjust: 100%; -ms-text-size-adjust: 100%; -webkit-text-size-adjust: 100%; line-height: 100%; }
  table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; border-collapse: collapse !important; border-spacing: 0; }
  img { border: 0; line-height: 100%; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic; }
  #outlook a { padding: 0; }
  .ReadMsgBody { width: 100%; } .ExternalClass { width: 100%; }
  .ExternalClass, .ExternalClass p, .ExternalClass span, .ExternalClass font, .ExternalClass td, .ExternalClass div { line-height: 100%; }
  
  /* Rounded corners for advanced mail clients only */ 
  @media all and (min-width: 560px) {
    .container { border-radius: 8px; -webkit-border-radius: 8px; -moz-border-radius: 8px; -khtml-border-radius: 8px;}
  }
  
  /* Set color for auto links (addresses, dates, etc.) */ 
  a, a:hover {
    color: #127DB3;
  }
  .footer a, .footer a:hover {
    color: #999999;
  }
  
     </style>
  
    <!-- MESSAGE SUBJECT -->
    <title>Get this responsive email template</title>
  
  </head>
  
  <!-- BODY -->
  <!-- Set message background color (twice) and text color (twice) -->
  <body topmargin="0" rightmargin="0" bottommargin="0" leftmargin="0" marginwidth="0" marginheight="0" width="100%" style="border-collapse: collapse; border-spacing: 0; margin: 0; padding: 0; width: 100%; height: 100%; -webkit-font-smoothing: antialiased; text-size-adjust: 100%; -ms-text-size-adjust: 100%; -webkit-text-size-adjust: 100%; line-height: 100%;
    background-color: #F0F0F0;
    color: #000000;"
    bgcolor="#F0F0F0"
    text="#000000">
  
  <!-- SECTION / BACKGROUND -->
  <!-- Set message background color one again -->
  <table width="100%" align="center" border="0" cellpadding="0" cellspacing="0" style="border-collapse: collapse; border-spacing: 0; margin: 0; padding: 0; width: 100%;" class="background"><tr><td align="center" valign="top" style="border-collapse: collapse; border-spacing: 0; margin: 0; padding: 0;"
    bgcolor="#F0F0F0">
  
  
  <!-- WRAPPER / CONTEINER -->
  <!-- Set conteiner background color -->
  <table border="0" cellpadding="0" cellspacing="0" align="center"
    bgcolor="#FFFFFF"
    width="560" style="border-collapse: collapse; border-spacing: 0; padding: 0; width: inherit;
    max-width: 560px;" class="container">
  
    <!-- HEADER -->
    <!-- Set text color and font family ("sans-serif" or "Georgia, serif") -->
    <tr>
      <td align="center" valign="top" style="border-collapse: collapse; border-spacing: 0; margin: 0; padding: 0; padding-left: 6.25%; padding-right: 6.25%; width: 87.5%; font-size: 24px; font-weight: bold; line-height: 130%;
        padding-top: 25px;
        color: #000000;
        font-family: sans-serif;" class="header">
          Поръчката е потвърдена
      </td>
    </tr>
    
    <!-- SUBHEADER -->
    <!-- Set text color and font family ("sans-serif" or "Georgia, serif") -->
    <tr>
      <td align="center" valign="top" style="border-collapse: collapse; border-spacing: 0; margin: 0; padding: 0; padding-bottom: 3px; padding-left: 6.25%; padding-right: 6.25%; width: 87.5%; font-size: 18px; font-weight: 300; line-height: 150%;
        padding-top: 5px;
        color: #000000;
        font-family: sans-serif;" class="subheader">
          вашата къщичка се подготвя за вашия приятел
      </td>
    </tr>
  
    <!-- HERO IMAGE -->
    <!-- Image text color should be opposite to background color. Set your url, image src, alt and title. Alt text should fit the image size. Real image size should be x2 (wrapper x2). Do not set height for flexible images (including "auto"). URL format: http://domain.com/?utm_source={{Campaign-Source}}&utm_medium=email&utm_content={{Ìmage-Name}}&utm_campaign={{Campaign-Name}} -->
    <tr>
      <td align="center" valign="top" style="border-collapse: collapse; border-spacing: 0; margin: 0; padding: 0;
        padding-top: 20px;" class="hero"><a target="_blank" style="text-decoration: none;"
        href="https://roof-and-woff-anzhelostoyanov.vercel.app"><img border="0" vspace="0" hspace="0"
        src="https://images.rawpixel.com/image_800/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIzLTA4L3Jhd3BpeGVsX29mZmljZV8yNl9waG90b19vZl9hX3BvcnRyYWl0X29mX2N1dGVzdF9wdXBweWV5ZXNfc21pbF84MGJjODAzYy1hODAzLTRlODMtOThmMC0yOWI1NjkwMDc4Y2ZfMS5qcGc.jpg"
        alt="Please enable images to view this content" title="Hero Image"
        width="560" style="
        width: 100%;
        max-width: 560px;
        color: #000000; font-size: 13px; margin: 0; padding: 0; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic; border: none; display: block;"/></a></td>
    </tr>
  
    <!-- PARAGRAPH -->
    <!-- Set text color and font family ("sans-serif" or "Georgia, serif"). Duplicate all text styles in links, including line-height -->
    <tr>
      <td align="center" valign="top" style="border-collapse: collapse; border-spacing: 0; margin: 0; padding: 0; padding-left: 6.25%; padding-right: 6.25%; width: 87.5%; font-size: 17px; font-weight: 400; line-height: 160%;
        padding-top: 25px; 
        color: #000000;
        font-family: sans-serif;" class="paragraph">
          Искрено благодарим ви за избора на нашата продукция и за направената от вас покупка. Ние ценим доверието, което ни оказахте, и се надяваме, че продуктът/услугата ще отговаря на вашите очаквания.
  
                  Ако имате въпроси или нужда от допълнителна информация, не се колебайте да се свържете с нас. Ние сме тук, за да помогнем.
      </td>
    </tr>
  
    <!-- BUTTON -->
    <!-- Set button background color at TD, link/text color at A and TD, font family ("sans-serif" or "Georgia, serif") at TD. For verification codes add "letter-spacing: 5px;". Link format: http://domain.com/?utm_source={{Campaign-Source}}&utm_medium=email&utm_content={{Button-Name}}&utm_campaign={{Campaign-Name}} -->
    <tr>
      <td align="center" valign="top" style="border-collapse: collapse; border-spacing: 0; margin: 0; padding: 0; padding-left: 6.25%; padding-right: 6.25%; width: 87.5%;
        padding-top: 25px;
        padding-bottom: 5px;" class="button"><a
        href="https://roof-and-woff-anzhelostoyanov.vercel.app/" target="_blank" style="text-decoration: underline;">
          <table border="0" cellpadding="0" cellspacing="0" align="center" style="max-width: 240px; min-width: 120px; border-collapse: collapse; border-spacing: 0; padding: 0;"><tr><td align="center" valign="middle" style="padding: 12px 24px; margin: 0; text-decoration: underline; border-collapse: collapse; border-spacing: 0; border-radius: 4px; -webkit-border-radius: 4px; -moz-border-radius: 4px; -khtml-border-radius: 4px;"
            bgcolor="#E9703E"><a target="_blank" style="text-decoration: underline;
            color: #FFFFFF; font-family: sans-serif; font-size: 17px; font-weight: 400; line-height: 120%;"
            href="https://roof-and-woff-anzhelostoyanov.vercel.app/">
              Свържи се с нас
            </a>
        </td></tr></table></a>
      </td>
    </tr>
  </table>
  
  <!-- WRAPPER -->
  <!-- Set wrapper width (twice) -->
  <table border="0" cellpadding="0" cellspacing="0" align="center"
    width="560" style="border-collapse: collapse; border-spacing: 0; padding: 0; width: inherit;
    max-width: 560px;" class="wrapper">
  
    <!-- SOCIAL NETWORKS -->
    <!-- Image text color should be opposite to background color. Set your url, image src, alt and title. Alt text should fit the image size. Real image size should be x2 -->
    <tr>
      <td align="center" valign="top" style="border-collapse: collapse; border-spacing: 0; margin: 0; padding: 0; padding-left: 6.25%; padding-right: 6.25%; width: 87.5%;
        padding-top: 25px;" class="social-icons"><table
        width="256" border="0" cellpadding="0" cellspacing="0" align="center" style="border-collapse: collapse; border-spacing: 0; padding: 0;">
        <tr>
  
          <!-- ICON 1 -->
          <td align="center" valign="middle" style="margin: 0; padding: 0; padding-left: 10px; padding-right: 10px; border-collapse: collapse; border-spacing: 0;"><a target="_blank"
            href="https://raw.githubusercontent.com/konsav/email-templates/"
          style="text-decoration: none;"><img border="0" vspace="0" hspace="0" style="padding: 0; margin: 0; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic; border: none; display: inline-block;
            color: #000000;"
            alt="F" title="Facebook"
            width="44" height="44"
            src="https://raw.githubusercontent.com/konsav/email-templates/master/images/social-icons/facebook.png"></a></td>
  
          <!-- ICON 2 -->
          <td align="center" valign="middle" style="margin: 0; padding: 0; padding-left: 10px; padding-right: 10px; border-collapse: collapse; border-spacing: 0;"><a target="_blank"
            href="https://raw.githubusercontent.com/konsav/email-templates/"
          style="text-decoration: none;"><img border="0" vspace="0" hspace="0" style="padding: 0; margin: 0; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic; border: none; display: inline-block;
            color: #000000;"
            alt="T" title="Twitter"
            width="44" height="44"
            src="https://raw.githubusercontent.com/konsav/email-templates/master/images/social-icons/twitter.png"></a></td>				
  
          <!-- ICON 3 -->
          <td align="center" valign="middle" style="margin: 0; padding: 0; padding-left: 10px; padding-right: 10px; border-collapse: collapse; border-spacing: 0;"><a target="_blank"
            href="https://raw.githubusercontent.com/konsav/email-templates/"
          style="text-decoration: none;"><img border="0" vspace="0" hspace="0" style="padding: 0; margin: 0; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic; border: none; display: inline-block;
            color: #000000;"
            alt="G" title="Google Plus"
            width="44" height="44"
            src="https://raw.githubusercontent.com/konsav/email-templates/master/images/social-icons/googleplus.png"></a></td>		
  
          <!-- ICON 4 -->
          <td align="center" valign="middle" style="margin: 0; padding: 0; padding-left: 10px; padding-right: 10px; border-collapse: collapse; border-spacing: 0;"><a target="_blank"
            href="https://raw.githubusercontent.com/konsav/email-templates/"
          style="text-decoration: none;"><img border="0" vspace="0" hspace="0" style="padding: 0; margin: 0; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic; border: none; display: inline-block;
            color: #000000;"
            alt="I" title="Instagram"
            width="44" height="44"
            src="https://raw.githubusercontent.com/konsav/email-templates/master/images/social-icons/instagram.png"></a></td>
  
        </tr>
        </table>
      </td>
    </tr>
  
    <!-- FOOTER -->
    <!-- Set text color and font family ("sans-serif" or "Georgia, serif"). Duplicate all text styles in links, including line-height -->
    <tr>
      <td align="center" valign="top" style="border-collapse: collapse; border-spacing: 0; margin: 0; padding: 0; padding-left: 6.25%; padding-right: 6.25%; width: 87.5%; font-size: 13px; font-weight: 400; line-height: 150%;
        padding-top: 20px;
        padding-bottom: 20px;
        color: #999999;
        font-family: sans-serif;" class="footer">
  
          This email template was sent to&nbsp;you becouse we&nbsp;want to&nbsp;make the&nbsp;world a&nbsp;better place. You&nbsp;could change your <a href="https://github.com/konsav/email-templates/" target="_blank" style="text-decoration: underline; color: #999999; font-family: sans-serif; font-size: 13px; font-weight: 400; line-height: 150%;">subscription settings</a> anytime.
  
          <!-- ANALYTICS -->
          <!-- https://www.google-analytics.com/collect?v=1&tid={{UA-Tracking-ID}}&cid={{Client-ID}}&t=event&ec=email&ea=open&cs={{Campaign-Source}}&cm=email&cn={{Campaign-Name}} -->
          <img width="1" height="1" border="0" vspace="0" hspace="0" style="margin: 0; padding: 0; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic; border: none; display: block;"
          src="https://raw.githubusercontent.com/konsav/email-templates/master/images/tracker.png" />
  
      </td>
    </tr>
  
  <!-- End of WRAPPER -->
  </table>
  
  <!-- End of SECTION / BACKGROUND -->
  </td></tr></table>
  
  </body>
  </html>`
};


  try {
      // Send the email
      const info = await transporter.sendMail(mailOptions);
      console.log(`Confirmation email sent to anjelostoqnov@gmai.com. Message ID: ${info.messageId}`);
  } catch (error) {
      console.error('Error sending confirmation email:', error);
      console.error('Error sending confirmation email:', error);
  }
}

// Your existing code...

// Update your /payment endpoint to call sendConfirmationEmail on successful payment
app.post("/payment", async (req, res) => {
  let { amount, description, id, userEmail, cart, productID } = req.body; // Assuming you're sending userEmail and cart in the request body

  try {
    // Create a PaymentIntent with productID in the metadata
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount,
      currency: "USD",
      description: description,
      payment_method: id,
      confirm: true,
      metadata: {
        productID: productID
      }
    });

    // If payment is successful, send a confirmation email
    if (paymentIntent.status === 'succeeded') {
      // Assuming userEmail and cart are available in the request body
      await sendConfirmationEmail(userEmail, cart);
      console.log('sendConfirmationEmail called successfully');
      console.log("anjelostoqnov@gmai.com");
    }

    res.json({
      clientSecret: paymentIntent.client_secret,
      message: "Payment successful",
      success: true
    });
  } catch (error) {
    console.log("Error", error);
    res.json({
      message: "Payment failed",
      success: false
    });
  }
});

// ...

app.post('/payments', async (req, res) => {
  try {
    const { items, id, userEmail } = req.body;

    // Calculate the total amount based on the items and their quantities
    const amount = calculateTotalAmount(items);

    // Create a payment intent with the calculated amount
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: 'usd',
      payment_method: id,
      confirm: true,
    });

    // If the payment intent is successful, update the inventory or take any necessary actions
    if (paymentIntent.status === 'succeeded') {
      // Your logic to handle successful payment

      // Send a success response to the client
      return res.status(200).json({ success: true });
    } else {
      return res.status(400).json({ success: false, message: 'Payment failed' });
    }
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Helper function to calculate the total amount
function calculateTotalAmount(items) {
  // Calculate the total amount based on your item prices and quantities
  // Replace this with your own logic based on your pricing strategy
  const totalAmount = items.reduce((acc, item) => {
    return acc + item.quantity * getItemPrice(item.price);
  }, 0);

  return totalAmount;
}

// Dummy function to get item price, replace it with your actual logic
function getItemPrice(priceId) {
  // Replace this with your logic to fetch the price of the item with the given price ID
  // from your database or any other source
  return 1000; // Dummy price for example purposes
}


// ...


// ADD MESSAGES Database
app.post('/message', async (req, res) => {
    const message = req.body.message ;
    
  try {
    const database = client.db('app-data')
    const messages = database.collection('messages')

    const insertedMessage = await messages.insertOne(message)
    
//    io.emit('message', insertedMessage) // Emit the new message to all connected clients
    res.send(insertedMessage)

    
  } catch (error) {
    console.error(error)
    res.status(500).send('Internal server error')
  }
})

io.on('connection', (socket) => {
  console.log(`Socket ${socket.id} connected`)

  socket.on('message', (data) => {
    io.sockets.emit("messageRes", data);
    
  });

  socket.on('disconnect', () => {
    console.log(`Socket ${socket.id} disconnected`)
  })
})

server.listen(PORT, () => {
  console.log(`Server running on PORT ${PORT}`)
})
