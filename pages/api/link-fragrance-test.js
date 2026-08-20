export default async function handler(req, res) {
  try {
    // 1. Get Shopify access token
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
      return res.status(500).json({
        success: false,
        error: "Shopify authentication failed.",
        details: tokenData,
      });
    }

    // 2. Find the TEST product
    const query = `
      query {
        products(first: 10, query: "title:'Customize Perfume Test'") {
          nodes {
            id
            title

            metafield(
              namespace: "custom"
              key: "fragrance_catalog"
            ) {
              id
              namespace
              key
              type
              value
              jsonValue
            }

            options {
              id
              name
              position

              linkedMetafield {
                namespace
                key
              }

              optionValues {
                id
                name
                hasVariants
                linkedMetafieldValue
              }
            }

            variants(first: 40) {
              nodes {
                id
                title
                selectedOptions {
                  name
                  value
                }
              }
            }
          }
        }
      }
    `;

    // 3. Call Shopify Admin GraphQL
    const shopifyResponse = await fetch(
      `https://${process.env.SHOPIFY_STORE_DOMAIN}/admin/api/2026-07/graphql.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": tokenData.access_token,
        },
        body: JSON.stringify({
          query,
        }),
      }
    );

    const shopifyData = await shopifyResponse.json();

    if (!shopifyResponse.ok || shopifyData.errors) {
      return res.status(500).json({
        success: false,
        error: "Shopify GraphQL request failed.",
        details: shopifyData,
      });
    }

    // 4. Return diagnostic data
    return res.status(200).json({
      success: true,
      grantedScopes: tokenData.scope,
      products: shopifyData.data.products.nodes,
    });
  } catch (error) {
    console.error("Link fragrance diagnostic error:", error);

    return res.status(500).json({
      success: false,
      error: error.message || "Unknown error",
    });
  }
}
