import React from 'react';

import { StrokeIcon } from './Icon';

export default (props) => (
  <StrokeIcon {...props}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5"
    />
  </StrokeIcon>
);
