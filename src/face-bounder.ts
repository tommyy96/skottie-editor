const blazeface = require('@tensorflow-models/blazeface');

/**
 * Wrapper class for Blazeface model. 
 * https://github.com/tensorflow/tfjs-models/tree/master/blazeface
 */
export class FaceBounder {
  private model: any;

  constructor() {
    this.loadModel();
  }

  /**
   * Gets bounds of faces in the provided image. Returns an array of 
   * NormalizedFace objects. More info about the NormalizedFace interface can
   * be found at:
   * https://github.com/tensorflow/tfjs-models/blob/33c84070b80c8b48826a77f8490a5fb7a82fc983/blazeface/src/face.ts#L26
   */
  async getFaceBounds(image: ImageData|HTMLVideoElement|HTMLImageElement|
    HTMLCanvasElement) {
    return await this.model.estimateFaces(image, false);
  }

  /**
   * Loads the Blazeface model.
   */
  private async loadModel() {
    this.model = await blazeface.load();
  }

}