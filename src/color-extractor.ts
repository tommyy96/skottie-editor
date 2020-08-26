const { rgb2lab, deltaE } = require('rgb-lab');

/**
 * Finds the dominant colors of a certain image. An ImageData object of that 
 * image is required to construct a dominantColorComputer object. Each instance
 * can get dominant colors of the image by using getDominantColors. Dominant 
 * colors are found by running k means on the colors in the image. Dominant 
 * colors that are too close to certain specified colors are filtered out 
 * before the dominant colors are returned.
 */
export class DominantColorComputer {
  private colorFilter: ColorFilter;
  private kMeansCalculator: KMeansCalculator

  constructor(data: ImageData) {
    const [dataMap, keyArray, pixelCount] = this.getDataMap(data);
    this.colorFilter = new ColorFilter();
    this.kMeansCalculator = new KMeansCalculator(dataMap, keyArray, pixelCount);
  }

  /**
   * Takes in an ImageData object and finds the k most dominant colors from
   * the image data. Also returns the number of pixels assoiated with each 
   * color's cluster. Dominant colors that are too close to colors in 
   * colorsToIgnore are ignored.
   * 
   * @param numClusters     Number of dominant colors to find
   * @param colorsToIgnore  Array of colors as rgb strings to ignore
   *                        Format of rgb strings is [red][green][blue],
   *                        where [red], [green], and [blue] are the values
   *                        of the red, green, and blue channels represented as
   *                        strings. Values range from 0 to 255 and are padded
   *                        with zeros in the front so each channel value has
   *                        length 3, and the rgb string has length 9.
   * @param threshold       Threshold for similarity in LAB color space
   *                        for ignoring dominant color
   */
  getDominantColors(numClusters: number, colorsToIgnore: Array<string>,
    threshold: number): Array<any> {
    let centers = new Array<string>();
    let centerCounts, centerToColor;
    while (centers.length === 0) {
      [centers, centerCounts, centerToColor] = this.kMeansCalculator.kMeans(numClusters);
      console.log(centers);
      [centers, centerCounts] = this.colorFilter.filterColors(centers, centerCounts, centerToColor, 
        colorsToIgnore, threshold);
      console.log(centers);
    }

    return [centers, centerCounts];
  }

  /**
   * Converts an ImageData object into a map from colors to counts in the 
   * image. Also returns an array of all colors and the total number of pixels
   * in the image. 
   */
  private getDataMap(myData: ImageData): Array<any> {
    let dataMap = new Map<string, number>();
    let keyArray = new Array<string>();
    let total = 0;
    const numColorChannels = 4;

    for (let i = 0; i < myData.data.length; i += numColorChannels) {
      if (myData.data[i + 3] > 0) {
        const r = this.padColorString(myData.data[i].toString());
        const g = this.padColorString(myData.data[i + 1].toString());
        const b = this.padColorString(myData.data[i + 2].toString());

        const key = r + g + b;
        const count = dataMap.get(key);
        if (count) {
          dataMap.set(key, count + 1);
        } else {
          dataMap.set(key, 1);
          keyArray.push(key);
        }
        total++;
      }
    }
    return [dataMap, keyArray, total]
  }

  /**
   * Pads a number string with zeros to be length 3.
   * 
   * @param channel  Number string representing one RGB channel, 
   *                 values from 0 to 255.
   */
  private padColorString(channel: string) {
    while (channel.length < 3) {
      channel = '0' + channel;
    }
    return channel;
  }
}

/**
 * Runs k-means on image data. Each instance requires the image data, 
 * represented as a map from rgb color strings to their count in the image,
 * an array of all color strings in the map, and a number representing the 
 * total number of pixels in the image. The standard k-means algorithm is run,
 * with centers initialized randomly from colors within the image. Clusters are
 * then found for each center, after which centers are recalculated for each 
 * center. This repeats until the centers converge. Convergence is defined by
 * the array of centers not changing in two consecutive update cycles.
 */
class KMeansCalculator {
  private data: Map<string, number>;
  private keys: Array<string>;
  private pixelCount: number;

  constructor(data: Map<string, number>, keyArray: Array<string>, pixelCount: number) {
    this.data = data;
    this.keys = keyArray;
    this.pixelCount = pixelCount;
  }
  
  /**
   * Performs k-means with points in color space. Points are represented in a
   * color to count map. Returns the centers of clusters, the number of points
   * in each cluster, and a map from centers to all colors in its cluster.
   */
  kMeans(numClusters: number): Array<any> {
    let centers = this.initializeCenters(numClusters);
    let centerCounts, centerToColor;
    let oldCenters = centers.slice();
    while (true) {
      [centers, centerCounts, centerToColor] = this.updateCenters(centers);
      if (arraysEqual(centers, oldCenters)) {
        break;
      }
      oldCenters = centers.slice();
    }
    return [centers, centerCounts, centerToColor];
  }

