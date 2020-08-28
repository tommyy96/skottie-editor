const bodyPix = require('@tensorflow-models/body-pix');

/**
 * Wrapper class for BodyPix model.
 */
export class BodySegmenter {
  private net: any;

  constructor() {
    this.loadNet();
  }

  /**
   * Performs body segmentation on the given image. Returns a binary mask
   * indicating if a pixel contains a body or not.
   */
  async segmentPerson(image: 
    ImageData|HTMLImageElement|HTMLCanvasElement|HTMLVideoElement) {
    const segmentation = await this.net.segmentPerson(image, {
      internalResolution: 'full'
    });
    return segmentation.data;
  }

  /**
   * Loads the BodyPix net.
   */
  private async loadNet() {
    this.net = await bodyPix.load({
      architecture: 'ResNet50',
      outputStride: 16,
      quantBytes: 4
    });
  }
}