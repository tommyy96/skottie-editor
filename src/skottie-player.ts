/**
 * skottie-player.ts
 */

import {css, customElement, html, LitElement, property, TemplateResult} from 'lit-element';
import JSONEditor, {JSONEditorOptions} from 'jsoneditor';

const rgbToHsv = require('rgb-hsv');
const hsvToRgb = require('hsv-rgb');
const { rgb2lab, lab2rgb, deltaE } = require('rgb-lab');
const SkottieKitInit = require('skottiekit-wasm/bin/skottiekit.js');
const loadKit = SkottieKitInit({
  locateFile: (file: string) => '/node_modules/skottiekit-wasm/bin/'+file,
});


/**
 * Layer types:
 * 0 - Precomp
 * 1 - Solid
 * 2 - Image
 * 3 - Null
 * 4 - Shape
 * 5 - Text
 */
interface Layer {
  /** layer type */
  ty?: number;
  /** transform object */
  ks?: any;
  /** auto-orient boolean */
  ao?: number; 
  /** blend mode type */
  bm?: number; 
  /** 3d layer boolean */
  ddd?: number;
  /** layer index */
  ind?: number;
  /** html class */
  cl?: string;
  /** html id */
  ln?: string;
  /** in point */
  ip?: number;
  /** out point */
  op?: number;
  /** start time */
  st?: number;
  /** name */
  nm?: string;
  /** has mask boolean */
  hasMask?: number;
  /** mask properties */
  masksProperties?: Array<any>;
  /** effects */
  ef?: Array<any>;
  /** stretch */
  sr?: number;
  /** parent layer index */
  parent?: number;
  /** shapes */
  shapes?: Array<any>;
  /** color of solid*/
  sc?: string;
  /** height of solid */
  sh?: number;
  /** width of solid */
  sw?: number;
  /** reference ID */
  refID?: string;
  /** time remapping */
  tm?: any;
  /** text */
  t?: any;
}

interface LottieFile {
  /** in point */
  ip?: number;
  /** out point */
  op?: number;
  /** frame rate */
  fr?: number;
  /** width */
  w?: number;
  /** height */
  h?: number;
  /** 3d layer boolean */
  ddd?: number;
  /** bodymovin version */
  v?: string;
  /** name */
  nm?: string;
  /** layers array */
  layers?: Array<Layer>;
  /** assets array */
  assets?: Array<any>;
  /** fonts object */
  fonts?: any;
  /** characters array */
  chars?: Array<any>;
}

@customElement('skottie-player')
export class SkottiePlayer extends LitElement {
  static get styles() {
    return css`
      .active, .layerbutton:hover {
        background-color: #ccc;
      }

      .content {
        padding: 0 18px;
        background-color: #f1f1f1;
      }

      :host {
        display: block;
        border: solid 1px gray;
        padding: 16px;
        max-width: 100%;
        font-family: sans-serif;
      }

      .layerbutton {
        background-color: #eee;
        color: #444;
        cursor: pointer;
        padding: 18px;
        width: 100%;
        border: 1px solid;
        text-align: left;
        outline: none;
        font-size: 15px;
      }
    `;
  }

  /**
   * The title of the json file. This is displayed above the animation.
   */
  @property({type: String})
  title = 'Select a file';

  /**
   * The content of the json file.
   */
  @property({type: Object})
  content: LottieFile = {};

  /**
   * The URL to the json file. Set after the file is uploaded.
   */
  @property({type: String})
  fileUrl = '';

  /**
   * The width of the composition.
   */
  @property({type: Number})
  width = 0;

  /**
   * The height of the composition.
   */
  @property({type: Number})
  height = 0;

  /**
   * Indicator for file upload.
   */
  @property({type: Boolean})
  fileUploaded = false;

  /**
   * Indicator for showing JSON editor.
   */
  @property({type: Boolean})
  showJsonEditor = false;

  /** 
   * The user uploaded assets.
   */
  @property({type: Object})
  assets = {};

  /**
   * The content of the uploaded file as a formatted string.
   */
  private fileString: string = '';

  /**
   * The JSONEditor.
   */
  private jsonEditor: any = {};

