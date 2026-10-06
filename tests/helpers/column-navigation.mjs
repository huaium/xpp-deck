import { loadFunctions } from "./source.mjs";

export const { column_navigation_url } = loadFunctions(
    "../src/content/column-navigation.ts",
    ["column_navigation_url"],
);
