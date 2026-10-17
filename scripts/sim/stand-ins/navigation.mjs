// stands in for next/navigation. like the real ones, neither of these comes back: they throw,
// and whatever called them stops there. Next catches the real ones and sends the browser on.
// here a test catches them and looks at where to.
export class Redirect extends Error {
  constructor(to) {
    super(`sent on to ${to}`);
    this.to = to;
  }
}
export class NotFound extends Error {
  constructor() {
    super("not found");
  }
}
export const redirect = (to) => { throw new Redirect(to); };
export const notFound = () => { throw new NotFound(); };
