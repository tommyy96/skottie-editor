/**
 * skottie-player.ts
 */

import {css, customElement, html, LitElement, property} from 'lit-element';
import lottiePlayer, {AnimationConfigWithPath} from 'lottie-web/build/player/lottie_light';
import JSONEditor, {JSONEditorOptions} from 'jsoneditor';
const ColorThief =  require('color-thief');
const colorThief = new ColorThief();
const SkottieKitInit = require('skottiekit-wasm/bin/skottiekit.js');
const fs = require('fs');
const path = require('path');
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
  ty?: number; // layer type
  ks?: any; // transform object
  ao?: number; // auto-orient boolean
  bm?: number; // blend mode type
  ddd?: number; // 3d layer boolean
  ind?: number; // layer index
  cl?: string; // html class
  ln?: string; // html id
  ip?: number; // in point
  op?: number; // out point
  st?: number; // start time
  nm?: string; // name
  hasMask?: number; // has mask boolean
  masksProperties?: Array<any>; // mask properties
  ef?: Array<any>; // effects
  sr?: number; // stretch
  parent?: number; // parent layer index
  shapes?: Array<any>; // shapes
  sc?: string; // color of solid
  sh?: number; // height of solid
  sw?: number; // width of solid
  refID?: string; // reference ID
  tm?: any; // time remapping
  t?: any; // text
}

interface LottieFile {
  ip?: number; // in point
  op?: number; // out point
  fr?: number; // frame rate
  w?: number; // width
  h?: number; // height
  ddd?: number; // 3d layer boolean
  v?: string; // bodymovin version
  nm?: string; // name
  layers?: Array<Layer>; // layers array
  assets?: Array<any>; // assets array
  fonts?: any; // fonts object
  chars?: Array<any>; // characters array
}

