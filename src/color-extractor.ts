const { rgb2lab, deltaE } = require('rgb-lab');


/**
 * Takes in an ImageData object and finds the k most dominant colors from
 * the image data. Also returns the number of pixels assoiated with each 
 * color's cluster. Dominant colors that are too close to colors in 
 * colorsToIgnore are ignored.
 * 
 * @param myData          ImageData generated from a HTML Canvas element
 * @param numClusters     Number of dominant colors to find
 * @param colorsToIgnore  Array of colors as RGB strings to ignore
 * @param threshold       Threshold for similarity in LAB color space
 *                        for ignoring dominant color
 */
export function getDominantColors(myData: ImageData, numClusters: number,
  colorsToIgnore: Array<string>, threshold: number): Array<any> {
  console.log(colorsToIgnore);
  let dataMap, keyArray, total;
  [dataMap, keyArray, total] = getDataMap(myData);

  let centerCandidates = getCenterCandidates(dataMap, keyArray, total);

  let centers = new Array<string>();
  let centerCounts, centerToColor;
  while (centers.length === 0) {
    [centers, centerCounts, centerToColor] = kMeans(numClusters, dataMap, centerCandidates);
    console.log(centers);
    [centers, centerCounts] = filterColors(centers, centerCounts, centerToColor, 
      colorsToIgnore, threshold);
    console.log(centers);
  }

  return [centers, centerCounts];
}

/**
 * Gets center candidates for performing k means on the data in dataMap.
 * Eliminates candidates if the count for a certain color is too low.
 * 
 * @param dataMap   Map from color to count of color in image.
 * @param keyArray  Array containing keys of dataMap in arbitrary order.
 * @param total     Total number of pixels from image used to make dataMap.
 */
function getCenterCandidates(dataMap: Map<string, number>, 
  keyArray: Array<string>, total: number) {
  let centerCandidates = [];
  const threshold = total / keyArray.length / 2 ;
  for (let i = 0; i < keyArray.length; i++) {
    const count = dataMap.get(keyArray[i]);
    if (count && count > threshold){
      centerCandidates.push(keyArray[i]);
    }
  }
  return centerCandidates;
}

/**
 * Filters out cluster centers that are too similar to the specified color.
 * Also converts center color to nearest color found in the image.
 * Returns array of valid centers and center counts for those centers.
 * 
 * @param centers         Array of colors that are centers.
 * @param centerCounts    Map from center to count of number of pixels.
 * @param centerToColor   Map from center to colors in center's cluster.
 */
function filterColors(centers: Array<string>,
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
      centers[i] = getImageColors(centerToColor, centers[i]);
    } else {
      centers.splice(i, 1);
      centerCounts.splice(i, 1);
    }
  }
  return [centers, centerCounts]
  }

/**
 * Converts an ImageData object into a map from colors to counts in the 
 * image. Also returns an array of all colors and the total number of pixels
 * in the image. 
 */
