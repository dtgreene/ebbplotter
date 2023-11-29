export const layoutSchema = {
  properties: {
    data: { type: 'string' },
    dimensions: {
      properties: {
        width: {
          type: 'float32',
        },
        height: {
          type: 'float32',
        },
      },
    },
    margins: {
      properties: {
        top: {
          type: 'float32',
        },
        right: {
          type: 'float32',
        },
        bottom: {
          type: 'float32',
        },
        left: {
          type: 'float32',
        },
      },
    },
    alignment: {
      type: 'uint16',
    },
    rotation: {
      type: 'float32',
    },
    useBoundingBox: {
      type: 'boolean',
    },
    optimizations: {
      properties: {
        merge: {
          type: 'boolean',
        },
        mergeDistance: {
          type: 'float32',
        },
        removeShort: {
          type: 'boolean',
        },
        removeShortDistance: {
          type: 'float32',
        },
        reorder: {
          type: 'boolean',
        },
        randomizeStart: {
          type: 'boolean',
        },
        randomizeStartTolerance: {
          type: 'float32',
        },
      },
    },
    excludeIds: {
      elements: {
        type: 'string',
      },
    },
  },
};
