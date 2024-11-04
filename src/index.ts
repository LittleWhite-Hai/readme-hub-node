import express from "express";
import { Octokit } from "@octokit/rest";

import rehypeStringify from "rehype-stringify";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import { removePosition } from "unist-util-remove-position";
import { visit } from 'unist-util-visit'

import dotenv from "dotenv";
dotenv.config();

const app = express();
const port = 3000;
const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

app.get("/", (req, res) => {
  res.send("Hello Wor3ld!");
});
app.get("/readme", async (req, res) => {
  const octokitRes: any = await octokit.rest.repos
    .getContent({
      owner: "LittleWhite-Hai",
      repo: "react-diff-viz",
      path: "README.md",
      headers: {
        "content-type": "text/plain",
      },
    })
  const content = Buffer.from(octokitRes.data.content, "base64").toString();
  // console.log("content", content);


  const processor = unified()
    .use(remarkParse)
  const parseTree = processor.parse(content);
  const tree = await processor.run(parseTree)
  removePosition(tree, { force: true })


  visit(tree, 'text', function (node: any, index: any, parent: any) {
    console.log([node.value, parent ? parent.type : index])
  })
  console.dir(tree, { depth: null })
  res.send(JSON.stringify(tree, null, 4));
});

app.listen(port, () => {
  return console.log(`Express is listening at http://localhost:${port}`);
});


