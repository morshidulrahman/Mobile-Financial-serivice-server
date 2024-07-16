const express = require("express");
const cors = require("cors");
require("dotenv").config();
const PORT = process.env.PORT || 5000;
const bcrypt = require("bcrypt");

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());
app.use(cookieParser());
const corsOptions = {
  origin: ["http://localhost:5173", "http://localhost:5174"],
  credentials: true,
};
app.use(cors(corsOptions));

const uri = `mongodb+srv://${process.env.DB_NAME}:${process.env.DB_PASS}@cluster0.m73tovo.mongodb.net/?appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production" ? true : false,
  sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
};

const dbConnect = async () => {
  try {
    client.connect();
    console.log("Database Connected Successfully");
  } catch (error) {
    console.log(error.name, error.message);
  }
};
dbConnect();

const Database = client.db("MFC");
const usersCollection = Database.collection("users");
const UserRequestCollection = Database.collection("userRequest");

app.post("/users", async (req, res) => {
  const userInfo = req.body;
  const existingUser = await usersCollection.findOne({ email: userInfo.email });

  if (existingUser) {
    return res.send({ message: "Email already exists" });
  }

  const hashedPassword = await bcrypt.hash(userInfo.password, 10);
  userInfo.password = hashedPassword;
  const result = await usersCollection.insertOne({
    ...userInfo,
    password: hashedPassword,
    status: "pending",
  });
  res.send(result);
});

app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await usersCollection.findOne({ email });
    if (user) {
      const isMatch = bcrypt.compareSync(password, user.password);
      if (isMatch) {
        console.log(isMatch);

        const token = jwt.sign(
          { email: user.email },
          process.env.ACCESS_TOKEN_SECRET,
          {
            expiresIn: "365d",
          }
        );
        res.status(200).cookie("token", token, cookieOptions).send({
          success: "true",
          status: "200",
        });
      } else {
        res.status(400).send("Password is incorrect");
      }
    } else {
      res.status(400).send("User does not exist");
    }
  } catch (error) {
    res.status(500).send("Internal server error");
  }
});

app.post("/logout", (req, res) => {
  res
    .clearCookie("token", {
      ...cookieOptions,
      maxAge: 0,
    })
    .send({
      success: "true",
    });
});

// send money to others
app.put("/sendmoney", async (req, res) => {
  const { number, amount, mynumber } = req.body;

  let sendamount = parseInt(amount);

  const sender = await usersCollection.findOne({ email: mynumber });
  const reciver = await usersCollection.findOne({ email: number });

  if (!sender || !reciver) {
    return res.status(404).send("User or Agent not found");
  }
  if (amount >= 100) {
    sendamount = sendamount + 5;
  }

  console.log(sendamount);
  // Update balances
  const SenderUserBalance = parseInt(sender.balance) - parseInt(amount);
  const ReciverBalance = parseInt(reciver.balance) + parseInt(amount);

  const userresult = await usersCollection.updateOne(
    { email: sender.email },
    { $set: { balance: SenderUserBalance } }
  );
  const reciverresult = await usersCollection.updateOne(
    { email: reciver.email },
    { $set: { balance: ReciverBalance } }
  );
  res.send(userresult);
});

app.post("/cashin", async (req, res) => {
  const { agentnumber, password, amount, mynumber } = req.body;
  let cashinamount = parseInt(amount);

  const cashinInfo = {
    agentnumber,
    amount: cashinamount,
    mynumber,
    status: "pending",
    transactionType: "cashin",
  };

  const user = await usersCollection.findOne({ email: mynumber });

  const isMatch = bcrypt.compareSync(password, user.password);
  if (isMatch) {
    const casinresult = await UserRequestCollection.insertOne(cashinInfo);
    res.send(casinresult);
  } else {
    res.status(400).send("Password is incorrect");
  }
});

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
