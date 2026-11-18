import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("products/:handle", "routes/product.tsx"),
  route("collections", "routes/collections.tsx"),
  route("collections/:handle", "routes/collection.tsx"),
  route("cart", "routes/cart.tsx"),
  route("search", "routes/search.tsx"),
  route("account", "routes/account.tsx"),
  route("assistant", "routes/assistant.tsx"),
  route("assistant/chat", "routes/assistant.chat.tsx"),
  route("assistant/mcp", "routes/assistant.mcp.tsx"),
  route("*", "routes/catchall.tsx"),
] satisfies RouteConfig;
