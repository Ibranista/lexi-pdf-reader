declare let module: NodeJS.NodeModule;

declare namespace __MetroModuleApi {
  type RequireContext = {
    keys(): string[];
    (id: string): unknown;
    (id: string): unknown;
    id: string;
    resolve(id: string): string;
  };

  type RequireFunction = {
    (path: string): unknown;
    (path: string): unknown;

    context(
      path: string,
      recursive?: boolean,
      filter?: RegExp,
      mode?: 'eager' | 'lazy-once' | 'lazy' | 'sync' | 'weak',
    ): RequireContext;
  };
}

declare namespace NodeJS {
  type Require = __MetroModuleApi.RequireFunction & {};
}
declare let process: NodeJS.Process;

declare module '*.png';

declare module '*.svg' {
  import type React from 'react';
  import type { SvgProps } from 'react-native-svg';

  const content: React.FC<SvgProps>;
  export default content;
}
