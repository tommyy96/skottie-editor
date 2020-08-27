const bodyPix = require('@tensorflow-models/body-pix');

export class BodySegmenter {
  private net: any;

  constructor() {
    this.loadNet();
  }

  async segmentPerson(image: 
    ImageData|HTMLImageElement|HTMLCanvasElement|HTMLVideoElement) {
    const segmentation = await this.net.segmentPerson(image, {
      internalResolution: 'full'
    });
    return segmentation.data;
  }

  private async loadNet() {
    this.net = await bodyPix.load({
      architecture: 'ResNet50',
      outputStride: 16,
      quantBytes: 4
    });
    console.log('loaded');
  }
}