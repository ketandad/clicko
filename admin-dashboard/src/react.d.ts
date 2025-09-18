declare module 'react' {
  import * as React from 'react';
  export = React;
  export as namespace React;
  export const useState: any;
  export const useEffect: any;
}
declare module '*.tsx';
declare module '@mui/material';
