/**
 * skottie-player.ts
 */

import {css, customElement, html, LitElement, property} from 'lit-element';
import lottiePlayer, {AnimationConfigWithPath} from 'lottie-web/build/player/lottie_light';
import JSONEditor, {JSONEditorOptions} from 'jsoneditor';
// import SkottieKit from 'skottiekit-wasm';
const SkottieKitInit = require('skottiekit-wasm/bin/skottiekit.js');
// const CanvasKitInit = require('canvaskit-wasm/bin/canvaskit.js');

const fs = require('fs');
const path = require('path');

const loadKit = SkottieKitInit({
  locateFile: (file: string) => '/node_modules/skottiekit-wasm/bin/'+file,
});

// CanvasKitInit().then((CanvasKit: any) => {
//   // Code goes here using CanvasKit
//   CanvasKit;
// });
// require('./styles.css');

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

// interface Shape {
//   // fill out
// }

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

  @property({type: JSONEditor})
  jsonEditor = {};

  @property({type: Object})
  canvasSurface = {};

  @property({type: Boolean})
  fileChanged = false;

  @property({type: Map})
  assets = {};


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
              @change="${this.handleAssetUpload}"
            />
            <br>
            `
            ):
          ""}

      ${this.fileUploaded ?
        html`
        <h3>Editor</h3>
        ${this.showJsonEditor ?
          html`
          <button 
          type="button"
          @click="${this.hideJSONEditor}">
          Show GUI Editor
          </button>` :
          html`
          <button 
          type="button"
          @click="${this.showJSONEditor}">
          Show JSON Editor
          </button>`
        }

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
        <button
        type="button"
        class="layerbutton"
        @click="${this.toggleContent}"
        layername="${layer.nm}"
        toggled="false">
        ${layer.nm}
        </button>
        
        <div
        class="content"
        id="${layer.nm} Content"
        style="display:none">
          <div>
          Visibility:
          ${layer.ks.o.k === 0 ?
          html`
          <input
          type="checkbox"
          id="${layer.nm} Visibility"
          @click="${this.updateJson}">`:
          html`
          <input
          type="checkbox"
          id="${layer.nm} Visibility"
          checked
          @click="${this.updateJson}">`
          }
          </div>
          ${layer.ty === 1 ?
          html`
          <br>
          <div>
          Color: <input
          type="color"
          id="${layer.nm} Color Input"
          value="${layer.sc}"
          @change="${this.updateJson}">
          </div>`:
          ""
          }
          ${layer.ty === 4 ?
          html`
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
            Color: <input
            type="color"
            id="${layer.nm + ' ' + shape.nm} Color Input"
            value="${this.extractColor(shape)}"
            @change="${this.updateJson}">
          </div>
          </div>
          `:
          "")}
          `:
          ""}
        </div>
        
        </div>`)}
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

  firstUpdated() {
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
    // Load the animation Lottie JSON file.
    if (this._jsonUploaded() && this.content.assets && this.content.fonts &&
      (this.assets as Map<string, any>).size === this._getNumAssets(this.content.assets) + this.content.fonts.list.length) {
      const loadLottie = fetch(this.fileUrl).then((resp) => resp.text());
      console.log(this.assets);
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
          this.fileChanged = false;
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
              if (this.content.assets) {
                this.assets = new Map<string, any>();
              }
              this.fileString = JSON.stringify(this.content);
              this._loadJSONEditor();
              this.fileChanged = true;
              this.updatePlayer();
              this.fileUploaded = true;
            };
          }
        }
      }
    }
  }

  handleAssetUpload(e: Event): void {
    const assetInput = (e.composedPath()[0] as HTMLInputElement);
    const mapKey = assetInput.getAttribute('map-key');
    if (assetInput && mapKey) {
      const files = assetInput.files;
      if (files) {
        const reader = new FileReader();
        reader.readAsArrayBuffer(files[0]);
        reader.onload = () => {
          console.log(reader.result);
          (this.assets as Map<string, any>).set(mapKey, reader.result);
          this.updatePlayer();
        }
      }
    }
  }


  _loadJSONEditor(): void {
    (this.jsonEditor as JSONEditor).set(this.content)
  }

  showJSONEditor(): void {
    this.updateJson();
    this.showJsonEditor = true;
    this._loadJSONEditor();
  }

  hideJSONEditor(): void {
    this.updateJson();
    this.showJsonEditor = false;
  }

  /**
   * Updates the downloadable json file, content, and animation based on 
   * changes in the editor.
   */
  updateJson(): void {
    if (this.shadowRoot) {
      if (this.showJsonEditor) {
        console.log("JSON Editor");
        const editor = this.shadowRoot.getElementById('json-editor-container');
        if (editor) {
          // pull updated json
          this.setContent((this.jsonEditor as JSONEditor).get());
          this.fileString = (this.jsonEditor as JSONEditor).getText();
        }
      } else {
        console.log("GUI Editor");
        // pull updated json
        const framerateInput = (this.shadowRoot.getElementById('newframerate') as HTMLInputElement);
        if (framerateInput && framerateInput.value) {
          this.content.fr = parseFloat(framerateInput.value);
        }
        if (this.content.layers) {
          for(let i = 0; i < this.content.layers.length; i++) {
            const layerVisibility = 
              this.shadowRoot.getElementById(this.content.layers[i].nm + 
                ' Visibility') as HTMLInputElement;
            if (layerVisibility) {
              if (layerVisibility.checked) {
                this.content.layers[i].ks.o.k = 100;
              } else {
                this.content.layers[i].ks.o.k = 0;
              }
            }

            if (this.content.layers[i].ty === 1) {
              const colorInput = 
                this.shadowRoot.getElementById(this.content.layers[i].nm + 
                  ' Color Input') as HTMLInputElement;
              if(colorInput) {
                if (colorInput.value) {
                  this.content.layers[i].sc = colorInput.value;
                }
              }
            } else if (this.content.layers[i].ty === 4) {
              const colorInput = 
                this.shadowRoot.getElementById(this.content.layers[i].nm + 
                  ' ' + (this.content.layers[i].shapes as any)[0].nm +
                  ' Color Input') as HTMLInputElement;
              if (colorInput) {
                this._setShapeColor((this.content.layers[i].shapes as any)[0],
                  this._hexToRgba(colorInput.value));
              }
            }
          }
          this.fileString = JSON.stringify(this.content);
        }
      }
      // update download link
      URL.revokeObjectURL(this.fileUrl);
      this.fileUrl = URL.createObjectURL(new Blob([this.fileString]));
      
      // update animation
      lottiePlayer.destroy();
      this.updatePlayer();
    }
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
   * @param rgba  Has a length of 4, values range from [0, 1]
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
   * @param shape   type can be fill or group
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

  _hexToRgba(hex: string): Array<number> {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    return [r, g, b, 1];
  }

  _jsonUploaded(): boolean {
    if (this.content.assets) {
      return true;
    }
    return false;
  }

  _getNumAssets(assets: Array<any>): number {
    let length = 0;
    for (let i = 0; i < assets.length; i++) {
      if(assets[i].p != undefined) {
        length++;
      }
    }
    return length;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'skottie-player': SkottiePlayer;
  }
}