  /**
   * Stores the previous animation so it can be deleted.
   */
  private animation: any = {};

  /**
   * Boolean indicating if the animation has been rendered in the past.
   */
  private animationUploaded: Boolean = false;

  /**
   * Renders asset input buttons after json upload.
   */
  renderAssetInputs(): TemplateResult {
    return html`
    ${this.content.assets != undefined ?
      (this.content.assets as any[]).map(asset =>
        asset.p != undefined ?
        html`
          <br>
          ${asset.p}
          <input
          type="file"
          id="${asset.p}-input"
          map-key="${asset.p}"
          asset-type="image"
          @change="${this.handleAssetUpload}">
          <br>
        `:
        ""
      ):
      ""
    }
    ${this.content.fonts != undefined ?
      (this.content.fonts.list as any[]).map(font =>
        html`
          <br>
          ${font.fName}
          <input
          type="file"
          id="${font.fName}-input"
          map-key="${font.fName}"
          asset-type="font"
          @change="${this.handleAssetUpload}">
          <br>
        `
      ):
      ""
    }
    `;
  }

  /**
   * Renders json editor/GUI toggle button.
   */
  renderJsonEditorButton(): TemplateResult {
    if (this.showJsonEditor) {
      return html`
        <button 
        type="button"
        @click="${this.hideJSONEditor}">
          Show GUI Editor
        </button>
      `;
    } else {
      return html`
        <button 
        type="button"
        @click="${this.showJSONEditor}">
          Show JSON Editor
        </button>
      `;
    }
  }

  /**
   * Renders content toggle button for a specific layer in the GUI editor.
   */
  renderLayerButton(layer: Layer): TemplateResult {
    return html`
      <button
      type="button"
      class="layerbutton"
      @click="${this.toggleContent}"
      layername="${layer.nm}"
      toggled="false">
        ${layer.nm}
      </button>
    `;
  }

  /**
   * Renders visibility checkbox for a specific layer in the GUI editor.
   */
  renderVisibilityCheckbox(layer: Layer): TemplateResult {
    if (layer.ks.o.k === 0) {
      return html`
        <input
        type="checkbox"
        id="${layer.nm} Visibility"
        @click="${this.updateJson}">
      `;
    } else {
      return html`
        <input
        type="checkbox"
        id="${layer.nm} Visibility"
        checked
        @click="${this.updateJson}">
      `;
    }
  }

  /**
   * Renders color content for a specific layer in the GUI editor.
   */
  renderLayerColorContent(layer: Layer): TemplateResult|string {
    if (layer.ty === 1) {
      // search through effects for fill effect
      return html`
        <br>
        <div>
          Color: 
          <input
          type="color"
          id="${layer.nm} Color Input"
          value="${this.extractSolidColor(layer)}"
          @change="${this.updateJson}">
        </div>
      `;
    } else if (layer.ty === 4) {
      return html`
        <br>
        ${(layer.shapes as any[]).map(shape => shape.ty === "fl" || shape.ty === "gr" ?
          html`
            <div>
              <button
              type="button"
              class="layerbutton"
              @click="${this.toggleContent}"
              layername="${layer.nm+ ' ' +shape.nm}"
              toggled="false">
                ${shape.nm}
              </button>
              
              <div
              class="content"
              id="${layer.nm+ ' ' +shape.nm} Content"
              style="display:none">
                Color: 
                <input
                type="color"
                id="${layer.nm + ' ' + shape.nm} Color Input"
                value="${this.extractShapeColor(shape)}"
                @change="${this.updateJson}">
              </div>
            </div>
          `:
          ""
        )}
      `;
    } else {
      return '';
    }
  }

  /**
   * Renders text inputs to change text assets in the animation.
   */
  renderTextAssets(): TemplateResult | string {
    if (this.content.assets) {
      return html`
        ${this.content.assets.map(asset => asset.layers !== undefined ?
          html`
          ${(asset.layers as Layer[]).map(layer => layer.ty === 5 ?
            layer.t.d?.k.map((el: { s: { t: any; }; }) => el.s.t !== undefined ?
              html`
              ${layer.nm}: 
              <input
              id="${asset.id + ' ' + layer.nm} Input"
              type="text"
              value="${el.s.t}"
              @change="${this.updateJson}">
              <br>
              `:
              ""  
            ):
            ""
          )}
          `:
          ""
        )}
      `;
    }
    return '';
  }

