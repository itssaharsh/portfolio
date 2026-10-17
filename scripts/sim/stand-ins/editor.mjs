// stands in for app/admin/Editor.tsx when a page of the desk is drawn in a test. The editor
// itself is run in a browser by scripts/desk-editor.test.mjs. Here it only shows that it was
// asked for, and a test reads what the page handed it off the element the page built.
import { createElement } from "react";

export default function Editor() {
  return createElement("p", null, "[the editor]");
}
