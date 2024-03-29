/**
 * skottie-player.ts
 */

import {css, customElement, html, LitElement, property, TemplateResult} from 'lit-element';
import JSONEditor, {JSONEditorOptions} from 'jsoneditor';
import {FaceBounder} from './face-bounder'
import {BodySegmenter} from './body-segmenter';
import {DominantColorComputer, colorDistance} from './color-extractor';

const rgbToHsv = require('rgb-hsv');
const hsvToRgb = require('hsv-rgb');
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
   * Indicator for text repositioning.
   */
  @property({type: Boolean})
  textRepositioned = false;

  /**
   * Indicator for if the body segmentation is used.
   */
  @property({type: Boolean})
  bodySegmentUsed = false;

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
   * For finding face boundaries.
   */
  private faceBounder: FaceBounder = new FaceBounder();

  /**
   * Original size of text box. Populated when the json is read. An array 
   * of length 2 that contains width and height in pixels.
   */
  private originalSize: Array<number> = [];

  /**
   * Original position of text box. Populated when the json is read. An array 
   * of length 2 that contains the x and y coordinates of the top left corner 
   * of the text box in a system where the center of the animation is the 
   * origin.
   */
  private originalPosition: Array<number> = [];

  /**
   * Size of text box after repositioning to avoid faces. An array of length 2
   * that contains width and height in pixels.
   */
  private repositionedSize: Array<number> = [];

  /**
   * Position of text box after repositioning to avoid faces. An array of 
   * length 2 that contains the x and y coordinates of the top left corner
   * of the text box in a system where the center of the animation is the 
   * origin.
   */
  private repositionedPosition: Array<number> = [];

  /**
   * Threshold for new text box height as a proportion of the original text box
   * height.
   */
  private textBoxHeightThreshold: number = 0.75;

  /**
   * For performing body segmentation.
   */
  private bodySegmenter: BodySegmenter = new BodySegmenter();

  /**
   * Set of names of assets to extract dominant color from.
   */
  private extractColorAssetNames: Set<string> =
    new Set<string>(['Image_0.jpeg']);

  /**
   * Map from original image asset names to create body segmented masks from
   * to asset names of body segmented masks.
   */
  private segmentBodyAssetMap: Map<string, string> =
    new Map<string, string>([['img_1.jpg', 'img_3.png']]);
  
  /**
   * Set of asset names of body segmented masks.
   */
  private segmentBodyAssetValues: Set<string> = 
    new Set(this.segmentBodyAssetMap.values());

  /**
   * Name of asset wiht logo image.
   */
  private logoImageName = 'img_0.jpg';

  /**
   * Acceptable text colors as hex strings.
   */
  private textColors: Array<string> = ['000000000', '255255255'];

  /**
   * Body segmented image data.
   */
  private bodySegmentBlob: Blob = new Blob();

  /**
   * Transparent image data.
   */
  private transparentBlob: Blob = new Blob();

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
      // layer is shape layer
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
        ${this.content.assets.map(asset => asset.layers !== undefined 
          && asset.layers[0].ty === 5 ?
          html`
            ${asset.layers[0].nm}: 
            <input
            id="${asset.id + ' ' + asset.layers[0].nm} Input"
            type="text"
            value="${asset.layers[0].t.d.k[0].s.t}"
            @change="${this.updateJson}">
            <br>
            ${asset.layers[0].nm} text size:
            <input
            id="${asset.id + ' ' + asset.layers[0].nm + ' size'} Input"
            type="number"
            value="${parseFloat(asset.layers[0].t.d.k[0].s.s)}"
            @change="${this.updateJson}">
            <br>
          `:
          ""
        )}
      `;
    }
    return '';
  }

  renderTextRepositionButton(): TemplateResult {
    if (!this.textRepositioned) {
      return html`
        <button
        type="button"
        @click="${this.repositionText}">
          Reposition Text
        </button>
        <br>
      `;
    }
    return html`
      <button
      type="button"
      @click="${this.revertTextPosition}">
        Revert Text Position
      </button>
      <br>
    `;
  }

  renderBodySegmentButton(): TemplateResult {
    if (this.bodySegmentUsed) {
      return html`
        <button
        type="button"
        @click="${this.bodySegmentToggle}">
          Revert Body Segmentation
        </button>
        <br>
      `;
    }
    return html`
      <button
      type="button"
      @click="${this.bodySegmentToggle}">
        Use Body Segmentation
      </button>
      <br>
    `;
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
            ${this.renderTextRepositionButton()}
            ${this.renderBodySegmentButton()}
            

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
   * Finds the bodies of people in an an image and creates a new image with 
   * only the bodies.
   * 
   * @param reader      Used when reading image as asset
   * @param file        Image file
   * @param mapKey      Name of original asset
   */
  private bodySegment(reader: FileReader, file: File, mapKey: string): void {
    const url = URL.createObjectURL(file);
    const oldCanvas = document.getElementById('canvas');
    if (oldCanvas) {
      oldCanvas.remove();
    }
    const img = new Image();
    img.onload = () => { 
      const canvasElement = document.createElement('canvas');
      canvasElement.setAttribute('id', 'canvas');
      canvasElement.setAttribute('width', img.width.toString());
      canvasElement.setAttribute('height', img.height.toString());
      const context = canvasElement.getContext('2d');
      if (context) {
        context.drawImage(img, 0, 0, img.width, img.height);
        let myData = context.getImageData(0, 0, img.width, img.height);
        
        const numClusters = 5;
        const colorThreshold = 30;
        const dominantColorComputer = new DominantColorComputer(myData);
        let [centers, centerCounts] = 
          dominantColorComputer.getDominantColors(numClusters, [], colorThreshold);
        let index = 0;
        for (let i = 0; i < centerCounts.length; i++) {
          if (centerCounts[i] > centerCounts[index]) {
            index = i;
          }
        }
        let color = centers[index];
        let [textColor, maxDist] = ['', 0];
        color = this.hexToColorString(color);
        for (let i = 0; i < this.textColors.length; i++) {
          console.log(this.textColors[i]);
          const newDist = colorDistance(color, this.textColors[i]);
          if (newDist > maxDist) {
            maxDist = newDist;
            textColor = this.textColors[i];
          }
        }

        let red = parseInt(textColor.slice(0, 3)) / 255;
        let green = parseInt(textColor.slice(0, 3)) / 255;
        let blue = parseInt(textColor.slice(0, 3)) / 255;

        if (this.content.layers && this.content.layers[15].ef) {
          this.content.layers[15].ef[0].ef[2].v.k = [red, green, blue, 1];
        }

        this.bodySegmenter.segmentPerson(myData).then((mask) => {
          for (let i = 0; i < mask.length; i++) {
            if (mask[i] === 0) {
              // change the alpha value of pixels to 0 if the pixel 
              // is not part of a body
              myData.data[i * 4 + 3] = 0;
            }
          }
          context.putImageData(myData, 0, 0);
          canvasElement.toBlob((blob) => {
            if (blob != null) {
              this.bodySegmentBlob = blob;
            }
          });
          for (let i = 0; i < myData.data.length; i++) {
            myData.data[i] = 0;
          }
          context.putImageData(myData, 0, 0);
          canvasElement.toBlob((blob) => {
            if (blob != null) {
              this.transparentBlob = blob;
              this.bodySegmentUsed = true;
              this.bodySegmentToggle();
            }
          });
          this.updateJson();
          this.readAssetFile(reader, file, mapKey);
          URL.revokeObjectURL(url);
        });
      }
    }
    img.src = url;
  }

  bodySegmentToggle() {
    const reader = new FileReader();
    if (!this.bodySegmentUsed) {
      this.bodySegmentUsed = true;
      this.readAssetFile(reader, this.bodySegmentBlob, 'img_3.png');
    } else {
      this.bodySegmentUsed = false;
      this.readAssetFile(reader, this.transparentBlob, 'img_3.png');
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
          // The index 9 here is the index in the asset array from the JSON that 
          // corresponds to the text asset moved by the text repositioning.
          if (this.content.assets?.[9]) {
            if(this.content.assets?.[9].layers[0].t.d.k[0].s) {
              this.originalPosition.push(this.content.assets?.[9].layers[0].t.d.k[0].s.ps[0]);
              this.originalPosition.push(this.content.assets?.[9].layers[0].t.d.k[0].s.ps[1]);
              this.originalSize.push(this.content.assets?.[9].layers[0].t.d.k[0].s.sz[0]);
              this.originalSize.push(this.content.assets?.[9].layers[0].t.d.k[0].s.sz[1]);
            }
          }
          this.textRepositioned = false;
          this.bodySegmentUsed = false;
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
      if (this.segmentBodyAssetValues.has(mapKey)) {
        return;
      }
      const reader = new FileReader();
      const value = this.segmentBodyAssetMap.get(mapKey);
      if (value) {
        this.bodySegment(reader, file, mapKey);
        this.getRepositionedValues(mapKey);
      }
      if (mapKey === this.logoImageName) {
        this.extractLogoColors();
      }
      if (this.extractColorAssetNames.has(mapKey)) {
        this.updateColors(reader, file, mapKey);
      } else {
        this.readAssetFile(reader, file, mapKey);
      }
    }
  }

  /**
   * Extracts dominant colors from the logo image and adds them to the 
   * potential text color array.
   */
  private extractLogoColors() {
    const input = (this.shadowRoot?.getElementById(this.logoImageName + '-input') as HTMLInputElement);
    const file = input.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      const oldCanvas = document.getElementById('canvas');
      if (oldCanvas) {
        oldCanvas.remove();
      }
      const img = new Image();
      img.onload = () => { 
        const canvasElement = document.createElement('canvas');
        canvasElement.setAttribute('id', 'canvas');
        canvasElement.setAttribute('width', img.width.toString());
        canvasElement.setAttribute('height', img.height.toString());
        const context = canvasElement.getContext('2d');
        if (context) {
          context.drawImage(img, 0, 0, img.width, img.height);
          let myData = context.getImageData(0, 0, img.width, img.height);
          
          const numClusters = 5;
          const colorThreshold = 30;
          const dominantColorComputer = new DominantColorComputer(myData);
          let [centers, ] = 
            dominantColorComputer.getDominantColors(numClusters, [], colorThreshold);
          for (let i = 0; i < centers.length; i++) {
            this.textColors.push(this.hexToColorString(centers[i]));
          }
        }
      };
      img.src = url;
    }
  }

  /**
   * Updates template colors based on an uploaded image. Also reads in the
   * uploaded image as an image asset.
   * 
   * @param reader  Used when reading image as asset
   * @param file    Image file
   * @param mapKey  Name of asset
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
        context.drawImage(img, 0, 0, 
          img.width * this.height / img.height, this.height);
        const myData = context.getImageData(0, 0,
          img.width * this.height / img.height, this.height);
        
        const numClusters = 5;
        const colorThreshold = 30;
        const white = '000000000';
        const black = '255255255';
        const dominantColorComputer = new DominantColorComputer(myData);
        let [centers, centerCounts] = 
          dominantColorComputer.getDominantColors(numClusters, [white, black], colorThreshold);
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
  private readAssetFile(reader: FileReader, file: File|Blob, mapKey: string): void {
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
   * Repositions text to not cover faces.
   */
  repositionText(): void {
    if (this.content.assets) {
      this.content.assets[9].layers[0].t.d.k[0].s.sz[0] = this.repositionedSize[0];
      this.content.assets[9].layers[0].t.d.k[0].s.sz[1] = this.repositionedSize[1];
      this.content.assets[9].layers[0].t.d.k[0].s.ps[0] = this.repositionedPosition[0];
      this.content.assets[9].layers[0].t.d.k[0].s.ps[1] = this.repositionedPosition[1];
      this.textRepositioned = true;
      this.updateJson();
    }
  }

  private getRepositionedValues(mapKey: string): void {
    const oldCanvas = document.getElementById('canvas');
    if (oldCanvas) {
      oldCanvas.remove();
    }
    const fileInput = (this.shadowRoot?.getElementById(mapKey + '-input') as HTMLInputElement);
    const file = fileInput.files?.[0];
    if (file) {
      createImageBitmap(file).then((bitmap) => {
        const canvasElement = document.createElement('canvas');
        canvasElement.setAttribute('id', 'canvas');
        canvasElement.setAttribute('width', this.width.toString());
        canvasElement.setAttribute('height', this.height.toString());
        const context = canvasElement.getContext('2d');
        if (context) {
          context.drawImage(bitmap, 0, 0, bitmap.width, bitmap.height,
                            0, 0, this.width, this.height);
          this.faceBounder.getFaceBounds(canvasElement).then((result) => {
            console.log(result)
            const [xValues, yValues, faceArray] = this.getXYValues(result);
            console.log(faceArray);
            
            const [topLeft, bottomRight] = this.getTextBounds(xValues, yValues, faceArray);
            console.log(topLeft, bottomRight);

            this.repositionedPosition = [topLeft[0] - this.width / 2, topLeft[1] - this.height / 2];
            this.repositionedSize = [bottomRight[0] - topLeft[0], bottomRight[1] - topLeft[1]];
          });
        }
      })
    }
  }

  /**
   * Gets potential x and y coordinates for the text bounding box.
   */
  private getXYValues(faceArray: Array<any>): Array<Array<any>> {
    const margin = 32;
    let xValues = [margin, this.width - margin];
    let yValues = [margin, this.height - margin];
    for (let i = 0; i < faceArray.length; i++) {
      faceArray[i].topLeft[0] -= margin;
      faceArray[i].topLeft[1] -= margin;
      faceArray[i].bottomRight[0] += margin;
      faceArray[i].bottomRight[1] += margin;
      xValues.push(faceArray[i].topLeft[0]);
      yValues.push(faceArray[i].topLeft[1]);
      xValues.push(faceArray[i].bottomRight[0]);
      yValues.push(faceArray[i].bottomRight[1]);
    }
    return [xValues, yValues, faceArray];
  }

  /**
   * Gets the largest text box possible that doesn't overlap with any of the
   * faces in the face array.
   */
  private getTextBounds(xValues: Array<number>, yValues: Array<number>,
    faceArray: Array<any>): Array<Array<number>> {
    let topLeft = [xValues[0], yValues[0]];
    let bottomRight = [xValues[1], yValues[1]];
    let maxArea = 0;
    for (let x1 = 0; x1 < xValues.length; x1++) {
      for (let x2 = x1 + 1; x2 < xValues.length; x2++) {
        for (let y1 = 0; y1 < yValues.length; y1++) {
          for (let y2 = y1 + 1; y2 < yValues.length; y2++) {
            const topLeftTemp = [Math.max(Math.min(xValues[x1], xValues[x2]), 0), 
                                 Math.max(Math.min(yValues[y1], yValues[y2]), 0)];
            const bottomRightTemp = [Math.max(xValues[x1], xValues[x2]),
                                     Math.max(yValues[y1], yValues[y2])];
            const height = bottomRightTemp[1] - topLeftTemp[1];
            const width = bottomRightTemp[0] - topLeftTemp[0];
            const area = width * height;
            if (!this.textBoxContainsFaces(topLeftTemp, bottomRightTemp, faceArray) 
                && height > this.originalSize[1] * this.textBoxHeightThreshold
                && area > maxArea) {
              topLeft = topLeftTemp;
              bottomRight = bottomRightTemp;
              maxArea = area;
            }
          }
        }
      }
    }
    return [topLeft, bottomRight];
  }

  /**
   * Determines if a text box bounding box overlaps with any face in an array
   * of face bounding boxes.
   * Bounding boxes are determined by upper left and lower right corners.
   */
  private textBoxContainsFaces(textTopLeft: Array<number>, 
    textBottomRight: Array<number>, faceArray: Array<any>): boolean {
    for (let i = 0; i < faceArray.length; i++) {
      if (faceArray[i].bottomRight[0] > textTopLeft[0] 
        && faceArray[i].bottomRight[1] > textTopLeft[1]
        && faceArray[i].topLeft[0] < textBottomRight[0] 
        && faceArray[i].topLeft[1] < textBottomRight[1]) {
        return true;
      }
    }
    return false;
  }

  /**
   * Reverts text box position to original position.
   */
  revertTextPosition(): void {
    if (this.content.assets) {
      this.content.assets[9].layers[0].t.d.k[0].s.sz[0] = this.originalSize[0];
      this.content.assets[9].layers[0].t.d.k[0].s.sz[1] = this.originalSize[1];
      this.content.assets[9].layers[0].t.d.k[0].s.ps[0] = this.originalPosition[0];
      this.content.assets[9].layers[0].t.d.k[0].s.ps[1] = this.originalPosition[1];
      this.textRepositioned = false;
      this.updateJson();
    }
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
      const sizeInput = (this.shadowRoot?.getElementById(this.content.assets[assetIndex].id
        + ' ' + this.content.assets[assetIndex].layers[layerIndex].nm + ' size Input') as HTMLInputElement);
      if (textInput && sizeInput && this.content.assets[assetIndex].layers[layerIndex].t.d.k) {
        for (let i = 0; i < this.content.assets[assetIndex].layers[layerIndex].t.d.k.length; i++) {
          if (this.content.assets[assetIndex].layers[layerIndex].t.d.k[i].s) {
            this.content.assets[assetIndex].layers[layerIndex].t.d.k[i].s.t = textInput.value;
            this.content.assets[assetIndex].layers[layerIndex].t.d.k[i].s.s = sizeInput.valueAsNumber;
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

  private hexToColorString(hex: string): string {
    const colorArray = this.hexToRgb(hex);
    let r = Math.round(colorArray[0] * 255).toString();
    while (r.length < 3) {
      r = '0' + r;
    }
    let g = Math.round(colorArray[1] * 255).toString();
    while (g.length < 3) {
      g = '0' + g;
    }
    let b = Math.round(colorArray[2] * 255).toString();
    while (b.length < 3) {
      b = '0' + b;
    }
    return r + g + b;
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