  render(): TemplateResult {
    return html`
      <h1>${this.title}</h1>

      ${this.fileUploaded ?
        html`
          <link rel="stylesheet" href="../node_modules/jsoneditor/dist/jsoneditor.min.css">

          <div class=download>
            <a 
            target=_blank 
            download=${this.title} 
            href=${this.fileUrl}>
              Download JSON
            </a>
          </div>
        `:
        ""
      }

      <slot></slot>
      <br>

      JSON upload
      <input
      type="file"
      id="input"
      accept=".json"
      @change="${this.handleFileUpload}">
      <br>

      ${this.renderAssetInputs()}

      ${this.fileUploaded ?
        html`
          <h3>Editor</h3>
          ${this.renderJsonEditorButton()}

          <div
          style="display:
          ${this.showJsonEditor ?
            "none":
            ""
          }
          ">
            <div>
            Frame Rate:
            <input
            id="newframerate"
            value="${this.content.fr}"
            @change="${this.updateJson}">
            </div>

            ${this.renderTextAssets()}

            ${(this.content.layers as Layer[]).map(layer => 
              html`
                <div>
                  ${this.renderLayerButton(layer)}
                  <div
                  class="content"
                  id="${layer.nm} Content"
                  style="display:none">
                    <div>
                      Visibility:
                      ${this.renderVisibilityCheckbox(layer)}
                    </div>
                    ${this.renderLayerColorContent(layer)}
                  </div>
                </div>
              `
            )}
          </div>
        `:
        ""
      }
      <div 
      id="json-editor-container"
      style="display:
      ${this.showJsonEditor ?
        "":
        "none"
      }
      ">
      </div>
    `;
  }

  /**
   * Sets up the JSONEditor after the initial render.
   */
  firstUpdated(): void {
    const editorContainer = this.shadowRoot?.getElementById('json-editor-container');
    if (editorContainer) {
      const options: JSONEditorOptions = {
        mode: 'tree',
        onChange: () => {
          this.updateJson();
        }
      };
      this.jsonEditor = new JSONEditor(editorContainer, options);
    }
  }


  /**
   * Sets content object as well as width and height.
   */ 
  private setContent(newContent: any): void {
    this.content = newContent;
    if (this.content.w) {
      this.width = this.content.w;
    }
    if (this.content.h) {
      this.height = this.content.h;
    }
  }

  /**
   * Updates lottie player to play the uploaded json file.
   */
  private updatePlayer(): void {
    if (this.shouldRenderAnimation()) {
      const loadLottie = fetch(this.fileUrl).then((resp) => resp.text());
      Promise.all([loadKit, loadLottie]).then((values: any) => {
        const [SkottieKit, lottieJSON] = values;
        if (this.animationUploaded && this.animation) {
          this.animation.delete();
        }
        this.animation = SkottieKit.MakeManagedAnimation(lottieJSON, this.assets);
        this.animationUploaded = true;
        const animation = this.animation;
        const duration = (animation as any).duration() * 1000;

        const oldCanvas = document.getElementById('my-canvas');
        oldCanvas?.remove();

        const canvasElement = document.createElement('canvas');
        canvasElement.setAttribute('id', 'my-canvas');
        canvasElement.setAttribute('width', this.width.toString());
        canvasElement.setAttribute('height', this.height.toString());

        const parent = document.getElementById('skottie-player');
        parent?.append(canvasElement);
  
        const surface = SkottieKit.MakeCanvasSurface('my-canvas');
  
        const firstFrame = Date.now();
        const clearColor = SkottieKit.WHITE;
        const bounds = {fLeft: 0, fTop: 0, fRight: this.width, fBottom: this.height};
      
        function drawFrame(canvas: any) {
            // seek takes a float from 0.0 to 1.0
            const seek = ((Date.now() - firstFrame) / duration) % 1.0;
            (animation as any).seek(seek);
      
            canvas.clear(clearColor);
            (animation as any).render(canvas, bounds);
            surface.requestAnimationFrame(drawFrame);
        }
        surface.requestAnimationFrame(drawFrame);
      });
    } else {
      const canvasElement = document.getElementById('my-canvas');
      canvasElement?.setAttribute('style', 'display:none');
    }
  }