  /**
   * Randomly initializes centers for k-means algorithm. Chooses k random 
   * colors from an array of possible colors to be intial centers.
   */
  private initializeCenters(numClusters: number): Array<string> {
    const centerCandidates = this.getCenterCandidates();
    if (numClusters >= centerCandidates.length) {
      return centerCandidates;
    }
    let centers = new Array<string>();
    let usedIndices = new Set<number>();
    while (centers.length < numClusters) {
      let index = Math.floor(Math.random() * centerCandidates.length);
      while (usedIndices.has(index)) {
        index = Math.floor(Math.random() * centerCandidates.length);
      }
      centers.push(centerCandidates[index]);
      usedIndices.add(index);
    }
    return centers;
  }

  /**
   * Gets center candidates for performing k means on the data.
   * Eliminates candidates if the count for a certain color is too low.
   */
  private getCenterCandidates(): Array<string> {
    let centerCandidates = new Array<string>();
    const threshold = this.pixelCount / this.keys.length / 2 ;
    for (let i = 0; i < this.keys.length; i++) {
      const count = this.data.get(this.keys[i]);
      if (count && count > threshold){
        centerCandidates.push(this.keys[i]);
      }
    }
    return centerCandidates;
  }

  /**
   * Updates centers for k means. First reassigns pixels to new clusters,
   * then recalculates cluster centers based on reassignments. Returns
   * new centers, counts for new centers, and a map from each center to
   * an array of the colors assigned to that center's cluster.
   * 
   * @param centers   Array of old centers.
   */
  private updateCenters(centers: Array<string>): Array<any> {
    // calculate new clusters
    const pointToCenter = this.getNewClusters(centers);

    // calculate new centers
    const [centerCounts, centerSums] = 
      this.getCenterStats(centers.length, pointToCenter);
    const newCenters = this.getNewCenters(centerCounts, centerSums);

    // generate map from center to all colors in cluster
    let centerToColor: Map<string, Array<string>> = 
      new Map<string, Array<string>>();
    for (let i = 0; i < newCenters.length; i++) {
      centerToColor.set(newCenters[i], []);
    }
    for (let i = 0; i < this.keys.length; i++) {
      centerToColor.get(newCenters[pointToCenter[i]])?.push(this.keys[i]);
    }

    return [newCenters, centerCounts, centerToColor];
  }

  /**
   * Gets new cluster assignments based on colors and centers.
   * 
   * @param centers  Array of current centers.
   */
  private getNewClusters(centers: Array<string>): Array<number> {
    let pointToCenter: Array<number> = [];
    for (let i = 0; i < this.keys.length; i++) {
      let minDist = 100;
      let currCenter = 0;
      for (let j = 0; j < centers.length; j++ ) {
        const newDist = colorDistance(this.keys[i], centers[j]);
        if (newDist < minDist) {
          minDist = newDist;
          currCenter = j;
        }
      }
      pointToCenter.push(currCenter);
    }
    return pointToCenter
  }
  
  /**
   * Gets size of each cluster as well as the sum of all pixel colors of each 
   * cluster represented as an array of rgb array.
   * 
   * @param numClusters    Number of clusters
   * @param pointToCenter  Array that indicates which center which color 
   *                       coresponds to. Same length as keys.
   */
  private getCenterStats(numClusters: number, 
    pointToCenter: Array<number>): Array<any> {
    let centerCounts: Array<number> = [];
    let centerSums: Array<Array<number>> = [];
    for (let i = 0 ; i < numClusters; i++) {
      centerCounts.push(0);
      centerSums.push([]);
      for (let j = 0; j < 3; j++) {
        centerSums[i].push(0);
      }
    }

    for (let i = 0; i < this.keys.length; i++) {
      const multiplier = this.data.get(this.keys[i]);
      if (multiplier) {
        centerSums[pointToCenter[i]][0] += parseInt(this.keys[i].slice(0,3)) * multiplier;
        centerSums[pointToCenter[i]][1] += parseInt(this.keys[i].slice(3,6)) * multiplier;
        centerSums[pointToCenter[i]][2] += parseInt(this.keys[i].slice(6)) * multiplier;
        centerCounts[pointToCenter[i]] += multiplier;
      }
    }

    for (let i = 0; i < centerCounts.length; i++) {
      for (let j = 0; j < 3; j++) {
        centerSums[i][j] = Math.round(centerSums[i][j] / centerCounts[i]);
      }
    }
    return [centerCounts, centerSums];
  }

