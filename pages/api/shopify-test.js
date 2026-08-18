export default async function handler(req, res) {
  try {
    // Step 1: Get a temporary Shopify access token
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
      console.error("Shopify token error:", tokenData);

      return res.status(500).json({
        error: "Could not authenticate with Shopify.",
        details: tokenData,
      });
    }

    // Step 2: Ask Shopify for our Fragrance Metaobjects
    const graphqlQuery = `
      query {
        metaobjects(first: 10, type: "fragrance") {
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
          query: graphqlQuery,
        }),
      }
    );

    const shopifyData = await shopifyResponse.json();

    if (!shopifyResponse.ok || shopifyData.errors) {
      console.error("Shopify GraphQL error:", shopifyData);

      return res.status(500).json({
        error: "Shopify GraphQL request failed.",
        details: shopifyData,
      });
    }

    // Return only the fragrance data for this test
    return res.status(200).json({
      success: true,
      fragrances: shopifyData.data.metaobjects.nodes,
    });
  } catch (error) {
    console.error("Shopify test error:", error);

    return res.status(500).json({
      error: error.message || "Unknown Shopify error",
    });
  }
}