  /**
   * Handles json file upload. Updates content, editor, and player based on 
   * file content.
   */
  handleFileUpload(): void {
      const fileInput = this.shadowRoot?.getElementById('input');
      const files = (fileInput as HTMLInputElement).files;
      const file = files?.[0];
      const reader = new FileReader();
      if (file) {
        this.title = file.name;
        this.fileUrl = window.URL.createObjectURL(file);

        reader.readAsText(file);
        reader.onload = () => {
          this.setContent(JSON.parse(reader.result as string));
          this.assets = {};
          this.fileString = JSON.stringify(this.content);
          this.loadJSONEditor();
          this.updatePlayer();
          this.fileUploaded = true;
        };
      }
  }

  /**
   * Handles asset upload. Updates assets, color, and player based on
   * file content.
   */
  handleAssetUpload(e: Event): void {
    const assetInput = (e.composedPath()[0] as HTMLInputElement);
    const mapKey = assetInput.getAttribute('map-key');
    const files = assetInput.files;
    const file = files?.[0];
    if (file && mapKey) {
      const reader = new FileReader();
      if (mapKey === 'Image_0.jpeg') {
        this.updateColors(reader, file, mapKey);
      } else {
        this.readAssetFile(reader, file, mapKey);
      }
    }
  }

  /**
   * Updates template colors based on an uploaded image. Also reads in the
   * uploaded image as an image asset.
   * 
   * @param reader  Used when reading image as asset
   * @param file    Image file
   * @param mapKey  Name of asset, should always be "Image_0.jpeg"
   */
  private updateColors(reader: FileReader, file: File, mapKey: string): void {
    const url = URL.createObjectURL(file);
    const oldCanvas = document.getElementById('canvas');
    if (oldCanvas) {
      oldCanvas.remove();
    }
    const img = new Image();
    img.onload = () => { 
      const canvasElement = document.createElement('canvas');
      canvasElement.setAttribute('id', 'canvas');
      canvasElement.setAttribute('width', this.width.toString());
      canvasElement.setAttribute('height', this.height.toString());
      const context = canvasElement.getContext('2d');
      if (context) {
        context.drawImage(img, 0, 0, img.width * this.height / img.height, this.height);
        const myData = context.getImageData(0, 0, img.width * this.height / img.height, this.height);
        
        const k = 5;
        let [centers, centerCounts] = this.getDominantColors(myData, k);
        let [index, max] = [0, 0];
        for (let i = 0; i < centerCounts.length; i++) {
          if (centerCounts[i] > max) {
            max = centerCounts[i];
            index = i;
          }
        }
        const color = centers[index];
        console.log(color);
        console.log(centers);

        this.setTemplateColors(color);
        this.updateJson();
        this.readAssetFile(reader, file, mapKey);
      }
      URL.revokeObjectURL(url);
    }
    img.src = url;
  }

