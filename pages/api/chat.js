import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed",
    });
  }

  try {
    const { message } = req.body;

    if (!message || typeof message !== "string") {
      return res.status(400).json({
        error: "Message is required",
      });
    }

    // 1. Get a temporary Shopify access token
    const tokenResponse = await fetch(
      `https://${process.env.SHOPIFY_STORE_DOMAIN}/admin/oauth/access_token`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "client_credentials",
          client_id: process.env.SHOPIFY_CLIENT_ID,
          client_secret: process.env.SHOPIFY_CLIENT_SECRET,
        }),
      }
    );

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok || !tokenData.access_token) {
      console.error("Shopify authentication error:", tokenData);

      return res.status(500).json({
        error: "Could not connect to Shopify.",
      });
    }

    // 2. Read our ATTARWALAS Fragrance Metaobjects
    const shopifyQuery = `
      query {
        metaobjects(first: 20, type: "fragrance") {
          nodes {
            id
            handle
            displayName
            fields {
              key
              value
              jsonValue
            }
          }
        }
      }
    `;

    const shopifyResponse = await fetch(
      `https://${process.env.SHOPIFY_STORE_DOMAIN}/admin/api/2026-07/graphql.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": tokenData.access_token,
        },
        body: JSON.stringify({
          query: shopifyQuery,
        }),
      }
    );

    const shopifyData = await shopifyResponse.json();

    if (!shopifyResponse.ok || shopifyData.errors) {
      console.error("Shopify GraphQL error:", shopifyData);

      return res.status(500).json({
        error: "Could not read the fragrance catalog.",
      });
    }

    // 3. Convert Shopify data into a cleaner format for the AI
    const fragrances = shopifyData.data.metaobjects.nodes.map((item) => {
      const fields = {};

      for (const field of item.fields) {
        fields[field.key] = field.jsonValue ?? field.value;
      }

      return {
        id: item.id,
        handle: item.handle,
        displayName: item.displayName,
        ...fields,
      };
    });

    // 4. Give the relevant catalog data to OpenAI
    const response = await openai.responses.create({
      model: "gpt-5-mini",
      instructions: `
You are the ATTARWALAS AI Fragrance Assistant.

Your job is to help customers discover ATTARWALAS fragrances.

IMPORTANT RULES:
- Use the ATTARWALAS fragrance catalog provided below.
- Do not invent ATTARWALAS products.
- If a customer mentions a branded fragrance, use Reference Name and Aliases to understand what they mean.
- Recommend only fragrances that exist in the provided ATTARWALAS catalog.
- The customer-facing Display Name is the name you should use when recommending an ATTARWALAS fragrance.
- Be friendly and concise.
- If there is not enough information to make a recommendation, ask a useful follow-up question.

ATTARWALAS FRAGRANCE CATALOG:
${JSON.stringify(fragrances, null, 2)}
      `,
      input: message,
    });

    return res.status(200).json({
      reply: response.output_text,
    });
  } catch (error) {
    console.error("ATTARWALAS AI error:", error);

    return res.status(500).json({
      error: error.message || "The AI assistant could not process your request.",
    });
  }
}
