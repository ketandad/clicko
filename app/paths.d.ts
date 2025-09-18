// This file defines path aliases for TypeScript
declare module '@/*' {
  const value: any;
  export default value;
  export * from any;
}
