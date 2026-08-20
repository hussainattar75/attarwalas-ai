export default async function handler(req, res) {
  try {
    const SHOPIFY_API = `https://${process.env.SHOPIFY_STORE_DOMAIN}/admin/api/2026-07/graphql.json`;

    // ------------------------------------------------------------
    // 1. Get Shopify access token
    // ------------------------------------------------------------
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

    async function shopifyGraphQL(query, variables = {}) {
      const response = await fetch(SHOPIFY_API, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": tokenData.access_token,
        },
        body: JSON.stringify({
          query,
          variables,
        }),
      });

      const data = await response.json();

      if (!response.ok || data.errors) {
        throw new Error(JSON.stringify(data, null, 2));
      }

      return data.data;
    }

    // ------------------------------------------------------------
    // 2. Read the current TEST product and its actual option IDs
    // ------------------------------------------------------------
    const lookupQuery = `
      query {
        products(
          first: 1
          query: "title:'Customize Perfume Test'"
        ) {
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
                hasVariants
                linkedMetafieldValue
              }
            }
          }
        }
      }
    `;

    const lookupData = await shopifyGraphQL(lookupQuery);

    const product = lookupData.products.nodes[0];

    if (!product) {
      return res.status(404).json({
        success: false,
        error: "Customize Perfume Test product not found.",
      });
    }

    const fragranceOption = product.options.find(
      (option) =>
        option.name.toLowerCase().includes("fragrance")
    );

    if (!fragranceOption) {
      return res.status(400).json({
        success: false,
        error: "Fragrance option not found.",
        options: product.options,
      });
    }

    // ------------------------------------------------------------
    // 3. Map the current Shopify option values to Metaobjects
    //    by DISPLAY NAME, not by hard-coded option IDs.
    // ------------------------------------------------------------
    const fragranceMap = {
      "ATTARWALAS Sauvage Inspired (Masculine)":
        "gid://shopify/Metaobject/227582804256",

      "ATTARWALAS Bleu Inspired (Masculine)":
        "gid://shopify/Metaobject/228342759712",

      "ATTARWALAS Eros Inspired (Masculine)":
        "gid://shopify/Metaobject/228343972128",

      "ATTARWALAS Oud Wood Inspired (Unisex)":
        "gid://shopify/Metaobject/228343185696",

      "ATTARWALAS Ombre Leather Inspired (Unisex)":
        "gid://shopify/Metaobject/228343546144",
    };

    const missingNames = [];
    const optionValuesToUpdate = [];

    for (const optionValue of fragranceOption.optionValues) {
      const metaobjectId = fragranceMap[optionValue.name];

      if (!metaobjectId) {
        missingNames.push(optionValue.name);
        continue;
      }

      optionValuesToUpdate.push({
        id: optionValue.id,
        linkedMetafieldValue: metaobjectId,
      });
    }

    if (missingNames.length > 0) {
      return res.status(400).json({
        success: false,
        error: "Some Shopify fragrance option names could not be matched.",
        missingNames,
        currentOptionValues: fragranceOption.optionValues,
      });
    }

    if (
      optionValuesToUpdate.length !==
      fragranceOption.optionValues.length
    ) {
      return res.status(400).json({
        success: false,
        error: "Not every existing fragrance option value was mapped.",
        optionValuesToUpdate,
        currentOptionValues: fragranceOption.optionValues,
      });
    }

    // ------------------------------------------------------------
    // 4. Link the existing Shopify option to the Metaobject metafield
    // ------------------------------------------------------------
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
          }
        }
      }
    `;

    const variables = {
      productId: product.id,

      option: {
        id: fragranceOption.id,
        linkedMetafield: {
          namespace: "custom",
          key: "fragrance_catalog",
        },
      },

      optionValuesToUpdate,
    };

    const result = await shopifyGraphQL(
      mutation,
      variables
    );

    const updateResult = result.productOptionUpdate;

    return res.status(200).json({
      success: updateResult.userErrors.length === 0,
      userErrors: updateResult.userErrors,
      linkedOption: updateResult.product?.options?.find(
        (option) => option.id === fragranceOption.id
      ),
    });
  } catch (error) {
    console.error("Fragrance linking error:", error);

    return res.status(500).json({
      success: false,
      error: error.message || "Unknown error",
    });
  }
}
