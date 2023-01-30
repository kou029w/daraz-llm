import { App, AwsLambdaReceiver } from "@slack/bolt";
import type { AwsHandler } from "@slack/bolt/dist/receivers/AwsLambdaReceiver";

const openaiApiKey = process.env.OPENAI_API_KEY ?? "";

async function gpt(prompt: string): Promise<string> {
  const endpoint = "https://api.openai.com/v1/completions";
  const body = {
    model: "text-davinci-003",
    prompt,
    temperature: 0.5,
    max_tokens: 2048,
  };
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${openaiApiKey}`,
    },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  return json.choices[0].text.trim();
}

const token = process.env.SLACK_BOT_TOKEN ?? "";
const signingSecret = process.env.SLACK_SIGNING_SECRET ?? "";
const receiver = new AwsLambdaReceiver({ signingSecret });
const awsHandler = receiver.toHandler();
const app = new App({ token, receiver });

// required app_mentions:read chat:write
app.event("app_mention", async ({ event, say }) => {
  const prompt = `語尾を「にゃん」にして質問にこたえる\n${event.text
    .replace(/<@[0-9A-Z]+>/, "")
    .trim()}\n`;
  const text = await gpt(prompt);
  await say(text);
});

export const handler: AwsHandler = async (event, context, callback) => {
  // AWS Lambda ウォームアップ時に発生しうるタイムアウトを無視
  if (event.headers["x-slack-retry-reason"] === "http_timeout") {
    return { statusCode: 200, body: "OK" };
  }
  return await awsHandler(event, context, callback);
};
