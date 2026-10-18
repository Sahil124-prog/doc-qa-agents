import jwt from "jsonwebtoken";

const USER_ID = "6ad0f62fae9680fdc89e3721";
const HISTORY_ID = process.argv[2]; // historyId from test-stream.js

// Usage: test-feedback.js <historyId> [1 | -1 | null | any number] [reason]
const ratingArg = process.argv[3] ?? "1";
const body = { rating: ratingArg === "null" ? null : Number(ratingArg) };
if (process.argv[4]) body.reason = process.argv[4];

const token = jwt.sign({ userId: USER_ID }, process.env.JWT_SECRET, {
  algorithm: "HS256",
  expiresIn: "5m",
});

const res = await fetch(
  `http://localhost:5050/api/ask/history/${HISTORY_ID}/feedback`,
  {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  },
);

console.log(res.status, await res.json());
