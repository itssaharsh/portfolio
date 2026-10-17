// stands in for app/admin/login/page.tsx when a page of the desk is drawn in a test: the pages
// of the desk draw the sign in in their own place for someone who is signed out
import { createElement } from "react";

export default function Login() {
  return createElement("p", null, "[the sign in]");
}
