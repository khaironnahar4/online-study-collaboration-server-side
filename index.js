const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
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
    const materialsCollection = database.collection("materials");

    // verify token middleware
    const verifyToken = (req, res, next) => {
      if (!req.headers.authorization) {
        return res.status(401).send({ message: "Unauthorized user!" });
      }
      // console.log(req.headers.authorization);
      
      const token = req.headers.authorization.split(" ")[1];
      // console.log(token);
      
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRETE, (err, decoded) => {
        if (err) {
          return res.status(403).send({ message: "Forbidden access." });
        }
        req.decoded = decoded;
        next();
      });
    };

    // create jwt toke
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRETE, {
        expiresIn: "1h",
      });
      res.send({ token });
    });

    // check if user is admin or not
    app.get("/users/admin/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "Unauthorized admin!" });
      }
      const query = { email };
      const user = await usersCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.role == "admin";
      }
      res.send({ admin });
    });

    // check if user is tutor or not
    app.get("/users/tutor/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "Unauthorized tutor!" });
      }
      const query = { email };
      const user = await usersCollection.findOne(query);
      let tutor = false;
      if (user) {
        tutor = user?.role == "tutor";
      }
      res.send({ tutor });
    });

    // users
    app.get("/users", async (req, res) => {
      const role = req.query.role;
      const search = req.query.search || null;
      let query = {};
      if (role) {
        query = { role: role };
      }
      if (search) {
        query = {
          $or: [
            { name: new RegExp(search, "i") },
            { email: new RegExp(search, "i") },
          ],
        };
      }
      
      const result = await usersCollection.find(query).toArray();
      console.log(query, result);
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

    app.put("/users", verifyToken, async (req, res) => {
      const data = req.body;
      const id = req.query.id;
      const query = { _id: new ObjectId(id) };
      const updatdUser = {
        $set: {
          role: data.role,
        },
      };
      const result = await usersCollection.updateOne(query, updatdUser);
      res.send(result);
    });

    // study session
    app.get("/study-sessions", async (req, res) => {
      const limit = parseInt(req.query.limit) || null;
      const id = req.query.id;
      const email = req.query.email;
      const status = req.query.status || "";

      let query = {};
      if (id) {
        query = { _id: new ObjectId(id) };
      }
      if (email) {
        query = { tutorEmail: email };
      }
      if (status != "") {
        query.status = status;
      }

      let cursor = studySessionCollection.find(query);

      if (limit) {
        cursor = cursor.limit(limit);
      }

      const result = await cursor.toArray();
      // console.log(email,status);
      // console.log(result, query);

      res.send(result);
    });

    app.get("/study-session/approved", async (req, res) => {
      const limit = parseInt(req.query.limit) || null;
      let query = { status: "approved" };
      let cursor = studySessionCollection.find(query);

      if (limit) {
        cursor = cursor.limit(limit);
      }

      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/all-study-session", async (req, res) => {
      const query = { status: { $in: ["pending", "approved"] } };
      const result = await studySessionCollection.find(query).toArray();
      res.send(result);
    });

    app.post("/study-sessions", async (req, res) => {
      const data = req.body;
      const result = await studySessionCollection.insertOne(data);
      res.send(result);
    });

    app.patch("/study-sessions", verifyToken, async (req, res) => {
      const data = req.body;
      const id = req.query.id;
      const filter = { _id: new ObjectId(id) };
      // const filter = {};
      const updatedStudySession = {
        $set: {
          sessionTitle: data?.sessionTitle,
          sessionDescription: data?.sessionDescription,
          registrationStartDate: data?.registrationStartDate,
          registrationEndDate: data?.registrationEndDate,
          classStartTime: data?.classStartTime,
          classEndTime: data?.classEndTime,
          sessionDuration: data?.sessionDuration,
          registrationFee: data?.registrationFee,
          status: data?.status,
        },
      };
      const result = await studySessionCollection.updateOne(
        filter,
        updatedStudySession
      );
      res.send(result);
    });

    app.put("/study-session/update-status", verifyToken, async (req, res) => {
      const data = req.body;
      const id = req.query.id;
      const filter = { _id: new ObjectId(id) };
      const updateSession = {
        $set: {
          registrationFee: data?.registrationFee,
          status: data?.status,
        },
      };
      const result = await studySessionCollection.updateOne(
        filter,
        updateSession
      );
      res.send(result);
    });

    app.delete("/study-sessions", verifyToken, async (req, res) => {
      const id = req.query.id;
      const query = { _id: new ObjectId(id) };
      const result = await studySessionCollection.deleteOne(query);
      res.send(result);
    });

    // booked session
    app.get("/booked-sessions", verifyToken, async (req, res) => {
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

    app.post("/booked-sessions", verifyToken, async (req, res) => {
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

    app.post("/reviews", verifyToken, async (req, res) => {
      const review = req.body;
      const result = await reviewCOllection.insertOne(review);
      res.send(result);
    });

    // notes collection
    app.get("/notes", verifyToken, async (req, res) => {
      const email = req.query.email;
      const id = req.query.id;
      let query = {};
      if (email) {
        query = { email };
      }
      if (id) {
        query = { _id: new ObjectId(id) };
      }
      const result = await notesCollection.find(query).toArray();
      res.send(result);
    });

    app.post("/notes", verifyToken, async (req, res) => {
      const note = req.body;
      const result = await notesCollection.insertOne(note);
      res.send(result);
    });

    app.put("/notes/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const noteData = req.body;
      // console.log(noteData);

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

    app.delete("/notes/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await notesCollection.deleteOne(query);
      res.send(result);
    });

    // materials
    app.get("/materials", verifyToken, async (req, res) => {
      const email = req.query.email;
      const id = req.query.id;
      let query = {};
      if (email) {
        query = { tutorEmail: email };
      }
      if (id) {
        query = { sessionID: id };
      }
      const result = await materialsCollection.find(query).toArray();
      res.send(result);
    });

    app.get("/materials/single-material", verifyToken, async (req, res) => {
      const id = req.query.id;
      const query = { _id: new ObjectId(id) };

      const result = await materialsCollection.findOne(query);
      res.send(result);
    });

    app.post("/materials", verifyToken, async (req, res) => {
      const data = req.body;
      const result = await materialsCollection.insertOne(data);
      res.send(result);
    });

    app.delete("/meterials/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const result = await materialsCollection.deleteOne(filter);
      console.log(id, result);

      res.send(result);
    });

    app.put("/meterials/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const material = req.body;
      // console.log(material);

      const query = { _id: new ObjectId(id) };
      const updatedMaterial = {
        $set: {
          materialTitle: material.materialTitle,
          image: material.image,
          link: material.link,
        },
      };
      const result = await materialsCollection.updateOne(
        query,
        updatedMaterial
      );
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
