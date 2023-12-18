const { body, validationResult } = require("express-validator");
const express = require("express");
const cors = require("cors");
const basicAuth = require("express-basic-auth");
const { createServer } = require("node:http");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require("fs");
const { mult } = require("./libs/mult");

const app = express();
const server = createServer(app);
require("dotenv").config();
const port = process.env.PORT || 5003;
const genAI = new GoogleGenerativeAI(process.env.API_KEY);

const env = {
  BOT_NUMBER: process.env.BOT_NUMBER,
  CLIENT_NUMBER: process.env.CLIENT_NUMBER,
  BASIC_PASS: process.env.BASIC_PASS,
};

app.use(express.json());
app.use(cors());

const pass = env.BASIC_PASS || "murphy";

app.use(
  basicAuth({
    users: { engine: pass },
  })
);

app.get("/", (req, res) => {
  res.send("Jarvis Engine Ready v2.0.1");
});

app.post(
  "/ask",
  mult,
  body("q").notEmpty().isString().trim(),
  async (req, res) => {
    const { q } = req.body;
    const files = req.files;
    const hasFiles =
      files !== null ? (files.length >= 1 ? true : false) : false;
    let aiModel = "gemini-pro";
    if (hasFiles) {
      aiModel = "gemini-pro-vision";
    }
    const generationConfig = {
      temperature: 1,
      topP: 1,
      topK: 1,
    };
    const model = genAI.getGenerativeModel({
      model: aiModel,
      generationConfig,
    });
    const result = validationResult(req);
    if (result.isEmpty()) {
      try {
        if (hasFiles) {
          const imageParts = filesToGenerative(files);
          const result = await model.generateContent([q, ...imageParts]);
          const response = result.response;
          const text = response.text();
          unlinkFiles(files);
          return res.send({ status: "ok", asnwer: text });
        } else {
          const chat = model.startChat();
          const result = await chat.sendMessage(q);
          const response = result.response;
          const text = response.text();
          unlinkFiles(files);
          return res.send({ status: "ok", asnwer: text });
        }
      } catch (err) {
        console.log(err);
        return res.status(500).send(err);
      }
    } else {
      return res.status(400).send({ errors: result.array() });
    }
  }
);

server.listen(port, () => {
  console.log(`Jarvis v2.0.1 Port Listen on ${port}`);
});

const unlinkFiles = (files) => {
  try {
    for (let i in files) {
      const file = files[i];
      fs.unlink(file.path, (err) => {
        if (err) throw err;
        console.log("deleted " + file.path);
      });
    }
  } catch (e) {
    console.log(e);
  }
};

const filesToGenerative = (files) => {
  const generatives = [];
  for (let i in files) {
    const file = files[i];
    generatives.push(fileToGenerativePart(file.path, file.mimetype));
  }

  return generatives;
};

function fileToGenerativePart(path, mimeType) {
  return {
    inlineData: {
      data: Buffer.from(fs.readFileSync(path)).toString("base64"),
      mimeType,
    },
  };
}
