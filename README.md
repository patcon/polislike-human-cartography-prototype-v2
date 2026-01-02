# Perspective Landscape Painter (Redesign)

## Current Near-Term

The purpose of this project is to make a map-like interface for exploring perspective maps built from polis-like opinion data.

Live demo of work-in-process newer interface:
https://main--68c53b7909ee2fb48f1979dd.chromatic.com/iframe.html?globals=&args=&id=components-app--default&viewMode=story

2025-09-15 recorded feature walk-through:
https://youtube.com/shorts/cd0Qtzg-0ik

## This branch: Python Notebook Widget

This branch is a test of using [anywidget](https://anywidget.dev/) to build and
bundle a small pieces of JS that can be used to run this app as a Jupyter
Notebook widget. It is not yet tested and confirmed to keep the main app functional.

### Building Widget JS Bundle

```
# npm run build:widget
```

If you then copy `dist/d3map-widget.js` into a notebook like this, then you can use D3Map component (a small part of this full app), to view your data.

https://colab.research.google.com/drive/1PNlxdBiZbgfoSQke6KEcssIQahyE7dyz

### Notebook Widget Code

Set up the widget in one cell:

```py
import anywidget
import traitlets

class D3MapWidget(anywidget.AnyWidget):
    _esm = "3map-widget.js"

    # Data: list of [id, [x, y]]
    data = traitlets.List(default_value=[]).tag(sync=True)

    # Mode: "move" or "paint"
    mode = traitlets.Unicode("move").tag(sync=True)

    # List of IDs selected in paint mode
    selection = traitlets.List(default_value=[]).tag(sync=True)
```

Now render it in another cell:

```py
widget = D3MapWidget(data=your_projected_data, mode="move")

widget
```


## Future Medium-Term

A sub-goal is to allow people to build intuitions about trade-offs of various algorithms and their parameters, during the data processing pipeline.

Demo of parameter exploration interface:
https://patcon.github.io/polis-param-chooser-component/
