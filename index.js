const express = require('express');
const cors = require('cors');
const admin = require("firebase-admin");
const { MongoClient } = require('mongodb');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 8888;

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.y6hb5.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

async function verifyToken(req, res, next) {
    if (req.headers?.authorization?.startsWith('Bearer ')) {
        const token = req.headers?.authorization?.split(' ')[1];

        try {
            const decodedUser = await admin.auth().verifyIdToken(token);
            req.decodedEmail = decodedUser.email;
        }
        catch {

        }
    } else {
        // console.log(1);
    }
    next();
};

async function run() {
    try {
        await client.connect();
        console.log('Database Connected');
        const database = client.db('city_car_house');
        const usersCollection = database.collection('users');
        const carsCollection = database.collection('cars');

        app.get('/cars/bestCars/:limit', async (req, res) => {
            let limit = req.params.limit;
            limit = parseInt(limit);
            const cars = carsCollection.find({}).limit(limit);
            const result = await cars.toArray();
            res.json(result);
        })

        app.post('/admin/addCar', async (req, res) => {
            const data = req.body;
            const result = await carsCollection.insertOne(data);
            res.json(result);
        });

        app.post('/users', async (req, res) => {
            const data = req.body;
            const result = await usersCollection.insertOne(data);
            res.json(result);
        });

        app.put('/users', async (req, res) => {
            const data = req.body;
            const filter = { email: data.email };
            const options = { upsert: true };
            const updateDoc = {
                $set: data
            };
            const result = await usersCollection.updateOne(filter, updateDoc, options);
            res.json(result);
        });

        app.put('/users/admin', verifyToken, async (req, res) => {
            const data = req.body;
            const requester = req.decodedEmail;
            if (requester) {
                const isRequesterIsAdmin = await usersCollection.findOne({ email: requester })
                if (isRequesterIsAdmin?.role === 'admin') {
                    const filter = { email: data.adminEmail };
                    const updateDoc = {
                        $set: { role: 'admin' }
                    };
                    const result = await usersCollection.updateOne(filter, updateDoc);
                    res.json(result)
                }
            } else {
                res.status(403).json({ message: 'You dont have an access to make admin' })
            }
        });

        app.get('/users/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const result = await usersCollection.findOne(query);
            let isAdmin = false;
            if (result?.role === 'admin') {
                isAdmin = true;
            }
            res.json({ admin: isAdmin })
        });

    }
    finally {
        // await client.close()
    }
}
run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('City Car House');
});

app.listen(port, () => {
    console.log('Server is running on port ', port);
})