  /**
   * Gets new centers based on count of pixels per center and sum of pixel 
   * colors per center. Returns array of new centers represented as hex 
   * strings.
   */
  private getNewCenters(centerCounts: Array<number>, 
    centerSums: Array<Array<number>>): Array<string> {
    let newCenters: Array<string> = [];
    for (let i = 0; i < centerCounts.length; i++) {
      let r = centerSums[i][0].toString();
      while (r.length < 3) {
        r = '0' + r;
      }
      let g = centerSums[i][1].toString();
      while (g.length < 3) {
        g = '0' + g;
      }
      let b = centerSums[i][2].toString();
      while (b.length < 3) {
        b = '0' + b;
      }
      newCenters.push(r + g + b);
    }
    return newCenters;
  }
}

/**
 * Filters out colors that are too close to specified colors. Used after 
 * running k-means in a color space, so centers are also changed to their
 * closest counterparts by lab color distance found in the image. 
 */
class ColorFilter {
  /**
   * Filters out cluster centers that are too similar to the specified colors.
   * Also converts center color to nearest color found in the image.
   * Returns array of valid centers and center counts for those centers.
   * 
   * @param centers         Array of colors that are centers.
   * @param centerCounts    Map from center to count of number of pixels.
   * @param centerToColor   Map from center to colors in center's cluster.
   * @param threshold       Threshold for similarity in LAB color space
   *                        to filter out a dominant color.
   */
  filterColors(centers: Array<string>,
    centerCounts: Array<number>,
    centerToColor: Map<string, Array<string>>,
    colorsToIgnore: Array<string>, threshold: number): Array<any> {
    console.log(colorsToIgnore);
    for (let i = centers.length - 1; i >= 0; i--) {
      let deleteThis = false;
      for (let j = 0; j < colorsToIgnore.length && !deleteThis; j++) {
        if (colorDistance(colorsToIgnore[j], centers[i]) <= threshold) {
          deleteThis = true;
        }
      }
      if (!deleteThis) {
        centers[i] = this.getImageColors(centerToColor, centers[i]);
      } else {
        centers.splice(i, 1);
        centerCounts.splice(i, 1);
      }
    }
    return [centers, centerCounts]
  }

  /**
   * Converts a center of a cluster generated from k means to the closest color
   * found in the image represented as a hex string.
   * 
   * @param centerToColor  Map from center color to all colors in cluster
   * @param color          Color of center to convert.
   */
  private getImageColors(centerToColor: any, color: string): string {
    const colorArray = centerToColor.get(color)
    let minDistColor = '';
    if (colorArray) {
      let minDist = deltaE(rgb2lab([0, 0, 0]), rgb2lab([255, 255, 255]));
      for (let i = 0; i < colorArray.length; i++) {
        const newDist = colorDistance(colorArray[i], color);
        if (newDist < minDist) {
          minDist = newDist;
          minDistColor = colorArray[i];
        }
      }
      minDistColor = rgbaToHex([parseInt(minDistColor.slice(0,3)) / 255,
        parseInt(minDistColor.slice(3,6)) / 255,
        parseInt(minDistColor.slice(6)) / 255]);
    }
    return minDistColor;
  }
}

/**
 * Checks if two string arrays have the same elements in every spot. 
 */
function arraysEqual(array1: Array<string>, array2: Array<string>): boolean {
  if (array1 === array2) {
    return true;
  } else if (!array1 || !array2 || array1.length !== array2.length) {
    return false;
  }

  for (let i = 0; i < array1.length; i++) {
    if (array1[i] !== array2[i]) {
      return false;
    }
  }

  return true;
}

/**
 * Gets the lab color distance between two RGB color strings.
 */
function colorDistance(color1: string, color2: string): number {
  const labColor1 = rgb2lab([parseInt(color1.slice(0,3)), 
    parseInt(color1.slice(3,6)), parseInt(color1.slice(6))]);
  const labColor2 = rgb2lab([parseInt(color2.slice(0,3)),
    parseInt(color2.slice(3,6)), parseInt(color2.slice(6))]);
  return deltaE(labColor1, labColor2);
}

/**
 * Converts a rgba number array into a hex string.
 * 
 * @param rgba  Array of length 3 or 4, values in range [0,1]
 *              0 maps to 0, 1 maps to 255 in standard rgb represenations
 */
function rgbaToHex(rgba: Array<number>): string {
  const r = colorToString(rgba[0]);
  const g = colorToString(rgba[1]);
  const b = colorToString(rgba[2]);

  return '#' + r + g + b;
}

/**
 * Converts a rgb channel into its hex value as a string.
 * 
 * @param channel  Number between 0 and 1. 0 maps to 0, 
 *                 1 maps to 255 in standard rgb representations.
 */
function colorToString(color: number): string {
  let string = (color * 255).toString(16);
  if (string.length === 1) {
    string = '0' + string;
  } else if (string.length > 2) {
    string = string.slice(0, 2);
  }
  return string;
}