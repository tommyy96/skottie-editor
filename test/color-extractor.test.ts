import { DominantColorComputer } from '../src/color-extractor';
const ImageData = require('@canvas/image-data')

describe('getDominantColors', () => {
  it('1 color, 1 center', () => {
    // creating an array with just red pixels (#ff0000)
    let array = new Uint8ClampedArray(160000);
    for (let i = 0; i < array.length; i += 4) {
      array[i + 0] = 255;
      array[i + 1] = 0;
      array[i + 2] = 0;
      array[i + 3] = 255;
    }
    const imageData = new ImageData(array, 200);

    const dominantColorComputer = new DominantColorComputer(imageData);
    const numClusters = 1;
    const [centers,] = 
    dominantColorComputer.getDominantColors(numClusters, [], 0);
    expect(centers.length).toBe(numClusters);
    expect(centers[0]).toBe('#ff0000');
  });
  it('2 colors, 2 centers', () => {
    // creating an array with red and green pixels (#ff0000)
    let array = new Uint8ClampedArray(160000);
    for (let i = 0; i < array.length / 2; i += 4) {
      array[i + 0] = 255;
      array[i + 1] = 0;
      array[i + 2] = 0;
      array[i + 3] = 255;
    }
    for (let i = array.length / 2; i < array.length; i += 4) {
      array[i + 0] = 0;
      array[i + 1] = 255;
      array[i + 2] = 0;
      array[i + 3] = 255;
    }
    const imageData = new ImageData(array, 200);

    const dominantColorComputer = new DominantColorComputer(imageData);
    const numClusters = 2;
    const [centers,] = 
    dominantColorComputer.getDominantColors(numClusters, [], 0);
    expect(centers.length).toBe(numClusters);
    expect(centers).toContain('#ff0000');
    expect(centers).toContain('#00ff00');
  });
  it('Stress test, centers are colors in image', () => {
    let array = new Uint8ClampedArray(640000);
    let colors = [];
    for (let mult = 0; mult < 8; mult++) {
      for (let i = mult * (array.length / 8); 
          i < (mult + 1) * (array.length / 8);
          i += 4) {
        array[i + 0] = Math.floor(Math.random() * 32) + 32 * mult;
        array[i + 1] = Math.floor(Math.random() * 32) + 32 * mult;
        array[i + 2] = Math.floor(Math.random() * 32) + 32 * mult;
        array[i + 3] = 255;
        colors.push('#' + array[i].toString(16)
                        + array[i + 1].toString(16)
                        + array[i + 2].toString(16));
      }
    }
    const imageData = new ImageData(array, 200);

    const dominantColorComputer = new DominantColorComputer(imageData);
    const numClusters = 4;
    const [centers,] = 
    dominantColorComputer.getDominantColors(numClusters, [], 0);
    expect(centers.length).toBe(numClusters);
    for (let i = 0; i < centers.length; i++) {
      expect(colors).toContain(centers[i]);
    }
  });
  it('Centers too close to ignored colors are ignored', () => {
    // creating an array with black and blue pixels (#ff0000)
    let array = new Uint8ClampedArray(160000);
    for (let i = 0; i < array.length / 2; i += 4) {
      array[i + 0] = 0;
      array[i + 1] = 0;
      array[i + 2] = 0;
      array[i + 3] = 255;
    }
    for (let i = array.length / 2; i < array.length; i += 4) {
      array[i + 0] = 0;
      array[i + 1] = 0;
      array[i + 2] = 255;
      array[i + 3] = 255;
    }
    const imageData = new ImageData(array, 200);

    const dominantColorComputer = new DominantColorComputer(imageData);
    const numClusters = 2;
    const black = '000000000';
    const [centers,] = 
    dominantColorComputer.getDominantColors(numClusters, [black], 0);
    expect(centers.length).toBe(numClusters - 1);
    expect(centers).not.toContain('#000000');
    expect(centers).toContain('#0000ff');
  });
});