const PORT = 8080
const express = require('express')
const { MongoClient , ObjectId } = require('mongodb')
const { v1: uuidv4 } = require('uuid')
const jwt = require('jsonwebtoken')
const bcrypt = require('bcrypt')
const cors = require('cors')
const { error } = require('console')
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



  app.post("/payment",  async (req, res) => {
    let { amount, id } = req.body
    try {
      const payment = await stripe.paymentIntents.create({
        amount,
        currency: "USD",
        description: "Tinder IT Talants",
        payment_method: id,
        confirm: true
      })
      res.json({
        message: "Payment successful",
        success: true
      })
    } catch (error) {
      console.log("Error", error)
      res.json({
        message: "Payment failed",
        success: false
      })
    }
  })
  

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
