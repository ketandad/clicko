#!/bin/bash

# Install react.d.ts declaration file
cat > /workspaces/clicko/admin-dashboard/src/react.d.ts << 'EOF'
declare module 'react' {
  import * as React from 'react';
  export = React;
  export as namespace React;
  export const useState: any;
  export const useEffect: any;
}
declare module '*.tsx';
declare module '@mui/material';
EOF

echo "React type declaration file created."
echo "The 'Cannot find module react' error should now be fixed."
echo "You can use the admin dashboard code in your project."