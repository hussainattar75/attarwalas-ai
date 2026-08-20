export default async function handler(req, res) {
  try {
    // Prevent accidentally creating the test product more than once.
    const productTitle = "Customize Perfume — METAOBJECT TEST";

    // 1. Shopify access token
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

    const graphql = async (query, variables = {}) => {
      const response = await fetch(
        `https://${process.env.SHOPIFY_STORE_DOMAIN}/admin/api/2026-07/graphql.json`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Shopify-Access-Token": tokenData.access_token,
          },
          body: JSON.stringify({
            query,
            variables,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || data.errors) {
        throw new Error(
          JSON.stringify(data.errors || data, null, 2)
        );
      }

      return data.data;
    };

    // 2. Check whether this test product already exists.
    const existingQuery = `
      query {
        products(first: 1, query: "title:'Customize Perfume — METAOBJECT TEST'") {
          nodes {
            id
            title
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
                linkedMetafieldValue
              }
            }
            variants(first: 10) {
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

    const existingData = await graphql(existingQuery);
    const existingProduct = existingData.products.nodes[0];

    if (existingProduct) {
      return res.status(200).json({
        success: true,
        alreadyExists: true,
        product: existingProduct,
      });
    }

    // 3. Create a completely new product with:
    //
    // Option 1: Search Your Fragrance
    //   → linked to custom.fragrance_catalog
    //
    // Option 2: Size
    //   → 50ml / 80ml / 100ml
    //
    // Option 3: Type
    //   → Alcoholic / Non-Alcoholic
    //
    // Shopify's productCreate supports linked metafield options.
    const createMutation = `
      mutation CreateMetaobjectLinkedProduct(
        $product: ProductCreateInput!
      ) {
        productCreate(product: $product) {
          userErrors {
            field
            message
          }

          product {
            id
            title

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

            variants(first: 20) {
              nodes {
                id
                title

                selectedOptions {
                  name
                  value
                }

                price
              }
            }
          }
        }
      }
    `;

    const variables = {
      product: {
        title: productTitle,
        productType: "Custom Perfume Test",

        productOptions: [
          {
            name: "Search Your Fragrance",
            linkedMetafield: {
              namespace: "custom",
              key: "fragrance_catalog",
              values: [
                "gid://shopify/Metaobject/227582804256",
                "gid://shopify/Metaobject/228342759712",
                "gid://shopify/Metaobject/2283413585696",
                "gid://shopify/Metaobject/228343546144",
                "gid://shopify/Metaobject/228343972128",
              ],
            },
          },

          {
            name: "Size",
            values: [
              { name: "50ml" },
              { name: "80ml" },
              { name: "100ml" },
            ],
          },

          {
            name: "Type",
            values: [
              { name: "Alcoholic" },
              { name: "Non-Alcoholic" },
            ],
          },
        ],
      },
    };

    const result = await graphql(
      createMutation,
      variables
    );

    const creation = result.productCreate;

    if (creation.userErrors.length > 0) {
      return res.status(400).json({
        success: false,
        userErrors: creation.userErrors,
      });
    }

    return res.status(200).json({
      success: true,
      alreadyExists: false,
      grantedScopes: tokenData.scope,
      product: creation.product,
    });
  } catch (error) {
    console.error("Metaobject linked product error:", error);

    return res.status(500).json({
      success: false,
      error: error.message || "Unknown error",
    });
  }
}