function getDataMap(myData: ImageData): Array<any> {
  let dataMap = new Map<string, number>();
  let keyArray: Array<string> = [];
  let total = 0;
  for (let i = 0; i < myData.data.length; i += 4) {
    if (myData.data[i + 3] > 0) {
      let r = myData.data[i].toString();
      while (r.length < 3) {
        r = '0' + r;
      }
      let g = myData.data[i + 1].toString();
      while (g.length < 3) {
        g = '0' + g;
      }
      let b = myData.data[i + 2].toString();
      while (b.length < 3) {
        b = '0' + b;
      }

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
 * Converts a center of a cluster generated from k means to the closest color
 * found in the image represented as a hex string.
 * @param centerToColor  Map from center color to all colors in cluster
 * @param color          Color of center to convert.
 */
function getImageColors(centerToColor: any, color: string): string {
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

/**
 * Performs k-means with points in color space. Points are represented in a
 * color to count map. Returns the centers of clusters, the number of points
 * in each cluster, and a map from centers to all colors in its cluster.
 */
function kMeans(numClusters: number, data: Map<string, number>, 
  keys: Array<string>): Array<any> {
  let centers = initializeCenters(numClusters, keys);
  let centerCounts, centerToColor;
  let oldCenters = centers.slice();
  while (true) {
    [centers, centerCounts, centerToColor] = updateCenters(centers, data, keys);
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
function initializeCenters(numClusters: number, keys: Array<string>):
  Array<string> {
  if (numClusters >= keys.length) {
    return keys;
  }
  let centers: Array<string> = [];
  let usedIndices = new Set<number>();
  while (centers.length < numClusters) {
    let index = Math.floor(Math.random() * keys.length);
    while (usedIndices.has(index)) {
      index = Math.floor(Math.random() * keys.length);
    }
    centers.push(keys[index]);
    usedIndices.add(index);
  }
  return centers;
}

/**
 * Updates centers for k means. First reassigns pixels to new clusters,
 * then recalculates cluster centers based on reassignments. Returns
 * new centers, counts for new centers, and a map from each center to
 * an array of the colors assigned to that center's cluster.
 * 
 * @param centers   Array of old centers.
 * @param data      Map from color to count of color in image.
 * @param keys      Array of all colors in image.
 */
function updateCenters(centers: Array<string>, data: Map<string, number>,
  keys: Array<string>): Array<any> {

  // calculate new clusters
  const pointToCenter = getNewClusters(keys, centers);

  // calculate new centers
  const [centerCounts, centerSums] = 
    getCenterStats(centers.length, keys, data, pointToCenter);
  const newCenters = getNewCenters(centerCounts, centerSums);

  // generate map from center to all colors in cluster
  let centerToColor: Map<string, Array<string>> = 
    new Map<string, Array<string>>();
  for (let i = 0; i < newCenters.length; i++) {
    centerToColor.set(newCenters[i], []);
  }
  for (let i = 0; i < keys.length; i++) {
    centerToColor.get(newCenters[pointToCenter[i]])?.push(keys[i]);
  }

  return [newCenters, centerCounts, centerToColor];
}

/**
 * Gets new cluster assignments based on colors and centers.
 * 
 * @param colors   Array of all colors.
 * @param centers  Array of current centers.
 */
function getNewClusters(colors: Array<string>, 
  centers: Array<string>): Array<number> {
  let pointToCenter: Array<number> = [];
  for (let i = 0; i < colors.length; i++) {
    let minDist = 100;
    let currCenter = 0;
    for (let j = 0; j < centers.length; j++ ) {
      const newDist = colorDistance(colors[i], centers[j]);
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
 * @param k              Number of centers
 * @param keys           Array of all colors in image.
 * @param data           Map from color to count of color in image.
 * @param pointToCenter  Array that indicates which center which color 
 *                       coresponds to. Same length as keys.
 */
function getCenterStats(numClusters: number, keys: Array<string>, 
  data: Map<string, number>, pointToCenter: Array<number>): Array<any> {
  let centerCounts: Array<number> = [];
  let centerSums: Array<Array<number>> = [];
  for (let i = 0 ; i < numClusters; i++) {
    centerCounts.push(0);
    centerSums.push([]);
    for (let j = 0; j < 3; j++) {
      centerSums[i].push(0);
    }
  }

  for (let i = 0; i < keys.length; i++) {
    const multiplier = data.get(keys[i]);
    if (multiplier) {
      centerSums[pointToCenter[i]][0] += parseInt(keys[i].slice(0,3)) * multiplier;
      centerSums[pointToCenter[i]][1] += parseInt(keys[i].slice(3,6)) * multiplier;
      centerSums[pointToCenter[i]][2] += parseInt(keys[i].slice(6)) * multiplier;
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
function getNewCenters(centerCounts: Array<number>, 
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

function rgbaToHex(rgba: Array<number>): string {
  const r = colorToString(rgba[0]);
  const g = colorToString(rgba[1]);
  const b = colorToString(rgba[2]);

  return '#' + r + g + b;
}

function colorToString(color: number): string {
  let string = (color * 255).toString(16);
  if (string.length === 1) {
    string = '0' + string;
  } else if (string.length > 2) {
    string = string.slice(0, 2);
  }
  return string;
}