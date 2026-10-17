import jwt from "jsonwebtoken";

// Your account's userId (from MongoDB Atlas: qahistories → userId)
const USER_ID = "6ad0f62fae9680fdc89e3721";
const question = process.argv[2] || "Can I work from home?";

// Make a token the same way authController.js does
const token = jwt.sign({ userId: USER_ID }, process.env.JWT_SECRET, {
  algorithm: "HS256",
  expiresIn: "5m",
});

const start = Date.now();
const res = await fetch("http://localhost:5050/api/ask/stream", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  },
  body: JSON.stringify({ question }),
});

console.log("Status:", res.status, "| Type:", res.headers.get("content-type"));

const reader = res.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  const seconds = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`\n[${seconds}s]`, decoder.decode(value, { stream: true }));
}
