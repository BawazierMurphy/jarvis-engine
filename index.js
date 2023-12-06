const qrcode = require("qrcode-terminal");
const { Client, LocalAuth } = require("whatsapp-web.js");
const { body, validationResult } = require("express-validator");
const express = require("express");
const cors = require("cors");
const basicAuth = require("express-basic-auth");
const { createServer } = require("node:http");
const { Server } = require("socket.io");

const app = express();
const server = createServer(app);
const io = new Server(server);
const port = process.env.PORT || 5002;
require("dotenv").config();

const env = {
  BOT_NUMBER: process.env.BOT_NUMBER,
  CLIENT_NUMBER: process.env.CLIENT_NUMBER,
  BASIC_PASS: process.env.BASIC_PASS,
};

app.use(express.json());
app.use(cors());
app.use(
  basicAuth({
    users: { engine: env.BASIC_PASS },
  })
);

const client = new Client({
  puppeteer: {
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  },
  authStrategy: new LocalAuth({
    clientId: "client-one",
  }),
});

client.initialize();

client.on("qr", (qr) => {
  qrcode.generate(qr, { small: true });
});

client.on("authenticated", (session) => {
  console.log("WHATSAPP WEB => Authenticated");
});

client.on("ready", () => {
  console.log("Client is ready!");
});

client.on("message", async (message) => {
  const isFromBot = message.from === env.BOT_NUMBER;
  const text = message.body;
  console.log(message.from);
  if (isFromBot) {
    io.emit("answer", {
      answer: text,
    });
  }
});

app.get("/", (req, res) => {
  res.send("Jarvis Engine Ready v1.0.0");
});

app.post("/ask", body("q").notEmpty().isString().trim(), async (req, res) => {
  const { q } = req.body;
  const result = validationResult(req);
  if (result.isEmpty()) {
    try {
      await client.sendMessage(env.BOT_NUMBER, `${q} [ANSWER IN ENGLISH]`);
      return res.send({ status: "ok" });
    } catch (err) {
      console.log(err);
      return res.status(500).send(err);
    }
  } else {
    return res.status(400).send({ errors: result.array() });
  }
});

io.on("connection", (socket) => {
  console.log("a user connected");
});

server.listen(port, () => {
  console.log(`Port Listen on ${port}`);
});
