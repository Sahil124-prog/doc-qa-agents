import jwt from "jsonwebtoken";

const USER_ID = "6ad0f62fae9680fdc89e3721";
const id = process.argv[2]; // optional: a conversationId to open

const token = jwt.sign({ userId: USER_ID }, process.env.JWT_SECRET, {
  algorithm: "HS256",
  expiresIn: "5m",
});

const url = `http://localhost:5050/api/conversations${id ? `/${id}` : ""}`;
const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
console.log(res.status, JSON.stringify(await res.json(), null, 2));
