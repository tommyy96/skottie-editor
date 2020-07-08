/**
 * @license
 * Copyright (c) 2019 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */

import {LitElement, html, customElement, property, css} from 'lit-element';
// import {Lottie} from 'lottie-web';
import * as lottie from 'lottie-web'; // Using light version for lighter bundle
type LettiePlayer = typeof lottie.default;
const lottiePlayer = lottie as any as LettiePlayer;
// console.log(lottiePlayer)

// const JSONEditor = require('jsoneditor/dist/jsoneditor-minimalist.js');
// const lottie = require('../node_modules/lottie-web/build/player/lottie.min.js');

//const CanvasKitInit = require('../node_modules/canvaskit-wasm/bin/canvaskit.js');

// const loadingTemplate = (ele: SkottiePlayer) => html`
// <div class=player-loading title="Loading animation and engine."
//   style='width: ${ele._config.width}px; height: ${ele._config.height}px;'>
//   <div>Loading</div>
//   <spinner-sk active></spinner-sk>
// </div>`;

// const runningTemplate = (ele: SkottiePlayer) => html`
// <div class=container>
//   <div class=wrapper>
//     <canvas class=skottie-canvas id=skottie
//             width=${ele._config.width * window.devicePixelRatio}
//             height=${ele._config.height * window.devicePixelRatio}
//             style='width: ${ele._config.width}px; height: ${ele._config.height}px;'>
//       Your browser does not support the canvas tag.
//     </canvas>
//     <div class=controls ?hidden=${!ele._config.controls}>
//       <play-arrow-icon-sk @click=${ele._onPlay} ?hidden=${!ele._state.paused}></play-arrow-icon-sk>
//       <pause-icon-sk @click=${ele._onPause} ?hidden=${ele._state.paused}></pause-icon-sk>
//       <input type=range min=0 max=100 @input=${ele._onScrub} @change=${ele._onScrubEnd}
//              class=skottie-player-scrubber>
//       <settings-icon-sk @click=${ele._onSettings}></settings-icon-sk>
//     </div>
//   </div>
//   ${settingsTemplate(ele)}
// </div>`;

interface layer {
  ty?: Number,
  ks?: any, // transform object
  ao?: Number,
  bm?: Number,
  ddd?: Number,
  ind?: Number,
  cl?: String,
  ln?: String,
  ip?: Number,
  op?: Number,
  st?: Number,
  nm?: String,
  hasMask?: Number,
  masksProperties?: Array<any>,
  ef?: Array<any>, // effects
  sr?: Number,
  parent?: Number,
  shapes?: Array<any>, // shapes
  sc?: String,
  sh?: Number,
  sw?: Number,
  refID?: String,
  tm?: any, // time remapping
  t?: any // text
};

interface lottieFile {
  ip?: Number,
  op?: Number,
  fr?: Number,
  w?: Number,
  h?: Number,
  ddd?: Number,
  v?: String,
  nm?: String,
  layers?: Array<layer>,
  assets?: Array<any>,
  chars?: Array<any>
};


/**
 * An example element.
 *
 * @slot - This element has a slot
 * @csspart button - The button
 */
@customElement('skottie-player')
export class SkottiePlayer extends LitElement {
  static get styles() {
    return css`
    :host {
      display: block;
      border: solid 1px gray;
      padding: 16px;
      max-width: 800px;
    }
  `;
  }

  /**
   * The title of the json file.
   */
  @property({type: String})
  title = '';

  /**
   * The content of the json file.
   */
  @property({type: Object})
  content:lottieFile = {};

  /**
   * The URL to the json file.
   */
  @property({type: String})
  fileURL = '../samples/animations/gear.json';

  constructor() {
    super();
    this.title = 'Select a file';
  }

  render(){
    return html`
      <!-- <script src="../node_modules/lottie-web/build/player/lottie.min.js" type="text/javascript"></script> -->

      <h1>${this.title}</h1>
      <div style='width:600px;height:600px' id='player' class='lottie' data-anim-loop='true'></div>
      <!-- <ul>
      ${this.content.layers?.map(i => html`
        <li>
          <ul>${this._showLayerProperties(i).map(j => html`
            <li>${j}</li>
          `)}
          </ul>
        </li>
      `)}
      </ul> -->
      <input type="file" id="input" accept=".json" @change="${this._handleFileUpload}">
      `;
  }

  // sets content object
  setContent(newContent: Object): void {
    this.content = newContent;
  }

  updatePlayer(): void {
    console.log(this.fileURL);
    let player = this.shadowRoot?.getElementById("player");
    if(player) {
      let animData = {
        container: player,
        renderer: 'svg',
        loop: true,
        autoplay: true,
        rendererSettings: {
            progressiveLoad:true,
            preserveAspectRatio: 'xMidYMid meet',
            imagePreserveAspectRatio: 'xMidYMid meet',
            filterSize: {
                width: '300%',
                height: '300%',
                x: '-100%',
                y: '-100%',
            }
        },
        path: this.fileURL
      };
      console.log(animData);
      console.log(typeof lottie);
      console.log(lottiePlayer);
      const animation = lottiePlayer.loadAnimation(animData);
      animation.play();
    }
  }


  // handles file upload
  _handleFileUpload(): void {
    let fileInput = this.shadowRoot?.getElementById("input");
    if(fileInput) {
      let files = (fileInput as HTMLInputElement).files;
      if(files) {
        let file = files[0];
        let reader = new FileReader();
        let player = this;

        this.title = file.name;
        this.fileURL = window.URL.createObjectURL(file);

        reader.readAsText(file);
        reader.onload = function() {
          player.setContent(JSON.parse((reader.result as string)));
          player.updatePlayer();
        };
      }
    }
  }

  // gets editable properties from layer
  _showLayerProperties(currLayer: layer): Array<any> {
    let propArray = [];
    switch(currLayer.ty) {
      case 0:
        // not really sure what to include in this
        console.log("Type: precomp");
        propArray.push(currLayer.ip);
        propArray.push(currLayer.op);
        propArray.push(currLayer.st);
        propArray.push(currLayer.sr);
        break;
      case 1:
        console.log("Type: solid");
        propArray.push(currLayer.ip);
        propArray.push(currLayer.op);
        propArray.push(currLayer.st);
        propArray.push(currLayer.sr);
        propArray.push(currLayer.sc);
        propArray.push(currLayer.sh);
        propArray.push(currLayer.sw);
        break;
      case 2:
        console.log("Type: image");
        propArray.push(currLayer.ip);
        propArray.push(currLayer.op);
        propArray.push(currLayer.st);
        propArray.push(currLayer.sr);
        break;
      case 3:
        console.log("Type: null");
        propArray.push(currLayer.ip);
        propArray.push(currLayer.op);
        propArray.push(currLayer.st);
        propArray.push(currLayer.sr);
        break;
      case 4:
        // console.log("Type: shape");
        propArray.push(currLayer.ip);
        propArray.push(currLayer.op);
        propArray.push(currLayer.st);
        propArray.push(currLayer.sr);
        propArray.push(currLayer.shapes);
        break;
      case 5:
        console.log("Type: text");
        propArray.push(currLayer.ip);
        propArray.push(currLayer.op);
        propArray.push(currLayer.st);
        propArray.push(currLayer.sr);
        propArray.push(currLayer.t);
        break;
      default:
        console.log("No type!");
        propArray.push('No type')
    }
    return propArray;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'skottie-player': SkottiePlayer;
  }
}
