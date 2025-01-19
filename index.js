const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();

const port = process.env.port || 5000;
const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("online learning server is running!");
});

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.zzvqarc.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    const database = client.db("online-tech");
    const studySessionCollection = database.collection("study-session");
    const usersCollection = database.collection("users");
    const bookedSesssionCollection = database.collection("booked-sessions");
    const reviewCOllection = database.collection("reviews");
    const notesCollection = database.collection("notes");

    // users
    app.get("/users", async (req, res) => {
      const role = req.query.role;
      let query = {};
      if (role) {
        query = { role: role };
      }
      const result = await usersCollection.find(query).toArray();
      res.send(result);
    });

    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const cursor = await usersCollection.findOne(query);
      // console.log(cursor);

      if (cursor) {
        return res.send({ message: "User Already exist" });
      }

      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    // study session
    app.get("/study-sessions", async (req, res) => {
      const limit = parseInt(req.query.limit) || null;
      const id = req.query.id;
      let query = {};
      if (id) {
        query = { _id: new ObjectId(id) };
      }
      let cursor = studySessionCollection.find(query);

      if (limit) {
        cursor = cursor.limit(limit);
      }

      const result = await cursor.toArray();
      res.send(result);
    });

    // booked session
    app.get("/booked-sessions", async (req, res) => {
      const std_email = req.query.std_email;
      let query = {};
      if (std_email) {
        query = { student_email: std_email };
      }
      const datas = await bookedSesssionCollection.find(query).toArray();

      const sessionIds = datas.map(
        (data) => new ObjectId(data.study_session_id)
      );
      // console.log(sessionIds);
      const result = await studySessionCollection
        .find({ _id: { $in: sessionIds } })
        .toArray();
      // console.log(result);

      res.send(result);
    });

    app.post("/booked-sessions", async (req, res) => {
      const data = req.body;
      // check if the session is already booked by the student
      const query = { study_session_id: data.study_session_id };
      const cursor = await bookedSesssionCollection.findOne(query);
      if (cursor) {
        return res.send({ message: "You already booked this session." });
      }
      const result = await bookedSesssionCollection.insertOne(data);
      res.send(result);
    });

    // review collection
    app.get("/reviews", async (req, res) => {
      const id = req.query.id;
      const query = { study_session_id: id };
      const result = await reviewCOllection.find(query).toArray();
      res.send(result);
    });

    app.post("/reviews", async (req, res) => {
      const review = req.body;
      const result = await reviewCOllection.insertOne(review);
      res.send(result);
    });

    // notes collection
    app.get("/notes", async (req, res) => {
      const email = req.query.email;
      const id = req.query.id;
      let query = {};
      if (email) {
        query = { email };
      }
      if(id) {
        query = {_id : new ObjectId(id)};
      }
      const result = await notesCollection.find(query).toArray();
      res.send(result);
    });

    app.post("/notes", async (req, res) => {
      const note = req.body;
      const result = await notesCollection.insertOne(note);
      res.send(result);
    });

    app.put("/notes/:id", async (req, res) => {
      const id = req.params.id;
      const noteData = req.body;
      console.log(noteData);
      
      const query = { _id: new ObjectId(id) };
      const updatedNote = {
        $set: {
          title: noteData.title,
          note: noteData.note,
        },
      };
      const result = await notesCollection.updateOne(query, updatedNote);
      res.send(result);
    });

    app.delete("/notes/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await notesCollection.deleteOne(query);
      res.send(result);
    });

    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    console.log("You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`server is running on port: ${port}`);
});
