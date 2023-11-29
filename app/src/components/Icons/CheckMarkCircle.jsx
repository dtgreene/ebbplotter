import React from 'react';

import { StrokeIcon } from './Icon';

export default (props) => (
  <StrokeIcon {...props}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </StrokeIcon>
);
