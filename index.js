const express = require("express");
const port = 5000;
const cors = require("cors");
require("dotenv").config();

const { MongoClient, ObjectId, ServerApiVersion } = require("mongodb");
const Stripe = require("stripe");
   const jwt = require("jsonwebtoken");
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const app = express();
app.use(cors());
app.use(express.json());

  const verifyToken = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).send({ message: "Unauthorized access" });
    }

    const token = authHeader.split(" ")[1]; 

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) {
        return res.status(401).send({ message: "Unauthorized access" });
      }
      req.decoded = decoded; 
      next();
    });
  };

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

      const artworks = await artworksCollection
        .find(query)
        .sort({ createdAt: -1 })
        .toArray();

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

    app.post("/artworks", verifyToken, async (req, res) => {
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
      const { email, name, artistImage } = req.body;

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
      const updateData = {
        name,
      };

      if (artistImage) {
        updateData.artistImage = artistImage;
      }
      const result = await usersCollection.updateOne(
        {
          email: email,
        },
        {
          $set: updateData,
        },
      );
      if (artistImage) {
        console.log("Updating artworks for:", email);

        const artworkResult = await artworksCollection.updateMany(
          { artistEmail: email },
          {
            $set: {
              artistImage,
            },
          },
        );

        console.log(artworkResult);
      }
      console.log(result);

      res.send(result);
    });

    app.get("/my-artworks", verifyToken, async (req, res) => {
      const email = req.query.email;

      if (req.decoded.email !== email) {
        return res.status(403).send({ message: "Forbidden access" });
      }

      const artworks = await artworksCollection
        .find({ artistEmail: email })
        .toArray();
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

    app.get("/top-artists", async (req, res) => {
      const artists = await artworksCollection
        .aggregate([
          {
            $group: {
              _id: "$artistEmail",
              artistName: {
                $first: "$artistName",
              },
              avatar: {
                $first: "$artistImage",
              },
              totalArtworks: {
                $sum: 1,
              },
            },
          },

          {
            $sort: {
              totalArtworks: -1,
            },
          },

          {
            $limit: 3,
          },
        ])
        .toArray();
      res.send(artists);
    });

    app.post("/create-checkout-session", async (req, res) => {
      try {
        const { plan } = req.body;

        let priceId;
        let maxPurchases;

        if (plan === "Pro") {
          priceId = process.env.STRIPE_PRO_PRICE_ID;
          maxPurchases = 9;
        } else if (plan === "Premium") {
          priceId = process.env.STRIPE_PREMIUM_PRICE_ID;
          maxPurchases = -1;
        } else {
          return res.status(400).send({ error: "Invalid plan" });
        }
        const session = await stripe.checkout.sessions.create({
          mode: "subscription",
          line_items: [
            {
              price: priceId,
              quantity: 1,
            },
          ],

          metadata: {
            plan,
            maxPurchases,
          },

          success_url:
            `${process.env.CLIENT_URL}/dashboard/user/subscription/success?session_id={CHECKOUT_SESSION_ID}`,

          cancel_url: `${process.env.CLIENT_URL}/dashboard/user/subscription`,
        });

        res.send({
          url: session.url,
        });
      } catch (err) {
  console.error("Stripe Error:", err);
  res.status(500).send({ error: err.message });
}
    });

    app.get("/users", async (req, res) => {
      try {
        const email = req.query.email;

        if (!email) {
          return res
            .status(400)
            .send({ message: "Email query param is required" });
        }

        const user = await usersCollection.findOne({ email });

        if (!user) {
          return res.status(404).send({ message: "User not found" });
        }

        res.send(user);
      } catch (error) {
        console.error("GET /users error:", error);
        res.status(500).send({ message: "Failed to fetch user" });
      }
    });

    app.patch("/users/subscription", async (req, res) => {
      const { email, plan, maxPurchases } = req.body;

      const result = await usersCollection.updateOne(
        { email },
        {
          $set: {
            plan,
            maxPurchases,
          },
        },
      );

      res.send(result);
    });

    app.get("/purchases", async (req, res) => {
      const email = req.query.email;

      const result = await salesCollection
        .find({ buyerEmail: email })
        .toArray();

      res.send(result);
    });

    app.post("/jwt", async (req, res) => {
      const { email } = req.body;

      if (!email) {
        return res.status(400).send({ message: "Email is required" });
      }

      const user = await usersCollection.findOne({ email });

      if (!user) {
        return res.status(404).send({ message: "User not found" });
      }

      const token = jwt.sign(
        {
          email: user.email,
          role: user.role,
        },
        process.env.JWT_SECRET,
        { expiresIn: "7d" },
      );

      res.send({ token });
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
