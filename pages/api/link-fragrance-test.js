export default async function handler(req, res) {
  try {
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
      });
    }

    const query = `
      query {
        metafieldDefinitions(
          first: 50
          ownerType: PRODUCT
          query: "namespace:custom key:fragrance_catalog"
        ) {
          nodes {
            id
            name
            namespace
            key
            type
            validations {
              name
              value
            }
          }
        }

        metaobjects(
          first: 20
          type: "fragrance"
        ) {
          nodes {
            id
            handle
            type
            displayName
            definition {
              id
              name
              type
              displayNameKey
            }
          }
        }
      }
    `;

    const response = await fetch(
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

    const data = await response.json();

    if (!response.ok || data.errors) {
      return res.status(500).json({
        success: false,
        details: data,
      });
    }

    return res.status(200).json({
      success: true,
      grantedScopes: tokenData.scope,
      metafieldDefinitions:
        data.data.metafieldDefinitions.nodes,
      fragranceMetaobjects:
        data.data.metaobjects.nodes,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}
