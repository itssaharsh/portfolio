// stands in for next/link when a page of the desk is drawn in a test: a plain link
import { createElement } from "react";

export default function Link({ href, children, ...rest }) {
  return createElement("a", { href, ...rest }, children);
}
