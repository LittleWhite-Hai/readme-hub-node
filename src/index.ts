import dotenv from "dotenv";
dotenv.config();
import express from "express";
import { Octokit } from "@octokit/rest";

const app = express();
const port = 3000;

app.get("/", (req, res) => {
  res.send("Hello Wor3ld!");
});

app.listen(port, () => {
  return console.log(`Express is listening at http://localhost:${port}`);
});

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});
octokit.rest.repos
  .getContent({
    owner: "LittleWhite-Hai",
    repo: "react-diff-viz",
    path: "README.md",
    headers: {
      "content-type": "text/plain",
    },
  })
  .then((res: any) => {
    console.log("res", Buffer.from(res.data.content, "base64").toString());
    console.log("type res", typeof res.data.content);
  });
