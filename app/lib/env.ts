import { createContext } from "react-router";

export type Env = {
  ANTHROPIC_API_KEY?: string;
  ASSISTANT_PROVIDER?: string;
  ASSISTANT_MODEL?: string;
  ASSISTANT_BASE_URL?: string;
  ASSISTANT_API_KEY?: string;
  MOCK_SHOP?: string;
  PRIVATE_ADMIN_ACCESS_TOKEN?: string;
  PRIVATE_STOREFRONT_API_TOKEN?: string;
  SHOP_THEME_ID?: string;
  PUBLIC_CHECKOUT_DOMAIN?: string;
  PUBLIC_STORE_DOMAIN?: string;
  PUBLIC_STOREFRONT_ID?: string;
  PUBLIC_CUSTOMER_ACCOUNT_API_CLIENT_ID?: string;
  SESSION_SECRET?: string;
  SHOP_ID?: string;
};

export const envContext = createContext<Env>();
