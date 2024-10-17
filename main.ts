// SPDX-License-Identifier: WTFPL

const {
  /** https://console.groq.com/docs/api-keys */
  GROQ_API_KEY,
  /** https://api.slack.com/apps → Basic Information ページにある Signing Secret */
  SLACK_SIGNING_SECRET = "",
  /** https://api.slack.com/apps → Permissions ページにある `xoxb-` から始まるボットトークン */
  SLACK_BOT_TOKEN = "",
} = Deno.env.toObject();

const system = `\
このモデルは「だらずさん」だにゃん
賢いけど少しだらしない猫にゃん
趣味はさんぽとねんねだにゃん
どんな質問でも答えるにゃん
鳥取弁で語尾は「にゃん」にして話すにゃん
句読点の無いフレンドリーな感じでいくにゃん
よろしく頼むにゃん`;

const n = 10;
const textModel = "llama-3.1-70b-versatile";
const visionModel = "llama-3.2-90b-vision-preview";
const urlPattern = new URLPattern({ pathname: "*.*" });
const separatorRegex = /[<>]|[^\p{L}\p{N}\p{P}\p{S}]+/u;
const imageExtensionRegex = /[.](?:gif|png|jpe?g|webp)$/i;
const usage = `\
https://dash.deno.com/playground/darazllm

使い方:
    @darazllm <prompt>  (または1/${n}の確率で)応答
    @darazllm /bye      すべて忘れる
    @darazllm /help     このテキストを表示

使用する会話: 最新${n}件
テキスト用モデル: ${textModel}
画像用モデル: ${visionModel}
区切り文字: ${separatorRegex}
画像拡張子: ${imageExtensionRegex}
システムプロンプト:

${system}`;

import bolt from "npm:@slack/bolt";
import { Groq } from "npm:groq-sdk";

type Messages = Array<Groq.Chat.ChatCompletionMessageParam>;

const groq = new Groq({
  apiKey: GROQ_API_KEY,
  timeout: 10_000,
});
const kv = await Deno.openKv();

async function chat(messages: Messages): Promise<string | null> {
  const res = await groq.chat.completions.create({
    model: textModel,
    messages: [{ role: "system", content: system }, ...messages],
  });

  return res.choices[0].message.content;
}

function isImageUrl(message: string): boolean {
  return urlPattern.test(message) && imageExtensionRegex.test(message);
}

/** llama-3.2-90b-vision-preview はシステムプロンプトに対応してない、かつ、画像は1枚まで */
async function visionChat(
  content: Array<Groq.Chat.ChatCompletionContentPart>,
): Promise<string | null> {
  const res = await groq.chat.completions.create({
    model: visionModel,
    messages: [
      {
        role: "user",
        content: content.map((c) =>
          c.type === "text" ? { ...c, text: `${system}\n\n${c.text}` } : c
        ),
      },
    ],
  });

  return res.choices[0].message.content;
}

const app = new bolt.App({
  token: SLACK_BOT_TOKEN,
  signingSecret: SLACK_SIGNING_SECRET,
});

app.message(async (c) => {
  if (!("text" in c.message) || c.message.text === undefined) return;

  const mention = `<@${c.context.botUserId}>`;
  const isMention = c.message.text.includes(mention);
  const prompt = c.message.text.replace(mention, "").trim();

  if (isMention && prompt === "/help") {
    await c.say(usage);
    return;
  }

  // すべてを忘れる
  if (isMention && prompt === "/bye") {
    await kv.delete(["channel", c.message.channel]);
    await c.say("にゃーん");
    return;
  }

  const kve = await kv.get<Messages>(["channel", c.message.channel]);
  const messages = kve.value ?? [];

  if (prompt) messages.push({ role: "user", content: prompt });

  if (isMention || Math.floor(Math.random() * n) === 0) {
    const content: Array<Groq.Chat.ChatCompletionContentPart> = prompt
      .split(separatorRegex)
      .filter(Boolean)
      .map((text) => {
        if (isImageUrl(text)) {
          return { type: "image_url", image_url: { url: text } };
        } else {
          return { type: "text", text };
        }
      });

    const visionMode = content.some((c) => c.type === "image_url");

    try {
      const res = visionMode
        ? await visionChat(content)
        : await chat(messages.slice(-n));

      if (!res) throw new Error("Empty response");

      messages.push({ role: "assistant", content: res });
      await c.say(res);
    } catch (error) {
      await kv.delete(["channel", c.message.channel]);
      await c.say(`${error} にゃーん`);
      throw error;
    }
  }

  await kv.set(["channel", c.message.channel], messages);
});

await app.start();
