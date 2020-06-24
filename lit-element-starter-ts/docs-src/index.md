---
layout: page.11ty.cjs
title: <skottie-player> ⌲ Home
---

# &lt;skottie-player>

`<skottie-player>` is an awesome element. It's a great introduction to building web components with LitElement, with nice documentation site as well.

## As easy as HTML

<section class="columns">
  <div>

`<skottie-player>` is just an HTML element. You can it anywhere you can use HTML!

```html
<skottie-player></skottie-player>
```

  </div>
  <div>

<skottie-player></skottie-player>

  </div>
</section>

## Configure with attributes

<section class="columns">
  <div>

`<skottie-player>` can be configured with attributed in plain HTML.

```html
<skottie-player name="HTML"></skottie-player>
```

  </div>
  <div>

<skottie-player name="HTML"></skottie-player>

  </div>
</section>

## Declarative rendering

<section class="columns">
  <div>

`<skottie-player>` can be used with declarative rendering libraries like Angular, React, Vue, and lit-html

```js
import {html, render} from 'lit-html';

const name="lit-html";

render(html`
  <h2>This is a &lt;skottie-player&gt;</h2>
  <skottie-player .name=${name}></skottie-player>
`, document.body);
```

  </div>
  <div>

<h2>This is a &lt;skottie-player&gt;</h2>
<skottie-player name="lit-html"></skottie-player>

  </div>
</section>
