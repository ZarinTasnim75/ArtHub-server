const express = require("express");
const app = express();
const port = 5000;
const cors = require("cors");
require("dotenv").config();

const { MongoClient, ObjectId, ServerApiVersion } = require("mongodb");

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

    const db1 = client.db("art_hub");
    const db2 = client.db("arthub");
    const artworksCollection = db2.collection("artworks");
    const salesCollection = db2.collection("sales");
    const usersCollection = db1.collection("user");

    app.get("/artworks", async (req, res) => {

  const { category } = req.query;

  const query = category ? { category } : {};

  const artworks = await artworksCollection.find(query).sort({ createdAt: -1 }).toArray();

  res.send(artworks);

});

    app.get("/artworks/:id", async (req, res) => {
      const id = req.params.id;

      const result = await artworksCollection.findOne({
        _id: new ObjectId(id),
      });

      res.send(result);
    });

    app.get("/artist-artworks/:email", async (req, res) => {
      const email = req.params.email;

      const result = await artworksCollection
        .find({
          artistEmail: email,
        })
        .toArray();

      res.send(result);
    });

    app.post("/artworks", async (req, res) => {
      const artwork = req.body;

      if (
        !artwork.title ||
        !artwork.artistEmail ||
        !artwork.artistName ||
        !artwork.image
      ) {
        return res.status(400).send({
          message: "Missing required fields",
        });
      }

      const result = await artworksCollection.insertOne(artwork);

      res.status(201).send(result);
    });

    app.put("/artworks/:id", async (req, res) => {
      const id = req.params.id;

      const updatedData = req.body;

      const result = await artworksCollection.updateOne(
        {
          _id: new ObjectId(id),
        },
        {
          $set: updatedData,
        },
      );

      res.send(result);
    });

    app.delete("/artworks/:id", async (req, res) => {
      const id = req.params.id;

      const result = await artworksCollection.deleteOne({
        _id: new ObjectId(id),
      });

      res.send(result);
    });

    app.patch("/profile", async (req, res) => {
      const { email, name } = req.body;

      console.log("Updating:", email);

      const existingUser = await usersCollection.findOne({
        email: email,
      });

      console.log("Found user:", existingUser);

      if (!existingUser) {
        return res.send({
          matchedCount: 0,
          modifiedCount: 0,
        });
      }

      const result = await usersCollection.updateOne(
        {
          email: email,
        },
        {
          $set: {
            name: name,
          },
        },
      );

      console.log(result);

      res.send(result);
    });

    app.get("/my-artworks", async (req, res) => {
      const email = req.query.email;

      const query = {
        artistEmail: email,
      };

      const artworks = await artworksCollection.find(query).toArray();

      res.send(artworks);
    });

    app.get("/featured-artworks", async (req, res) => {

    const result = await artworksCollection
        .find()
        .sort({ createdAt: -1 })
        .limit(6)
        .toArray();

    res.send(result);

});



    console.log("MongoDB Connected");
  } catch (error) {
    console.log(error);
  }
}

run();

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});