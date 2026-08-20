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

    // 2. Link the existing Fragrance option to the
    //    custom.fragrance_catalog metafield and map
    //    each option value to its Fragrance Metaobject.
    const mutation = `
      mutation LinkFragranceOption(
        $productId: ID!
        $option: OptionUpdateInput!
        $optionValuesToUpdate: [OptionValueUpdateInput!]
      ) {
        productOptionUpdate(
          productId: $productId
          option: $option
          optionValuesToUpdate: $optionValuesToUpdate
        ) {
          userErrors {
            field
            message
            code
          }

          product {
            id
            title

            metafield(
              namespace: "custom"
              key: "fragrance_catalog"
            ) {
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
          }
        }
      }
    `;

    const variables = {
      productId: "gid://shopify/Product/10553670140192",

      option: {
        id: "gid://shopify/ProductOption/13281470054688",
        linkedMetafield: {
          namespace: "custom",
          key: "fragrance_catalog",
        },
      },

      optionValuesToUpdate: [
        {
          id: "gid://shopify/ProductOptionValue/6927776383264",
          linkedMetafieldValue:
            "gid://shopify/Metaobject/227582804256",
        },
        {
          id: "gid://shopify/ProductOptionValue/6927776481032",
          linkedMetafieldValue:
            "gid://shopify/Metaobject/228342759712",
        },
        {
          id: "gid://shopify/ProductOptionValue/6927776481568",
          linkedMetafieldValue:
            "gid://shopify/Metaobject/228341358569",
        },
        {
          id: "gid://shopify/ProductOptionValue/6927776554336",
          linkedMetafieldValue:
            "gid://shopify/Metaobject/228343546144",
        },
        {
          id: "gid://shopify/ProductOptionValue/6927776559872",
          linkedMetafieldValue:
            "gid://shopify/Metaobject/228343972128",
        },
      ],
    };

    // 3. Execute mutation
    const shopifyResponse = await fetch(
      `https://${process.env.SHOPIFY_STORE_DOMAIN}/admin/api/2026-07/graphql.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": tokenData.access_token,
        },
        body: JSON.stringify({
          query: mutation,
          variables,
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

    const result = shopifyData.data.productOptionUpdate;

    return res.status(200).json({
      success: result.userErrors.length === 0,
      userErrors: result.userErrors,
      product: result.product,
    });
  } catch (error) {
    console.error("Fragrance option linking error:", error);

    return res.status(500).json({
      success: false,
      error: error.message || "Unknown error",
    });
  }
}
