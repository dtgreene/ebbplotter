import React from 'react';

import { StrokeIcon } from './Icon';

export default (props) => (
  <StrokeIcon {...props}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M6 18L18 6M6 6l12 12"
    />
  </StrokeIcon>
);
