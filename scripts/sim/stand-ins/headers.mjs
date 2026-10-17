// stands in for next/headers: one cookie jar for the life of the process, and a caller's address
const jar = new Map();
export const cookies = async () => ({
  get: (name) => (jar.has(name) ? { name, value: jar.get(name) } : undefined),
  set: (name, value) => { jar.set(name, value); },
  delete: (name) => { jar.delete(name); },
});
export const headers = async () => new Headers({ "x-forwarded-for": process.env.SIM_CALLER ?? "203.0.113.7" });
