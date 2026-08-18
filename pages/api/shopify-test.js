export default async function handler(req, res) {
  try {
    // Get a Shopify access token
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

    if (!tokenResponse.ok) {
      return res.status(500).json({
        error: "Shopify authentication failed.",
        details: tokenData,
      });
    }

    // Ask Shopify for the Metaobject definitions
    const query = `
      query {
        metaobjectDefinitions(first: 50) {
          nodes {
            id
            name
            type
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
        body: JSON.stringify({ query }),
      }
    );

    const shopifyData = await shopifyResponse.json();

    if (!shopifyResponse.ok || shopifyData.errors) {
      return res.status(500).json({
        error: "Shopify GraphQL request failed.",
        details: shopifyData,
      });
    }

    return res.status(200).json({
      success: true,
      definitions: shopifyData.data.metaobjectDefinitions.nodes,
    });
  } catch (error) {
    return res.status(500).json({
      error: error.message || "Unknown error",
    });
  }
}
