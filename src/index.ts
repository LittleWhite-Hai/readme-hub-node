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
import fs from "fs";
dotenv.config();

/**
 * 格式化时间戳为中文格式
 * @param timestamp 时间戳
 * @returns 格式化后的时间字符串 (例如: 2024-03-21 14:30:45)
 */
function formatTimestamp(timestamp) {
  const date = new Date(timestamp);
  const options: any = {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  };
  return new Intl.DateTimeFormat("zh-CN", options)
    .format(date)
    .replace(/\//g, "-")
    .replace(",", "");
}

// 存储路径和HTML内容的映射关系，用于内存缓存
const pathHtmlMap = new Map<string, string>();
// 用于持久化存储的数组，保存所有翻译记录
let pathHtmlArray: { path: string; html: string }[] = [];

// 启动时从文件加载缓存的HTML内容到内存中
fs.readFile("path-html.json", "utf-8", (err, data) => {
  if (err) {
    console.error("读取文件失败:", err);
  } else {
    pathHtmlArray = JSON.parse(data);
    pathHtmlArray.forEach((item) => {
      pathHtmlMap.set(item.path, item.html);
    });
  }
});

const app = express();
const port = 3000;
const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

app.get("/", (req, res) => {
  res.send("你好world");
});

/**
 * 获取并翻译GitHub仓库的README内容
 * @param owner 仓库所有者
 * @param repo 仓库名称
 * @returns 翻译后的HTML内容
 */
async function getTranslatedHtml({
  owner,
  repo,
}: {
  owner: string;
  repo: string;
}) {
  // 通过GitHub API获取README内容
  const octokitRes: any = await octokit.rest.repos.getContent({
    owner,
    repo,
    path: "README.md",
    headers: {
      "content-type": "text/plain",
    },
  });
  const content = Buffer.from(octokitRes.data.content, "base64").toString();

  // 使用OpenAI进行翻译
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

  // 将Markdown转换为HTML
  const processor = unified()
    .use(remarkParse)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeStringify);

  const file = await processor.process(completion.choices[0].message.content);
  return String(file);
}

app.get("/raw/github.com/*", async (req, res) => {
  // 解析请求路径
  const path = req.path.replace("/raw/", "").replace(/\/$/, "");
  const parsedPath = path.split("/");
  // 通过GitHub API获取README内容
  const octokitRes: any = await octokit.rest.repos.getContent({
    owner: parsedPath[1],
    repo: parsedPath[2],
    path: "README.md",
    headers: {
      "content-type": "text/plain",
    },
  });

  const content = Buffer.from(octokitRes.data.content, "base64").toString();
  const processor = unified()
    .use(remarkParse)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeStringify);

  const file = await processor.process(content);

  res
    .type("text/html")
    .send("<html><body>" + String(file.value) + "</body></html>");

  // 将翻译结果持久化到文件
  fs.writeFile("path-html-raw.txt", String(file.value), (err) => {
    if (err) {
      console.error("写入文件失败:", err);
    }
  });
});

/**
 * 处理README翻译请求的路由
 * 格式: /github.com/{owner}/{repo}
 */
app.get("/github.com/*", async (req, res) => {
  // 解析请求路径
  const path = req.path.replace(/^\//, "").replace(/\/$/, "");
  const parsedPath = path.split("/");

  // 验证请求路径格式
  let errorMsg = "";
  if (parsedPath[0] !== "github.com") {
    errorMsg = "请输入github仓库地址";
  } else if (parsedPath.length !== 3) {
    errorMsg = "请输入三段式github仓库主页地址";
  }
  if (errorMsg) {
    res.send(errorMsg);
    return;
  }

  // 检查缓存中存在已翻译的内容
  if (pathHtmlMap.has(path)) {
    const html = pathHtmlMap.get(path);
    // 如果处于加载状态
    if (html.startsWith("loading")) {
      const fromDate = Number(html.split("-")[1]);
      const now = Date.now();
      if (now - fromDate < 1000 * 60 * 5) {
        // 如果加载时间在5分钟内，返回加载中的状态
        res.send("loading from " + formatTimestamp(fromDate));
      } else {
        // 如果加载时间超过5分钟，重新获取并翻译内容
        const resHtml = await getTranslatedHtml({
          owner: parsedPath[1],
          repo: parsedPath[2],
        });
        pathHtmlMap.set(path, resHtml);
        pathHtmlArray.push({ path, html: resHtml });
      }
    } else {
      // 返回缓存的翻译结果
      res.send(pathHtmlMap.get(path));
      return;
    }
  } else {
    // 新的翻译请求，设置加载状态
    const html = "loading-" + Date.now();
    pathHtmlMap.set(path, html);
    pathHtmlArray.push({ path, html });
    res.send("loading from " + formatTimestamp(Date.now()));
    try {
      const resHtml = await getTranslatedHtml({
        owner: parsedPath[1],
        repo: parsedPath[2],
      });
      pathHtmlMap.set(path, resHtml);
      pathHtmlArray.push({ path, html: resHtml });
    } catch (error) {
      const errorMsg = "获取html失败:" + error;
      console.error(errorMsg);
      res.send(errorMsg);
      pathHtmlMap.set(path, errorMsg);
      pathHtmlArray.push({ path, html: errorMsg });
    }
  }

  // 将翻译结果持久化到文件
  fs.writeFile("path-html.json", JSON.stringify(pathHtmlArray), (err) => {
    if (err) {
      console.error("写入文件失败:", err);
    }
  });
});

// 启动服务器
app.listen(port, () => {
  return console.log(`Express is listening at http://localhost:${port}`);
});