  /**
   * Takes in an ImageData object and finds the k most dominant colors from
   * the image data. Also returns the number of pixels assoiated with each 
   * color's cluster.
   * @param myData  ImageData generated from a HTML Canvas element
   */
  private getDominantColors(myData: ImageData, k: number): Array<any> {
    let dataMap, keyArray, total;
    [dataMap, keyArray, total] = this.getDataMap(myData)

    let centerCandidates = this.getCenterCandidates(dataMap, keyArray, total)

    let centers = new Array<string>();
    let centerCounts, centerToColor;
    while (centers.length === 0) {
      [centers, centerCounts, centerToColor] = this.kMeans(k, dataMap, centerCandidates);
      [centers, centerCounts] = this.filterWhiteBlack(centers, centerCounts, centerToColor);
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
  private getCenterCandidates(dataMap: Map<string, number>, 
    keyArray: Array<string>, total: number) {
    let centerCandidates = [];
    for (let i = 0; i < keyArray.length; i++) {
      const count = dataMap.get(keyArray[i])
      if (count && total / keyArray.length / 2 < count){
        centerCandidates.push(keyArray[i]);
      }
    }
    return centerCandidates
  }

  /**
   * Filters out cluster centers that are too similar to white or black.
   * Also converts center color to nearest color found in the image.
   * Returns array of valid centers and center counts for those centers.
   * 
   * @param centers         Array of colors that are centers.
   * @param centerCounts    Map from center to count of number of pixels.
   * @param centerToColor   Map from center to colors in center's cluster.
   */
  private filterWhiteBlack(centers: Array<string>,
    centerCounts: Array<number>,
    centerToColor: Map<string, Array<string>>): Array<any> {
    const black = '000000000';
    const white = '255255255';
    const threshold = 30;
    for (let i = centers.length - 1; i >= 0; i--) {
      if (this.colorDistance(white, centers[i]) > threshold
      && this.colorDistance(black, centers[i]) > threshold) {
        centers[i] = this.getImageColors(centerToColor, centers[i]);
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
  private getDataMap(myData: ImageData): Array<any> {
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
  private getImageColors(centerToColor: any, color: string): string {
    const colorArray = centerToColor.get(color)
    let minDistColor = '';
    if (colorArray) {
      let minDist = deltaE(rgb2lab([0, 0, 0]), rgb2lab([255, 255, 255]));
      for (let i = 0; i < colorArray.length; i++) {
        const newDist = this.colorDistance(colorArray[i], color);
        if (newDist < minDist) {
          minDist = newDist;
          minDistColor = colorArray[i];
        }
      }
      minDistColor = this.rgbaToHex([parseInt(minDistColor.slice(0,3)) / 255,
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
  private kMeans(k: number, data: Map<string, number>, 
    keys: Array<string>): Array<any> {
    let centers = this.initializeCenters(k, keys);
    let centerCounts, centerToColor;
    let oldCenters = centers.slice();
    while (true) {
      [centers, centerCounts, centerToColor] = this.updateCenters(centers, data, keys);
      if (this.arraysEqual(centers, oldCenters)) {
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
  private initializeCenters(k: number, keys: Array<string>):
    Array<string> {
    if (k >= keys.length) {
      return keys;
    }
    let centers: Array<string> = [];
    let usedIndices = new Set<number>();
    while (centers.length < k) {
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
  private updateCenters(centers: Array<string>, data: Map<string, number>,
    keys: Array<string>): Array<any> {

    // calculate new clusters
    const pointToCenter = this.getNewClusters(keys, centers);

    // calculate new centers
    const [centerCounts, centerSums] = 
      this.getCenterStats(centers.length, keys, data, pointToCenter);
    const newCenters = this.getNewCenters(centerCounts, centerSums);

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
  private getNewClusters(colors: Array<string>, 
    centers: Array<string>): Array<number> {
    let pointToCenter: Array<number> = [];
    for (let i = 0; i < colors.length; i++) {
      let minDist = 100;
      let currCenter = 0;
      for (let j = 0; j < centers.length; j++ ) {
        const newDist = this.colorDistance(colors[i], centers[j]);
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
  private getCenterStats(k: number, keys: Array<string>, 
    data: Map<string, number>, pointToCenter: Array<number>): Array<any> {
    let centerCounts: Array<number> = [];
    let centerSums: Array<Array<number>> = [];
    for (let i = 0 ; i < k; i++) {
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

  /**
   * Checks if two string arrays have the same elements in every spot. 
   */
  private arraysEqual(array1: Array<string>, array2: Array<string>): boolean {
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
  private colorDistance(color1: string, color2: string): number {
    const labColor1 = rgb2lab([parseInt(color1.slice(0,3)), 
      parseInt(color1.slice(3,6)), parseInt(color1.slice(6))]);
    const labColor2 = rgb2lab([parseInt(color2.slice(0,3)),
      parseInt(color2.slice(3,6)), parseInt(color2.slice(6))]);
    return deltaE(labColor1, labColor2);
  }

  /**
   * Sets colors used in a template based on a base hex color. 
   */
  private setTemplateColors(color: any): void {
    color = this.hexToRgb(color)
    for (let i = 0; i < color.length; i++) {
      color[i] *= 255;
    }
    color = rgbToHsv(color[0], color[1], color[2]);
    let secondaryColor = color.slice();
    let backgroundColor = color.slice();

    if (color[0] < 500) {
      secondaryColor[2] -= 15;
      secondaryColor[1] += 15;
      backgroundColor[2] -= 40;
    } else if (color[0] < 800) {
      secondaryColor[2] += 15;
      backgroundColor[2] -= 15;
    } else {
      secondaryColor[2] += 30;
      secondaryColor[1] -= 15;
      backgroundColor[2] -= 15;
      backgroundColor[1] -= 15;
    }

    color = hsvToRgb(color[0], color[1], color[2]);
    backgroundColor = hsvToRgb(backgroundColor[0], backgroundColor[1],
      backgroundColor[2]);
    secondaryColor = hsvToRgb(secondaryColor[0], secondaryColor[1],
      secondaryColor[2]);
    for (let j = 0; j < color.length; j++) {
      color[j] /= 255;
      backgroundColor[j] /= 255;
      secondaryColor[j] /= 255;
    }
    color.push(1);
    backgroundColor.push(1);
    secondaryColor.push(1);

    this.updateTemplateColors(color, secondaryColor, backgroundColor);    
  }

  /**
   * Updates colors used in a template with the given colors. Colors are 
   * represented as number arrays of length 3.
   */
  private updateTemplateColors(color: Array<number>, secondaryColor: Array<number>,
    backgroundColor: Array<number>): void {
    if (this.content.layers) {
      for (let i = 0; i < this.content.layers.length; i++) {
        if (this.content.layers[i].nm?.slice(0, 17) === 'Transition_Color_') {
          const num = this.content.layers[i].nm?.slice(-2);
          if (num && parseInt(num) % 2 == 0) {
            (this.content.layers[i].ef as any)[0].ef[2].v.k = secondaryColor;
            const colorInput = 
              this.shadowRoot?.getElementById(this.content.layers[i].nm +
              ' Color Input');
            if (colorInput) {
              colorInput.setAttribute('value', this.rgbaToHex(secondaryColor));
            }
          } else if (num) {
            (this.content.layers[i].ef as any)[0].ef[2].v.k = color;
            const colorInput =
              this.shadowRoot?.getElementById(this.content.layers[i].nm +
              ' Color Input');
            if (colorInput) {
              colorInput.setAttribute('value', this.rgbaToHex(color));
            }
          }
        } else if(this.content.layers[i].nm === 'BG_Color') {
          (this.content.layers[i].ef as any)[0].ef[2].v.k = backgroundColor;
          const colorInput = 
            this.shadowRoot?.getElementById(this.content.layers[i].nm +
            ' Color Input');
          if (colorInput) {
            colorInput.setAttribute('value', this.rgbaToHex(backgroundColor));
          }
        }
      }
    }
  }

  /**
   * Reads in an asset file as an ArrayBuffer. Stores the read file in the 
   * assets object and updates the player.
   */
  private readAssetFile(reader: FileReader, file: File, mapKey: string): void {
    reader.readAsArrayBuffer(file);
    reader.onload = () => {
      (this.assets as any)[mapKey] = reader.result;
      this.updatePlayer();
    }
  }

  /**
   * Loads content into the JSONEditor.
   */
  private loadJSONEditor(): void {
    (this.jsonEditor as JSONEditor).set(this.content);
  }

  /**
   * Shows the JSONEditor and hids the GUI editor. Also applies updates
   * to the stored JSON data.
   */
  showJSONEditor(): void {
    this.updateJson();
    this.showJsonEditor = true;
    this.loadJSONEditor();
  }

  /**
   * Shows the GUI editor and hides the JSON Editor. Also applies updates
   * to the stored JSON data.
   */
  hideJSONEditor(): void {
    this.updateJson();
    this.showJsonEditor = false;
  }

  /**
   * Updates the downloadable json file, content, and animation based on 
   * changes in the editor.
   */
  updateJson(): void {
      // pull updated json
      if (this.showJsonEditor) {
        this.setContent((this.jsonEditor as JSONEditor).get());
      } else {
        this.updateJsonFramerate();
        this.updateJsonTextAssets();
        this.updateJsonLayers();
      }
      this.fileString = JSON.stringify(this.content);

      // update download link
      URL.revokeObjectURL(this.fileUrl);
      this.fileUrl = URL.createObjectURL(new Blob([this.fileString]));
      
      // update animation
      this.updatePlayer();
  }
  
  /**
   * Toggles visibility of content for the clicked button. 
   */
  toggleContent(e: Event): void {
    const layerButton = (e.composedPath()[0] as HTMLElement);
    const layerName = layerButton.getAttribute('layername');
    const buttonToggled = layerButton.getAttribute('toggled');
    if (layerName) {
      let layerContentElement = this.shadowRoot?.getElementById(layerName.concat(' Content'));
      if (layerContentElement && buttonToggled === 'false') {
        layerContentElement.style.display = '';
        layerButton.setAttribute('toggled', 'true');
      } else if (layerContentElement && buttonToggled === 'true') {
        layerContentElement.style.display = 'none';
        layerButton.setAttribute('toggled', 'false');
      }
    }
  }

  /**
   * Converts a color value from an rgba array to its equivalent hex value as 
   * a string.
   * 
   * @param color   Has a range of [0,1]
   */
  private colorToString(color: number): string {
    let string = (color * 255).toString(16);
    if (string.length === 1) {
      string = '0' + string;
    } else if (string.length > 2) {
      string = string.slice(0, 2);
    }
    return string;
  }

  /**
   * Converts rgba array into a hex color string. The alpha channel is ignored
   * as its use is not supported.
   * 
   * @param rgba  Has a length of 4, values in range [0, 1]
   */
  private rgbaToHex(rgba: Array<number>): string {
    const r = this.colorToString(rgba[0]);
    const g = this.colorToString(rgba[1]);
    const b = this.colorToString(rgba[2]);

    return '#' + r + g + b;
  }

  /**
   * Extracts color hex string from a shape object.
   * 
   * @param shape   Type can be fill or group
   */
  extractShapeColor(shape: any): string {
    if (shape.ty === 'gr' && shape.it) {
      for (let i = 0; i < shape.it.length; i++) {
        if (shape.it[i].ty === 'fl') {
          return this.rgbaToHex(shape.it[i].c.k);
        }
      }
    } else {
      if (shape.ty === 'fl') {
        return this.rgbaToHex(shape.c.k);
      }
    }
    return '';
  }

  /**
   * Extracts color from a solid layer.
   * @param layer  Type is solid.
   */
  extractSolidColor(layer: Layer): string {
    const efLength = layer.ef?.length;
    if (efLength) {
      for (let i = 0; i < efLength; i++) {
        if (layer.ef?.[i].ty === 2) {
          return this.rgbaToHex(layer.ef?.[i].v.k);
        } else if (layer.ef?.[i].ty === 21) {
          for (let j = 0; j < layer.ef?.[i].ef.length; j++) {
            if (layer.ef?.[i].ef[j].ty === 2) {
              return this.rgbaToHex(layer.ef?.[i].ef[j].v.k);
            }
          }
        }
      }
    }
    if (layer.sc) {
      return layer.sc;
    }
    return '';
  }

  /**
   * Updates the framerate in the content object.
   */
  private updateJsonFramerate(): void {
    const framerateInput = (this.shadowRoot?.getElementById('newframerate') as HTMLInputElement);
    if (framerateInput.value) {
      this.content.fr = parseFloat(framerateInput.value);
    }
  }

  /**
   * Updates the text assets in the content object.
   */
  private updateJsonTextAssets(): void {
    if (this.content.assets) {
      for (let i = 0; i < this.content.assets.length; i++) {
        if (this.content.assets[i].layers) {
          for (let j = 0; j < this.content.assets[i].layers.length; j++) {
            this.updateAssetText(i, j);
          }
        }
      }
    }
  }

  /**
   * Updates a specific text asset in the content object.
   */
  private updateAssetText(assetIndex: number, layerIndex: number): void {
    if (this.content.assets && this.content.assets[assetIndex].layers) {
      const textInput = (this.shadowRoot?.getElementById(this.content.assets[assetIndex].id
        + ' ' + this.content.assets[assetIndex].layers[layerIndex].nm + ' Input') as HTMLInputElement);
      if (textInput && this.content.assets[assetIndex].layers[layerIndex].t.d.k) {
        for (let i = 0; i < this.content.assets[assetIndex].layers[layerIndex].t.d.k.length; i++) {
          if (this.content.assets[assetIndex].layers[layerIndex].t.d.k[i].s) {
            this.content.assets[assetIndex].layers[layerIndex].t.d.k[i].s.t = textInput.value;
            return;
          }
        }
      }
    }
  }

  /**
   * Updates the layers in the content object.
   */
  private updateJsonLayers(): void {
    if (this.content.layers) {
      for (let i = 0; i < this.content.layers.length; i++) {
        this.updateLayerVisibility(i);
        this.updateLayerColor(i);
      }
    }
  }

  /**
   * Updates the visibilty of the layer with given index in the layer array.
   */
  private updateLayerVisibility(layerIndex: number): void {
    if (this.content.layers) {
      const layerVisibility = this.shadowRoot?.getElementById(this.content.layers[layerIndex].nm + 
        ' Visibility') as HTMLInputElement;
      if (layerVisibility.checked) {
        this.content.layers[layerIndex].ks.o.k = 100;
      } else {
        this.content.layers[layerIndex].ks.o.k = 0;
      }
    }
  }

  /**
   * Updates the color of the layer with given index in the layer array.
   */
  private updateLayerColor(layerIndex: number): void {
    if (this.content.layers?.[layerIndex].ty === 1) {
      const colorInput = this.shadowRoot?.getElementById(this.content.layers[layerIndex].nm + 
          ' Color Input') as HTMLInputElement;
      this.content.layers[layerIndex].sc = colorInput.value;
    } else if (this.content.layers?.[layerIndex].ty === 4) {
      for (let shapeIndex = 0; 
        shapeIndex < (this.content.layers[layerIndex].shapes as any).length;
        shapeIndex++) {
        const colorInput = this.shadowRoot?.getElementById(this.content.layers[layerIndex].nm + 
            ' ' + (this.content.layers[layerIndex].shapes as any)[shapeIndex].nm +
            ' Color Input') as HTMLInputElement;
        this.setShapeColor((this.content.layers[layerIndex].shapes as any)[shapeIndex],
          this.hexToRgba(colorInput.value));
      }
    }
  }

  /**
   * Sets the color of a given shape.
   * 
   * @param shape   Type can be fill or group
   * @param rgba    Has a length of 4, values in range [0, 1]
   */
  private setShapeColor(shape: any, rgba: Array<number>): void {
    if (shape.ty === 'gr' && shape.it) {
      for (let i = 0; i < shape.it.length; i++) {
        if (shape.it[i].ty === 'fl') {
          shape.it[i].c.k = rgba;
          return;
        }
      }
    }
  }

  /**
   * Converts a hex string to a rgba array.
   */
  private hexToRgba(hex: string): Array<number> {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    return [r, g, b, 1];
  }

  /**
   * Converts a hex string to a rgb array.
   */
  private hexToRgb(hex: string): Array<number> {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    return [r, g, b];
  }

  /**
   * Gets the number of image assets from an array of required assets.
   */
  private getNumAssets(assets: Array<any>): number {
    let length = 0;
    for (let i = 0; i < assets.length; i++) {
      if (assets[i].p != undefined) {
        length++;
      }
    }
    return length;
  }

  /**
   * Determines if the animation should be rendered.
   */
  private shouldRenderAnimation(): boolean {
    if (this.content.fonts) {
      return this.content.assets && this.content.fonts &&
        Object.keys(this.assets).length === this.getNumAssets(this.content.assets) + 
        this.content.fonts.list.length;
    }
    return (this.content.assets != undefined) && 
      Object.keys(this.assets).length === this.getNumAssets(this.content.assets);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'skottie-player': SkottiePlayer;
  }
}
