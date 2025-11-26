const data = {
  type: "object",
  properties: {
    status: { type: "string" },
    segmentation: {
      output_shape: { type: "string" },
      views: {
        axial: {
          slice_index: { type: "number" },
          segmentation_url: { type: "string" },
        },
        coronal: {
          slice_index: { type: "number" },
          segmentation_url: { type: "string" },
        },
        sagittal: {
          slice_index: { type: "number" },
          segmentation_url: { type: "string" },
        },
      },
    },
    tumor_statistics: {
      total_voxels: { type: "number" },
      necrotic_core_voxels: { type: "number" },
      edema_voxels: { type: "number" },
      enhancing_tumor_voxels: { type: "number" },
      total_tumor_voxels: { type: "number" },
      tumor_percentage: { type: "float" },
    },
    tumor_classes: {
      "0": { type: "string" },
      "1": { type: "string" },
      "2": { type: "string" },
      "3": { type: "string" },
    },
    model_used: { type: "string" },
  },
};

const tumor_images = {
  type: "object",
  properties: {
    flair_url: { type: "string" },
    t1_url: { type: "string" },
    t1ce_url: { type: "string" },
    t2_url: { type: "string" },
  },
};
