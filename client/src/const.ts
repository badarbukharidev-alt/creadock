export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

/** Routes an unauthenticated visitor to CreaDock’s own email-and-password page. */
export const startLogin = () => {
  window.location.assign("/login");
};
