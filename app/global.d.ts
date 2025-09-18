/// <reference types="react" />
/// <reference types="react-native" />

// This file contains important type declarations for the TypeScript compiler

declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV: 'development' | 'production' | 'test';
    EXPO_OS: 'ios' | 'android' | 'web';
  }
}

declare module '*.png' {
  const value: any;
  export default value;
}

declare module '*.jpg' {
  const value: any;
  export default value;
}

declare module '*.svg' {
  import React from 'react';
  import { SvgProps } from 'react-native-svg';
  const content: React.FC<SvgProps>;
  export default content;
}

// Add path alias support
declare module '@/*' {
  const value: any;
  export default value;
  export * from any;
}