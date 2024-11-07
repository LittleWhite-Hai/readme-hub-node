import express from "express";
import { Octokit } from "@octokit/rest";

import rehypeStringify from "rehype-stringify";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import { removePosition } from "unist-util-remove-position";
import { visit } from "unist-util-visit";

import dotenv from "dotenv";
import OpenAI from "openai";
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
  const octokitRes: any = await octokit.rest.repos.getContent({
    owner: "LittleWhite-Hai",
    repo: "react-diff-viz",
    path: "README.md",
    headers: {
      "content-type": "text/plain",
    },
  });
  const content = Buffer.from(octokitRes.data.content, "base64").toString();

  const openai = new OpenAI();
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          "将这篇英文markdown文档将翻译成中文，注意不要翻译文档中的链接；代码块仅翻译注释内容",
      },
      {
        role: "user",
        content: content,
      },
    ],
  });

  console.log("completion", completion);

  // const processor = unified().use(remarkParse);
  // const parseTree = processor.parse(content);
  // const tree = await processor.run(parseTree);
  // removePosition(tree, { force: true });

  // const vv = (n) => {
  //   if (n.children?.length) {
  //     n.children.forEach(vv);
  //   } else if (n.type === "text") {
  //     n.value = n.value + "哦哦";
  //     console.log("n.value:", n.value);
  //   }
  // };
  // vv(tree);
  // console.dir(tree, { depth: null });

  res.send(JSON.stringify(completion.choices[0].message, null, 4));
});

app.listen(port, () => {
  return console.log(`Express is listening at http://localhost:${port}`);
});