@customElement('skottie-player')
export class SkottiePlayer extends LitElement {
  static get styles() {
    return css`
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

      .active, .layerbutton:hover {
        background-color: #ccc;
      }

      .content {
        padding: 0 18px;
        background-color: #f1f1f1;
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
   * The content of the uploaded file as a formatted string.
   */
  @property({type: String})
  fileString = '';

  /**
   * The JSONEditor.
   */
  @property({type: JSONEditor})
  jsonEditor = {};

  /**
   * The canvas surface for Skottie.
   */
  @property({type: Object})
  canvasSurface = {};

  /** 
   * The user uploaded assets.
   */
  @property({type: Object})
  assets = {};

  /**
   * The dominant colors of the uploaded image assets.
   */
  @property({type: Object})
  imageColors = {};

  /**
   * Renders asset input buttons after json upload.
   */
  renderAssetInputs() {
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
            @change="${this.handleAssetUpload}"
          />
          <br>
        `:
        ""
    ):
    ""}
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
            @change="${this.handleAssetUpload}"
          />
          <br>
        `
      ):
    ""}
    `;
  }

  /**
   * Renders json editor/GUI toggle button.
   */
  renderJsonEditorButton() {
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
  renderLayerButton(layer: Layer) {
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
  renderVisibilityCheckbox(layer: Layer) {
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
  renderLayerColorContent(layer: Layer) {
    if (layer.ty === 1) {
      return html`
      <br>
      <div>
        Color: 
        <input
        type="color"
        id="${layer.nm} Color Input"
        value="${layer.sc}"
        @change="${this.updateJson}">
      </div>
      `;
    } else if (layer.ty  === 4) {
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
                value="${this.extractColor(shape)}"
                @change="${this.updateJson}">
              </div>
            </div>
          `:
          ""
        )}
      `;
    } else {
      return ""
    }
  }

  render() {
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
      </div>` :
      ""
      }

      <slot></slot>
      <br>

      JSON upload
      <input
      type="file"
      id="input"
      accept=".json"
      @change="${this.handleFileUpload}"
      />
      <br>

      ${this.renderAssetInputs()}

      ${this.fileUploaded ?
        html`
        <h3>Editor</h3>
        ${this.renderJsonEditorButton()}

        <div
        style="display:${this.showJsonEditor ?
        "none":
        ""}">
          <div>
          Frame Rate:
          <input
          id="newframerate"
          value="${this.content.fr}"
          @change="${this.updateJson}">
          </div>

          ${(this.content.layers as Layer[]).map(layer => html`
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
          `)}
        </div>`:
        ""
      }
      <div 
      id="json-editor-container"
      style="display:${this.showJsonEditor ?
      "":
      "none"}">
      </div>
    `;
  }

  /**
   * Sets up the JSONEditor after the initial render.
   */
  firstUpdated(): void {
    if (this.shadowRoot) {
      const editorContainer = this.shadowRoot.getElementById('json-editor-container');
      if(editorContainer) {
        const options: JSONEditorOptions = {
          mode: 'tree',
          onChange: () => {
            this.updateJson();
          }
        };
        this.jsonEditor = new JSONEditor(editorContainer, options);
      }
    }
  }


  /**
   * Sets content object as well as width and height.
   */ 
  setContent(newContent: any): void {
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
  updatePlayer(): void {
    if (this._shouldRenderAnimation()) {
      const loadLottie = fetch(this.fileUrl).then((resp) => resp.text());
      Promise.all([loadKit, loadLottie]).then((values: any) => {
        const [SkottieKit, lottieJSON] = values;
        const animation = SkottieKit.MakeManagedAnimation(lottieJSON, this.assets);
        const duration = animation.duration() * 1000;

        const oldCanvas = document.getElementById('my-canvas');
        if(oldCanvas) {
          oldCanvas.remove();
        }

        const canvasElement = document.createElement('canvas');
        canvasElement.setAttribute('id', 'my-canvas');
        canvasElement.setAttribute('width', this.width.toString());
        canvasElement.setAttribute('height', this.height.toString());

        const parent = document.getElementById('skottie-player');
        if (parent) {
          parent.append(canvasElement);
          this.canvasSurface = SkottieKit.MakeCanvasSurface('my-canvas');
        }
  
        const surface = (this.canvasSurface as any);
  
        const firstFrame = Date.now();
        const clearColor = SkottieKit.WHITE;
        const bounds = {fLeft: 0, fTop: 0, fRight: this.width, fBottom: this.height};
      
        function drawFrame(canvas: any) {
            // seek takes a float from 0.0 to 1.0
            const seek = ((Date.now() - firstFrame) / duration) % 1.0;
            animation.seek(seek);
      
            canvas.clear(clearColor);
            animation.render(canvas, bounds);
            surface.requestAnimationFrame(drawFrame);
        }
        surface.requestAnimationFrame(drawFrame);
      });
    } else {
      const canvasElement = document.getElementById('my-canvas');
      if (canvasElement) {
        canvasElement.setAttribute('style', 'display:none');
      }
    }
  }

  /**
   * Handles json file upload. Updates content, editor, and player based on 
   * file content.
   */
  handleFileUpload(): void {
    if (this.shadowRoot) {
      const fileInput = this.shadowRoot.getElementById('input');
      if (fileInput) {
        const files = (fileInput as HTMLInputElement).files;
        if (files) {
          const file = files[0];
          if(file) {
            const reader = new FileReader();
  
            this.title = file.name;
            this.fileUrl = window.URL.createObjectURL(file);
  
            reader.readAsText(file);
            reader.onload = () => {
              this.setContent(JSON.parse(reader.result as string));
              this.assets = {};
              this.imageColors = {};
              this.fileString = JSON.stringify(this.content);
              this._loadJSONEditor();
              this.updatePlayer();
              this.fileUploaded = true;
            };
          }
        }
      }
    }
  }

  /**
   * Handles asset upload. Updates assets, color, and player based on
   * file content.
   */
  handleAssetUpload(e: Event): void {
    const assetInput = (e.composedPath()[0] as HTMLInputElement);
    const mapKey = assetInput.getAttribute('map-key');
    const assetType = assetInput.getAttribute('asset-type')
    if (assetInput && mapKey && assetType) {
      const files = assetInput.files;
      if (files) {
        const file = files[0];
        if (file) {
          const reader = new FileReader();
          
          if (assetType === 'image') {
            Promise.all([
              createImageBitmap(file),
            ]).then((imageBitmaps) => {
              (this.imageColors as any)[mapKey] = colorThief.getColor(imageBitmaps[0]);
            });
          }

          reader.readAsArrayBuffer(file);
          reader.onload = () => {
            (this.assets as any)[mapKey] = reader.result;
            this.updatePlayer();
          }
        }
      }
    }
  }

  /**
   * Loads content into the JSONEditor.
   */
  _loadJSONEditor(): void {
    (this.jsonEditor as JSONEditor).set(this.content);
  }

  /**
   * Shows the JSONEditor and hids the GUI editor. Also applies updates
   * to the stored JSON data.
   */
  showJSONEditor(): void {
    this.updateJson();
    this.showJsonEditor = true;
    this._loadJSONEditor();
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
        this._updateJsonWithEditor();
      } else {
        this._updateJsonFramerate();
        this._updateJsonLayers();
      }
      this.fileString = JSON.stringify(this.content);

      // update download link
      URL.revokeObjectURL(this.fileUrl);
      this.fileUrl = URL.createObjectURL(new Blob([this.fileString]));
      
      // update animation
      lottiePlayer.destroy();
      this.updatePlayer();
  }
  
  /**
   * Toggles visibility of content for the clicked button. 
   */
  toggleContent(e: Event): void {
    const layerButton = (e.composedPath()[0] as HTMLElement);
    const layerName = layerButton.getAttribute('layername');
    const buttonToggled = layerButton.getAttribute('toggled');
    if (this.shadowRoot && layerName && buttonToggled) {
      let layerContentElement = this.shadowRoot.getElementById(layerName.concat(' Content'));
      if(layerContentElement && buttonToggled === 'false') {
        layerContentElement.style.display = '';
        layerButton.setAttribute('toggled', 'true');
      } else if(layerContentElement && buttonToggled === 'true') {
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
  _colorToString(color: number): String {
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
  _rgbaToHex(rgba: Array<number>): String {
    const r = this._colorToString(rgba[0]);
    const g = this._colorToString(rgba[1]);
    const b = this._colorToString(rgba[2]);

    return '#' + r + g + b;
  }

  /**
   * Extracts color hex string from a shape object.
   * 
   * @param shape   Type can be fill or group
   */
  extractColor(shape: any): String {
    if (shape.ty === 'gr' && shape.it) {
      for (let i = 0; i < shape.it.length; i++) {
        if (shape.it[i].ty === 'fl') {
          return this._rgbaToHex(shape.it[i].c.k);
        }
      }
    } else {
      if (shape.ty === 'fl') {
        return this._rgbaToHex(shape.c.k);
      }
    }
    return '';
  }

  /**
   * Updates the conent object using changes made with the JSONEditor.
   */
  _updateJsonWithEditor(): void {
    if(this.shadowRoot) {
      const editor = this.shadowRoot.getElementById('json-editor-container');
      if (editor) {
        this.setContent((this.jsonEditor as JSONEditor).get());
      }
    }
  }

  /**
   * Updates the framerate in the content object.
   */
  _updateJsonFramerate(): void {
    if (this.shadowRoot) {
      const framerateInput = (this.shadowRoot.getElementById('newframerate') as HTMLInputElement);
      if (framerateInput && framerateInput.value) {
        this.content.fr = parseFloat(framerateInput.value);
      }
    }
  }

  /**
   * Updates the layers in the content object.
   */
  _updateJsonLayers(): void {
    if (this.content.layers) {
      for(let i = 0; i < this.content.layers.length; i++) {
        this._updateLayerVisibility(i);
        this._updateLayerColor(i);
      }
    }
  }

  /**
   * Updates the visibilty of the layer with given index in the layer array.
   */
  _updateLayerVisibility(layerIndex: number): void {
    if (this.shadowRoot && this.content.layers) {
      const layerVisibility = this.shadowRoot.getElementById(this.content.layers[layerIndex].nm + 
        ' Visibility') as HTMLInputElement;
      if (layerVisibility) {
        if (layerVisibility.checked) {
          this.content.layers[layerIndex].ks.o.k = 100;
        } else {
          this.content.layers[layerIndex].ks.o.k = 0;
        }
      }
    }
  }

  /**
   * Updates the color of the layer with given index in the layer array.
   */
  _updateLayerColor(layerIndex: number): void {
    if (this.shadowRoot && this.content.layers) {
      if (this.content.layers[layerIndex].ty === 1) {
        const colorInput = this.shadowRoot.getElementById(this.content.layers[layerIndex].nm + 
            ' Color Input') as HTMLInputElement;
        if (colorInput) {
          this.content.layers[layerIndex].sc = colorInput.value;
        }
      } else if (this.content.layers[layerIndex].ty === 4) {
        for (let shapeIndex = 0; 
          shapeIndex < (this.content.layers[layerIndex].shapes as any).length;
          shapeIndex++) {
          const colorInput = this.shadowRoot.getElementById(this.content.layers[layerIndex].nm + 
              ' ' + (this.content.layers[layerIndex].shapes as any)[shapeIndex].nm +
              ' Color Input') as HTMLInputElement;
          if (colorInput) {
            this._setShapeColor((this.content.layers[layerIndex].shapes as any)[shapeIndex],
              this._hexToRgba(colorInput.value));
          }
        }
      }
    }
  }

  /**
   * Sets the color of a given shape.
   * @param shape   Type can be fill or group
   * @param rgba    Has a length of 4, values in range [0, 1]
   */
  _setShapeColor(shape: any, rgba: Array<number>): void {
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
  _hexToRgba(hex: string): Array<number> {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    return [r, g, b, 1];
  }

  /**
   * Gets the number of image assets from an array of required assets.
   */
  _getNumAssets(assets: Array<any>): number {
    let length = 0;
    for (let i = 0; i < assets.length; i++) {
      if(assets[i].p != undefined) {
        length++;
      }
    }
    return length;
  }

  /**
   * Determines if the animation should be rendered.
   */
  _shouldRenderAnimation(): boolean {
    if (this.content.fonts) {
      return this.content.assets && this.content.fonts &&
        Object.keys(this.assets).length === this._getNumAssets(this.content.assets) + 
        this.content.fonts.list.length;
    }
    return (this.content.assets != undefined) && 
      Object.keys(this.assets).length === this._getNumAssets(this.content.assets);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'skottie-player': SkottiePlayer;
  }
}
