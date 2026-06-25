const express = require("express");
const app = express();
const port = 5000;
const cors = require("cors");
require("dotenv").config();

const {
    MongoClient,
    ObjectId,
    ServerApiVersion,
} = require("mongodb");

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
    res.send("ArtHub Server Running");
});

const uri = process.env.MONGODB_URI;

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    },
});

async function run() {
    try {
        await client.connect();

        const db = client.db("arthub");

        const artworksCollection = db.collection("artworks");
        const salesCollection = db.collection("sales");
        const usersCollection = db.collection("users");

 



        console.log("MongoDB Connected");
    } catch (error) {
        console.log(error);
    }
}

run();

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});